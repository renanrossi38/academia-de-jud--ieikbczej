import pb from '@/lib/pocketbase/client'
import type { Student } from '@/types'
import type { User } from '@/types'
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

/** Conta users existente para um e-mail (via rota própria lookup-user).
 *  found=false → pode criar conta nova; found=true → vinculável. */
export interface LookupUserResult {
  found: boolean
  account?: { id: string; name: string; email: string; role: string; is_owner: boolean }
  linkedStudents?: { id: string; name: string }[]
}

/** Consulta se o e-mail já tem conta no site (rota /backend/v1/students/
 * lookup-user, validação de admin igual às demais). */
export async function lookupUserByEmail(email: string): Promise<LookupUserResult> {
  const target = email.trim().toLowerCase()
  if (!target) return { found: false }
  try {
    return await pb.send<LookupUserResult>(
      '/backend/v1/students/lookup-user?email=' + encodeURIComponent(target),
      { method: 'GET' },
    )
  } catch (error) {
    if (isSessionError(error)) {
      pb.authStore.clear()
    }
    throw error
  }
}

/** Vincula a ficha do aluno a uma conta users existente via ROTA PRÓPRIA
 *  (/backend/v1/students/link) — o update direto em students recusava pelo
 *  mesmo motivo de create/list/delete (falha de API rule com o registro lá). */
export async function linkStudentViaRoute(studentId: string, email: string): Promise<User> {
  try {
    const res = await pb.send<{ student: { id: string; name: string; user: string } }>(
      '/backend/v1/students/link',
      { method: 'POST', body: { student_id: studentId, email: email.trim().toLowerCase() } },
    )
    // O front espera uma User — monta a partir da resposta da rota + lookup.
    const lk = await lookupUserByEmail(email)
    return {
      id: res.student.user,
      email: email.trim().toLowerCase(),
      name: lk.account?.name || '',
      role: lk.account?.role || 'aluno',
      is_owner: lk.account?.is_owner || false,
    } as User
  } catch (error) {
    if (isSessionError(error)) {
      pb.authStore.clear()
    }
    throw error
  }
}

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
