import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pb } from '@/lib/pocketbase/client'
import { Student } from '@/types'
import { highlightsService, iniciaisDoNome } from '@/services/highlights'
import { studentsService } from '@/services/students'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPageLoader,
  AdminSummary,
} from '@/components/admin/AdminPage'
import { HeroUnderline } from '@/components/hero/HeroDecor'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Loader2,
  Medal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react'

/** Registro da listagem do painel (com foto resolvida e aluno expandido). */
interface HighlightRow {
  id: string
  studentId: string
  studentName: string
  photoUrl: string
  ownPhotoUrl: string
  reason: string
  sort: number
  active: boolean
}

interface FormState {
  studentId: string
  reason: string
  active: boolean
}

const emptyForm: FormState = { studentId: '', reason: '', active: true }

/** Avatar redondo com foto ou iniciais — reutilizado na listagem do painel. */
export const HighlightAvatar: React.FC<{
  photoUrl?: string
  name: string
  className?: string
}> = ({ photoUrl, name, className }) => (
  <div
    className={cn(
      'w-11 h-11 rounded-full overflow-hidden shrink-0 bg-[#F7E4E2] flex items-center justify-center border border-[#E8E0D5]',
      className,
    )}
  >
    {photoUrl ? (
      <img src={photoUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <span className="font-serif font-bold text-sm text-[#C1272D]">{iniciaisDoNome(name)}</span>
    )}
  </div>
)

/** Dialog de criação/edição de destaque de competição. */
const HighlightDialog: React.FC<{
  open: boolean
  editing: HighlightRow | null
  students: Student[]
  onClose: () => void
  onSaved: () => void
}> = ({ open, editing, students, onClose, onSaved }) => {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [search, setSearch] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const [sort, setSort] = useState(0)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Preenche ao abrir
  useEffect(() => {
    if (!open) return
    setForm({
      studentId: editing?.studentId || '',
      reason: editing?.reason || '',
      active: editing ? editing.active : true,
    })
    setSort(editing?.sort ?? 0)
    setFile(null)
    setRemovePhoto(false)
    setPreview('')
    setSearch('')
  }, [open, editing])

  // URL local de preview do arquivo escolhido
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = students.filter((s) => s.active !== false)
    if (!q) return base.slice(0, 8)
    return base
      .filter((s) => s.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ai = a.name.toLowerCase().indexOf(q)
        const bi = b.name.toLowerCase().indexOf(q)
        return ai - bi
      })
      .slice(0, 8)
  }, [students, search])

  const selected = students.find((s) => s.id === form.studentId)
  const editingOwnPhoto = !!editing?.ownPhotoUrl

  const handleFile = (f: File | null) => {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      toast({
        title: 'Formato não aceito',
        description: 'Envie a foto em JPG, PNG ou WEBP.',
        variant: 'destructive',
      })
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({
        title: 'Foto muito grande',
        description: 'Envie uma imagem de até 5 MB.',
        variant: 'destructive',
      })
      return
    }
    setFile(f)
    setRemovePhoto(false)
  }

  const handleSave = async () => {
    if (!form.studentId) {
      toast({ title: 'Escolha o aluno', variant: 'destructive' })
      return
    }
    if (!form.reason.trim()) {
      toast({
        title: 'Escreva o título/motivo',
        description: 'Ex.: Ouro — Campeonato Estadual 2026',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await highlightsService.saveCompetition({
        id: editing?.id,
        student: form.studentId,
        reason: form.reason.trim(),
        active: form.active,
        sort,
        file,
        removePhoto,
      })
      toast({
        title: editing ? 'Destaque atualizado!' : 'Destaque criado!',
        description: 'A home mostra o destaque em instantes.',
      })
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('[highlights] erro ao salvar:', err)
      toast({
        title: 'Falha ao salvar destaque',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white border-[#E8E0D5] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#C1272D]" />
            {editing ? 'Editar destaque' : 'Novo destaque de competição'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6560]">
            {editing
              ? 'Troque o aluno, o motivo ou a foto — a home atualiza sozinha.'
              : 'Escolha o aluno, escreva o motivo do destaque e, se quiser, suba uma foto própria.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Aluno (busca) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1C1B1A] font-medium">Aluno *</Label>
            {selected ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0]/70">
                <HighlightAvatar name={selected.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1C1B1A] truncate">{selected.name}</p>
                  <p className="text-[11px] text-[#6B6560]">Selecionado</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#E8E0D5] text-xs"
                  onClick={() => setForm({ ...form, studentId: '' })}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A948C]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar aluno pelo nome..."
                    className="pl-9 bg-white border-[#E8E0D5]"
                  />
                </div>
                <div className="rounded-xl border border-[#E8E0D5] divide-y divide-[#F0EAE0] max-h-48 overflow-y-auto">
                  {filtered.length === 0 && (
                    <p className="text-xs text-[#6B6560] p-3">
                      Nenhum aluno ativo encontrado para "{search}".
                    </p>
                  )}
                  {filtered.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, studentId: s.id })
                        setSearch('')
                      }}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-[#FAF6F0] transition-colors text-left"
                    >
                      <HighlightAvatar name={s.name} />
                      <span className="text-sm text-[#1C1B1A] truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Título / motivo */}
          <div className="space-y-1.5">
            <Label htmlFor="hl-reason" className="text-xs text-[#1C1B1A] font-medium">
              Título / motivo *
            </Label>
            <Textarea
              id="hl-reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex.: Ouro — Campeonato Estadual 2026"
              rows={2}
              className="bg-white border-[#E8E0D5] text-sm"
            />
          </div>

          {/* Foto própria (opcional) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1C1B1A] font-medium">
              Foto do destaque (opcional)
            </Label>
            <p className="text-[11px] text-[#6B6560]">
              Se não subir, usamos a foto do cadastro do aluno. JPG, PNG ou WEBP, até 5&nbsp;MB.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#E8E0D5] bg-[#FAF6F0] flex items-center justify-center shrink-0">
                {preview ? (
                  <img src={preview} alt="Prévia" className="w-full h-full object-cover" />
                ) : removePhoto ? (
                  <span className="text-[10px] text-[#9A948C] text-center px-1">Removida</span>
                ) : editingOwnPhoto ? (
                  <img src={editing.ownPhotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-[#C8BFAF]" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#E8E0D5] text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  {editingOwnPhoto ? 'Trocar foto' : 'Enviar foto'}
                </Button>
                {(file || editingOwnPhoto) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#C1272D] text-xs h-7"
                    onClick={() => {
                      setFile(null)
                      setRemovePhoto(true)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    Remover foto
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {/* Ordenação + ativo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hl-sort" className="text-xs text-[#1C1B1A] font-medium">
                Ordem de exibição
              </Label>
              <Input
                id="hl-sort"
                type="number"
                min={0}
                value={sort}
                onChange={(e) => setSort(Number(e.target.value) || 0)}
                className="bg-white border-[#E8E0D5]"
              />
              <p className="text-[11px] text-[#6B6560]">Menor aparece primeiro.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#1C1B1A] font-medium">Visível na home</Label>
              <button
                type="button"
                onClick={() => setForm({ ...form, active: !form.active })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors mt-1',
                  form.active ? 'bg-[#2E7D4F]' : 'bg-[#9A948C]',
                )}
                aria-label="Alternar visibilidade do destaque"
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    form.active ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
              <p className="text-[11px] text-[#6B6560]">
                {form.active ? 'Aparece na home' : 'Escondido da home'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-[#E8E0D5] text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : editing ? (
              'Salvar alterações'
            ) : (
              'Criar destaque'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Painel "Destaques" — gerenciador de destaques de competição. */
export default function AdminHighlights() {
  const { toast } = useToast()
  const [rows, setRows] = useState<HighlightRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HighlightRow | null>(null)
  const [removing, setRemoving] = useState<HighlightRow | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, st] = await Promise.all([
        highlightsService.listCompetition(),
        studentsService.listStudents(),
      ])
      setRows(list)
      setStudents(st)
    } catch (err: any) {
      console.error('[highlights] erro ao carregar:', err)
      toast({
        title: 'Falha ao carregar destaques',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('student_highlights', load)
  useRealtime('students', load)

  const handleMove = async (row: HighlightRow, direction: 'up' | 'down') => {
    setMovingId(row.id)
    try {
      await highlightsService.moveCompetition(
        row.id,
        direction,
        rows.map((r) => ({ id: r.id, sort: r.sort })),
      )
      await load()
    } catch (err: any) {
      toast({
        title: 'Falha ao reordenar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setMovingId(null)
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    try {
      await highlightsService.removeCompetition(removing.id)
      toast({ title: 'Destaque removido' })
      setRemoving(null)
      await load()
    } catch (err: any) {
      toast({
        title: 'Falha ao remover',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const activeCount = rows.filter((r) => r.active).length

  if (loading) return <AdminPageLoader label="Carregando destaques..." />

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <AdminPageHeader
        title="Destaques"
        breadcrumb="Destaques"
        breadcrumbTo="/painel/destaques"
        icon={<Medal className="w-7 h-7" />}
        description="Alunos destacados em competições, exibidos na seção Destaques da página inicial. O destaque do mês (medalha fica fica) continua automático."
        action={
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo destaque
          </Button>
        }
      />

      {rows.length > 0 && (
        <AdminSummary
          stats={[
            { value: rows.length, label: 'Cadastrados', tone: 'neutral' },
            {
              value: activeCount,
              label: 'Visíveis na home',
              tone: 'red',
              icon: <Trophy className="w-4 h-4" />,
            },
          ]}
          className="sm:max-w-xs"
        />
      )}

      {rows.length === 0 ? (
        <AdminEmptyState
          icon={<Trophy className="w-12 h-12" />}
          title="Nenhum destaque de competição ainda"
          description="Crie o primeiro: escolha o aluno, escreva o motivo (ex.: Ouro — Campeonato Estadual 2026) e envie uma foto se quiser."
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo destaque
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className={cn(
                'bg-white rounded-2xl border border-[#E8E0D5] p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-xs',
                !row.active && 'opacity-60',
              )}
            >
              <HighlightAvatar
                photoUrl={row.photoUrl}
                name={row.studentName}
                className="w-14 h-14"
              />
              <div className="min-w-0 flex-1">
                <p className="font-serif font-bold text-[#1C1B1A] leading-tight">
                  {row.studentName}
                </p>
                <p className="text-xs text-[#6B6560] mt-0.5 line-clamp-2">{row.reason || '—'}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#9A948C] mt-1">
                  Ordem {row.sort}
                  {!row.active && ' · escondido da home'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end flex-wrap">
                <div className="flex items-center gap-1 mr-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-[#E8E0D5]"
                    disabled={idx === 0 || movingId === row.id}
                    onClick={() => handleMove(row, 'up')}
                    aria-label={'Mover ' + row.studentName + ' para cima'}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-[#E8E0D5]"
                    disabled={idx === rows.length - 1 || movingId === row.id}
                    onClick={() => handleMove(row, 'down')}
                    aria-label={'Mover ' + row.studentName + ' para baixo'}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#E8E0D5] text-xs h-9"
                  onClick={() => {
                    setEditing(row)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#C1272D]/30 text-[#C1272D] hover:bg-[#F7E4E2] text-xs h-9"
                  onClick={() => setRemoving(row)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <HeroUnderline className="w-24 h-2" />
      </div>

      <HighlightDialog
        open={dialogOpen}
        editing={editing}
        students={students}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSaved={load}
      />

      {/* Confirmação de remoção */}
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm bg-white border-[#E8E0D5]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#1C1B1A]">Remover destaque?</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6560]">
              O destaque de {removing?.studentName} sai da home imediatamente. O cadastro do aluno
              não é afetado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoving(null)}
              className="border-[#E8E0D5] text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRemove}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
