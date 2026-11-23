import pb from '@/lib/pocketbase/client'
import { Belt } from '@/types'
import { BELT_ORDER } from '@/services/beltPromotions'

/**
 * Ordem EDITÁVEL das faixas do judô (da menor para a maior).
 *
 * A ordem padrão é a do judô (BELT_ORDER em beltPromotions.ts) e o admin pode
 * reordená-la na aba "Faixas" da ficha do aluno. A ordem escolhida é
 * persistida na collection `app_settings` (key = "belt_order", value = JSON
 * array com os valores das faixas) e passa a valer em todo o sistema: select
 * de faixa (cadastro/edição), diálogo "Promover faixa", aba Faixas, ranking.
 *
 * IMPORTANTE: a faixa ATUAL do aluno continua derivada da última promoção
 * (currentBeltFrom) — reordenar as faixas NÃO muda a faixa de ninguém, só a
 * ordem em que as opções aparecem.
 */

const KEY_BELT_ORDER = 'belt_order'

/** Valores válidos (evita lixo/injeção de valores fora do select das faixas). */
function isValidBeltOrder(value: unknown): value is Belt[] {
  return (
    Array.isArray(value) &&
    value.length === BELT_ORDER.length &&
    value.every((b) => typeof b === 'string' && BELT_ORDER.includes(b as Belt)) &&
    new Set(value).size === value.length
  )
}

/** Ordem corrente (customizada, se salva; senão a ordem padrão do judô). */
export async function loadBeltOrder(): Promise<Belt[]> {
  try {
    const records = await pb
      .collection('app_settings')
      .getFullList<{ key: string; value: string }>({
        filter: `key = "${KEY_BELT_ORDER}"`,
      })
    const raw = records[0]?.value
    if (!raw) return [...BELT_ORDER]
    const parsed: unknown = JSON.parse(raw)
    return isValidBeltOrder(parsed) ? (parsed as Belt[]) : [...BELT_ORDER]
  } catch {
    // Sem permissão/erro de rede: cai no padrão em vez de quebrar a tela.
    return [...BELT_ORDER]
  }
}

/** Salva a ordem escolhida pelo admin (upsert por chave, padrão do projeto). */
export async function saveBeltOrder(order: Belt[]): Promise<void> {
  if (!isValidBeltOrder(order)) {
    throw new Error('Ordem de faixas inválida (precisa conter as 9 faixas, sem repetição).')
  }
  const value = JSON.stringify(order)
  const existing = await pb
    .collection('app_settings')
    .getList<{ key: string; value: string }>(1, 1, { filter: `key = "${KEY_BELT_ORDER}"` })
  if (existing.items.length > 0) {
    await pb.collection('app_settings').update(existing.items[0].id, { value })
  } else {
    await pb.collection('app_settings').create({ key: KEY_BELT_ORDER, value })
  }
}

/** Restaura a ordem padrão do judô (remove a customização salva). */
export async function resetBeltOrder(): Promise<void> {
  const existing = await pb
    .collection('app_settings')
    .getList<{ key: string; value: string }>(1, 1, { filter: `key = "${KEY_BELT_ORDER}"` })
  if (existing.items.length > 0) {
    await pb.collection('app_settings').delete(existing.items[0].id)
  }
}
