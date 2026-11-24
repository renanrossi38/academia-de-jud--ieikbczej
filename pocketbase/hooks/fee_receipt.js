// Comprovante de pagamento de mensalidade (Judô Tatsu).
//
// ROTA (autenticada):
//   GET /backend/v1/fee-receipt/{id}
//   → { receipt: { ... } }
//
// monthly_fees é admin-only pelas API rules — o ALUNO não consegue ler a
// própria mensalidade direto da collection. Este hook devolve SOMENTE os dados
// do comprovante, para:
//   - o dono do registro (students.user = auth.id), ou
//   - qualquer admin (role = 'admin').
// Qualquer outro usuário recebe 404 (não 403: não revelar que o id existe).
//
// Só existe comprovante de mensalidade PAGA (status "pago" com paid_at) — sem
// pagamento registrado, a rota responde 404 com mensagem clara.
//
// RESTRIÇÕES DA JSVM: callbacks não enxergam declarações de nível superior
// (tudo inline no callback) e $app.countRecordsByFilter NÃO existe nesta VM.

routerAdd(
  'GET',
  '/backend/v1/fee-receipt/{id}',
  (e) => {
    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para ver o comprovante.')
    }

    try {
      var fee = null
      try {
        fee = $app.findRecordById('monthly_fees', e.request.pathValue('id'))
      } catch (errFee) {
        return e.json(404, { message: 'Comprovante não encontrado.' })
      }
      if (!fee) {
        return e.json(404, { message: 'Comprovante não encontrado.' })
      }

      // ---- Autorização: dono do registro (via students.user) ou admin ----
      var isAllowed = false
      var roleName = ''
      try {
        roleName = auth.getString('role') || ''
      } catch (errRole) {
        roleName = ''
      }
      var isAdmin = roleName === 'admin'
      if (isAdmin) {
        isAllowed = true
      } else {
        // Dono: procura o aluno vinculado a este usuário e confere o registro.
        var owners = $app.findRecordsByFilter('students', 'user = {:uid}', '', 1, 0, {
          uid: auth.id,
        })
        if (owners.length > 0 && owners[0].id === fee.getString('student')) {
          isAllowed = true
        }
      }
      if (!isAllowed) {
        // 404 em vez de 403: não revela existência/propriedade do registro.
        return e.json(404, { message: 'Comprovante não encontrado.' })
      }

      // ---- Só mensalidade PAGA tem comprovante ----
      var paidAt = fee.getDateTime('paid_at')
      var paidAtStr = paidAt ? String(paidAt) : ''
      if (fee.getString('status') !== 'pago' || paidAtStr === '') {
        return e.json(404, {
          message: 'Esta mensalidade ainda não tem pagamento registrado — não há comprovante.',
        })
      }

      // ---- Dados do aluno ----
      var studentName = ''
      var studentId = fee.getString('student')
      try {
        var st = $app.findRecordById('students', studentId)
        studentName = st.getString('name')
      } catch (errSt) {
        studentName = ''
      }

      var receipt = {
        id: fee.id,
        student_id: studentId,
        student_name: studentName,
        reference_month: fee.getString('reference_month'),
        amount: fee.getFloat('amount'),
        paid_at: paidAtStr,
        payment_method: fee.getString('payment_method'),
        due_date: fee.getDateTime('due_date') ? String(fee.getDateTime('due_date')) : '',
        notes: fee.getString('notes'),
        updated: String(fee.getDateTime('updated')),
      }

      return e.json(200, { receipt: receipt })
    } catch (err) {
      console.log('[fee-receipt] ERRO: ' + err)
      return e.json(500, { message: 'Erro ao gerar o comprovante: ' + err })
    }
  },
  $apis.requireAuth(),
)
