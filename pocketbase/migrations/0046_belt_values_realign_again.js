/**
 * 0046 — users.belt, students.belt e belt_promotions.belt aceitam as 13 faixas
 * (terceira correção; 0044 e 0045 já aplicaram isto e o banco regrediu).
 *
 * Causa-raiz: o espelho de schema src/lib/pocketbase/schema.json listava 9
 * valores no select belt das três collections — o reconcile do deploy
 * restaurava o estado do espelho e desfazia a migration. Esta migration
 * realinha o banco (idempotente: no-op quando já há 13 valores); o espelho é
 * atualizado no mesmo commit para o drift não voltar.
 *
 * Valores exatamente como BELT_ORDER (src/services/beltPromotions.ts), os
 * mesmos já usados por 0044/0045.
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
      console.log('[0046] belt realinhado em ' + name + ' (' + current.length + ' → 13 valores)')
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
