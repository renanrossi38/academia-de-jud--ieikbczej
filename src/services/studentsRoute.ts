import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import type { Student } from '@/types'
import type { CreateStudentInput } from '@/services/students'
import {
  extractServerError,
  isSessionError,
  serverErrorMessage,
  validateStudentInput,
  isValidBelt,
  type FieldErrorsMap,
} from '@/services/studentsErrors'

export { extractServerError, isSessionError, serverErrorMessage, validateStudentInput, isValidBelt }
export type { FieldErrorsMap }

/**
 * Criação de aluno pela ROTA PRÓPRIA do servidor (/backend/v1/students/create).
 *
 * Por quê: o POST padrão /api/collections/students/records recusava o cadastro
 * do dono com 400 genérico "Failed to create record." em <1ms, sem fieldErrors
 * e sem passar pelo hook students_sanitize — assinatura de falha de API rule
 * (sessão fantasma: token morto no servidor). A rota valida o admin
 * explicitamente e devolve sempre erros reais por campo em português.
 */
export async function createStudentViaRoute(input: CreateStudentInput): Promise<Student> {
  const payload: Record<string, string> = { name: (input.name || '').trim() }
  const optional: Record<string, string | undefined> = {
    email: input.email?.trim().toLowerCase(),
    phone: input.phone?.trim(),
    belt: input.belt ? String(input.belt) : undefined,
    address: input.address?.trim(),
    birth_date: input.birth_date?.trim(),
    guardian_name: input.guardian_name?.trim(),
    guardian_phone: input.guardian_phone?.trim(),
    guardian_email: input.guardian_email?.trim().toLowerCase(),
  }
  for (const [field, value] of Object.entries(optional)) {
    if (value) payload[field] = value
  }

  try {
    const result = await pb.send<{ student: Student }>('/backend/v1/students/create', {
      method: 'POST',
      body: payload,
    })
    return result.student
  } catch (error) {
    if (isSessionError(error)) {
      // Sessão fantasma: limpa o authStore local — o painel cai na tela de
      // login em vez de deixar o dono num admin que não salva nada.
      pb.authStore.clear()
    }
    throw error
  }
}
