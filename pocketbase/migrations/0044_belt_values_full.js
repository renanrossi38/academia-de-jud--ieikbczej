/**
 * 0044 — users.belt, students.belt e belt_promotions.belt aceitam as 13 faixas.
 *
 * O cadastro de aluno (CreateStudentDialog) oferece as 13 graduações do
 * Judô Tatsu (BELT_ORDER, incluindo as 4 de "ponta"), mas o select `belt`
 * no banco só tinha as 9 faixas base: escolher uma faixa de ponta recusava
 * a criação com 400 "Failed to create record".
 *
 * A migration 0024 já fazia este ajuste, porém o estado ao vivo das três
 * collections voltou a 9 valores; esta migration realinha o schema ao que o
 * código espera — exatamente os VALUES de BELT_ORDER
 * (src/services/beltPromotions.ts). Nada além dos valores do select muda.
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
    // Reverte para as 9 faixas base (só é seguro sem registros de ponta).
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
