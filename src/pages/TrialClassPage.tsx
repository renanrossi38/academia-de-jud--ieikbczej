import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CheckCircle2, Clock, Users } from 'lucide-react'
import { HankoStamp } from '@/components/HankoStamp'
import { BrushDivider, HeroPetals, HeroSun } from '@/components/hero/HeroDecor'
import { TrialCalendar } from '@/components/TrialCalendar'
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

const PASSOS = ['Conte sobre o aluno', 'Escolha o dia', 'Confirme pelo contato']

const inputClass = 'h-11 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] rounded-lg'
const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-[#C1272D]'
const cardClass =
  'relative rounded-2xl border border-[#E8E0D5] bg-white p-5 shadow-[0_1px_2px_rgba(28,27,26,0.05),0_10px_28px_rgba(28,27,26,0.07)] sm:p-7'

function hojeKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function diasLegiveis(weekdays: string[]): string {
  return weekdayListText(weekdays)
}

/** Cabeçalho de cada cartão: selo vermelho com o número + título + pincelada. */
function StepHeader({ n, titulo, id }: { n: number; titulo: string; id?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C1272D] font-serif text-base font-bold text-white shadow-sm"
        >
          {n}
        </span>
        <h2 id={id} className="font-serif text-xl font-bold text-[#1C1B1A]">
          {titulo}
        </h2>
      </div>
      <BrushDivider className="mt-3 h-2.5 w-20 text-[#C1272D]" />
    </div>
  )
}

export default function TrialClassPage() {
  const { toast } = useToast()
  const [classes, setClasses] = useState<{ klass: Class; vagasRestantes: number }[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  /** Incrementa após cada agendamento bem-sucedido → refetch das datas ocupadas. */
  const [refreshDates, setRefreshDates] = useState(0)

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

  /** Datas já reservadas da turma selecionada (rota pública trial-availability). */
  const [occupiedDates, setOccupiedDates] = useState<string[]>([])
  const [isLoadingDates, setIsLoadingDates] = useState(false)

  useEffect(() => {
    if (!form.classId) {
      setOccupiedDates([])
      return
    }
    let alive = true
    setIsLoadingDates(true)
    trialBookingsService
      .fetchOccupiedDates(form.classId)
      .then((dates) => alive && setOccupiedDates(dates))
      .catch(() => alive && setOccupiedDates([]))
      .finally(() => alive && setIsLoadingDates(false))
    return () => {
      alive = false
    }
  }, [form.classId, refreshDates])

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
  /** Dia que a turma tem aula, mas já tem aula experimental reservada. */
  const diaReservado = !!form.date && occupiedDates.includes(form.date)

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
    if (diaReservado) {
      toast({
        title: 'Dia já reservado',
        description:
          'Já existe uma aula experimental agendada para esta turma neste dia. Escolha outra data.',
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
      setRefreshDates((n) => n + 1)
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Erro ao agendar aula experimental:', err)
      // PocketBase: erros de campo chegam em response.data.{campo}.message
      // (ex.: campo required vazio) — mostre o mais específico, nunca o
      // "Failed to create record" genérico sozinho.
      const fieldMsgs = err?.response?.data
        ? Object.values(err.response.data)
            .map((d: any) => (d && typeof d === 'object' ? d.message : ''))
            .filter(Boolean)
        : []
      toast({
        title: 'Não foi possível agendar',
        description:
          fieldMsgs[0] ||
          err?.response?.data?.message ||
          err?.message ||
          'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Confirmação ---------------------------------------------------------
  if (done) {
    return (
      <div className="flex min-h-[70dvh] items-center bg-[#FAF6F0] px-4 py-12 sm:py-16">
        <div className={cn(cardClass, 'mx-auto flex max-w-md flex-col items-center text-center')}>
          <HankoStamp className="mb-4 h-14 w-14" />
          <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
          <h1 className="mt-4 font-serif text-2xl font-bold text-[#1C1B1A]">Aula agendada!</h1>
          <BrushDivider className="mt-3 h-2.5 w-20 text-[#C1272D]" />
          <p className="mt-4 text-sm leading-relaxed text-[#6B6560]">
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
            className="mt-6 h-12 w-full rounded-xl bg-[#C1272D] text-sm font-semibold text-white hover:bg-[#A01E23] sm:w-auto"
          >
            Agendar outra aula
          </Button>
        </div>
      </div>
    )
  }

  // ---- Formulário -----------------------------------------------------------
  const dataResumo = form.date
    ? new Date(form.date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Escolha um dia no calendário'

  return (
    <div className="min-h-dvh bg-[#FAF6F0]">
      {/* Hero escuro: convite ao dojo, com sakura, sol e pincelada da marca */}
      <header className="relative overflow-hidden bg-[#1C1B1A] text-white">
        <HeroPetals className="opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <div>
            {/* Hero escuro: dragão em silhueta branca (mesmo tratamento do
                rodapé) — o logo colorido some contra o preto/vermelho. */}
            <HankoStamp className="mb-4 h-12 w-12 brightness-0 invert lg:hidden" />
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#E4636A]">
              Judô Tatsu
            </p>
            <h1 className="mt-2 font-serif text-4xl font-bold leading-tight sm:text-5xl">
              Aula experimental
            </h1>
            <BrushDivider className="mt-3 h-3 w-28 text-[#C1272D]" />
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
              Conheça o judô na Academia Judô Tatsu: escolha a turma, o dia e deixe seu contato. A
              primeira aula é por nossa conta — sem compromisso.
            </p>
            {/* Etapas sempre empilhadas (1 → 2 → 3, de cima para baixo),
                também no PC, onde antes ficavam lado a lado e o passo 2
                se deslocava pela página. max-w-md evita que o selo estique
                por toda a coluna larga do hero. */}
            <ol className="mt-8 grid max-w-md gap-3" aria-label="Como agendar">
              {PASSOS.map((passo, i) => (
                <li
                  key={passo}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C1272D] text-sm font-bold text-white shadow-sm"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold leading-snug text-white/90">{passo}</span>
                </li>
              ))}
            </ol>
          </div>
          <div aria-hidden className="relative hidden h-72 items-center justify-center lg:flex">
            <HeroSun className="absolute h-72 w-72 opacity-90" />
            {/* Dragão em silhueta branca dentro do disco vermelho (hanko):
                o tom original do logo conflitava com o vermelho do sol. */}
            <HankoStamp className="relative h-24 w-24 brightness-0 invert" />
          </div>
        </div>
        <BrushDivider className="absolute bottom-0 left-0 h-2.5 w-full text-[#C1272D]" />
      </header>

      {/* Duas colunas no PC (formulário | calendário); empilhado no mobile na
          MESMA ordem de leitura: aluno → dia → contato → resumo → envio. */}
      <form
        onSubmit={handleSubmit}
        className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-start lg:gap-x-10"
      >
        {/* Cartão 1 (PC: coluna esquerda) — aluno + turma */}
        <div className={cn(cardClass, 'grid gap-5 lg:col-start-1 lg:row-start-1 lg:row-span-2')}>
          <StepHeader n={1} titulo="Sobre o aluno" />

          <div className="space-y-1.5">
            <Label htmlFor="trial-name" className={labelClass}>
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
            <Label htmlFor="trial-birth" className={labelClass}>
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
            <p className="text-xs text-[#6B6560]">
              Usamos a idade para encaixar o aluno na turma certa.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-class" className={labelClass}>
              Turma *
            </Label>
            {isLoadingClasses ? (
              <div className="h-11 rounded-lg border border-[#E8E0D5] bg-[#FAF6F0] px-3 text-sm leading-[2.75rem] text-[#6B6560]">
                Carregando turmas...
              </div>
            ) : classes.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[#C1272D]/40 bg-[#FAF6F0] p-4 text-sm leading-relaxed text-[#4A443F]">
                <HankoStamp className="h-10 w-10 opacity-70" />
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
              <p className="text-xs leading-relaxed text-[#6B6560]">
                Esta turma funciona às{' '}
                <strong className="text-[#1C1B1A]">{diasLegiveis(weekdaysOfSelected)}</strong>
                {faixaTexto ? ` — para alunos ${faixaTexto}` : ''}
                {selected.klass.vagas > 0
                  ? ` — ${selected.vagasRestantes} vaga(s) restante(s)`
                  : ''}
              </p>
            )}
          </div>
        </div>

        {/* Cartão 2 (PC: coluna direita, sticky) — calendário de dias disponíveis */}
        <div
          className={cn(
            cardClass,
            'lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start',
          )}
        >
          <StepHeader n={2} titulo="Escolha o dia" />
          <div className="space-y-2">
            <span className={cn(labelClass, 'block')}>Data desejada da aula *</span>
            {!form.classId ? (
              <p className="rounded-xl border border-dashed border-[#E8E0D5] bg-[#FAF6F0] p-4 text-sm leading-relaxed text-[#6B6560]">
                Selecione a turma para ver no calendário os dias disponíveis para agendar.
              </p>
            ) : isLoadingDates ? (
              <div className="h-[320px] animate-pulse rounded-xl border border-[#E8E0D5] bg-[#FAF6F0]" />
            ) : (
              <TrialCalendar
                weekdays={weekdaysOfSelected}
                occupied={occupiedDates}
                minDate={minDate}
                maxDate={maxDate}
                value={form.date}
                onChange={(d) => set({ date: d })}
              />
            )}
            {form.date && weekdaysOfSelected.length > 0 && (
              <p
                className={cn(
                  'text-xs leading-relaxed',
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

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E8E0D5] pt-4 text-xs font-medium text-[#4A443F] sm:gap-x-5">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#C1272D]" aria-hidden /> Sem compromisso
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5 text-[#C1272D]" aria-hidden /> Confirmação por
              contato
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#C1272D]" aria-hidden /> Resposta rápida
            </span>
          </div>
        </div>

        {/* Cartão 3 (PC: coluna esquerda, abaixo) — contato, observação, alertas */}
        <div className={cn(cardClass, 'grid gap-5 lg:col-start-1 lg:row-start-3')}>
          <StepHeader n={3} titulo="Contato" />

          <div className="space-y-1.5">
            <Label htmlFor="trial-contact" className={labelClass}>
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
            <p className="text-xs text-[#6B6560]">
              A academia usa este contato para confirmar sua vaga.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trial-notes" className={labelClass}>
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
            <div
              role="alert"
              className="rounded-lg border border-[#C1272D]/30 bg-[#F7E4E2] px-3 py-2.5 text-xs font-semibold leading-relaxed text-[#C1272D]"
            >
              Pela data de nascimento, o aluno terá {idadeNaAula} ano(s) na data da aula — esta
              turma é para alunos {faixaTexto}. Escolha outra turma ou fale com a academia.
            </div>
          )}
        </div>

        {/* Resumo antes da confirmação */}
        <section
          aria-labelledby="trial-summary-title"
          className="relative overflow-hidden rounded-2xl bg-[#1C1B1A] p-5 text-white shadow-md sm:p-7 lg:col-span-2"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#E4636A]">
            Confira antes de enviar
          </p>
          <h2 id="trial-summary-title" className="mt-1 font-serif text-xl font-bold">
            Resumo do agendamento
          </h2>
          <BrushDivider className="mt-3 h-2.5 w-20 text-[#C1272D]" />
          <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                Aluno
              </dt>
              <dd className="mt-1 text-base font-semibold">{form.student_name.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                Turma
              </dt>
              <dd className="mt-1 text-base font-semibold">{selected?.klass.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-white/55">Data</dt>
              <dd
                className={cn(
                  'mt-1 text-base font-semibold capitalize',
                  !form.date && 'text-white/60',
                )}
              >
                {dataResumo}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                Horário
              </dt>
              <dd className="mt-1 text-base font-semibold">{selected?.klass.schedule || '—'}</dd>
            </div>
          </dl>
        </section>

        {/* Envio: largura total, embaixo de tudo */}
        <div className="lg:col-span-2">
          <Button
            type="submit"
            disabled={submitting || isLoadingClasses || classes.length === 0}
            className="h-14 w-full rounded-xl bg-[#C1272D] text-base font-bold text-white shadow-md hover:bg-[#A01E23] focus-visible:ring-[#C1272D]"
          >
            {submitting ? 'Agendando...' : 'Confirmar agendamento'}
          </Button>
        </div>
      </form>
    </div>
  )
}
