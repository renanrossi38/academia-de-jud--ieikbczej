/**
 * 0022 — Painel financeiro: collection `annual_reports` (relatórios anuais arquivados).
 *
 * Cada registro é o FECHAMENTO de um ano: os 12 meses com mensalidades,
 * produtos, despesas e saldo, mais os totais do ano. Snapshot calculado pelo
 * mesmo motor de src/services/finance.ts — arquivar NÃO apaga nem altera
 * mensalidades, pedidos ou despesas (é só o registro do fechamento).
 * Regras: só admin lê/escreve — mesmo padrão das collections internas do painel.
 */
migrate(
  (app) => {
    const collection = new Collection({
      name: 'annual_reports',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        /** Ano civil do relatório (único — um fechamento por ano). */
        { name: 'year', type: 'number', required: true, min: 2000, max: 2999, onlyInt: true },
        /** Totais do ano: mensalidades, produtos, despesas e saldo. */
        { name: 'fees', type: 'number', required: false, min: 0 },
        { name: 'products', type: 'number', required: false, min: 0 },
        { name: 'expenses', type: 'number', required: false, min: 0 },
        { name: 'balance', type: 'number', required: true },
        /**
         * Os 12 meses (FinanceMonth[]): [{ key: "2025-01", fees, products,
         * expenses }, ...] na ordem do ano civil.
         */
        { name: 'months', type: 'json', required: true, maxSize: 100000 },
        /** Nome do admin que arquivou (rastro do fechamento). */
        { name: 'archived_by', type: 'text', max: 200 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_annual_reports_year ON annual_reports (year)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('annual_reports')
    app.delete(collection)
  },
)
