// Cria a collection `attendance` — controle de presença dos treinos.
// Uma marcação por aluno por dia (índice único user+date), leitura do próprio
// registro pelo aluno, leitura total e escrita apenas para admin.
migrate(
  (app) => {
    if (app.hasTable('attendance')) return // idempotente

    const collection = new Collection({
      name: 'attendance',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          minSelect: 1,
          maxSelect: 1,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['presente', 'ausente', 'justificado'],
          maxSelect: 1,
        },
        {
          name: 'notes',
          type: 'text',
          max: 300,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_attendance_user_date ON attendance (user, date)',
        'CREATE INDEX idx_attendance_date ON attendance (date)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('attendance')
      app.delete(collection)
    } catch (_) {}
  },
)
