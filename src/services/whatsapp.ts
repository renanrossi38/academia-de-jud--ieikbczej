/** Template padrão da mensagem de WhatsApp de cobrança (mesmas variáveis do e-mail). */
export const DEFAULT_FEE_WHATSAPP_TEMPLATE =
  '{saudacao}, {aluno}!\n\n' +
  'Passando para lembrar que a mensalidade de {mes} da academia Judô Tatsu ' +
  'está pendente de pagamento. 🥋\n\n' +
  'Se você já pagou, desconsidere esta mensagem — pode ter sido só o ' +
  'lançamento que ainda não chegou ao sistema.\n\n' +
  'Qualquer dúvida, é só responder aqui.\n\n' +
  'Atenciosamente,\nEquipe Tatsu'

/**
 * Saudação ("Bom dia"/"Boa tarde"/"Boa noite") pelo horário de BRASÍLIA
 * (UTC-3 o ano todo, sem horário de verão) — MESMA regra do hook de e-mail
 * (fee_overdue_notice.js). O relógio do servidor/dispositivo nunca decide.
 */
export function saudacaoBrasilia(now: Date = new Date()): string {
  const h = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "2026-11" → "novembro de 2026" (o rótulo de {mes} nas mensagens). */
export function nomeMes(mesChave: string): string {
  const chave = (mesChave || '').trim()
  const [y, m] = chave.split('-').map(Number)
  if (!y || !m) return chave
  const nomes = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  return `${nomes[m - 1]} de ${y}`
}

/**
 * Substitui as variáveis do template de cobrança:
 *  - {saudacao}: "Bom dia"/"Boa tarde"/"Boa noite" por Brasília;
 *  - {aluno}: nome do aluno;
 *  - {mes}: mês de referência por extenso — o painel decide se é o mês
 *    corrente (regra do dia 15) ou o da pendência vencida; um mês JÁ PAGO
 *    nunca é passado aqui (mesma garantia do hook, v0.0.42).
 */
export function aplicarPlaceholders(
  template: string,
  nomeAluno: string,
  mesCobranca: string,
  now: Date = new Date(),
): string {
  return template
    .split('{saudacao}')
    .join(saudacaoBrasilia(now))
    .split('{aluno}')
    .join(nomeAluno?.trim() || 'aluno(a)')
    .split('{mes}')
    .join(nomeMes(mesCobranca))
}

/**
 * Normaliza o número para a URL do wa.me: só dígitos, com o código do Brasil
 * (55) quando faltar. Ex.: "(11) 91234-5678" → "5511912345678".
 * Sem dígitos suficientes (DDD + número, ≥10) devolve "" — o chamador mostra
 * aviso de número inválido e NÃO abre a conversa.
 */
export function normalizarTelefone(telefone: string): string {
  const digitos = String(telefone || '').replace(/\D+/g, '')
  if (digitos.length < 10 || digitos.length > 13) return ''
  if (digitos.startsWith('55')) return digitos
  return `55${digitos}`
}

/** Dia de hoje em Brasília ("YYYY-MM-DD"), MESMA fórmula do monthlyFees. */
function brasiliaDayKey(now: Date = new Date()): string {
  const b = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}-${String(
    b.getUTCDate(),
  ).padStart(2, '0')}`
}

/** Mês de referência de hoje em Brasília ("YYYY-MM"). */
function brasiliaMonthKey(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Mês que a cobrança cita: o da pendência vencida (referência anterior ao mês
 * corrente, ou mês corrente com vencimento já passado) — um mês JÁ PAGO nunca
 * é citado (mesma garantia do hook, v0.0.42). Sem pendência vencida, devolve
 * o mês corrente quando `dia15SemMesCorrentePago` é true (regra do dia 15, a
 * MESMA do hook de e-mail: ativo, depois do dia 15, sem o mês corrente pago)
 * e "" caso contrário.
 */
export function mesCobrancaDeAluno(
  fees: Array<{ reference_month: string; status: string; due_date?: string }>,
  paidMonths: string[] | undefined,
  dia15SemMesCorrentePago: boolean,
  now: Date = new Date(),
): string {
  const hoje = brasiliaDayKey(now)
  const mesAtual = brasiliaMonthKey()
  const pagos = new Set(paidMonths || [])
  // Pendência vencida: mês MAIS RECENTE em atraso, nunca um mês já pago.
  const vencidas = fees
    .filter((f) => {
      if (f.status !== 'pendente') return false
      const dueDay = String(f.due_date || '')
        .split(' ')[0]
        .split('T')[0]
      const vencida =
        f.reference_month < mesAtual ||
        (dueDay && /^\d{4}-\d{2}-\d{2}$/.test(dueDay) && dueDay < hoje)
      return vencida && !pagos.has(f.reference_month)
    })
    .map((f) => f.reference_month)
    .sort()
  if (vencidas.length > 0) return vencidas[vencidas.length - 1]
  // Regra do dia 15: sem pendência vencida, {mes} = mês corrente quando quem
  // chama já julgou o aluno inadimplente por essa regra (ativo sem o mês
  // corrente pago, depois do dia 15).
  return dia15SemMesCorrentePago ? mesAtual : ''
}

/**
 * URL do wa.me para a conversa com a mensagem já preenchida — aberta em nova
 * aba, o usuário REVISÃO e envia (o app nunca envia sozinho por aqui).
 */
export function waMeUrl(numeroNormalizado: string, texto: string): string {
  return `https://wa.me/${numeroNormalizado}?text=${encodeURIComponent(texto)}`
}
