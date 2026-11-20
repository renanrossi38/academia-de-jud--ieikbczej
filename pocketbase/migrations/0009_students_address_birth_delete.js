migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')

    // Endereço do aluno (opcional)
    if (!students.fields.getByName('address')) {
      students.fields.add(new TextField({ name: 'address', max: 500 }))
    }

    // Data de nascimento do aluno (opcional)
    if (!students.fields.getByName('birth_date')) {
      students.fields.add(new DateField({ name: 'birth_date' }))
    }

    app.save(students)

    // Presença: ao excluir o aluno, as marcações dele também saem
    // (evita registros órfãos que quebram o painel e o histórico).
    const attendance = app.findCollectionByNameOrId('attendance')
    const rel = attendance.fields.getByName('student')
    if (rel) {
      rel.cascadeDelete = true
      app.save(attendance)
    }
  },
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    const address = students.fields.getByName('address')
    if (address) students.fields.removeByName('address')
    const birth = students.fields.getByName('birth_date')
    if (birth) students.fields.removeByName('birth_date')
    app.save(students)

    const attendance = app.findCollectionByNameOrId('attendance')
    const rel = attendance.fields.getByName('student')
    if (rel) {
      rel.cascadeDelete = false
      app.save(attendance)
    }
  },
)
