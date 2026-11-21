// Campos novos na collection `monthly_fees`:
//  - payment_method (select opcional: pix / dinheiro / cartão)
//  - due_date (date opcional — vencimento; padrão do app: dia 15 do reference_month)
// Backfill: para registros existentes sem due_date, deriva o dia 15 do
// reference_month ("YYYY-MM" → "YYYY-MM-15 12:00:00.000Z"). Idempotente.
migrate(
  (app) => {
    const fees = app.findCollectionByNameOrId('monthly_fees')

    if (!fees.fields.getByName('payment_method')) {
      fees.fields.add(
        new SelectField({
          name: 'payment_method',
          maxSelect: 1,
          values: ['pix', 'dinheiro', 'cartao'],
        }),
      )
    }
    if (!fees.fields.getByName('due_date')) {
      fees.fields.add(new DateField({ name: 'due_date' }))
    }
    app.save(fees)

    // Backfill simples: vencimento = dia 15 do mês de referência.
    app
      .db()
      .newQuery(
        "UPDATE monthly_fees SET due_date = reference_month || '-15 12:00:00.000Z' WHERE due_date IS NULL OR due_date = ''",
      )
      .execute()
  },
  (app) => {
    const fees = app.findCollectionByNameOrId('monthly_fees')
    const method = fees.fields.getByName('payment_method')
    if (method) fees.fields.removeByName('payment_method')
    const due = fees.fields.getByName('due_date')
    if (due) fees.fields.removeByName('due_date')
    app.save(fees)
  },
)
