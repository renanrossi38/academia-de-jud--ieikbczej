// Prepara a home com duas abas:
//  - "Turmas": campos de horário/mensalidade em `classes` + leitura pública das
//    turmas ativas (visitante não logado precisa ver a aba de turmas) + seed.
//  - "Kimonos e Acessórios": nova categoria "camisetas" em products + seed.
// Idempotente: pode rodar mais de uma vez sem duplicar nada.
migrate(
  (app) => {
    // 1) Campos schedule (texto) e monthly_fee (número) em classes
    const classes = app.findCollectionByNameOrId('classes')
    if (!classes.fields.getByName('schedule')) {
      classes.fields.add(new TextField({ name: 'schedule', max: 120 }))
    }
    if (!classes.fields.getByName('monthly_fee')) {
      classes.fields.add(new NumberField({ name: 'monthly_fee', min: 0 }))
    }
    app.save(classes)

    // 2) Leitura pública das turmas ATIVAS (a home é vista sem login)
    classes.listRule =
      "active = true && (@request.auth.id = '' || @request.auth.id != '') || (@request.auth.id != '' && (@request.auth.role = 'admin' || class_students_via_class.student.user = @request.auth.id))"
    classes.viewRule =
      "active = true && (@request.auth.id = '' || @request.auth.id != '') || (@request.auth.id != '' && (@request.auth.role = 'admin' || class_students_via_class.student.user = @request.auth.id))"
    app.save(classes)

    // 3) Nova categoria "camisetas" no select de products
    const products = app.findCollectionByNameOrId('products')
    const categoryField = products.fields.getByName('category')
    if (categoryField && categoryField.values.indexOf('camisetas') === -1) {
      categoryField.values = [...categoryField.values, 'camisetas']
      app.save(products)
    }

    // 4) Seed de turmas com horário e mensalidade
    const ensureClass = (name, data) => {
      let existing
      try {
        existing = app.findFirstRecordByData('classes', 'name', name)
      } catch (_) {
        existing = null
      }
      if (existing) {
        // Preenche horário/mensalidade que faltam em turmas antigas
        if (!existing.getString('schedule')) {
          existing.set('schedule', data.schedule)
          existing.set('monthly_fee', data.fee)
          app.save(existing)
        }
        return
      }
      const record = new Record(classes)
      record.set('name', name)
      record.set('level', data.level)
      record.set('active', true)
      record.set('schedule', data.schedule)
      record.set('monthly_fee', data.fee)
      app.save(record)
    }

    ensureClass('Infantil', {
      level: 'iniciante',
      schedule: 'Ter/Qui — 19h às 20h30',
      fee: 120,
    })
    ensureClass('Adulto Iniciante', {
      level: 'iniciante',
      schedule: 'Seg/Qua/Sex — 19h às 20h30',
      fee: 180,
    })
    ensureClass('Adulto Avançado', {
      level: 'avancado',
      schedule: 'Seg/Qua/Sex — 20h30 às 22h',
      fee: 220,
    })
    ensureClass('Competição', {
      level: 'avancado',
      schedule: 'Sáb — 09h às 11h',
      fee: 250,
    })

    // 5) Seed de camiseta do dojo
    try {
      app.findFirstRecordByData('products', 'slug', 'camiseta-dojo')
    } catch (_) {
      const record = new Record(products)
      record.set('name', 'Camiseta do Dojo')
      record.set('slug', 'camiseta-dojo')
      record.set(
        'description',
        'Camiseta oficial do Dojo Nippon em algodão penteado 30.1, estampa serigrafada com o kanji 柔 no peito. Confortável para o dia a dia e para aquecer antes do treino.',
      )
      record.set('price', 79.9)
      record.set('category', 'camisetas')
      record.set('active', true)
      app.save(record)
    }
  },
  (app) => {
    // down: volta as regras de leitura de turmas para admin/matriculados e
    // remove "camisetas" do select (os campos schedule/monthly_fee e os seeds
    // permanecem — são inofensivos e os dados são dos usuários).
    try {
      const classes = app.findCollectionByNameOrId('classes')
      const rule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || class_students_via_class.student.user = @request.auth.id)"
      classes.listRule = rule
      classes.viewRule = rule
      app.save(classes)
    } catch (_) {}
    try {
      const products = app.findCollectionByNameOrId('products')
      const categoryField = products.fields.getByName('category')
      if (categoryField) {
        categoryField.values = categoryField.values.filter((v) => v !== 'camisetas')
        app.save(products)
      }
    } catch (_) {}
  },
)
