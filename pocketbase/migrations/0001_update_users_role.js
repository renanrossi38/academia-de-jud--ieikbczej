migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['admin', 'aluno'],
          maxSelect: 1,
        }),
      )
    }

    // Update rule: allow users to update their own profile, but protect role from self-escalation
    users.updateRule = 'id = @request.auth.id && @request.body.role:changed = false'
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const field = users.fields.getByName('role')
    if (field) {
      users.fields.removeByName('role')
      users.updateRule = 'id = @request.auth.id'
      app.save(users)
    }
  },
)
