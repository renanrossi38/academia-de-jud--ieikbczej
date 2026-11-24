import pb from '@/lib/pocketbase/client'

/**
 * Comprovante de pagamento de mensalidade — dados vindos do hook
 * GET /backend/v1/fee-receipt/{id} (fee_receipt.js).
 *
 * A rota exige login e só responde para o DONO do registro (students.user)
 * ou para admin. Mensalidade sem pagamento registrado (status != pago ou sem
 * paid_at) responde 404 — não há comprovante sem pagamento.
 */

export interface FeeReceipt {
  id: string
  student_id: string
  student_name: string
  reference_month: string // "2026-11"
  amount: number
  paid_at: string // "YYYY-MM-DD HH:mm:ss.SSSZ"
  payment_method: string // pix | dinheiro | cartao | ''
  due_date: string
  notes: string
  updated: string
}

export class FeeReceiptUnavailableError extends Error {}

/** Busca os dados do comprovante de uma mensalidade paga. */
export async function fetchFeeReceipt(feeId: string): Promise<FeeReceipt> {
  try {
    const res = await pb.send<{ receipt: FeeReceipt }>(`/backend/v1/fee-receipt/${feeId}`, {})
    return res.receipt
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 0
    const message =
      err?.response?.message ||
      err?.message ||
      'Não foi possível carregar o comprovante no servidor.'
    if (status === 404) {
      throw new FeeReceiptUnavailableError(
        message || 'Comprovante não encontrado ou pagamento ainda não registrado.',
      )
    }
    throw new FeeReceiptUnavailableError(message)
  }
}

/** Data/hora no fuso de Brasília (UTC-3 o ano todo), ex.: "25/11/2026 às 14:32". */
export function receiptDateTimeBrasilia(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const b = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const dia = String(b.getUTCDate()).padStart(2, '0')
  const mes = String(b.getUTCMonth() + 1).padStart(2, '0')
  const ano = b.getUTCFullYear()
  const hora = String(b.getUTCHours()).padStart(2, '0')
  const min = String(b.getUTCMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} às ${hora}:${min}`
}

/** Data no fuso de Brasília, ex.: "25/11/2026". */
export function receiptDateBrasilia(iso: string): string {
  return receiptDateTimeBrasilia(iso).split(' às ')[0] || '—'
}
