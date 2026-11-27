import { ClientResponseError } from 'pocketbase'
import { BELT_ORDER } from '@/services/beltPromotions'
import { guardianPhoneError } from '@/services/students'

export type FieldErrorsMap = Record<string, string>

export function isValidBelt(value: string): boolean {
  return (BELT_ORDER as readonly string[]).includes(value)
}

/** Erros por campo vindos da rota (formato PocketBase { campo: { message } }). */
export function extractServerError(error: unknown): FieldErrorsMap {
  if (error instanceof ClientResponseError) {
    const data = error.response?.data as FieldErrorsMap | undefined
    if (data && typeof data === 'object') return data
  }
  return {}
}

/** Mensagem geral da rota (message já vem em português do servidor). */
export function serverErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message as string | undefined
    if (message) return message
    const parts = Object.values(extractServerError(error))
    if (parts.length > 0) return parts.join(' ')
    if (error.status === 401) return 'Sua sessão expirou, entre novamente.'
  }
  return error instanceof Error
    ? error.message
    : 'Não foi possível salvar o aluno. Tente novamente.'
}

/** Verdadeiro quando a sessão do admin morreu no servidor (sessão fantasma):
 * 401 da rota ou 404 ao ler registros com o token (padrão já visto aqui). */
export function isSessionError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  return error.status === 401 || error.status === 404
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validação local espelhando a da rota — evita ida e volta para erros simples. */
export function validateStudentInput(input: {
  name?: string
  email?: string
  phone?: string
  belt?: string
  birth_date?: string
  guardian_email?: string
  guardian_phone?: string
}): FieldErrorsMap {
  const errors: FieldErrorsMap = {}
  if (!(input.name || '').trim()) errors.name = 'Informe o nome do aluno.'

  const email = (input.email || '').trim().toLowerCase()
  if (email && !EMAIL_RE.test(email)) {
    errors.email = 'Informe um e-mail válido — ex.: aluno@email.com.'
  }

  const phone = (input.phone || '').trim()
  const phoneErr = phone ? guardianPhoneError(phone) : null
  if (phoneErr) errors.phone = phoneErr

  const guardianPhone = (input.guardian_phone || '').trim()
  const gPhoneErr = guardianPhone ? guardianPhoneError(guardianPhone) : null
  if (gPhoneErr) errors.guardian_phone = gPhoneErr

  const belt = (input.belt || '').trim()
  if (belt && !isValidBelt(belt)) {
    errors.belt = 'A faixa informada não é aceita — selecione novamente na lista e tente salvar.'
  }

  const birthDate = (input.birth_date || '').trim()
  if (birthDate && Number.isNaN(new Date(birthDate).getTime())) {
    errors.birth_date = 'Informe uma data de nascimento válida.'
  }

  const guardianEmail = (input.guardian_email || '').trim().toLowerCase()
  if (guardianEmail && !EMAIL_RE.test(guardianEmail)) {
    errors.guardian_email = 'Informe um e-mail válido para o responsável.'
  }

  return errors
}
