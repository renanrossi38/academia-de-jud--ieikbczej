// Foto do aluno + destaques por competição na home (Judô Tatsu).
//
// 1) students.photo: foto opcional do aluno (png/jpeg/webp, até 5MB). É a foto
//    usada nos destaques da home (fica fica e competição) e nas listas.
//    Não é protegida: a home (visitante) precisa exibi-la.
//
// 2) student_highlights: destaque manual por competição. Campos: aluno,
//    motivo (texto livre, opcional), mês de referência "AAAA-MM" (opcional —
//    vazio = vale até ser removido) e active.
//    LEITURA pública (a home assina realtime e lê a lista); ESCRITA só admin
//    (qualquer admin logado — role = 'admin').
//
// IDEMPOTENTE: cada passo confere se já existe antes de criar.
migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    if (!students.fields.getByName('photo')) {
      students.fields.add(
        new FileField({
          name: 'photo',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
          thumbs: [],
          protected: false,
          required: false,
        }),
      )
      app.save(students)
    }

    let exists = null
    try {
      exists = app.findCollectionByNameOrId('student_highlights')
    } catch (_) {
      exists = null
    }

    if (!exists) {
      exists = new Collection({
        name: 'student_highlights',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'student',
            type: 'relation',
            collectionId: students.id,
            required: true,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'reason', type: 'text', required: false, max: 200 },
          { name: 'month', type: 'text', required: false, max: 7 },
          { name: 'active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_student_highlights_active ON student_highlights (active)'],
      })
      app.save(exists)
    }
  },
  (app) => {
    let col = null
    try {
      col = app.findCollectionByNameOrId('student_highlights')
    } catch (_) {
      col = null
    }
    if (col) app.delete(col)

    const students = app.findCollectionByNameOrId('students')
    if (students.fields.getByName('photo')) {
      students.fields.removeByName('photo')
      app.save(students)
    }
  },
)
