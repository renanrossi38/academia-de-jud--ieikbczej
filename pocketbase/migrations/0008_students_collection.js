// Cria a collection `students` (controle interno de alunos — e-mail e conta são opcionais),
// copia os usuários com role 'aluno' para ela, migra `attendance` de users para students
// e cria dois alunos de demonstração (um sem e-mail, um com conta).
// Idempotente: pode rodar mais de uma vez sem duplicar dados.
migrate(
  (app) => {
    const USERS_ID = '_pb_users_auth_'
    const adminRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // 1) Collection students
    if (!app.hasTable('students')) {
      const students = new Collection({
        name: 'students',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'name', type: 'text', required: true, max: 200 },
          { name: 'phone', type: 'text', max: 40 },
          {
            name: 'belt',
            type: 'select',
            values: [
              'branca',
              'cinza',
              'amarela',
              'laranja',
              'verde',
              'azul',
              'roxa',
              'marrom',
              'preta',
            ],
            maxSelect: 1,
          },
          { name: 'email', type: 'text', max: 200 },
          { name: 'active', type: 'bool' },
          {
            name: 'user',
            type: 'relation',
            collectionId: USERS_ID,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_students_user ON students (user) WHERE user != ""'],
      })
      app.save(students)
    }

    // 2) attendance: adiciona o campo student (mantém user até a migração dos dados)
    const attendance = app.findCollectionByNameOrId('attendance')
    if (!attendance.fields.getByName('student')) {
      const studentsCol = app.findCollectionByNameOrId('students')
      attendance.fields.add(
        new RelationField({
          name: 'student',
          collectionId: studentsCol.id,
          cascadeDelete: true,
          minSelect: 0,
          maxSelect: 1,
        }),
      )
      attendance.indexes = [
        ...attendance.indexes,
        "CREATE UNIQUE INDEX idx_attendance_student_date ON attendance (student, date) WHERE student != ''",
      ]
      app.save(attendance)
    }

    // 3) Copia alunos (role 'aluno') de users para students, vinculando o user
    const studentUsers = app.findRecordsByFilter('users', "role = 'aluno'", '', 10000, 0)
    const studentsCol = app.findCollectionByNameOrId('students')
    const studentByUser = {}
    for (const u of studentUsers) {
      let existing = null
      try {
        existing = app.findFirstRecordByFilter('students', 'user = {:uid}', { uid: u.id })
      } catch (_) {}
      if (!existing) {
        const rec = new Record(studentsCol)
        rec.set('name', u.getString('name') || u.getString('email'))
        rec.set('phone', u.getString('phone') || '')
        rec.set('belt', u.getString('belt') || '')
        rec.set('email', u.getString('email'))
        rec.set('active', u.get('active') !== false)
        rec.set('user', u.id)
        app.save(rec)
        existing = rec
      }
      studentByUser[u.id] = existing.id
    }

    // 4) Backfill de attendance.student a partir de attendance.user
    const records = app.findRecordsByFilter('attendance', "user != ''", '', 100000, 0)
    for (const rec of records) {
      if (rec.getString('student')) continue
      const studentId = studentByUser[rec.getString('user')]
      if (!studentId) continue
      rec.set('student', studentId)
      app.save(rec)
    }

    // 5) Remove o índice e o campo user de attendance (agora é student)
    const att2 = app.findCollectionByNameOrId('attendance')
    if (att2.fields.getByName('user')) {
      att2.indexes = att2.indexes.filter((i) => !i.includes('idx_attendance_user_date'))
      att2.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || student.user = @request.auth.id)"
      att2.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || student.user = @request.auth.id)"
      app.save(att2)

      const att3 = app.findCollectionByNameOrId('attendance')
      att3.fields.removeByName('user')
      app.save(att3)
    }

    // 6) Alunos de demonstração (idempotentes pelo nome)
    const seedStudent = (name, fields) => {
      try {
        app.findFirstRecordByFilter('students', 'name = {:n}', { n: name })
        return
      } catch (_) {}
      const rec = new Record(studentsCol)
      rec.set('name', name)
      rec.set('active', true)
      Object.keys(fields).forEach((k) => rec.set(k, fields[k]))
      app.save(rec)
    }
    // Aluno SEM e-mail (sem conta). O aluno COM conta é o próprio aluno@dojo.com,
    // copiado do users no passo 3 já vinculado pelo campo user.
    seedStudent('Aluno Sem E-mail', { phone: '(11) 90000-0001', belt: 'branca' })
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('students'))
    } catch (_) {}
  },
)
