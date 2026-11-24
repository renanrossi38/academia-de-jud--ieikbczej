import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Comportamento de scroll na navegação (rota "/"):
 *
 * 1. Troca de rota → rola suavemente para o TOPO da nova página. Sem isso,
 *    no celular o visitante cai no meio da página nova e tem a impressão de
 *    que o clique não funcionou ("a página não mudou").
 * 2. Chegada em "/#" ou "/#secao" (âncora de seção da home, ex. vinda do
 *    menu do rodapé ou de outra página) → rola suavemente até a seção,
 *    descontando a altura do header fixo (sticky, 72px).
 *
 * Suave para dar o feedback visual de que a tela se moveu até o conteúdo.
 * O header é `sticky` (não `fixed`), então âncoras nativas já não ficam
 * escondidas sob ele; a margem extra cobre o respiro visual.
 */
const HEADER_OFFSET_PX = 88

export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, '')
      const attempt = (tries: number) => {
        const el = document.getElementById(id)
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX
          window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
        } else if (tries > 0) {
          // A seção pode ainda não existir no primeiro paint (dados async).
          setTimeout(() => attempt(tries - 1), 120)
        }
      }
      // Espera o paint da rota antes de medir a posição da seção.
      requestAnimationFrame(() => attempt(16))
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname, hash])

  return null
}
