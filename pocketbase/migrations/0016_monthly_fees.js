// Nova collection `monthly_fees` — registro real de mensalidades por aluno
// (módulo financeiro do painel; o aluno não vê mensalidade por enquanto).
// Campos: student (relation → students, obrigatório), reference_month
// ("YYYY-MM", obrigatório, único por aluno), amount (número >= 0, obrigatório),
// status (select pago/pendente, default pendente), paid_at (date opcional),
// notes (text opcional). Idempotente: só cria se a collection não existir.
migrate(
  (app) => {
    let fees
    try {
      fees = app.findCollectionByNameOrId('monthly_fees')
    } catch (_) {
      fees = null
    }
    if (fees) return

    const studentsCol = app.findCollectionByNameOrId('students')
    fees = new Collection({
      name: 'monthly_fees',
      type: 'base',
      listRule: '@request.auth.id != "" && @request.auth.role = "admin"',
      viewRule: '@request.auth.id != "" && @request.auth.role = "admin"',
      createRule: '@request.auth.id != "" && @request.auth.role = "admin"',
      updateRule: '@request.auth.id != "" && @request.auth.role = "admin"',
      deleteRule: '@request.auth.id != "" && @request.auth.role = "admin"',
      fields: [
        {
          name: 'student',
          type: 'relation',
          required: true,
          collectionId: studentsCol.id,
          cascadeDelete: true,
          minSelect: 1,
          maxSelect: 1,
        },
        { name: 'reference_month', type: 'text', required: true, min: 7, max: 7 },
        { name: 'amount', type: 'number', required: false, min: 0 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pago', 'pendente'],
        },
        { name: 'paid_at', type: 'date' },
        { name: 'notes', type: 'text', max: 300 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_monthly_fees_student_month ON monthly_fees (student, reference_month)',
      ],
    })
    app.save(fees)
  },
  (app) => {
    try {
      const fees = app.findCollectionByNameOrId('monthly_fees')
      app.delete(fees)
    } catch (_) {}
  },
)
