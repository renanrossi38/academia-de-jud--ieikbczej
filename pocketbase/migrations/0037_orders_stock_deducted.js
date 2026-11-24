// Baixa automática de estoque na entrega (Judô Tatsu).
//
// Flag orders.stock_deducted (bool): garante que o estoque de um pedido seja
// baixado UMA única vez, mesmo que o status volte de "entregue" e vá de novo.
// O hook order_stock_deduct.js lê/gravá esse flag.
//
//   • status → "entregue" (vindo de outro status) e flag falso: hook baixa o
//     estoque das variações dos itens e grava stock_deducted = true.
//   • entregue → cancelado: hook DEVOLVE o estoque e zera o flag (a mercadoria
//     voltou; uma entrega futura do mesmo pedido desconta de novo — coerente).
//   • entregue → qualquer outro status que não cancelado: flag continua true,
//     nenhuma dupla baixa.
//
// Regra para pedidos JÁ "entregue" antes deste recurso: backfill grava o flag
// como true — o estoque deles já saiu fisicamente e não deve ser descontado
// retroativamente numa futura mudança de status.
//
// IDEMPOTENTE: roda vazio em banco recém-criado (nenhum pedido entregue).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (!col.fields.getByName('stock_deducted')) {
      col.fields.add(new BoolField({ name: 'stock_deducted' }))
    }
    app.save(col)

    // Backfill: pedidos entregues antes do recurso já contam como baixados.
    app
      .db()
      .newQuery(
        "UPDATE orders SET stock_deducted = 1 WHERE status = 'entregue' AND (stock_deducted = 0 OR stock_deducted IS NULL)",
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (col.fields.getByName('stock_deducted')) {
      col.fields.removeByName('stock_deducted')
      app.save(col)
    }
  },
)
