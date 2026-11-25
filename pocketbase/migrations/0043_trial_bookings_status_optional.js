// Bug v0.0.129 — criação de agendamento falha com 400 "Failed to create
// record" mesmo com createRule público (0042). Causa: o campo `status`
// (select) é REQUIRED e o visitante deslogado não envia status algum — o
// PocketBase recusa o create na validação de campo, antes de chegar ao hook.
//
// Fix em duas frentes:
//   1. esta migration deixa `status` OPCIONAL (o default é aplicado no hook
//      trial_bookings.js, que grava 'novo' quando vazio);
//   2. o hook também passa a preencher o default.
// Assim o agendamento público cria sem 400 e o painel sempre vê um status.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('trial_bookings')
    const status = col.fields.getByName('status')
    if (status) {
      status.required = false
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('trial_bookings')
    const status = col.fields.getByName('status')
    if (status) {
      status.required = true
      app.save(col)
    }
  },
)
