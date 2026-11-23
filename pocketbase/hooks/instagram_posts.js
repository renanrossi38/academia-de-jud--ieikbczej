// Instagram na home (Judô Tatsu) — posts da conta da academia, em modo OWNER.
//
// O app usa a conta do Instagram conectada pelo DONO do app (Conectores), não a
// conta de cada usuário. Por isso a chamada ao conector acontece AQUI no hook,
// via $connectors.executeAsOwner — nunca no navegador (não existe helper front
// para owner e nenhuma credencial pode chegar ao cliente).
//
// ROTA (pública, apenas leitura de conteúdo já público no Instagram):
//   GET /backend/v1/instagram/posts
//   → { posts: [ { id, permalink, media_type, caption, image, timestamp } ] }
//   Em caso de falha (conectores off, toolkit sem plano, conta desconectada,
//   rate limit), responde 200 com { posts: [] } — o front simplesmente não
//   renderiza a seção e a home nunca quebra. O detalhe do erro fica só no log.
//
// CACHE: os posts ficam gravados na collection `instagram_cache` (registro
// único, campo json `payload` = { fetched_at, posts }, migration 0027 — o
// campo `value` (text) de app_settings tem limite de 5000 chars, estourado
// pelas URLs longas da CDN do Instagram). TTL de 15 minutos: visitas à home
// leem o banco, não a API do Instagram. Um erro da API não sobrescreve o cache
// válido (posts velhos > home sem seção).
//
// RESTRIÇÃO DA JSVM: as callbacks não enxergam declarações de nível superior —
// toda a rotina está inline dentro da callback, como em fee_overdue_notice.js.
//
// FORMA DA RESPOSTA DO TOOLKIT (INSTAGRAM_GET_IG_USER_MEDIA, conferida ao vivo):
//   r.data = { data: [ { id, caption, media_type, media_url, permalink,
//              thumbnail_url, timestamp } ], paging: ... }
// media_type: IMAGE | VIDEO | CAROUSEL_ALBUM. Em VIDEO a capa vem em
// thumbnail_url; em IMAGE/CAROUSEL_ALBUM em media_url.

routerAdd(
  'GET',
  '/backend/v1/instagram/posts',
  (e) => {
    var TTL_MS = 15 * 60 * 1000 // 15 minutos
    var POSTS_LIMIT = 7 // 1 em destaque + grade de 6 miniaturas

    // ---- Helpers locais (dentro da callback, exigência da JSVM) ----

    // Lê o cache do banco (registro único de instagram_cache). Devolve null
    // quando não há registro válido. payload é json: via getString chega como
    // bytes/bruto, então JSON.parse com try/catch — registro corrompido conta
    // como ausente.
    function lerCache() {
      var recs = $app.findRecordsByFilter('instagram_cache', '', '', 1, 0)
      if (recs.length === 0) return null
      var raw = recs[0].getString('payload')
      if (!raw || raw === '') return null
      try {
        var parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.posts)) return null
        return parsed
      } catch (errParse) {
        console.log('[instagram-posts] cache corrompido, refetch: ' + errParse)
        return null
      }
    }

    function gravarCache(posts) {
      var payload = JSON.stringify({ fetched_at: new Date().toISOString(), posts: posts })
      var recs = $app.findRecordsByFilter('instagram_cache', '', '', 1, 0)
      var rec
      if (recs.length > 0) {
        rec = recs[0]
      } else {
        rec = new Record($app.findCollectionByNameOrId('instagram_cache'))
      }
      rec.set('payload', payload)
      $app.save(rec)
    }

    // Normaliza a resposta do toolkit para o formato que o front consome.
    // Um item sem imagem e sem permalink é descartado (não renderizaria nada).
    function normalizar(itens) {
      var out = []
      for (var i = 0; i < itens.length && out.length < POSTS_LIMIT; i++) {
        var m = itens[i]
        if (!m || typeof m !== 'object') continue
        var mediaType = m.media_type || 'IMAGE'
        var image = mediaType === 'VIDEO' ? m.thumbnail_url : m.media_url
        if (!image && m.thumbnail_url) image = m.thumbnail_url
        if (!image || !m.permalink) continue
        out.push({
          id: m.id || '',
          permalink: m.permalink,
          media_type: mediaType,
          caption: typeof m.caption === 'string' ? m.caption : '',
          image: image,
          timestamp: m.timestamp || '',
        })
      }
      return out
    }

    // Tenta atualizar o cache chamando o conector. Devolve os posts ou null
    // quando o fetch falhou (aí o chamador usa o cache antigo, se houver).
    function buscarNoInstagram() {
      var r = $connectors.executeAsOwner('INSTAGRAM_GET_IG_USER_MEDIA', {
        ig_user_id: 'me',
        limit: 12,
        fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
      })
      if (!r || r.successful !== true) {
        // NUNCA expor r.error (pode carregar detalhes da conta do dono).
        console.log('[instagram-posts] fetch falhou (status do conector, detalhe no log interno)')
        return null
      }
      var itens = (r.data && r.data.data) || []
      var posts = normalizar(itens)
      if (posts.length === 0) {
        console.log('[instagram-posts] resposta sem posts utilizáveis')
        return null
      }
      gravarCache(posts)
      return posts
    }

    // ---- Fluxo da rota ----
    try {
      var cache = lerCache()
      if (cache) {
        var idade = Date.now() - new Date(cache.fetched_at).getTime()
        if (idade >= 0 && idade < TTL_MS) {
          return e.json(200, { posts: cache.posts, cached: true })
        }
      }
    } catch (errCache) {
      // Cache com problema não pode derrubar a rota: segue para o fetch.
      console.log('[instagram-posts] leitura de cache falhou: ' + errCache)
    }

    var frescos = null
    try {
      frescos = buscarNoInstagram()
    } catch (errFetch) {
      console.log('[instagram-posts] exceção no fetch: ' + errFetch)
    }

    if (frescos === null) {
      // Falhou o fetch: usa o cache antigo mesmo vencido (posts velhos
      // > seção sumida); sem cache nenhum, devolve vazio e a home omite a seção.
      try {
        var cacheVelho = lerCache()
        if (cacheVelho && cacheVelho.posts.length > 0) {
          return e.json(200, { posts: cacheVelho.posts, cached: true })
        }
      } catch (errVelho) {
        console.log('[instagram-posts] cache velho falhou: ' + errVelho)
      }
      return e.json(200, { posts: [], cached: false })
    }

    return e.json(200, { posts: frescos, cached: false })
  },
  // Público: a home é visitada sem login. A rota só lê conteúdo público do
  // Instagram (via conta do dono) e escreve apenas no cache próprio.
)
