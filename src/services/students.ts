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

/** Rótulos dos campos da ficha do aluno, para mensagens de erro específicas. */
const STUDENT_FIELD_LABELS: Record<string, string> = {
  name: 'O nome',
  email: 'O e-mail',
  phone: 'O telefone',
  belt: 'A faixa',
  address: 'O endereço',
  birth_date: 'A data de nascimento',
  guardian_name: 'O nome do responsável',
  guardian_phone: 'O telefone do responsável',
  guardian_email: 'O e-mail do responsável',
}

/** Traduz a recusa do servidor ao salvar a ficha (create/update de students)
 * em mensagem específica por campo. O PocketBase responde 400 "Failed to
 * create record." genérico, mas os fieldErrors da resposta dizem qual campo
 * e motivo — a tela precisa disso em vez do erro bruto. */
export function friendlyStudentSaveError(err: unknown): string {
  const fieldErrors = extractFieldErrors(err)
  const raw = getErrorMessage(err)
  const lower = raw.toLowerCase()

  const parts: string[] = []
  for (const [field, msg] of Object.entries(fieldErrors)) {
    const label = STUDENT_FIELD_LABELS[field] || `O campo ${field}`
    const m = (msg || '').toLowerCase()
    if (m.includes('not unique')) parts.push(`${label} já está em uso.`)
    else if (m.includes('cannot be blank') || m.includes('required'))
      parts.push(`${label} é obrigatório.`)
    else if (m.includes('mismatch') || m.includes("don't match") || m.includes('invalid value'))
      parts.push(`${label} informado não é aceito pelo servidor.`)
    else if (m.includes('invalid') || m.includes('date')) parts.push(`${label} é inválido.`)
    else if (m.includes('must be') || m.includes('length'))
      parts.push(`${label} está fora do tamanho permitido.`)
    else parts.push(`${label}: ${msg}.`)
  }
  if (parts.length) return parts.join(' ')

  if (
    lower.startsWith('failed to create record') ||
    lower.startsWith('failed to update record') ||
    !lower
  ) {
    return 'O servidor recusou o cadastro sem detalhes. Verifique os campos (especialmente a data de nascimento e a faixa) e tente novamente.'
  }
  return raw
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
      // users.belt aceita as 13 faixas (migration 0044) — envia a faixa exata
      belt: student.belt || '',
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
    const payload: Record<string, unknown> = {
      name: input.name.trim(),
      email: input.email?.trim() || '',
      phone: input.phone?.trim() || '',
      belt: input.belt || '',
      address: input.address?.trim() || '',
      guardian_name: input.guardian_name?.trim() || '',
      guardian_phone: input.guardian_phone?.trim() || '',
      guardian_email: input.guardian_email?.trim() || '',
      active: true,
    }
    // DateField não aceita string vazia (400 "Failed to create record."):
    // omitir o campo quando a data não foi informada. Foi a causa do erro ao
    // cadastrar o primeiro aluno — com ou sem data de nascimento preenchida,
    // o payload anterior sempre enviava birth_date: ''.
    if (input.birth_date?.trim()) payload.birth_date = input.birth_date.trim()
    try {
      return await pb.collection('students').create<Student>(payload)
    } catch (err) {
      throw new Error(friendlyStudentSaveError(err))
    }
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
    // Mesma regra do create: DateField recusa string vazia — omitir quando vazia.
    if (typeof payload.birth_date === 'string' && !payload.birth_date.trim())
      delete payload.birth_date
    try {
      return await pb.collection('students').update<Student>(id, payload)
    } catch (err) {
      throw new Error(friendlyStudentSaveError(err))
    }
  },

  /** Salva (File) ou remove (null) a foto do aluno — multipart/form-data.
   * A foto é usada nos destaques da home (medalha fica fica e competição). */
  async setPhoto(id: string, file: File | null): Promise<Student> {
    const fd = new FormData()
    fd.append('photo', file ?? '')
    return pb.collection('students').update<Student>(id, fd)
  },

  /** URL (thumb) da foto gravada do aluno — '' quando ele não tem foto ou
   * quando não há aluno (null/undefined: chamado em render de diálogo montado
   * com ficha fechada, onde acessar .photo de null derrubaria a página). O
   * tamanho segue a convenção de thumbs do projeto: 'sm' → 100x100. */
  getPhotoUrl(
    student?: Pick<Student, 'collectionId' | 'id' | 'photo'> | null,
    size?: 'sm' | 'md',
  ): string {
    if (!student) return ''
    const photo = Array.isArray(student.photo) ? student.photo[0] : student.photo
    if (!photo) return ''
    return pb.files.getURL({ collectionId: student.collectionId, id: student.id }, photo, {
      thumb: size === 'md' ? '400x400' : '100x100',
    })
  },

  createAccess,
}
