/// <reference path="../pb_data/types.d.ts" />
// 0025 — Produtos sob medida: flag no produto + respostas do comprador no item do pedido.
// - products.custom_options: JSON com a configuração dos campos (nome, tipo, opções, obrigatório)
// - order_items.custom_answers: JSON com as respostas do comprador por campo
migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    if (!products.fields.getByName('custom_options')) {
      products.fields.add(
        new Field({
          name: 'custom_options',
          type: 'json',
          maxSize: 2000000,
        }),
      )
      app.save(products)
    }

    const orderItems = app.findCollectionByNameOrId('order_items')
    if (!orderItems.fields.getByName('custom_answers')) {
      orderItems.fields.add(
        new Field({
          name: 'custom_answers',
          type: 'json',
          maxSize: 2000000,
        }),
      )
      app.save(orderItems)
    }
  },
  (app) => {
    const products = app.findCollectionByNameOrId('products')
    const f = products.fields.getByName('custom_options')
    if (f) products.fields.removeByName('custom_options')
    app.save(products)

    const orderItems = app.findCollectionByNameOrId('order_items')
    const g = orderItems.fields.getByName('custom_answers')
    if (g) orderItems.fields.removeByName('custom_answers')
    app.save(orderItems)
  },
)
