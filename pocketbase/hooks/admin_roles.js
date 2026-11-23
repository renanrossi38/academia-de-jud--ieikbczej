// Gestão de administradores (Judô Tatsu) — hierarquia de admins.
//
// O DONO da academia é o administrador PRINCIPAL (users.is_owner = true).
// Somente ele pode conceder ou revogar o cargo de administrador. Os demais
// admins fazem tudo no painel EXCETO gerenciar administradores — as regras
// desta rota barram no backend, e a página só existe no menu do dono.
//
// IMPORTANTE: secundário fica com role = 'admin' E is_owner = false. As regras
// de API das coleções liberam o painel por role = 'admin'; o que separa o
// principal do secundário é SOMENTE o campo is_owner (e esta rota, que exige
// is_owner para qualquer gestão de cargos).
//
// ROTAS (todas exigem login + is_owner):
//   GET  /backend/v1/admins            → { admins: [{id, name, email, role, is_owner}], total }
//   POST /backend/v1/admins            → { user_id } — concede role 'admin' (sem is_owner)
//   POST /backend/v1/admins/revoke     → { user_id } — volta o usuário para 'aluno'
//
// REGRA DE OURO: o dono NUNCA é alterado — nem pelo próprio, nem por outro.
// Qualquer tentativa de mexer no is_owner ou no role do dono devolve 403.
// 'verified' nunca é enviado em updates (PB v0.23+: só superusuário).
//
// RESTRIÇÃO DA JSVM: callbacks não enxergam declarações de nível superior —
// toda a lógica fica inline em cada callback.

routerAdd(
  'GET',
  '/backend/v1/admins',
  (e) => {
    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para acessar o painel.')
    }
    if (!auth.getBool('is_owner')) {
      throw new ForbiddenError('Somente o administrador principal pode gerenciar administradores.')
    }

    try {
      var admins = []
      var recs = $app.findRecordsByFilter(
        'users',
        "role = 'admin' || is_owner = true",
        'created',
        0,
        0,
      )
      for (var i = 0; i < recs.length; i++) {
        var u = recs[i]
        admins.push({
          id: u.id,
          name: u.getString('name'),
          email: u.getString('email'),
          role: u.getString('role'),
          is_owner: u.getBool('is_owner'),
          created: String(u.getDateTime('created')),
        })
      }
      return e.json(200, { admins: admins, total: admins.length })
    } catch (err) {
      console.log('[admin-roles] ERRO ao listar: ' + err)
      return e.json(500, { message: 'Erro ao listar administradores: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admins',
  (e) => {
    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para acessar o painel.')
    }
    if (!auth.getBool('is_owner')) {
      throw new ForbiddenError('Somente o administrador principal pode conceder cargos.')
    }

    try {
      var body = e.requestInfo().body
      var userId = String(body.user_id || '')
      if (userId === '') {
        return e.json(400, { message: 'Escolha um usuário para conceder o cargo.' })
      }

      var target = null
      try {
        target = $app.findRecordById('users', userId)
      } catch (errFind) {
        target = null
      }
      if (!target) {
        return e.json(404, { message: 'Usuário não encontrado.' })
      }

      // O dono NUNCA é alterado (nem rebaixado, nem re-promovido).
      if (target.getBool('is_owner')) {
        return e.json(403, { message: 'O administrador principal não pode ter o cargo alterado.' })
      }
      // Já é admin (principal ou secundário)? Nada a fazer.
      if (target.getString('role') === 'admin') {
        return e.json(403, { message: 'Este usuário já é administrador.' })
      }

      // Envia APENAS o campo role — nunca 'verified' nem outros campos reservados.
      // O cargo é 'admin' (mesmo valor do dono): TODAS as regras de API das
      // coleções já liberam o painel para role = 'admin'. Quem separa o
      // principal do secundário é o campo is_owner, não o role.
      target.set('role', 'admin')
      $app.save(target)

      return e.json(200, {
        admin: {
          id: target.id,
          name: target.getString('name'),
          email: target.getString('email'),
          role: target.getString('role'),
          is_owner: target.getBool('is_owner'),
        },
      })
    } catch (err) {
      console.log('[admin-roles] ERRO ao conceder: ' + err)
      return e.json(500, { message: 'Erro ao conceder o cargo: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admins/revoke',
  (e) => {
    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para acessar o painel.')
    }
    if (!auth.getBool('is_owner')) {
      throw new ForbiddenError('Somente o administrador principal pode revogar cargos.')
    }

    try {
      var body = e.requestInfo().body
      var userId = String(body.user_id || '')
      if (userId === '') {
        return e.json(400, { message: 'Escolha um administrador para revogar o cargo.' })
      }

      var target = null
      try {
        target = $app.findRecordById('users', userId)
      } catch (errFind) {
        target = null
      }
      if (!target) {
        return e.json(404, { message: 'Usuário não encontrado.' })
      }

      // O dono NUNCA é rebaixado — por ninguém, em nenhuma circunstância.
      if (target.getBool('is_owner')) {
        return e.json(403, { message: 'O administrador principal não pode ser rebaixado.' })
      }
      // Secundário = role 'admin' SEM is_owner (o principal é distinguído só
      // pelo is_owner — ver comentário da rota de conceder).
      if (target.getString('role') !== 'admin') {
        return e.json(400, { message: 'Este usuário não é administrador.' })
      }

      // Envia APENAS o campo role — nunca 'verified' nem outros campos reservados.
      target.set('role', 'aluno')
      $app.save(target)

      return e.json(200, {
        admin: {
          id: target.id,
          name: target.getString('name'),
          email: target.getString('email'),
          role: target.getString('role'),
          is_owner: target.getBool('is_owner'),
        },
      })
    } catch (err) {
      console.log('[admin-roles] ERRO ao revogar: ' + err)
      return e.json(500, { message: 'Erro ao revogar o cargo: ' + err })
    }
  },
  $apis.requireAuth(),
)
