migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // Leitura: dono do registro ou admin (painel de alunos precisa listar todos os usuários)
    users.listRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    users.viewRule = "id = @request.auth.id || @request.auth.role = 'admin'"

    // Atualização: dono do próprio registro ou admin — NINGUÉM altera role via API
    users.updateRule =
      "(id = @request.auth.id || @request.auth.role = 'admin') && @request.body.role:changed = false"

    // Exclusão: apenas o próprio registro (nem admin exclui usuários via app)
    users.deleteRule = 'id = @request.auth.id'

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id && @request.body.role:changed = false'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
