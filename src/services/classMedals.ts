import pb from '@/lib/pocketbase/client'
import { ClassMedal } from '@/types'

/**
 * Medalhas de turmas infantis (collection class_medals, migrations 0035/0036).
 * - 'dorme_dorme': medalha levada pelo aluno no mês — vale só no mês concedido.
 *   Cada uma carrega o DIA em que foi recebida (received_at) para medir a
 *   constância do aluno dentro do mês.
 * - 'fica_fica': aluno destaque do mês — fica em destaque durante o mês seguinte ao concedido.
 */
export type MedalKind = 'dorme_dorme' | 'fica_fica'

export const MEDAL_KIND_LABEL: Record<MedalKind, string> = {
  dorme_dorme: 'Medalha dorme dorme',
  fica_fica: 'Medalha fica fica',
}

export interface AddMedalInput {
  classId: string
  studentId: string
  /** 'YYYY-MM' em horário de Brasília */
  month: string
  kind: MedalKind
  /**
   * Dia em que a medalha foi recebida ('YYYY-MM-DD', Brasília) — migration 0036.
   * Usado na prática pela dorme_dorme (controle de constância); a fica_fica é
   * uma por mês e não precisa dele.
   */
  receivedAt?: string | null
}

export const classMedalsService = {
  /** Todas as medalhas de uma turma (admin), da mais recente para a mais antiga. */
  async listByClass(classId: string): Promise<ClassMedal[]> {
    return pb.collection('class_medals').getFullList<ClassMedal>({
      filter: `class = "${classId}"`,
      sort: '-month,-received_at,-created',
    })
  },

  async add(input: AddMedalInput): Promise<ClassMedal> {
    return pb.collection('class_medals').create<ClassMedal>({
      class: input.classId,
      student: input.studentId,
      month: input.month,
      kind: input.kind,
      ...(input.receivedAt ? { received_at: `${input.receivedAt} 12:00:00.000Z` } : {}),
    })
  },

  /** Edita o dia de recebimento de uma medalha já atribuída (migration 0036). */
  async updateDate(id: string, receivedAt: string): Promise<ClassMedal> {
    return pb.collection('class_medals').update<ClassMedal>(id, {
      received_at: `${receivedAt} 12:00:00.000Z`,
    })
  },

  async remove(id: string): Promise<void> {
    await pb.collection('class_medals').delete(id)
  },
}
