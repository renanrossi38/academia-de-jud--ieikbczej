// Pedidos órfãos e log de etapas do pedido (Judô Tatsu).
//
// 1) PEDIDOS ÓRFÃOS TRAVADOS: orders.user é relation obrigatório para users.
//    Quando a ficha de um aluno é excluída, o hook delete_student_user.js
//    apaga também a conta de usuário (v0.0.76) — e os pedidos ficam apontando
//    para um id que não existe mais. A listagem funciona, mas PATCH/DELETE
//    falham com 400 "Failed to update record": a validação do relation
//    obrigatório não encontra o usuário alvo. Correção:
//      • user deixa de ser obrigatório (pedidos antigos continuam válidos);
//      • referências órfãs existentes são limpas (vazias) por SQL direto.
//    A partir daqui qualquer pedido pode ter status alterado e ser excluído;
//    o nome do cliente vem de customer_name (snapshot salvo no pedido), e o
//    painel exibe "Aluno removido" quando o usuário não existe mais.
//
// 2) LOG DE ETAPAS DO PEDIDO: collection order_status_log grava quem fez cada
//    mudança de status (order, user executor, from_status, to_status, created).
//    Regras: leitura apenas para administrador liberado na área "pedidos"
//    (mesma fórmula da migration 0031); create/update/delete sem regra = só
//    superuser grava (o hook server-side).
//
// CRIAÇÃO EM DUAS ETAPAS: a collection é salva primeiro sem regras e as regras
// são aplicadas depois por atribuição (col.listRule = ...) — o mesmo caminho da
// migration 0031, que é o que o validador desta versão aceita para regras com
// o modificador ":length".
//
// IDEMPOTENTE: roda vazio em banco recém-criado (hasTable protege).

migrate(
  (app) => {
    // ── 1. orders.user deixa de ser obrigatório + limpa órfãos ──────────────
    if (app.hasTable('orders')) {
      const orders = app.findCollectionByNameOrId('orders')
      const userField = orders.fields.getByName('user')
      if (userField && userField.required) {
        userField.required = false
        app.save(orders)
      }

      // Limpa referências órfãs (pedidos apontando para usuário apagado).
      // SQL direto: users pode nem existir em banco recém-criado.
      if (app.hasTable('users')) {
        app
          .db()
          .newQuery(
            'UPDATE orders SET user = "" WHERE user != "" AND user NOT IN (SELECT id FROM users)',
          )
          .execute()
      }
    }

    // ── 2. order_status_log ──────────────────────────────────────────────────
    let log = null
    try {
      log = app.findCollectionByNameOrId('order_status_log')
    } catch (_) {
      log = null
    }

    if (!log) {
      log = new Collection({
        name: 'order_status_log',
        type: 'base',
        // Sem regras na criação: enquanto as regras não são aplicadas, só o
        // superuser (hook) acessa — estado seguro.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'order',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('orders').id,
            required: true,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            required: false,
            maxSelect: 1,
          },
          {
            name: 'from_status',
            type: 'select',
            maxSelect: 1,
            values: ['novo', 'confirmado', 'em_preparacao', 'pronto', 'entregue', 'cancelado'],
          },
          {
            name: 'to_status',
            type: 'select',
            maxSelect: 1,
            values: ['novo', 'confirmado', 'em_preparacao', 'pronto', 'entregue', 'cancelado'],
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_order_status_log_order ON order_status_log (order, created)'],
      })
      app.save(log)

      log = app.findCollectionByNameOrId('order_status_log')
    }

    // Regras de leitura: admin liberado na área "pedidos" (fórmula da 0031).
    const AREA_PEDIDOS =
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      '(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || ' +
      "@request.auth.admin_permissions ?= 'pedidos')"
    log.listRule = AREA_PEDIDOS
    log.viewRule = AREA_PEDIDOS
    app.save(log)
  },
  (app) => {
    // down: reverter o campo obrigatório e apagar o log (perde histórico)
    if (app.hasTable('orders')) {
      const orders = app.findCollectionByNameOrId('orders')
      const userField = orders.fields.getByName('user')
      if (userField) {
        userField.required = true
        app.save(orders)
      }
    }
    try {
      const log = app.findCollectionByNameOrId('order_status_log')
      app.delete(log)
    } catch (_) {}
  },
)
