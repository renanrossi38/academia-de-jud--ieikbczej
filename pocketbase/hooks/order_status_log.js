// Log de etapas do pedido (Judô Tatsu): grava quem fez cada mudança de status
// em order_status_log (relation order + user executor + from/to_status).
//
// Roda em onRecordUpdateRequest de orders — cobre qualquer via (painel, API,
// outro hook com request). O EXECUTOR é o usuário autenticado do request
// (e.auth) — nunca o campo orders.user, que é o COMPRADOR do pedido.
//
// BEST-EFFORT: qualquer falha aqui só loga — nunca bloqueia a mudança de
// status (a ação principal deve sempre passar).
//
// Regras da collection order_status_log (migration 0033): leitura apenas para
// admin liberado na área "pedidos"; create/update/delete sem regra = só
// superuser/gravação server-side.
onRecordUpdateRequest((e) => {
  e.next()

  const record = e.record
  const fromStatus = record.original().getString('status')
  const toStatus = record.getString('status')
  if (fromStatus === toStatus || toStatus === '') {
    return // nada mudou de status — não grava log
  }

  try {
    let executorId = ''
    try {
      const auth = e.auth
      if (auth && auth.id) {
        executorId = auth.id
      }
    } catch (_) {
      // sem request autenticado (script/cron): executor fica vazio
    }

    const log = new Record($app.findCollectionByNameOrId('order_status_log'))
    log.set('order', record.id)
    log.set('user', executorId)
    log.set('from_status', fromStatus)
    log.set('to_status', toStatus)
    $app.save(log)
  } catch (err) {
    // log é best-effort — nunca bloqueia a mudança de status
    console.log('[order-status-log] Falha ao gravar log do pedido ' + record.id + ': ' + err)
  }
}, 'orders')
