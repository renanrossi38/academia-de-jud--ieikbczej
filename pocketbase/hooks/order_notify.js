onRecordCreate((e) => {
  e.next()

  try {
    const order = e.record
    const orderId = order.id
    const customerName = order.getString('customer_name') || 'Cliente'
    const phone = order.getString('phone') || 'Não informado'
    const deliveryType =
      order.getString('delivery_type') === 'entrega' ? 'Entrega no endereço' : 'Retirada no Dojo'
    const address = order.getString('address') || 'Não aplicável'
    const notes = order.getString('notes') || 'Nenhuma'
    const total = order.getFloat('total') || 0

    // Format currency
    const totalFormatted = 'R$ ' + total.toFixed(2).replace('.', ',')

    const emailSubject = `Novo pedido no Dojo Nippon - #${orderId.substring(0, 8)}`
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E8E0D5; border-radius: 8px;">
        <h2 style="color: #C1272D; margin-top: 0;">🥋 Novo Pedido Recebido — Dojo Nippon</h2>
        <p>Um novo pedido foi registrado no sistema!</p>
        <hr style="border: none; border-top: 1px solid #E8E0D5; margin: 20px 0;" />
        <p><strong>Pedido:</strong> #${orderId}</p>
        <p><strong>Cliente:</strong> ${customerName}</p>
        <p><strong>Telefone / WhatsApp:</strong> ${phone}</p>
        <p><strong>Tipo de Recebimento:</strong> ${deliveryType}</p>
        ${order.getString('delivery_type') === 'entrega' ? `<p><strong>Endereço de Entrega:</strong> ${address}</p>` : ''}
        <p><strong>Observações:</strong> ${notes}</p>
        <p style="font-size: 18px; color: #C1272D;"><strong>Total:</strong> ${totalFormatted}</p>
        <hr style="border: none; border-top: 1px solid #E8E0D5; margin: 20px 0;" />
        <p style="font-size: 13px; color: #6B6560;">Acesse o Painel de Pedidos para confirmar e atualizar o status do pedido.</p>
      </div>
    `

    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress || 'nao-responda@dojonippon.com',
        name: 'Dojo Nippon',
      },
      to: [{ address: 'renanrossi38@gmail.com' }],
      subject: emailSubject,
      html: htmlBody,
    })

    $app.newMailClient().send(message)
    console.log('Order notification email sent successfully for order: ' + orderId)
  } catch (err) {
    // Tolerant to errors: do not fail order creation if email fails
    console.log('Failed to send order notification email:', err)
  }
}, 'orders')
