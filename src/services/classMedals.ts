import { pb } from '@/lib/pocketbase/client'
import { ClassMedal } from '@/types'

/**
 * Medalhas de turmas infantis (collection class_medals, migration 0035).
 * - 'dorme_dorme': medalha levada pelo aluno no mês — vale só no mês vigente.
 * - 'fica_fica': aluno destaque do mês — aparece para sempre (⭐ permanente).
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
}

export const classMedalsService = {
  /** Todas as medalhas de uma turma (admin). */
  async listByClass(classId: string): Promise<ClassMedal[]> {
    return pb.collection('class_medals').getFullList<ClassMedal>({
      filter: `class = "${classId}"`,
      sort: '-month',
    })
  },

  async add(input: AddMedalInput): Promise<ClassMedal> {
    return pb.collection('class_medals').create<ClassMedal>({
      class: input.classId,
      student: input.studentId,
      month: input.month,
      kind: input.kind,
    })
  },

  async remove(id: string): Promise<void> {
    await pb.collection('class_medals').delete(id)
  },
}
