// Vários alunos com a MESMA conta de responsável (Judô Tatsu).
//
// Hoje o índice único idx_students_user impede que duas fichas de students
// apontem para o mesmo users.id — mas é exatamente o que o dono precisa quando
// um responsável tem mais de um filho matriculado: UMA conta (o e-mail do
// responsável) acompanhando TODOS os filhos na área do aluno.
//
// Esta migration derruba o índice único de students.user (mantendo o índice
// comum para as buscas por user = ... dos hooks). O rollback o recria — e ele
// só volta a aplicar quando não há duplicados (exigência do UNIQUE).
//
// Importante: deploy reconcilia o PocketBase a partir do schema.json COMITADO —
// o espelho também foi atualizado neste mesmo commit (sem o UNIQUE).

migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    students.indexes = students.indexes.filter((idx) => !String(idx).includes('idx_students_user'))
    students.addIndex('idx_students_user_lookup', false, 'user', 'WHERE user != ""')
    app.save(students)
  },
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    students.indexes = students.indexes.filter((idx) => !String(idx).includes('idx_students_user'))
    // Volta a ser único (só aplicável enquanto não houver duas fichas na mesma conta).
    students.addIndex('idx_students_user', true, 'user', 'WHERE user != ""')
    app.save(students)
  },
)
