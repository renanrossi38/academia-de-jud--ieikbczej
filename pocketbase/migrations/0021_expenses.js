/**
 * 0021 — Painel financeiro: collection `expenses` (despesas da academia).
 *
 * Cada registro é uma despesa lançada pelo admin (aluguel, energia, insumos...),
 * agrupada por data no painel Financeiro (sempre em horário de Brasília).
 * Regras: só admin lê/escreve — mesmo padrão das collections internas do painel.
 */
migrate(
  (app) => {
    const collection = new Collection({
      name: 'expenses',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'description', type: 'text', required: true, min: 1, max: 200 },
        /** Valor em reais — sempre positivo. */
        { name: 'amount', type: 'number', required: true, min: 0.01 },
        /** Data da despesa (dia em que aconteceu, pode ser retroativa). */
        { name: 'date', type: 'date', required: true },
        {
          name: 'category',
          type: 'select',
          maxSelect: 1,
          values: [
            'aluguel',
            'energia',
            'agua',
            'internet',
            'insumos',
            'equipamento',
            'salarios',
            'impostos',
            'outro',
          ],
        },
        { name: 'notes', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_expenses_date ON expenses (date)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('expenses')
    app.delete(collection)
  },
)
