import pb from '@/lib/pocketbase/client'
import { Belt, User } from '@/types'

export interface CreateStudentInput {
  name: string
  email: string
  phone?: string
  belt?: Belt
}

export interface UpdateStudentInput {
  name?: string
  phone?: string
  belt?: Belt
  active?: boolean
}

// Senha inicial gerada para o aluno criado pelo admin (exibida uma única vez)
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
  async listStudents(): Promise<User[]> {
    const students = await pb.collection('users').getFullList<User>({
      filter: `role = "aluno"`,
      sort: '-created',
    })
    return students
  },

  async createStudent(
    input: CreateStudentInput,
  ): Promise<{ student: User; initialPassword: string }> {
    const initialPassword = generateInitialPassword()

    const student = await pb.collection('users').create<User>({
      email: input.email.trim(),
      password: initialPassword,
      passwordConfirm: initialPassword,
      name: input.name.trim(),
      phone: input.phone?.trim() || '',
      belt: input.belt || '',
      role: 'aluno',
      active: true,
      verified: true,
    })

    return { student, initialPassword }
  },

  async updateStudent(id: string, input: UpdateStudentInput): Promise<User> {
    const updated = await pb.collection('users').update<User>(id, input)
    return updated
  },
}
