migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1. products
    const products = new Collection({
      name: 'products',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'price', type: 'number', required: false, min: 0 },
        {
          name: 'image',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: ['uniformes', 'faixas', 'equipamentos', 'planos'],
          maxSelect: 1,
        },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_products_slug ON products (slug)',
        'CREATE INDEX idx_products_category ON products (category)',
        'CREATE INDEX idx_products_active ON products (active)',
      ],
    })
    app.save(products)

    const savedProducts = app.findCollectionByNameOrId('products')

    // 2. product_variations
    const productVariations = new Collection({
      name: 'product_variations',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'product',
          type: 'relation',
          required: true,
          collectionId: savedProducts.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'label', type: 'text', required: true },
        { name: 'price_delta', type: 'number' },
        { name: 'stock', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pv_product ON product_variations (product)'],
    })
    app.save(productVariations)

    const savedVariations = app.findCollectionByNameOrId('product_variations')

    // 3. orders
    const orders = new Collection({
      name: 'orders',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['novo', 'confirmado', 'em_preparacao', 'pronto', 'entregue', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'total', type: 'number', required: false, min: 0 },
        { name: 'customer_name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        {
          name: 'delivery_type',
          type: 'select',
          required: true,
          values: ['retirada', 'entrega'],
          maxSelect: 1,
        },
        { name: 'address', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_orders_status ON orders (status)',
        'CREATE INDEX idx_orders_user ON orders (user)',
        'CREATE INDEX idx_orders_created ON orders (created)',
      ],
    })
    app.save(orders)

    const savedOrders = app.findCollectionByNameOrId('orders')

    // 4. order_items
    const orderItems = new Collection({
      name: 'order_items',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || order.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || order.user = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'order',
          type: 'relation',
          required: true,
          collectionId: savedOrders.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'product',
          type: 'relation',
          required: true,
          collectionId: savedProducts.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'variation',
          type: 'relation',
          collectionId: savedVariations.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'product_name', type: 'text', required: true },
        { name: 'variation_label', type: 'text' },
        { name: 'unit_price', type: 'number', required: false, min: 0 },
        { name: 'quantity', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'subtotal', type: 'number', required: false, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_order_items_order ON order_items (order)'],
    })
    app.save(orderItems)
  },
  (app) => {
    const tryDelete = (name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
    tryDelete('order_items')
    tryDelete('orders')
    tryDelete('product_variations')
    tryDelete('products')
  },
)
