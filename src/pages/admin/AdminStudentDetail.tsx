import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { KeyRound, UserRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AdminPageHeader, AdminPageLoader, AdminSummary } from '@/components/admin/AdminPage'
import { EditStudentDialog } from '@/components/admin/StudentDialogs'
import { attendanceService } from '@/services/attendance'
import { classesService } from '@/services/classes'
import { rankingService } from '@/services/ranking'
import { studentsService } from '@/services/students'
import { studentOrdersService } from '@/services/studentOrders'
import { ordersService } from '@/services/orders'
import { Attendance, Class, Order, OrderItem, PointEntry, Student } from '@/types'
import {
  AttendancePanel,
  CompetitionPanel,
  FinancePanel,
  fmtBRL,
  PersonalDataPanel,
} from './StudentDetailPanels'

const TAB_CLASS =
  'rounded-lg text-[11px] sm:text-xs font-serif font-semibold text-[#6B6560] data-[state=active]:bg-white data-[state=active]:text-[#C1272D] data-[state=active]:shadow-xs px-3 py-2'

/**
 * Página individual do aluno no painel admin (/painel/alunos/:id).
 * Abas: Dados Pessoais · Frequência & Competições · Financeiro.
 */
export default function AdminStudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [student, setStudent] = useState<Student | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [points, setPoints] = useState<PointEntry[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const loadAll = useCallback(async () => {
    if (!id) return
    try {
      const s = await studentsService.getStudentById(id)
      if (!s) {
        setStudent(null)
        return
      }
      setStudent(s)

      const enrolled = await classesService.listClassesOfStudent(s.id)
      setClasses(enrolled)

      const [att, pts] = await Promise.all([
        attendanceService.listByStudent(s.id),
        rankingService.listEntriesByStudent(s.id),
      ])
      setAttendance(att)
      setPoints(pts)

      if (s.user) {
        const os = await studentOrdersService.listByUser(s.user)
        setOrders(os)
        const items = await Promise.all(
          os.map(async (o) => ({
            orderId: o.id,
            items: await ordersService.getOrderItems(o.id),
          })),
        )
        const map: Record<string, OrderItem[]> = {}
        items.forEach((pair) => {
          map[pair.orderId] = pair.items
        })
        setItemsByOrder(map)
      } else {
        setOrders([])
        setItemsByOrder({})
      }
    } catch (err) {
      console.error('Erro ao carregar ficha do aluno:', err)
      toast({
        title: 'Erro ao carregar ficha do aluno',
        description: 'Não foi possível buscar os dados no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [id, toast])

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
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, loadAll])

  // Atualização ao vivo: presença, pontuação, matrículas, turmas, pedidos e aluno
  useRealtime('attendance', () => void loadAll())
  useRealtime('points_entries', () => void loadAll())
  useRealtime('class_students', () => void loadAll())
  useRealtime('classes', () => void loadAll())
  useRealtime('orders', () => void loadAll())
  useRealtime('students', () => void loadAll())

  const totalPoints = points.reduce((sum, e) => sum + (e.points || 0), 0)
  const presences = attendance.filter((a) => a.status === 'presente').length
  const attendancePct =
    attendance.length > 0 ? Math.round((presences / attendance.length) * 100) : 0
  const spentTotal = orders
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + (o.total || 0), 0)

  if (authLoading || isLoading) {
    return <AdminPageLoader label="Carregando ficha do aluno..." />
  }

  if (!student) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center animate-fade-rise">
        <UserRound className="w-10 h-10 text-[#C8BFAF] mx-auto mb-3" />
        <h1 className="font-serif font-bold text-xl text-[#1C1B1A]">Aluno não encontrado</h1>
        <p className="text-sm text-[#6B6560] mt-2">
          O registro pode ter sido removido ou o link está incorreto.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title={student.name || 'Aluno'}
        breadcrumb="Ficha do aluno"
        breadcrumbTo={`/painel/alunos/${student.id}`}
        description="Dados pessoais, frequência, competições e compras deste aluno."
        action={
          student.user ? (
            <Badge className="bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20 text-[10px] font-bold gap-1">
              <KeyRound className="w-3 h-3" />
              Com acesso ao site
            </Badge>
          ) : (
            <Badge className="bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5] text-[10px] font-bold">
              Sem conta de acesso
            </Badge>
          )
        }
      />

      <AdminSummary
        stats={[
          { label: 'Frequência', value: `${attendancePct}%` },
          { label: 'Pontos de competição', value: totalPoints },
          { label: 'Compras na loja', value: orders.length },
          { label: 'Total em compras', value: fmtBRL(spentTotal) },
        ]}
      />

      <Tabs defaultValue="dados" className="mt-8">
        <TabsList className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-1 h-auto w-full sm:w-auto flex-wrap">
          <TabsTrigger value="dados" className={TAB_CLASS}>
            Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="frequencia" className={TAB_CLASS}>
            Frequência &amp; Competições
          </TabsTrigger>
          <TabsTrigger value="financeiro" className={TAB_CLASS}>
            Financeiro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <PersonalDataPanel student={student} classes={classes} onEdit={() => setEditOpen(true)} />
        </TabsContent>

        <TabsContent value="frequencia" className="mt-4 space-y-4">
          <AttendancePanel records={attendance} classes={classes} />
          <CompetitionPanel entries={points} />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          <FinancePanel student={student} orders={orders} itemsByOrder={itemsByOrder} />
        </TabsContent>
      </Tabs>

      <EditStudentDialog
        student={editOpen ? student : null}
        onOpenChange={(open) => !open && setEditOpen(false)}
        onSaved={(updated) => {
          setStudent(updated)
          toast({ title: 'Dados do aluno atualizados!' })
        }}
      />
    </div>
  )
}
