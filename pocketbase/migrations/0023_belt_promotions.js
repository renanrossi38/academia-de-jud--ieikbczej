/**
 * 0023 — Controle de promoção de faixas: collection `belt_promotions`.
 *
 * Cada registro é uma promoção de faixa de um aluno: a nova faixa, a data em
 * que foi promovido e uma observação opcional. O histórico permite derivar a
 * faixa atual do aluno (a última promoção) e planejar o próximo exame (há
 * quanto tempo ele está na faixa).
 *
 * Regras: só admin lê/escreve — mesmo padrão das collections internas do painel.
 */
migrate(
  (app) => {
    const collection = new Collection({
      name: 'belt_promotions',
      type: 'base',
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        /** Aluno promovido (excluir o aluno remove o histórico dele). */
        {
          name: 'student',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('students').id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        /** Faixa conquistada na promoção — mesmos valores do campo belt do cadastro. */
        {
          name: 'belt',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'branca',
            'cinza',
            'amarela',
            'laranja',
            'verde',
            'azul',
            'roxa',
            'marrom',
            'preta',
          ],
        },
        /** Data da promoção (exame) — permite lançamento retroativo. */
        { name: 'promoted_at', type: 'date', required: true },
        /** Observação opcional (ex.: "exame na filial", "graduação dupla"). */
        { name: 'notes', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_belt_promotions_student_promoted ON belt_promotions (student, promoted_at DESC)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('belt_promotions')
    app.delete(collection)
  },
)
