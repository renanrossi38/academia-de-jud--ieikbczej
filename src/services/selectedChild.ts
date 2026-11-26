/**
 * Chave do localStorage que guarda qual dependente o responsável escolheu ver
 * na /area-do-aluno (contas com mais de um filho vinculado). Fica em um
 * módulo próprio para o seletor e a página compartilharem sem ciclos.
 */
export const selectedChildKey = 'judo-tatsu:selected-child'
export const setSelectedChildKey = (id: string) => {
  try {
    localStorage.setItem(selectedChildKey, id)
  } catch {
    /* localStorage indisponível (modo privado): escolha vale só nesta sessão */
  }
}
