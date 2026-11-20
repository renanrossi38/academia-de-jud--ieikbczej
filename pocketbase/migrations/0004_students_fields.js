migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1. Novos campos de gestão de alunos (idempotente)
    if (!users.fields.getByName('phone')) {
      users.fields.add(new TextField({ name: 'phone' }))
    }
    if (!users.fields.getByName('belt')) {
      users.fields.add(
        new SelectField({
          name: 'belt',
          maxSelect: 1,
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
        }),
      )
    }
    if (!users.fields.getByName('active')) {
      users.fields.add(new BoolField({ name: 'active' }))
    }

    // 2. Regras de API:
    //    - leitura/lista: dono do registro ou admin (necessário para o painel de alunos)
    //    - update: dono sem mudar role, OU admin (sem poder alterar role de ninguém)
    //    - delete: somente o próprio registro (nenhum admin exclui alunos)
    users.listRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    users.viewRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    users.updateRule =
      "(id = @request.auth.id && @request.body.role:changed = false) || (@request.auth.role = 'admin' && @request.body.role:changed = false)"
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)

    // 3. Valores de demonstração para os usuários de exemplo (idempotente)
    try {
      const aluno = app.findAuthRecordByEmail('users', 'aluno@dojo.com')
      aluno.set('phone', '(11) 98765-4321')
      aluno.set('belt', 'azul')
      aluno.set('active', true)
      app.save(aluno)
    } catch (_) {
      console.log('Seed: usuário aluno@dojo.com não encontrado, nada a preencher.')
    }

    try {
      const admin = app.findAuthRecordByEmail('users', 'renanrossi38@gmail.com')
      admin.set('phone', '(11) 91234-5678')
      admin.set('belt', 'preta')
      admin.set('active', true)
      app.save(admin)
    } catch (_) {
      console.log('Seed: usuário renanrossi38@gmail.com não encontrado, nada a preencher.')
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    ;['phone', 'belt', 'active'].forEach((fieldName) => {
      const field = users.fields.getByName(fieldName)
      if (field) users.fields.removeByName(fieldName)
    })
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id && @request.body.role:changed = false'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
