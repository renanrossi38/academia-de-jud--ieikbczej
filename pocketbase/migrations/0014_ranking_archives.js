migrate(
  (app) => {
    const entries = app.findCollectionByNameOrId('points_entries')

    // Ano a que o lançamento pertence (pela data da competição/evento).
    if (!entries.fields.getByName('year')) {
      entries.fields.add(
        new NumberField({
          name: 'year',
          onlyInt: true,
          min: 2000,
          max: 2100,
        }),
      )
    }
    entries.addIndex('idx_points_entries_year', false, 'year', '')
    app.save(entries)

    // Backfill idempotente: deriva o ano da data do lançamento (ou do created).
    app
      .db()
      .newQuery(`
    UPDATE points_entries
    SET year = CAST(COALESCE(
      strftime('%Y', date),
      strftime('%Y', created)
    ) AS INTEGER)
    WHERE year IS NULL OR year = 0
  `)
      .execute()

    // Snapshot arquivado do ranking de um ano (cria só se ainda não existir).
    let archives
    try {
      archives = app.findCollectionByNameOrId('ranking_archives')
    } catch (_) {
      archives = null
    }
    if (!archives) {
      archives = new Collection({
        name: 'ranking_archives',
        type: 'base',
        listRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        viewRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        createRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        updateRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        deleteRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        fields: [
          { name: 'year', type: 'number', required: true, onlyInt: true },
          { name: 'total_points', type: 'number' },
          { name: 'presences', type: 'number' },
          { name: 'manual_points', type: 'number' },
          { name: 'rank', type: 'number', onlyInt: true },
          { name: 'student_name', type: 'text', required: true },
          { name: 'student_id', type: 'text' },
          { name: 'belt', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_ranking_archives_year ON ranking_archives (year)'],
      })
      app.save(archives)
    }

    // Lançamento de exemplo de um ano anterior, para demonstrar a consulta
    // de arquivos com dados (aluno existente, sem inventar cadastro novo).
    const hasDemo = app.findRecordsByFilter('points_entries', 'year < 2026', '', 1, 0)
    if (hasDemo.length === 0) {
      const demoEntries = app.findRecordsByFilter(
        'points_entries',
        'description = "Campeonato Paulista — 3º lugar"',
        '',
        1,
        0,
      )
      if (demoEntries.length > 0) {
        const demo = demoEntries[0]
        demo.set('year', 2025)
        demo.set('date', '2025-11-15 12:00:00.000Z')
        app.save(demo)
      }
    }
  },
  (app) => {
    try {
      const archives = app.findCollectionByNameOrId('ranking_archives')
      app.delete(archives)
    } catch (_) {}
    try {
      const entries = app.findCollectionByNameOrId('points_entries')
      entries.removeIndex('idx_points_entries_year')
      entries.fields.removeByName('year')
      app.save(entries)
    } catch (_) {}
  },
)
