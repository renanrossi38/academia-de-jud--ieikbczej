import pb from '@/lib/pocketbase/client'
import { Belt, Student, User } from '@/types'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { extractServerError, isSessionError, serverErrorMessage } from '@/services/studentsErrors'
import { linkStudentViaRoute, lookupUserByEmail } from '@/services/studentsRoute'

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

/** Data de nascimento "YYYY-MM-DD" → idade completa hoje (null se incompleta). */
export function idadeDeAluno(birthDate: string): number | null {
  const m = birthDate?.slice(0, 10)?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const birth = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  const now = new Date()
  let age = now.getFullYear() - birth.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && birth.getUTCDate() > now.getUTCDate())) age--
  return age
}

/** Situação do acesso do aluno na listagem/ficha, para o dono saber qual
 * botão aparece. Usa o e-mail PRÓPRIO; quando o aluno é MENOR de 18 (ou está
 * sem e-mail) e tem guardian_email, o acesso pode usar o e-mail do
 * responsável — decisão do dono: o responsável pode ter conta quando o
 * dependente não tem e-mail. */
export function accessOptionsFor(student: Student): {
  /** Conceder acesso pelo e-mail do próprio aluno. */
  own: boolean
  /** Conceder acesso pelo e-mail do responsável gravado na ficha. */
  guardian: boolean
  /** E-mail que seria usado no acesso do responsável ('' se não há). */
  guardianEmail: string
  /** Nenhum e-mail disponível — botão desabilitado com explicação. */
  none: boolean
} {
  const own = !!student.email?.trim() && !student.user
  const guardianEmail = student.guardian_email?.trim() || ''
  const idade = idadeDeAluno(student.birth_date || '')
  const menor = idade !== null && idade < 18
  const semEmailProprio = !student.email?.trim()
  const guardian = !student.user && !!guardianEmail && (menor || semEmailProprio)
  return { own, guardian, guardianEmail, none: !own && !guardian }
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

  // Sem fieldError na resposta: dá o motivo real do servidor quando ele não é
  // o genérico, e nunca deixa o texto cru ("Failed to create record.")
  // chegar ao dono da academia.
  const raw = getErrorMessage(err).trim()
  if (
    /^failed to (create|update) record/i.test(raw) ||
    !raw ||
    raw === 'An unexpected error occurred.'
  ) {
    return 'O servidor recusou o cadastro sem informar o campo. Confira a faixa escolhida e a data de nascimento (os campos mais comuns de recusa) e tente novamente. Se persistir, recarregue a página para o painel buscar a lista de faixas atualizada.'
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
  // Consulta ANTES de criar (rota /backend/v1/students/lookup-user): o e-mail
  // pode JÁ ter conta (outro aluno, ou o próprio responsável também é aluno —
  // caso Tatiane). Nesse caso NÃO tenta criar (daria "not unique"): sinaliza o
  // diálogo para oferecer vincular à conta existente.
  let existing: Awaited<ReturnType<typeof lookupUserByEmail>> | null = null
  try {
    existing = await lookupUserByEmail(email)
  } catch {
    // Lookup indisponível: segue o fluxo antigo (create falha com not unique →
    // GuardianEmailInUseError).
  }
  if (existing?.found) {
    throw new GuardianEmailInUseError(email)
  }

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

export class GuardianEmailInUseError extends Error {
  constructor(public email: string) {
    super('email-in-use')
  }
}

/**
 * Gera a conta de acesso ao site pelo E-MAIL DO RESPONSÁVEL (aluno menor de
 * idade sem e-mail próprio): cria o usuário (role 'aluno') com senha inicial
 * e vincula student.user a ele — o MESMO vínculo do acesso do aluno, então o
 * responsável logado vê a área do aluno daquele dependente.
 *
 * Um responsável pode ter VÁRIOS filhos: se o e-mail já tem conta (ex.: a conta
 * criada para outro filho), lança GuardianEmailInUseError — o diálogo pergunta
 * "Deseja vincular este aluno a ela?" e chama linkStudentToExistingUser.
 */
export async function createGuardianAccess(
  student: Student,
): Promise<{ account: User; initialPassword: string }> {
  const guardianEmail = student.guardian_email?.trim() || ''
  if (!guardianEmail) {
    throw new Error('A ficha do aluno não tem e-mail do responsável para criar o acesso.')
  }
  if (student.user) {
    throw new Error('Este aluno já possui acesso ao site.')
  }

  // Consulta ANTES de criar (lookup-user): se o e-mail do responsável JÁ tem
  // conta (responsável com mais de um filho, ou o responsável também é aluno —
  // caso Tatiane/Isabelly), NÃO cria duplicada: sinaliza o diálogo para
  // oferecer vincular esta ficha à conta existente.
  try {
    const existing = await lookupUserByEmail(guardianEmail)
    if (existing.found) throw new GuardianEmailInUseError(guardianEmail)
  } catch (lookupErr) {
    if (lookupErr instanceof GuardianEmailInUseError) throw lookupErr
    // Lookup indisponível: segue o fluxo antigo (create falha com not unique →
    // GuardianEmailInUseError no catch abaixo).
  }

  const initialPassword = generateInitialPassword()

  let account: User
  try {
    account = await pb.collection('users').create<User>({
      email: guardianEmail,
      password: initialPassword,
      passwordConfirm: initialPassword,
      // Nome do responsável quando existe; senão o próprio nome do aluno.
      name: student.guardian_name?.trim() || student.name,
      phone: student.guardian_phone || student.phone || '',
      belt: '',
      role: 'aluno',
      active: true,
      // verified NÃO é enviado (mesmo motivo do createAccess)
    })
  } catch (err) {
    // E-mail já cadastrado? NÃO é mais um erro: sinaliza para o diálogo
    // oferecer vincular esta ficha à conta existente (segundo filho).
    const fieldErrors = extractFieldErrors(err)
    const raw = getErrorMessage(err).toLowerCase()
    const emailErr = (fieldErrors.email || '').toLowerCase()
    if (raw.includes('not unique') || emailErr.includes('not unique')) {
      throw new GuardianEmailInUseError(guardianEmail)
    }
    throw new Error(friendlyGuardianAccessError(err, guardianEmail))
  }

  try {
    await pb.collection('students').update(student.id, { user: account.id })
  } catch (err) {
    await pb
      .collection('users')
      .delete(account.id)
      .catch(() => {})
    console.error('Falha ao vincular student.user (responsável):', err)
    throw new Error(
      'A conta foi criada, mas o vínculo com o cadastro do aluno falhou. Tente novamente.',
    )
  }

  return { account, initialPassword }
}

/**
 * Vincula a ficha do aluno a uma conta existente do responsável (mesmo e-mail
 * usado por outro filho): students.user = conta.id, sem criar segunda conta.
 * Usa a ROTA PRÓPRIA do servidor (/backend/v1/students/link) — o update direto
 * em students era recusado pela regra de API (mesma família de falha já
 * resolvida em create/list/delete). Retorna a conta vinculada para o painel
 * atualizar a listagem.
 */
export async function linkStudentToExistingUser(student: Student, email: string): Promise<User> {
  try {
    return await linkStudentViaRoute(student.id, email)
  } catch (err) {
    if (isSessionError(err)) throw err
    throw new Error(serverErrorMessage(err))
  }
}

/** Mensagens claras para a criação da conta do responsável. */
function friendlyGuardianAccessError(err: unknown, email: string): string {
  const fieldErrors = extractFieldErrors(err)
  const raw = getErrorMessage(err).toLowerCase()
  const emailErr = (fieldErrors.email || '').toLowerCase()

  if (raw.includes('not unique') || emailErr.includes('not unique')) {
    return `O e-mail ${email} já tem uma conta no site (provavelmente o responsável de outro aluno). Use essa conta para acompanhar este aluno ou cadastre outro e-mail.`
  }
  const msg = friendlyCreateAccessError(err, email)
  return msg.replace(
    'Verifique o e-mail do aluno e tente novamente.',
    'Verifique o e-mail do responsável na ficha do aluno e tente novamente.',
  )
}

export const studentsService = {
  /** Todos os alunos cadastrados (com ou sem conta de acesso), com a conta
   * expandida para o painel saber o cargo (role/is_owner) do usuário. */
  async listStudents(): Promise<Student[]> {
    // Fonte principal: a LISTA PRÓPRIA do backend (/backend/v1/students/list),
    // que devolve TODOS os alunos gravados — correção do bug "só aparece o
    // aluno com status de admin". A rota valida o admin pela MESMA sessão do
    // dono; como a regra de API de students já permite a ele, é equivalente à
    // busca padrão em condições normais.
    try {
      const list = await pb.send<{ students: Student[] }>('/backend/v1/students/list', {
        method: 'GET',
      })
      if (Array.isArray(list?.students)) return list.students
    } catch (err) {
      console.warn('[listStudents] rota própria indisponível, usando busca padrão:', err)
    }
    // Fallback: busca padrão do SDK (regra de API de students) — mantida para
    // os demais painéis que compartilham este serviço.
    return await pb.collection('students').getFullList<Student>({
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
    // Campos opcionais vazios NÃO são enviados: o PocketBase recusa string
    // vazia em campos date e select (400 "Failed to create record.") e, em
    // texto, enviá-las é desnecessário. Era o que acontecia ao cadastrar
    // aluno MAIOR de idade sem responsável: o payload anterior sempre
    // enviava guardian_name/phone/email: '' (e belt: '') — omitir resolve.
    const payload: Record<string, unknown> = {
      name: input.name.trim(),
      active: true,
    }
    const optional: Record<string, string | undefined> = {
      email: input.email?.trim(),
      phone: input.phone?.trim(),
      belt: input.belt,
      address: input.address?.trim(),
      birth_date: input.birth_date?.trim(),
      guardian_name: input.guardian_name?.trim(),
      guardian_phone: input.guardian_phone?.trim(),
      guardian_email: input.guardian_email?.trim(),
    }
    for (const [field, value] of Object.entries(optional)) {
      if (value) payload[field] = value
    }
    try {
      return await pb.collection('students').create<Student>(payload)
    } catch (err) {
      throw new Error(friendlyStudentSaveError(err))
    }
  },

  /**
   * Exclui o aluno de vez (as presenças dele saem junto, por cascata).
   *
   * Usa a ROTA PRÓPRIA do servidor (DELETE /backend/v1/students/delete),
   * mesmo padrão da criação e da listagem: o DELETE padrão da API recusa o
   * dono com 404 "The requested resource wasn't found." MESMO COM O REGISTRO
   * EXISTINDO (falha de API rule / sessão fantasma) — o aluno continuava na
   * lista sem nenhum erro na tela. A rota valida o admin explicitamente e
   * devolve mensagem real em português quando falha.
   */
  async deleteStudent(id: string): Promise<void> {
    try {
      await pb.send('/backend/v1/students/delete?id=' + encodeURIComponent(id), {
        method: 'DELETE',
      })
    } catch (err) {
      if (isSessionError(err)) {
        // Sessão fantasma: limpa o authStore local — o painel cai na tela de
        // login em vez de deixar o dono num admin que não consegue excluir.
        pb.authStore.clear()
        throw err // erro original (401/404): a página trata sessão expirada
      }
      throw new Error(serverErrorMessage(err))
    }
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
    // Campos date e select recusam string vazia (400 "Failed to create
    // record.") — omitir quando vazios, em vez de enviar ''.
    if (typeof payload.birth_date === 'string' && !payload.birth_date.trim())
      delete payload.birth_date
    if (payload.belt === '') delete payload.belt
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
  createGuardianAccess,
}
