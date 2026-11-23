import React from 'react'
import {
  Award,
  BadgeCheck,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  CircleAlert,
  Clock,
  CreditCard,
  Info,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  ShoppingBag,
  Trophy,
  UserX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrderStatusChip } from '@/components/OrderStatusChip'
import { formatCustomAnswers } from '@/lib/customAnswers'
import { beltBadgeClass, beltLabel, birthDateLabel } from '@/components/admin/StudentDialogs'
import { classLevelBadgeClass, classLevelLabel } from '@/services/classes'
import { toLocalDateKey } from '@/services/attendance'
import {
  Attendance,
  AttendanceStatus,
  Belt,
  Class,
  Order,
  OrderItem,
  PointEntry,
  Student,
} from '@/types'

/* ---------------- formatadores compartilhados ---------------- */

export const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const fmtDateTime = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

/** Dia da semana (pt-BR) a partir da data da marcação. */
const weekdayOf = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return WEEKDAYS[d.getDay()]
}

const ATT_META: Record<AttendanceStatus, { label: string; badge: string; icon: React.ReactNode }> =
  {
    presente: {
      label: 'Presente',
      badge: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    ausente: {
      label: 'Ausente',
      badge: 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20',
      icon: <CalendarX2 className="w-4 h-4" />,
    },
    justificado: {
      label: 'Justificado',
      badge: 'bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5]',
      icon: <CircleAlert className="w-4 h-4" />,
    },
  }

const cardCls = 'bg-white rounded-2xl border border-[#E8E0D5] shadow-xs'

/* ---------------- Aba 1: Dados Pessoais ---------------- */

export const PersonalDataPanel: React.FC<{
  student: Student
  classes: Class[]
  onEdit: () => void
  beltOverride?: Belt
}> = ({ student, classes, onEdit, beltOverride }) => (
  <div className="space-y-4">
    {/* Dados do cadastro */}
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-serif font-bold text-base text-[#1C1B1A]">Cadastro</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="border-[#E8E0D5] text-[#1C1B1A] text-[11px] font-semibold hover:bg-[#FAF6F0]"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Editar dados
        </Button>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C]">Nome</dt>
          <dd className="text-[#1C1B1A] font-semibold mt-0.5 break-words">{student.name || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C] flex items-center gap-1">
            <Phone className="w-3 h-3" /> Telefone
          </dt>
          <dd className="text-[#1C1B1A] mt-0.5">{student.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C] flex items-center gap-1">
            <Mail className="w-3 h-3" /> E-mail
          </dt>
          <dd className="text-[#1C1B1A] mt-0.5 break-words">
            {student.email || <span className="text-[#6B6560]">sem e-mail cadastrado</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C] flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Endereço
          </dt>
          <dd className="text-[#1C1B1A] mt-0.5 break-words">{student.address || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C]">
            Data de nascimento
          </dt>
          <dd className="text-[#1C1B1A] mt-0.5">
            {student.birth_date ? birthDateLabel(student.birth_date) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C]">Faixa</dt>
          <dd className="mt-0.5">
            <Badge
              className={`text-[10px] font-bold border ${beltBadgeClass(beltOverride ?? student.belt)}`}
            >
              {beltLabel(beltOverride ?? student.belt)}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C]">Status</dt>
          <dd className="mt-0.5">
            <Badge
              className={`text-[10px] font-bold border ${
                student.active
                  ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                  : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
              }`}
            >
              {student.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#9A948C]">
            Data de cadastro
          </dt>
          <dd className="text-[#1C1B1A] mt-0.5">{fmtDateTime(student.created)}</dd>
        </div>
      </dl>
    </div>

    {/* Turmas matriculadas */}
    <div className={`${cardCls} p-5`}>
      <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-4">Turmas matriculadas</h3>
      {classes.length === 0 ? (
        <p className="text-xs text-[#6B6560] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Este aluno ainda não está matriculado em nenhuma turma — matricule-o em "Turmas".
        </p>
      ) : (
        <ul className="divide-y divide-[#E8E0D5]">
          {classes.map((c) => (
            <li key={c.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-sm font-semibold text-[#1C1B1A] min-w-0">{c.name}</span>
              <Badge className={`text-[10px] font-bold border ${classLevelBadgeClass(c.level)}`}>
                {classLevelLabel(c.level)}
              </Badge>
              {c.schedule && (
                <span className="text-[11px] text-[#6B6560] inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {c.schedule}
                </span>
              )}
              <span className="text-[11px] text-[#6B6560] sm:ml-auto inline-flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                {typeof c.monthly_fee === 'number'
                  ? `Mensalidade de referência: ${fmtBRL(c.monthly_fee)}`
                  : 'Sem mensalidade definida'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-[#6B6560] mt-3 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        O pagamento da mensalidade ainda não é registrado no sistema — o valor acima é só a
        referência da turma. Veja as compras da loja na aba "Financeiro".
      </p>
    </div>
  </div>
)

/* ---------------- Aba 2: Frequência & Competições ---------------- */

/** Rótulo do mês ("2026-11" → "Novembro de 2026") em português. */
const monthGroupLabel = (monthKey: string): string => {
  const [y, m] = (monthKey || '').split('-').map(Number)
  if (!y || !m) return monthKey || '—'
  const d = new Date(y, m - 1, 1)
  if (Number.isNaN(d.getTime())) return monthKey
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface AttendanceMonthGroup {
  /** "YYYY-MM" no fuso de Brasília (as marcações são gravadas às 12:00 UTC). */
  monthKey: string
  label: string
  records: Attendance[]
  /** Total de dias com chamada (presente + ausente + justificado). */
  dias: number
  presentes: number
  ausentes: number
  justificados: number
  /** Presentes ÷ dias com chamada (justificado fica fora do numerador). */
  pct: number
}

/** Agrupa as marcações por mês/ano (mais recentes primeiro), com os totais de cada mês. */
export function groupAttendanceByMonth(records: Attendance[]): AttendanceMonthGroup[] {
  const byMonth = new Map<string, Attendance[]>()
  for (const r of records) {
    const key = toLocalDateKey(new Date(r.date)).slice(0, 7)
    const list = byMonth.get(key)
    if (list) list.push(r)
    else byMonth.set(key, [r])
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, monthRecords]) => {
      const counts = monthRecords.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        },
        { presente: 0, ausente: 0, justificado: 0 } as Record<AttendanceStatus, number>,
      )
      const dias = monthRecords.length
      return {
        monthKey,
        label: monthGroupLabel(monthKey),
        records: monthRecords,
        dias,
        presentes: counts.presente || 0,
        ausentes: counts.ausente || 0,
        justificados: counts.justificado || 0,
        pct: dias > 0 ? Math.round(((counts.presente || 0) / dias) * 100) : 0,
      }
    })
}

export const AttendancePanel: React.FC<{ records: Attendance[]; classes: Class[] }> = ({
  records,
  classes,
}) => {
  const total = records.length
  const counts = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Record<AttendanceStatus, number>,
  )
  const presente = counts.presente || 0
  const pct = total > 0 ? Math.round((presente / total) * 100) : 0
  const groups = React.useMemo(() => groupAttendanceByMonth(records), [records])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Frequência',
            value: `${pct}%`,
            cls: 'bg-[#F7E4E2] text-[#8E1519] border-[#C1272D]/25',
          },
          {
            label: 'Presentes',
            value: presente,
            cls: 'bg-[#EAF4EC] text-[#2E7D4F] border-[#2E7D4F]/25',
          },
          {
            label: 'Ausentes',
            value: counts.ausente || 0,
            cls: 'bg-white text-[#1C1B1A] border-[#E8E0D5]',
          },
          {
            label: 'Justificados',
            value: counts.justificado || 0,
            cls: 'bg-white text-[#1C1B1A] border-[#E8E0D5]',
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 shadow-xs ${s.cls}`}>
            <p className="font-serif font-bold text-xl leading-none">{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mt-1">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className={`${cardCls} p-5`}>
        <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-3">
          Histórico de presença por mês
        </h3>
        <p className="text-[11px] text-[#6B6560] mb-4 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Percentual do mês = presenças ÷ dias com chamada ({presente}/{total} no total).
            Marcações "Justificado" contam como dia com chamada, mas ficam FORA do numerador — o dia
            existe na chamada, porém não soma como presença.
          </span>
        </p>
        {total === 0 ? (
          <p className="text-xs text-[#6B6560] flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Nenhuma marcação de presença ainda — elas aparecem aqui depois da chamada nas turmas.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.monthKey}>
                {/* Cabeçalho do mês: rótulo + totais e % de presença do mês */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-2 mb-1 border-b border-[#E8E0D5]">
                  <h4 className="font-serif font-bold text-sm text-[#1C1B1A]">{g.label}</h4>
                  <Badge className="bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5] text-[10px] font-bold">
                    {g.dias} {g.dias === 1 ? 'dia com chamada' : 'dias com chamada'}
                  </Badge>
                  <Badge className="bg-[#EAF4EC] text-[#2E7D4F] border-[#2E7D4F]/20 text-[10px] font-bold">
                    {g.presentes} {g.presentes === 1 ? 'presença' : 'presenças'}
                  </Badge>
                  {g.ausentes > 0 && (
                    <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-[10px] font-bold">
                      {g.ausentes} {g.ausentes === 1 ? 'ausente' : 'ausentes'}
                    </Badge>
                  )}
                  {g.justificados > 0 && (
                    <Badge
                      title="Dias justificados: contam como dia com chamada, mas não entram no percentual de presença."
                      className="bg-white text-[#6B6560] border-[#E8E0D5] text-[10px] font-bold cursor-help"
                    >
                      {g.justificados}{' '}
                      {g.justificados === 1
                        ? 'justificado (fora do %)'
                        : 'justificados (fora do %)'}
                    </Badge>
                  )}
                  <Badge
                    title="Presenças ÷ dias com chamada do mês; justificados ficam fora do numerador."
                    className="ml-auto bg-[#F7E4E2] text-[#8E1519] border-[#C1272D]/25 text-xs font-bold cursor-help"
                  >
                    {g.pct}% de presença
                  </Badge>
                </div>
                <ul className="divide-y divide-[#E8E0D5]">
                  {g.records.map((r) => (
                    <li key={r.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Badge
                        className={`text-[10px] font-bold border gap-1 ${
                          ATT_META[r.status]?.badge ?? ''
                        }`}
                      >
                        {ATT_META[r.status]?.icon}
                        {ATT_META[r.status]?.label ?? r.status}
                      </Badge>
                      <span className="text-sm font-semibold text-[#1C1B1A]">
                        {fmtDateTime(r.date).split(',')[0] || fmtDateTime(r.date)}
                      </span>
                      <span className="text-[11px] text-[#6B6560] capitalize">
                        {weekdayOf(r.date)}
                      </span>
                      {classes.length > 0 && (
                        <span className="text-[11px] text-[#6B6560] sm:ml-auto truncate max-w-full">
                          {classes.map((c) => c.name).join(' · ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const CompetitionPanel: React.FC<{ entries: PointEntry[] }> = ({ entries }) => {
  const totalPoints = entries.reduce((sum, e) => sum + (e.points || 0), 0)

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-serif font-bold text-base text-[#1C1B1A] flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#C1272D]" />
          Resultados competitivos
        </h3>
        <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/25 text-xs font-bold">
          {totalPoints} pts no total
        </Badge>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-[#6B6560] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Nenhum lançamento de competição ou evento para este aluno — eles são criados em "Ranking"
          &gt; "Lançar pontos".
        </p>
      ) : (
        <ul className="divide-y divide-[#E8E0D5]">
          {entries.map((e) => (
            <li key={e.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Award className="w-4 h-4 text-[#C1272D] shrink-0" />
              <span className="text-sm font-semibold text-[#1C1B1A] min-w-0 break-words">
                {e.description || 'Sem descrição'}
              </span>
              <span className="text-[11px] text-[#6B6560] inline-flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {fmtDateTime(e.date || e.created).split(',')[0]}
              </span>
              <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-xs font-bold ml-auto shrink-0">
                +{e.points} pts
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- Aba 3: Financeiro ---------------- */

export const FinancePanel: React.FC<{
  student: Student
  orders: Order[]
  itemsByOrder: Record<string, OrderItem[]>
}> = ({ student, orders, itemsByOrder }) => {
  if (!student.user) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-[#D9D2C7] bg-white p-8 text-center">
          <UserX className="w-8 h-8 text-[#C8BFAF] mx-auto mb-3" />
          <h3 className="font-serif font-bold text-base text-[#1C1B1A]">
            Sem conta de acesso vinculada
          </h3>
          <p className="text-xs text-[#6B6560] mt-1.5 max-w-md mx-auto leading-relaxed">
            As compras da loja são vinculadas à conta de login do aluno. Este aluno ainda não tem
            conta de acesso — gere uma na listagem de Alunos ("Gerar acesso") e os pedidos dele
            passarão a aparecer aqui automaticamente.
          </p>
        </div>
        <MensalidadeNote />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-serif font-bold text-base text-[#1C1B1A] flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#C1272D]" />
            Compras na loja
          </h3>
          <Badge className="bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5] text-xs font-semibold">
            {orders.length} pedido(s)
          </Badge>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D9D2C7] bg-[#FAF6F0]/50 px-4 py-6 text-center">
            <p className="text-xs text-[#6B6560] flex items-center justify-center gap-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Nenhuma compra registrada ainda — os pedidos feitos com o login deste aluno aparecem
              aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E8E0D5]">
            {orders.map((o) => (
              <li key={o.id} className="py-3.5 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Package className="w-4 h-4 text-[#6B6560] shrink-0" />
                  <span className="text-sm font-semibold text-[#1C1B1A]">
                    Pedido #{o.id.slice(-6).toUpperCase()}
                  </span>
                  <OrderStatusChip status={o.status} />
                  <span className="text-[11px] text-[#6B6560] sm:ml-auto">
                    {fmtDateTime(o.created)}
                  </span>
                  <span className="font-serif font-bold text-sm text-[#1C1B1A] w-full sm:w-auto sm:text-right">
                    {fmtBRL(o.total)}
                  </span>
                </div>
                {(itemsByOrder[o.id] || []).length > 0 && (
                  <ul className="pl-7 space-y-0.5">
                    {(itemsByOrder[o.id] || []).map((it) => (
                      <li key={it.id} className="text-[11px] text-[#6B6560]">
                        {it.quantity}× {it.product_name}
                        {it.variation_label ? ` (${it.variation_label})` : ''} —{' '}
                        {fmtBRL(it.subtotal)}
                        {formatCustomAnswers(it.custom_answers) && (
                          <span className="block italic text-[#1C1B1A] pl-2">
                            {formatCustomAnswers(it.custom_answers)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <MensalidadeNote />
    </div>
  )
}

const MensalidadeNote: React.FC = () => (
  <div className="rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] px-4 py-3 flex items-start gap-2">
    <BadgeCheck className="w-4 h-4 text-[#C1272D] shrink-0 mt-0.5" />
    <p className="text-[11px] text-[#6B6560] leading-relaxed">
      <strong className="text-[#1C1B1A]">Sobre as mensalidades:</strong> o pagamento de mensalidade
      ainda não é registrado no sistema — o controle financeiro de hoje cobre as compras da loja. A
      mensalidade de referência de cada turma aparece na aba "Dados Pessoais".
    </p>
  </div>
)
