///
// 0019 — Configurações do negócio: template editável do e-mail de mensalidade
// em atraso (Judô Tatsu).
//
// Cria a collection "app_settings" (chave/valor, somente admins) e semeia o
// template e o assunto ATUAIS do e-mail de aviso de atraso — o texto que antes
// era fixo no hook fee_overdue_notice.js vira o VALOR INICIAL editável (e
// fallback, caso o registro seja apagado).
//
// Placeholders substituídos pelo backend no envio:
//   {saudacao} — "Bom dia" / "Boa tarde" / "Boa noite" conforme o horário de
//                envio (fuso America/Sao_Paulo);
//   {aluno}    — nome do aluno;
//   {mes}      — mês de referência da mensalidade em atraso, em português
//                (ex.: "novembro").
//
migrate(
  (app) => {
    const collection = new Collection({
      name: 'app_settings',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'key', type: 'text', required: true, max: 100 },
        { name: 'value', type: 'text', maxSize: 20000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_app_settings_key ON app_settings (key)'],
    })
    app.save(collection)

    // Semeadura idempotente: cria a chave só se ela ainda não existir.
    function ensureSetting(key, value) {
      const existing = app.findRecordsByFilter('app_settings', "key = '" + key + "'", '', 1, 0)
      if (existing.length > 0) return
      const record = new Record(collection)
      record.set('key', key)
      record.set('value', value)
      app.save(record)
    }

    ensureSetting('fee_overdue_subject', 'Aviso de mensalidade em atraso - Judô Tatsu')

    ensureSetting(
      'fee_overdue_template',
      '{saudacao}, {aluno},\n\n' +
        'verificamos que o pagamento e a mensalidade do mês de {mes} não foi ' +
        'localizada em nosso sistema. Caso o mesmo tenha sido realizado, favor ' +
        'entrar em contato, enviando o comprovante de pagamento para que possamos ' +
        'dar baixa.\n\n' +
        'Atenciosamente: Equipe Tatsu',
    )
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('app_settings')
      app.delete(collection)
    } catch (_) {}
  },
)
