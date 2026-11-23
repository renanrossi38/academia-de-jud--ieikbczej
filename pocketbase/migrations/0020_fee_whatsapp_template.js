///
// 0020 — WhatsApp de cobrança (Judô Tatsu).
//
// Semeia o template EDITÁVEL da mensagem de WhatsApp de mensalidade em atraso
// na collection app_settings (chave "fee_whatsapp_template"). As variáveis são
// as MESMAS do e-mail de cobrança:
//   {saudacao} — "Bom dia"/"Boa tarde"/"Boa noite" (horário de Brasília);
//   {aluno}    — nome do aluno;
//   {mes}      — mês da cobrança (o mês corrente quando a inadimplência vem da
//                regra do dia 15; o mês da pendência vencida, nos demais casos;
//                nunca um mês já pago).
// O envio automático (cron do dia 16) e o template padrão do botão "Cobrar no
// WhatsApp" usam esta chave; o fallback inline do hook é o mesmo texto.
//
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('app_settings')

    const existing = app.findRecordsByFilter(
      'app_settings',
      'key = "fee_whatsapp_template"',
      '',
      1,
      0,
    )
    if (existing.length > 0) return

    const record = new Record(collection)
    record.set('key', 'fee_whatsapp_template')
    record.set(
      'value',
      '{saudacao}, {aluno}!\n\n' +
        'Passando para lembrar que a mensalidade de {mes} da academia Judô Tatsu ' +
        'está pendente de pagamento. 🥋\n\n' +
        'Se você já pagou, desconsidere esta mensagem — pode ter sido só o ' +
        'lançamento que ainda não chegou ao sistema.\n\n' +
        'Qualquer dúvida, é só responder aqui.\n\n' +
        'Atenciosamente,\nEquipe Tatsu',
    )
    app.save(record)
  },
  (app) => {
    try {
      const settings = app.findRecordsByFilter(
        'app_settings',
        'key = "fee_whatsapp_template"',
        '',
        1,
        0,
      )
      for (let i = 0; i < settings.length; i++) app.delete(settings[i])
    } catch (_) {}
  },
)
