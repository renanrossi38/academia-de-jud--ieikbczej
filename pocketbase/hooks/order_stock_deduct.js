// Baixa automática de estoque quando o pedido é ENTREGUE (Judô Tatsu).
//
// Roda em onRecordUpdate de orders — cobre qualquer via que mude o status
// (painel /painel/pedidos, API REST, outro hook), independente de quem/tipo de
// conta fez a mudança e sem depender de página aberta no navegador.
//
// REGRA DE NEGÓCIO:
//   • status → "entregue" (vindo de outro status): baixa o estoque de cada item
//     UMA única vez — flag orders.stock_deducted (migration 0037) impede baixa
//     duplicada se o status voltar e ir a "entregue" de novo.
//   • entregue → cancelado: DEVOLVE o estoque (mercadoria voltou à prateleira)
//     e zera o flag — se o pedido voltar a "entregue", baixa de novo (coerente).
//   • entregue → outro status qualquer: flag continua true, nada acontece.
//   • Outros status (novo/confirmado/em_preparacao/pronto/cancelado) NÃO baixam.
//
// CORRESPONDÊNCIA DE ESTOQUE: o schema não tem estoque no produto (products
// não possui campo stock) — o estoque existe só em product_variations.stock
// (0 = sem controle exibido). Baixa apenas no item COM relation variation;
// item sem variação não tem estoque a baixar. Nunca fica negativo (clamp em 0)
// e números estranhos (NaN/negativo) são tratados antes do cálculo.
//
// BEST-EFFORT: roda depois de e.next() (status já persistido); falha aqui só
// loga — nunca desfaz a mudança de status do painel.
//
// Toda a lógica é INLINE no callback: a JSVM executa callbacks em pool
// separado e não enxerga declarações de nível superior.
onRecordUpdate((e) => {
  e.next()

  var record = e.record
  var fromStatus = record.original().getString('status')
  var toStatus = record.getString('status')
  if (fromStatus === toStatus || toStatus === '') {
    return // status não mudou — nada a fazer
  }

  var devolvendo =
    fromStatus === 'entregue' && toStatus === 'cancelado' && record.getBool('stock_deducted')
  var baixando = toStatus === 'entregue' && !record.getBool('stock_deducted')
  if (!devolvendo && !baixando) return

  try {
    var items = $app.findRecordsByFilter(
      'order_items',
      "order = '" + record.id + "'",
      'created',
      200,
      0,
    )
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      var qty = item.getInt('quantity')
      if (isNaN(qty) || qty < 0) qty = 0
      if (qty <= 0) continue

      var variationId = item.getString('variation')
      if (variationId === '') continue // produto sem variação = sem controle de estoque

      try {
        var variation = $app.findRecordById('product_variations', variationId)
        var atual = variation.getInt('stock')
        if (isNaN(atual) || atual < 0) atual = 0

        var novo
        if (baixando) {
          novo = Math.max(0, atual - qty) // clamp: estoque nunca negativo
          if (novo === atual) continue // estoque já em 0 — nada a gravar
        } else {
          novo = atual + qty // devolução
        }

        variation.set('stock', novo)
        $app.save(variation)
        console.log(
          '[order-stock] ' +
            (baixando ? 'Baixa' : 'Devolução') +
            ' variação ' +
            variationId +
            ': ' +
            atual +
            ' → ' +
            novo +
            ' (pedido ' +
            record.id +
            ')',
        )
      } catch (errVariation) {
        // variação apagada ou inacessível: item fica sem baixa — não bloqueia
        console.log(
          '[order-stock] Variação ' +
            variationId +
            ' do pedido ' +
            record.id +
            ' não encontrada: ' +
            errVariation,
        )
      }
    }

    if (baixando) {
      record.set('stock_deducted', true)
      $app.save(record)
      console.log(
        '[order-stock] Pedido ' + record.id + ' entregue — estoque baixado (flag gravado)',
      )
    } else {
      record.set('stock_deducted', false)
      $app.save(record)
      console.log(
        '[order-stock] Pedido ' +
          record.id +
          ' cancelado após entrega — estoque devolvido (flag zerado)',
      )
    }
  } catch (err) {
    console.log('[order-stock] Falha ao processar estoque do pedido ' + record.id + ': ' + err)
  }
}, 'orders')
