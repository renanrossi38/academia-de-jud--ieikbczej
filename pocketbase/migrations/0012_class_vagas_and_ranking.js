// 1) Campo `vagas` (número inteiro, obrigatório) na collection `classes` —
//    limite de alunos que a turma consegue atender.
// 2) Nova collection `points_entries` — lançamentos manuais de pontuação de
//    competições/eventos do ranking (admin apenas).
// 3) Seed: preenche vagas nas turmas existentes e cria 2-3 lançamentos de
//    exemplo para o ranking não sair vazio.
// Idempotente: pode rodar mais de uma vez sem duplicar nada.
migrate(
  (app) => {
    const adminRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // 1) Campo vagas em classes (0 = sem limite definido ainda; o seed preenche)
    const classes = app.findCollectionByNameOrId('classes')
    if (!classes.fields.getByName('vagas')) {
      classes.fields.add(new NumberField({ name: 'vagas', required: false, min: 0, onlyInt: true }))
    }
    app.save(classes)

    // 2) Collection points_entries
    if (!app.hasTable('points_entries')) {
      const studentsCol = app.findCollectionByNameOrId('students')
      const entries = new Collection({
        name: 'points_entries',
        type: 'base',
        listRule: adminRule,
        viewRule: adminRule,
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
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
          { name: 'points', type: 'number', required: false, min: 0 },
          { name: 'description', type: 'text', required: true, max: 200 },
          { name: 'date', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_points_entries_student ON points_entries (student)'],
      })
      app.save(entries)
    }

    // 3a) Turmas existentes sem vagas definidas ganham um limite padrão
    const oldClasses = app.findRecordsByFilter(
      'classes',
      'vagas = 0 || vagas = ""',
      '-created',
      200,
      0,
    )
    oldClasses.forEach((c) => {
      c.set('vagas', 20)
      app.save(c)
    })

    // 3b) Seed de lançamentos manuais de exemplo (idempotente por descrição)
    const seeds = [
      { points: 30, description: 'Campeonato Paulista — 3º lugar' },
      { points: 20, description: 'Campeonato Paulista — 2º lugar' },
      { points: 10, description: 'Evento beneficente do dojo' },
    ]
    let activeStudents
    try {
      activeStudents = app.findRecordsByFilter('students', 'active = true', '-created', 3, 0)
    } catch (_) {
      activeStudents = []
    }
    if (activeStudents.length > 0) {
      const entriesCol = app.findCollectionByNameOrId('points_entries')
      seeds.forEach((seed, i) => {
        const student = activeStudents[i % activeStudents.length]
        const existing = app.findRecordsByFilter(
          'points_entries',
          `student = '${student.id}' && description = '${seed.description.replace(/'/g, "''")}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) return
        const record = new Record(entriesCol)
        record.set('student', student.id)
        record.set('points', seed.points)
        record.set('description', seed.description)
        record.set('date', new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z')
        app.save(record)
      })
      console.log(`Seed de pontuações manuais concluído (${seeds.length} lançamento(s)).`)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('points_entries'))
    } catch (_) {}
    try {
      const classes = app.findCollectionByNameOrId('classes')
      if (classes.fields.getByName('vagas')) {
        classes.fields.removeByName('vagas')
        app.save(classes)
      }
    } catch (_) {}
  },
)
