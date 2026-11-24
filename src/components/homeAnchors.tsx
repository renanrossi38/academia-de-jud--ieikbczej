import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Links de âncora internos à home ("/#secao" e "#secao"):
 *
 * - Em "/#secao": sem JS o browser rola instantâneo e SEM descontar o header
 *   fixo — cobre o começo do bloco. Aqui interceptamos e rolamos suave até a
 *   seção menos a altura do header (sticky, 72px).
 * - Em outra rota (ex. footer de /produto): navega para a home com o hash e
 *   deixa o ScrollToTop da App cuidar do scroll após o paint.
 *
 * Mesmo offset do ScrollToTop (88px = header 72px + respiro).
 */
const HEADER_OFFSET_PX = 88

/** Intercepta cliques em âncoras da home dentro da própria home. */
export function useHomeAnchorScroll() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const raw = href.startsWith('#') ? href : `#${href.split('#')[1] || ''}`
    const id = raw.slice(1)
    if (!id) return

    // Fora da home: deixa o <Link> navegar para /#secao (ScrollToTop resolve).
    if (pathname !== '/') return

    event.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
    }
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
