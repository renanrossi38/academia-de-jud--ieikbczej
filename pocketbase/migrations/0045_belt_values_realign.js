/**
 * 0045 — users.belt, students.belt e belt_promotions.belt aceitam as 13 faixas.
 *
 * A migration 0044 foi aplicada, mas o estado ao vivo das três collections
 * voltou a 9 valores (drift de schema × código): o painel oferece BELT_ORDER
 * completo (src/services/beltPromotions.ts), então escolher uma faixa de
 * ponta — ex.: "branca ponta cinza" — recusa o create com 400 "Failed to
 * create record" e a tela não diz qual campo falhou.
 *
 * Esta migration realinha o schema de novo, de forma idempotente: só regrava
 * as collections cujos valores do select belt divergem do esperado. Nada
 * além dos valores do select muda.
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

    ;['users', 'students', 'belt_promotions'].forEach((name) => {
      const col = app.findCollectionByNameOrId(name)
      const field = col.fields.getByName('belt')
      if (!field || field.type !== 'select') return
      const current = field.values || []
      const same =
        current.length === FULL_VALUES.length && current.every((v, i) => v === FULL_VALUES[i])
      if (same) return // já está alinhado — no-op (idempotente)
      field.values = FULL_VALUES
      app.save(col)
      console.log('[0045] belt realinhado em ' + name + ' (' + current.length + ' → 13 valores)')
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
    ;['users', 'students', 'belt_promotions'].forEach((name) => {
      const col = app.findCollectionByNameOrId(name)
      const field = col.fields.getByName('belt')
      if (field && field.type === 'select') {
        field.values = OLD_VALUES
        app.save(col)
      }
    })
  },
)
