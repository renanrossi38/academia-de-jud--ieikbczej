import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

/** Mínimo exigido pelo PocketBase para a coleção users (8 caracteres). */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Altera a senha do usuário logado:
 * 1. re-autentica com a senha atual (prova de posse);
 * 2. atualiza o registro com a nova senha;
 * 3. re-autentica com a nova senha, porque o PocketBase invalida o token
 *    antigo ao trocar a senha — assim o aluno não é deslogado.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const email = pb.authStore.record?.email
  if (!email) {
    throw new Error('Sessão expirada. Faça login novamente para alterar sua senha.')
  }

  // Confere a senha atual sem derrubar a sessão válida
  const ok = await pb
    .collection('users')
    .authWithPassword(email, currentPassword)
    .then(() => true)
    .catch(() => {
      throw new Error('A senha atual está incorreta. Verifique e tente novamente.')
    })

  if (!ok) return

  try {
    await pb.collection('users').update(pb.authStore.record!.id, {
      password: newPassword,
      passwordConfirm: newPassword,
      oldPassword: currentPassword,
    })
  } catch (err) {
    throw new Error(friendlyPasswordError(err))
  }

  // O token antigo foi invalidado: re-loga em silêncio com a nova senha
  await pb
    .collection('users')
    .authWithPassword(email, newPassword)
    .catch(() => {
      // Sessão renovada ou não, o toast de sucesso já apareceu; se falhar,
      // o aluno apenas fará login manual com a nova senha.
    })
}

/** Traduz erros do PocketBase para mensagens claras em português. */
export function friendlyPasswordError(err: unknown): string {
  if (typeof err === 'string') return err

  const fieldErrors = extractFieldErrors(err)
  const raw = getErrorMessage(err).toLowerCase()

  if (
    fieldErrors.oldPassword ||
    raw.includes('oldpassword') ||
    raw.includes('old password') ||
    raw.includes('invalid login credentials') ||
    raw.includes('authentication failed')
  ) {
    return 'A senha atual está incorreta. Verifique e tente novamente.'
  }
  if (raw.includes('validation_min_text_constraint') || raw.includes('must be at least')) {
    return `A nova senha é curta demais: use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (raw.includes('cannot be blank') || raw.includes('validation_required')) {
    return 'Preencha todos os campos para alterar a senha.'
  }
  if (raw.includes('failed to update record') || raw.includes('failed to create record')) {
    return 'O servidor rejeitou a alteração. Verifique os dados e tente novamente.'
  }
  const msg = getErrorMessage(err)
  return !msg || msg.startsWith('An unexpected error')
    ? 'Não foi possível alterar a senha. Tente novamente mais tarde.'
    : msg
}
