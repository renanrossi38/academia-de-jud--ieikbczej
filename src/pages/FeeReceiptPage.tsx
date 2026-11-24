import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { OfficialLogo } from '@/components/HankoStamp'
import {
  FeeReceiptUnavailableError,
  fetchFeeReceipt,
  receiptDateBrasilia,
  receiptDateTimeBrasilia,
  type FeeReceipt,
} from '@/services/feeReceipt'
import { mesPorExtenso } from '@/services/studentArea'
import { paymentMethodLabel } from '@/services/monthlyFees'

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Comprovante de pagamento de mensalidade — folha preta sobre branco,
 * imprimível (botão chama window.print; @media print esconde navegação e
 * botões). Dados vêm do hook autenticado GET /backend/v1/fee-receipt/{id},
 * que só responde para o dono do registro ou admin.
 */
export default function FeeReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState<FeeReceipt | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError('')
    try {
      setReceipt(await fetchFeeReceipt(id))
    } catch (err) {
      console.error('Erro ao carregar comprovante:', err)
      setError(
        err instanceof FeeReceiptUnavailableError
          ? err.message
          : 'Não foi possível carregar o comprovante. Tente novamente mais tarde.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/entrar?redirect=/comprovante/mensalidade/' + (id ?? ''))
      return
    }
    if (user) load()
  }, [user, authLoading, load, id, navigate])

  // Título da aba — é o nome sugerido do PDF ao "Salvar como PDF".
  useEffect(() => {
    if (receipt) {
      document.title = 'Comprovante de mensalidade — Judô Tatsu'
    }
  }, [receipt])

  // Data de emissão: capturada no carregamento (não muda a cada re-render).
  const [emitDate] = useState(() => receiptDateTimeBrasilia(new Date().toISOString()))

  return (
    <div className="min-h-[70vh] bg-[#FAF6F0] py-6 sm:py-10 px-4 fee-receipt-page">
      <div className="max-w-2xl mx-auto">
        {/* Barra de ações (não sai na impressão) */}
        <div className="fee-receipt-actions flex flex-wrap items-center justify-between gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-xs font-semibold border-[#E8E0D5] text-[#1C1B1A]"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            disabled={!receipt}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-10 text-center">
            <p className="text-sm text-[#6B6560]">Carregando comprovante...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-[#C1272D]/25 p-10 text-center">
            <p className="text-sm text-[#C1272D] font-semibold">{error}</p>
            <p className="text-xs text-[#6B6560] mt-2">
              Se você acredita que isto é um erro, fale com a academia.
            </p>
          </div>
        ) : receipt ? (
          <article
            className="fee-receipt-sheet bg-white border border-[#E8E0D5] rounded-2xl shadow-xs overflow-hidden"
            aria-label="Comprovante de pagamento de mensalidade"
          >
            {/* Faixa vermelha de identidade (mon da academia) */}
            <div className="fee-receipt-band h-2 bg-[#C1272D]" />

            <div className="p-6 sm:p-10">
              {/* Cabeçalho: logo + nome da academia / identificador */}
              <header className="flex items-start justify-between gap-4 pb-6 border-b border-[#E8E0D5]">
                <div className="flex items-center gap-3">
                  <OfficialLogo className="w-14 h-14" />
                  <div>
                    <p className="font-serif font-bold text-lg text-[#1C1B1A] leading-tight">
                      Judô Tatsu
                    </p>
                    <p className="text-[11px] text-[#6B6560] mt-0.5">Academia de Judô</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#C1272D] font-serif">
                    Comprovante
                  </p>
                  <p className="text-[11px] text-[#6B6560] font-mono mt-1">
                    nº {receipt.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </header>

              {/* Título */}
              <h1 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B1A] text-center mt-8">
                Comprovante de pagamento de mensalidade
              </h1>
              <p className="text-[11px] text-[#6B6560] text-center mt-2">
                Documento emitido pela academia como registro do pagamento.
              </p>

              {/* Dados do pagamento */}
              <dl className="mt-8 divide-y divide-[#E8E0D5] border border-[#E8E0D5] rounded-xl overflow-hidden">
                {[
                  ['Aluno', receipt.student_name || '—'],
                  ['Mês de referência', mesPorExtenso(receipt.reference_month)],
                  ['Valor pago', fmtBRL(receipt.amount)],
                  ['Data do pagamento', receiptDateTimeBrasilia(receipt.paid_at)],
                  [
                    'Forma de pagamento',
                    receipt.payment_method
                      ? (paymentMethodLabel[
                          receipt.payment_method as keyof typeof paymentMethodLabel
                        ] ?? receipt.payment_method)
                      : 'Não informado',
                  ],
                  ['Vencimento', receipt.due_date ? receiptDateBrasilia(receipt.due_date) : '—'],
                  ['Emitido em', emitDate],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4 px-4 py-3 bg-white even:bg-[#FAF6F0]/40"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wider text-[#6B6560] shrink-0">
                      {label}
                    </dt>
                    <dd className="text-sm font-bold text-[#1C1B1A] text-right">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Rodapé do comprovante */}
              <footer className="mt-10 pt-5 border-t border-[#E8E0D5] flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-[10px] text-[#6B6560] leading-relaxed">
                  Guarde este documento como registro do seu pagamento. Em caso de dúvida, fale com
                  a secretaria da academia.
                </p>
                <p className="text-[10px] text-[#6B6560] font-mono shrink-0">Ref.: {receipt.id}</p>
              </footer>
            </div>
          </article>
        ) : null}
      </div>

      {/* Impressão: só a folha do comprovante, preto sobre branco */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .fee-receipt-page { background: #fff !important; padding: 0 !important; }
          .fee-receipt-actions { display: none !important; }
          .fee-receipt-sheet {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  )
}
