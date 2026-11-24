import pb from '@/lib/pocketbase/client'
import { attendanceService, toLocalDateKey } from '@/services/attendance'
import { Attendance, AttendanceStatus, Class, ClassLevel, ClassStudent, Student } from '@/types'

export interface CreateClassInput {
  name: string
  level?: ClassLevel | ''
  schedule?: string
  monthly_fee?: number | null
  /** Número de vagas da turma (limite de matrículas). */
  vagas: number
  active?: boolean
  /** Turma infantil (habilita medalhas dorme dorme / fica fica). */
  isKids?: boolean
  /** Foto de capa (upload na criação). */
  cover?: File | null
}

export interface UpdateClassInput {
  name?: string
  level?: ClassLevel | ''
  schedule?: string
  monthly_fee?: number | null
  vagas?: number
  active?: boolean
  /** Turma infantil (habilita medalhas dorme dorme / fica fica). */
  isKids?: boolean
  /** Novo arquivo de capa (upload). */
  cover?: File | null
  /** Sinaliza remoção da capa atual (PocketBase: campo "cover-"). */
  removeCover?: boolean
}

export const classLevelLabel = (level?: string): string => {
  switch (level) {
    case 'iniciante':
      return 'Iniciante'
    case 'intermediario':
      return 'Intermediário'
    case 'avancado':
      return 'Avançado'
    default:
      return 'Sem nível'
  }
}

export const classLevelBadgeClass = (level?: string): string => {
  switch (level) {
    case 'iniciante':
      return 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
    case 'intermediario':
      return 'bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5]'
    case 'avancado':
      return 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
    default:
      return 'bg-white text-[#6B6560] border-[#E8E0D5]'
  }
}

export const classesService = {
  /** Todas as turmas (mais recentes primeiro). */
  async listClasses(): Promise<Class[]> {
    return pb.collection('classes').getFullList<Class>({ sort: '-created' })
  },

  async getClass(id: string): Promise<Class> {
    return pb.collection('classes').getOne<Class>(id)
  },

  async createClass(input: CreateClassInput): Promise<Class> {
    const fields = {
      name: input.name.trim(),
      level: input.level || '',
      schedule: input.schedule?.trim() || '',
      monthly_fee: input.monthly_fee ?? null,
      vagas: input.vagas,
      active: input.active ?? true,
      is_kids: input.isKids ?? false,
    }
    if (input.cover) {
      const payload = new FormData()
      Object.entries(fields).forEach(([key, value]) => payload.append(key, String(value)))
      payload.append('cover', input.cover)
      return pb.collection('classes').create<Class>(payload)
    }
    return pb.collection('classes').create<Class>(fields)
  },

  async updateClass(id: string, input: UpdateClassInput): Promise<Class> {
    // O contrato da capa: cover=null e removeCover=undefined significam
    // "sem mudança" (o payload NÃO menciona o campo). Capa nova é upload
    // multipart; removeCover=true usa a sintaxe "cover-" do PocketBase.
    const { cover, removeCover, ...rest } = input
    const needsForm = !!cover || !!removeCover
    if (!needsForm) {
      const { isKids, ...payloadRest } = rest
      const payload: Record<string, unknown> = { ...payloadRest }
      if (typeof payload.name === 'string') payload.name = (payload.name as string).trim()
      if (typeof payload.schedule === 'string')
        payload.schedule = (payload.schedule as string).trim()
      if (isKids !== undefined) payload.is_kids = isKids
      return pb.collection('classes').update<Class>(id, payload)
    }

    const payload = new FormData()
    if (input.name !== undefined) payload.append('name', input.name.trim())
    if (input.level !== undefined) payload.append('level', input.level || '')
    if (input.schedule !== undefined) payload.append('schedule', input.schedule.trim())
    if (input.monthly_fee !== undefined)
      payload.append('monthly_fee', input.monthly_fee === null ? '' : String(input.monthly_fee))
    if (input.vagas !== undefined) payload.append('vagas', String(input.vagas))
    if (input.active !== undefined) payload.append('active', String(input.active))
    if (input.isKids !== undefined) payload.append('is_kids', String(input.isKids))
    if (input.cover) payload.append('cover', input.cover)
    if (input.removeCover) payload.append('cover-', '')
    return pb.collection('classes').update<Class>(id, payload)
  },

  /** URL da capa da turma (null quando não tem). */
  getCoverUrl(klass: Class): string | null {
    if (!klass.cover) return null
    return pb.files.getURL(klass, klass.cover)
  },

  /** Exclui a turma; as matrículas (class_students) saem junto por cascata. */
  async deleteClass(id: string): Promise<void> {
    await pb.collection('classes').delete(id)
  },

  /** Matrículas de uma turma, com o aluno expandido (mais antigas primeiro). */
  async listClassStudents(classId: string): Promise<ClassStudent[]> {
    return pb.collection('class_students').getFullList<ClassStudent>({
      filter: `class = "${classId}"`,
      expand: 'student',
      sort: 'created',
    })
  },

  /** Total de matrículas de uma turma (para o contador da listagem). */
  async countClassStudents(classId: string): Promise<number> {
    const res = await pb.collection('class_students').getList(1, 1, {
      filter: `class = "${classId}"`,
    })
    return res.totalItems
  },

  /**
   * Total de matrículas de uma turma, sem contar os alunos cujo cadastro não
   * existe mais (relação expandida vazia) — usado para o limite de vagas.
   */
  async countActiveClassStudents(classId: string): Promise<number> {
    const links = await pb.collection('class_students').getFullList<ClassStudent>({
      filter: `class = "${classId}"`,
      expand: 'student',
    })
    return links.filter((l) => !!l.expand?.student).length
  },

  /** Contagem de matrículas por turma (um pedido só, para a listagem de turmas). */
  async countStudentsByClass(): Promise<Record<string, number>> {
    const links = await pb.collection('class_students').getFullList<ClassStudent>({})
    const counts: Record<string, number> = {}
    links.forEach((l) => {
      counts[l.class] = (counts[l.class] || 0) + 1
    })
    return counts
  },

  /** Turmas em que um aluno está matriculado (para "Minha Presença"). */
  async listClassesOfStudent(studentId: string): Promise<Class[]> {
    const links = await pb.collection('class_students').getFullList<ClassStudent>({
      filter: `student = "${studentId}"`,
      expand: 'class',
    })
    return links
      .map((l) => l.expand?.class)
      .filter((c): c is Class => !!c)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
  },

  /** Matricula um aluno na turma (ignora duplicada; bloqueia quando a turma lotou). */
  async addStudent(classId: string, studentId: string): Promise<void> {
    const existing = await pb.collection('class_students').getList(1, 1, {
      filter: `class = "${classId}" && student = "${studentId}"`,
    })
    if (existing.items.length > 0) return

    const klass = await this.getClass(classId)
    const vagas = typeof klass.vagas === 'number' ? klass.vagas : 0
    if (vagas > 0) {
      const ocupadas = await this.countActiveClassStudents(classId)
      if (ocupadas >= vagas) {
        throw new Error(`Turma lotada — sem vagas disponíveis (${ocupadas}/${vagas} ocupadas).`)
      }
    }
    await pb.collection('class_students').create({ class: classId, student: studentId })
  },

  /** Remove o aluno da turma — o histórico de presença dele permanece. */
  async removeStudent(classId: string, studentId: string): Promise<void> {
    const link = await pb.collection('class_students').getList(1, 1, {
      filter: `class = "${classId}" && student = "${studentId}"`,
    })
    if (link.items.length === 0) return
    await pb.collection('class_students').delete(link.items[0].id)
  },

  /**
   * Chamada de uma turma em um dia: alunos matriculados (ativos) em ordem
   * alfabética + a marcação salva de cada um (ou null quando ainda sem marca).
   */
  async listDayRoll(
    classId: string,
    dateKey: string,
  ): Promise<{ students: Student[]; markings: Record<string, AttendanceStatus> }> {
    const links = await this.listClassStudents(classId)
    const students = links
      .map((l) => l.expand?.student)
      .filter((s): s is Student => !!s && s.active !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))

    const markings: Record<string, AttendanceStatus> = {}
    if (students.length > 0) {
      const dayRecords = await attendanceService.listByDate(dateKey)
      const wanted = new Set(students.map((s) => s.id))
      dayRecords.forEach((r) => {
        if (wanted.has(r.student)) markings[r.student] = r.status
      })
    }
    return { students, markings }
  },

  /** Salva a chamada do dia (reaproveita o lote existente, uma marcação por aluno/dia). */
  async saveDayRoll(
    dateKey: string,
    entries: { studentId: string; status: AttendanceStatus }[],
  ): Promise<{ saved: number; skipped: number }> {
    return attendanceService.saveBatch(
      dateKey,
      entries.map((e) => ({ studentId: e.studentId, status: e.status })),
    )
  },
}

/** Presença do histórico com as turmas do aluno (contexto de exibição). */
export interface AttendanceWithClasses {
  record: Attendance
  classes: Class[]
}

/**
 * Histórico de um aluno anotado com as turmas em que ele está matriculado.
 * A marcação é por aluno/dia e não guarda a turma de origem, então mostramos
 * as turmas do aluno como contexto em cada registro.
 */
export async function annotateWithClasses(
  records: Attendance[],
  studentId: string,
): Promise<AttendanceWithClasses[]> {
  if (records.length === 0) return []
  let classes: Class[] = []
  try {
    classes = await classesService.listClassesOfStudent(studentId)
  } catch {
    classes = []
  }
  return records.map((record) => ({ record, classes }))
}

/** Data (YYYY-MM-DD) de hoje no fuso local. */
export function todayKey(): string {
  return toLocalDateKey(new Date())
}
