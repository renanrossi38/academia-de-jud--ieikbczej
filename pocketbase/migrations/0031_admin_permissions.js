// Permissões por área para administradores SECUNDÁRIOS (Judô Tatsu).
//
// A migration 0030 criou a hierarquia: dono = is_owner true, secundário =
// role 'admin' com is_owner false. Porém o secundário tinha acesso COMPLETO
// ao painel. Este ajuste adiciona o campo admin_permissions em users (select
// múltiplo) e passa a exigir, nas regras de API, a permissão correspondente
// à área — SEMPRE que o chamador for um admin SECUNDÁRIO.
//
// Backward compatible: um secundário SEM nenhuma permissão marcada (campo
// vazio) continua acessando TODAS as áreas — o dono pode restringi-lo depois
// em /painel/admins. O dono (is_owner = true) passa em qualquer área.
//
// ÁREAS (mesmos valores usados no front, src/lib/adminAreas.ts):
//   alunos, mensalidades, presencas, produtos, pedidos, financeiro, site
//
// GRAMÁTICA DAS REGRAS (PocketBase — NÃO é JavaScript):
//   - comparação com "=" (nunca "=="), operadores !=, ~, &&, ||.
//   - "?=" é o operador "qualquer um dos valores" — correto para select múltiplo.
//   - ":length = 0" cobre o backward compatible: campo vazio libera tudo.
//   - Todo grupo combinado com || fica entre parênteses — sem isso o parser
//     devolve "expected a sign operator, got || (join)" (causa da falha anterior).
//
// Exemplo de área completa:
//   @request.auth.id != '' && @request.auth.role = 'admin' &&
//   (@request.auth.is_owner || @request.auth.admin_permissions:length = 0 ||
//    @request.auth.admin_permissions ?= 'alunos')
//
// Leitura pública (produtos, site_settings, classes ativas) e a visão do
// ALUNO comum (os próprios registros) são preservadas exatamente como hoje.

migrate(
  (app) => {
    // 1. Campo admin_permissions em users (ANTES de qualquer regra usá-lo).
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('admin_permissions')) {
      users.fields.add(
        new SelectField({
          name: 'admin_permissions',
          maxSelect: 7,
          values: [
            'alunos',
            'mensalidades',
            'presencas',
            'produtos',
            'pedidos',
            'financeiro',
            'site',
          ],
        }),
      )
    }
    // O próprio usuário (ou um admin secundário) NÃO pode alterar as próprias
    // permissões pela API comum — só o dono, via hook /backend/v1/admins*.
    users.updateRule =
      "(id = @request.auth.id || @request.auth.role = 'admin') && @request.body.role:changed = false && @request.body.is_owner:changed = false && @request.body.active:changed = false && @request.body.admin_permissions:changed = false"
    app.save(users)

    // Núcleo: role admin E (dono, ou sem permissões marcadas, ou com a área marcada).
    // Booleano na regra exige comparação explícita: "is_owner" solto quebra o
    // parser ("expected a sign operator, got || (join)").
    const AREA_CORE = (area) =>
      "(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || @request.auth.admin_permissions ?= '" +
      area +
      "')"

    // Regra completa de área (admin liberado na área).
    const AREA = (area) =>
      "@request.auth.id != '' && @request.auth.role = 'admin' && " + AREA_CORE(area)

    // Regra de leitura em que o ALUNO mantém a própria visibilidade
    // (mesma forma da regra atual: auth != '' && (admin || condição do aluno)).
    const LIST_WITH_STUDENT = (area, ownerCondition) =>
      "@request.auth.id != '' && (" + AREA_CORE(area) + ' || ' + ownerCondition + ')'

    // 2. ALUNOS: students + belt_promotions (ficha e graduação).
    const students = app.findCollectionByNameOrId('students')
    const studentsOwner = 'user = @request.auth.id'
    students.listRule = LIST_WITH_STUDENT('alunos', studentsOwner)
    students.viewRule = LIST_WITH_STUDENT('alunos', studentsOwner)
    students.createRule = AREA('alunos')
    students.updateRule = AREA('alunos')
    students.deleteRule = AREA('alunos')
    app.save(students)

    const belts = app.findCollectionByNameOrId('belt_promotions')
    belts.listRule = AREA('alunos')
    belts.viewRule = AREA('alunos')
    belts.createRule = AREA('alunos')
    belts.updateRule = AREA('alunos')
    belts.deleteRule = AREA('alunos')
    app.save(belts)

    // 3. MENSALIDADES: monthly_fees (só admin — o aluno vê pela Área do aluno, via hook).
    const fees = app.findCollectionByNameOrId('monthly_fees')
    fees.listRule = AREA('mensalidades')
    fees.viewRule = AREA('mensalidades')
    fees.createRule = AREA('mensalidades')
    fees.updateRule = AREA('mensalidades')
    fees.deleteRule = AREA('mensalidades')
    app.save(fees)

    // 4. PRESENÇAS: attendance + classes + class_students + points_entries +
    //    ranking_archives (chamada, turmas e ranking compartilham a área de treino).
    const attendance = app.findCollectionByNameOrId('attendance')
    attendance.listRule = LIST_WITH_STUDENT('presencas', 'student.user = @request.auth.id')
    attendance.viewRule = LIST_WITH_STUDENT('presencas', 'student.user = @request.auth.id')
    attendance.createRule = AREA('presencas')
    attendance.updateRule = AREA('presencas')
    attendance.deleteRule = AREA('presencas')
    app.save(attendance)

    const classes = app.findCollectionByNameOrId('classes')
    // Leitura: turmas ativas continuam públicas; admin liberado na área vê tudo.
    classes.listRule = '(active = true) || ' + AREA('presencas')
    classes.viewRule = classes.listRule
    classes.createRule = AREA('presencas')
    classes.updateRule = AREA('presencas')
    classes.deleteRule = AREA('presencas')
    app.save(classes)

    const cs = app.findCollectionByNameOrId('class_students')
    cs.listRule = LIST_WITH_STUDENT('presencas', 'student.user = @request.auth.id')
    cs.viewRule = LIST_WITH_STUDENT('presencas', 'student.user = @request.auth.id')
    cs.createRule = AREA('presencas')
    cs.updateRule = AREA('presencas')
    cs.deleteRule = AREA('presencas')
    app.save(cs)

    const points = app.findCollectionByNameOrId('points_entries')
    points.listRule = AREA('presencas')
    points.viewRule = AREA('presencas')
    points.createRule = AREA('presencas')
    points.updateRule = AREA('presencas')
    points.deleteRule = AREA('presencas')
    app.save(points)

    const archives = app.findCollectionByNameOrId('ranking_archives')
    archives.listRule = AREA('presencas')
    archives.viewRule = AREA('presencas')
    archives.createRule = AREA('presencas')
    archives.updateRule = AREA('presencas')
    archives.deleteRule = AREA('presencas')
    app.save(archives)

    // 5. PRODUTOS: products + product_variations (leitura pública mantida).
    const products = app.findCollectionByNameOrId('products')
    products.listRule = ''
    products.viewRule = ''
    products.createRule = AREA('produtos')
    products.updateRule = AREA('produtos')
    products.deleteRule = AREA('produtos')
    app.save(products)

    const variations = app.findCollectionByNameOrId('product_variations')
    variations.listRule = ''
    variations.viewRule = ''
    variations.createRule = AREA('produtos')
    variations.updateRule = AREA('produtos')
    variations.deleteRule = AREA('produtos')
    app.save(variations)

    // 6. PEDIDOS: orders + order_items (cliente cria/lê o próprio; admin com permissão gerencia).
    const orders = app.findCollectionByNameOrId('orders')
    orders.listRule = LIST_WITH_STUDENT('pedidos', 'user = @request.auth.id')
    orders.viewRule = LIST_WITH_STUDENT('pedidos', 'user = @request.auth.id')
    orders.createRule = "@request.auth.id != ''"
    orders.updateRule = AREA('pedidos')
    orders.deleteRule = AREA('pedidos')
    app.save(orders)

    const items = app.findCollectionByNameOrId('order_items')
    items.listRule = LIST_WITH_STUDENT('pedidos', 'order.user = @request.auth.id')
    items.viewRule = LIST_WITH_STUDENT('pedidos', 'order.user = @request.auth.id')
    items.createRule = "@request.auth.id != ''"
    items.updateRule = AREA('pedidos')
    items.deleteRule = AREA('pedidos')
    app.save(items)

    // 7. FINANCEIRO: expenses + annual_reports.
    const expenses = app.findCollectionByNameOrId('expenses')
    expenses.listRule = AREA('financeiro')
    expenses.viewRule = AREA('financeiro')
    expenses.createRule = AREA('financeiro')
    expenses.updateRule = AREA('financeiro')
    expenses.deleteRule = AREA('financeiro')
    app.save(expenses)

    const reports = app.findCollectionByNameOrId('annual_reports')
    reports.listRule = AREA('financeiro')
    reports.viewRule = AREA('financeiro')
    reports.createRule = AREA('financeiro')
    reports.updateRule = AREA('financeiro')
    reports.deleteRule = AREA('financeiro')
    app.save(reports)

    // 8. SITE: app_settings (templates de aviso), site_settings e instagram_cache
    //    (leitura pública mantida; o cache do Instagram é lido pelo hook, que é superuser).
    const appSettings = app.findCollectionByNameOrId('app_settings')
    appSettings.listRule = AREA('site')
    appSettings.viewRule = AREA('site')
    appSettings.createRule = AREA('site')
    appSettings.updateRule = AREA('site')
    appSettings.deleteRule = AREA('site')
    app.save(appSettings)

    const site = app.findCollectionByNameOrId('site_settings')
    site.listRule = ''
    site.viewRule = ''
    site.createRule = AREA('site')
    site.updateRule = AREA('site')
    site.deleteRule = AREA('site')
    app.save(site)

    const ig = app.findCollectionByNameOrId('instagram_cache')
    ig.listRule = ''
    ig.viewRule = ''
    ig.createRule = AREA('site')
    ig.updateRule = AREA('site')
    ig.deleteRule = AREA('site')
    app.save(ig)
  },
  (app) => {
    // Reverte para o estado anterior à 0031 (role 'admin' liberava tudo).
    const ADMIN_ONLY = "@request.auth.id != '' && @request.auth.role = 'admin'"
    const users = app.findCollectionByNameOrId('users')
    users.updateRule =
      "(id = @request.auth.id || @request.auth.role = 'admin') && @request.body.role:changed = false && @request.body.is_owner:changed = false && @request.body.active:changed = false"
    const field = users.fields.getByName('admin_permissions')
    if (field) users.fields.removeByName('admin_permissions')
    app.save(users)

    const setAll = (name, read, write) => {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = read
      col.viewRule = read
      col.createRule = write
      col.updateRule = write
      col.deleteRule = write
      app.save(col)
    }

    setAll(
      'students',
      "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      ADMIN_ONLY,
    )
    setAll('belt_promotions', ADMIN_ONLY, ADMIN_ONLY)
    setAll('monthly_fees', ADMIN_ONLY, ADMIN_ONLY)
    setAll(
      'attendance',
      "@request.auth.id != '' && (@request.auth.role = 'admin' || student.user = @request.auth.id)",
      ADMIN_ONLY,
    )
    setAll(
      'classes',
      "(active = true) || (@request.auth.id != '' && (@request.auth.role = 'admin' || class_students_via_class.student.user = @request.auth.id))",
      ADMIN_ONLY,
    )
    setAll(
      'class_students',
      "@request.auth.id != '' && (@request.auth.role = 'admin' || student.user = @request.auth.id)",
      ADMIN_ONLY,
    )
    setAll('points_entries', ADMIN_ONLY, ADMIN_ONLY)
    setAll('ranking_archives', ADMIN_ONLY, ADMIN_ONLY)
    setAll('products', '', ADMIN_ONLY)
    setAll('product_variations', '', ADMIN_ONLY)
    setAll(
      'orders',
      "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      ADMIN_ONLY,
    )
    const orders = app.findCollectionByNameOrId('orders')
    orders.createRule = "@request.auth.id != ''"
    app.save(orders)
    setAll(
      'order_items',
      "@request.auth.id != '' && (@request.auth.role = 'admin' || order.user = @request.auth.id)",
      ADMIN_ONLY,
    )
    const items = app.findCollectionByNameOrId('order_items')
    items.createRule = "@request.auth.id != ''"
    app.save(items)
    setAll('expenses', ADMIN_ONLY, ADMIN_ONLY)
    setAll('annual_reports', ADMIN_ONLY, ADMIN_ONLY)
    setAll('app_settings', ADMIN_ONLY, ADMIN_ONLY)
    setAll('site_settings', '', ADMIN_ONLY)
    setAll('instagram_cache', '', ADMIN_ONLY)
  },
)
