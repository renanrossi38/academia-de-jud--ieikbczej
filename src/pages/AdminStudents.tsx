import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import {
  CreateStudentDialog,
  EditStudentDialog,
  beltLabel,
  beltBadgeClass,
} from '@/components/admin/StudentDialogs'
import { studentsService } from '@/services/students'
import { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  Loader2,
  Search,
  X,
  UserPlus,
  Pencil,
  ShieldAlert,
  Calendar,
  Phone,
  UserCheck,
  UserX,
} from 'lucide-react'

export default function AdminStudents() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [students, setStudents] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<User | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const isAluno = (u: Partial<User>) => u.role === 'aluno'

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

    // Tempo real: mantém a lista de alunos sempre atualizada
    pb.collection('users').subscribe('*', (e) => {
      const record = e.record as unknown as User
      if (!isAluno(record)) return
      if (e.action === 'create') {
        setStudents((prev) => [record, ...prev])
      } else if (e.action === 'update') {
        setStudents((prev) => prev.map((s) => (s.id === record.id ? record : s)))
      } else if (e.action === 'delete') {
        setStudents((prev) => prev.filter((s) => s.id !== record.id))
      }
    })

    return () => {
      pb.collection('users').unsubscribe('*')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading])

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) || (s.email || '').toLowerCase().includes(term),
    )
  }, [students, search])

  const activeCount = students.filter((s) => s.active !== false).length
  const inactiveCount = students.length - activeCount

  const handleToggleActive = async (student: User) => {
    setTogglingId(student.id)
    try {
      const updated = await studentsService.updateStudent(student.id, {
        active: student.active === false,
      })
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      toast({
        title: updated.active === false ? 'Aluno desativado' : 'Aluno reativado',
        description: `${updated.name || updated.email} ${
          updated.active === false
            ? 'foi marcado como inativo, mas continua na lista.'
            : 'voltou a ficar ativo na academia.'
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando painel de alunos...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <HankoStamp size="sm" />
            <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
              Administração do Dojo
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
            Gestão de Alunos
          </h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Cadastre, edite e acompanhe os alunos matriculados na academia.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-[#FAF6F0] text-[#1C1B1A] border-[#E8E0D5] text-xs font-semibold px-3 py-1">
            Total de Alunos: {students.length}
          </Badge>
          <Badge className="bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20 text-xs font-semibold px-3 py-1">
            Ativos: {activeCount}
          </Badge>
          <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-xs font-semibold px-3 py-1">
            Inativos: {inactiveCount}
          </Badge>
        </div>
      </div>

      {/* Busca + botão de cadastro */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6560]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
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
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Cadastrar Aluno
        </Button>
      </div>

      {/* Lista: tabela no desktop / cartões no mobile */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-12 text-center max-w-md mx-auto my-6">
          <HankoStamp size="lg" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
            {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno por aqui'}
          </h3>
          <p className="text-xs text-[#6B6560] mt-1">
            {search
              ? 'Tente buscar por outro nome ou e-mail.'
              : 'Cadastre o primeiro aluno da academia para começar.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Faixa</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredStudents.map((student) => {
                  const dateFormatted = new Date(student.created).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                  const isActiveStudent = student.active !== false

                  return (
                    <tr key={student.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <strong className="text-[#1C1B1A] block">{student.name || '—'}</strong>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">{student.email}</td>
                      <td className="py-3.5 px-4 text-[#6B6560]">{student.phone || '—'}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}
                        >
                          {beltLabel(student.belt)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${
                            isActiveStudent
                              ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                              : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
                          }`}
                        >
                          {isActiveStudent ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {dateFormatted}
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
                          <button
                            onClick={() => handleToggleActive(student)}
                            disabled={togglingId === student.id}
                            className={`font-semibold text-xs inline-flex items-center gap-1 disabled:opacity-50 ${
                              isActiveStudent
                                ? 'text-[#6B6560] hover:text-[#C1272D]'
                                : 'text-[#2E7D4F] hover:underline'
                            }`}
                          >
                            {togglingId === student.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isActiveStudent ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            {isActiveStudent ? 'Desativar' : 'Reativar'}
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
              const dateFormatted = new Date(student.created).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
              const isActiveStudent = student.active !== false

              return (
                <div
                  key={student.id}
                  className="p-4 space-y-3 hover:bg-[#FAF6F0]/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm text-[#1C1B1A]">{student.name || '—'}</h4>
                    <Badge
                      className={`text-[10px] font-bold border ${
                        isActiveStudent
                          ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                          : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
                      }`}
                    >
                      {isActiveStudent ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="text-xs text-[#6B6560] space-y-1">
                    <p className="truncate">{student.email}</p>
                    {student.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        {student.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Cadastro em {dateFormatted}
                    </p>
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
                      <button
                        onClick={() => handleToggleActive(student)}
                        disabled={togglingId === student.id}
                        className={`font-semibold text-xs disabled:opacity-50 ${
                          isActiveStudent ? 'text-[#6B6560]' : 'text-[#2E7D4F]'
                        }`}
                      >
                        {togglingId === student.id
                          ? '...'
                          : isActiveStudent
                            ? 'Desativar'
                            : 'Reativar'}
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
        onCreated={(student) => setStudents((prev) => [student, ...prev])}
      />
      <EditStudentDialog
        student={editingStudent}
        onOpenChange={(open) => !open && setEditingStudent(null)}
        onSaved={(updated) =>
          setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
      />

      {/* Aviso de proteção (contas de administrador nunca aparecem nem podem ser alteradas aqui) */}
      <div className="mt-6 flex items-start gap-2 text-[11px] text-[#6B6560]">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Esta lista mostra apenas alunos. Contas de administradores não aparecem e não podem ser
          editadas, desativadas ou excluídas por esta tela.
        </p>
      </div>
    </div>
  )
}
