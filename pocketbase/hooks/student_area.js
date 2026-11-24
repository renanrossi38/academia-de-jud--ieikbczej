// Área do aluno (Judô Tatsu) — resumo pessoal do aluno logado.
//
// ROTA (autenticada):
//   GET /backend/v1/student-area
//   → { student, paidFees[], orders[], attendance[], rankingPosition, rankingTotal,
//       rankingPoints, beltHistory[], currentBelt, timeInBelt }
//
// O FRONT NÃO consegue ler sozinho: monthly_fees, belt_promotions e
// points_entries são admin-only; attendance e orders do aluno não dão os dias
// COM CHAMADA da turma nem a posição no ranking. Tudo é agregado AQUI.
//
// SEGURANÇA: exige auth; o aluno é resolvido via students.user = auth.id —
// cada aluno só enxerga os próprios dados. Admin também passa (usa a página do
// painel; aqui ele recebe seus próprios dados de aluno, se tiver cadastro).
//
// FUSO: sempre Brasília (UTC-3 o ano todo) — relógio deslocado 3h e lido em
// UTC, alinhado aos demais hooks (fee_overdue_notice.js) e serviços front.
//
// RESTRIÇÕES DA JSVM: callbacks não enxergam declarações de nível superior
// (tudo inline) e $app.countRecordsByFilter NÃO existe nesta VM — usar
// findRecordsByFilter e montar os conjuntos em objetos.

routerAdd(
  'GET',
  '/backend/v1/student-area',
  (e) => {
    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para ver sua área do aluno.')
    }

    try {
      var out = buildArea(e, auth)
      return e.json(200, out)
    } catch (err) {
      console.log('[student-area] ERRO: ' + err)
      return e.json(500, { message: 'Erro ao carregar a área do aluno: ' + err })
    }

    function buildArea(e2, auth2) {
      function brasiliaNow() {
        return new Date(Date.now() - 3 * 60 * 60 * 1000)
      }
      // "YYYY-MM" em Brasília.
      function chaveDoMes(b) {
        return b.getUTCFullYear() + '-' + ('0' + (b.getUTCMonth() + 1)).slice(-2)
      }

      var nowB = brasiliaNow()
      var anoCorrente = nowB.getUTCFullYear()

      // ---- Aluno vinculado ao usuário logado (students.user) ----
      var students = $app.findRecordsByFilter('students', 'user = {:uid}', '', 1, 0, {
        uid: auth.id,
      })
      if (students.length === 0) {
        // Usuário sem cadastro de aluno (ex.: admin): devolve estrutura vazia —
        // o front mostra estados vazios em vez de quebrar.
        return {
          student: null,
          paidFees: [],
          orders: [],
          attendance: [],
          rankingPosition: null,
          rankingTotal: 0,
          rankingPoints: 0,
          beltHistory: [],
          currentBelt: null,
          timeInBelt: '',
        }
      }
      var student = students[0]
      var studentId = student.id

      // ---- Mensalidades PAGAS (mensalidades do aluno inteiras: é dele) ----
      var paidFees = []
      var fees = $app.findRecordsByFilter(
        'monthly_fees',
        'student = {:sid} && status = "pago"',
        '-reference_month',
        0,
        0,
        { sid: studentId },
      )
      for (var i = 0; i < fees.length; i++) {
        var f = fees[i]
        paidFees.push({
          id: f.id,
          reference_month: f.getString('reference_month'),
          amount: f.getFloat('amount'),
          paid_at: f.getDateTime('paid_at') ? String(f.getDateTime('paid_at')) : '',
          payment_method: f.getString('payment_method'),
        })
      }

      // ---- Rastreio do pedido (estilo Correios) -------------------------------
      // Une mudanças de status (order_status_log, gravadas pelo hook) e etapas
      // personalizadas (order_tracking, criadas pelo admin). Mais recente em cima.
      function trackingDoPedido(orderId) {
        var events = []

        var logRows = $app.findRecordsByFilter(
          'order_status_log',
          'order = {:oid}',
          '-created',
          0,
          0,
          { oid: orderId },
        )
        for (var i = 0; i < logRows.length; i++) {
          var lg = logRows[i]
          var porUsuario = ''
          try {
            var uLog = $app.findRecordById('users', lg.getString('user'))
            porUsuario = uLog.getString('name')
          } catch (errU) {
            porUsuario = 'Sistema'
          }
          events.push({
            kind: 'status',
            at: String(lg.getDateTime('created')),
            by: porUsuario,
            from_status: lg.getString('from_status'),
            to_status: lg.getString('to_status'),
          })
        }

        var stepRows = $app.findRecordsByFilter(
          'order_tracking',
          'order = {:oid}',
          '-created',
          0,
          0,
          { oid: orderId },
        )
        for (var s = 0; s < stepRows.length; s++) {
          var st = stepRows[s]
          var porAdmin = ''
          try {
            var uStep = $app.findRecordById('users', st.getString('user'))
            porAdmin = uStep.getString('name')
          } catch (errS) {
            porAdmin = 'Academia'
          }
          events.push({
            kind: 'etapa',
            at: String(st.getDateTime('created')),
            by: porAdmin,
            label: st.getString('label'),
          })
        }

        events.sort(function (a, b) {
          var ta = new Date(a.at).getTime()
          var tb = new Date(b.at).getTime()
          if (tb !== ta) return tb - ta
          return a.kind === 'etapa' ? -1 : 1
        })

        return events
      }

      // ---- Pedidos NÃO cancelados do usuário, com itens (e respostas sob medida) ----
      var orders = []
      var myOrders = $app.findRecordsByFilter(
        'orders',
        'user = {:uid} && status != "cancelado"',
        '-created',
        0,
        0,
        { uid: auth.id },
      )
      for (var o = 0; o < myOrders.length; o++) {
        var ord = myOrders[o]
        var items = $app.findRecordsByFilter('order_items', 'order = {:oid}', 'created', 0, 0, {
          oid: ord.id,
        })
        var itemsOut = []
        for (var j = 0; j < items.length; j++) {
          var it = items[j]
          var answers = null
          var rawAnswers = it.getString('custom_answers')
          if (rawAnswers && rawAnswers !== '') {
            try {
              answers = JSON.parse(rawAnswers)
            } catch (errAns) {
              answers = null
            }
          }
          itemsOut.push({
            product_name: it.getString('product_name'),
            variation_label: it.getString('variation_label'),
            quantity: it.getInt('quantity'),
            unit_price: it.getFloat('unit_price'),
            subtotal: it.getFloat('subtotal'),
            custom_answers: answers,
          })
        }
        orders.push({
          id: ord.id,
          status: ord.getString('status'),
          total: ord.getFloat('total'),
          delivery_type: ord.getString('delivery_type'),
          created: String(ord.getDateTime('created')),
          items: itemsOut,
          tracking: trackingDoPedido(ord.id),
        })
      }

      // ---- Presenças: as do aluno, agrupadas por mês, com % sobre os DIAS COM
      //      CHAMADA da(s) turma(s) dele. Dias com chamada = datas (união por
      //      mês) em que QUALQUER aluno da turma tem registro — o aluno pode
      //      não ter registro no dia (falta sem lançamento). Justificado conta
      //      no denominador, não no numerador (mesma regra do painel). ----
      var attendance = []
      var recs = $app.findRecordsByFilter('attendance', 'student = {:sid}', '-date', 0, 0, {
        sid: studentId,
      })

      // Turmas do aluno → todos os alunos dessas turmas.
      var minhasTurmas = {}
      var meusLinks = $app.findRecordsByFilter('class_students', 'student = {:sid}', '', 0, 0, {
        sid: studentId,
      })
      var idsColegas = {}
      for (var c = 0; c < meusLinks.length; c++) {
        var cid = meusLinks[c].getString('class')
        if (cid === '') continue
        minhasTurmas[cid] = true
        var linksTurma = $app.findRecordsByFilter('class_students', 'class = {:cid}', '', 0, 0, {
          cid: cid,
        })
        for (var ct = 0; ct < linksTurma.length; ct++) {
          idsColegas[linksTurma[ct].getString('student')] = true
        }
      }

      // Chamada de todos os alunos das turmas do aluno (datas → dias com chamada).
      var diasChamada = {} // mesChave -> { "YYYY-MM-DD": true }
      var listaColegas = Object.keys(idsColegas)
      for (var cg = 0; cg < listaColegas.length; cg++) {
        var recsTurma = $app.findRecordsByFilter('attendance', 'student = {:sid}', '-date', 0, 0, {
          sid: listaColegas[cg],
        })
        for (var rt = 0; rt < recsTurma.length; rt++) {
          var dTurma = String(recsTurma[rt].getDateTime('date')).slice(0, 10)
          var mesT = dTurma.slice(0, 7)
          if (!diasChamada[mesT]) diasChamada[mesT] = {}
          diasChamada[mesT][dTurma] = true
        }
      }

      // Marcações do próprio aluno, agrupadas por mês.
      var porMes = {}
      for (var a = 0; a < recs.length; a++) {
        var r = recs[a]
        var dateStr = String(r.getDateTime('date'))
        var diaChave = dateStr.slice(0, 10)
        var mesChave = diaChave.slice(0, 7)
        var status = r.getString('status')
        attendance.push({
          id: r.id,
          date: dateStr,
          status: status,
          notes: r.getString('notes'),
        })
        // Dias sem chamada da turma (ex.: registro órfão) não entram no resumo.
        if (!diasChamada[mesChave] || !diasChamada[mesChave][diaChave]) continue
        if (!porMes[mesChave]) {
          porMes[mesChave] = { month: mesChave, presencas: 0, ausentes: 0, justificados: 0 }
        }
        if (porMes[mesChave][status] !== undefined) porMes[mesChave][status]++
      }

      // % do mês = presentes ÷ dias com chamada da turma (justificado fora do numerador).
      var attendanceMonth = []
      var meses = Object.keys(diasChamada)
      meses.sort(function (x, y) {
        return y.localeCompare(x)
      })
      for (var m = 0; m < meses.length; m++) {
        var mes = meses[m]
        var totalDias = Object.keys(diasChamada[mes]).length
        var g = porMes[mes] || { presencas: 0, ausentes: 0, justificados: 0 }
        var pct = totalDias > 0 ? Math.round((g.presencas / totalDias) * 100) : 0
        attendanceMonth.push({
          month: mes,
          totalDias: totalDias,
          presencas: g.presencas,
          ausentes: g.ausentes,
          justificados: g.justificados,
          percentual: pct,
        })
      }

      // ---- Ranking do ano corrente (mesma regra do painel: presença "presente"
      //      = 1 ponto + lançamentos manuais; empate = ordem alfabética) ----
      var yearStart = anoCorrente + '-01-01 00:00:00.000Z'
      var yearEnd = anoCorrente + '-12-31 23:59:59.999Z'
      var links = $app.findRecordsByFilter('class_students', '', '', 0, 0)
      var rows = {} // studentId -> pontos
      var nomes = {} // studentId -> nome (para ordenar empates)
      for (var l = 0; l < links.length; l++) {
        var st = links[l].getString('student')
        if (st === '') continue
        if (!rows[st]) {
          // Só alunos ativos pontuam (mesma regra do painel).
          var rec = null
          try {
            rec = $app.findRecordById('students', st)
          } catch (errSt) {
            rec = null
          }
          if (!rec || rec.getBool('active') === false) continue
          rows[st] = 0
          nomes[st] = rec.getString('name')
        }
      }
      var presencas = $app.findRecordsByFilter(
        'attendance',
        'status = "presente" && date >= {:ini} && date <= {:fim}',
        '',
        0,
        0,
        { ini: yearStart, fim: yearEnd },
      )
      for (var p = 0; p < presencas.length; p++) {
        var sidP = presencas[p].getString('student')
        if (rows[sidP] !== undefined) rows[sidP]++
      }
      var entries = $app.findRecordsByFilter(
        'points_entries',
        'date >= {:ini} && date <= {:fim} && year = {:ano}',
        '',
        0,
        0,
        { ini: yearStart, fim: yearEnd, ano: anoCorrente },
      )
      for (var q = 0; q < entries.length; q++) {
        var sidQ = entries[q].getString('student')
        if (rows[sidQ] !== undefined) rows[sidQ] += entries[q].getInt('points')
      }
      var sids = Object.keys(rows)
      sids.sort(function (x, y) {
        if (rows[y] !== rows[x]) return rows[y] - rows[x]
        return String(nomes[x] || '').localeCompare(String(nomes[y] || ''), 'pt-BR')
      })
      var rankingPosition = null
      var rankingTotal = sids.length
      var rankingPoints = 0
      for (var k = 0; k < sids.length; k++) {
        if (sids[k] === studentId) {
          rankingPosition = k + 1
          rankingPoints = rows[studentId]
          break
        }
      }

      // ---- Faixas: histórico da mais recente para a mais antiga ----
      var beltHistory = []
      var promos = $app.findRecordsByFilter(
        'belt_promotions',
        'student = {:sid}',
        '-promoted_at,-created',
        0,
        0,
        { sid: studentId },
      )
      for (var b = 0; b < promos.length; b++) {
        var pr = promos[b]
        beltHistory.push({
          id: pr.id,
          belt: pr.getString('belt'),
          promoted_at: String(pr.getDateTime('promoted_at')),
          notes: pr.getString('notes'),
        })
      }

      return {
        student: {
          id: student.id,
          name: student.getString('name'),
          belt: student.getString('belt'),
          active: student.getBool('active'),
        },
        paidFees: paidFees,
        orders: orders,
        attendance: attendance,
        attendanceMonth: attendanceMonth,
        rankingPosition: rankingPosition,
        rankingTotal: rankingTotal,
        rankingPoints: rankingPoints,
        beltHistory: beltHistory,
        currentBelt: beltHistory.length > 0 ? beltHistory[0].belt : student.getString('belt'),
        timeInBelt: '',
      }
    }
  },
  $apis.requireAuth(),
)
