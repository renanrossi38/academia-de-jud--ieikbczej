import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp, OfficialLogo } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser } = useAuth()
  const { toast } = useToast()

  const query = new URLSearchParams(location.search)
  const redirect = query.get('redirect') || '/'

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !email.trim() || !password) {
      toast({
        title: 'Preencha todos os campos',
        variant: 'destructive',
      })
      return
    }

    if (password.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve conter no mínimo 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    if (password !== passwordConfirm) {
      toast({
        title: 'Senhas não conferem',
        description: 'A confirmação deve ser idêntica à senha informada.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      // Create user record with role 'aluno'
      await pb.collection('users').create({
        email: email.trim(),
        password,
        passwordConfirm,
        name: name.trim(),
        role: 'aluno',
      })

      // Request email verification
      try {
        await pb.collection('users').requestVerification(email.trim())
      } catch (err) {
        console.warn('Falha no envio do e-mail de verificação:', err)
      }

      // Auto login user
      await pb.collection('users').authWithPassword(email.trim(), password)
      await refreshUser()

      setRegisteredEmail(email.trim())
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Bem-vindo ao Judô Tatsu.',
      })
    } catch (err: any) {
      console.error('Erro ao registrar:', err)
      toast({
        title: 'Falha ao criar conta',
        description: err?.message || 'Verifique se o e-mail já não está cadastrado.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!registeredEmail) return
    try {
      await pb.collection('users').requestVerification(registeredEmail)
      toast({
        title: 'E-mail reenviado!',
        description: 'Verifique sua caixa de entrada e spam.',
      })
    } catch (_) {
      toast({
        title: 'Erro ao reenviar',
        variant: 'destructive',
      })
    }
  }

  if (registeredEmail) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md text-center">
          <div className="w-16 h-16 rounded-full bg-[#E8F5E9] text-[#2E7D4F] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">Verifique seu E-mail</h2>
          <p className="text-xs text-[#6B6560] mt-2 mb-6 leading-relaxed">
            Enviamos uma mensagem de confirmação para <strong>{registeredEmail}</strong>. Verifique
            seu e-mail para ativar todas as notificações da sua conta.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate(redirect)}
              className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              Continuar para os Pedidos
            </Button>

            <Button
              variant="outline"
              onClick={handleResendVerification}
              className="w-full h-11 border-[#E8E0D5] text-xs"
            >
              Reenviar E-mail de Verificação
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md">
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center mb-3">
            {/* Logo oficial (dragão) em tamanho grande, sem cortes no texto */}
            <OfficialLogo className="w-44 h-auto" />
            <span className="text-[10px] font-bold text-[#C1272D] uppercase tracking-[0.25em] font-serif mt-1">
              Academia de Judô
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl text-[#1C1B1A] mt-1">Cadastro de Aluno</h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Crie sua conta para registrar pedidos e acompanhar treinos.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
              Nome Completo
            </label>
            <Input
              type="text"
              placeholder="Ex.: Takeshi Yamada"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
              E-mail
            </label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
              Senha (mínimo 8 dígitos)
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
              Confirmar Senha
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
            className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              <>
                Criar Conta
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E8E0D5] text-center text-xs text-[#6B6560]">
          Já possui conta?{' '}
          <Link
            to={`/entrar?redirect=${encodeURIComponent(redirect)}`}
            className="font-semibold text-[#C1272D] hover:underline"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  )
}
