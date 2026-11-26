/**
 * 0048 — quarta correção do drift do select belt. Save INCONDICIONAL.
 *
 * Causa real descoberta nesta rodada: o espelho src/lib/pocketbase/schema.json
 * comitado ainda tinha 9 valores no select belt — o reconcile do deploy
 * reaplicava as 9 a cada publicação e desfazia 0044/0045/0046/0047. As
 * migrations anteriores estavam corretas (byte a byte iguais a BELT_ORDER);
 * quem regredia era o espelho. Nesta rodada o espelho foi corrigido para as
 * 13 faixas NO MESMO commit desta migration.
 *
 * Esta migration salva sem comparar (sem no-op): mesmo que o estado ao vivo
 * alegue estar "igual", força os 13 valores de BELT_ORDER em
 * users/students/belt_promotions. Nenhum dado de aluno muda — só o select.
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
      if (!field) {
        throw new Error('[0048] campo belt não existe em ' + name)
      }
      // Nesta JSVM o .type do campo pode vir como função (método Go) — aceitar
      // as duas formas. As migrations 0044–0047 usavam comparação direta
      // 'field.type !== "select"', que dava SEMPRE true e virava no-op
      // silencioso — por isso o "apply" dizia up to date com o banco em 9.
      const rawType = field.type
      const t = typeof rawType === 'function' ? String(rawType.call(field)) : String(rawType)
      if (t !== 'select') {
        throw new Error('[0048] campo belt não é select em ' + name + ' (tipo lido: ' + t + ')')
      }
      field.values = FULL_VALUES
      app.save(col)
      console.log('[0048] belt forçado a 13 valores em ' + name + ' (tipo lido: ' + t + ')')
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
