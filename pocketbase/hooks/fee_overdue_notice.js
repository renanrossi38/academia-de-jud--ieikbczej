///
// Aviso de mensalidade em atraso (Judô Tatsu).
//
// Dois caminhos, o MESMO e-mail:
//  1. Rota manual chamada pelo painel (botão "Notificar atrasados" em
//     /painel/alunos): POST /backend/v1/judo/fees/notify-overdue — envia sempre,
//     sem trava anti-spam, e atualiza `last_notice_at` de cada mensalidade.
//  2. Cron diário (09:00, America/Sao_Paulo): mesmo aviso, automático. Para não
//     virar spam, só reenvia para uma mensalidade nunca notificada ou com a
//     última notificação há mais de 7 dias.
//
// Regra de "atrasado": status "pendente" com mês de referência já vencido
// (reference_month < mês atual — o mês corrente com vencimento futuro não conta),
// a MESMA lógica dos badges/contadores do painel (feeStanding).
// Alunos sem e-mail no cadastro são pulados, sem erro, e contados.
//
// IMPORTANTE (JSVM do PocketBase): callbacks rodam em um pool de VMs separado e
// NÃO enxergam declarações de nível superior deste arquivo — por isso a rotina
// de envio está colada inline dentro de cada callback (rota manual e cron).
//

// Rota manual usada pelo botão "Notificar atrasados" do painel de alunos.
// Exige login ($apis.requireAuth); o handler confere role = "admin" (admins são
// records da collection users, não superusers).
routerAdd(
  'POST',
  '/backend/v1/judo/fees/notify-overdue',
  (e) => {
    var auth = e.auth
    if (!auth || auth.getString('role') !== 'admin') {
      throw new ForbiddenError('Somente administradores podem enviar avisos de atraso.')
    }

    var force = true
    var now = new Date()
    var SUBJECT = 'Aviso de mensalidade em atraso - Judô Tatsu'
    var RESEND_DAYS = 7

    // Saudação conforme o horário de envio (fuso de São Paulo).
    function saudacao() {
      var h = Number(
        now.toLocaleString('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'America/Sao_Paulo',
        }),
      )
      if (h >= 5 && h < 12) return 'Bom dia'
      if (h >= 12 && h < 18) return 'Boa tarde'
      return 'Boa noite'
    }

    // "2025-11" → "novembro"
    function nomeDoMes(referenceMonth) {
      var meses = [
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
      ]
      var m = parseInt(String(referenceMonth || '').split('-')[1], 10)
      if (!m || m < 1 || m > 12) return referenceMonth || ''
      return meses[m - 1]
    }

    function chaveDoMes(d) {
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)
    }

    // Mensalidade atrasada = pendente com mês de referência anterior ao mês atual.
    function estaAtrasada(fee) {
      if (fee.getString('status') !== 'pendente') return false
      return fee.getString('reference_month') < chaveDoMes(now)
    }

    // Última mensalidade em atraso do aluno — se houver vários meses, o mais recente.
    function mesMaisRecenteEmAtraso(fees) {
      var latest = null
      for (var i = 0; i < fees.length; i++) {
        if (estaAtrasada(fees[i])) latest = fees[i]
      }
      return latest
    }

    function corpoDoEmail(alunoNome, mesReferencia) {
      return (
        saudacao() +
        ', ' +
        (alunoNome || 'aluno(a)') +
        ',\n\n' +
        'verificamos que o pagamento e a mensalidade do mês de ' +
        nomeDoMes(mesReferencia) +
        ' não foi localizada em nosso sistema. ' +
        'Caso o mesmo tenha sido realizado, favor entrar em contato, enviando o ' +
        'comprovante de pagamento para que possamos dar baixa.\n\n' +
        'Atenciosamente: Equipe Tatsu'
      )
    }

    function emailHtml(msgText) {
      var paragraphs = msgText
        .split('\n\n')
        .map(function (p) {
          return (
            '<p style="margin:0 0 14px 0; line-height:1.6; white-space:pre-line;">' + p + '</p>'
          )
        })
        .join('')
      return (
        '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; ' +
        'border: 1px solid #E8E0D5; border-top: 4px solid #C1272D; border-radius: 8px; ' +
        'color:#1C1B1A; background:#FFFFFF;">' +
        '<p style="margin:0 0 14px 0; font-family: serif; font-weight:bold; font-size:18px; color:#C1272D;">🥋 Judô Tatsu</p>' +
        paragraphs +
        '<hr style="border:none; border-top:1px solid #E8E0D5; margin:18px 0;" />' +
        '<p style="margin:0; font-size:12px; color:#6B6560;">Esta é uma mensagem automática da academia Judô Tatsu.</p>' +
        '</div>'
      )
    }

    // Converte o DateTime do PocketBase ("YYYY-MM-DD HH:mm:ss.SSSZ") em epoch ms.
    function epochMs(dt) {
      if (!dt || !dt.string()) return NaN
      return Date.parse(dt.string().replace(' ', 'T'))
    }

    var fees = $app.findRecordsByFilter(
      'monthly_fees',
      'status = "pendente"',
      '-reference_month',
      0,
      0,
    )

    // Agrupa por aluno (um único e-mail por aluno, mesmo com vários meses em atraso).
    var byStudent = {}
    for (var i = 0; i < fees.length; i++) {
      if (!estaAtrasada(fees[i])) continue
      var sid = fees[i].getString('student')
      if (!byStudent[sid]) byStudent[sid] = []
      byStudent[sid].push(fees[i])
    }

    var sent = 0
    var skippedNoEmail = 0
    var skippedRecent = 0
    var failed = 0
    var mailClient = $app.newMailClient()
    var resendMs = RESEND_DAYS * 24 * 60 * 60 * 1000

    for (var studentId in byStudent) {
      var studentFees = byStudent[studentId]
      if (!force) {
        // Cron: pula o aluno se qualquer mensalidade em atraso dele já foi
        // avisada nos últimos 7 dias.
        var recentlyNotified = false
        for (var j = 0; j < studentFees.length; j++) {
          var lastMs = epochMs(studentFees[j].getDateTime('last_notice_at'))
          if (!isNaN(lastMs) && now.getTime() - lastMs < resendMs) {
            recentlyNotified = true
            break
          }
        }
        if (recentlyNotified) {
          skippedRecent++
          continue
        }
      }

      var student = null
      try {
        student = $app.findRecordById('students', studentId)
      } catch (_) {
        failed++
        continue
      }
      var email = (student.getString('email') || '').trim()
      if (!email) {
        skippedNoEmail++
        continue
      }

      var latestFee = mesMaisRecenteEmAtraso(studentFees)
      var msgText = corpoDoEmail(
        student.getString('name') || 'aluno(a)',
        latestFee.getString('reference_month'),
      )

      var message = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress || 'nao-resposta@judotatsu.com',
          name: 'Judô Tatsu',
        },
        to: [{ address: email }],
        subject: SUBJECT,
        html: emailHtml(msgText),
      })

      try {
        mailClient.send(message)
        sent++
      } catch (err) {
        console.log('Falha ao enviar aviso de atraso para ' + email + ': ' + err)
        failed++
        continue
      }

      // Grava a data do aviso em TODAS as mensalidades em atraso do aluno
      // (o cron avalia mensalidade a mensalidade).
      var noticeAt = now.toISOString().replace('T', ' ').substring(0, 19) + '.000Z'
      for (var k = 0; k < studentFees.length; k++) {
        try {
          studentFees[k].set('last_notice_at', noticeAt)
          $app.save(studentFees[k])
        } catch (errSave) {
          console.log(
            'Falha ao registrar last_notice_at da mensalidade ' +
              studentFees[k].id +
              ': ' +
              errSave,
          )
        }
      }
    }

    return e.json(200, {
      sent: sent,
      skippedNoEmail: skippedNoEmail,
      failed: failed,
    })
  },
  $apis.requireAuth(),
)

// Cron diário (09:00, horário de São Paulo): mesmo aviso, com trava de 7 dias.
cronAdd('avisos_mensalidade_atrasada', '0 9 * * *', () => {
  var now = new Date()
  var SUBJECT = 'Aviso de mensalidade em atraso - Judô Tatsu'
  var RESEND_DAYS = 7

  // Saudação conforme o horário de envio (fuso de São Paulo).
  function saudacao() {
    var h = Number(
      now.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'America/Sao_Paulo',
      }),
    )
    if (h >= 5 && h < 12) return 'Bom dia'
    if (h >= 12 && h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  // "2025-11" → "novembro"
  function nomeDoMes(referenceMonth) {
    var meses = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    var m = parseInt(String(referenceMonth || '').split('-')[1], 10)
    if (!m || m < 1 || m > 12) return referenceMonth || ''
    return meses[m - 1]
  }

  function chaveDoMes(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)
  }

  // Mensalidade atrasada = pendente com mês de referência anterior ao mês atual.
  function estaAtrasada(fee) {
    if (fee.getString('status') !== 'pendente') return false
    return fee.getString('reference_month') < chaveDoMes(now)
  }

  // Última mensalidade em atraso do aluno — se houver vários meses, o mais recente.
  function mesMaisRecenteEmAtraso(fees) {
    var latest = null
    for (var i = 0; i < fees.length; i++) {
      if (estaAtrasada(fees[i])) latest = fees[i]
    }
    return latest
  }

  function corpoDoEmail(alunoNome, mesReferencia) {
    return (
      saudacao() +
      ', ' +
      (alunoNome || 'aluno(a)') +
      ',\n\n' +
      'verificamos que o pagamento e a mensalidade do mês de ' +
      nomeDoMes(mesReferencia) +
      ' não foi localizada em nosso sistema. ' +
      'Caso o mesmo tenha sido realizado, favor entrar em contato, enviando o ' +
      'comprovante de pagamento para que possamos dar baixa.\n\n' +
      'Atenciosamente: Equipe Tatsu'
    )
  }

  function emailHtml(msgText) {
    var paragraphs = msgText
      .split('\n\n')
      .map(function (p) {
        return '<p style="margin:0 0 14px 0; line-height:1.6; white-space:pre-line;">' + p + '</p>'
      })
      .join('')
    return (
      '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; ' +
      'border: 1px solid #E8E0D5; border-top: 4px solid #C1272D; border-radius: 8px; ' +
      'color:#1C1B1A; background:#FFFFFF;">' +
      '<p style="margin:0 0 14px 0; font-family: serif; font-weight:bold; font-size:18px; color:#C1272D;">🥋 Judô Tatsu</p>' +
      paragraphs +
      '<hr style="border:none; border-top:1px solid #E8E0D5; margin:18px 0;" />' +
      '<p style="margin:0; font-size:12px; color:#6B6560;">Esta é uma mensagem automática da academia Judô Tatsu.</p>' +
      '</div>'
    )
  }

  // Converte o DateTime do PocketBase ("YYYY-MM-DD HH:mm:ss.SSSZ") em epoch ms.
  function epochMs(dt) {
    if (!dt || !dt.string()) return NaN
    return Date.parse(dt.string().replace(' ', 'T'))
  }

  var fees = $app.findRecordsByFilter(
    'monthly_fees',
    'status = "pendente"',
    '-reference_month',
    0,
    0,
  )

  // Agrupa por aluno (um único e-mail por aluno, mesmo com vários meses em atraso).
  var byStudent = {}
  for (var i = 0; i < fees.length; i++) {
    if (!estaAtrasada(fees[i])) continue
    var sid = fees[i].getString('student')
    if (!byStudent[sid]) byStudent[sid] = []
    byStudent[sid].push(fees[i])
  }

  var sent = 0
  var skippedNoEmail = 0
  var skippedRecent = 0
  var failed = 0
  var mailClient = $app.newMailClient()
  var resendMs = RESEND_DAYS * 24 * 60 * 60 * 1000

  for (var studentId in byStudent) {
    var studentFees = byStudent[studentId]
    // Cron: pula o aluno se qualquer mensalidade em atraso dele já foi
    // avisada nos últimos 7 dias.
    var recentlyNotified = false
    for (var j = 0; j < studentFees.length; j++) {
      var lastMs = epochMs(studentFees[j].getDateTime('last_notice_at'))
      if (!isNaN(lastMs) && now.getTime() - lastMs < resendMs) {
        recentlyNotified = true
        break
      }
    }
    if (recentlyNotified) {
      skippedRecent++
      continue
    }

    var student = null
    try {
      student = $app.findRecordById('students', studentId)
    } catch (_) {
      failed++
      continue
    }
    var email = (student.getString('email') || '').trim()
    if (!email) {
      skippedNoEmail++
      continue
    }

    var latestFee = mesMaisRecenteEmAtraso(studentFees)
    var msgText = corpoDoEmail(
      student.getString('name') || 'aluno(a)',
      latestFee.getString('reference_month'),
    )

    var message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress || 'nao-resposta@judotatsu.com',
        name: 'Judô Tatsu',
      },
      to: [{ address: email }],
      subject: SUBJECT,
      html: emailHtml(msgText),
    })

    try {
      mailClient.send(message)
      sent++
    } catch (err) {
      console.log('Falha ao enviar aviso de atraso para ' + email + ': ' + err)
      failed++
      continue
    }

    // Grava a data do aviso em TODAS as mensalidades em atraso do aluno
    // (o cron avalia mensalidade a mensalidade).
    var noticeAt = now.toISOString().replace('T', ' ').substring(0, 19) + '.000Z'
    for (var k = 0; k < studentFees.length; k++) {
      try {
        studentFees[k].set('last_notice_at', noticeAt)
        $app.save(studentFees[k])
      } catch (errSave) {
        console.log(
          'Falha ao registrar last_notice_at da mensalidade ' + studentFees[k].id + ': ' + errSave,
        )
      }
    }
  }

  console.log(
    '[avisos_mensalidade_atrasada] enviados=' +
      sent +
      ' sem_email=' +
      skippedNoEmail +
      ' recentes_pulados=' +
      skippedRecent +
      ' falhas=' +
      failed,
  )
})
