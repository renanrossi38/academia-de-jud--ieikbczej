import pb from '@/lib/pocketbase/client'

/**
 * Área do aluno — dados agregados pelo pb_hook GET /backend/v1/student-area.
 *
 * O front NÃO consegue montar isto sozinho: monthly_fees, belt_promotions e
 * points_entries são admin-only, e o % de presença precisa dos DIAS COM
 * CHAMADA da turma e a posição do ranking precisa do conjunto de todos os
 * alunos. A rota exige login e resolve o aluno via students.user.
 */

export interface StudentAreaFee {
  id: string
  reference_month: string // "2026-11"
  amount: number
  paid_at: string
  payment_method: string // pix | dinheiro | cartao | ''
}

export interface StudentAreaOrderItem {
  product_name: string
  variation_label: string
  quantity: number
  unit_price: number
  subtotal: number
  custom_answers?: Record<string, string> | null
}

export interface StudentAreaOrder {
  id: string
  status: string
  total: number
  delivery_type: string
  created: string
  items: StudentAreaOrderItem[]
  /** Rastreio estilo Correios (status + etapas do admin), mais recente em cima. */
  tracking: StudentAreaTrackingEvent[]
}

/** Evento da linha do tempo do pedido na Área do aluno. */
export interface StudentAreaTrackingEvent {
  /** "status" = mudança de status; "etapa" = etapa personalizada do admin. */
  kind: 'status' | 'etapa'
  at: string
  by: string
  from_status?: string
  to_status?: string
  label?: string
}

export interface StudentAreaAttendanceMonth {
  month: string // "2026-11"
  totalDias: number // dias com chamada da turma (que têm registro p/ o aluno)
  presencas: number
  ausentes: number
  justificados: number
  percentual: number // presencas / totalDias
}

export interface StudentAreaAttendance {
  id: string
  date: string
  status: 'presente' | 'ausente' | 'justificado' | string
  notes: string
}

export interface StudentAreaBelt {
  id: string
  belt: string
  promoted_at: string
  notes: string
}

export interface StudentAreaData {
  student: { id: string; name: string; belt: string; active: boolean } | null
  paidFees: StudentAreaFee[]
  orders: StudentAreaOrder[]
  attendance: StudentAreaAttendance[]
  attendanceMonth: StudentAreaAttendanceMonth[]
  rankingPosition: number | null
  rankingTotal: number
  rankingPoints: number
  beltHistory: StudentAreaBelt[]
  currentBelt: string | null
}

/** Mês "2026-11" → "novembro de 2026" (por extenso, pt-BR). */
export function mesPorExtenso(mesChave: string): string {
  const [y, m] = (mesChave || '').split('-').map(Number)
  if (!y || !m) return mesChave || '—'
  const nomes = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  return `${nomes[m - 1]} de ${y}`
}

/** Busca o resumo completo do aluno logado. */
export async function fetchStudentArea(): Promise<StudentAreaData> {
  return pb.send<StudentAreaData>('/backend/v1/student-area', {})
}
