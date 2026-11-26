import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { beltBadgeClass, beltLabel } from '@/components/admin/StudentDialogs'
import { classesService, todayKey } from '@/services/classes'
import {
  fetchAttendanceReport,
  firstDayOfCurrentMonth,
  todayKeyForReport,
  formatDateKeyBR,
  type AttendanceReportData,
} from '@/services/attendanceReport'
import { openAttendanceReport } from '@/services/attendancePdf'
import { Class } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminPageHeader,
  AdminSummary,
  AdminEmptyState,
  AdminPageLoader,
} from '@/components/admin/AdminPage'
import {
  Loader2,
  FileDown,
  CalendarDays,
  Users,
  Percent,
  CalendarCheck,
  ShieldAlert,
  Info,
} from 'lucide-react'

/** Página "Relatório de presença" (Painel → Relatório de presença). */
export default function AdminAttendanceReport() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [classes, setClasses] = useState<Class[]>([])
  const [startKey, setStartKey] = useState<string>(() => firstDayOfCurrentMonth())
  const [endKey, setEndKey] = useState<string>(() => todayKeyForReport())
  const [classId, setClassId] = useState<string>('')
  const [data, setData] = useState<AttendanceReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  useEffect(() => {
    document.title = 'Relatório de presença | Judô Tatsu'
  }, [])

  useEffect(() => {
    let cancelled = false
    classesService
      .listClasses()
      .then((list) => {
        if (!cancelled) setClasses(list)
      })
      .catch(() => {
        if (!cancelled)
          toast({
            title: 'Erro ao carregar turmas',
            description: 'Não foi possível buscar a lista de turmas no servidor.',
            variant: 'destructive',
          })
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const report = await fetchAttendanceReport({
        startKey,
        endKey,
        classId: classId || null,
      })
      setData(report)
    } catch (err) {
      console.error('Erro ao gerar relatório de presença:', err)
      setData(null)
      toast({
        title: 'Erro ao gerar o relatório',
        description: 'Não foi possível buscar as presenças no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [startKey, endKey, classId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId],
  )

  const periodLabel = useMemo(() => {
    if (startKey === endKey) return formatDateKeyBR(startKey)
    return `${formatDateKeyBR(startKey)} a ${formatDateKeyBR(endKey)}`
  }, [startKey, endKey])

  const classLabel = selectedClass ? `Turma ${selectedClass.name}` : 'Todas as turmas'

  const totalPresentes = data?.rows.reduce((a, r) => a + r.presente, 0) ?? 0
  const totalAusentes = data?.rows.reduce((a, r) => a + r.ausente, 0) ?? 0
  const totalJustificadas = data?.rows.reduce((a, r) => a + r.justificado, 0) ?? 0
  const totalMarcacoes = totalPresentes + totalAusentes + totalJustificadas
  const taxaGeral = totalMarcacoes > 0 ? (totalPresentes / totalMarcacoes) * 100 : 0

  const handleDownloadPdf = async () => {
    if (!data) return
    setIsPdfLoading(true)
    try {
      openAttendanceReport({
        periodLabel,
        classLabel,
        data,
      })
    } catch (err) {
      toast({
        title: 'Não foi possível abrir o PDF',
        description:
          err instanceof Error
            ? err.message
            : 'O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.',
        variant: 'destructive',
      })
    } finally {
      setIsPdfLoading(false)
    }
  }

  if (authLoading) {
    return <AdminPageLoader label="Carregando relatório de presença..." />
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-[#C1272D] mx-auto mb-4" />
        <h1 className="font-serif font-bold text-2xl text-[#1C1B1A]">Acesso restrito</h1>
        <p className="text-sm text-[#6B6560] mt-2">
          Esta página é apenas para a administração da academia.
        </p>
      </div>
    )
  }

  const hasPeriodError = startKey > endKey

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title="Relatório de presença"
        breadcrumb="Relatório de presença"
        breadcrumbTo="/painel/relatorio-presenca"
        description="Escolha um período e veja quantas aulas cada aluno frequentou. Os números vêm direto das chamadas gravadas no sistema."
        action={
          <Button
            onClick={handleDownloadPdf}
            disabled={isPdfLoading || !data}
            variant="outline"
            className="h-10 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
            title="Gerar a folha A4 do relatório com os números exibidos"
          >
            {isPdfLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            {isPdfLoading ? 'Gerando PDF...' : 'Baixar PDF'}
          </Button>
        }
      />

      {/* Filtros: período + turma */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 mb-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-inicio" className="text-xs font-semibold text-[#1C1B1A]">
              Data inicial
            </Label>
            <Input
              id="filtro-inicio"
              type="date"
              value={startKey}
              max={todayKeyForReport()}
              onChange={(e) => setStartKey(e.target.value)}
              className="h-10 border-[#E8E0D5] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-fim" className="text-xs font-semibold text-[#1C1B1A]">
              Data final
            </Label>
            <Input
              id="filtro-fim"
              type="date"
              value={endKey}
              min={startKey}
              max={todayKeyForReport()}
              onChange={(e) => setEndKey(e.target.value)}
              className="h-10 border-[#E8E0D5] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-turma" className="text-xs font-semibold text-[#1C1B1A]">
              Turma (opcional)
            </Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="filtro-turma" className="h-10 border-[#E8E0D5] text-sm w-full">
                <SelectValue placeholder="Todas as turmas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold w-full"
              onClick={() => {
                setStartKey(firstDayOfCurrentMonth())
                setEndKey(todayKeyForReport())
                setClassId('')
              }}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Mês corrente
            </Button>
          </div>
        </div>
        {hasPeriodError && (
          <p role="alert" className="text-xs text-[#C1272D] font-semibold mt-3">
            A data inicial está depois da data final. Ajuste as datas para gerar o relatório.
          </p>
        )}
      </div>

      {isLoading ? (
        <AdminPageLoader label="Buscando presenças do período..." />
      ) : !data || (data.rows.length === 0 && data.semRegistro.length === 0) ? (
        <AdminEmptyState
          title="Nenhum registro de presença no período"
          description="Não há chamadas gravadas para este período com os filtros atuais. Escolha outro intervalo de datas ou outra turma."
          icon={<CalendarCheck className="w-10 h-10" />}
        />
      ) : (
        <>
          <AdminSummary
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            stats={[
              {
                label: 'Dias com aula registrada',
                value: data.diasComAula,
                icon: <CalendarCheck className="w-4 h-4" />,
              },
              {
                label: 'Média por aula',
                value: data.mediaPresencaPorAula.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                }),
                icon: <Users className="w-4 h-4" />,
              },
              {
                label: 'Presenças no período',
                value: totalPresentes,
                icon: <CalendarCheck className="w-4 h-4" />,
                tone: 'green',
              },
              {
                label: 'Ausências no período',
                value: totalAusentes,
                icon: <Users className="w-4 h-4" />,
                tone: totalAusentes > 0 ? 'red' : 'neutral',
              },
              {
                label: 'Frequência geral',
                value: `${taxaGeral.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
                icon: <Percent className="w-4 h-4" />,
                tone: 'ink',
              },
            ]}
          />

          {data.rows.length === 0 ? (
            <AdminEmptyState
              title="Nenhum aluno com marcação neste período"
              description="Os alunos ativos do recorte não têm nenhuma chamada gravada nas datas escolhidas — veja a lista de alunos sem registro abaixo."
              icon={<Users className="w-10 h-10" />}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">
                    Presenças, ausências e frequência por aluno no período selecionado
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="bg-[#FAF6F0] hover:bg-[#FAF6F0]">
                      <TableHead className="text-[#6B6560] font-semibold">Aluno</TableHead>
                      <TableHead className="text-[#6B6560] font-semibold">Turma(s)</TableHead>
                      <TableHead className="text-right text-[#6B6560] font-semibold">
                        Dias com registro
                      </TableHead>
                      <TableHead className="text-right text-[#6B6560] font-semibold">
                        Presenças
                      </TableHead>
                      <TableHead className="text-right text-[#6B6560] font-semibold">
                        Ausências
                      </TableHead>
                      <TableHead className="text-right text-[#6B6560] font-semibold">
                        Justificadas
                      </TableHead>
                      <TableHead className="text-right text-[#6B6560] font-semibold">
                        Frequência
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.student.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${beltBadgeClass(
                                row.student.belt,
                              )}`}
                            >
                              {beltLabel(row.student.belt)}
                            </span>
                            <span className="font-semibold text-[#1C1B1A] text-sm">
                              {row.student.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-[#6B6560]">{row.turmas}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-[#6B6560]">
                          {row.diasComRegistro}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums text-[#2E7D4F]">
                          {row.presente}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums text-[#C1272D]">
                          {row.ausente}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-[#6B6560]">
                          {row.justificado}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums text-[#1C1B1A]">
                          {row.taxaPresenca.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {data.semRegistro.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 mt-6 shadow-xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#6B6560] mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-serif font-bold text-sm text-[#1C1B1A]">
                    Alunos ativos sem registro no período ({data.semRegistro.length})
                  </h2>
                  <p className="text-xs text-[#6B6560] mt-1">
                    Estes alunos estão matriculados, mas não têm nenhuma chamada gravada nas datas
                    escolhidas:
                  </p>
                  <ul role="list" className="mt-2 flex flex-wrap gap-1.5">
                    {data.semRegistro.map((s) => (
                      <li
                        key={s.student.id}
                        className="inline-flex items-center rounded-full border border-[#E8E0D5] bg-[#FAF6F0] px-2.5 py-1 text-xs text-[#6B6560]"
                      >
                        {s.student.name}
                        {s.turmas !== '—' && (
                          <span className="text-[#9A948C] ml-1.5">· {s.turmas}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
