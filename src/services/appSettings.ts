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

const KEY_SUBJECT = 'fee_overdue_subject'
const KEY_TEMPLATE = 'fee_overdue_template'

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
}
