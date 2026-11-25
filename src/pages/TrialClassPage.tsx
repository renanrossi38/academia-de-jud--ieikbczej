import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CheckCircle2, Clock, Users } from 'lucide-react'
import { HankoStamp } from '@/components/HankoStamp'
import { BrushDivider } from '@/components/hero/HeroDecor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Class } from '@/types'
import {
  CreateTrialBookingInput,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  fetchBookableClasses,
  trialBookingsService,
  weekdayListText,
} from '@/services/trialBookings'
import { ClassWeekday } from '@/services/classes'

/** Domingo = 0 … Sábado = 6 (getDay) → chave da migration 0041. */
const DOW_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const

const inputClass = 'h-11 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] rounded-lg'

function hojeKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function diasLegiveis(weekdays: string[]): string {
  return weekdayListText(weekdays)
}

export default function TrialClassPage() {
  const { toast } = useToast()
  const [classes, setClasses] = useState<{ klass: Class; vagasRestantes: number }[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const [form, setForm] = useState({
    student_name: '',
    birth_date: '',
    classId: '',
    date: '',
    contact: '',
    notes: '',
  })

  useEffect(() => {
    let alive = true
    fetchBookableClasses()
      .then((list) => alive && setClasses(list))
      .catch(() => alive && setClasses([]))
      .finally(() => alive && setIsLoadingClasses(false))
    return () => {
      alive = false
    }
  }, [])

  const selected = useMemo(
    () => classes.find((c) => c.klass.id === form.classId) ?? null,
    [classes, form.classId],
  )
  const weekdaysOfSelected = (selected?.klass.weekdays ?? []) as ClassWeekday[]

  /** Min/max do datepicker: hoje até ~1 ano à frente. */
  const minDate = hojeKey()
  const maxDate = useMemo(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  const chosenDowKey: string = form.date ? DOW_KEY[new Date(form.date + 'T12:00:00').getDay()] : ''
  const diaInvalido =
    !!form.date &&
    weekdaysOfSelected.length > 0 &&
    !weekdaysOfSelected.includes(chosenDowKey as ClassWeekday)

  /** Idade do aluno na data da aula escolhida (para avisar antes de enviar). */
  const idadeNaAula = useMemo(() => {
    if (!form.birth_date || !form.date) return null
    const bm = form.birth_date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!bm) return null
    const birth = new Date(Date.UTC(+bm[1], +bm[2] - 1, +bm[3]))
    const dm = form.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!dm) return null
    const chosen = new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3]))
    let age = chosen.getUTCFullYear() - birth.getUTCFullYear()
    const md = chosen.getUTCMonth() - birth.getUTCMonth()
    if (md < 0 || (md === 0 && chosen.getUTCDate() < birth.getUTCDate())) age--
    return age
  }, [form.birth_date, form.date])

  const idadeInvalida = useMemo(() => {
    if (idadeNaAula == null || !selected) return false
    const min = selected.klass.min_age ?? 0
    const max = selected.klass.max_age ?? 0
    if (min > 0 && idadeNaAula < min) return true
    if (max > 0 && idadeNaAula > max) return true
    return false
  }, [idadeNaAula, selected])

  const faixaTexto = useMemo(() => {
    if (!selected) return ''
    const min = selected.klass.min_age ?? 0
    const max = selected.klass.max_age ?? 0
    if (min > 0 && max > 0) return `de ${min} a ${max} anos`
    if (min > 0) return `a partir de ${min} anos`
    if (max > 0) return `até ${max} anos`
    return ''
  }, [selected])

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.student_name.trim() || form.student_name.trim().length < 3) {
      toast({ title: 'Informe o nome do aluno', variant: 'destructive' })
      return
    }
    if (!form.birth_date) {
      toast({ title: 'Informe a data de nascimento do aluno', variant: 'destructive' })
      return
    }
    if (!form.classId) {
      toast({ title: 'Escolha uma turma', variant: 'destructive' })
      return
    }
    if (!form.date) {
      toast({ title: 'Escolha a data da aula', variant: 'destructive' })
      return
    }
    if (!form.contact.trim()) {
      toast({ title: 'Informe um telefone ou e-mail para contato', variant: 'destructive' })
      return
    }
    if (diaInvalido) {
      toast({
        title: 'Dia de aula inválido',
        description: `Esta turma funciona às ${diasLegiveis(weekdaysOfSelected)}. Escolha uma data nesses dias.`,
        variant: 'destructive',
      })
      return
    }
    if (idadeInvalida) {
      toast({
        title: 'Idade fora da faixa da turma',
        description: `Esta turma é para alunos ${faixaTexto}.`,
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload: CreateTrialBookingInput = {
        student_name: form.student_name.trim(),
        birth_date: form.birth_date,
        class: form.classId,
        date: form.date,
        contact: form.contact.trim(),
        notes: form.notes.trim() || undefined,
      }
      await trialBookingsService.create(payload)
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Erro ao agendar aula experimental:', err)
      toast({
        title: 'Não foi possível agendar',
        description:
          err?.response?.data?.message || err?.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Confirmação ---------------------------------------------------------
  if (done) {
    return (
      <div className="min-h-[70dvh] bg-[#FAF6F0] py-16 px-4">
        <div className="mx-auto max-w-md rounded-2xl border border-[#E8E0D5] bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
          <h1 className="mt-4 font-serif text-2xl font-bold text-[#1C1B1A]">Aula agendada!</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6560]">
            Recebemos seu pedido de aula experimental na turma{' '}
            <strong className="text-[#1C1B1A]">{selected?.klass.name}</strong> para{' '}
            <strong className="text-[#1C1B1A]">
              {new Date(form.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            . Nossa equipe vai confirmar sua vaga pelo contato informado ({form.contact}). Osss!
          </p>
          <Button
            onClick={() => {
              setDone(false)
              setForm({
                student_name: '',
                birth_date: '',
                classId: '',
                date: '',
                contact: '',
                notes: '',
              })
            }}
            className="mt-6 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
          >
            Agendar outra aula
          </Button>
        </div>
      </div>
    )
  }

  // ---- Formulário -----------------------------------------------------------
  return (
    <div className="min-h-dvh bg-[#FAF6F0]">
      {/* Cabeçalho com a identidade da casa */}
      <div className="relative overflow-hidden bg-[#1C1B1A] py-12 text-center text-white">
        <div className="absolute inset-0 opacity-15" aria-hidden>
          <BrushDivider className="h-full w-full" preserveAspectRatio="none" />
        </div>
        <HankoStamp className="mx-auto mb-4 h-16 w-16" />
        <h1 className="font-serif text-3xl font-bold sm:text-4xl">Aula experimental</h1>
        <p className="mx-auto mt-2 max-w-xl px-4 text-sm text-white/70">
          Conheça o judô na Academia Tatsu: escolha a turma, o dia e deixe seu contato. A primeira
          aula é por nossa conta — sem compromisso.
        </p>
      </div>

      <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-[#E8E0D5] bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="space-y-1.5">
            <Label htmlFor="trial-name" className="text-xs font-bold text-[#1C1B1A]">
              Nome do aluno *
            </Label>
            <Input
              id="trial-name"
              value={form.student_name}
              onChange={(e) => set({ student_name: e.target.value })}
              placeholder="Ex.: Maria Silva"
              autoComplete="name"
              maxLength={120}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-birth" className="text-xs font-bold text-[#1C1B1A]">
              Data de nascimento do aluno *
            </Label>
            <Input
              id="trial-birth"
              type="date"
              value={form.birth_date}
              onChange={(e) => set({ birth_date: e.target.value })}
              max={hojeKey()}
              autoComplete="bday"
              className={inputClass}
            />
            <p className="text-[11px] text-[#6B6560]">
              Usamos a idade para encaixar o aluno na turma certa.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-class" className="text-xs font-bold text-[#1C1B1A]">
              Turma *
            </Label>
            {isLoadingClasses ? (
              <div className="h-11 rounded-lg border border-[#E8E0D5] bg-[#FAF6F0] px-3 text-sm leading-[2.75rem] text-[#6B6560]">
                Carregando turmas...
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-lg border border-[#E8E0D5] bg-[#FAF6F0] px-3 py-3 text-sm text-[#6B6560]">
                Nenhuma turma com vaga disponível no momento. Fale conosco pelo WhatsApp para entrar
                na lista de espera.
              </div>
            ) : (
              <select
                id="trial-class"
                value={form.classId}
                onChange={(e) => set({ classId: e.target.value, date: '' })}
                className={cn(inputClass, 'w-full rounded-lg px-3')}
              >
                <option value="">Selecione a turma...</option>
                {classes.map(({ klass, vagasRestantes }) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                    {klass.schedule ? ` — ${klass.schedule}` : ''} ({vagasRestantes} vaga
                    {vagasRestantes === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            )}
            {selected && weekdaysOfSelected.length > 0 && (
              <p className="text-[11px] text-[#6B6560]">
                Esta turma funciona às{' '}
                <strong className="text-[#1C1B1A]">{diasLegiveis(weekdaysOfSelected)}</strong>
                {faixaTexto ? ` — para alunos ${faixaTexto}` : ''}
                {selected.klass.vagas > 0
                  ? ` — ${selected.vagasRestantes} vaga(s) restante(s)`
                  : ''}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-date" className="text-xs font-bold text-[#1C1B1A]">
              Data desejada da aula *
            </Label>
            <Input
              id="trial-date"
              type="date"
              value={form.date}
              min={minDate}
              max={maxDate}
              onChange={(e) => set({ date: e.target.value })}
              className={cn(inputClass, diaInvalido && 'border-[#C1272D] ring-1 ring-[#C1272D]/40')}
            />
            {form.date && weekdaysOfSelected.length > 0 && (
              <p
                className={cn(
                  'text-[11px]',
                  diaInvalido ? 'font-semibold text-[#C1272D]' : 'text-[#6B6560]',
                )}
              >
                {diaInvalido
                  ? `Esta turma não funciona ${
                      WEEKDAY_LABELS[chosenDowKey]?.toLowerCase() ?? 'neste dia'
                    }s — funciona às ${diasLegiveis(weekdaysOfSelected)}.`
                  : `Ótimo: ${
                      WEEKDAY_LABELS[chosenDowKey]?.toLowerCase() ?? 'este dia'
                    } é dia de aula desta turma.`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-contact" className="text-xs font-bold text-[#1C1B1A]">
              Telefone ou e-mail para contato *
            </Label>
            <Input
              id="trial-contact"
              value={form.contact}
              onChange={(e) => set({ contact: e.target.value })}
              placeholder="(11) 99999-9999 ou voce@email.com"
              maxLength={160}
              className={inputClass}
            />
            <p className="text-[11px] text-[#6B6560]">
              A academia usa este contato para confirmar sua vaga.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-notes" className="text-xs font-bold text-[#1C1B1A]">
              Observação (opcional)
            </Label>
            <Textarea
              id="trial-notes"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Ex.: nunca treinou judô; tem 8 anos; prefere o horário da noite..."
              rows={3}
              maxLength={500}
              className="resize-none rounded-lg border-[#E8E0D5] bg-white text-sm focus-visible:ring-[#C1272D]"
            />
          </div>

          {idadeInvalida && (
            <div className="rounded-lg border border-[#C1272D]/30 bg-[#F7E4E2] px-3 py-2 text-xs font-semibold text-[#C1272D]">
              Pela data de nascimento, o aluno terá {idadeNaAula} ano(s) na data da aula — esta
              turma é para alunos {faixaTexto}. Escolha outra turma ou fale com a academia.
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || isLoadingClasses || classes.length === 0}
            className="h-12 w-full bg-[#C1272D] text-base font-bold text-white hover:bg-[#A01E23]"
          >
            {submitting ? 'Agendando...' : 'Agendar aula experimental'}
          </Button>

          <div className="flex items-center justify-center gap-5 pt-1 text-[11px] text-[#6B6560]">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Sem compromisso
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" /> Confirmação por contato
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Resposta rápida
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
