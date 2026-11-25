// Gestão de administradores (Judô Tatsu) — hierarquia de admins + permissões.
//
// O DONO da academia é o administrador PRINCIPAL (users.is_owner = true).
// Somente ele pode conceder ou revogar o cargo de administrador, e definir
// QUAIS ÁREAS do painel cada secundário acessa. Os demais admins fazem tudo
// no painel EXCETO gerenciar administradores — as regras desta rota barram no
// backend, e a página só existe no menu do dono.
//
// IMPORTANTE: secundário fica com role = 'admin' E is_owner = false. O acesso
// por área vem do campo admin_permissions (select múltiplo em users): regra
// vazia = acesso total (compatibilidade), regra marcada = só as áreas marcadas.
// O dono ignora o campo — sempre vê tudo.
//
// ROTAS (todas exigem login + is_owner):
//   GET  /backend/v1/admins             → { admins: [...], total }
//   POST /backend/v1/admins             → { user_id, areas? } — concede role 'admin'
//   POST /backend/v1/admins/revoke      → { user_id } — volta o usuário para 'aluno'
//   POST /backend/v1/admins/permissions → { user_id, areas: [...] } — grava admin_permissions
//
// REGRA DE OURO: o dono NUNCA é alterado — nem pelo próprio, nem por outro.
// Qualquer tentativa de mexer no is_owner ou no role do dono devolve 403.
// 'verified' nunca é enviado em updates (PB v0.23+: só superusuário).
//
// RESTRIÇÃO DA JSVM: callbacks não enxergam declarações de nível superior —
// ADMIN_AREAS, sanitizarAreas e adminPayload são repetidos INLINE em cada
// rota (JSVM não compartilha declarações de nível superior com callbacks).

routerAdd(
  'GET',
  '/backend/v1/admins',
  (e) => {
    var ADMIN_AREAS = [
      'alunos',
      'mensalidades',
      'presencas',
      'produtos',
      'pedidos',
      'financeiro',
      'site',
      'destaques',
      'experimentais',
    ]

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
        var perms = u.get('admin_permissions')
        admins.push({
          id: u.id,
          name: u.getString('name'),
          email: u.getString('email'),
          role: u.getString('role'),
          is_owner: u.getBool('is_owner'),
          admin_permissions: perms ? perms : [],
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
    var ADMIN_AREAS = [
      'alunos',
      'mensalidades',
      'presencas',
      'produtos',
      'pedidos',
      'financeiro',
      'site',
      'destaques',
      'experimentais',
    ]

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

      // Filtra a lista de áreas enviada pelo front (ignora desconhecidas,
      // duplicadas; lista vazia/ausente = acesso total).
      var bruto = body.areas
      var areas = []
      if (bruto && bruto.length !== undefined) {
        for (var a = 0; a < bruto.length; a++) {
          var area = String(bruto[a])
          var valida = false
          for (var v = 0; v < ADMIN_AREAS.length; v++) {
            if (ADMIN_AREAS[v] === area) {
              valida = true
              break
            }
          }
          if (valida && areas.indexOf(area) === -1) {
            areas.push(area)
          }
        }
      }

      // Envia APENAS o campo role (e permissões) — nunca 'verified'.
      // O cargo é 'admin' (mesmo valor do dono): as regras de API liberam por
      // role = 'admin'; o que restringe o secundário é admin_permissions.
      target.set('role', 'admin')
      if (areas.length > 0) {
        target.set('admin_permissions', areas)
      }
      $app.save(target)

      var perms = target.get('admin_permissions')
      return e.json(200, {
        admin: {
          id: target.id,
          name: target.getString('name'),
          email: target.getString('email'),
          role: target.getString('role'),
          is_owner: target.getBool('is_owner'),
          admin_permissions: perms ? perms : [],
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

      // Envia APENAS o campo role — nunca 'verified' nem outros reservados.
      // Limpa também as permissões: um futuro novo cargo começa sem restrição.
      target.set('role', 'aluno')
      target.set('admin_permissions', [])
      $app.save(target)

      return e.json(200, {
        admin: {
          id: target.id,
          name: target.getString('name'),
          email: target.getString('email'),
          role: target.getString('role'),
          is_owner: target.getBool('is_owner'),
          admin_permissions: [],
        },
      })
    } catch (err) {
      console.log('[admin-roles] ERRO ao revogar: ' + err)
      return e.json(500, { message: 'Erro ao revogar o cargo: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admins/permissions',
  (e) => {
    var ADMIN_AREAS = [
      'alunos',
      'mensalidades',
      'presencas',
      'produtos',
      'pedidos',
      'financeiro',
      'site',
      'destaques',
      'experimentais',
    ]

    var auth = e.auth
    if (!auth || auth.id === '') {
      throw new UnauthorizedError('Faça login para acessar o painel.')
    }
    if (!auth.getBool('is_owner')) {
      throw new ForbiddenError('Somente o administrador principal pode alterar permissões.')
    }

    try {
      var body = e.requestInfo().body
      var userId = String(body.user_id || '')
      if (userId === '') {
        return e.json(400, { message: 'Escolha um administrador para definir as permissões.' })
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

      // O dono não tem permissões restritas — ele é o principal.
      if (target.getBool('is_owner')) {
        return e.json(403, { message: 'O administrador principal já acessa todas as áreas.' })
      }
      if (target.getString('role') !== 'admin') {
        return e.json(400, {
          message: 'Este usuário não é administrador — conceda o cargo primeiro.',
        })
      }

      // Filtra a lista de áreas (ignora desconhecidas/duplicadas; lista vazia
      // = acesso total, compatibilidade com o comportamento atual).
      var bruto = body.areas
      var areas = []
      if (bruto && bruto.length !== undefined) {
        for (var a = 0; a < bruto.length; a++) {
          var area = String(bruto[a])
          var valida = false
          for (var v = 0; v < ADMIN_AREAS.length; v++) {
            if (ADMIN_AREAS[v] === area) {
              valida = true
              break
            }
          }
          if (valida && areas.indexOf(area) === -1) {
            areas.push(area)
          }
        }
      }

      target.set('admin_permissions', areas)
      $app.save(target)

      return e.json(200, {
        admin: {
          id: target.id,
          name: target.getString('name'),
          email: target.getString('email'),
          role: target.getString('role'),
          is_owner: target.getBool('is_owner'),
          admin_permissions: areas,
        },
      })
    } catch (err) {
      console.log('[admin-roles] ERRO ao salvar permissões: ' + err)
      return e.json(500, { message: 'Erro ao salvar permissões: ' + err })
    }
  },
  $apis.requireAuth(),
)
