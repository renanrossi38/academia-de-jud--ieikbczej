///
// Aviso de mensalidade em atraso (Judô Tatsu).
//
// Dois caminhos, o MESMO e-mail:
//  1. Rota manual chamada pelo painel (botão "Notificar atrasados" em
//     /painel/alunos): POST /backend/v1/judo/fees/notify-overdue — envia sempre,
//     sem trava anti-spam, e atualiza `last_notice_at` de cada mensalidade.
//  2. Cron MENSAL (dia 16, 09:00, America/Sao_Paulo — o vencimento padrão é dia
//     15): mesmo aviso, automático. Mantém a trava anti-duplicidade
//     (`last_notice_at` + 7 dias) para não reenviar a quem já recebeu.
//
// O texto do e-mail NÃO é mais fixo: vem da collection `app_settings`
// (chaves "fee_overdue_template" e "fee_overdue_subject"), editável no painel
// em /painel/configuracoes. Placeholders substituídos no envio:
//   {saudacao} — "Bom dia" / "Boa tarde" / "Boa noite" (fuso São Paulo);
//   {aluno}    — nome do aluno;
//   {mes}      — mês de referência da mensalidade em atraso, em português.
// Se o registro de configuração não existir, usa o FALLBACK abaixo (o texto
// original da v0.0.33).
//
// Regra de "atrasado": status "pendente" com mês de referência já vencido OU
// vencimento já passado (reference_month < mês atual, ou mês corrente cujo
// due_date já venceu) — a MESMA lógica dos badges/contadores do painel
// (feeStanding/isOverdue em src/services/monthlyFees.ts).
// Alunos sem e-mail no cadastro são pulados, sem erro, e contados.
//
// FUSO: todo "hoje"/"este mês" aqui é calculado em Brasília (UTC-3 o ano todo —
// o Brasil não observa horário de verão desde 2019), deslocando o relógio
// manualmente e lendo os componentes UTC. `now.getMonth()` direto daria a data
// do SERVIDOR (UTC) e às vésperas da virada do mês/dia o backend julga menos
// mensalidades atrasadas do que o painel — exatamente a divergência v0.0.37:
// o painel contava 2 alunos e a rota respondia enviados=0.
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
    var RESEND_DAYS = 7
    // Fallback (texto original da v0.0.33), usado só se a configuração sumir.
    var FALLBACK_SUBJECT = 'Aviso de mensalidade em atraso - Judô Tatsu'
    var FALLBACK_TEMPLATE =
      '{saudacao}, {aluno},\n\n' +
      'verificamos que o pagamento e a mensalidade do mês de {mes} não foi ' +
      'localizada em nosso sistema. Caso o mesmo tenha sido realizado, favor ' +
      'entrar em contato, enviando o comprovante de pagamento para que possamos ' +
      'dar baixa.\n\n' +
      'Atenciosamente: Equipe Tatsu'

    // Relógio de Brasília: desloca 3h para trás e lê os componentes UTC.
    function brasilia(d) {
      return new Date(d.getTime() - 3 * 60 * 60 * 1000)
    }
    // "2026-11" (Brasília).
    function chaveDoMes(d) {
      var b = brasilia(d)
      return b.getUTCFullYear() + '-' + ('0' + (b.getUTCMonth() + 1)).slice(-2)
    }
    // "2026-11-21" (Brasília) — comparada com a parte de DATA do due_date.
    function chaveDoDia(d) {
      var b = brasilia(d)
      return (
        b.getUTCFullYear() +
        '-' +
        ('0' + (b.getUTCMonth() + 1)).slice(-2) +
        '-' +
        ('0' + b.getUTCDate()).slice(-2)
      )
    }

    // Saudação conforme o horário de Brasília. Mesma base do chaveDoDia.
    function saudacao() {
      var h = (now.getUTCHours() + 21) % 24 // UTC-3 → (hora + 24 - 3) % 24
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

    // Mensalidade atrasada = pendente com mês de referência anterior ao mês atual
    // OU mês corrente cujo vencimento (due_date) já passou — MESMA regra do
    // feeStanding/isOverdue do painel (src/services/monthlyFees.ts), em Brasília.
    function estaAtrasada(fee) {
      if (fee.getString('status') !== 'pendente') return false
      if (fee.getString('reference_month') < chaveDoMes(now)) return true
      // Mês corrente: só conta se o vencimento já passou (compara por DIA —
      // data "2026-11-20" vence antes de qualquer hora do dia 21).
      var due = fee.getDateTime('due_date')
      if (!due || !due.string()) return false
      var dueDay = due.string().split(' ')[0]
      return dueDay < chaveDoDia(now)
    }

    // Última mensalidade em atraso do aluno — se houver vários meses, o mais recente.
    function mesMaisRecenteEmAtraso(fees) {
      var latest = null
      for (var i = 0; i < fees.length; i++) {
        if (estaAtrasada(fees[i])) latest = fees[i]
      }
      return latest
    }

    // Lê o template e o assunto da collection app_settings (fallback se faltarem).
    function readTemplate() {
      var tpl = FALLBACK_TEMPLATE
      var subject = FALLBACK_SUBJECT
      try {
        var settings = $app.findRecordsByFilter('app_settings', "key ~ 'fee_overdue_'", '', 0, 0)
        for (var i = 0; i < settings.length; i++) {
          var key = settings[i].getString('key')
          var value = settings[i].getString('value')
          if (key === 'fee_overdue_template' && value.trim()) tpl = value
          if (key === 'fee_overdue_subject' && value.trim()) subject = value
        }
      } catch (err) {
        console.log('Falha ao ler app_settings, usando template padrão: ' + err)
      }
      return { tpl: tpl, subject: subject }
    }

    // Substitui os placeholders do template editável. Não usa .replaceAll
    // (não existe na JSVM): .split().join() substitui TODAS as ocorrências.
    function aplicarPlaceholders(tpl, alunoNome, mesReferencia) {
      return tpl
        .split('{saudacao}')
        .join(saudacao())
        .split('{aluno}')
        .join(alunoNome || 'aluno(a)')
        .split('{mes}')
        .join(nomeDoMes(mesReferencia))
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

    var cfg = readTemplate()

    var fees = $app.findRecordsByFilter(
      'monthly_fees',
      'status = "pendente"',
      '-reference_month',
      0,
      0,
    )

    // Agrupa por aluno (um único e-mail por aluno, mesmo com vários meses em atraso).
    var byStudent = {}
    var pendentes = 0
    for (var i = 0; i < fees.length; i++) {
      pendentes++
      if (!estaAtrasada(fees[i])) continue
      var sid = fees[i].getString('student')
      if (!byStudent[sid]) byStudent[sid] = []
      byStudent[sid].push(fees[i])
    }

    var sent = 0
    var skippedNoEmail = 0
    var skippedRecent = 0
    var failed = 0
    var sentNames = []
    var skippedNoEmailNames = []
    var skippedRecentNames = []
    var failedNames = []
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
        failedNames.push(studentId)
        continue
      }
      var email = (student.getString('email') || '').trim()
      if (!email) {
        skippedNoEmail++
        skippedNoEmailNames.push(student.getString('name') || studentId)
        continue
      }

      var latestFee = mesMaisRecenteEmAtraso(studentFees)
      // Se o admin apagou o {aluno} do template, a saudação fica solta
      // ("Boa noite, verificamos...") — garante um nome no texto.
      var tplParaAluno = cfg.tpl.indexOf('{aluno}') === -1 ? '{aluno}, ' + cfg.tpl : cfg.tpl
      var msgText = aplicarPlaceholders(
        tplParaAluno,
        student.getString('name'),
        latestFee.getString('reference_month'),
      )

      var message = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress || 'nao-resposta@judotatsu.com',
          name: 'Judô Tatsu',
        },
        to: [{ address: email }],
        subject: cfg.subject,
        html: emailHtml(msgText),
      })

      try {
        mailClient.send(message)
        sent++
        sentNames.push(student.getString('name') || studentId)
      } catch (err) {
        console.log('Falha ao enviar aviso de atraso para ' + email + ': ' + err)
        failed++
        failedNames.push(student.getString('name') || studentId)
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

    console.log(
      '[notify-overdue manual] enviados=' +
        sent +
        ' sem_email=' +
        skippedNoEmail +
        ' recentes_pulados=' +
        skippedRecent +
        ' falhas=' +
        failed,
    )
    // Se o painel mostrava atrasados mas a rota não viu nenhum, este log
    // mostra exatamente o que o backend julgou — facilita a próxima caça.
    if (sent + skippedNoEmail + skippedRecent + failed === 0) {
      console.log(
        '[notify-overdue manual] nenhum atrasado no backend: hoje(UTC)=' +
          now.toISOString() +
          ' mes_brasilia=' +
          chaveDoMes(now) +
          ' dia_brasilia=' +
          chaveDoDia(now) +
          ' pendentes=' +
          pendentes,
      )
    }
    return e.json(200, {
      sent: sent,
      skippedNoEmail: skippedNoEmail,
      skippedRecent: skippedRecent,
      failed: failed,
      sentNames: sentNames,
      skippedNoEmailNames: skippedNoEmailNames,
      skippedRecentNames: skippedRecentNames,
      failedNames: failedNames,
    })
  },
  $apis.requireAuth(),
)

// Cron MENSAL (dia 16 às 09:00, horário de São Paulo): o vencimento padrão é
// dia 15, então o aviso sai uma única vez por mês — não mais diariamente.
// Mantém a trava de 7 dias (`last_notice_at`) contra reenvio duplicado.
cronAdd('avisos_mensalidade_atrasada', '0 9 16 * *', () => {
  var now = new Date()
  var RESEND_DAYS = 7
  // Fallback (texto original da v0.0.33), usado só se a configuração sumir.
  var FALLBACK_SUBJECT = 'Aviso de mensalidade em atraso - Judô Tatsu'
  var FALLBACK_TEMPLATE =
    '{saudacao}, {aluno},\n\n' +
    'verificamos que o pagamento e a mensalidade do mês de {mes} não foi ' +
    'localizada em nosso sistema. Caso o mesmo tenha sido realizado, favor ' +
    'entrar em contato, enviando o comprovante de pagamento para que possamos ' +
    'dar baixa.\n\n' +
    'Atenciosamente: Equipe Tatsu'

  // Relógio de Brasília: desloca 3h para trás e lê os componentes UTC.
  function brasilia(d) {
    return new Date(d.getTime() - 3 * 60 * 60 * 1000)
  }
  // "2026-11" (Brasília).
  function chaveDoMes(d) {
    var b = brasilia(d)
    return b.getUTCFullYear() + '-' + ('0' + (b.getUTCMonth() + 1)).slice(-2)
  }
  // "2026-11-21" (Brasília) — comparada com a parte de DATA do due_date.
  function chaveDoDia(d) {
    var b = brasilia(d)
    return (
      b.getUTCFullYear() +
      '-' +
      ('0' + (b.getUTCMonth() + 1)).slice(-2) +
      '-' +
      ('0' + b.getUTCDate()).slice(-2)
    )
  }

  // Saudação conforme o horário de Brasília. Mesma base do chaveDoDia.
  function saudacao() {
    var h = (now.getUTCHours() + 21) % 24 // UTC-3 → (hora + 24 - 3) % 24
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

  // Mensalidade atrasada = pendente com mês de referência anterior ao mês atual
  // OU mês corrente cujo vencimento (due_date) já passou — a MESMA regra do
  // feeStanding/isOverdue do painel (src/services/monthlyFees.ts), em Brasília.
  function estaAtrasada(fee) {
    if (fee.getString('status') !== 'pendente') return false
    if (fee.getString('reference_month') < chaveDoMes(now)) return true
    // Mês corrente: só conta se o vencimento já passou (compara por DIA —
    // data "2026-11-20" vence antes de qualquer hora do dia 21).
    var due = fee.getDateTime('due_date')
    if (!due || !due.string()) return false
    var dueDay = due.string().split(' ')[0]
    return dueDay < chaveDoDia(now)
  }

  // Última mensalidade em atraso do aluno — se houver vários meses, o mais recente.
  function mesMaisRecenteEmAtraso(fees) {
    var latest = null
    for (var i = 0; i < fees.length; i++) {
      if (estaAtrasada(fees[i])) latest = fees[i]
    }
    return latest
  }

  // Lê o template e o assunto da collection app_settings (fallback se faltarem).
  function readTemplate() {
    var tpl = FALLBACK_TEMPLATE
    var subject = FALLBACK_SUBJECT
    try {
      var settings = $app.findRecordsByFilter('app_settings', "key ~ 'fee_overdue_'", '', 0, 0)
      for (var i = 0; i < settings.length; i++) {
        var key = settings[i].getString('key')
        var value = settings[i].getString('value')
        if (key === 'fee_overdue_template' && value.trim()) tpl = value
        if (key === 'fee_overdue_subject' && value.trim()) subject = value
      }
    } catch (err) {
      console.log('Falha ao ler app_settings, usando template padrão: ' + err)
    }
    return { tpl: tpl, subject: subject }
  }

  // Substitui os placeholders do template editável. Não usa .replaceAll
  // (não existe na JSVM): .split().join() substitui TODAS as ocorrências.
  function aplicarPlaceholders(tpl, alunoNome, mesReferencia) {
    return tpl
      .split('{saudacao}')
      .join(saudacao())
      .split('{aluno}')
      .join(alunoNome || 'aluno(a)')
      .split('{mes}')
      .join(nomeDoMes(mesReferencia))
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

  var cfg = readTemplate()

  var fees = $app.findRecordsByFilter(
    'monthly_fees',
    'status = "pendente"',
    '-reference_month',
    0,
    0,
  )

  // Agrupa por aluno (um único e-mail por aluno, mesmo com vários meses em atraso).
  var byStudent = {}
  var pendentes = 0
  for (var i = 0; i < fees.length; i++) {
    pendentes++
    if (!estaAtrasada(fees[i])) continue
    var sid = fees[i].getString('student')
    if (!byStudent[sid]) byStudent[sid] = []
    byStudent[sid].push(fees[i])
  }

  var sent = 0
  var skippedNoEmail = 0
  var skippedRecent = 0
  var failed = 0
  var sentNames = []
  var skippedNoEmailNames = []
  var skippedRecentNames = []
  var failedNames = []
  var mailClient = $app.newMailClient()
  var resendMs = RESEND_DAYS * 24 * 60 * 60 * 1000

  for (var studentId in byStudent) {
    var studentFees = byStudent[studentId]
    // Trava anti-duplicidade: pula o aluno se qualquer mensalidade em atraso
    // dele já foi avisada nos últimos 7 dias.
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
      try {
        skippedRecentNames.push($app.findRecordById('students', studentId).getString('name'))
      } catch (_) {
        skippedRecentNames.push(studentId)
      }
      continue
    }

    var student = null
    try {
      student = $app.findRecordById('students', studentId)
    } catch (_) {
      failed++
      failedNames.push(studentId)
      continue
    }
    var email = (student.getString('email') || '').trim()
    if (!email) {
      skippedNoEmail++
      skippedNoEmailNames.push(student.getString('name') || studentId)
      continue
    }

    var latestFee = mesMaisRecenteEmAtraso(studentFees)
    // Mesma proteção do manual: sem {aluno} no template, prefixa o nome.
    var tplParaAluno = cfg.tpl.indexOf('{aluno}') === -1 ? '{aluno}, ' + cfg.tpl : cfg.tpl
    var msgText = aplicarPlaceholders(
      tplParaAluno,
      student.getString('name'),
      latestFee.getString('reference_month'),
    )

    var message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress || 'nao-resposta@judotatsu.com',
        name: 'Judô Tatsu',
      },
      to: [{ address: email }],
      subject: cfg.subject,
      html: emailHtml(msgText),
    })

    try {
      mailClient.send(message)
      sent++
      sentNames.push(student.getString('name') || studentId)
    } catch (err) {
      console.log('Falha ao enviar aviso de atraso para ' + email + ': ' + err)
      failed++
      failedNames.push(student.getString('name') || studentId)
      continue
    }

    // Grava a data do aviso em TODAS as mensalidades em atraso do aluno
    // (a trava anti-duplicidade avalia mensalidade a mensalidade).
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
