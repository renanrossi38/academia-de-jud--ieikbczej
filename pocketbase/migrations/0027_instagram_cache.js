// Cache dos posts do Instagram exibidos na home (Judô Tatsu).
//
// Por que uma collection própria e não app_settings: o campo value de
// app_settings é text com máximo de 5000 caracteres, e o JSON dos posts (URLs
// da CDN do Instagram + legendas) passa disso — a gravação do cache falhava
// ("value: Must be no more than 5000 character(s)"). Aqui o campo data é json
// (maxSize padrão, de folga) e a leitura/escrita é feita só pelo hook
// pocketbase/hooks/instagram_posts.js via $app (contexto de superusuário,
// ignora regras — por isso as regras ficam nulas, sem acesso pela API REST).
//
// Formato de data (único registro): { fetched_at: ISO, posts: [ ... ] }
migrate(
  (app) => {
    // Idempotente: em cópias restauradas a collection pode já existir.
    try {
      app.findCollectionByNameOrId('instagram_cache')
      return
    } catch (_) {}

    const collection = new Collection({
      name: 'instagram_cache',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'data', type: 'json', maxSize: 1048576 },
        { name: 'fetched_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('instagram_cache')
      app.delete(collection)
    } catch (_) {}
  },
)
