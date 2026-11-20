migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const products = app.findCollectionByNameOrId('products')
    const variations = app.findCollectionByNameOrId('product_variations')
    const orders = app.findCollectionByNameOrId('orders')
    const orderItems = app.findCollectionByNameOrId('order_items')

    // 1. Seed or update Admin User: renanrossi38@gmail.com
    let adminRecord
    try {
      adminRecord = app.findAuthRecordByEmail('users', 'renanrossi38@gmail.com')
      adminRecord.set('role', 'admin')
      adminRecord.set('name', 'Renan Rossi')
      adminRecord.setVerified(true)
      app.save(adminRecord)
    } catch (_) {
      adminRecord = new Record(users)
      adminRecord.setEmail('renanrossi38@gmail.com')
      adminRecord.setPassword('Skip@Pass')
      adminRecord.setVerified(true)
      adminRecord.set('name', 'Renan Rossi')
      adminRecord.set('role', 'admin')
      app.save(adminRecord)
    }

    // 2. Seed or update Student User: aluno@dojo.com
    let alunoRecord
    try {
      alunoRecord = app.findAuthRecordByEmail('users', 'aluno@dojo.com')
      alunoRecord.set('role', 'aluno')
      alunoRecord.set('name', 'Takeshi Yamada')
      alunoRecord.setVerified(true)
      app.save(alunoRecord)
    } catch (_) {
      alunoRecord = new Record(users)
      alunoRecord.setEmail('aluno@dojo.com')
      alunoRecord.setPassword('Skip@Pass')
      alunoRecord.setVerified(true)
      alunoRecord.set('name', 'Takeshi Yamada')
      alunoRecord.set('role', 'aluno')
      app.save(alunoRecord)
    }

    // Helper for products
    const ensureProduct = (slug, data, variationList) => {
      let pRecord
      try {
        pRecord = app.findFirstRecordByData('products', 'slug', slug)
      } catch (_) {
        pRecord = new Record(products)
        pRecord.set('name', data.name)
        pRecord.set('slug', slug)
        pRecord.set('description', data.description)
        pRecord.set('price', data.price)
        pRecord.set('category', data.category)
        pRecord.set('active', true)
        app.save(pRecord)
      }

      // Variations
      const createdVars = []
      variationList.forEach((v) => {
        let vRecord
        try {
          const found = app.findRecordsByFilter(
            'product_variations',
            `product = '${pRecord.id}' && label = '${v.label}'`,
            '',
            1,
            0,
          )
          if (found.length > 0) {
            vRecord = found[0]
          } else {
            vRecord = new Record(variations)
            vRecord.set('product', pRecord.id)
            vRecord.set('label', v.label)
            vRecord.set('price_delta', v.price_delta || 0)
            vRecord.set('stock', v.stock || 20)
            app.save(vRecord)
          }
        } catch (_) {
          vRecord = new Record(variations)
          vRecord.set('product', pRecord.id)
          vRecord.set('label', v.label)
          vRecord.set('price_delta', v.price_delta || 0)
          vRecord.set('stock', v.stock || 20)
          app.save(vRecord)
        }
        createdVars.push(vRecord)
      })

      return { product: pRecord, variations: createdVars }
    }

    // 3. Products
    // P1: Kimono Tradicional Shiro
    const p1 = ensureProduct(
      'kimono-tradicional-shiro',
      {
        name: 'Kimono Tradicional Shiro',
        category: 'uniformes',
        price: 289.9,
        description:
          'Kimono 100% algodão trançado tradicional japonês. Gramatura de 450g/m² com reforço nos ombros, peito e joelhos. Ideal para treinos diários e graduações.',
      },
      [
        { label: 'A1 (até 1,55 m)', price_delta: 0, stock: 15 },
        { label: 'A2 (1,55–1,70 m)', price_delta: 30, stock: 25 },
        { label: 'A3 (1,70–1,85 m)', price_delta: 50, stock: 20 },
        { label: 'A4 (acima de 1,85 m)', price_delta: 70, stock: 10 },
      ],
    )

    // P2: Kimono Competição Kuro
    ensureProduct(
      'kimono-competicao-kuro',
      {
        name: 'Kimono Competição Kuro',
        category: 'uniformes',
        price: 449.9,
        description:
          'Kimono preto de alta performance para competições e mestres. Trançado pesado 550g/m², corte ergonômico ajustado ao regulamento oficial de judô e máxima durabilidade.',
      },
      [
        { label: 'A2', price_delta: 0, stock: 12 },
        { label: 'A3', price_delta: 40, stock: 15 },
        { label: 'A4', price_delta: 60, stock: 8 },
      ],
    )

    // P3: Faixa Branca
    const p3 = ensureProduct(
      'faixa-branca',
      {
        name: 'Faixa Branca Tradicional',
        category: 'faixas',
        price: 39.9,
        description:
          'Faixa de judô em sarja 100% algodão com 8 costuras paralelas reforçadas e ponteira tradicional. Conforto e firmeza para iniciantes.',
      },
      [
        { label: 'Infantil', price_delta: 0, stock: 30 },
        { label: 'Adulto', price_delta: 10, stock: 40 },
      ],
    )

    // P4: Faixa Azul
    ensureProduct(
      'faixa-azul',
      {
        name: 'Faixa Azul Graduação',
        category: 'faixas',
        price: 44.9,
        description:
          'Faixa oficial para graduação em judô. Tecido de alta resistência com cor viva e durável, não desbota facilmente nas lavagens.',
      },
      [{ label: 'Adulto', price_delta: 0, stock: 25 }],
    )

    // P5: Protetor Bucal
    ensureProduct(
      'protetor-bucal',
      {
        name: 'Protetor Bucal Termo moldável',
        category: 'equipamentos',
        price: 24.9,
        description:
          'Protetor bucal em silicone atóxico de alta densidade, moldável em água quente. Acompanha estojo higiênico ventilado. Essencial para randori.',
      },
      [{ label: 'Tamanho único', price_delta: 0, stock: 50 }],
    )

    // P6: Mensalidade — Plano 3x por semana
    ensureProduct(
      'mensalidade-plano-3x-por-semana',
      {
        name: 'Mensalidade — Plano 3x por semana',
        category: 'planos',
        price: 180.0,
        description:
          'Plano de treinos regulares de judô com acesso a 3 aulas semanais com os senseis do Dojo Nippon. Inclui acompanhamento técnico e preparação para graduação.',
      },
      [
        { label: 'Mensal', price_delta: 0, stock: 100 },
        { label: 'Trimestral', price_delta: -30, stock: 100 },
      ],
    )

    // 4. Seed 1 Demo Order for aluno Takeshi
    try {
      const existingOrders = app.findRecordsByFilter(
        'orders',
        `user = '${alunoRecord.id}'`,
        '',
        1,
        0,
      )
      if (existingOrders.length === 0) {
        const order = new Record(orders)
        order.set('user', alunoRecord.id)
        order.set('status', 'novo')
        order.set('total', 369.8)
        order.set('customer_name', 'Takeshi Yamada')
        order.set('phone', '(11) 98765-4321')
        order.set('delivery_type', 'retirada')
        order.set('notes', 'Pagarei em dinheiro ou Pix na recepção do dojo.')
        app.save(order)

        // Item 1: Kimono Shiro A2 (289.90 + 30 = 319.90)
        const item1 = new Record(orderItems)
        item1.set('order', order.id)
        item1.set('product', p1.product.id)
        if (p1.variations[1]) {
          item1.set('variation', p1.variations[1].id)
          item1.set('variation_label', p1.variations[1].getString('label'))
        }
        item1.set('product_name', p1.product.getString('name'))
        item1.set('unit_price', 319.9)
        item1.set('quantity', 1)
        item1.set('subtotal', 319.9)
        app.save(item1)

        // Item 2: Faixa Branca Adulto (39.90 + 10 = 49.90)
        const item2 = new Record(orderItems)
        item2.set('order', order.id)
        item2.set('product', p3.product.id)
        if (p3.variations[1]) {
          item2.set('variation', p3.variations[1].id)
          item2.set('variation_label', p3.variations[1].getString('label'))
        }
        item2.set('product_name', p3.product.getString('name'))
        item2.set('unit_price', 49.9)
        item2.set('quantity', 1)
        item2.set('subtotal', 49.9)
        app.save(item2)
      }
    } catch (err) {
      console.log('Error seeding demo order:', err)
    }
  },
  (app) => {
    // down logic is optional for seed data
  },
)
