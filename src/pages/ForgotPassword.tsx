import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { toast } = useToast()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setSubmitted(true)
      toast({
        title: 'E-mail enviado!',
        description: 'Verifique as instruções enviadas para seu endereço.',
      })
    } catch (err: any) {
      console.error('Erro na recuperação de senha:', err)
      // Don't reveal email existence for security
      setSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md">
        <div className="text-center mb-8">
          <HankoStamp size="lg" kanji="柔" className="mx-auto mb-3" />
          <span className="text-xs font-bold text-[#C1272D] uppercase tracking-widest font-serif">
            Dojo Nippon
          </span>
          <h1 className="font-serif font-bold text-2xl text-[#1C1B1A] mt-1">Recuperar Senha</h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Informe seu e-mail cadastrado para redefinir sua senha.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#2E7D4F] flex items-center justify-center mx-auto">
              <MailCheck className="w-7 h-7" />
            </div>
            <p className="text-xs text-[#6B6560] leading-relaxed">
              Se houver uma conta associada a <strong>{email}</strong>, enviamos um link para você
              redefinir sua senha. Verifique sua caixa de entrada e spam.
            </p>
            <Link to="/entrar" className="block pt-2">
              <Button variant="outline" className="w-full text-xs">
                Voltar ao Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Seu E-mail
              </label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  Enviando link...
                </>
              ) : (
                'Enviar Link de Recuperação'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/entrar"
                className="text-xs text-[#6B6560] hover:text-[#C1272D] inline-flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
