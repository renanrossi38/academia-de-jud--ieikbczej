import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { LinkGuardianAction } from '@/components/admin/LinkGuardianAction'
import { GuardianContactButtons } from '@/components/admin/GuardianContactButtons'
import { accessOptionsFor, studentsService } from '@/services/students'
import { isSessionError } from '@/services/studentsRoute'
import { iniciaisDoNome } from '@/services/highlights'
import pb from '@/lib/pocketbase/client'
import React from 'react'
import {
  feeStanding,
  monthlyFeesService,
  type FeeStanding,
  type OverdueNoticeResult,
} from '@/services/monthlyFees'
import { latestBeltMap } from '@/services/beltPromotions'
import { enrolledStudentIds } from '@/services/classes'
import {
  normalizarTelefone,
  mesCobrancaDeAluno,
  waMeUrl,
  digitosTelefoneValido,
} from '@/services/whatsapp'
import { appSettingsService } from '@/services/appSettings'
import { DEFAULT_FEE_WHATSAPP_TEMPLATE } from '@/services/whatsapp'
import { openStudentsReport, type StudentReportRow } from '@/services/pdfReports'
import { Mail, Send, MessageCircle } from 'lucide-react'
import { Belt, ClassStudent, MonthlyFee, Student } from '@/types'
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
import { AdminRoleBadge } from '@/components/admin/AdminRoleBadge'
import {
  Search,
  X,
  UserPlus,
  Pencil,
  ShieldAlert,
  Calendar,
  CalendarDays,
  MapPin,
  Contact,
  Phone,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  FileDown,
  Users,
  Wallet,
  Settings,
} from 'lucide-react'

/** Insere ou substitui um aluno pelo id (evita duplicar com o realtime). */
const upsert = (list: Student[], record: Student): Student[] =>
  list.some((s) => s.id === record.id)
    ? list.map((s) => (s.id === record.id ? record : s))
    : [record, ...list]

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Turma(s) do aluno para o PDF: mapa aluno → nomes das turmas (class_students + expand). */
async function loadClassNamesByStudent(): Promise<Map<string, string[]>> {
  const links = await pb.collection('class_students').getFullList<ClassStudent>({
    filter: 'student != ""',
    expand: 'class',
  })
  const map = new Map<string, string[]>()
  for (const l of links) {
    const name = l.expand?.class?.name
    if (!l.student || !name) continue
    const list = map.get(l.student) || []
    list.push(name)
    map.set(l.student, list)
  }
  return map
}

/** Avatar do aluno na listagem: foto (quando enviada na ficha) ou iniciais. */
const StudentAvatar: React.FC<{ student: Student }> = ({ student }) => {
  const url = studentsService.getPhotoUrl(student, 'sm')
  return (
    <span className="w-9 h-9 rounded-full overflow-hidden bg-[#F7E4E2] flex items-center justify-center shrink-0">
      {url ? (
        <img
          src={url}
          alt={'Foto de ' + student.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="font-serif font-bold text-xs text-[#C1272D]">
          {iniciaisDoNome(student.name)}
        </span>
      )}
    </span>
  )
}

export default function AdminStudents() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [feesByStudent, setFeesByStudent] = useState<Record<string, MonthlyFee[]>>({})
  /** Ids de alunos matriculados em pelo menos uma turma (class_students). */
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [accessStudent, setAccessStudent] = useState<Student | null>(null)
  /** Modo do diálogo de acesso: 'aluno' (e-mail do aluno) ou 'responsavel'. */
  const [accessMode, setAccessMode] = useState<'aluno' | 'responsavel'>('aluno')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const loadStudents = useCallback(async () => {
    setIsLoading(true)
    try {
      const [data, belts] = await Promise.all([studentsService.listStudents(), latestBeltMap()])
      // A faixa exibida é a última promovida (histórico); o campo manual do
      // cadastro é só o fallback quando o aluno não tem promoção lançada.
      setStudents(data.map((s) => (belts.get(s.id) ? { ...s, belt: belts.get(s.id)! } : s)))
    } catch (err) {
      console.error('Erro ao carregar alunos:', err)
      if (isSessionError(err)) {
        // Sessão fantasma: token morto no servidor. Limpa o authStore e manda
        // para o login em vez de deixar o dono num painel que não salva nada.
        pb.authStore.clear()
        toast({
          title: 'Sua sessão expirou',
          description: 'Sua sessão expirou, entre novamente.',
          variant: 'destructive',
        })
        navigate('/entrar?redirect=/painel/alunos')
        return
      }
      toast({
        title: 'Erro ao carregar alunos',
        description: 'Não foi possível buscar a lista de alunos no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, navigate])

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

  // Tempo real: promoção lançada na ficha atualiza a faixa na lista na hora
  // (recarrega o mapa de últimas promoções e rederiva as faixas exibidas).
  const [beltMap, setBeltMap] = useState<Map<string, Belt>>(new Map())
  const refreshBelts = useCallback(async () => {
    try {
      setBeltMap(await latestBeltMap())
    } catch {
      // silencioso: o fallback é o campo manual do cadastro
    }
  }, [])
  useEffect(() => {
    void refreshBelts()
  }, [refreshBelts])
  useRealtime('belt_promotions', () => {
    void refreshBelts()
  })

  // Mensalidades: carregadas do servidor e mapeadas por aluno (badge de situação).
  // O mapa é sempre RECONSTRUÍDO do servidor — nunca só corrigido localmente —
  // para que badge e contadores não fiquem presos num estado otimista errado.
  const feesLoadingRef = useRef(false)
  const loadFees = useCallback(async () => {
    if (feesLoadingRef.current) return
    feesLoadingRef.current = true
    try {
      const fees = await monthlyFeesService.listAll()
      const map: Record<string, MonthlyFee[]> = {}
      for (const fee of fees) {
        ;(map[fee.student] ||= []).push(fee)
      }
      setFeesByStudent(map)
    } catch (err) {
      console.error('Erro ao carregar mensalidades:', err)
      // Silencioso: a listagem de alunos funciona mesmo sem o módulo de mensalidades
    } finally {
      feesLoadingRef.current = false
    }
  }, [])

  // Matrículas (turmas): a regra de inadimplência definida pelo usuário só vale
  // para quem está em PELO MENOS UMA turma — cliente só da loja nunca aparece
  // como inadimplente, nem recebe cobrança.
  const loadEnrolled = useCallback(async () => {
    try {
      setEnrolledIds(await enrolledStudentIds())
    } catch (err) {
      console.error('Erro ao carregar matrículas:', err)
      // Silencioso: em caso de falha, mantém o último conjunto carregado
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return
    loadFees()
    loadEnrolled()
    // Refetch ao voltar o foco da aba: cobre eventos SSE perdidos (aba em
    // background, queda de conexão) que deixariam o badge desatualizado.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadFees()
        loadEnrolled()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [user, isAdmin, authLoading, loadFees, loadEnrolled])

  // Tempo real: matrícula criada/removida na ficha (outra aba, admin) muda a
  // situação dos badges na hora.
  useRealtime('class_students', () => {
    void loadEnrolled()
  })

  // Tempo real nas mensalidades: atualização otimista imediata (marcar pagamento,
  // excluir lançamento) + refetch com debounce, que é a fonte da verdade.
  const feeRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleFeeRefetch = useCallback(() => {
    if (feeRefetchTimer.current) clearTimeout(feeRefetchTimer.current)
    feeRefetchTimer.current = setTimeout(() => {
      feeRefetchTimer.current = null
      loadFees()
    }, 400)
  }, [loadFees])
  useEffect(
    () => () => {
      if (feeRefetchTimer.current) clearTimeout(feeRefetchTimer.current)
    },
    [],
  )

  useRealtime<MonthlyFee>('monthly_fees', (e) => {
    const fee = e.record
    setFeesByStudent((prev) => {
      if (e.action === 'delete') {
        const next: Record<string, MonthlyFee[]> = {}
        for (const sid of Object.keys(prev)) {
          next[sid] = (prev[sid] || []).filter((f) => f.id !== fee.id)
        }
        return next
      }
      const list = (prev[fee.student] || []).filter((f) => f.id !== fee.id)
      return { ...prev, [fee.student]: [fee, ...list] }
    })
    scheduleFeeRefetch()
  })

  // Situação de mensalidade por aluno — a MESMA lógica dos badges da tabela
  // (feeStanding), para que contadores e badges nunca discordem:
  //  - "Em dia": mensalidade do mês corrente paga (ou, antes do dia 15, nenhum
  //    mês já vencido em aberto);
  //  - "Atrasados": pendência vencida OU — a partir do dia 15 — aluno ativo
  //    sem a mensalidade do mês corrente paga (mesmo sem lançamento);
  //  - "sem lançamentos" = neutro, só antes do dia 15;
  //  - aluno SEM turma nenhuma nunca é inadimplente (regra do usuário: pode ser
  //    só cliente da loja).
  const standingOf = (student: Student, fees: MonthlyFee[]): FeeStanding =>
    feeStanding(fees, new Date(), student.active, enrolledIds.has(student.id))

  const { upToDateCount, overdueCount } = useMemo(() => {
    let emDia = 0
    let atrasados = 0
    for (const s of students) {
      const fees = feesByStudent[s.id] || []
      // Regra do dia 15: antes dela, "sem lançamentos" é neutro (não entra em
      // nenhum contador); a partir do dia 15, aluno ativo sem o mês corrente
      // pago já é inadimplente — mesmo sem lançamento algum.
      if (standingOf(s, fees) === 'sem_lancamentos') continue
      if (standingOf(s, fees) === 'inadimplente') atrasados += 1
      else emDia += 1
    }
    return { upToDateCount: emDia, overdueCount: atrasados }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, feesByStudent, enrolledIds])

  const feeBadgeFor = (studentId: string): { label: string; className: string } => {
    const fees = feesByStudent[studentId]
    const student = students.find((s) => s.id === studentId)
    const standing = student ? standingOf(student, fees || []) : 'sem_lancamentos'
    if (standing === 'inadimplente') {
      return {
        label: 'Inadimplente',
        className: 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20',
      }
    }
    if (!fees || fees.length === 0 || standing === 'sem_lancamentos') {
      return {
        label: 'sem lançamentos',
        className: 'bg-[#F5F2EC] text-[#6B6560] border-[#E8E0D5]',
      }
    }
    return {
      label: 'Em dia',
      className: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
    }
  }

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

  // Faixa exibida: a última promovida (histórico de promoções); sem lançamento,
  // cai para o campo manual do cadastro.
  const beltOf = (s: Student): Belt | '' | undefined => beltMap.get(s.id) ?? s.belt

  // Atrasados COM e-mail cadastrado: os que o botão "Notificar atrasados" alcança.
  const overdueWithEmailCount = useMemo(() => {
    let count = 0
    for (const s of students) {
      const fees = feesByStudent[s.id] || []
      if (standingOf(s, fees) === 'inadimplente' && (s.email || '').trim()) count += 1
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, feesByStudent, enrolledIds])

  // Template de WhatsApp de cobrança — carregado das configurações do painel
  // (Painel → Configurações) e recarregado junto com a página.
  const [waTemplate, setWaTemplate] = useState<string>(DEFAULT_FEE_WHATSAPP_TEMPLATE)
  useEffect(() => {
    let cancel = false
    appSettingsService
      .getFeeTemplates()
      .then((t) => {
        if (!cancel && t.whatsappTemplate) setWaTemplate(t.whatsappTemplate)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  // Atrasado COM celular cadastrado → wa.me com a mensagem de cobrança pronta
  // (mesmo template configurável do e-mail; {mes} pela regra do dia 15).
  const cobrancaWhatsappPara = (student: Student): string | null => {
    const tel = normalizarTelefone(student.phone || '')
    if (!tel) return null
    const fees = feesByStudent[student.id] || []
    if (standingOf(student, fees) !== 'inadimplente') return null
    const mes = mesCobrancaDeAluno(
      fees,
      fees.filter((f) => f.status === 'pago').map((f) => f.reference_month),
      true,
    )
    const msg = appSettingsService.renderFeeMessage(waTemplate, student.name, mes)
    return waMeUrl(tel, msg)
  }

  // Monta a frase final do toast: o painel explica o que realmente aconteceu —
  // quantos saíram, quantos foram pulados (e por quê, com o nome de cada aluno)
  // — em vez de um genérico "não foi possível enviar".
  const describeNoticeResult = (
    result: OverdueNoticeResult,
  ): { tone: 'ok' | 'neutral' | 'warn'; text: string } => {
    const nameList = (names?: string[]) =>
      names && names.length > 0 ? ` (${names.join(', ')})` : ''

    // Nada saiu: explica o motivo real em vez de um "não disparou" genérico.
    if (result.sent === 0) {
      if (result.skippedRecent > 0) {
        return {
          tone: 'neutral',
          text:
            `Nenhum aviso enviado: ${result.skippedRecent} ${result.skippedRecent === 1 ? 'aluno já recebeu aviso' : 'alunos já receberam aviso'}` +
            `${nameList(result.skippedRecentNames)} nos últimos 7 dias (a trava anti-reenvio está ativa).`,
        }
      }
      if (result.skippedNoEmail > 0) {
        return {
          tone: 'warn',
          text:
            `Nenhum aviso enviado: ${result.skippedNoEmail} ${result.skippedNoEmail === 1 ? 'aluno está' : 'alunos estão'} com a mensalidade em atraso, mas ${result.skippedNoEmail === 1 ? 'não tem e-mail cadastrado' : 'não têm e-mail cadastrado'}` +
            `${nameList(result.skippedNoEmailNames)}. Cadastre um e-mail na ficha do aluno para poder avisá-lo.`,
        }
      }
      if (result.failed > 0) {
        return {
          tone: 'warn',
          text: `Falha no envio para ${result.failed} ${result.failed === 1 ? 'aluno' : 'alunos'}${nameList(result.failedNames)} — verifique o e-mail cadastrado e tente novamente.`,
        }
      }
      return {
        tone: 'neutral',
        text: 'Nenhum aviso enviado — na hora do envio não havia mensalidade pendente em atraso no servidor. O badge pode estar defasado; aguarde alguns segundos ou recarregue a página.',
      }
    }

    // Algo saiu — agora a frase completa, com os pulados/falhas junto.
    const parts: string[] = [
      `${result.sent} ${result.sent === 1 ? 'aviso enviado' : 'avisos enviados'}` +
        nameList(result.sentNames),
    ]
    if (result.skippedNoEmail > 0) {
      parts.push(
        `${result.skippedNoEmail} ${result.skippedNoEmail === 1 ? 'aluno pulado sem e-mail cadastrado' : 'alunos pulados sem e-mail cadastrado'}` +
          nameList(result.skippedNoEmailNames),
      )
    }
    if (result.skippedRecent > 0) {
      parts.push(
        `${result.skippedRecent} ${result.skippedRecent === 1 ? 'aluno já avisado nos últimos 7 dias' : 'alunos já avisados nos últimos 7 dias'}` +
          nameList(result.skippedRecentNames),
      )
    }
    if (result.failed > 0) {
      parts.push(
        `${result.failed} ${result.failed === 1 ? 'falha no envio' : 'falhas no envio'}` +
          nameList(result.failedNames),
      )
    }
    return { tone: result.failed > 0 ? 'warn' : 'ok', text: parts.join('; ') + '.' }
  }

  const handleNotifyOverdue = async () => {
    setNotifying(true)
    try {
      const result = await monthlyFeesService.notifyOverdue()
      const { tone, text } = describeNoticeResult(result)
      toast({
        title: 'Avisos de mensalidade em atraso',
        description: text,
        ...(tone === 'warn' && { variant: 'destructive' }),
      })
      setNotifyOpen(false)
    } catch (err: any) {
      console.error('Erro ao enviar avisos de atraso:', err)
      const detail =
        typeof err?.response === 'object' &&
        err.response &&
        typeof err.response.message === 'string'
          ? err.response.message
          : err?.message
      toast({
        title: 'Erro ao enviar avisos',
        description:
          detail && detail !== 'Something went wrong.' && !/failed to|client error/i.test(detail)
            ? detail
            : 'Falha no envio dos avisos no servidor. Tente novamente; se persistir, veja os logs do backend.',
        variant: 'destructive',
      })
    } finally {
      setNotifying(false)
    }
  }

  // Relatório PDF da listagem: reflete EXATAMENTE o que a tela mostra agora —
  // mesmos alunos (filtro de busca aplicado), mesma situação de mensalidade
  // (feeStanding) e as turmas de cada um (buscadas na hora, com expand).
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const handleDownloadPdf = async () => {
    setIsPdfLoading(true)
    try {
      const classMap = await loadClassNamesByStudent().catch(() => new Map<string, string[]>())
      const rows: StudentReportRow[] = filteredStudents.map((s) => {
        const fees = feesByStudent[s.id] || []
        const standing = standingOf(s, fees)
        return {
          name: s.name || '—',
          belt: beltLabel(beltOf(s) ?? '') || 'Sem faixa',
          classes: (classMap.get(s.id) || []).join(', ') || '—',
          active: !!s.active,
          feeStatus:
            standing === 'inadimplente'
              ? 'Inadimplente'
              : standing === 'em_dia'
                ? 'Em dia'
                : 'sem lançamentos',
          phone: s.phone || '',
          guardian: [s.guardian_name, s.guardian_phone].filter(Boolean).join(' · '),
          email: s.email || '',
        }
      })
      const totals = {
        active: rows.filter((r) => r.active).length,
        inactive: rows.filter((r) => !r.active).length,
        emDia: rows.filter((r) => r.feeStatus === 'Em dia').length,
        atrasados: rows.filter((r) => r.feeStatus === 'Inadimplente').length,
      }
      openStudentsReport({
        rows,
        filterNote: search.trim()
          ? `Filtro: busca por “${search.trim()}” (${rows.length} ${rows.length === 1 ? 'aluno' : 'alunos'})`
          : 'Listagem completa do cadastro da academia',
        totals,
      })
    } catch (err: any) {
      console.error('Erro ao gerar PDF de alunos:', err)
      toast({
        title: 'Erro ao gerar o PDF',
        description:
          err?.message || 'Não foi possível montar o relatório. Tente novamente mais tarde.',
        variant: 'destructive',
      })
    } finally {
      setIsPdfLoading(false)
    }
  }

  // A mensagem de cobrança é montada a partir do template editável pelo
  // usuário (app_settings). Se esse template ficar malformado, um erro aqui
  // acontece DURANTE o render de cada linha e derruba a página inteira
  // (tela preta travada) — para o dono e para qualquer admin. Captura o erro
  // e apenas desativa o link, mantendo a listagem utilizável.
  const safeCobrancaUrl = (student: Student): string => {
    try {
      return cobrancaWhatsappPara(student) || ''
    } catch (err) {
      console.error('Template de WhatsApp de cobrança inválido:', err)
      return ''
    }
  }

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
      // Sai da listagem na hora (a listagem já vem da rota própria; nada em cache).
      setStudents((prev) => prev.filter((s) => s.id !== deletingStudent.id))
      toast({
        title: 'Aluno excluído',
        description: `${deletingStudent.name} foi removido definitivamente, junto com o histórico de presença dele.`,
      })
      setDeletingStudent(null)
    } catch (err: unknown) {
      console.error('Erro ao excluir aluno:', err)
      if (isSessionError(err)) {
        // Sessão fantasma (a causa real do "excluir não funciona"): token morto
        // no servidor recusava o DELETE com 404 sem erro na tela. Limpa o
        // authStore e manda para o login, como no fluxo de criação.
        toast({
          title: 'Sua sessão expirou',
          description: 'Sua sessão expirou, entre novamente.',
          variant: 'destructive',
        })
        window.location.assign('/entrar?redirect=/painel/alunos')
        return
      }
      toast({
        title: 'Erro ao excluir aluno',
        description:
          (err instanceof Error && err.message) || 'Falha ao excluir no servidor. Tente novamente.',
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
        breadcrumb="Alunos"
        breadcrumbTo="/painel/alunos"
        description="Cadastre, edite e acompanhe os alunos matriculados na academia."
        action={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="h-10 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
              title="Editar assunto e mensagem do e-mail de cobrança"
            >
              <Link to="/painel/configuracoes">
                <Settings className="w-4 h-4 mr-2" />
                Editar mensagem de cobrança
              </Link>
            </Button>
            <Button
              onClick={() => setNotifyOpen(true)}
              disabled={overdueWithEmailCount === 0}
              variant="outline"
              className="h-10 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
              title={
                overdueWithEmailCount === 0
                  ? 'Nenhum aluno atrasado com e-mail cadastrado'
                  : 'Enviar aviso de mensalidade em atraso por e-mail'
              }
            >
              <Mail className="w-4 h-4 mr-2" />
              Notificar atrasados
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={isPdfLoading}
              variant="outline"
              className="h-10 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
              title="Gerar relatório em PDF da listagem exibida (com os filtros ativos)"
            >
              {isPdfLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              {isPdfLoading ? 'Gerando PDF...' : 'Baixar PDF'}
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Cadastrar Aluno
            </Button>
          </div>
        }
      />

      <AdminSummary
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        stats={[
          {
            label: 'Total de alunos',
            value: students.length,
            icon: <Users className="w-4 h-4" />,
          },
          {
            label: 'Em dia (mensalidade)',
            value: upToDateCount,
            icon: <Wallet className="w-4 h-4" />,
            tone: 'green',
          },
          {
            label: 'Atrasados (mensalidade)',
            value: overdueCount,
            icon: <Calendar className="w-4 h-4" />,
            tone: overdueCount > 0 ? 'red' : 'neutral',
          },
          {
            label: 'Ativos',
            value: activeCount,
            icon: <UserCheck className="w-4 h-4" />,
            tone: 'green',
          },
          {
            label: 'Inativos',
            value: inactiveCount,
            icon: <UserX className="w-4 h-4" />,
            tone: 'red',
          },
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
          description={
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
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mensalidade</th>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredStudents.map((student) => {
                  const access = accessOptionsFor(student)
                  const waUrl = safeCobrancaUrl(student)

                  return (
                    <tr key={student.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar student={student} />
                          <Link
                            to={`/painel/alunos/${student.id}`}
                            className="text-[#C1272D] font-bold hover:underline"
                            title="Abrir ficha do aluno"
                          >
                            {student.name || '—'}
                          </Link>
                        </div>
                        {student.expand?.user?.role === 'admin' && (
                          <AdminRoleBadge
                            isOwner={!!student.expand.user.is_owner}
                            className="ml-1.5 align-middle"
                          />
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">{student.phone || '—'}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${beltBadgeClass(beltOf(student))}`}
                        >
                          {beltLabel(beltOf(student))}
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
                      <td className="py-3.5 px-4 text-[#6B6560]">
                        {student.guardian_name ? (
                          <span>
                            <span className="font-semibold text-[#1C1B1A]">
                              {student.guardian_name}
                            </span>
                            {student.guardian_phone && (
                              <span className="flex items-center gap-1.5 text-[10px]">
                                {student.guardian_phone}
                                <GuardianContactButtons
                                  phone={student.guardian_phone}
                                  studentPhone={student.phone}
                                />
                              </span>
                            )}
                          </span>
                        ) : null}
                        {/* Sem responsável com número válido → WhatsApp pelo
                            telefone PRÓPRIO do aluno (fallback do pedido). */}
                        {!digitosTelefoneValido(student.guardian_phone || '') &&
                          !!digitosTelefoneValido(student.phone || '') && (
                            <span className="flex items-center gap-1.5 text-[10px]">
                              {student.phone}
                              <GuardianContactButtons studentPhone={student.phone} />
                            </span>
                          )}
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
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${feeBadgeFor(student.id).className}`}
                        >
                          {feeBadgeFor(student.id).label}
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
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#128C4B] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                              title="Abrir conversa no WhatsApp com a mensagem de cobrança pronta"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="text-[#C1272D] hover:underline font-semibold text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5 inline mr-1" />
                            Editar
                          </button>
                          {access.own && (
                            <button
                              onClick={() => {
                                setAccessMode('aluno')
                                setAccessStudent(student)
                              }}
                              className="text-[#C1272D] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Gerar acesso
                            </button>
                          )}
                          {access.guardian && (
                            <button
                              onClick={() => {
                                setAccessMode('responsavel')
                                setAccessStudent(student)
                              }}
                              className="text-[#7A6AA8] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                              title={`Criar a conta com o e-mail do responsável (${access.guardianEmail})`}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Acesso do responsável ({access.guardianEmail})
                            </button>
                          )}
                          {access.none && (
                            <span
                              className="text-[#6B6560] text-[10px] opacity-70 inline-flex items-center gap-1"
                              title="Preencha o e-mail do aluno ou do responsável para gerar o acesso"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Sem e-mail p/ acesso
                            </span>
                          )}
                          {/* Órfão (sem conta, mas com e-mail do responsável):
                              vincula a ficha à conta que o e-mail JÁ tem,
                              sem criar conta duplicada (caso Tatiane/Isabelly). */}
                          {!student.user && !!student.guardian_email?.trim() && (
                            <LinkGuardianAction
                              student={student}
                              onLinked={(updated) => setStudents((prev) => upsert(prev, updated))}
                            />
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
              const access = accessOptionsFor(student)
              const waUrl = safeCobrancaUrl(student)

              return (
                <div
                  key={student.id}
                  className="p-4 space-y-3 hover:bg-[#FAF6F0]/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm text-[#1C1B1A]">
                      <Link
                        to={`/painel/alunos/${student.id}`}
                        className="text-[#C1272D] hover:underline"
                        title="Abrir ficha do aluno"
                      >
                        {student.name || '—'}
                      </Link>
                      {student.expand?.user?.role === 'admin' && (
                        <AdminRoleBadge
                          isOwner={!!student.expand.user.is_owner}
                          className="ml-1.5 align-middle"
                        />
                      )}
                    </h4>
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
                        {/* WhatsApp pelo telefone PRÓPRIO quando não há
                            responsável com número válido (fallback do pedido). */}
                        {!digitosTelefoneValido(student.guardian_phone || '') &&
                          !!digitosTelefoneValido(student.phone || '') && (
                            <GuardianContactButtons studentPhone={student.phone} />
                          )}
                      </p>
                    )}
                    {/* Aluno SEM telefone próprio, mas responsável com número
                        válido: os botões já ficam na linha "Resp." abaixo. */}
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Cadastro em {formatDate(student.created)}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Wallet className="w-3 h-3" />
                      Mensalidade:
                      <Badge
                        className={`text-[10px] font-bold border ${feeBadgeFor(student.id).className}`}
                      >
                        {feeBadgeFor(student.id).label}
                      </Badge>
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
                    {student.guardian_name && (
                      <p className="flex items-center gap-1.5">
                        <Contact className="w-3 h-3" />
                        <span>
                          Resp.: {student.guardian_name}
                          {student.guardian_phone ? ` · ${student.guardian_phone}` : ''}
                        </span>
                        <GuardianContactButtons
                          phone={student.guardian_phone}
                          studentPhone={student.phone}
                        />
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E0D5]">
                    <Badge
                      className={`text-[10px] font-bold border ${beltBadgeClass(beltOf(student))}`}
                    >
                      Faixa {beltLabel(beltOf(student))}
                    </Badge>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#128C4B] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                          title="Abrir conversa no WhatsApp com a mensagem de cobrança pronta"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => setEditingStudent(student)}
                        className="text-[#C1272D] hover:underline font-semibold text-xs"
                      >
                        Editar
                      </button>
                      {access.own && (
                        <button
                          onClick={() => {
                            setAccessMode('aluno')
                            setAccessStudent(student)
                          }}
                          className="text-[#C1272D] hover:underline font-semibold text-xs"
                        >
                          Gerar acesso
                        </button>
                      )}
                      {access.guardian && (
                        <button
                          onClick={() => {
                            setAccessMode('responsavel')
                            setAccessStudent(student)
                          }}
                          className="text-[#7A6AA8] hover:underline font-semibold text-xs"
                          title={`Criar a conta com o e-mail do responsável (${access.guardianEmail})`}
                        >
                          Acesso do responsável ({access.guardianEmail})
                        </button>
                      )}
                      {access.none && (
                        <span
                          className="text-[#6B6560] text-[10px] opacity-70"
                          title="Preencha o e-mail do aluno ou do responsável para gerar o acesso"
                        >
                          Sem e-mail p/ acesso
                        </span>
                      )}
                      {/* Órfão (sem conta, mas com e-mail do responsável):
                          vincula à conta existente — caso Tatiane/Isabelly. */}
                      {!student.user && !!student.guardian_email?.trim() && (
                        <LinkGuardianAction
                          student={student}
                          label="Vincular ao responsável"
                          onLinked={(updated) => setStudents((prev) => upsert(prev, updated))}
                        />
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
        mode={accessMode}
        onOpenChange={(open) => !open && setAccessStudent(null)}
        onAccessCreated={(updated) => setStudents((prev) => upsert(prev, updated))}
      />

      {/* Aviso: e-mail e conta de acesso são opcionais */}
      {students.length > 0 && (
        <div className="mt-6 flex items-start gap-2 text-[11px] text-[#6B6560]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            O cadastro é um controle interno da academia: o e-mail é opcional. Alunos com e-mail
            recebem um acesso ao site pelo botão "Gerar acesso"; alunos menores de idade (ou sem
            e-mail próprio) podem receber o acesso pelo e-mail do responsável, em "Acesso do
            responsável" — o responsável logado acompanha as mensalidades, pedidos e presenças do
            aluno. Sem nenhum e-mail (do aluno ou do responsável), não é possível gerar acesso.
          </p>
        </div>
      )}

      {/* Confirmação do envio dos avisos de mensalidade em atraso */}
      <AlertDialog open={notifyOpen} onOpenChange={(open) => !open && setNotifyOpen(false)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Notificar alunos atrasados?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              {overdueWithEmailCount === 0 ? (
                <>Nenhum aluno atrasado com e-mail cadastrado.</>
              ) : (
                <>
                  Será enviado um e-mail de aviso para{' '}
                  <strong className="text-[#1C1B1A]">
                    {overdueWithEmailCount} {overdueWithEmailCount === 1 ? 'aluno' : 'alunos'}
                  </strong>{' '}
                  com mensalidade em atraso e e-mail cadastrado. Alunos sem e-mail no cadastro serão
                  pulados, sem erro.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleNotifyOverdue()
              }}
              disabled={notifying || overdueWithEmailCount === 0}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {notifying ? (
                <>
                  <Send className="w-4 h-4 mr-2 animate-pulse" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar avisos
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
