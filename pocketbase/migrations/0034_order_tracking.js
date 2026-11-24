// Rastreio do pedido estilo Correios (Judô Tatsu).
//
// Collection order_tracking: etapas LIVRES que o admin adiciona ao pedido
// (ex.: "Encomendado na fábrica", "Em produção", "Enviado pela transportadora").
// Complementa o pipeline fixo de status (orders.status) e o log automático de
// mudanças (order_status_log) — não substitui nenhum dos dois.
//
// Campos: order (relation OBRIGATÓRIA, cascade delete — apagar o pedido apaga
// o rastreio), label (texto obrigatório), user (relation opcional: quem
// registrou, preenchido pelo hook order_tracking.js via e.auth), created.
//
// REGRAS:
//   • leitura (list/view): admin liberado na área "pedidos" (mesma fórmula da
//     migration 0031) OU o dono do pedido (@request.auth.id = user do pedido).
//   • escrita (create/update/delete): NENHUMA regra = só superuser via API.
//     A JSVM do hook, porém, valida as regras do request: para o admin do
//     painel criar a etapa via API REST, createRule precisa existir. A etapa é
//     criada pelo ADMIN autenticado — o hook order_tracking.js sobrescreve o
//     campo user com e.auth (o cliente não decide quem registrou) e exige
//     label preenchida. Delete também fica liberado ao admin (corrigir etapa
//     digitada errada), com a mesma fórmula da leitura.
//
// Sintaxe: a collection é salva primeiro SEM regras (estado seguro — só
// superuser) e as regras são aplicadas depois por atribuição, mesmo caminho da
// migration 0033 (o validador aceita ":length" assim).
//
// IDEMPOTENTE: roda vazio em banco recém-criado.
migrate(
  (app) => {
    var exists = null
    try {
      exists = app.findCollectionByNameOrId('order_tracking')
    } catch (_) {
      exists = null
    }

    if (!exists) {
      exists = new Collection({
        name: 'order_tracking',
        type: 'base',
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
            name: 'label',
            type: 'text',
            required: true,
            min: 2,
            max: 200,
          },
          {
            name: 'user',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            required: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_order_tracking_order ON order_tracking (order, created)'],
      })
      app.save(exists)

      exists = app.findCollectionByNameOrId('order_tracking')
    }

    // ── Regras finais ────────────────────────────────────────────────────────
    // Admin liberado na área "pedidos" (fórmula da migration 0031).
    var AREA_PEDIDOS =
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      '(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || ' +
      "@request.auth.admin_permissions ?= 'pedidos')"

    // Dono do pedido (o comprador) — para o aluno acompanhar o rastreio.
    var E_DONO_DO_PEDIDO = "@request.auth.id != '' && order.user = @request.auth.id"

    exists.listRule = '(' + AREA_PEDIDOS + ') || (' + E_DONO_DO_PEDIDO + ')'
    exists.viewRule = '(' + AREA_PEDIDOS + ') || (' + E_DONO_DO_PEDIDO + ')'
    // Escrita: só o admin da área "pedidos" cria/remove etapas. A obrigatoriedade
    // de order/label já vem do schema (required) — a regra não precisa repetir.
    exists.createRule = '(' + AREA_PEDIDOS + ')'
    exists.updateRule = null // etapa registrada não é editável — remove e cria outra
    exists.deleteRule = '(' + AREA_PEDIDOS + ')'
    app.save(exists)
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('order_tracking')
    } catch (_) {
      col = null
    }
    if (col) app.delete(col)
  },
)
