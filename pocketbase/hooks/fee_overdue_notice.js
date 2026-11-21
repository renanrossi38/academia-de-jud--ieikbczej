///
// Aviso de mensalidade em atraso (Judô Tatsu).
//
// Dois caminhos, o MESMO e-mail:
//  1. Rota manual do painel (botão "Notificar atrasados" em /painel/alunos):
//     POST /backend/v1/judo/fees/notify-overdue — envia sempre (force=true),
//     sem trava anti-spam, e responde nomes por desfecho ao painel.
//  2. Cron MENSAL (dia 16, 09:00 — o vencimento padrão é dia 15): mesmo aviso,
//     automático, com a trava anti-duplicidade (`last_notice_at` + 7 dias).
//
// O texto do e-mail vem da collection `app_settings` (chaves
// "fee_overdue_template" e "fee_overdue_subject"), editável no painel em
// /painel/configuracoes. Placeholders substituídos no envio:
//   {saudacao} — "Bom dia" / "Boa tarde" / "Boa noite" (fuso de Brasília);
//   {aluno}    — nome do aluno;
//   {mes}      — mês da cobrança: o MÊS CORRENTE quando a inadimplência vem da
//                regra do dia 15 (sem lançamento para o mês), ou o mês de
//                referência da pendência vencida, nos demais casos. Um mês JÁ
//                PAGO nunca é citado — nem via lançamento pendente duplicado
//                do mesmo mês.
// Sem registro de configuração, usa o texto padrão inline (mesmo do fallback do
// painel em src/services/appSettings.ts).
//
// REGRA DE "ATRASADO" (definida pelo usuário, v0.0.39) — MESMA do painel
// (feeStanding/isPastFeeDay15 em src/services/monthlyFees.ts), sempre em
// Brasília (UTC-3 fixo):
//   a) A partir do DIA 15 do mês corrente, todo aluno ATIVO que NÃO tenha a
//      mensalidade do mês corrente PAGA é destinatário — MESMO SEM nenhum
//      lançamento para o mês ({mes} = mês corrente). Antes do dia 15, o mês
//      corrente vazio/pendente não conta;
//   b) Mensalidade PENDENTE com reference_month já vencido OU (mês corrente com
//      due_date já passado) conta em qualquer dia ({mes} = reference_month);
//   c) Mensalidade PAGA nunca é atrasada. Aluno INATIVO não entra na regra do
//      dia 15 (uma pendência vencida antiga ainda conta).
// Alunos sem e-mail no cadastro são pulados, sem erro, e contados na resposta.
//
// FUSO: "hoje"/"este mês" aqui é sempre Brasília (UTC-3 o ano todo — o Brasil
// não observa horário de verão desde 2019): o relógio é deslocado 3h para trás
// e lido como UTC. `new Date().getMonth()` direto daria a data do SERVIDOR
// (UTC) e às vésperas da virada do mês/dia o backend julga menos mensalidades
// atrasadas do que o painel — exatamente a divergência corrigida na v0.0.37.
//
// IMPORTANTE (JSVM do PocketBase): as callbacks rodam em um pool de VMs
// separado e NÃO enxergam declarações de nível superior deste arquivo — por
// isso toda a rotina (helpers de fuso, template, julgamento e envio) está
// colada inline dentro de cada callback (cron e rota manual), duplicada de
// propósito.
//
cronAdd('avisos_mensalidade_atrasada', '0 9 16 * *', () => {
  var FORCE = false // cron: respeita a trava de 7 dias

  // ---- Helpers locais (precisam estar dentro da callback para o JSVM) ----

  function brasiliaNow() {
    return new Date(Date.now() - 3 * 60 * 60 * 1000)
  }
  function chaveDoMes(b) {
    return b.getUTCFullYear() + '-' + ('0' + (b.getUTCMonth() + 1)).slice(-2)
  }
  function chaveDoDia(b) {
    return (
      b.getUTCFullYear() +
      '-' +
      ('0' + (b.getUTCMonth() + 1)).slice(-2) +
      '-' +
      ('0' + b.getUTCDate()).slice(-2)
    )
  }

  var nowB = brasiliaNow()
  var mesAtual = chaveDoMes(nowB)
  var depoisDoDia15 = nowB.getUTCDate() >= 15

  function saudacao() {
    var h = nowB.getUTCHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  function nomeMes(mesChave) {
    var partes = mesChave.split('-')
    var nomes = [
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
    return nomes[parseInt(partes[1], 10) - 1] + ' de ' + partes[0]
  }

  function aplicarPlaceholders(texto, nomeAluno, mesCobranca) {
    return texto
      .split('{saudacao}')
      .join(saudacao())
      .split('{aluno}')
      .join(nomeAluno || 'aluno(a)')
      .split('{mes}')
      .join(nomeMes(mesCobranca))
  }

  function emailHtml(texto) {
    return (
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222;line-height:1.6;">' +
      texto +
      '</div>'
    )
  }

  // Texto do e-mail: app_settings com fallback inline (a callback não enxerga
  // constantes de nível superior).
  var DEFAULT_TPL =
    '<p>{saudacao}, {aluno}!</p>' +
    '<p>Verificamos em nosso sistema que a sua mensalidade de <strong>{mes}</strong> ' +
    'está pendente de pagamento na academia Judô Tatsu.</p>' +
    '<p>Se o pagamento já foi realizado, desconsidere esta mensagem — o sistema ' +
    'pode levar algumas horas para processar o lançamento.</p>' +
    '<p>Caso contrário, pedimos que regularize o pagamento o quanto antes para ' +
    'manter o seu acesso às aulas em dia.</p>' +
    '<p>Qualquer dúvida, fale conosco.</p>' +
    '<p style="margin-top:24px;">Atenciosamente,<br /><strong>Judô Tatsu</strong></p>'
  var DEFAULT_SUBJECT = 'Judô Tatsu — Mensalidade pendente ({mes})'

  var template = DEFAULT_TPL
  var subject = DEFAULT_SUBJECT
  try {
    var settings = $app.findRecordsByFilter(
      'app_settings',
      'key = "fee_overdue_template"',
      '',
      1,
      0,
    )
    if (settings.length > 0 && settings[0].getString('value')) {
      template = settings[0].getString('value')
    }
    var subjects = $app.findRecordsByFilter('app_settings', 'key = "fee_overdue_subject"', '', 1, 0)
    if (subjects.length > 0 && subjects[0].getString('value')) {
      subject = subjects[0].getString('value')
    }
  } catch (err) {
    console.log(
      '[avisos_mensalidade_atrasada] app_settings indisponível, usando template padrão: ' + err,
    )
  }

  // Julga uma mensalidade PENDENTE como atrasada:
  //  - mês de referência anterior ao corrente: sempre atrasada;
  //  - mês corrente: atrasada se o vencimento (due_date) já passou — comparação
  //    por DIA em Brasília ("2026-11-20" vence antes de qualquer hora do dia 21).
  // Mensalidade paga nunca é atrasada.
  function estaAtrasada(fee) {
    if (fee.getString('reference_month') < mesAtual) return true
    if (fee.getString('reference_month') > mesAtual) return false
    var due = fee.getDateTime('due_date')
    if (!due) return false
    var dueDay = due.string().split(' ')[0]
    return dueDay < chaveDoDia(nowB)
  }

  // ---- Destinatários (mesma regra do painel) ----
  var skippedRecent = 0
  var alvo = []
  var alunos = $app.findRecordsByFilter('students', '', '', 0, 0)
  var pendentes = $app.findRecordsByFilter(
    'monthly_fees',
    'status = "pendente"',
    'student,-reference_month',
    0,
    0,
  )
  var pendentesByStudent = {}
  for (var p = 0; p < pendentes.length; p++) {
    var sid = pendentes[p].getString('student')
    if (!pendentesByStudent[sid]) pendentesByStudent[sid] = []
    pendentesByStudent[sid].push(pendentes[p])
  }

  // Meses JÁ PAGOS, por aluno ("id|2026-11"), em uma única consulta com
  // findRecordsByFilter ($app.countRecordsByFilter NÃO existe nesta JSVM do
  // PocketBase — crashava a rota com "Object has no member"). Serve para:
  //  (1) a regra do dia 15 — aluno com o mês corrente pago não é destinatário;
  //  (2) garantir que {mes} NUNCA cite um mês pago, mesmo que exista também um
  //      lançamento pendente duplicado para o mesmo mês (v0.0.42).
  var pagosPorAlunoMes = {}
  var pagas = $app.findRecordsByFilter('monthly_fees', 'status = "pago"', '', 0, 0)
  for (var pg = 0; pg < pagas.length; pg++) {
    pagosPorAlunoMes[
      pagas[pg].getString('student') + '|' + pagas[pg].getString('reference_month')
    ] = true
  }

  var limite =
    new Date(nowB.getTime() + 3 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19) + '.000Z'

  for (var i = 0; i < alunos.length; i++) {
    var student = alunos[i]
    var studentId = student.id
    var fees = pendentesByStudent[studentId] || []

    var mesCobranca = null
    var feeParaMes = null
    var atrasada = null

    // (a) pendência vencida: mês de referência MAIS RECENTE em atraso — mas
    // NUNCA um mês que o aluno já PAGOU (lançamento pendente duplicado).
    for (var j = 0; j < fees.length; j++) {
      if (!estaAtrasada(fees[j])) continue
      if (pagosPorAlunoMes[studentId + '|' + fees[j].getString('reference_month')]) continue
      atrasada = fees[j]
      break // ordenado por -reference_month: o primeiro já é o mais recente
    }

    if (atrasada) {
      mesCobranca = atrasada.getString('reference_month')
      feeParaMes = atrasada
    } else if (depoisDoDia15 && student.getBool('active')) {
      // (b) regra do dia 15: aluno ATIVO sem mensalidade PAGA do mês corrente —
      // vale mesmo sem nenhum lançamento para o mês. O conjunto pagosPorAlunoMes
      // (montado acima, uma consulta só) decide. {mes} = mês CORRENTE.
      if (!pagosPorAlunoMes[studentId + '|' + mesAtual]) {
        mesCobranca = mesAtual
        feeParaMes = null // sem row pendente: nada a marcar em last_notice_at
      }
    }

    if (!mesCobranca) continue

    // Trava anti-duplicidade (SÓ o cron): pula se o aluno já foi avisado nos
    // últimos 7 dias (last_notice_at de qualquer mensalidade dele). O manual
    // (force=true) nunca pula.
    if (!FORCE) {
      var ultimos = $app.findRecordsByFilter(
        'monthly_fees',
        'student = {:sid} && last_notice_at > {:limite}',
        '',
        1,
        0,
        { sid: studentId, limite: limite },
      )
      if (ultimos.length > 0) {
        skippedRecent++
        continue
      }
    }

    alvo.push({
      student: student,
      studentId: studentId,
      mesCobranca: mesCobranca,
      feeParaMes: feeParaMes,
    })
  }

  // ---- Envio (um e-mail por aluno, mesmo com vários meses em atraso) ----
  var mailClient = $app.newMailClient()
  var sent = 0
  var skippedNoEmail = 0
  var failed = 0
  var sentNames = []
  var failedNames = []
  var skippedNoEmailNames = []

  for (var i = 0; i < alvo.length; i++) {
    var aluno = alvo[i]
    var student = aluno.student
    var email = (student.getString('email') || '').trim()
    if (!email) {
      skippedNoEmail++
      skippedNoEmailNames.push(student.getString('name') || aluno.studentId)
      continue
    }

    var texto = aplicarPlaceholders(template, student.getString('name'), aluno.mesCobranca)
    var mensagem = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName || 'Judô Tatsu',
      },
      to: [{ address: email }],
      subject: subject.split('{mes}').join(nomeMes(aluno.mesCobranca)),
      html: emailHtml(texto),
    })

    var enviado = true
    try {
      mailClient.send(mensagem)
      sent++
      sentNames.push(student.getString('name') || aluno.studentId)
    } catch (err) {
      enviado = false
      failed++
      failedNames.push(student.getString('name') || aluno.studentId)
      console.log('[avisos_mensalidade_atrasada] falha ao enviar para ' + email + ': ' + err)
    }

    // Grava last_notice_at (usado pela trava de 7 dias do cron). Quando a
    // inadimplência vem da regra do dia 15 sem lançamento, grava em TODAS as
    // mensalidades pendentes do aluno — sem isso a trava do cron nunca
    // saberia que ele foi avisado.
    if (enviado) {
      var agora = new Date().toISOString().replace('T', ' ').substring(0, 19) + '.000Z'
      if (aluno.feeParaMes) {
        try {
          aluno.feeParaMes.set('last_notice_at', agora)
          $app.save(aluno.feeParaMes)
        } catch (errSave) {
          console.log(
            'Falha ao registrar last_notice_at da mensalidade ' +
              aluno.feeParaMes.id +
              ': ' +
              errSave,
          )
        }
      } else {
        var doAluno = $app.findRecordsByFilter('monthly_fees', 'student = {:sid}', '', 0, 0, {
          sid: aluno.studentId,
        })
        for (var k = 0; k < doAluno.length; k++) {
          try {
            doAluno[k].set('last_notice_at', agora)
            $app.save(doAluno[k])
          } catch (errSave2) {
            console.log(
              'Falha ao registrar last_notice_at da mensalidade ' + doAluno[k].id + ': ' + errSave2,
            )
          }
        }
      }
    }
  }

  console.log(
    '[avisos_mensalidade_atrasada] mes=' +
      mesAtual +
      ' depois_do_dia15=' +
      depoisDoDia15 +
      ' enviados=' +
      sent +
      ' sem_email=' +
      skippedNoEmail +
      ' recentes_pulados=' +
      skippedRecent +
      ' falhas=' +
      failed,
  )
})

// ----------------------------------------------------------------------------
// Rota MANUAL — botão "Notificar atrasados" do painel (force=true).
// MESMA regra de inadimplência e MESMO e-mail do cron; sem trava de 7 dias.
// ----------------------------------------------------------------------------

routerAdd(
  'POST',
  '/backend/v1/judo/fees/notify-overdue',
  (e) => {
    var auth = e.auth
    if (!auth || auth.getString('role') !== 'admin') {
      throw new ForbiddenError('Somente administradores podem enviar avisos de atraso.')
    }

    // Blindagem: um erro não tratado nesta callback virava um 500 opaco no painel
    // ("something went wrong"). Aqui qualquer falha volta como JSON com detalhe.
    try {
      return processNotify(e)
    } catch (errFatal) {
      console.log('[notify-overdue manual] ERRO FATAL: ' + errFatal)
      return e.json(500, {
        message: 'Erro ao enviar avisos de atraso: ' + errFatal,
      })
    }

    function processNotify(e) {
      var FORCE = true // manual: dispara sempre

      function brasiliaNow() {
        return new Date(Date.now() - 3 * 60 * 60 * 1000)
      }
      function chaveDoMes(b) {
        return b.getUTCFullYear() + '-' + ('0' + (b.getUTCMonth() + 1)).slice(-2)
      }
      function chaveDoDia(b) {
        return (
          b.getUTCFullYear() +
          '-' +
          ('0' + (b.getUTCMonth() + 1)).slice(-2) +
          '-' +
          ('0' + b.getUTCDate()).slice(-2)
        )
      }

      var nowB = brasiliaNow()
      var mesAtual = chaveDoMes(nowB)
      var depoisDoDia15 = nowB.getUTCDate() >= 15

      function saudacao() {
        var h = nowB.getUTCHours()
        if (h < 12) return 'Bom dia'
        if (h < 18) return 'Boa tarde'
        return 'Boa noite'
      }

      function nomeMes(mesChave) {
        var partes = mesChave.split('-')
        var nomes = [
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
        return nomes[parseInt(partes[1], 10) - 1] + ' de ' + partes[0]
      }

      function aplicarPlaceholders(texto, nomeAluno, mesCobranca) {
        return texto
          .split('{saudacao}')
          .join(saudacao())
          .split('{aluno}')
          .join(nomeAluno || 'aluno(a)')
          .split('{mes}')
          .join(nomeMes(mesCobranca))
      }

      function emailHtml(texto) {
        return (
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222;line-height:1.6;">' +
          texto +
          '</div>'
        )
      }

      var DEFAULT_TPL =
        '<p>{saudacao}, {aluno}!</p>' +
        '<p>Verificamos em nosso sistema que a sua mensalidade de <strong>{mes}</strong> ' +
        'está pendente de pagamento na academia Judô Tatsu.</p>' +
        '<p>Se o pagamento já foi realizado, desconsidere esta mensagem — o sistema ' +
        'pode levar algumas horas para processar o lançamento.</p>' +
        '<p>Caso contrário, pedimos que regularize o pagamento o quanto antes para ' +
        'manter o seu acesso às aulas em dia.</p>' +
        '<p>Qualquer dúvida, fale conosco.</p>' +
        '<p style="margin-top:24px;">Atenciosamente,<br /><strong>Judô Tatsu</strong></p>'
      var DEFAULT_SUBJECT = 'Judô Tatsu — Mensalidade pendente ({mes})'

      var template = DEFAULT_TPL
      var subject = DEFAULT_SUBJECT
      try {
        var settings = $app.findRecordsByFilter(
          'app_settings',
          'key = "fee_overdue_template"',
          '',
          1,
          0,
        )
        if (settings.length > 0 && settings[0].getString('value')) {
          template = settings[0].getString('value')
        }
        var subjects = $app.findRecordsByFilter(
          'app_settings',
          'key = "fee_overdue_subject"',
          '',
          1,
          0,
        )
        if (subjects.length > 0 && subjects[0].getString('value')) {
          subject = subjects[0].getString('value')
        }
      } catch (err) {
        console.log(
          '[notify-overdue manual] app_settings indisponível, usando template padrão: ' + err,
        )
      }

      function estaAtrasada(fee) {
        if (fee.getString('reference_month') < mesAtual) return true
        if (fee.getString('reference_month') > mesAtual) return false
        var due = fee.getDateTime('due_date')
        if (!due) return false
        var dueDay = due.string().split(' ')[0]
        return dueDay < chaveDoDia(nowB)
      }

      var alvo = []
      var alunos = $app.findRecordsByFilter('students', '', '', 0, 0)
      var pendentes = $app.findRecordsByFilter(
        'monthly_fees',
        'status = "pendente"',
        'student,-reference_month',
        0,
        0,
      )
      var pendentesByStudent = {}
      for (var p = 0; p < pendentes.length; p++) {
        var sid = pendentes[p].getString('student')
        if (!pendentesByStudent[sid]) pendentesByStudent[sid] = []
        pendentesByStudent[sid].push(pendentes[p])
      }

      // Meses JÁ PAGOS, por aluno ("id|2026-11"), em uma única consulta com
      // findRecordsByFilter ($app.countRecordsByFilter NÃO existe nesta JSVM do
      // PocketBase — crashava a rota com "Object has no member"). Serve para:
      //  (1) a regra do dia 15 — aluno com o mês corrente pago não é destinatário;
      //  (2) garantir que {mes} NUNCA cite um mês pago, mesmo que exista também um
      //      lançamento pendente duplicado para o mesmo mês (v0.0.42).
      var pagosPorAlunoMes = {}
      var pagas = $app.findRecordsByFilter('monthly_fees', 'status = "pago"', '', 0, 0)
      for (var pg = 0; pg < pagas.length; pg++) {
        pagosPorAlunoMes[
          pagas[pg].getString('student') + '|' + pagas[pg].getString('reference_month')
        ] = true
      }

      for (var i = 0; i < alunos.length; i++) {
        var student = alunos[i]
        var studentId = student.id
        var fees = pendentesByStudent[studentId] || []

        var mesCobranca = null
        var feeParaMes = null
        var atrasada = null

        // (a) pendência vencida: mês MAIS RECENTE em atraso — mas NUNCA um mês
        // que o aluno já PAGOU (lançamento pendente duplicado).
        for (var j = 0; j < fees.length; j++) {
          if (!estaAtrasada(fees[j])) continue
          if (pagosPorAlunoMes[studentId + '|' + fees[j].getString('reference_month')]) continue
          atrasada = fees[j]
          break // ordenado por -reference_month: o primeiro já é o mais recente
        }

        if (atrasada) {
          mesCobranca = atrasada.getString('reference_month')
          feeParaMes = atrasada
        } else if (depoisDoDia15 && student.getBool('active')) {
          // (b) regra do dia 15: aluno ATIVO sem o mês corrente pago — vale mesmo
          // sem lançamento para o mês. {mes} = mês CORRENTE.
          if (!pagosPorAlunoMes[studentId + '|' + mesAtual]) {
            mesCobranca = mesAtual
            feeParaMes = null // sem row pendente: nada a marcar em last_notice_at
          }
        }

        if (!mesCobranca) continue

        alvo.push({
          student: student,
          studentId: studentId,
          mesCobranca: mesCobranca,
          feeParaMes: feeParaMes,
        })
      }

      // ---- Envio (um e-mail por aluno) ----
      var mailClient = $app.newMailClient()
      var sent = 0
      var skippedNoEmail = 0
      var failed = 0
      var sentNames = []
      var failedNames = []
      var skippedNoEmailNames = []

      for (var i = 0; i < alvo.length; i++) {
        var aluno = alvo[i]
        var student = aluno.student
        var email = (student.getString('email') || '').trim()
        if (!email) {
          skippedNoEmail++
          skippedNoEmailNames.push(student.getString('name') || aluno.studentId)
          continue
        }

        var texto = aplicarPlaceholders(template, student.getString('name'), aluno.mesCobranca)
        var mensagem = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName || 'Judô Tatsu',
          },
          to: [{ address: email }],
          subject: subject.split('{mes}').join(nomeMes(aluno.mesCobranca)),
          html: emailHtml(texto),
        })

        var enviado = true
        try {
          mailClient.send(mensagem)
          sent++
          sentNames.push(student.getString('name') || aluno.studentId)
        } catch (err) {
          enviado = false
          failed++
          failedNames.push(student.getString('name') || aluno.studentId)
          console.log('[notify-overdue manual] falha ao enviar para ' + email + ': ' + err)
        }

        if (enviado) {
          var agoraIso = new Date().toISOString().replace('T', ' ').substring(0, 19) + '.000Z'
          if (aluno.feeParaMes) {
            try {
              aluno.feeParaMes.set('last_notice_at', agoraIso)
              $app.save(aluno.feeParaMes)
            } catch (errSave) {
              console.log(
                'Falha ao registrar last_notice_at da mensalidade ' +
                  aluno.feeParaMes.id +
                  ': ' +
                  errSave,
              )
            }
          } else {
            var doAluno = $app.findRecordsByFilter('monthly_fees', 'student = {:sid}', '', 0, 0, {
              sid: aluno.studentId,
            })
            for (var k = 0; k < doAluno.length; k++) {
              try {
                doAluno[k].set('last_notice_at', agoraIso)
                $app.save(doAluno[k])
              } catch (errSave2) {
                console.log(
                  'Falha ao registrar last_notice_at da mensalidade ' +
                    doAluno[k].id +
                    ': ' +
                    errSave2,
                )
              }
            }
          }
        }
      }

      console.log(
        '[notify-overdue manual] mes=' +
          mesAtual +
          ' depois_do_dia15=' +
          depoisDoDia15 +
          ' enviados=' +
          sent +
          ' sem_email=' +
          skippedNoEmail +
          ' falhas=' +
          failed,
      )
      if (sent + skippedNoEmail + failed === 0) {
        console.log(
          '[notify-overdue manual] nenhum destinatário: mes_brasilia=' +
            mesAtual +
            ' dia_brasilia=' +
            chaveDoDia(nowB) +
            ' depois_do_dia15=' +
            depoisDoDia15,
        )
      }
      return e.json(200, {
        sent: sent,
        skippedNoEmail: skippedNoEmail,
        failed: failed,
        sentNames: sentNames,
        skippedNoEmailNames: skippedNoEmailNames,
        failedNames: failedNames,
      })
    }

    return processNotify(e)
  },
  $apis.requireAuth(),
)
