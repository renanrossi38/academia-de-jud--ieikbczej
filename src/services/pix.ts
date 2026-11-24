import pb from '@/lib/pocketbase/client'

/**
 * Pix "copia e cola" (BR Code EMV) — o payload é gerado NO BACKEND
 * (pocketbase/hooks/pix_payload.js), a partir da chave Pix cadastrada pelo
 * admin em app_settings (chaves pix_key / pix_receiver_name). O front só
 * desenha o QR (biblioteca `qrcode`, sem serviço externo de imagem) e oferece
 * o copia-e-cola. A confirmação é MANUAL: o aluno paga no app do banco (Nubank
 * incluído) e a academia dá baixa no painel.
 */

export type PixKind = 'mensalidade' | 'pedido'

export interface PixPayloadResponse {
  qrAvailable: boolean
  payload?: string
  value?: number
  txid?: string
  description?: string
  receiverName?: string
  message?: string
}

/**
 * Pede ao backend o payload Pix do que está sendo pago.
 * Retorna `null` quando o Pix não está configurado (ou o item não é cobrável) —
 * nesse caso `message` traz o aviso amigável para exibir.
 */
export async function fetchPixPayload(
  kind: PixKind,
  id: string,
): Promise<{ payload: string; value: number; txid: string; description: string } | null> {
  const res = await pb.send<PixPayloadResponse>('/backend/v1/pix-payload', {
    method: 'POST',
    body: { kind, id },
  })
  if (!res?.qrAvailable || !res.payload) {
    throw new PixUnavailableError(res?.message || 'O Pix não está disponível para este item.')
  }
  return {
    payload: res.payload,
    value: res.value ?? 0,
    txid: res.txid || '',
    description: res.description || '',
  }
}

/** O backend respondeu que o Pix não está configurado (ou o item já foi pago). */
export class PixUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PixUnavailableError'
  }
}

/**
 * Pares de chaves de app_settings que o hook pix_payload.js consome no
 * servidor, por tipo de cobrança (mensalidade usa a chave de antes da
 * separação — quem já tinha cadastrado não precisa recadastrar).
 */
export const PIX_SETTINGS_KEYS = {
  mensalidade: {
    key: 'pix_key',
    receiverName: 'pix_receiver_name',
  },
  pedido: {
    key: 'pix_key_produtos',
    receiverName: 'pix_receiver_name_produtos',
  },
} as const
