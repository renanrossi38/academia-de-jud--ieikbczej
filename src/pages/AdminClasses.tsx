import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { classesService, classLevelLabel, classLevelBadgeClass } from '@/services/classes'
import { Class, ClassStudent } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import { Loader2, Users, Pencil, Trash2, Plus, Layers, CalendarCheck } from 'lucide-react'

const selectClass =
  'w-full h-9 text-sm rounded-md border border-[#E8E0D5] bg-white px-3 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

const LEVEL_OPTIONS: { label: string; value: string }[] = [
  { label: 'Sem nível', value: '' },
  { label: 'Iniciante', value: 'iniciante' },
  { label: 'Intermediário', value: 'intermediario' },
  { label: 'Avançado', value: 'avancado' },
]

interface ClassFormState {
  name: string
  level: string
  schedule: string
  monthly_fee: string
  vagas: string
  active: boolean
}

const emptyForm: ClassFormState = {
  name: '',
  level: '',
  schedule: '',
  monthly_fee: '',
  vagas: '20',
  active: true,
}

interface ClassFormDialogProps {
  open: boolean
  editing: Class | null
  onOpenChange: (open: boolean) => void
  onSaved: (saved: Class) => void
}

const ClassFormDialog: React.FC<ClassFormDialogProps> = ({
  open,
  editing,
  onOpenChange,
  onSaved,
}) => {
  const { toast } = useToast()
  const [form, setForm] = useState<ClassFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name: editing.name,
              level: editing.level || '',
              schedule: editing.schedule || '',
              monthly_fee: editing.monthly_fee != null ? String(editing.monthly_fee) : '',
              vagas: String(editing.vagas ?? ''),
              active: editing.active !== false,
            }
          : emptyForm,
      )
    }
  }, [open, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para a turma (ex.: Infantil — Ter/Qui).',
        variant: 'destructive',
      })
      return
    }
    const vagasNum = Number(form.vagas)
    if (!Number.isFinite(vagasNum) || vagasNum < 1) {
      toast({
        title: 'Vagas inválidas',
        description: 'Informe o número de vagas da turma (mínimo 1).',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const saved = editing
        ? await classesService.updateClass(editing.id, {
            name: form.name,
            level: form.level as Class['level'],
            schedule: form.schedule,
            monthly_fee:
              form.monthly_fee === '' ? null : Number(form.monthly_fee.replace(',', '.')),
            vagas: Math.round(vagasNum),
            active: form.active,
          })
        : await classesService.createClass({
            name: form.name,
            level: form.level as Class['level'],
            schedule: form.schedule,
            monthly_fee:
              form.monthly_fee === '' ? null : Number(form.monthly_fee.replace(',', '.')),
            vagas: Math.round(vagasNum),
            active: form.active,
          })
      onSaved(saved)
      onOpenChange(false)
      toast({
        title: editing ? 'Turma atualizada' : 'Turma criada!',
        description: editing
          ? `As alterações em "${saved.name}" foram salvas.`
          : `A turma "${saved.name}" já aparece na listagem.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar turma:', err)
      toast({
        title: 'Erro ao salvar turma',
        description: err?.message || 'Falha ao gravar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A]">
            {editing ? 'Editar turma' : 'Nova turma'}
          </DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs">
            {editing
              ? 'Altere o nome, o nível ou o status da turma.'
              : 'Crie uma turma para organizar os alunos e fazer a chamada de presença.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="class-name" className="text-xs font-bold text-[#1C1B1A]">
              Nome da turma *
            </Label>
            <Input
              id="class-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Infantil — Ter/Qui"
              className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-schedule" className="text-xs font-bold text-[#1C1B1A]">
              Horário
            </Label>
            <Input
              id="class-schedule"
              value={form.schedule}
              onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
              placeholder="Ex.: Ter/Qui 19h–20h"
              className="h-9 text-sm bg-white border-[#E8E0D5]"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-fee" className="text-xs font-bold text-[#1C1B1A]">
              Mensalidade (R$)
            </Label>
            <Input
              id="class-fee"
              value={form.monthly_fee}
              onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))}
              inputMode="decimal"
              placeholder="Ex.: 150.00"
              className="h-9 text-sm bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-vagas" className="text-xs font-bold text-[#1C1B1A]">
              Vagas *
            </Label>
            <Input
              id="class-vagas"
              value={form.vagas}
              onChange={(e) => setForm((f) => ({ ...f, vagas: e.target.value }))}
              inputMode="numeric"
              placeholder="Ex.: 20"
              className="h-9 text-sm bg-white border-[#E8E0D5]"
            />
            <p className="text-[11px] text-[#6B6560]">
              Limite de alunos matriculados nesta turma. Matrículas além disso são bloqueadas.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="class-level" className="text-xs font-bold text-[#1C1B1A]">
              Nível
            </Label>
            <select
              id="class-level"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              className={selectClass}
            >
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#1C1B1A]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="w-4 h-4 accent-[#C1272D]"
            />
            Turma ativa
          </label>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editing ? (
                'Salvar alterações'
              ) : (
                'Criar turma'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Insere ou substitui uma turma pelo id (evita duplicar com o realtime). */
const upsert = (list: Class[], record: Class): Class[] =>
  list.some((c) => c.id === record.id)
    ? list.map((c) => (c.id === record.id ? record : c))
    : [record, ...list]

export default function AdminClasses() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [classes, setClasses] = useState<Class[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [deletingClass, setDeletingClass] = useState<Class | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadClasses = useCallback(async () => {
    setIsLoading(true)
    try {
      const [data, counts] = await Promise.all([
        classesService.listClasses(),
        classesService.countStudentsByClass(),
      ])
      setClasses(data)
      setMemberCounts(counts)
    } catch (err) {
      console.error('Erro ao carregar turmas:', err)
      toast({
        title: 'Erro ao carregar turmas',
        description: 'Não foi possível buscar a lista de turmas no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/turmas')
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
    loadClasses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading])

  // Tempo real: turmas e matrículas alteradas por outro admin aparecem na hora
  useRealtime<Class>('classes', (e) => {
    if (e.action === 'delete') {
      setClasses((prev) => prev.filter((c) => c.id !== e.record.id))
      return
    }
    setClasses((prev) => upsert(prev, e.record))
  })
  useRealtime<ClassStudent>('class_students', (e) => {
    const classId = (e.record as { class?: string }).class
    if (!classId) return
    setMemberCounts((prev) => {
      const current = prev[classId] ?? 0
      const next = { ...prev }
      if (e.action === 'create') next[classId] = current + 1
      if (e.action === 'delete') next[classId] = Math.max(0, current - 1)
      return next
    })
  })

  const activeCount = useMemo(() => classes.filter((c) => c.active !== false).length, [classes])

  const handleDelete = async () => {
    if (!deletingClass) return
    setDeleting(true)
    try {
      await classesService.deleteClass(deletingClass.id)
      setClasses((prev) => prev.filter((c) => c.id !== deletingClass.id))
      toast({
        title: 'Turma excluída',
        description: `"${deletingClass.name}" foi removida. O histórico de presença dos alunos permanece.`,
      })
      setDeletingClass(null)
    } catch (err: any) {
      console.error('Erro ao excluir turma:', err)
      toast({
        title: 'Erro ao excluir turma',
        description: err?.message || 'Falha ao excluir no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando turmas...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <HankoStamp size="sm" />
            <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
              Administração do Dojo
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">Turmas</h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Organize os alunos por turma e faça a chamada de presença dentro de cada uma.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-[#FAF6F0] text-[#1C1B1A] border-[#E8E0D5] text-xs font-semibold px-3 py-1">
            Total: {classes.length}
          </Badge>
          <Badge className="bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20 text-xs font-semibold px-3 py-1">
            Ativas: {activeCount}
          </Badge>
          <Button
            onClick={() => {
              setEditingClass(null)
              setFormOpen(true)
            }}
            className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Turma
          </Button>
        </div>
      </div>

      {/* Lista de turmas */}
      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-12 text-center max-w-md mx-auto my-6">
          <HankoStamp size="lg" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">Nenhuma turma criada</h3>
          <p className="text-xs text-[#6B6560] mt-1 mb-6">
            Crie a primeira turma para começar a matricular alunos e registrar presenças.
          </p>
          <Button
            onClick={() => {
              setEditingClass(null)
              setFormOpen(true)
            }}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar turma
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5 flex flex-col gap-3 hover:border-[#C1272D]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F7E4E2]/60 border border-[#C1272D]/20 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 text-[#C1272D]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold text-base text-[#1C1B1A] truncate">
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge
                        className={`text-[10px] font-bold border ${classLevelBadgeClass(c.level)}`}
                      >
                        {classLevelLabel(c.level)}
                      </Badge>
                      <Badge
                        className={`text-[10px] font-bold border ${
                          c.active !== false
                            ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                            : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
                        }`}
                      >
                        {c.active !== false ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#6B6560] flex-wrap">
                {c.schedule && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    {c.schedule}
                  </span>
                )}
                {c.monthly_fee != null && (
                  <span className="font-bold text-[#1C1B1A]">
                    {c.monthly_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    /mês
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {memberCounts[c.id] ?? '…'}/{c.vagas ?? '—'} vagas ocupadas
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#E8E0D5] mt-auto">
                <Link
                  to={`/painel/turmas/${c.id}`}
                  className="text-[#C1272D] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Alunos e chamada
                </Link>
                <button
                  onClick={() => {
                    setEditingClass(c)
                    setFormOpen(true)
                  }}
                  className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => setDeletingClass(c)}
                  className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClassFormDialog
        open={formOpen}
        editing={editingClass}
        onOpenChange={setFormOpen}
        onSaved={(saved) => setClasses((prev) => upsert(prev, saved))}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deletingClass} onOpenChange={(open) => !open && setDeletingClass(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Excluir turma?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              A turma <strong className="text-[#1C1B1A]">{deletingClass?.name}</strong> será apagada
              junto com as matrículas dos alunos nela. O histórico de presença dos alunos permanece
              intacto. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
