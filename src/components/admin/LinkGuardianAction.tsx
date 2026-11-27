import React, { useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
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
import { Student } from '@/types'
import { linkStudentToExistingUser } from '@/services/students'
import { isSessionError } from '@/services/studentsRoute'

interface LinkGuardianActionProps {
  student: Student
  /** Recebe a ficha atualizada (user preenchido) para atualizar a tela. */
  onLinked: (student: Student) => void
  /** Rótulo do gatilho (padrão: "Vincular à conta existente do responsável"). */
  label?: string
  className?: string
  title?: string
}

/**
 * Ação "Vincular à conta existente do responsável" — para alunos órfãos
 * (student.user vazio + guardian_email preenchido, caso Tatiane/Isabelly):
 * confirma e grava students.user apontando para a conta que o e-mail do
 * responsável JÁ tem, via rota própria /backend/v1/students/link, sem criar
 * segunda conta.
 */
export const LinkGuardianAction: React.FC<LinkGuardianActionProps> = ({
  student,
  onLinked,
  label = 'Vincular à conta existente do responsável',
  className,
  title,
}) => {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const email = student.guardian_email?.trim() || ''

  if (!email) return null

  const handleLink = async () => {
    setLinking(true)
    try {
      const account = await linkStudentToExistingUser(student, email)
      onLinked({ ...student, user: account.id })
      toast({
        title: 'Aluno vinculado à conta existente!',
        description: `${student.name} agora aparece na conta ${email}. O responsável loga uma vez e alterna entre os filhos na área do aluno.`,
      })
      setOpen(false)
    } catch (err) {
      console.error('Erro ao vincular à conta do responsável:', err)
      toast({
        title: 'Não foi possível vincular',
        description:
          err instanceof Error && err.message
            ? err.message
            : 'Falha ao gravar o vínculo no servidor. Tente novamente.',
        variant: 'destructive',
      })
      if (isSessionError(err)) setOpen(false)
    } finally {
      setLinking(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'text-[#7A6AA8] hover:underline font-semibold text-xs inline-flex items-center gap-1'
        }
        title={title ?? `Vincular ${student.name} à conta do responsável (${email})`}
      >
        <Link2 className="w-3.5 h-3.5" />
        {label}
      </button>

      <AlertDialog open={open} onOpenChange={(o) => !linking && setOpen(o)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Vincular {student.name} à conta do responsável?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              O e-mail <strong className="text-[#1C1B1A]">{email}</strong> já tem uma conta no site.
              Ao vincular, essa MESMA conta passa a acompanhar {student.name} — sem criar uma conta
              nova. Com um único login, o responsável alterna entre os filhos na área do aluno.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={linking}
              className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleLink()
              }}
              disabled={linking}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {linking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vinculando...
                </>
              ) : (
                'Sim, vincular'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
