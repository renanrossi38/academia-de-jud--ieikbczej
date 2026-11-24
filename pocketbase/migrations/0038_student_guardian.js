// Responsáveis pelos alunos menores de idade (Judô Tatsu).
//
// Três campos de contato opcionais na ficha do aluno: guardian_name,
// guardian_phone e guardian_email. O responsável NÃO tem conta própria no
// app (decisão da dona) — é apenas um registro de contato na ficha, usado
// pela academia para falar com a família de um aluno menor de idade.
//
// Todos os campos são texto opcional: o preenchimento fica livre também para
// alunos adultos (a academia julga caso a caso), sem validação de idade no
// banco — o rótulo de "menor" é apenas orientação na interface.
//
// IDEMPOTENTE: guarda por getByName, roda vazio num banco recém-criado.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('students')
    if (!col.fields.getByName('guardian_name')) {
      col.fields.add(new TextField({ name: 'guardian_name', max: 120 }))
    }
    if (!col.fields.getByName('guardian_phone')) {
      col.fields.add(new TextField({ name: 'guardian_phone', max: 40 }))
    }
    if (!col.fields.getByName('guardian_email')) {
      col.fields.add(new TextField({ name: 'guardian_email', max: 200 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('students')
    for (const f of ['guardian_name', 'guardian_phone', 'guardian_email']) {
      if (col.fields.getByName(f)) col.fields.removeByName(f)
    }
    app.save(col)
  },
)
