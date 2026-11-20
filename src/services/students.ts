import pb from '@/lib/pocketbase/client'
import { Belt, Student, User } from '@/types'

export interface CreateStudentInput {
  name: string
  email?: string
  phone?: string
  belt?: Belt
  address?: string
  birth_date?: string
}

export interface UpdateStudentInput {
  name?: string
  email?: string
  phone?: string
  belt?: Belt | ''
  active?: boolean
  address?: string
  birth_date?: string
}

// Senha inicial gerada para o aluno (exibida uma única vez)
export function generateInitialPassword(): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const all = lower + upper + digits + symbols

  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]

  let password =
    pick(lower) +
    pick(upper) +
    pick(digits) +
    pick(symbols) +
    pick(upper) +
    pick(lower) +
    pick(digits) +
    pick(symbols)

  // Embaralha para não deixar o padrão fixo nos 4 primeiros caracteres
  password = password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')

  return password
}

export const studentsService = {
  /** Todos os alunos cadastrados (com ou sem conta de acesso). */
  async listStudents(): Promise<Student[]> {
    return pb.collection('students').getFullList<Student>({ sort: '-created' })
  },

  /** Aluno vinculado a uma conta de acesso (ou null, ex.: contas de admin). */
  async getByUser(userId: string): Promise<Student | null> {
    const res = await pb
      .collection('students')
      .getList<Student>(1, 1, { filter: `user = "${userId}"` })
    return res.items[0] ?? null
  },

  async createStudent(input: CreateStudentInput): Promise<Student> {
    return pb.collection('students').create<Student>({
      name: input.name.trim(),
      email: input.email?.trim() || '',
      phone: input.phone?.trim() || '',
      belt: input.belt || '',
      address: input.address?.trim() || '',
      birth_date: input.birth_date?.trim() || '',
      active: true,
    })
  },

  /** Exclui o aluno de vez (as presenças dele saem junto, por cascata). */
  async deleteStudent(id: string): Promise<void> {
    await pb.collection('students').delete(id)
  },

  async updateStudent(id: string, input: UpdateStudentInput): Promise<Student> {
    const payload = { ...input }
    if (typeof payload.name === 'string') payload.name = payload.name.trim()
    if (typeof payload.email === 'string') payload.email = payload.email.trim()
    if (typeof payload.phone === 'string') payload.phone = payload.phone.trim()
    return pb.collection('students').update<Student>(id, payload)
  },

  /**
   * Gera a conta de acesso ao site de um aluno que tem e-mail: cria o usuário
   * (role 'aluno') com senha inicial e vincula student.user a ele.
   */
  async createAccess(student: Student): Promise<{ account: User; initialPassword: string }> {
    if (!student.email) {
      throw new Error('O aluno precisa de um e-mail para ganhar acesso ao site.')
    }
    if (student.user) {
      throw new Error('Este aluno já possui acesso ao site.')
    }

    const initialPassword = generateInitialPassword()
    const account = await pb.collection('users').create<User>({
      email: student.email.trim(),
      password: initialPassword,
      passwordConfirm: initialPassword,
      name: student.name,
      phone: student.phone || '',
      belt: student.belt || '',
      role: 'aluno',
      active: true,
      verified: true,
    })

    try {
      await pb.collection('students').update(student.id, { user: account.id })
    } catch (err) {
      // Não deixa uma conta órfã se o vínculo falhar
      await pb
        .collection('users')
        .delete(account.id)
        .catch(() => {})
      throw err
    }

    return { account, initialPassword }
  },
}
