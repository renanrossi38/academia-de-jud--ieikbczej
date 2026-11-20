import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de confirmação não informado na URL.')
      return
    }

    if (!password) {
      setErrorMessage('Informe sua senha atual para confirmar a troca.')
      return
    }

    setIsSubmitting(true)
    try {
      await pb.collection('users').confirmEmailChange(token, password)
      // User must re-login after email change
      logout()
      setStatus('success')
    } catch (err: any) {
      console.error('Erro na confirmação da troca de e-mail:', err)
      setStatus('error')
      setErrorMessage(err?.message || 'Token expirado, inválido ou senha incorreta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md text-center">
        <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />

        {status === 'idle' && (
          <div className="space-y-4 text-left">
            <div className="text-center">
              <h2 className="font-serif font-bold text-xl text-[#1C1B1A]">
                Confirmar Troca de E-mail
              </h2>
              <p className="text-xs text-[#6B6560] mt-1">
                Para sua segurança, digite sua senha para concluir a alteração de e-mail.
              </p>
            </div>

            {errorMessage && (
              <p className="text-xs text-[#B3261E] bg-[#F7E4E2] p-2 rounded-md">{errorMessage}</p>
            )}

            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                  Sua Senha
                </label>
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
                disabled={isSubmitting}
                className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  'Confirmar Alteração'
                )}
              </Button>
            </form>
          </div>
        )}

        {status === 'success' && (
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#2E7D4F] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">E-mail Atualizado!</h2>
            <p className="text-xs text-[#6B6560]">
              Seu e-mail foi alterado com sucesso. Por motivos de segurança, você foi desconectado e
              deve entrar com o novo e-mail.
            </p>
            <Button
              onClick={() => navigate('/entrar')}
              className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              Fazer Login com Novo E-mail
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#F7E4E2] text-[#B3261E] flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">Falha na Atualização</h2>
            <p className="text-xs text-[#B3261E]">{errorMessage}</p>
            <Link to="/conta">
              <Button variant="outline" className="w-full text-xs">
                Voltar à Minha Conta
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
