// Rebranding "Dojo Nippon" -> "Judô Tatsu" nos DADOS já gravados (seeds antigos).
// Não altera schema nem regras de acesso — só textos de produtos e lançamentos
// de exemplo que mencionavam a marca antiga. Idempotente: pode rodar mais de
// uma vez sem duplicar nem corromper nada.
migrate(
  (app) => {
    // 1) Descrições de produtos que citam a marca antiga
    try {
      const old = app.findRecordsByFilter('products', "description ~ 'Dojo Nippon'", '', 500, 0)
      old.forEach((record) => {
        const desc = record.getString('description') || ''
        record.set('description', desc.split('Dojo Nippon').join('Judô Tatsu'))
        app.save(record)
      })
      if (old.length > 0) {
        console.log(`Rebrand: ${old.length} descrição(ões) de produto atualizada(s).`)
      }
    } catch (err) {
      console.log('Rebrand: erro ao atualizar descrições de produtos:', err)
    }

    // 2) Camiseta do dojo -> Camiseta do Judô Tatsu (slug permanece o mesmo
    //    para não quebrar links antigos)
    try {
      const camiseta = app.findFirstRecordByData('products', 'slug', 'camiseta-dojo')
      if (camiseta && camiseta.getString('name') === 'Camiseta do Dojo') {
        camiseta.set('name', 'Camiseta do Judô Tatsu')
        app.save(camiseta)
      }
    } catch (_) {
      // produto ainda não existe — nada a fazer
    }

    // 3) Lançamentos de pontuação de exemplo que citam "dojo" sem a marca
    try {
      const entries = app.findRecordsByFilter(
        'points_entries',
        "description = 'Evento beneficente do dojo'",
        '',
        500,
        0,
      )
      entries.forEach((record) => {
        record.set('description', 'Evento beneficente do Judô Tatsu')
        app.save(record)
      })
    } catch (_) {
      // collection ainda não existe em bases antigas — nada a fazer
    }
  },
  (app) => {
    // down: volta os textos para a marca antiga (apenas onde o padrão atual bate)
    try {
      const prods = app.findRecordsByFilter('products', "description ~ 'Judô Tatsu'", '', 500, 0)
      prods.forEach((record) => {
        const desc = record.getString('description') || ''
        record.set('description', desc.split('Judô Tatsu').join('Dojo Nippon'))
        app.save(record)
      })
    } catch (_) {}
  },
)
