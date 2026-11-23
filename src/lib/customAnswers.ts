/**
 * Formata as respostas sob medida de um item de pedido para exibição:
 * { Peso: "78", Cor: "Branco" } → "Peso: 78 · Cor: Branco".
 * Vazio quando não há respostas (produto comum).
 */
export const formatCustomAnswers = (answers?: Record<string, string> | null): string =>
  answers && typeof answers === 'object'
    ? Object.entries(answers)
        .filter(([k, v]) => k.trim() !== '' && String(v).trim() !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ')
    : ''
