import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Links de âncora internos à home ("/#secao" e "#secao").
 *
 * Dois casos distintos:
 *
 * 1. Seções com id próprio (#instagram, #como-funciona): dentro da home o
 *    clique rola direto (funciona em cliques repetidos); fora da home,
 *    navega para "/#secao" e o ScrollToTop da App resolve.
 *
 * 2. Abas da home (#turmas e #kimonos): NÃO são seções com id próprio —
 *    "kimonos" é o estado activeTab da Index. Rolando direto o clique não
 *    encontraria elemento ("o botão não faz nada"). Então sempre navegam via
 *    router para "/#secao": a Index reage ao hash, ativa a aba certa e rola
 *    até a barra de abas (inclusive trocando de volta p/ "Turmas").
 */
export const HEADER_OFFSET_PX = 88

/** Âncoras que selecionam uma aba da Index (não existem como id no DOM). */
const TAB_ANCHORS = ['turmas', 'kimonos']

/** Rolamento suave até um id, descontando o header fixo (mesmo offset do ScrollToTop). */
export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX
  window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
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

    // Seção comum: rola direto (funciona em cliques repetidos).
    if (scrollToSection(id)) event.preventDefault()
    // Atualiza o hash sem pular (feedback de "onde estou" na barra do browser).
    window.history.replaceState(null, '', `#${id}`)
  }
}

/**
 * <a href="#secao"> com scroll suave descontando o header, dentro da home.
 * Noutas rotas, navega para "/#secao" (ScrollToTop faz o resto).
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
