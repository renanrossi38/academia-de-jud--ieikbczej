/**
 * 0047 — idempotente, idêntico ao 0046 (terceira correção do mesmo drift).
 *
 * O espelho de schema src/lib/pocketbase/schema.json comitado ainda listava 9
 * valores no select belt — o reconcile do deploy restaurava as 9 e desfez o
 * 0044/0045/0046. Com o espelho corrigido NO MESMO commit (13 valores),
 * esta migration é garantia adicional: alinha as 13 faixas em
 * users/students/belt_promotions e é no-op quando já está alinhado.
 *
 * Valores exatamente como BELT_ORDER (src/services/beltPromotions.ts).
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
      console.log('[0047] belt realinhado em ' + name + ' (' + current.length + ' → 13 valores)')
    })
  },
  (app) => {
    // Down: volta às 9 faixas base (só seguro sem registros de ponta gravados).
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
