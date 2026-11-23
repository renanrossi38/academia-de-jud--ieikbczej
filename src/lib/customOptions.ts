import { CustomField, CustomFieldOption } from '@/types'

/**
 * Utilidades para os campos personalizados de um produto sob medida
 * (products.custom_options), incluindo os acréscimos de preço por opção
 * de um campo "escolha" (price_delta).
 *
 * Formato retrocompatível: options aceita string simples (legado, sem delta)
 * ou { label, price_delta? }.
 */

/** Normaliza uma lista de opções para o formato objeto. */
export const toFieldOptions = (
  options?: (string | CustomFieldOption)[] | null,
): CustomFieldOption[] =>
  (options ?? [])
    .map((opt) => (typeof opt === 'string' ? { label: opt } : opt))
    .filter((opt) => opt && typeof opt.label === 'string' && opt.label.trim() !== '')

/** Rótulo de uma opção, aceitando formato legado (string) ou objeto. */
export const customOptionLabel = (opt: string | CustomFieldOption): string =>
  typeof opt === 'string' ? opt : (opt?.label ?? '')

/** Acréscimo de preço (R$) de uma opção; 0 quando ausente/inválido. */
export const customOptionDelta = (opt: string | CustomFieldOption | undefined): number => {
  if (!opt || typeof opt === 'string') return 0
  const d = Number(opt.price_delta)
  return Number.isFinite(d) ? d : 0
}

/**
 * Soma dos price_delta das opções escolhidas pelo comprador.
 * answers = { "Modelo": "Trançado especial", ... }; campos que não são
 * "escolha" não têm delta e são ignorados.
 */
export const customAnswersDelta = (
  fields: CustomField[] | null | undefined,
  answers: Record<string, string> | null | undefined,
): number => {
  if (!fields?.length || !answers) return 0
  let sum = 0
  for (const field of fields) {
    if (field.type !== 'escolha') continue
    const chosen = (answers[field.name] || '').trim()
    if (!chosen) continue
    const opt = toFieldOptions(field.options).find((o) => o.label === chosen)
    sum += customOptionDelta(opt)
  }
  return sum
}

/** Preço final = base + delta da variação (tamanho) + deltas das opções escolhidas. */
export const computedUnitPrice = (
  basePrice: number,
  variationDelta: number,
  answersDelta: number,
): number => Math.max(0, (basePrice || 0) + (variationDelta || 0) + (answersDelta || 0))
