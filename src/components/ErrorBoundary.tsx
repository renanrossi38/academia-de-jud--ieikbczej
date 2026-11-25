import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Home, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Mudou de rota? Reseta o estado de erro automaticamente (senão o cartão travaria mesmo navegando). */
  resetKey?: string
}

interface ErrorBoundaryState {
  error: Error | null
  showDetails: boolean
}

/**
 * Rede de proteção contra "tela preta": qualquer exceção durante o render de
 * uma página seria capturada aqui e, em vez de desmontar a árvore React
 * inteira (fundo escuro do body), mostra um cartão amigável na identidade
 * do site.
 */
class ErrorBoundaryInner extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, showDetails: false }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log no console para diagnóstico (a mensagem técnica também aparece no cartão).
    console.error('[ErrorBoundary] Erro de render capturado:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Navegou para outra rota depois do erro? Libera a página nova.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, showDetails: false })
    }
  }

  private handleRetry = () => {
    this.setState({ error: null, showDetails: false })
  }

  render() {
    const { error, showDetails } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FBF7F2] px-4 py-16">
        <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#C1272D]/40 bg-white shadow-lg">
          <div className="border-b border-[#C1272D]/20 bg-gradient-to-r from-[#C1272D] to-[#8E1B20] px-6 py-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 shrink-0 text-white" aria-hidden="true" />
              <div>
                <h1 className="text-lg font-bold text-white">Algo deu errado nesta página</h1>
                <p className="text-sm text-white/80">
                  Não foi problema com seus dados — só um erro inesperado ao abrir a tela.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <p className="text-sm text-[#4A4540]">
              Tente novamente. Se o problema continuar, volte ao início e tente de novo mais tarde.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-md bg-[#C1272D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A02026] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C1272D]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
              <Link
                to="/"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-md border border-[#1C1B1A]/20 px-4 py-2 text-sm font-medium text-[#1C1B1A] transition-colors hover:border-[#C1272D] hover:text-[#C1272D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C1272D]"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Voltar ao início
              </Link>
            </div>

            <div className="mt-6 rounded-lg border border-[#1C1B1A]/10 bg-[#F8F5F1]">
              <button
                type="button"
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                aria-expanded={showDetails}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#6B6560] hover:text-[#C1272D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C1272D]"
              >
                Detalhes técnicos do erro
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              {showDetails && (
                <pre className="max-h-48 overflow-auto border-t border-[#1C1B1A]/10 px-4 py-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-[#4A4540]">
                  {error.message}
                  {'\n\n'}
                  {error.stack ?? 'Sem rastreamento disponível.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

/** Envolve o boundary com o contexto do router para saber a rota atual. */
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundaryInner resetKey={pathname}>{children}</ErrorBoundaryInner>
}
