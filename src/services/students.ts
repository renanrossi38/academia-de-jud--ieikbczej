import pb from '@/lib/pocketbase/client'
import { Belt, Student, User } from '@/types'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export interface CreateStudentInput {
  name: string
  email?: string
  phone?: string
  belt?: Belt
  address?: string
  birth_date?: string
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
}

export interface UpdateStudentInput {
  name?: string
  email?: string
  phone?: string
  belt?: Belt | ''
  active?: boolean
  address?: string
  birth_date?: string
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
}

/** Validação leve de telefone (pt-BR): 10 a 11 dígitos com DDD, ou vazios. */
export function guardianPhoneError(phone: string): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null // opcional
  if (digits.length < 10 || digits.length > 11)
    return 'Informe o telefone com DDD — ex.: (11) 90000-0000.'
  return null
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

/** users.belt só aceita as 9 faixas base — valores "ponta" viram a faixa base. */
function baseBeltForUser(belt?: Belt | ''): Belt | '' {
  if (!belt) return ''
  return belt.endsWith('_ponta') ? ((belt.split('_')[0] as Belt) ?? '') : belt
}

/** Traduz erros de validação do PocketBase para mensagens claras em português. */
function friendlyCreateAccessError(err: unknown, email: string): string {
  const fieldErrors = extractFieldErrors(err)
  const raw = getErrorMessage(err).toLowerCase()
  const emailErr = (fieldErrors.email || '').toLowerCase()

  if (raw.includes('not unique') || emailErr.includes('not unique')) {
    return `O e-mail ${email} já está em uso por outra conta. Corrija o e-mail no cadastro do aluno.`
  }
  if (raw.includes('validation_min_text_constraint') || raw.includes('must be at least')) {
    return 'A senha gerada ficou curta demais. Tente gerar o acesso novamente.'
  }
  if (raw.includes('cannot be blank') || raw.includes('validation_required')) {
    return 'Há campos obrigatórios faltando no cadastro do aluno (nome ou e-mail). Complete o cadastro e tente de novo.'
  }
  if (raw.includes('validation_invalid_email') || raw.includes('invalid email')) {
    return `O e-mail ${email} não é válido. Corrija o e-mail no cadastro do aluno e tente de novo.`
  }
  if (raw.includes('values_mismatch') || raw.includes("values don't match")) {
    return 'O servidor rejeitou um campo reservado da conta. Atualize a página e tente gerar o acesso novamente.'
  }
  const msg = getErrorMessage(err)
  return msg.startsWith('Failed to create record') || !msg
    ? 'Não foi possível criar a conta de acesso. Verifique o e-mail do aluno e tente novamente.'
    : msg
}

/**
 * Gera a conta de acesso ao site de um aluno que tem e-mail: cria o usuário
 * (role 'aluno') com senha inicial e vincula student.user a ele.
 */
export async function createAccess(
  student: Student,
): Promise<{ account: User; initialPassword: string }> {
  if (!student.email || !student.email.trim()) {
    throw new Error('O aluno precisa de um e-mail para ganhar acesso ao site.')
  }
  if (student.user) {
    throw new Error('Este aluno já possui acesso ao site.')
  }

  const email = student.email.trim()
  const initialPassword = generateInitialPassword()

  let account: User
  try {
    account = await pb.collection('users').create<User>({
      email,
      password: initialPassword,
      passwordConfirm: initialPassword,
      name: student.name,
      phone: student.phone || '',
      // users.belt não tem os valores "ponta" — envia apenas o valor base
      belt: baseBeltForUser(student.belt),
      role: 'aluno',
      active: true,
      // verified NÃO é enviado: só superusuário pode definir esse campo
      // (o admin do app é um record com role=admin, sem manage access) e
      // enviá-lo devolve 400 "Failed to create record."
    })
  } catch (err) {
    throw new Error(friendlyCreateAccessError(err, email))
  }

  try {
    await pb.collection('students').update(student.id, { user: account.id })
  } catch (err) {
    // Não deixa uma conta órfã se o vínculo falhar
    await pb
      .collection('users')
      .delete(account.id)
      .catch(() => {})
    console.error('Falha ao vincular student.user:', err)
    throw new Error(
      'A conta foi criada, mas o vínculo com o cadastro do aluno falhou. Tente novamente.',
    )
  }

  return { account, initialPassword }
}

export const studentsService = {
  /** Todos os alunos cadastrados (com ou sem conta de acesso), com a conta
   * expandida para o painel saber o cargo (role/is_owner) do usuário. */
  async listStudents(): Promise<Student[]> {
    return pb.collection('students').getFullList<Student>({
      sort: '-created',
      expand: 'user',
    })
  },

  /** Alunos ativos (para matrícula em turmas e chamada). */
  async listActive(): Promise<Student[]> {
    return pb.collection('students').getFullList<Student>({
      filter: 'active = true',
      sort: 'name',
    })
  },

  /** Aluno vinculado a uma conta de acesso (ou null, ex.: contas de admin). */
  async getByUser(userId: string): Promise<Student | null> {
    const res = await pb
      .collection('students')
      .getList<Student>(1, 1, { filter: `user = "${userId}"` })
    return res.items[0] ?? null
  },

  /** Busca um aluno pelo id (null quando não existe, ex.: link antigo). */
  async getStudentById(id: string): Promise<Student | null> {
    try {
      return await pb.collection('students').getOne<Student>(id)
    } catch (_) {
      return null
    }
  },

  async createStudent(input: CreateStudentInput): Promise<Student> {
    return pb.collection('students').create<Student>({
      name: input.name.trim(),
      email: input.email?.trim() || '',
      phone: input.phone?.trim() || '',
      belt: input.belt || '',
      address: input.address?.trim() || '',
      birth_date: input.birth_date?.trim() || '',
      guardian_name: input.guardian_name?.trim() || '',
      guardian_phone: input.guardian_phone?.trim() || '',
      guardian_email: input.guardian_email?.trim() || '',
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
    if (typeof payload.guardian_name === 'string')
      payload.guardian_name = payload.guardian_name.trim()
    if (typeof payload.guardian_phone === 'string')
      payload.guardian_phone = payload.guardian_phone.trim()
    if (typeof payload.guardian_email === 'string')
      payload.guardian_email = payload.guardian_email.trim()
    return pb.collection('students').update<Student>(id, payload)
  },

  createAccess,
}
