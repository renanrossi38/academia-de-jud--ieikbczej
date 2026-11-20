import pb from '@/lib/pocketbase/client'
import { Attendance, AttendanceStatus, Student } from '@/types'

/** Data (YYYY-MM-DD) no fuso local a partir de um Date. */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Intervalo (inicio/fim) de um dia local, no formato aceito pelo filtro do PocketBase. */
function dayRange(dateKey: string): { start: string; end: string } {
  return {
    start: `${dateKey} 00:00:00.000Z`,
    end: `${dateKey} 23:59:59.999Z`,
  }
}

export interface AttendanceDayInput {
  studentId: string
  status: AttendanceStatus
}

export const attendanceService = {
  /** Marcações de uma data específica (para o painel do admin). */
  async listByDate(dateKey: string): Promise<Attendance[]> {
    const { start, end } = dayRange(dateKey)
    return pb.collection('attendance').getFullList<Attendance>({
      filter: `date >= "${start}" && date <= "${end}"`,
      sort: '-created',
    })
  },

  /** Histórico completo de um aluno (ordem decrescente de data). */
  async listByStudent(studentId: string): Promise<Attendance[]> {
    return pb.collection('attendance').getFullList<Attendance>({
      filter: `student = "${studentId}"`,
      sort: '-date',
    })
  },

  /** Marcações dos últimos `days` dias (base do resumo de frequência do painel). */
  async listRecent(days: number): Promise<Attendance[]> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = `${toLocalDateKey(cutoff)} 00:00:00.000Z`
    return pb.collection('attendance').getFullList<Attendance>({
      filter: `date >= "${cutoffStr}"`,
      sort: '-date',
    })
  },

  /**
   * Marcações de vários alunos em uma data (lote do painel), filtrando por
   * aluno: o PocketBase não aceita OR grande em um único filtro, então
   * buscamos o dia inteiro e filtramos no cliente.
   */
  async listForDayAndStudents(dateKey: string, studentIds: string[]): Promise<Attendance[]> {
    const all = await this.listByDate(dateKey)
    if (studentIds.length === 0) return []
    const wanted = new Set(studentIds)
    return all.filter((a) => wanted.has(a.student))
  },

  /** Cria ou atualiza a marcação de um aluno em uma data (uma por aluno/dia). */
  async saveOne(dateKey: string, input: AttendanceDayInput): Promise<Attendance> {
    const { start, end } = dayRange(dateKey)
    const existing = await pb.collection('attendance').getFullList<Attendance>({
      filter: `student = "${input.studentId}" && date >= "${start}" && date <= "${end}"`,
      limit: 1,
    })

    if (existing.length > 0) {
      return pb.collection('attendance').update<Attendance>(existing[0].id, {
        status: input.status,
      })
    }
    return pb.collection('attendance').create<Attendance>({
      student: input.studentId,
      date: `${dateKey} 12:00:00.000Z`,
      status: input.status,
    })
  },

  /** Salva em lote as marcações de uma data (ignora quem não mudou). */
  async saveBatch(
    dateKey: string,
    entries: AttendanceDayInput[],
  ): Promise<{ saved: number; skipped: number }> {
    let saved = 0
    let skipped = 0
    for (const entry of entries) {
      try {
        await this.saveOne(dateKey, entry)
        saved++
      } catch (err) {
        // Falha de regra/validação em um registro não derruba o lote inteiro.
        console.error('Erro ao salvar presença:', err)
        skipped++
      }
    }
    return { saved, skipped }
  },

  /** Lista alunos ativos (para o painel de presença). Alunos sem e-mail entram normalmente. */
  async listActiveStudents(): Promise<Student[]> {
    return pb.collection('students').getFullList<Student>({
      filter: 'active = true',
      sort: 'name',
    })
  },
}
