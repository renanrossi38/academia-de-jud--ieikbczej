import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { toast } = useToast()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      toast({
        title: 'Token inválido ou expirado',
        description: 'Solicite um novo link de recuperação.',
        variant: 'destructive',
      })
      return
    }

    if (password.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'Mínimo de 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    if (password !== passwordConfirm) {
      toast({
        title: 'As senhas não coincidem',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setIsSuccess(true)
      toast({
        title: 'Senha redefinida!',
        description: 'Você já pode entrar com sua nova senha.',
      })
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err)
      toast({
        title: 'Erro ao redefinir',
        description: err?.message || 'Link expirado ou token inválido.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md">
        <div className="text-center mb-8">
          <HankoStamp size="lg" className="mx-auto mb-3" />
          <span className="text-xs font-bold text-[#C1272D] uppercase tracking-widest font-serif">
            Judô Tatsu
          </span>
          <h1 className="font-serif font-bold text-2xl text-[#1C1B1A] mt-1">Nova Senha</h1>
        </div>

        {isSuccess ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#2E7D4F] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#1C1B1A]">Senha alterada com sucesso!</p>
            <Button
              onClick={() => navigate('/entrar')}
              className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              Ir para o Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Nova Senha (mínimo 8 dígitos)
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Confirmar Nova Senha
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold text-xs flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando nova senha...
                </>
              ) : (
                'Salvar Nova Senha'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
