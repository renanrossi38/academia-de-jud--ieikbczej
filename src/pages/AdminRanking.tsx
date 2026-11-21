import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { beltLabel, beltBadgeClass } from '@/components/admin/StudentDialogs'
import {
  AdminPageHeader,
  AdminSummary,
  AdminEmptyState,
  AdminPageLoader,
} from '@/components/admin/AdminPage'
import PointEntryDialog from '@/components/admin/PointEntryDialog'
import { rankingService, RankingRow } from '@/services/ranking'
import { Attendance, PointEntry, Student } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Trophy,
  Plus,
  Trash2,
  CalendarCheck,
  Award,
  Search,
  Users,
  Medal,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const fmtDate = (v?: string) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}

interface PodiumCardProps {
  row: RankingRow
  place: number
  styles: { border: string; medal: string }
  onAddPoints: (row: RankingRow) => void
}

/** Cartão do pódio (1º, 2º ou 3º lugar). */
const PodiumCard: React.FC<PodiumCardProps> = ({ row, place, styles, onAddPoints }) => (
  <div
    className={`rounded-2xl border shadow-xs p-5 flex flex-col items-center text-center ${styles.border}`}
  >
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center font-serif font-bold text-lg ${styles.medal}`}
    >
      {place}
    </div>
    <h3 className="font-serif font-bold text-base text-[#1C1B1A] mt-2 truncate max-w-full">
      <Link
        to={`/painel/alunos/${row.student.id}`}
        className="text-[#C1272D] hover:underline"
        title="Abrir ficha do aluno"
      >
        {row.student.name || '—'}
      </Link>
    </h3>
    <Badge className={`text-[10px] font-bold border mt-1 ${beltBadgeClass(row.student.belt)}`}>
      {beltLabel(row.student.belt)}
    </Badge>
    <p className="font-serif font-bold text-3xl text-[#C1272D] mt-3">{row.totalPoints}</p>
    <p className="text-[10px] font-serif uppercase tracking-widest text-[#6B6560]">pontos</p>
    <p className="text-[11px] text-[#6B6560] mt-2">
      {row.presences} presença(s) + {row.manualPoints} de competição
    </p>
    <Button
      variant="outline"
      size="sm"
      onClick={() => onAddPoints(row)}
      className="mt-3 border-[#E8E0D5] text-[#1C1B1A] text-[11px] font-semibold hover:bg-[#FAF6F0]"
    >
      <Plus className="w-3 h-3 mr-1" />
      Lançar pontos
    </Button>
  </div>
)

const PODIUM_STYLES = [
  {
    border: 'border-[#C1272D]/40 bg-gradient-to-b from-[#F7E4E2]/60 to-white',
    medal: 'bg-[#C1272D] text-white',
  },
  {
    border: 'border-[#B3B3B3]/50 bg-gradient-to-b from-[#FAF6F0] to-white',
    medal: 'bg-[#9E9E9E] text-white',
  },
  {
    border: 'border-[#C08552]/50 bg-gradient-to-b from-[#F3E4D3]/60 to-white',
    medal: 'bg-[#C08552] text-white',
  },
]

export default function AdminRanking() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [rows, setRows] = useState<RankingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [entryOpen, setEntryOpen] = useState(false)
  const [entryStudent, setEntryStudent] = useState<Student | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<PointEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadRanking = useCallback(async () => {
    setIsLoading(true)
    try {
      setRows(await rankingService.getRanking())
    } catch (err) {
      console.error('Erro ao carregar ranking:', err)
      toast({
        title: 'Erro ao carregar ranking',
        description: 'Não foi possível buscar os dados no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/ranking')
      return
    }
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Esta área é exclusiva para administradores da academia.',
        variant: 'destructive',
      })
      navigate('/')
      return
    }
    loadRanking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, loadRanking])

  // Tempo real: presença marcada em outra sessão entra no ranking na hora
  useRealtime<Attendance>('attendance', () => {
    loadRanking()
  })
  // Tempo real: lançamentos manuais aparecem/removem na hora
  useRealtime<PointEntry>('points_entries', () => {
    loadRanking()
  })

  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  const filteredRest = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rest
    return rest.filter((r) => {
      const name = (r.student.name || '').toLowerCase()
      const classes = r.classes.join(' ').toLowerCase()
      return name.includes(q) || classes.includes(q)
    })
  }, [rest, search])

  const openEntryDialog = (row: RankingRow) => {
    setEntryStudent(row.student)
    setEntryOpen(true)
  }

  const handleEntrySaved = () => {
    // O realtime de points_entries já recarrega o ranking; aqui é só otimismo de UI.
    loadRanking()
  }

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return
    setDeleting(true)
    try {
      await rankingService.deleteEntry(deletingEntry.id)
      toast({
        title: 'Lançamento removido',
        description: `"${deletingEntry.description}" saiu do ranking.`,
      })
      setDeletingEntry(null)
      // O realtime de points_entries recarrega; garantimos também no cliente:
      loadRanking()
    } catch (err: any) {
      console.error('Erro ao remover lançamento:', err)
      toast({
        title: 'Erro ao remover',
        description: err?.message || 'Falha ao remover no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || isLoading) {
    return <AdminPageLoader label="Carregando ranking..." />
  }

  const leader = rows[0]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title="Ranking dos Alunos"
        breadcrumb="Ranking"
        breadcrumbTo="/painel/ranking"
        description="Todos os alunos matriculados em turmas, ordenados por pontos: cada presença vale 1 ponto; competições e eventos são lançados manualmente."
        action={
          <Button
            onClick={() => {
              setEntryStudent(rows[0]?.student ?? null)
              setEntryOpen(true)
            }}
            disabled={rows.length === 0}
            className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar pontuação
          </Button>
        }
      />

      <AdminSummary
        stats={[
          {
            label: 'Alunos no ranking',
            value: rows.length,
            icon: <Users className="w-4 h-4" />,
          },
          {
            label: 'Líder do ranking',
            value: leader ? `${leader.student.name || '—'} · ${leader.totalPoints} pts` : '—',
            icon: <Trophy className="w-4 h-4" />,
            tone: 'red',
          },
          {
            label: 'Lançamentos de competição',
            value: rows.reduce((sum, r) => sum + r.entries.length, 0),
            icon: <Award className="w-4 h-4" />,
          },
        ]}
      />

      {rows.length === 0 ? (
        <AdminEmptyState
          title="Nenhum aluno no ranking"
          description="Matricule alunos em turmas para que apareçam aqui — cada presença marcada vira ponto automaticamente."
          action={
            <Link to="/painel/turmas">
              <Button className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold">
                <Users className="w-4 h-4 mr-2" />
                Gerenciar turmas
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Pódio — 1º, 2º e 3º */}
          {podium.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              {podium.map((row, idx) => (
                <PodiumCard
                  key={row.student.id}
                  row={row}
                  place={idx + 1}
                  styles={PODIUM_STYLES[idx]}
                  onAddPoints={openEntryDialog}
                />
              ))}
            </div>
          )}

          {/* Busca (a partir do 4º lugar) */}
          <div className="mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[#6B6560] absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar aluno ou turma..."
                className="pl-9 h-10 text-sm bg-white border-[#E8E0D5]"
              />
            </div>
          </div>

          {/* Lista completa (a partir do 4º) */}
          {filteredRest.length === 0 ? (
            <AdminEmptyState
              className="my-6"
              title="Nada além do pódio"
              description={
                search
                  ? 'Nenhum aluno encontrado nessa busca — tente outro nome ou turma.'
                  : 'Existem 3 alunos ou menos no ranking. Cada presença marcada vale 1 ponto!'
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 w-14">#</th>
                      <th className="py-3 px-4">Aluno</th>
                      <th className="py-3 px-4">Faixa</th>
                      <th className="py-3 px-4">Turmas</th>
                      <th className="py-3 px-4 text-center">Presenças</th>
                      <th className="py-3 px-4 text-center">Competição</th>
                      <th className="py-3 px-4 text-center">Total</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E0D5]">
                    {filteredRest.map((row, i) => (
                      <tr key={row.student.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                        <td className="py-3.5 px-4 font-serif font-bold text-[#6B6560]">{i + 4}</td>
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/painel/alunos/${row.student.id}`}
                            className="text-[#C1272D] font-bold hover:underline"
                            title="Abrir ficha do aluno"
                          >
                            {row.student.name || '—'}
                          </Link>
                          {row.student.email && (
                            <span className="text-[11px] text-[#6B6560]">{row.student.email}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            className={`text-[10px] font-bold border ${beltBadgeClass(row.student.belt)}`}
                          >
                            {beltLabel(row.student.belt)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-[#6B6560]">{row.classes.join(', ')}</td>
                        <td className="py-3.5 px-4 text-center text-[#2E7D4F] font-bold">
                          <span className="inline-flex items-center gap-1">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {row.presences}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#C1272D] font-bold">
                          {row.manualPoints}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-serif font-bold text-base text-[#1C1B1A]">
                            {row.totalPoints}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEntryDialog(row)}
                              className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Pontuar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cartões (mobile) */}
              <div className="md:hidden divide-y divide-[#E8E0D5]">
                {filteredRest.map((row, i) => (
                  <div key={row.student.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-serif font-bold text-[#6B6560] text-xs">
                            {i + 4}º
                          </span>
                          <h4 className="font-semibold text-sm text-[#1C1B1A] truncate">
                            <Link
                              to={`/painel/alunos/${row.student.id}`}
                              className="text-[#C1272D] hover:underline"
                              title="Abrir ficha do aluno"
                            >
                              {row.student.name || '—'}
                            </Link>
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#6B6560] truncate">
                          {row.classes.join(', ')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-serif font-bold text-xl text-[#C1272D]">
                          {row.totalPoints}
                        </p>
                        <p className="text-[10px] text-[#6B6560]">pontos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        className={`text-[10px] font-bold border ${beltBadgeClass(row.student.belt)}`}
                      >
                        {beltLabel(row.student.belt)}
                      </Badge>
                      <Badge className="bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20 text-[10px] font-semibold">
                        <CalendarCheck className="w-3 h-3 mr-1" />
                        {row.presences} presença(s)
                      </Badge>
                      <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-[10px] font-semibold">
                        {row.manualPoints} competição
                      </Badge>
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => openEntryDialog(row)}
                        className="text-[#C1272D] hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Lançar pontos
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lançamentos manuais de todos os alunos */}
          {rows.some((r) => r.entries.length > 0) && (
            <div className="mt-8">
              <h2 className="font-serif font-bold text-lg text-[#1C1B1A] mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#C1272D]" />
                Lançamentos de competição/evento
              </h2>
              <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs divide-y divide-[#E8E0D5]">
                {rows.flatMap((r) =>
                  r.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 p-3.5 px-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1C1B1A] truncate">
                          {entry.description || 'Sem descrição'}
                        </p>
                        <p className="text-[11px] text-[#6B6560]">
                          {r.student.name || '—'} · {fmtDate(entry.date || entry.created)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-xs font-bold">
                          +{entry.points} pts
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setDeletingEntry(entry)}
                          className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  )),
                )}
              </div>
            </div>
          )}

          {/* Legenda */}
          <div className="mt-6 flex items-center gap-4 text-[11px] text-[#6B6560] flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Medal className="w-3 h-3 text-[#2E7D4F]" /> Presença = 1 ponto (verde)
            </span>
            <span className="inline-flex items-center gap-1">
              <Award className="w-3 h-3 text-[#C1272D]" /> Competição/evento (vermelho)
            </span>
          </div>
        </>
      )}

      <PointEntryDialog
        open={entryOpen}
        student={entryStudent}
        onOpenChange={setEntryOpen}
        onSaved={handleEntrySaved}
      />

      {/* Confirmação de remoção de lançamento */}
      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Remover lançamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              O lançamento <strong className="text-[#1C1B1A]">{deletingEntry?.description}</strong>{' '}
              ({deletingEntry?.points} pts) sairá do total do aluno. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteEntry()
              }}
              disabled={deleting}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Sim, remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
