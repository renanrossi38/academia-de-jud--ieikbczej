import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de verificação não informado.')
      return
    }

    const confirm = async () => {
      try {
        await pb.collection('users').confirmVerification(token)
        setStatus('success')
      } catch (err: any) {
        console.error('Erro na confirmação do e-mail:', err)
        setStatus('error')
        setErrorMessage(err?.message || 'Link expirado ou já utilizado.')
      }
    }

    confirm()
  }, [token])

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 animate-fade-rise">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E0D5] p-8 shadow-md text-center">
        <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />

        {status === 'loading' && (
          <div className="py-6 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mx-auto" />
            <h2 className="font-serif font-bold text-xl text-[#1C1B1A]">
              Verificando seu e-mail...
            </h2>
            <p className="text-xs text-[#6B6560]">Aguarde enquanto confirmamos sua conta.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#2E7D4F] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">E-mail Confirmado!</h2>
            <p className="text-xs text-[#6B6560]">
              Sua conta foi ativada com sucesso. Agora você tem acesso completo ao Dojo Nippon.
            </p>
            <Button
              onClick={() => navigate('/')}
              className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              Ir para a Loja do Dojo
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#F7E4E2] text-[#B3261E] flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">Falha na Verificação</h2>
            <p className="text-xs text-[#B3261E]">{errorMessage}</p>
            <Link to="/entrar">
              <Button variant="outline" className="w-full text-xs">
                Voltar ao Login
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
