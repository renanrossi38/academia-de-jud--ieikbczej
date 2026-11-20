import React, { useState } from 'react'
import { Belt, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { studentsService } from '@/services/students'
import { Loader2 } from 'lucide-react'

const BELT_OPTIONS: { label: string; value: Belt }[] = [
  { label: 'Branca', value: 'branca' },
  { label: 'Cinza', value: 'cinza' },
  { label: 'Amarela', value: 'amarela' },
  { label: 'Laranja', value: 'laranja' },
  { label: 'Verde', value: 'verde' },
  { label: 'Azul', value: 'azul' },
  { label: 'Roxa', value: 'roxa' },
  { label: 'Marrom', value: 'marrom' },
  { label: 'Preta', value: 'preta' },
]

export const beltLabel = (belt?: string) => BELT_OPTIONS.find((b) => b.value === belt)?.label || '—'

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
    default:
      return 'bg-white text-[#1C1B1A] border-[#E8E0D5]'
  }
}

const selectClass =
  'w-full h-9 text-sm rounded-md border border-[#E8E0D5] bg-white px-3 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

interface StudentFormState {
  name: string
  email: string
  phone: string
  belt: Belt | ''
  address: string
  birth_date: string
}

const emptyForm: StudentFormState = {
  name: '',
  email: '',
  phone: '',
  belt: '',
  address: '',
  birth_date: '',
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
  const [form, setForm] = useState<StudentFormState>(emptyForm)
  const [creating, setCreating] = useState(false)

  const resetAndClose = () => {
    setForm(emptyForm)
    onOpenChange(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({
        title: 'O nome é obrigatório',
        description: 'Telefone, faixa e e-mail são opcionais.',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      const student = await studentsService.createStudent({
        name: form.name,
        email: form.email,
        phone: form.phone,
        belt: (form.belt || undefined) as Belt | undefined,
        address: form.address,
        birth_date: form.birth_date,
      })
      onCreated(student)
      toast({
        title: 'Aluno cadastrado!',
        description: `${student.name} foi adicionado à academia.`,
      })
      resetAndClose()
    } catch (err: any) {
      console.error('Erro ao cadastrar aluno:', err)
      toast({
        title: 'Falha ao cadastrar aluno',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="sm:max-w-md bg-white border-[#E8E0D5]">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle className="font-serif text-[#1C1B1A]">Cadastrar Novo Aluno</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6560]">
              Só o nome é obrigatório. O e-mail é opcional e só serve para gerar o acesso ao site
              depois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 90000-0000"
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
                {BELT_OPTIONS.map((b) => (
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Opcional — aluno@email.com"
                className="bg-white border-[#E8E0D5]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
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
  const [form, setForm] = useState<StudentFormState>(emptyForm)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Preenche o formulário sempre que um aluno diferente é aberto
  if (student && loadedFor !== student.id) {
    setForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      belt: (student.belt as Belt) || '',
      address: student.address || '',
      birth_date: toBirthDateInput(student.birth_date),
    })
    setActive(student.active !== false)
    setLoadedFor(student.id)
  }

  const hasAccount = !!student?.user

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    if (!form.name.trim()) {
      toast({ title: 'O nome é obrigatório', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const updated = await studentsService.updateStudent(student.id, {
        name: form.name.trim(),
        email: hasAccount ? student.email || '' : form.email.trim(),
        phone: form.phone.trim(),
        belt: form.belt,
        address: form.address.trim(),
        birth_date: form.birth_date,
        active,
      })

      onSaved(updated)
      onOpenChange(false)
      toast({
        title: 'Dados do aluno atualizados!',
        description: 'As alterações de dados e status foram salvas.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar aluno:', err)
      toast({
        title: 'Erro ao atualizar aluno',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-[#E8E0D5]">
        <form onSubmit={handleEdit}>
          <DialogHeader>
            <DialogTitle className="font-serif text-[#1C1B1A]">Editar Aluno</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6560]">
              Atualize os dados de {student?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs text-[#1C1B1A] font-medium">
                Nome completo *
              </Label>
              <Input
                id="edit-name"
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
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 90000-0000"
                className="bg-white border-[#E8E0D5]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-address" className="text-xs text-[#1C1B1A] font-medium">
                Endereço
              </Label>
              <Input
                id="edit-address"
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
                {BELT_OPTIONS.map((b) => (
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

          <DialogFooter className="gap-2">
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
