import React, { useState } from 'react'
import { Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { accessOptionsFor, studentsService } from '@/services/students'
import { Loader2, Copy, Check, KeyRound } from 'lucide-react'

interface StudentAccessDialogProps {
  student: Student | null
  /** 'aluno' = e-mail do próprio aluno; 'responsavel' = e-mail do responsável. */
  mode?: 'aluno' | 'responsavel'
  onOpenChange: (open: boolean) => void
  onAccessCreated: (student: Student) => void
}

/**
 * Gera a conta de acesso ao site — pelo e-mail do ALUNO (fluxo original) ou
 * pelo e-mail do RESPONSÁVEL (aluno menor de idade sem e-mail próprio).
 * A senha aparece uma única vez.
 */
export const StudentAccessDialog: React.FC<StudentAccessDialogProps> = ({
  student,
  mode = 'aluno',
  onOpenChange,
  onAccessCreated,
}) => {
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [password, setPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const accessEmail = student
    ? mode === 'responsavel'
      ? student.guardian_email?.trim() || ''
      : student.email?.trim() || ''
    : ''
  const isGuardian = mode === 'responsavel'

  const close = () => {
    setPassword(null)
    setCopied(false)
    onOpenChange(false)
  }

  const handleCreate = async () => {
    if (!student) return
    setCreating(true)
    try {
      const { account, initialPassword } =
        mode === 'responsavel'
          ? await studentsService.createGuardianAccess(student)
          : await studentsService.createAccess(student)
      onAccessCreated({ ...student, user: account.id })
      setPassword(initialPassword)
    } catch (err: any) {
      console.error('Erro ao gerar acesso:', err)
      toast({
        title: 'Não foi possível gerar o acesso',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const copyPassword = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Senha copiada para a área de transferência' })
    } catch (_) {
      toast({
        title: 'Não foi possível copiar',
        description: 'Copie a senha manualmente antes de fechar.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md bg-white border-[#E8E0D5]">
        {password && student ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-[#1C1B1A] flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#C1272D]" />
                Acesso criado!
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6560]">
                {isGuardian ? (
                  <>
                    A conta do <strong>responsável</strong> foi criada e já está vinculada ao aluno{' '}
                    <strong>{student.name}</strong> — ao logar, ele acompanha as mensalidades,
                    pedidos e presenças do dependente. Guarde a senha inicial gerada — ela será
                    exibida <strong>apenas uma vez</strong>.
                  </>
                ) : (
                  <>
                    A conta de <strong>aluno</strong> foi criada. Guarde a senha inicial gerada —
                    ela será exibida <strong>apenas uma vez</strong>.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] space-y-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#6B6560] font-serif">
                  E-mail de acesso
                </Label>
                <p className="text-sm font-semibold text-[#1C1B1A] mt-0.5">{accessEmail}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#6B6560] font-serif">
                  Senha inicial
                </Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="flex-1 text-sm font-mono font-bold text-[#C1272D] bg-white border border-[#E8E0D5] rounded-md px-3 py-2 select-all">
                    {password}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyPassword}
                    className="border-[#E8E0D5] shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#2E7D4F]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={close}
                className="w-full bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
              >
                Entendi, copiei a senha
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-[#1C1B1A]">Gerar acesso ao site</DialogTitle>
              <DialogDescription className="text-xs text-[#6B6560]">
                {isGuardian ? (
                  <>
                    Cria a conta do <strong>responsável</strong> de {student?.name} com o e-mail{' '}
                    <strong>{accessEmail}</strong> e uma senha inicial gerada pelo sistema. Ao
                    logar, o responsável acompanha as mensalidades, pedidos e presenças do aluno.
                  </>
                ) : (
                  <>
                    Cria uma conta de login para <strong>{student?.name}</strong> com o e-mail{' '}
                    <strong>{accessEmail}</strong> e uma senha inicial gerada pelo sistema.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                className="border-[#E8E0D5] text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Acesso'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
