// Guarda de total dos pedidos (Judô Tatsu) — o total NUNCA vem do cliente.
//
// O fluxo de compra cria o pedido (orders) e depois os itens (order_items),
// ambos via API pública autenticada (create: @request.auth.id != ''). Sem este
// guard, o cliente poderia enviar total/unit_price adulterados. Aqui o servidor
// é a fonte da verdade:
//
//   • onRecordCreate de order_items:
//       - quantidade clampada para 1..99;
//       - unit_price RECALCULADO do produto: products.price
//         + price_delta da variação (validando que a variação pertence ao
//         produto) + soma dos price_delta das opções escolhidas nos campos
//         sob medida (products.custom_options, type "escolha");
//       - subtotal = unit_price * quantity;
//       - variation_label sobrescrito com o rótulo oficial da variação;
//       - depois de persistir, orders.total = soma dos subtotais dos itens.
//   • onRecordUpdate de order_items (ajuste manual do admin): apenas recalcula
//     orders.total pela soma dos subtotais (não sobrescreve preço editado).
//
// Produto inexistente, variação de outro produto ou item sem pedido/produto
// são RECUSADOS (400) — o create falha e o front mostra o erro.
//
// Toda a lógica é INLINE no callback: a JSVM executa callbacks em pool
// separado e não enxerga declarações de nível superior. JSVM não tem
// $app.countRecordsByFilter — usar findRecordsByFilter.
onRecordCreate((e) => {
  var item = e.record

  var orderId = item.getString('order')
  if (orderId === '') {
    throw new ApiError(400, 'Item sem pedido vinculado.')
  }

  var qty = item.getInt('quantity')
  if (isNaN(qty)) qty = 1
  qty = Math.min(99, Math.max(1, Math.round(qty)))
  item.set('quantity', qty)

  var productId = item.getString('product')
  if (productId === '') {
    throw new ApiError(400, 'Item sem produto vinculado.')
  }

  var product
  try {
    product = $app.findRecordById('products', productId)
  } catch (errProd) {
    throw new ApiError(400, 'Produto do item não encontrado.')
  }

  var basePrice = product.getFloat('price')
  if (isNaN(basePrice) || basePrice < 0) basePrice = 0
  var unit = basePrice

  // Variação (tamanho/opção): acréscimo de preço + validação de pertencimento
  var variationId = item.getString('variation')
  if (variationId !== '') {
    var variation
    try {
      variation = $app.findRecordById('product_variations', variationId)
    } catch (errVar) {
      throw new ApiError(400, 'Variação do produto não encontrada.')
    }
    if (variation.getString('product') !== productId) {
      throw new ApiError(400, 'Variação não pertence ao produto informado.')
    }
    var varDelta = variation.getFloat('price_delta')
    if (isNaN(varDelta)) varDelta = 0
    unit += varDelta
    item.set('variation_label', variation.getString('label'))
  }

  // Campos sob medida: soma dos price_delta das opções escolhidas ("escolha")
  var answers = null
  try {
    var rawAns = item.get('custom_answers')
    if (rawAns !== null && rawAns !== undefined && rawAns !== '') {
      answers = typeof rawAns === 'string' ? JSON.parse(rawAns) : rawAns
    }
  } catch (errAns) {
    answers = null
  }
  var fields = null
  try {
    var rawOpts = product.get('custom_options')
    if (rawOpts !== null && rawOpts !== undefined && rawOpts !== '') {
      fields = typeof rawOpts === 'string' ? JSON.parse(rawOpts) : rawOpts
    }
  } catch (errOpts) {
    fields = null
  }
  if (fields && answers && fields.length) {
    for (var f = 0; f < fields.length; f++) {
      var fld = fields[f]
      if (!fld || fld.type !== 'escolha') continue
      var chosen = ''
      try {
        chosen = String(answers[fld.name] || '').trim()
      } catch (errChosen) {
        chosen = ''
      }
      if (chosen === '') continue
      var opts = fld.options
      if (!opts || !opts.length) continue
      for (var o = 0; o < opts.length; o++) {
        var op = opts[o]
        if (op === null || op === undefined) continue
        var lbl = typeof op === 'string' ? op : String(op.label || '')
        if (lbl !== chosen) continue
        if (typeof op === 'object' && op.price_delta !== null && op.price_delta !== undefined) {
          var d = Number(op.price_delta)
          if (!isNaN(d)) unit += d
        }
        break
      }
    }
  }

  unit = Math.max(0, Math.round(unit * 100) / 100)
  item.set('unit_price', unit)
  item.set('subtotal', Math.round(unit * qty * 100) / 100)

  e.next()

  // Recalcula o total do pedido pela soma dos subtotais já persistidos.
  try {
    var items = $app.findRecordsByFilter(
      'order_items',
      "order = '" + orderId + "'",
      'created',
      500,
      0,
    )
    var total = 0
    for (var j = 0; j < items.length; j++) {
      var s = items[j].getFloat('subtotal')
      if (isNaN(s) || s < 0) s = 0
      total += s
    }
    total = Math.round(total * 100) / 100
    var order = $app.findRecordById('orders', orderId)
    order.set('total', total)
    $app.save(order)
    console.log('[order-total] Pedido ' + orderId + ' total recalculado: ' + total)
  } catch (errTotal) {
    console.log('[order-total] Falha ao recalcular total do pedido ' + orderId + ': ' + errTotal)
  }
}, 'order_items')

// Ajuste manual de item pelo admin: mantém o total coerente com os itens.
onRecordUpdate((e) => {
  e.next()

  var orderId = e.record.getString('order')
  if (orderId === '') return
  try {
    var items = $app.findRecordsByFilter(
      'order_items',
      "order = '" + orderId + "'",
      'created',
      500,
      0,
    )
    var total = 0
    for (var j = 0; j < items.length; j++) {
      var s = items[j].getFloat('subtotal')
      if (isNaN(s) || s < 0) s = 0
      total += s
    }
    total = Math.round(total * 100) / 100
    var order = $app.findRecordById('orders', orderId)
    order.set('total', total)
    $app.save(order)
  } catch (errTotal) {
    console.log(
      '[order-total] Falha ao recalcular total (update) do pedido ' + orderId + ': ' + errTotal,
    )
  }
}, 'order_items')
