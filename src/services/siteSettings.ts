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

/** Salva o conteúdo no registro único (upsert) — só admin pelas rules. */
export async function saveSiteContent(
  content: SiteContent,
  savedBy?: string,
): Promise<SiteSettingsRecord> {
  const rows = await pb.collection('site_settings').getList<SiteSettingsRecord>(1, 1, {})
  if (rows.items.length > 0) {
    return pb
      .collection('site_settings')
      .update<SiteSettingsRecord>(rows.items[0].id, { data: content, saved_by: savedBy || '' })
  }
  return pb
    .collection('site_settings')
    .create<SiteSettingsRecord>({ data: content, saved_by: savedBy || '' })
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
