///
// 0018 — Campo `last_notice_at` na collection `monthly_fees`.
//
// Usado pelo sistema de aviso de mensalidade em atraso (e-mail "Equipe Tatsu"):
//  - o CRON diário só reenvia o aviso se nunca notificou ou se a última
//    notificação tem mais de 7 dias (anti-spam);
//  - o botão manual "Notificar atrasados" do painel envia sempre, mas também
//    grava este campo para o cron não repetir o aviso logo em seguida.
// Valor vazio = nunca notificado.
//
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('monthly_fees')
    if (!col.fields.getByName('last_notice_at')) {
      col.fields.add(new DateField({ name: 'last_notice_at' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('monthly_fees')
    const f = col.fields.getByName('last_notice_at')
    if (f) col.fields.removeByName('last_notice_at')
    app.save(col)
  },
)
