import React, { useEffect, useRef, useState } from 'react'
import { Belt, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loadBeltOrder } from '@/services/beltOrder'
import { BELT_ORDER } from '@/services/beltPromotions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { studentsService, guardianPhoneError, friendlyStudentSaveError } from '@/services/students'
import {
  createStudentViaRoute,
  isSessionError,
  serverErrorMessage,
  validateStudentInput,
} from '@/services/studentsRoute'
import { idadeDe } from '@/services/trialBookings'
import { iniciaisDoNome } from '@/services/highlights'
import { Loader2, X } from 'lucide-react'

const BELT_LABELS: Record<Belt, string> = {
  branca: 'Branca',
  branca_ponta_cinza: 'Branca ponta cinza',
  cinza: 'Cinza',
  cinza_ponta_azul: 'Cinza ponta azul',
  azul: 'Azul',
  azul_ponta_amarela: 'Azul ponta amarela',
  amarela: 'Amarela',
  amarela_ponta_laranja: 'Amarela ponta laranja',
  laranja: 'Laranja',
  verde: 'Verde',
  roxa: 'Roxa',
  marrom: 'Marrom',
  preta: 'Preta',
}

const BELT_OPTIONS: { label: string; value: Belt }[] = BELT_ORDER.map((value) => ({
  label: BELT_LABELS[value],
  value,
}))

/** Título do toast por campo com problema, na validação local do cadastro. */
const FIRST_FIELD_TITLES: Record<string, string> = {
  name: 'Informe o nome do aluno',
  email: 'E-mail do aluno inválido',
  phone: 'Telefone do aluno inválido',
  belt: 'Faixa inválida',
  birth_date: 'Data de nascimento inválida',
  guardian_email: 'E-mail do responsável inválido',
  guardian_phone: 'Telefone do responsável inválido',
}

export const beltLabel = (belt?: string) => BELT_LABELS[(belt || '') as Belt] || '—'

/**
 * Opções de faixa na ordem configurada pelo admin (ordem padrão do judô até
 * que ele reordene). Usada pelos selects de cadastro/edição de aluno.
 */
export function useBeltOptions(): { label: string; value: Belt }[] {
  const [order, setOrder] = useState<{ label: string; value: Belt }[]>(BELT_OPTIONS)
  useEffect(() => {
    let cancelled = false
    loadBeltOrder().then((saved) => {
      if (cancelled) return
      setOrder(saved.map((value) => ({ label: BELT_LABELS[value], value })))
    })
    return () => {
      cancelled = true
    }
  }, [])
  return order
}

export const beltBadgeClass = (belt?: string) => {
  switch (belt) {
    case 'preta':
      return 'bg-[#1C1B1A] text-white border-[#1C1B1A]'
    case 'marrom':
      return 'bg-[#8B5E3C] text-white border-[#8B5E3C]'
    case 'roxa':
      return 'bg-[#6B4E9B] text-white border-[#6B4E9B]'
    case 'azul':
      return 'bg-[#2C5F9E] text-white border-[#2C5F9E]'
    case 'verde':
      return 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
    case 'laranja':
      return 'bg-[#E07B39] text-white border-[#E07B39]'
    case 'amarela':
      return 'bg-[#E6C229] text-[#1C1B1A] border-[#E6C229]'
    case 'cinza':
      return 'bg-[#9A948C] text-white border-[#9A948C]'
    case 'branca_ponta_cinza':
      return 'bg-white text-[#1C1B1A] border-[#9A948C] ring-1 ring-inset ring-[#9A948C]'
    case 'cinza_ponta_azul':
      return 'bg-[#9A948C] text-white border-[#2C5F9E] ring-1 ring-inset ring-[#2C5F9E]'
    case 'azul_ponta_amarela':
      return 'bg-[#2C5F9E] text-white border-[#E6C229] ring-1 ring-inset ring-[#E6C229]'
    case 'amarela_ponta_laranja':
      return 'bg-[#E6C229] text-[#1C1B1A] border-[#E07B39] ring-1 ring-inset ring-[#E07B39]'
    default:
      return 'bg-white text-[#1C1B1A] border-[#E8E0D5]'
  }
}

// iOS Safari dá zoom automático em qualquer controle de formulário com fonte
// menor que 16px — o zoom desloca o diálogo fixed para fora da tela e os
// campos "sumiam". Inputs do shadcn já usam text-base md:text-sm; o select
// (e qualquer controle raw) precisa seguir o MESMO padrão: 16px no celular,
// 14px só a partir de md.
const selectClass =
  'w-full h-10 text-base md:h-9 md:text-sm rounded-md border border-[#E8E0D5] bg-white px-3 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

interface StudentFormState {
  name: string
  email: string
  photo: File | null
  removePhoto: boolean
  phone: string
  belt: Belt | ''
  address: string
  birth_date: string
  guardian_name: string
  guardian_phone: string
  guardian_email: string
}

const emptyForm: StudentFormState = {
  name: '',
  email: '',
  photo: null,
  removePhoto: false,
  phone: '',
  belt: '',
  address: '',
  birth_date: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
}

/** Data (YYYY-MM-DD) a partir do campo date do PocketBase, sem deslocar o dia. */
const toBirthDateInput = (value?: string): string => (value ? value.slice(0, 10) : '')

/** Formata a data de nascimento (YYYY-MM-DD) para exibição em pt-BR. */
export const birthDateLabel = (value?: string): string => {
  const key = toBirthDateInput(value)
  if (!key || key.length !== 10) return '—'
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

/** Campo "Foto do aluno" dos diálogos de criar/editar: prévia redonda com
 * foto ou iniciais, botão de enviar e de remover (apenas no editar). */
export const StudentPhotoField: React.FC<{
  previewUrl: string
  name: string
  hasExistingPhoto: boolean
  removing: boolean
  onPick: (file: File | null) => void
  onRemove?: () => void
  idPrefix: string
}> = ({ previewUrl, name, hasExistingPhoto, removing, onPick, onRemove, idPrefix }) => {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-photo`} className="text-xs text-[#1C1B1A] font-medium">
        Foto do aluno
      </Label>
      <p className="text-[11px] text-[#6B6560]">
        Opcional — usada nos destaques da página inicial. JPG, PNG ou WEBP, até 5&nbsp;MB.
      </p>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border border-[#E8E0D5] bg-[#F7E4E2] flex items-center justify-center shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt={'Foto de ' + name} className="w-full h-full object-cover" />
          ) : removing ? (
            <span className="text-[10px] text-[#9A948C] text-center px-1">Removida</span>
          ) : (
            <span className="font-serif font-bold text-lg text-[#C1272D]">
              {iniciaisDoNome(name)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#E8E0D5] text-xs"
            onClick={() => fileRef.current?.click()}
          >
            {previewUrl || hasExistingPhoto ? 'Trocar foto' : 'Enviar foto'}
          </Button>
          {(previewUrl || (hasExistingPhoto && onRemove)) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[#C1272D] text-xs h-7"
              onClick={onRemove ?? (() => onPick(null))}
            >
              <X className="w-3 h-3 mr-1" />
              Remover foto
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          id={`${idPrefix}-photo`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

/** Valida o arquivo de foto escolhido (tipo e tamanho). */
export const studentPhotoError = (f: File | null): string | null => {
  if (!f) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    return 'Envie a foto em JPG, PNG ou WEBP.'
  if (f.size > 5 * 1024 * 1024) return 'Envie uma imagem de até 5 MB.'
  return null
}

/**
 * Idade completa a partir da data de nascimento (YYYY-MM-DD), recalculada a
 * cada digitação. null quando a data não foi informada (ou está incompleta).
 */
const idadeDeBirth = (birth: string): number | null => idadeDe(birth || '')

/** A seção de responsável aparece SOMENTE quando a data de nascimento dá
 * menos de 18 anos (regra do dono). Data em branco ou 18+ → some. */
const responsavelVisivel = (birth: string): boolean => {
  const idade = idadeDeBirth(birth)
  return idade !== null && idade < 18
}

/** Seção "Responsável" — contato do responsável de aluno menor de idade.
 * Aparece só quando a data de nascimento dá menos de 18 anos; quando o aluno
 * é maior e já tem responsável gravado, mostra leitura discreta sem apagar
 * o dado (nada é enviado ao salvar). */
export const GuardianSection: React.FC<{
  form: StudentFormState
  setForm: React.Dispatch<React.SetStateAction<StudentFormState>>
  phoneError: string | null
  idPrefix: string
  existingGuardian?: { name?: string; phone?: string; email?: string }
}> = ({ form, setForm, phoneError, idPrefix, existingGuardian }) => {
  const isMinor = responsavelVisivel(form.birth_date)

  if (!isMinor) {
    const g = existingGuardian
    const temDado = !!(g && (g.name || g.phone || g.email))
    if (!temDado) return null
    return (
      <div className="space-y-1 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0]/60 p-3">
        <p className="text-xs font-semibold text-[#1C1B1A] font-serif">Responsável</p>
        <p className="text-[11px] text-[#6B6560]">
          Aluno maior de idade — estes dados ficaram gravados de um cadastro anterior e são
          mantidos: {g?.name || '—'}
          {g?.phone ? ` · ${g.phone}` : ''}
          {g?.email ? ` · ${g.email}` : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0]/60 p-3">
      <div>
        <p className="text-xs font-semibold text-[#1C1B1A] font-serif">Responsável</p>
        <p className="text-[11px] text-[#6B6560]">
          Aluno menor de idade — cadastre o contato do responsável. O responsável não recebe conta
          de acesso ao site.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-guardian-name`} className="text-xs text-[#1C1B1A] font-medium">
          Nome do responsável
        </Label>
        <Input
          id={`${idPrefix}-guardian-name`}
          value={form.guardian_name}
          onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
          placeholder="Ex.: Kenji Suzuki"
          autoComplete="off"
          className="bg-white border-[#E8E0D5]"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-guardian-phone`}
            className="text-xs text-[#1C1B1A] font-medium"
          >
            Telefone do responsável
          </Label>
          <Input
            id={`${idPrefix}-guardian-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={form.guardian_phone}
            onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
            placeholder="(11) 90000-0000"
            className="bg-white border-[#E8E0D5]"
          />
          {phoneError && <p className="text-[11px] text-[#C1272D]">{phoneError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor={`${idPrefix}-guardian-email`}
            className="text-xs text-[#1C1B1A] font-medium"
          >
            E-mail do responsável
          </Label>
          <Input
            id={`${idPrefix}-guardian-email`}
            type="email"
            autoComplete="off"
            value={form.guardian_email}
            onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
            placeholder="Opcional — responsavel@email.com"
            className="bg-white border-[#E8E0D5]"
          />
        </div>
      </div>
    </div>
  )
}

interface CreateStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (student: Student) => void
}

export const CreateStudentDialog: React.FC<CreateStudentDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const { toast } = useToast()
  const beltOptions = useBeltOptions()
  const [form, setForm] = useState<StudentFormState>(emptyForm)
  const [creating, setCreating] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')
  // Trava anti-duplicação: um duplo clique no botão "Cadastrar Aluno" dispara
  // dois submits antes do re-render desabilitar o botão (o estado `creating`
  // só é aplicado depois do paint). A ref bloqueia o segundo envio na hora.
  const submittingRef = useRef(false)
  const guardianPhoneErr = responsavelVisivel(form.birth_date)
    ? guardianPhoneError(form.guardian_phone)
    : null

  // URL local de prévia da foto escolhida
  useEffect(() => {
    if (!form.photo) {
      setPhotoPreview('')
      return
    }
    const url = URL.createObjectURL(form.photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [form.photo])

  const resetAndClose = () => {
    setForm(emptyForm)
    onOpenChange(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    // Duplo clique (ou Enter repetido) enquanto o envio anterior está em
    // curso: ignora — não valida nem cria de novo.
    if (submittingRef.current) return
    submittingRef.current = true
    const menor = responsavelVisivel(form.birth_date)

    // Validação local espelhada no servidor: o toast mostra campo e motivo —
    // nunca um erro genérico.
    const localErrors = validateStudentInput({
      name: form.name,
      email: form.email,
      phone: form.phone,
      belt: form.belt || undefined,
      birth_date: form.birth_date,
      guardian_email: form.guardian_email,
      ...(menor ? { guardian_phone: form.guardian_phone } : {}),
    })
    if (!menor && form.guardian_phone.trim() && guardianPhoneError(form.guardian_phone)) {
      localErrors.guardian_phone = guardianPhoneError(form.guardian_phone) as string
    }
    if (Object.keys(localErrors).length > 0) {
      const first = Object.entries(localErrors)[0]
      toast({
        title: FIRST_FIELD_TITLES[first[0]] || 'Falha ao cadastrar aluno',
        description: first[1],
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      // Criação pela ROTA PRÓPRIA do servidor (/backend/v1/students/create):
      // valida o admin explicitamente (sessão fantasma vira 401 claro) e
      // devolve erros reais POR CAMPO — nunca um 400 opaco.
      let student = await createStudentViaRoute({
        name: form.name,
        email: form.email,
        phone: form.phone,
        belt: (form.belt || undefined) as Belt | undefined,
        address: form.address,
        birth_date: form.birth_date,
        // Responsável só é enviado para menor de 18 anos (regra do dono);
        // para maior, nada de responsável sai no payload.
        ...(menor
          ? {
              guardian_name: form.guardian_name,
              guardian_phone: form.guardian_phone,
              guardian_email: form.guardian_email,
            }
          : {}),
      })
      // Foto escolhida: envia após criar o registro (campo file do PocketBase)
      if (form.photo) {
        student = await studentsService.setPhoto(student.id, form.photo)
      }
      onCreated(student)
      toast({
        title: 'Aluno cadastrado!',
        description: `${student.name} foi adicionado à academia.`,
      })
      resetAndClose()
    } catch (err: unknown) {
      console.error('Erro ao cadastrar aluno:', err)
      if (isSessionError(err)) {
        toast({
          title: 'Sua sessão expirou',
          description: 'Sua sessão expirou, entre novamente.',
          variant: 'destructive',
        })
        window.location.assign('/entrar')
        return
      }
      toast({
        title: 'Falha ao cadastrar aluno',
        description: serverErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      submittingRef.current = false
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : resetAndClose())}>
      {/* Cabeçalho e rodapé fixos; só o corpo rola — nada some da tela
          (desktop e celular, mesmo com o teclado aberto). */}
      {/* iOS: sem w-fit (o default md:max-w-lg do shadcn estoura a tela em
          landscape) e sem h/altura fixa — só max-h com dvh, que respeita a
          barra do Safari e o teclado aberto. Cabeçalho e rodapé fixos; só o
          corpo rola (min-h-0 obrigatório para o overflow do meio funcionar). */}
      {/* Mobile (v0.0.177): o diálogo é ANCORADO NO TOPO da tela — o default
          do shadcn centraliza (top-50%/-translate-y-50%) e, quando o teclado
          sobe, o topo do formulário fica escondido acima da área visível.
          Zeramos left/top/translate no celular e a partir de sm: voltamos ao
          posicionamento centralizado do shadcn. O max-h-[100dvh] respeita o
          teclado (viewport meta com interactive-widget=resizes-content). */}
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-none border-x-0 border-t-0 bg-white p-4 sm:left-[50%] sm:top-[50%] sm:max-h-[92dvh] sm:max-w-md sm:w-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6 border-[#E8E0D5]">
        <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif text-[#1C1B1A]">Cadastrar Novo Aluno</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6560]">
              Só o nome é obrigatório. Telefone e e-mail do aluno são opcionais; para aluno menor de
              idade, cadastre o contato do responsável.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <StudentPhotoField
              previewUrl={photoPreview}
              name={form.name}
              hasExistingPhoto={false}
              removing={false}
              onPick={(f) => {
                const pErr = studentPhotoError(f)
                if (pErr) {
                  toast({ title: 'Foto inválida', description: pErr, variant: 'destructive' })
                  return
                }
                setForm((prev) => ({ ...prev, photo: f, removePhoto: false }))
              }}
              onRemove={() => setForm((prev) => ({ ...prev, photo: null }))}
              idPrefix="create"
            />

            <div className="space-y-1.5">
              <Label htmlFor="student-name" className="text-xs text-[#1C1B1A] font-medium">
                Nome completo *
              </Label>
              <Input
                id="student-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Hana Suzuki"
                className="bg-white border-[#E8E0D5]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="student-phone" className="text-xs text-[#1C1B1A] font-medium">
                Telefone
              </Label>
              <Input
                id="student-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Opcional — (11) 90000-0000"
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="student-belt" className="text-xs text-[#1C1B1A] font-medium">
                Faixa
              </Label>
              <select
                id="student-belt"
                value={form.belt}
                onChange={(e) => setForm({ ...form, belt: e.target.value as Belt | '' })}
                className={selectClass}
              >
                <option value="">Selecione a faixa...</option>
                {beltOptions.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="student-address" className="text-xs text-[#1C1B1A] font-medium">
                Endereço
              </Label>
              <Input
                id="student-address"
                autoComplete="off"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Opcional — rua, número, bairro, cidade"
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="student-birth" className="text-xs text-[#1C1B1A] font-medium">
                Data de nascimento
              </Label>
              <Input
                id="student-birth"
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="student-email" className="text-xs text-[#1C1B1A] font-medium">
                E-mail
              </Label>
              <Input
                id="student-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Opcional — aluno@email.com"
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <GuardianSection
              form={form}
              setForm={setForm}
              phoneError={guardianPhoneErr}
              idPrefix="student"
            />
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-[#E8E0D5] pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              className="border-[#E8E0D5] text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={creating}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Cadastrar Aluno'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface EditStudentDialogProps {
  student: Student | null
  onOpenChange: (open: boolean) => void
  onSaved: (updated: Student) => void
}

export const EditStudentDialog: React.FC<EditStudentDialogProps> = ({
  student,
  onOpenChange,
  onSaved,
}) => {
  const { toast } = useToast()
  const beltOptions = useBeltOptions()
  const [form, setForm] = useState<StudentFormState>(emptyForm)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  // Mesma trava do cadastro: duplo clique em "Salvar" não reenvia o update.
  const submittingRef = useRef(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoRemoval, setPhotoRemoval] = useState(false)
  const guardianPhoneErr = responsavelVisivel(form.birth_date)
    ? guardianPhoneError(form.guardian_phone)
    : null

  // Preenche o formulário sempre que um aluno diferente é aberto
  if (student && loadedFor !== student.id) {
    setForm({
      name: student.name || '',
      email: student.email || '',
      photo: null,
      removePhoto: false,
      phone: student.phone || '',
      belt: (student.belt as Belt) || '',
      address: student.address || '',
      birth_date: toBirthDateInput(student.birth_date),
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      guardian_email: student.guardian_email || '',
    })
    setActive(student.active !== false)
    setPhotoRemoval(false)
    setPhotoPreview('')
    setLoadedFor(student.id)
  }

  // Prévia local da foto escolhida (novo arquivo sobrepõe a foto gravada)
  useEffect(() => {
    if (!form.photo) {
      setPhotoPreview('')
      return
    }
    const url = URL.createObjectURL(form.photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [form.photo])

  const hasAccount = !!student?.user

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    if (!form.name.trim()) {
      toast({ title: 'Informe o nome do aluno', variant: 'destructive' })
      return
    }
    const menor = responsavelVisivel(form.birth_date)
    // Telefone do aluno é opcional — mas, se preenchido, precisa ser válido
    // (mesma regra do telefone do responsável). Para menor, o contato real
    // costuma ser o do responsável; o do aluno pode ficar em branco.
    const sPhoneErr = guardianPhoneError(form.phone)
    if (sPhoneErr) {
      toast({
        title: 'Telefone do aluno inválido',
        description: sPhoneErr,
        variant: 'destructive',
      })
      return
    }
    const gPhoneErr = menor ? guardianPhoneError(form.guardian_phone) : null
    if (gPhoneErr) {
      toast({
        title: 'Telefone do responsável inválido',
        description: gPhoneErr,
        variant: 'destructive',
      })
      return
    }

    const photoErr = studentPhotoError(form.photo)
    if (photoErr) {
      toast({ title: 'Foto inválida', description: photoErr, variant: 'destructive' })
      return
    }

    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    try {
      const updated = await studentsService.updateStudent(student.id, {
        name: form.name.trim(),
        email: hasAccount ? student.email || '' : form.email.trim(),
        phone: form.phone.trim(),
        belt: form.belt || undefined,
        address: form.address.trim() || undefined,
        birth_date: form.birth_date || undefined,
        // Responsável: para menor, salva o que está no formulário; para maior,
        // NADA é enviado — dados de responsável gravados ficam intactos.
        ...(menor
          ? {
              guardian_name: form.guardian_name.trim(),
              guardian_phone: form.guardian_phone.trim(),
              guardian_email: form.guardian_email.trim(),
            }
          : {}),
        active,
      })
      let final = updated
      // Foto: troca (arquivo novo) ou remove (campo vazio via FormData)
      if (form.photo || form.removePhoto) {
        final = await studentsService.setPhoto(student.id, form.photo)
      }

      onSaved(final)
      onOpenChange(false)
      toast({
        title: 'Dados do aluno atualizados!',
        description: 'As alterações de dados e status foram salvas.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar aluno:', err)
      toast({
        title: 'Erro ao atualizar aluno',
        description: friendlyStudentSaveError(err),
        variant: 'destructive',
      })
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      {/* Mesmo padrão do cadastro (v0.0.177): no celular o diálogo é ancorado
          NO TOPO da tela (o teclado não esconde o topo do formulário) e a
          partir de sm: volta ao padrão centralizado do shadcn. */}
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-none border-x-0 border-t-0 bg-white p-4 sm:left-[50%] sm:top-[50%] sm:max-h-[92dvh] sm:max-w-md sm:w-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6 border-[#E8E0D5]">
        <form onSubmit={handleEdit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif text-[#1C1B1A]">Editar Aluno</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6560]">
              Atualize os dados de {student?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <StudentPhotoField
              previewUrl={
                photoPreview ||
                (photoRemoval || !student ? '' : studentsService.getPhotoUrl(student, 'sm'))
              }
              name={form.name}
              hasExistingPhoto={!!student?.photo}
              removing={photoRemoval}
              onPick={(f) => {
                const pErr = studentPhotoError(f)
                if (pErr) {
                  toast({ title: 'Foto inválida', description: pErr, variant: 'destructive' })
                  return
                }
                setPhotoRemoval(false)
                setForm((prev) => ({ ...prev, photo: f, removePhoto: false }))
              }}
              onRemove={() => {
                setPhotoRemoval(true)
                setForm((prev) => ({ ...prev, photo: null, removePhoto: true }))
              }}
              idPrefix="edit"
            />

            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs text-[#1C1B1A] font-medium">
                Nome completo *
              </Label>
              <Input
                id="edit-name"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white border-[#E8E0D5]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs text-[#1C1B1A] font-medium">
                E-mail
              </Label>
              <Input
                id="edit-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={hasAccount}
                placeholder="Opcional"
                className="bg-white border-[#E8E0D5] disabled:bg-[#FAF6F0] disabled:text-[#6B6560]"
              />
              <p className="text-[11px] text-[#6B6560]">
                {hasAccount
                  ? 'Este aluno já tem conta de acesso: o e-mail de login não muda por aqui.'
                  : 'Opcional. Preencha para poder gerar o acesso ao site.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-phone" className="text-xs text-[#1C1B1A] font-medium">
                Telefone
              </Label>
              <Input
                id="edit-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Opcional — (11) 90000-0000"
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-address" className="text-xs text-[#1C1B1A] font-medium">
                Endereço
              </Label>
              <Input
                id="edit-address"
                autoComplete="off"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Opcional — rua, número, bairro, cidade"
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-birth" className="text-xs text-[#1C1B1A] font-medium">
                Data de nascimento
              </Label>
              <Input
                id="edit-birth"
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <GuardianSection
              form={form}
              setForm={setForm}
              phoneError={guardianPhoneErr}
              idPrefix="edit"
              existingGuardian={{
                name: student?.guardian_name,
                phone: student?.guardian_phone,
                email: student?.guardian_email,
              }}
            />

            <div className="space-y-1.5">
              <Label htmlFor="edit-belt" className="text-xs text-[#1C1B1A] font-medium">
                Faixa
              </Label>
              <select
                id="edit-belt"
                value={form.belt}
                onChange={(e) => setForm({ ...form, belt: e.target.value as Belt | '' })}
                className={selectClass}
              >
                <option value="">Selecione a faixa...</option>
                {beltOptions.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5]">
              <div>
                <Label className="text-xs text-[#1C1B1A] font-medium">Status do aluno</Label>
                <p className="text-[11px] text-[#6B6560]">
                  Alunos inativos continuam na lista, apenas marcados como inativos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  active ? 'bg-[#2E7D4F]' : 'bg-[#9A948C]'
                }`}
                aria-label="Alternar status ativo/inativo"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-[#E8E0D5] pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E8E0D5] text-xs"
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
