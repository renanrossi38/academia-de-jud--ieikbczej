import pb from '@/lib/pocketbase/client'

/** Destaque do mês (medalha fica fica vigente) vindo do hook público. */
export interface MonthHighlight {
  studentId: string
  studentName: string
  photoUrl: string
  classId: string
  className: string
}

/** Destaque de competição criado pelo admin. */
export interface CompetitionHighlight {
  id: string
  studentId: string
  studentName: string
  photoUrl: string
  reason: string
  sort: number
}

export interface HighlightsPayload {
  month: MonthHighlight[]
  competition: CompetitionHighlight[]
  currentMonth: string
}

/** Fallback de iniciais quando o aluno não tem foto (2 letras, pt-BR). */
export function iniciaisDoNome(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * GET /backend/v1/highlights — rota pública do hook highlights.js.
 * Falha silenciosa: a home simplesmente não mostra a seção.
 */
export async function fetchHighlights(): Promise<HighlightsPayload> {
  try {
    const res = await pb.send<HighlightsPayload>('/backend/v1/highlights', {
      method: 'GET',
    })
    return {
      month: Array.isArray(res?.month) ? res.month : [],
      competition: Array.isArray(res?.competition) ? res.competition : [],
      currentMonth: res?.currentMonth || '',
    }
  } catch (err) {
    console.error('[highlights] falha ao carregar destaques:', err)
    return { month: [], competition: [], currentMonth: '' }
  }
}

export const highlightsService = {
  /** Lista completa (admin) dos destaques de competição, incluindo inativos. */
  async listCompetition(): Promise<
    (CompetitionHighlight & { active: boolean; ownPhotoUrl: string })[]
  > {
    const recs = await pb.collection('student_highlights').getFullList<
      {
        id: string
        student: string
        reason: string
        photo: string[]
        active: boolean
        sort: number
        collectionId: string
        created: string
      } & Record<string, unknown>
    >({
      sort: 'sort,-created',
      expand: 'student',
    })
    return recs.map((r) => {
      const ownName = Array.isArray(r.photo) && r.photo.length > 0 ? r.photo[0] : ''
      let ownPhotoUrl = ''
      if (ownName) {
        ownPhotoUrl = pb.files.getURL({ collectionId: r.collectionId, id: r.id }, ownName, {
          thumb: '200x200',
        })
      }
      const st = (r as any).expand?.student
      const stPhoto = st?.photo ? (Array.isArray(st.photo) ? st.photo[0] : st.photo) : ''
      const stPhotoUrl =
        st?.id && stPhoto
          ? pb.files.getURL(
              { collectionId: (st as any).collectionId || 'students', id: st.id },
              stPhoto,
              { thumb: '200x200' },
            )
          : ''
      return {
        id: r.id,
        studentId: r.student,
        studentName: st?.name || 'Aluno removido',
        photoUrl: ownPhotoUrl || stPhotoUrl,
        ownPhotoUrl,
        reason: r.reason || '',
        sort: r.sort ?? 0,
        active: r.active !== false,
      }
    })
  },

  /** Cria/atualiza. file é o File da foto própria (opcional); photo='' remove. */
  async saveCompetition(input: {
    id?: string
    student: string
    reason: string
    active?: boolean
    sort?: number
    file?: File | null
    removePhoto?: boolean
  }): Promise<void> {
    const payload: Record<string, unknown> = {
      student: input.student,
      reason: input.reason || '',
      active: input.active !== false,
      sort: input.sort ?? 0,
    }
    if (input.file) payload.photo = input.file
    if (input.removePhoto) payload.photo = ''

    if (input.id) {
      await pb.collection('student_highlights').update(input.id, payload)
    } else {
      await pb.collection('student_highlights').create(payload)
    }
  },

  async removeCompetition(id: string): Promise<void> {
    await pb.collection('student_highlights').delete(id)
  },

  /** Reordenar: troca o campo sort dos dois destaques vizinhos. */
  async moveCompetition(
    id: string,
    direction: 'up' | 'down',
    list: { id: string; sort: number }[],
  ) {
    const sorted = [...list].sort((a, b) => a.sort - b.sort)
    const idx = sorted.findIndex((r) => r.id === id)
    const swapWith = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1]
    if (!swapWith) return
    const me = sorted[idx]
    await Promise.all([
      pb.collection('student_highlights').update(me.id, { sort: swapWith.sort }),
      pb.collection('student_highlights').update(swapWith.id, { sort: me.sort }),
    ])
  },
}
