// Cria as collections de turmas: `classes` (a turma) e `class_students`
// (junção turma ↔ aluno, para remover o aluno da turma sem perder presença).
// Idempotente: pode rodar mais de uma vez sem duplicar nada.
migrate(
  (app) => {
    const adminRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // 1) Collection classes (regras de leitura ampliadas no fim, quando a
    //    back-relation de class_students já existir)
    if (!app.hasTable('classes')) {
      const classes = new Collection({
        name: 'classes',
        type: 'base',
        listRule: adminRule,
        viewRule: adminRule,
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'name', type: 'text', required: true, max: 200 },
          {
            name: 'level',
            type: 'select',
            values: ['iniciante', 'intermediario', 'avancado'],
            maxSelect: 1,
          },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_classes_active ON classes (active)'],
      })
      app.save(classes)
    }

    // 2) Collection de junção class_students (class + student, uma matrícula por par)
    if (!app.hasTable('class_students')) {
      const classesCol = app.findCollectionByNameOrId('classes')
      const studentsCol = app.findCollectionByNameOrId('students')
      const classStudents = new Collection({
        name: 'class_students',
        type: 'base',
        listRule: adminRule,
        viewRule: adminRule,
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          {
            name: 'class',
            type: 'relation',
            required: true,
            collectionId: classesCol.id,
            cascadeDelete: true,
            minSelect: 1,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: studentsCol.id,
            cascadeDelete: true,
            minSelect: 1,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_class_students_pair ON class_students (class, student)',
          'CREATE INDEX idx_class_students_student ON class_students (student)',
        ],
      })
      app.save(classStudents)
    }

    // 3) Agora que a back-relation existe, o aluno enxerga as turmas em que
    //    está matriculado (e a própria matrícula) — usado em "Minha Presença".
    const classesCol2 = app.findCollectionByNameOrId('classes')
    classesCol2.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || class_students_via_class.student.user = @request.auth.id)"
    classesCol2.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || class_students_via_class.student.user = @request.auth.id)"
    app.save(classesCol2)

    const joinCol = app.findCollectionByNameOrId('class_students')
    joinCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || student.user = @request.auth.id)"
    joinCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || student.user = @request.auth.id)"
    app.save(joinCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('class_students'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('classes'))
    } catch (_) {}
  },
)
