import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowRight } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser } = useAuth()
  const { toast } = useToast()

  const query = new URLSearchParams(location.search)
  const redirect = query.get('redirect') || '/'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha seu e-mail e senha.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').authWithPassword(email.trim(), password)
      await refreshUser()
      toast({
        title: 'Bem-vindo de volta ao tatame!',
        description: 'Login realizado com sucesso.',
      })
      navigate(redirect)
    } catch (err: any) {
      console.error('Erro de login:', err)
      toast({
        title: 'Falha na autenticação',
        description: 'E-mail ou senha incorretos. Verifique suas credenciais.',
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
          <h1 className="font-serif font-bold text-2xl text-[#1C1B1A] mt-1">Entrar na Conta</h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Acesse seus pedidos e informações da academia.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider font-serif">
                Senha
              </label>
              <Link to="/recuperar-senha" className="text-[11px] text-[#C1272D] hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                Entrando...
              </>
            ) : (
              <>
                Entrar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E8E0D5] text-center text-xs text-[#6B6560]">
          Não tem conta ainda?{' '}
          <Link
            to={`/criar-conta?redirect=${encodeURIComponent(redirect)}`}
            className="font-semibold text-[#C1272D] hover:underline"
          >
            Criar conta de aluno
          </Link>
        </div>

        {/* Demo hints */}
        <div className="mt-6 p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] text-[11px] text-[#6B6560] space-y-1">
          <p className="font-bold text-[#1C1B1A]">Credenciais de Demonstração:</p>
          <p>
            • Admin: <span className="font-mono text-[#C1272D]">renanrossi38@gmail.com</span> /{' '}
            <span className="font-mono text-[#C1272D]">Skip@Pass</span>
          </p>
          <p>
            • Aluno: <span className="font-mono text-[#C1272D]">aluno@judotatsu.com</span> /{' '}
            <span className="font-mono text-[#C1272D]">Skip@Pass</span>
          </p>
        </div>
      </div>
    </div>
  )
}
