import pb from '@/lib/pocketbase/client'
import { Class } from '@/types'
import { classesService } from '@/services/classes'

/** Agendamento de aula experimental (collection trial_bookings, migration 0041). */
export type TrialBookingStatus = 'novo' | 'confirmado' | 'realizado' | 'cancelado'

export const TRIAL_STATUS_LABEL: Record<TrialBookingStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export interface TrialBooking {
  collectionId: string
  collectionName: string
  id: string
  student_name: string
  birth_date: string
  class: string
  date: string
  contact: string
  notes?: string
  status: TrialBookingStatus
  created: string
  updated: string
  expand?: {
    class?: Pick<Class, 'id' | 'name' | 'schedule'>
  }
}

export interface CreateTrialBookingInput {
  student_name: string
  birth_date: string
  class: string
  date: string
  contact: string
  notes?: string
}

export const trialBookingsService = {
  /** Cria o agendamento — público, sem login (validado no hook server-side). */
  async create(input: CreateTrialBookingInput): Promise<TrialBooking> {
    return pb.collection('trial_bookings').create<TrialBooking>(input)
  },

  /**
   * Datas já ocupadas de uma turma (agendamentos não-cancelados), via rota
   * pública /backend/v1/trial-availability/{classId} (hook trial_bookings.js).
   * Resposta contém APENAS as datas — nenhum dado pessoal. Usada pelo
   * calendário do formulário para desabilitar dias já reservados.
   */
  async fetchOccupiedDates(classId: string): Promise<string[]> {
    const res = await pb.send<{ dates: string[] }>(
      '/backend/v1/trial-availability/' + encodeURIComponent(classId),
      { method: 'GET' },
    )
    return Array.isArray(res?.dates) ? res.dates : []
  },

  /** Todos os agendamentos, mais recentes primeiro (painel — só admin). */
  async list(): Promise<TrialBooking[]> {
    return pb.collection('trial_bookings').getFullList<TrialBooking>({
      sort: '-created',
      expand: 'class',
    })
  },

  async updateStatus(id: string, status: TrialBookingStatus): Promise<TrialBooking> {
    return pb.collection('trial_bookings').update<TrialBooking>(id, { status })
  },

  async remove(id: string): Promise<void> {
    await pb.collection('trial_bookings').delete(id)
  },
}

/** Data de nascimento "YYYY-MM-DD" → idade completa hoje. */
export function idadeDe(birthDate: string): number | null {
  const m = birthDate?.slice(0, 10)?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const birth = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  const now = new Date()
  let age = now.getFullYear() - birth.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && birth.getUTCDate() > now.getUTCDate())) age--
  return age
}

/**
 * Classes disponíveis para agendar: ativas E com vaga (vagas vs. matrículas
 * ativas — o mesmo cálculo usado na matrícula no painel).
 */
export async function fetchBookableClasses(): Promise<{ klass: Class; vagasRestantes: number }[]> {
  const [classes, counts] = await Promise.all([
    classesService.listClasses(),
    classesService.countStudentsByClass(),
  ])
  const bookable: { klass: Class; vagasRestantes: number }[] = []
  for (const klass of classes) {
    if (klass.active === false) continue
    const vagas = typeof klass.vagas === 'number' ? klass.vagas : 0
    const ocupadas = counts[klass.id] ?? 0
    if (vagas > 0 && ocupadas >= vagas) continue
    bookable.push({ klass, vagasRestantes: vagas - ocupadas })
  }
  return bookable.sort((a, b) => (a.klass.name || '').localeCompare(b.klass.name || '', 'pt-BR'))
}

/** Rótulos curtos dos dias da semana (ordem seg→dom, valores da migration 0041). */
export const WEEKDAY_LABELS: Record<string, string> = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo',
}

export const WEEKDAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

/** "ter e qui" / "seg, qua e sex" — para mensagens de erro claras. */
export function weekdayListText(weekdays: string[]): string {
  const sorted = WEEKDAY_ORDER.filter((d) => weekdays.includes(d))
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return WEEKDAY_LABELS[sorted[0]].toLowerCase()
  const head = sorted.slice(0, -1).map((d) => WEEKDAY_LABELS[d].toLowerCase())
  return head.join(', ') + ' e ' + WEEKDAY_LABELS[sorted[sorted.length - 1]].toLowerCase()
}
