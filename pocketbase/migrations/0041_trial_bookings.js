// Aula experimental (Judô Tatsu) — migration 0041.
//
// 1. Turmas ganham os campos que o agendamento de aula experimental precisa:
//    - weekdays: dias da semana em que a turma funciona (select múltiplo,
//      valores "seg".."dom"). O visitante só pode agendar nesses dias.
//    - min_age / max_age: faixa de idade aceita na turma (number, opcional).
//      O datepicker e o servidor usam para recusar nascimentos fora da faixa.
//
// 2. Nova collection trial_bookings: agendamento de aula experimental feito
//    por visitante SEM login.
//      - list/view: só admin com permissão da área 'experimentais' (o dono
//        sempre passa; secundário com lista vazia também — padrão da 0031).
//      - create: público (regra null), validado pelo hook trial_bookings.js.
//      - update/delete: admin com permissão da área (mudar status, excluir).
//    O campo admin_permissions de users também ganha o valor 'experimentais'
//    (mesmo padrão da 0040 com 'destaques') para o dono liberar a área a
//    administradores secundários.

migrate(
  (app) => {
    // ---- 1. classes: weekdays + faixa de idade ------------------------------
    const classes = app.findCollectionByNameOrId('classes')
    if (!classes.fields.getByName('weekdays')) {
      classes.fields.add(
        new SelectField({
          name: 'weekdays',
          maxSelect: 7,
          values: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
        }),
      )
    }
    if (!classes.fields.getByName('min_age')) {
      classes.fields.add(new NumberField({ name: 'min_age', onlyInt: true, min: 0, max: 120 }))
    }
    if (!classes.fields.getByName('max_age')) {
      classes.fields.add(new NumberField({ name: 'max_age', onlyInt: true, min: 0, max: 120 }))
    }
    app.save(classes)

    // ---- 2. users: área 'experimentais' nas permissões de admin secundário ---
    const users = app.findCollectionByNameOrId('users')
    const permField = users.fields.getByName('admin_permissions')
    if (permField && permField.values.indexOf('experimentais') === -1) {
      permField.values.push('experimentais')
      permField.maxSelect = permField.values.length
      app.save(users)
    }

    // ---- 3. trial_bookings --------------------------------------------------
    const AREA = (area) =>
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      "(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || @request.auth.admin_permissions ?= '" +
      area +
      "')"

    let bookingsCol = null
    try {
      bookingsCol = app.findCollectionByNameOrId('trial_bookings')
    } catch (err) {
      bookingsCol = null // ainda não existe — criar abaixo
    }
    if (!bookingsCol) {
      const collection = new Collection({
        name: 'trial_bookings',
        // Criação pública (visitante sem login); leitura/edição/exclusão só admin.
        listRule: AREA('experimentais'),
        viewRule: AREA('experimentais'),
        createRule: null,
        updateRule: AREA('experimentais'),
        deleteRule: AREA('experimentais'),
        fields: [
          new TextField({ name: 'student_name', required: true, min: 3, max: 120 }),
          new DateField({ name: 'birth_date', required: true }),
          new RelationField({
            name: 'class',
            required: true,
            collectionId: classes.id,
            maxSelect: 1,
          }),
          new DateField({ name: 'date', required: true }),
          new TextField({ name: 'contact', required: true, min: 5, max: 160 }),
          new TextField({ name: 'notes', required: false, max: 500 }),
          new SelectField({
            name: 'status',
            required: true,
            maxSelect: 1,
            values: ['novo', 'confirmado', 'realizado', 'cancelado'],
          }),
        ],
      })
      app.save(collection)
    }
  },
  (app) => {
    // Rollback: remove a collection e devolve o estado anterior dos campos.
    try {
      app.delete(app.findCollectionByNameOrId('trial_bookings'))
    } catch (e) {}
    try {
      const users = app.findCollectionByNameOrId('users')
      const permField = users.fields.getByName('admin_permissions')
      if (permField) {
        permField.values = permField.values.filter((v) => v !== 'experimentais')
        permField.maxSelect = permField.values.length
        app.save(users)
      }
    } catch (e) {}
    try {
      const classes = app.findCollectionByNameOrId('classes')
      ;['weekdays', 'min_age', 'max_age'].forEach((f) => {
        const field = classes.fields.getByName(f)
        if (field) classes.fields.removeByName(f)
      })
      app.save(classes)
    } catch (e) {}
  },
)
