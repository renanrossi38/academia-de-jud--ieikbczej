import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp, OfficialLogo } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { changePassword, friendlyPasswordError, MIN_PASSWORD_LENGTH } from '@/services/password'
import { Loader2, KeyRound, ArrowRight } from 'lucide-react'

export default function ChangePassword() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!authLoading && !user) {
    navigate('/entrar?redirect=/alterar-senha')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha a senha atual, a nova senha e a confirmação.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: 'Senha muito curta',
        description: `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        variant: 'destructive',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'As senhas não conferem',
        description: 'A confirmação deve ser igual à nova senha.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword === currentPassword) {
      toast({
        title: 'Senha repetida',
        description: 'A nova senha deve ser diferente da senha atual.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua nova senha já está em uso. Use-a no próximo login.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('Erro ao alterar senha:', err)
      toast({
        title: 'Não foi possível alterar a senha',
        description: err instanceof Error ? err.message : friendlyPasswordError(err),
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md">
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center mb-3">
            <OfficialLogo className="w-44 h-auto" />
            <span className="text-[10px] font-bold text-[#C1272D] uppercase tracking-[0.25em] font-serif mt-1">
              Academia de Judô
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl text-[#1C1B1A] mt-1 flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5 text-[#C1272D]" />
            Alterar senha
          </h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Troque a senha inicial recebida da academia por uma que você escolher.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
              Senha atual
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
              Nova senha
            </label>
            <Input
              type="password"
              placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
              Confirmar nova senha
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Alterando...
              </>
            ) : (
              <>
                Alterar senha
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E8E0D5] text-center text-xs text-[#6B6560]">
          <HankoStamp size="sm" className="mx-auto mb-2" />
          Mantenha sua nova senha em um lugar seguro — ela substitui a senha inicial.
        </div>
      </div>
    </div>
  )
}
