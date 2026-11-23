import pb from '@/lib/pocketbase/client'

/**
 * Posts do Instagram da academia, exibidos na home.
 * Vêm da rota do backend (pocketbase/hooks/instagram_posts.js), que consulta o
 * conector Instagram em modo owner e mantém cache de 15 min em app_settings.
 */
export interface InstagramPost {
  id: string
  permalink: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string
  caption: string
  image: string
  timestamp: string
}

interface InstagramPostsResponse {
  posts: InstagramPost[]
  cached?: boolean
}

/**
 * Busca os posts para a seção da home. Nunca lança: em qualquer falha devolve
 * [] e a seção simplesmente não renderiza (a home não pode quebrar).
 */
export async function fetchInstagramPosts(): Promise<InstagramPost[]> {
  try {
    const res = await pb.send<InstagramPostsResponse>('/backend/v1/instagram/posts', {
      method: 'GET',
    })
    if (!res || !Array.isArray(res.posts)) return []
    return res.posts
  } catch (err) {
    console.error('Erro ao carregar posts do Instagram:', err)
    return []
  }
}

/** Legenda em uma linha (sem quebras) e truncada, para os cards. */
export function legendaCurta(caption: string, max = 140): string {
  const umaLinha = caption.replace(/\s+/g, ' ').trim()
  if (umaLinha.length <= max) return umaLinha
  return umaLinha.slice(0, max - 1).trimEnd() + '…'
}

/** "19 de novembro de 2026" a partir do timestamp ISO do Graph API. */
export function dataCurta(timestamp: string): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}
