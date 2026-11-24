import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Links de âncora internos à home ("/#secao" e "#secao").
 *
 * Três casos distintos:
 *
 * 1. Seções com id próprio (#instagram, #destaques, #como-funciona): dentro
 *    da home o clique rola direto (funciona em cliques repetidos); fora da
 *    home, navega para "/#secao" e o ScrollToTop da App resolve.
 *
 * 2. Abas da home (#turmas e #kimonos): NÃO são seções com id próprio —
 *    "kimonos" é o estado activeTab da Index. Rolando direto o clique não
 *    encontraria elemento ("o botão não faz nada"). Então sempre navegam via
 *    router para "/#secao": a Index reage ao hash, ativa a aba certa e rola
 *    até a barra de abas (inclusive trocando de volta p/ "Turmas").
 *
 * 3. Seções que nascem de dados assíncronas (#destaques, #instagram): podem
 *    ainda não existir no DOM no instante do clique. Se o rolamento direto
 *    não achar o elemento, navega via router para "/#secao" (replace) — o
 *    ScrollToTop repete a tentativa por alguns segundos até a seção aparecer.
 */
export const HEADER_OFFSET_PX = 88

/** Âncoras que selecionam uma aba da Index (não existem como id no DOM). */
const TAB_ANCHORS = ['turmas', 'kimonos']

/**
 * Rolamento suave até um id, descontando o header fixo (mesmo offset do
 * ScrollToTop).
 *
 * O conteúdo ACIMA das seções de baixo (posts do Instagram, fotos dos
 * destaques) carrega de forma assíncrona e empurra a seção-alvo para baixo
 * DEPOIS da primeira medição — o scroll então parava no meio do caminho (na
 * zona da seção anterior). Por isso a posição é re-medida por ~1,3s enquanto
 * o layout assenta; qualquer diferença relevante dispara um novo scrollTo.
 * Se o próprio usuário rolar (roda/touch), as correções são abortadas.
 */
export function scrollToSection(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false

  let ultimoTop = -1
  let abortado = false
  const cancelar = () => {
    abortado = true
  }
  // Interrupção manual do usuário vence qualquer correção pendente.
  window.addEventListener('wheel', cancelar, { once: true, passive: true })
  window.addEventListener('touchstart', cancelar, { once: true, passive: true })

  const rolar = () => {
    if (abortado) return
    const alvo = document.getElementById(id)
    if (!alvo) return
    const top = Math.max(alvo.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX, 0)
    // Layout estável (ou já correto): nada a fazer. Cada clique novo cria um
    // closure novo, então clicar de novo no mesmo item sempre re-rola.
    if (ultimoTop >= 0 && Math.abs(top - ultimoTop) < 2) return
    ultimoTop = top
    window.scrollTo({ top, behavior: 'smooth' })
  }

  rolar()
  // Re-medidas: cobrem o ajuste de layout enquanto imagens/seções carregam.
  const REVISOES_MS = [150, 350, 600, 900, 1300]
  REVISOES_MS.forEach((ms) => window.setTimeout(rolar, ms))
  return true
}

/** Intercepta cliques em âncoras da home. */
export function useHomeAnchorScroll() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const raw = href.startsWith('#') ? href : `#${href.split('#')[1] || ''}`
    const id = raw.slice(1)
    if (!id) return

    // Fora da home: navega para "/#secao" (ScrollToTop/Index resolvem).
    if (pathname !== '/') {
      event.preventDefault()
      navigate(`/#${id}`)
      return
    }

    // Abas da home: sempre via router, a Index reage ao hash (location.key).
    if (TAB_ANCHORS.includes(id)) {
      event.preventDefault()
      navigate(`/#${id}`, { replace: true })
      return
    }

    event.preventDefault()
    // Seção comum: rola direto (funciona em cliques repetidos).
    if (scrollToSection(id)) {
      // Atualiza o hash sem pular (feedback de "onde estou" na barra).
      window.history.replaceState(null, '', `#${id}`)
      return
    }
    // Seção ainda não renderizada (dados async, ex. Destaques): o router +
    // ScrollToTop repetem a tentativa até ela aparecer.
    navigate(`/#${id}`, { replace: true })
  }
}

/**
 * <a href="#secao"> com scroll suave descontando o header, dentro da home.
 * Noutras rotas, navega para "/#secao" (ScrollToTop faz o resto).
 */
export const HomeAnchor: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
> = ({ href, onClick, ...props }) => {
  const handle = useHomeAnchorScroll()
  return (
    <a
      href={href.startsWith('#') ? href : `/#${href.split('#')[1] || ''}`}
      onClick={(e) => {
        onClick?.(e)
        handle(e, href)
      }}
      {...props}
    />
  )
}
