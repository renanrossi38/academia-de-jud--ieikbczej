/**
 * 0024 — Lista completa de faixas do Judô Tatsu: 13 graduações.
 *
 * O judô tem faixas INTERMEDIÁRIAS de "ponta" (borda da próxima cor). A lista
 * anterior tinha só 9 valores; esta migration adiciona os 4 de ponta em todas
 * as collections que têm select de faixa (users.belt, students.belt,
 * belt_promotions.belt). A ordem dos VALUES não é a ordem de graduação — a
 * exibição usa BELT_ORDER (src/services/beltPromotions.ts).
 *
 * Nenhum registro existente é alterado: faixas antigas continuam válidas e a
 * faixa atual dos alunos continua derivada da última promoção.
 */
migrate(
  (app) => {
    const FULL_VALUES = [
      'branca',
      'branca_ponta_cinza',
      'cinza',
      'cinza_ponta_azul',
      'azul',
      'azul_ponta_amarela',
      'amarela',
      'amarela_ponta_laranja',
      'laranja',
      'verde',
      'roxa',
      'marrom',
      'preta',
    ]

    const colNames = ['users', 'students', 'belt_promotions']
    colNames.forEach((name) => {
      const col = app.findCollectionByNameOrId(name)
      const field = col.fields.getByName('belt')
      if (field && field.type === 'select') {
        field.values = FULL_VALUES
        app.save(col)
      }
    })
  },
  (app) => {
    // Reverte para as 9 faixas originais (nenhum registro pode ter os valores
    // novos, pois eles só passam a existir com esta migration).
    const OLD_VALUES = [
      'branca',
      'cinza',
      'amarela',
      'laranja',
      'verde',
      'azul',
      'roxa',
      'marrom',
      'preta',
    ]
    const colNames = ['users', 'students', 'belt_promotions']
    colNames.forEach((name) => {
      const col = app.findCollectionByNameOrId(name)
      const field = col.fields.getByName('belt')
      if (field && field.type === 'select') {
        field.values = OLD_VALUES
        app.save(col)
      }
    })
  },
)
