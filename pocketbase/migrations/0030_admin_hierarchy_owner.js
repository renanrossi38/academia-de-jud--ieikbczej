// Hierarquia de administradores — ajuste da v0.0.74.
//
// A migration 0029 criou a opção 'admin_secundario' no select role, mas TODAS
// as regras de API das coleções (students, classes, attendance, monthly_fees…)
// liberam o painel por @request.auth.role = 'admin' — um 'admin_secundario'
// ficaria sem acesso a nada. O cargo do secundário passa a ser o MESMO
// 'admin' do dono: quem separa principal de secundário é o campo is_owner
// (criado na 0029), e a rota /backend/v1/admins exige is_owner para qualquer
// gestão de cargos.
//
// Além disso, a regra de update de users (0005) bloqueia mudanças de role,
// mas NÃO de is_owner: qualquer usuário logado poderia se auto-promover a
// principal via API. Esta migration trava is_owner e active no update comum.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1) Remove a opção 'admin_secundario' (não usada; nenhum registro a tem).
    const role = users.fields.getByName('role')
    if (role) {
      role.values = role.values.filter((v) => v !== 'admin_secundario')
    }

    // 2) Update: o usuário comum continua podendo editar o próprio perfil
    //    (nome, avatar, senha), mas NUNCA role, is_owner ou active — o cargo
    //    muda apenas pelo pb_hook (único caminho, exclusivo do principal).
    users.updateRule =
      "(id = @request.auth.id || @request.auth.role = 'admin') && @request.body.role:changed = false && @request.body.is_owner:changed = false && @request.body.active:changed = false"

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const role = users.fields.getByName('role')
    if (role && !role.values.includes('admin_secundario')) {
      role.values.push('admin_secundario')
    }
    users.updateRule =
      "(id = @request.auth.id || @request.auth.role = 'admin') && @request.body.role:changed = false"
    app.save(users)
  },
)
