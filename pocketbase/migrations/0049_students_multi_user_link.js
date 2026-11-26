// Vários alunos com a MESMA conta de responsável (Judô Tatsu).
//
// Hoje o índice único idx_students_user (migration 0008) impede que duas fichas
// de students apontem para o mesmo users.id — mas é exatamente o que o dono
// precisa quando um responsável tem mais de um filho matriculado: UMA conta
// (o e-mail do responsável) acompanhando TODOS os filhos na área do aluno.
//
// Esta migration derruba o índice único e cria um índice comum (não-unique,
// sem cláusula WHERE) em students.user, para as buscas user = ... dos hooks.
// Atenção ao padrão da API: em col.addIndex(nome, unique, colunas, where)
// o 4º argumento JÁ É a cláusula WHERE — passar "WHERE ..." nele gera
// "WHERE WHERE ..." e o PocketBase JSVM recusa ("near WHERE: syntax error").
// Índice simples aqui: sem WHERE nenhum.
//
// O rollback recria o índice único (só aplicável enquanto não houver
// duplicados — exigência do UNIQUE).
//
// Importante: deploy reconcilia o PocketBase a partir do schema.json COMITADO —
// o espelho também foi atualizado neste mesmo commit (sem o UNIQUE).

migrate(
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    students.indexes = students.indexes.filter((idx) => !String(idx).includes('idx_students_user'))
    students.addIndex('idx_students_user_lookup', false, 'user', '')
    app.save(students)
  },
  (app) => {
    const students = app.findCollectionByNameOrId('students')
    students.indexes = students.indexes.filter((idx) => !String(idx).includes('idx_students_user'))
    // Volta a ser único (só aplicável enquanto não houver duas fichas na mesma conta).
    students.addIndex('idx_students_user', true, 'user', '')
    app.save(students)
  },
)
