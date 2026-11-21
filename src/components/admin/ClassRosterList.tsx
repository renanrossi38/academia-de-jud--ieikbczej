import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { beltBadgeClass, beltLabel } from '@/components/admin/StudentDialogs'
import { AttendanceStatus, ClassStudent, Student } from '@/types'
import { Check, X, FileWarning, UserMinus, Eye, Phone, Mail, Users } from 'lucide-react'

export const STATUS_ORDER: AttendanceStatus[] = ['presente', 'ausente', 'justificado']

const statusMeta: Record<AttendanceStatus, { label: string; icon: ReactNode }> = {
  presente: { label: 'Presente', icon: <Check className="w-3.5 h-3.5" /> },
  ausente: { label: 'Ausente', icon: <X className="w-3.5 h-3.5" /> },
  justificado: { label: 'Justificado', icon: <FileWarning className="w-3.5 h-3.5" /> },
}

const statusBtnClass: Record<AttendanceStatus, string> = {
  presente: 'bg-[#2E7D4F] text-white border-[#2E7D4F] shadow-xs',
  ausente: 'bg-[#C1272D] text-white border-[#C1272D] shadow-xs',
  justificado: 'bg-[#6B6560] text-white border-[#6B6560] shadow-xs',
}

interface ClassRosterListProps {
  /** Matrículas da turma já filtradas pela busca. */
  links: ClassStudent[]
  markings: Record<string, AttendanceStatus>
  onMark: (studentId: string, status: AttendanceStatus) => void
  onRemove: (link: ClassStudent) => void
}

/** Lista dos alunos matriculados: tabela no desktop, cartões no mobile. */
export function ClassRosterList({ links, markings, onMark, onRemove }: ClassRosterListProps) {
  const rows = links
    .map((link) => ({ link, student: link.expand?.student }))
    .filter((r): r is { link: ClassStudent; student: Student } => !!r.student)

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center">
        <Users className="w-6 h-6 text-[#6B6560] mx-auto mb-2" />
        <p className="text-xs text-[#6B6560]">Nenhum aluno encontrado com esse nome.</p>
      </div>
    )
  }

  return (
    <>
      {/* Tabela (desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Aluno</th>
              <th className="py-3 px-4">Faixa</th>
              <th className="py-3 px-4">Contato</th>
              <th className="py-3 px-4">Presença do dia</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E0D5]">
            {rows.map(({ link, student }) => (
              <tr key={link.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                <td className="py-3.5 px-4 min-w-[160px]">
                  <Link
                    to={`/painel/alunos/${student.id}`}
                    className="text-[#C1272D] font-bold hover:underline"
                    title="Abrir ficha do aluno"
                  >
                    {student.name || '—'}
                  </Link>
                </td>
                <td className="py-3.5 px-4">
                  <Badge className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}>
                    {beltLabel(student.belt)}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-[#6B6560]">
                  <ContactInfo student={student} />
                </td>
                <td className="py-3.5 px-4">
                  <StatusButtons
                    value={markings[student.id]}
                    onChange={(s) => onMark(student.id, s)}
                  />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <RowActions studentId={student.id} onRemove={() => onRemove(link)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões (mobile) */}
      <div className="md:hidden divide-y divide-[#E8E0D5]">
        {rows.map(({ link, student }) => (
          <div key={link.id} className="p-4 space-y-3">
            <div className="min-w-0">
              <Link
                to={`/painel/alunos/${student.id}`}
                className="block text-sm font-bold text-[#C1272D] hover:underline truncate"
                title="Abrir ficha do aluno"
              >
                {student.name || '—'}
              </Link>
              <div className="mt-1.5">
                <Badge className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}>
                  {beltLabel(student.belt)}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-[#6B6560]">
              <ContactInfo student={student} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6560] mb-1.5">
                Presença do dia
              </p>
              <StatusButtons
                value={markings[student.id]}
                onChange={(s) => onMark(student.id, s)}
                className="grid grid-cols-3 gap-1.5"
              />
            </div>
            <div className="pt-1 border-t border-[#E8E0D5]">
              <RowActions studentId={student.id} onRemove={() => onRemove(link)} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ContactInfo({ student }: { student: Student }) {
  if (!student.phone && !student.email) return <span>—</span>
  return (
    <div className="space-y-1 min-w-0">
      {student.phone && (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Phone className="w-3 h-3 shrink-0" />
          {student.phone}
        </span>
      )}
      {student.email && (
        <span className="flex items-center gap-1.5 min-w-0">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[220px]">{student.email}</span>
        </span>
      )}
    </div>
  )
}

function StatusButtons({
  value,
  onChange,
  className = 'inline-flex items-center gap-1.5 flex-wrap',
}: {
  value?: AttendanceStatus
  onChange: (s: AttendanceStatus) => void
  className?: string
}) {
  return (
    <div className={className} role="group" aria-label="Presença do dia">
      {STATUS_ORDER.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold whitespace-nowrap transition-colors ${
            value === opt
              ? statusBtnClass[opt]
              : 'bg-white text-[#6B6560] border-[#E8E0D5] hover:border-[#C1272D]/40 hover:text-[#C1272D]'
          }`}
        >
          {statusMeta[opt].icon}
          {statusMeta[opt].label}
        </button>
      ))}
    </div>
  )
}

function RowActions({ studentId, onRemove }: { studentId: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-3 whitespace-nowrap">
      <Link
        to={`/painel/alunos/${studentId}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6560] hover:text-[#C1272D]"
      >
        <Eye className="w-3.5 h-3.5" />
        Ver ficha
      </Link>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6560] hover:text-[#C1272D] px-1.5 py-1 rounded-md hover:bg-[#F7E4E2]/50 transition-colors"
        title="Remover da turma"
      >
        <UserMinus className="w-3.5 h-3.5" />
        Remover
      </button>
    </div>
  )
}
