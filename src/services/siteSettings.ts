import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'

/**
 * Conteúdo editável da página inicial (collection `site_settings`, migration
 * 0026 — registro único com o objeto em JSON no campo `data`).
 *
 * A home pública lê este registro e, SEM registro (ou sem campo salvo), usa os
 * DEFAULTS abaixo — exatamente os textos que a home tinha fixos no código, de
 * modo que nada muda visualmente ao deployar. O painel (AdminSiteSettings,
 * /painel/site) edita o registro; o tempo real (useRealtime) atualiza a home
 * na hora em que o admin salva.
 */

/** Horário de funcionamento (linha editável: dia(s) + horário). */
export interface SiteHour {
  days: string
  time: string
}

/** Passo da seção "Como funciona". */
export interface SiteHowStep {
  title: string
  description: string
}

/** Objeto completo de conteúdo da home. Toda chave tem default. */
export interface SiteContent {
  /** Hero */
  hero_badge: string
  hero_title: string
  hero_highlight: string
  hero_subtitle: string
  hero_chip1: string
  hero_chip2: string
  hero_side_label: string
  /** Contato (exibido no rodapé) */
  contact_address_line1: string
  contact_address_line2: string
  contact_whatsapp: string
  contact_email: string
  /** Horários de funcionamento (rodapé) */
  hours: SiteHour[]
  /** Seção "Como funciona" */
  how_tag: string
  how_title: string
  how_subtitle: string
  how_steps: SiteHowStep[]
  how_guarantee_label: string
  how_guarantee_text: string
  /** Rodapé — primeiro bloco (logo + nome + texto sobre a academia) */
  footer_about_title: string
  footer_about_text: string
  /** Rodapé — rótulos das colunas e da barra inferior */
  footer_brand_tag: string
  footer_hours_title: string
  footer_contact_title: string
  footer_rights: string
  /** Menu e âncoras da home (cabeçalho e rodapé) */
  nav_turmas: string
  nav_kimonos: string
  nav_destaques: string
  nav_noticias: string
  nav_como_funciona: string
  /** Abas da home (Turmas | Kimonos e Acessórios) */
  tab_turmas: string
  tab_kimonos: string
  /** Seção Turmas */
  classes_loading: string
  classes_empty_title: string
  classes_empty_text: string
  class_schedule_fallback: string
  class_fee_label: string
  class_fee_consult: string
  class_vagas_label: string
  class_enroll_button: string
  /** Seção Kimonos e Acessórios */
  shop_loading: string
  shop_cat_all: string
  shop_cat_uniformes: string
  shop_cat_faixas: string
  shop_cat_camisetas: string
  shop_badge_uniformes: string
  shop_badge_faixas: string
  shop_badge_camisetas: string
  shop_empty_title: string
  shop_empty_text: string
  shop_empty_button: string
  shop_price_prefix: string
  shop_details_button: string
  /** Seção Destaques */
  highlights_tag: string
  highlights_title: string
  highlights_subtitle: string
  highlights_month_title: string
  highlights_comp_title: string
  /** Seção Notícias (Instagram) */
  news_tag: string
  news_title: string
  news_title_highlight: string
  news_subtitle: string
  news_loading: string
  news_latest_badge: string
  news_open_label: string
  news_fallback_caption: string
  news_fallback_thumb: string
}

/** Defaults = conteúdo atual da home (seed idêntico na migration 0026). */
export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero_badge: 'Bem-vindo ao Judô Tatsu',
  hero_title: 'Vista-se para o',
  hero_highlight: 'tatame',
  hero_subtitle:
    'Conheça nossas turmas, escolha um horário para começar e adquira seu kimono, faixa e acessórios oficiais com tradição e honra.',
  hero_chip1: 'Aulas para todas as idades',
  hero_chip2: 'Matrícula aberta todo mês',
  hero_side_label: 'Academia de Judô',
  contact_address_line1: 'Rua da Sakura, 123 — Bairro Central',
  contact_address_line2: 'São Paulo - SP — CEP 01234-567',
  contact_whatsapp: '(11) 98765-4321',
  contact_email: 'contato@judotatsu.com',
  hours: [
    { days: 'Segunda a Sexta', time: '07h às 21h30' },
    { days: 'Sábado', time: '09h às 14h (Treinos Livres & Randori)' },
    { days: 'Domingo', time: 'Fechado' },
  ],
  how_tag: 'Simples & Transparente',
  how_title: 'Como funciona a matrícula e as compras no Judô Tatsu',
  how_subtitle:
    'Escolha sua turma, crie sua conta e reserve online. O pagamento é combinado diretamente com a academia.',
  how_steps: [
    {
      title: 'Escolha sua turma',
      description:
        'Veja os horários e a mensalidade na aba de turmas e escolha o nível certo para você.',
    },
    {
      title: 'Monte seu kit de treino',
      description:
        'Kimonos no seu tamanho, faixas graduadas e camisetas oficiais na aba de produtos.',
    },
    {
      title: 'Retire e pague na academia',
      description:
        'O pedido é reservado imediatamente. Pagamento no balcão via Pix, dinheiro ou cartão presencial.',
    },
  ],
  how_guarantee_label: 'Garantia de ajuste:',
  how_guarantee_text:
    'se o kimono ou faixa não vestir confortavelmente no primeiro treino, trocamos o tamanho diretamente no balcão.',
  footer_about_title: 'Judô Tatsu',
  footer_about_text:
    'Tradição, disciplina e excelência no ensino do judô. Atendendo judocas de todas as idades desde a faixa branca até a preta.',
  footer_brand_tag: 'Academia de Judô',
  footer_hours_title: 'Horários',
  footer_contact_title: 'Contato',
  footer_rights: 'Todos os direitos reservados.',
  nav_turmas: 'Turmas',
  nav_kimonos: 'Kimonos',
  nav_destaques: 'Destaques',
  nav_noticias: 'Notícias',
  nav_como_funciona: 'Como funciona',
  tab_turmas: 'Turmas',
  tab_kimonos: 'Kimonos e Acessórios',
  classes_loading: 'Carregando turmas do Judô Tatsu...',
  classes_empty_title: 'Nenhuma turma ativa no momento',
  classes_empty_text: 'Fale com a recepção para conhecer os horários disponíveis.',
  class_schedule_fallback: 'Consulte os horários na academia',
  class_fee_label: 'Mensalidade:',
  class_fee_consult: 'Consultar',
  class_vagas_label: 'Vagas:',
  class_enroll_button: 'Quero me matricular',
  shop_loading: 'Carregando catálogo da loja...',
  shop_cat_all: 'Todos',
  shop_cat_uniformes: 'Uniformes (Gi)',
  shop_cat_faixas: 'Faixas (Obi)',
  shop_cat_camisetas: 'Camisetas',
  shop_badge_uniformes: 'Uniforme / Kimono',
  shop_badge_faixas: 'Faixa / Obi',
  shop_badge_camisetas: 'Camiseta',
  shop_empty_title: 'Nenhum produto nesta categoria',
  shop_empty_text: 'Explore outras categorias ou volte para ver todos os itens disponíveis.',
  shop_empty_button: 'Ver todos os produtos',
  shop_price_prefix: 'a partir de',
  shop_details_button: 'Ver detalhes',
  highlights_tag: 'Destaques',
  highlights_title: 'Nossos destaques em cena',
  highlights_subtitle:
    'Alunos que brilharam no tatame: o destaque do mês de cada turma infantil e as medalhas conquistadas nos campeonatos.',
  highlights_month_title: 'Destaques do mês',
  highlights_comp_title: 'Destaques em competições',
  news_tag: 'Novidades do Dojo',
  news_title: 'Notícias do',
  news_title_highlight: 'Judô Tatsu',
  news_subtitle:
    'Acompanhe competições, graduações e o dia a dia da academia direto do nosso feed.',
  news_loading: 'Carregando novidades do Instagram...',
  news_latest_badge: 'Mais recente',
  news_open_label: 'Ver no Instagram',
  news_fallback_caption: 'Veja esta publicação no Instagram',
  news_fallback_thumb: 'Ver publicação no Instagram',
}

/** Registro bruto da collection site_settings. */
export interface SiteSettingsRecord {
  id: string
  collectionId: string
  collectionName: string
  data: Partial<SiteContent> | string
  saved_by?: string
  updated: string
  [key: string]: unknown
}

/**
 * Mescla o JSON salvo sobre os defaults — campo ausente, vazio ou corrompido
 * cai no valor padrão (a home nunca fica sem conteúdo). Arrays salvos vazios
 * ("[]" / {}) também caem no default: um cadinho de horário vazio era um
 * rodapé sem horários por engano.
 */
export function mergeSiteContent(saved: Partial<SiteContent> | null | undefined): SiteContent {
  const src = (saved || {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(DEFAULT_SITE_CONTENT)) {
    const val = src[key]
    if (Array.isArray(def)) {
      const arr = Array.isArray(val) ? val : []
      // Mescla cada linha por cima do shape esperado (days/time ou title/description).
      out[key] =
        arr.length === 0
          ? def
          : arr.map((row) =>
              def.length && typeof def[0] === 'object'
                ? { ...(def[0] as object), ...(typeof row === 'object' && row ? row : {}) }
                : row,
            )
    } else if (typeof def === 'string') {
      out[key] = typeof val === 'string' && val.trim() !== '' ? val : def
    }
  }
  return out as unknown as SiteContent
}

/**
 * Lê o registro único de site_settings e devolve o conteúdo mesclado com os
 * defaults. Não lança: qualquer erro (rede, regra, JSON corrompido) devolve
 * os defaults, e a home segue funcionando.
 */
export async function loadSiteContent(): Promise<SiteContent> {
  try {
    const rows = await pb.collection('site_settings').getList<SiteSettingsRecord>(1, 1, {
      sort: '-updated',
    })
    const raw = rows.items[0]?.data
    if (!raw) return { ...DEFAULT_SITE_CONTENT }
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as Partial<SiteContent>) : raw
    return mergeSiteContent(parsed)
  } catch (err) {
    console.error('Erro ao carregar conteúdo da home (usando padrão):', err)
    return { ...DEFAULT_SITE_CONTENT }
  }
}

/**
 * Lê o JSON BRUTO salvo no registro único de site_settings, SEM mesclar com os
 * defaults — para quem precisa distinguir "campo vazio no painel" de "default"
 * (ex.: o botão de WhatsApp, que some quando contact_whatsapp está vazio).
 * Não lança: sem registro ou erro devolve null.
 */
export async function loadRawSiteData(): Promise<Partial<SiteContent> | null> {
  try {
    const rows = await pb.collection('site_settings').getList<SiteSettingsRecord>(1, 1, {
      sort: '-updated',
    })
    const raw = rows.items[0]?.data
    if (!raw) return null
    return typeof raw === 'string' ? (JSON.parse(raw) as Partial<SiteContent>) : raw
  } catch (err) {
    console.error('Erro ao carregar dados brutos do site:', err)
    return null
  }
}

/**
 * Converte o erro bruto do PocketBase em mensagem clara para o toast do
 * painel. Os códigos importam: no PocketBase, uma API rule que nega um
 * UPDATE/GET devolve 404 ("não encontrado") e uma que nega um CREATE
 * devolve 400 — sem isso o admin via só "erro ao salvar".
 */
function explainSaveError(err: unknown): Error {
  const e = err as {
    status?: number
    message?: string
    response?: { data?: Record<string, { message?: string }> }
  } | null
  const status = e?.status
  if (status === 401) {
    return new Error('Sua sessão expirou — saia da conta e entre novamente para salvar.')
  }
  if (status === 403 || status === 404) {
    return new Error(
      'O servidor recusou o salvamento: sessão expirada ou sem permissão "Página inicial". Saia e entre novamente; se persistir, peça ao dono a permissão da área.',
    )
  }
  if (status === 400) {
    const fieldMsgs = Object.values(e?.response?.data || {})
      .map((d) => d?.message)
      .filter(Boolean)
    if (fieldMsgs.length > 0) return new Error(fieldMsgs.join(' '))
    return new Error(
      'O servidor recusou o salvamento (requisição inválida). Sua sessão pode ter expirado — saia e entre novamente.',
    )
  }
  if (status === 0 || status === undefined) {
    return new Error('Sem comunicação com o servidor. Verifique sua conexão e tente novamente.')
  }
  return new Error(e?.message || 'Falha ao salvar no servidor. Tente novamente.')
}

/**
 * Verifica se a sessão atual ainda vale para ESCRITA, antes de tentar o save.
 * Um token morto no servidor (backend recriado, sessão revogada) faz o
 * PocketBase tratar o pedido como anônimo: GET do próprio usuário → 404 e
 * toda escrita falha em API rule (PATCH → 404, POST → 400 "Failed to create
 * record"). Detectar isso AQUI evita o ciclo PATCH 404 → POST 400 que o
 * usuário via como "erro ao salvar" persistente em /painel/site.
 */
async function assertWritableSession(): Promise<void> {
  const id = pb.authStore.record?.id
  if (!pb.authStore.isValid || !id) {
    throw new Error('Sua sessão expirou — saia da conta e entre novamente para salvar.')
  }
  try {
    await pb.collection('users').getOne(id)
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
      // Limpa a sessão fantasma: o authStore.onChange desloga a UI e o painel
      // manda para o login, em vez de continuar exibindo um admin que não
      // consegue salvar (nem acessar áreas) até o usuário recarregar.
      pb.authStore.clear()
      throw new Error(
        'Sua sessão não é mais válida no servidor. Entre novamente na sua conta para salvar.',
      )
    }
    // Erro de rede: deixa o fluxo do save tentar (e reportar) o que acontecer.
  }
}

/** Salva o conteúdo no registro único (upsert) — só admin pelas rules. */
export async function saveSiteContent(
  content: SiteContent,
  savedBy?: string,
): Promise<SiteSettingsRecord> {
  await assertWritableSession()

  const payload = { data: content, saved_by: savedBy || '' }
  const listRecords = () => pb.collection('site_settings').getList<SiteSettingsRecord>(1, 1, {})

  const rows = await listRecords().catch((err) => {
    throw explainSaveError(err)
  })
  if (rows.items.length > 0) {
    try {
      return await pb
        .collection('site_settings')
        .update<SiteSettingsRecord>(rows.items[0].id, payload)
    } catch (err: any) {
      if (err?.status !== 404) throw explainSaveError(err)
      // PATCH 404 é AMBÍGUO: o registro pode ter sumido de verdade OU a regra
      // de update negou (o PocketBase mascara negação de rule como 404 —
      // típico de token de sessão morto). Reconsulta para decidir em vez de
      // criar às cegas, o que devolvia 400 "Failed to create record" e o
      // toast genérico que o usuário via.
      const again = await listRecords().catch(() => null)
      if (again && again.items.length > 0) {
        if (again.items[0].id !== rows.items[0].id) {
          // Outro registro apareceu (ambiente recriado): atualiza esse.
          try {
            return await pb
              .collection('site_settings')
              .update<SiteSettingsRecord>(again.items[0].id, payload)
          } catch (e2) {
            throw explainSaveError(e2)
          }
        }
        // Registro ainda existe → o 404 foi a REGRA negando. Erro claro.
        throw explainSaveError(err)
      }
      // Registro realmente sumiu → cai no create abaixo.
    }
  }
  try {
    return await pb.collection('site_settings').create<SiteSettingsRecord>(payload)
  } catch (err: any) {
    // Create falhou: pode ser outro admin criando o registro nesse intervalo.
    // Última tentativa: reconsulta e atualiza o que existir.
    const again = await listRecords().catch(() => null)
    if (again && again.items.length > 0) {
      try {
        return await pb
          .collection('site_settings')
          .update<SiteSettingsRecord>(again.items[0].id, payload)
      } catch (e2) {
        throw explainSaveError(e2)
      }
    }
    throw explainSaveError(err)
  }
}

/**
 * Hook da home pública: carrega o conteúdo uma vez e assina o realtime —
 * quando o admin salva no painel, a home aberta atualiza na hora.
 */
export function useSiteContent(): SiteContent {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT)

  const refresh = useCallback(async () => {
    setContent(await loadSiteContent())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Única forma permitida de assinar realtime no projeto.
  useRealtime<SiteSettingsRecord>('site_settings', () => {
    refresh()
  })

  return content
}

/**
 * Hook do PAINEL (/painel/site): o editor precisa distinguir "campo deixado
 * vazio" de "default" — o painel abre com o JSON BRUTO salvo (caindo nos
 * defaults só onde o registro nem existe ainda), e o save é o upsert com
 * retry: se o registro sumiu entre o load e o clique em Salvar (ou o id
 * em cache ficou velho), reconsulta e reenvia em vez de falhar com 404.
 */
export function useRawSiteContent(): {
  raw: Partial<SiteContent> | null
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const [raw, setRaw] = useState<Partial<SiteContent> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setRaw(await loadRawSiteData())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRealtime<SiteSettingsRecord>('site_settings', () => {
    refresh()
  })

  return { raw, isLoading, refresh }
}
