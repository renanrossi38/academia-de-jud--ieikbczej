import pb from '@/lib/pocketbase/client'
import { Attendance } from '@/types'

/** Intervalo (inicio/fim) de um mês local, no formato aceito pelo filtro do PocketBase. */
function monthRange(year: number, month0: number): { start: string; end: string } {
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  const fmt = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }
  return {
    start: `${fmt(first)} 00:00:00.000Z`,
    end: `${fmt(last)} 23:59:59.999Z`,
  }
}

/**
 * Mapa "YYYY-MM-DD" → quantas marcações de presença existem naquele dia.
 * Base do destaque visual do calendário de presenças da turma.
 */
export type AttendanceDaysMap = Record<string, number>

export const attendanceCalendarService = {
  /** Dias (dentro de um mês) que têm pelo menos uma marcação de presença. */
  async listDaysWithMarkings(year: number, month0: number): Promise<AttendanceDaysMap> {
    const { start, end } = monthRange(year, month0)
    const records = await pb.collection('attendance').getFullList<Attendance>({
      filter: `date >= "${start}" && date <= "${end}"`,
      sort: '-date',
    })
    const map: AttendanceDaysMap = {}
    records.forEach((r) => {
      // A marcação é gravada às 12:00:00.000Z; o dia local é extraído da própria string
      // para não depender do fuso do navegador.
      const dayKey = (r.date || '').slice(0, 10)
      if (dayKey) map[dayKey] = (map[dayKey] || 0) + 1
    })
    return map
  },
}
