import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'
import {
  CreateStudentDialog,
  EditStudentDialog,
  beltLabel,
  beltBadgeClass,
  birthDateLabel,
} from '@/components/admin/StudentDialogs'
import { StudentAccessDialog } from '@/components/admin/StudentAccessDialog'
import { studentsService } from '@/services/students'
import { Student } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import {
  AdminPageHeader,
  AdminSummary,
  AdminEmptyState,
  AdminPageLoader,
} from '@/components/admin/AdminPage'
import {
  Search,
  X,
  UserPlus,
  Pencil,
  ShieldAlert,
  Calendar,
  CalendarDays,
  MapPin,
  Phone,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  Users,
} from 'lucide-react'

/** Insere ou substitui um aluno pelo id (evita duplicar com o realtime). */
const upsert = (list: Student[], record: Student): Student[] =>
  list.some((s) => s.id === record.id)
    ? list.map((s) => (s.id === record.id ? record : s))
    : [record, ...list]

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function AdminStudents() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [accessStudent, setAccessStudent] = useState<Student | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadStudents = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await studentsService.listStudents()
      setStudents(data)
    } catch (err) {
      console.error('Erro ao carregar alunos:', err)
      toast({
        title: 'Erro ao carregar alunos',
        description: 'Não foi possível buscar a lista de alunos no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/alunos')
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

    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading])

  // Tempo real: alterações de qualquer administrador aparecem na lista na hora
  useRealtime<Student>('students', (e) => {
    if (e.action === 'delete') {
      setStudents((prev) => prev.filter((s) => s.id !== e.record.id))
      return
    }
    setStudents((prev) => upsert(prev, e.record))
  })

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.phone || '').toLowerCase().includes(term),
    )
  }, [students, search])

  const activeCount = students.filter((s) => s.active).length
  const inactiveCount = students.length - activeCount

  const handleToggleActive = async (student: Student) => {
    setTogglingId(student.id)
    try {
      const updated = await studentsService.updateStudent(student.id, {
        active: !student.active,
      })
      setStudents((prev) => upsert(prev, updated))
      toast({
        title: updated.active ? 'Aluno reativado' : 'Aluno desativado',
        description: `${updated.name} ${
          updated.active
            ? 'voltou a ficar ativo na academia.'
            : 'foi marcado como inativo, mas continua na lista.'
        }`,
      })
    } catch (err: any) {
      console.error('Erro ao alterar status do aluno:', err)
      toast({
        title: 'Erro ao alterar status',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingStudent) return
    setDeleting(true)
    try {
      await studentsService.deleteStudent(deletingStudent.id)
      setStudents((prev) => prev.filter((s) => s.id !== deletingStudent.id))
      toast({
        title: 'Aluno excluído',
        description: `${deletingStudent.name} foi removido definitivamente, junto com o histórico de presença dele.`,
      })
      setDeletingStudent(null)
    } catch (err: any) {
      console.error('Erro ao excluir aluno:', err)
      toast({
        title: 'Erro ao excluir aluno',
        description: err?.message || 'Falha ao excluir no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || isLoading) {
    return <AdminPageLoader label="Carregando painel de alunos..." />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title="Gestão de Alunos"
        description="Cadastre, edite e acompanhe os alunos matriculados na academia."
      >
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Cadastrar Aluno
        </Button>
      </AdminPageHeader>

      <AdminSummary
        counts={[
          { label: 'Total de alunos', value: students.length, icon: Users },
          { label: 'Ativos', value: activeCount, icon: UserCheck, tone: 'green' },
          { label: 'Inativos', value: inactiveCount, icon: UserX, tone: 'red' },
        ]}
      />

      {/* Busca */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6560]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="pl-9 pr-9 h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6560] hover:text-[#1C1B1A]"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lista: tabela no desktop / cartões no mobile */}
      {filteredStudents.length === 0 ? (
        <AdminEmptyState
          title={search ? 'Nenhum aluno encontrado' : 'Nenhum aluno por aqui'}
          hint={
            search
              ? 'Tente buscar por outro nome, e-mail ou telefone.'
              : 'Cadastre o primeiro aluno da academia para começar — ele já aparece aqui na hora.'
          }
          action={
            !search ? (
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Cadastrar primeiro aluno
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Faixa</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Nascimento</th>
                  <th className="py-3 px-4">Endereço</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredStudents.map((student) => {
                  const canCreateAccess = !!student.email && !student.user

                  return (
                    <tr key={student.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <strong className="text-[#1C1B1A] block">{student.name || '—'}</strong>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">{student.phone || '—'}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}
                        >
                          {beltLabel(student.belt)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">
                        <span>{student.email || '—'}</span>
                        {student.user && (
                          <span className="block text-[10px] font-semibold text-[#2E7D4F]">
                            Com acesso ao site
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">
                        {student.birth_date ? birthDateLabel(student.birth_date) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560] max-w-[220px] truncate">
                        {student.address || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${
                            student.active
                              ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                              : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
                          }`}
                        >
                          {student.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(student.created)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="text-[#C1272D] hover:underline font-semibold text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5 inline mr-1" />
                            Editar
                          </button>
                          {canCreateAccess && (
                            <button
                              onClick={() => setAccessStudent(student)}
                              className="text-[#C1272D] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Gerar acesso
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(student)}
                            disabled={togglingId === student.id}
                            className={`font-semibold text-xs inline-flex items-center gap-1 disabled:opacity-50 ${
                              student.active
                                ? 'text-[#6B6560] hover:text-[#C1272D]'
                                : 'text-[#2E7D4F] hover:underline'
                            }`}
                          >
                            {togglingId === student.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : student.active ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            {student.active ? 'Desativar' : 'Reativar'}
                          </button>
                          <button
                            onClick={() => setDeletingStudent(student)}
                            className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cartões (mobile) */}
          <div className="md:hidden divide-y divide-[#E8E0D5]">
            {filteredStudents.map((student) => {
              const canCreateAccess = !!student.email && !student.user

              return (
                <div
                  key={student.id}
                  className="p-4 space-y-3 hover:bg-[#FAF6F0]/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm text-[#1C1B1A]">{student.name || '—'}</h4>
                    <Badge
                      className={`text-[10px] font-bold border ${
                        student.active
                          ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                          : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
                      }`}
                    >
                      {student.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="text-xs text-[#6B6560] space-y-1">
                    <p className="truncate">
                      {student.email || '—'}
                      {student.user && (
                        <span className="ml-2 font-semibold text-[#2E7D4F]">· com acesso</span>
                      )}
                    </p>
                    {student.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        {student.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Cadastro em {formatDate(student.created)}
                    </p>
                    {student.birth_date && (
                      <p className="flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" />
                        Nascimento: {birthDateLabel(student.birth_date)}
                      </p>
                    )}
                    {student.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {student.address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E0D5]">
                    <Badge
                      className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}
                    >
                      Faixa {beltLabel(student.belt)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingStudent(student)}
                        className="text-[#C1272D] hover:underline font-semibold text-xs"
                      >
                        Editar
                      </button>
                      {canCreateAccess && (
                        <button
                          onClick={() => setAccessStudent(student)}
                          className="text-[#C1272D] hover:underline font-semibold text-xs"
                        >
                          Gerar acesso
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(student)}
                        disabled={togglingId === student.id}
                        className={`font-semibold text-xs disabled:opacity-50 ${
                          student.active ? 'text-[#6B6560]' : 'text-[#2E7D4F]'
                        }`}
                      >
                        {togglingId === student.id
                          ? '...'
                          : student.active
                            ? 'Desativar'
                            : 'Reativar'}
                      </button>
                      <button
                        onClick={() => setDeletingStudent(student)}
                        className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateStudentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(student) => setStudents((prev) => upsert(prev, student))}
      />
      <EditStudentDialog
        student={editingStudent}
        onOpenChange={(open) => !open && setEditingStudent(null)}
        onSaved={(updated) => setStudents((prev) => upsert(prev, updated))}
      />
      <StudentAccessDialog
        student={accessStudent}
        onOpenChange={(open) => !open && setAccessStudent(null)}
        onAccessCreated={(updated) => setStudents((prev) => upsert(prev, updated))}
      />

      {/* Aviso: e-mail e conta de acesso são opcionais */}
      {students.length > 0 && (
        <div className="mt-6 flex items-start gap-2 text-[11px] text-[#6B6560]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            O cadastro é um controle interno da academia: o e-mail é opcional. Alunos com e-mail
            podem receber um acesso ao site pelo botão "Gerar acesso".
          </p>
        </div>
      )}

      {/* Confirmação de exclusão definitiva */}
      <AlertDialog
        open={!!deletingStudent}
        onOpenChange={(open) => !open && setDeletingStudent(null)}
      >
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Excluir aluno definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              <strong className="text-[#1C1B1A]">{deletingStudent?.name}</strong> será apagado do
              sistema, junto com todo o histórico de presença dele. Esta ação não pode ser desfeita
              — se o aluno só saiu por um período, prefira "Desativar".
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
