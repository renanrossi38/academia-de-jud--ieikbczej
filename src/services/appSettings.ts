import pb from '@/lib/pocketbase/client'

/** Registro da collection app_settings (chave/valor de configuração do negócio). */
export type AppSetting = {
  id: string
  key: string
  value: string
  created: string
  updated: string
}

/** Template editável do e-mail de mensalidade em atraso (Judô Tatsu). */
export type FeeOverdueTemplate = {
  subject: string
  body: string
}

/** Fallback: o texto original da v0.0.33, também semeado pela migration 0019. */
export const DEFAULT_FEE_OVERDUE_TEMPLATE: FeeOverdueTemplate = {
  subject: 'Aviso de mensalidade em atraso - Judô Tatsu',
  body:
    '{saudacao}, {aluno},\n\n' +
    'verificamos que o pagamento e a mensalidade do mês de {mes} não foi ' +
    'localizada em nosso sistema. Caso o mesmo tenha sido realizado, favor ' +
    'entrar em contato, enviando o comprovante de pagamento para que possamos ' +
    'dar baixa.\n\n' +
    'Atenciosamente: Equipe Tatsu',
}

/** Template editável da mensagem de WhatsApp de cobrança (mesmas variáveis). */
export const DEFAULT_FEE_WHATSAPP_TEMPLATE =
  '{saudacao}, {aluno}!\n\nPassando para lembrar que a mensalidade de {mes} da academia Judô Tatsu está pendente de pagamento. 🥋\n\nSe você já pagou, desconsidere esta mensagem — pode ter sido só o lançamento que ainda não chegou ao sistema.\n\nQualquer dúvida, é só responder aqui.\n\nAtenciosamente,\nEquipe Tatsu'

const KEY_SUBJECT = 'fee_overdue_subject'
const KEY_TEMPLATE = 'fee_overdue_template'
const KEY_WHATSAPP_TEMPLATE = 'fee_whatsapp_template'

/** Os dois templates de cobrança numa leitura só (usado pela ficha do aluno). */
export type FeeTemplates = {
  email: FeeOverdueTemplate
  whatsappTemplate: string
}

/**
 * Preenche as variáveis do template de cobrança com o nome do aluno, o mês
 * ({mes} JÁ por extenso — "novembro de 2026") e a saudação de Brasília
 * (UTC-3 o ano todo, MESMA regra do hook fee_overdue_notice.js).
 */
export function renderFeeMessage(
  template: string,
  nomeAluno: string,
  mesPorExtenso: string,
  now: Date = new Date(),
): string {
  const h = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCHours()
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return template
    .split('{saudacao}')
    .join(saudacao)
    .split('{aluno}')
    .join(nomeAluno?.trim() || 'aluno(a)')
    .split('{mes}')
    .join(mesPorExtenso)
}

export const appSettingsService = {
  /** Lê o template do e-mail de atraso (com fallback para o texto original). */
  async getFeeOverdueTemplate(): Promise<FeeOverdueTemplate> {
    const records = await pb
      .collection('app_settings')
      .getFullList<AppSetting>({ filter: `key ~ "fee_overdue_"` })
    const map: Record<string, string> = {}
    for (const r of records) map[r.key] = r.value
    return {
      subject: map[KEY_SUBJECT]?.trim() || DEFAULT_FEE_OVERDUE_TEMPLATE.subject,
      body: map[KEY_TEMPLATE]?.trim() || DEFAULT_FEE_OVERDUE_TEMPLATE.body,
    }
  },

  /** Salva o assunto e o corpo do e-mail de atraso (upsert por chave). */
  async saveFeeOverdueTemplate(tpl: FeeOverdueTemplate): Promise<void> {
    const entries: Array<{ key: string; value: string }> = [
      { key: KEY_SUBJECT, value: tpl.subject },
      { key: KEY_TEMPLATE, value: tpl.body },
    ]
    for (const entry of entries) {
      const existing = await pb.collection('app_settings').getList<AppSetting>(1, 1, {
        filter: `key = "${entry.key}"`,
      })
      if (existing.items.length > 0) {
        await pb.collection('app_settings').update(existing.items[0].id, { value: entry.value })
      } else {
        await pb.collection('app_settings').create({ key: entry.key, value: entry.value })
      }
    }
  },

  /** Lê o template da mensagem de WhatsApp de cobrança (fallback = padrão). */
  async getFeeWhatsappTemplate(): Promise<string> {
    const records = await pb
      .collection('app_settings')
      .getFullList<AppSetting>({ filter: `key = "${KEY_WHATSAPP_TEMPLATE}"` })
    return records[0]?.value?.trim() || DEFAULT_FEE_WHATSAPP_TEMPLATE
  },

  /** Salva o template da mensagem de WhatsApp de cobrança (upsert por chave). */
  async saveFeeWhatsappTemplate(value: string): Promise<void> {
    const existing = await pb.collection('app_settings').getList<AppSetting>(1, 1, {
      filter: `key = "${KEY_WHATSAPP_TEMPLATE}"`,
    })
    if (existing.items.length > 0) {
      await pb.collection('app_settings').update(existing.items[0].id, { value })
    } else {
      await pb.collection('app_settings').create({ key: KEY_WHATSAPP_TEMPLATE, value })
    }
  },

  /**
   * Lê os DOIS templates de cobrança numa leitura só (e-mail + WhatsApp, com
   * os respectivos fallbacks) — o painel de Alunos usa para montar a mensagem
   * pronta do wa.me sem duas idas ao servidor.
   */
  async getFeeTemplates(): Promise<FeeTemplates> {
    const [email, whatsappTemplate] = await Promise.all([
      this.getFeeOverdueTemplate(),
      this.getFeeWhatsappTemplate(),
    ])
    return { email, whatsappTemplate }
  },

  /**
   * Preenche as variáveis de um template de cobrança ({saudacao} por horário
   * de Brasília, {aluno}, {mes} já por extenso) — a MESMA renderização do
   * e-mail e da mensagem de WhatsApp, usada no painel e nas pré-visualizações.
   */
  renderFeeMessage(
    template: string,
    nomeAluno: string,
    mesPorExtenso: string,
    now: Date = new Date(),
  ): string {
    return renderFeeMessage(template, nomeAluno, mesPorExtenso, now)
  },
}
