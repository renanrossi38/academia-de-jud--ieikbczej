import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Loader2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchPixPayload, PixUnavailableError, type PixKind } from '@/services/pix'

/**
 * Bloco Pix "copia e cola" reutilizável (mensalidade, pedido, checkout).
 *
 * Pede o payload EMV ao backend (rota /backend/v1/pix-payload) e desenha o QR
 * em canvas com a biblioteca `qrcode` — sem serviço externo de imagem.
 * Copiar usa a API da área de transferência com fallback de seleção para
 * navegadores antigos. A confirmação é MANUAL pela academia — a instrução
 * deixa isso explícito.
 */

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface PixPaymentBlockProps {
  kind: PixKind
  id: string
  /** Texto do título do bloco (ex.: "Pagar mensalidade com Pix"). */
  title?: string
  /** Oculta o botão "Pagar com Pix" — o bloco já abre aberto. */
  autoOpen?: boolean
  className?: string
}

export function PixPaymentBlock({ kind, id, title, autoOpen, className }: PixPaymentBlockProps) {
  const [open, setOpen] = useState(!!autoOpen)
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [payload, setPayload] = useState('')
  const [value, setValue] = useState(0)
  const [description, setDescription] = useState('')
  const [unavailable, setUnavailable] = useState('')
  const [copied, setCopied] = useState(false)

  const loadPayload = useCallback(async () => {
    if (loading || payload) return
    setLoading(true)
    setUnavailable('')
    try {
      const res = await fetchPixPayload(kind, id)
      setPayload(res.payload)
      setValue(res.value)
      setDescription(res.description)
      const url = await QRCode.toDataURL(res.payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 480,
        color: { dark: '#1C1B1A', light: '#FFFFFF' },
      })
      setQrDataUrl(url)
    } catch (err) {
      if (err instanceof PixUnavailableError) {
        setUnavailable(err.message)
      } else {
        console.error('Erro ao gerar Pix:', err)
        setUnavailable('Não foi possível gerar o Pix agora. Tente novamente mais tarde.')
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id])

  useEffect(() => {
    if (open && !payload && !unavailable) loadPayload()
  }, [open, payload, unavailable, loadPayload])

  const handleCopy = async () => {
    if (!payload) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
      } else {
        // Fallback: seleção + execCommand para navegadores sem clipboard API.
        const ta = document.createElement('textarea')
        ta.value = payload
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  // Aviso amigável quando o Pix não está configurado (ou o item já foi pago).
  if (unavailable) {
    return (
      <div
        className={
          'rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] p-4 text-xs text-[#6B6560] flex items-start gap-2.5 ' +
          (className || '')
        }
      >
        <QrCode className="w-4 h-4 text-[#C1272D] shrink-0 mt-0.5" />
        <span>{unavailable}</span>
      </div>
    )
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className={
          'h-9 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold ' +
          (className || '')
        }
      >
        <QrCode className="w-4 h-4 mr-1.5" />
        {title || 'Pagar com Pix'}
      </Button>
    )
  }

  return (
    <div
      className={
        'rounded-xl border border-[#C1272D]/25 bg-[#FAF6F0]/60 p-4 space-y-3 animate-fade-rise ' +
        (className || '')
      }
    >
      <div className="flex items-center gap-2">
        <QrCode className="w-4 h-4 text-[#C1272D]" />
        <p className="font-serif font-bold text-sm text-[#1C1B1A]">{title || 'Pagar com Pix'}</p>
        {value > 0 && (
          <span className="ml-auto text-sm font-bold text-[#C1272D] font-mono">
            {fmtBRL(value)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[#6B6560] text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Gerando QR Code Pix...
        </div>
      ) : (
        <>
          <p className="text-[11px] text-[#6B6560] text-center leading-relaxed border-b border-[#E8E0D5] pb-2 mb-1">
            O Pix é <strong className="text-[#1C1B1A]">
              confirmado manualmente pela academia
            </strong>{' '}
            após o pagamento — o valor cai direto na conta da academia (não há integração bancária
            automática).
          </p>
          <div className="flex justify-center">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code Pix da academia"
                className="w-48 h-48 rounded-lg border border-[#E8E0D5] bg-white shadow-xs"
              />
            )}
          </div>

          {description && <p className="text-center text-[11px] text-[#6B6560]">{description}</p>}

          <p className="text-[11px] text-[#6B6560] text-center leading-relaxed">
            Abra o app do seu banco, leia o QR ou cole o código Pix. Após o pagamento, o Pix é{' '}
            <strong className="text-[#1C1B1A]">confirmado manualmente pela academia</strong> — a
            confirmação não é automática.
          </p>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-[#E8E0D5] bg-white px-3 py-2">
              <p className="text-[10px] font-bold text-[#6B6560] uppercase tracking-wider mb-0.5">
                Código copia e cola
              </p>
              <p className="font-mono text-[10px] text-[#1C1B1A] break-all leading-snug">
                {payload}
              </p>
            </div>
          </div>

          <Button
            onClick={handleCopy}
            variant={copied ? 'outline' : 'default'}
            className={
              copied
                ? 'w-full h-9 border-[#2E7D4F] text-[#2E7D4F] hover:bg-[#2E7D4F]/10 text-xs font-semibold'
                : 'w-full h-9 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold'
            }
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                Copiar código Pix
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
