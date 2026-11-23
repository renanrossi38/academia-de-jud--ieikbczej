migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1) Nova opção no select role: admin_secundario (admin com poder total do
    //    painel, exceto gerenciar administradores).
    const role = users.fields.getByName('role')
    if (role && !role.values.includes('admin_secundario')) {
      role.values.push('admin_secundario')
    }

    // 2) Campo is_owner: marca o administrador PRINCIPAL (o dono da academia).
    //    A migration marca o admin existente mais antigo como principal — ele
    //    nunca perde o poder e é o único que concede/revoga cargos.
    if (!users.fields.getByName('is_owner')) {
      users.fields.add(
        new BoolField({
          name: 'is_owner',
        }),
      )
    }

    app.save(users)

    // Marca o dono: o admin mais antigo ainda sem nenhum dono definido.
    // (findRecordsByFilter — countRecordsByFilter não existe nesta JSVM.)
    const owners = app.findRecordsByFilter('users', "role = 'admin' && is_owner = true", '', 1, 0)
    if (owners.length === 0) {
      const admins = app.findRecordsByFilter('users', "role = 'admin'", 'created', 1, 0)
      if (admins.length > 0) {
        admins[0].set('is_owner', true)
        app.save(admins[0])
      }
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const role = users.fields.getByName('role')
    if (role) {
      role.values = role.values.filter((v) => v !== 'admin_secundario')
    }
    const isOwner = users.fields.getByName('is_owner')
    if (isOwner) {
      users.fields.removeByName('is_owner')
    }
    app.save(users)
  },
)
