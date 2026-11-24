import { useEffect, useState } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import {
  fetchKidsHighlights,
  brasiliaMonthKeyLocal,
  KidsHighlight,
} from '@/services/kidsHighlights'
import { HeroSun, BrushDivider } from '@/components/hero/HeroDecor'
import { Star } from 'lucide-react'

/**
 * Seção pública "Alunos destaque do mês" da home (Judô Tatsu).
 *
 * Mostra, para cada turma INFANTIL com destaque vigente, um card com a foto
 * (avatar, se houver), o nome do aluno, o nome da turma e o mês de referência.
 * O destaque vigente é quem ganhou fica_fica no mês anterior (regra M+1 de
 * AdminClassDetail/ClassRosterList, reaproveitada em kidsHighlights.ts).
 *
 * Como class_medals é admin-only, os dados vêm da rota pública
 * GET /backend/v1/medals-highlights (hook medals_highlights.js). Sem destaques
 * (ou qualquer falha) a seção não renderiza nada — a home nunca quebra, mesma
 * postura da seção do Instagram.
 */
export default function KidsHighlightsSection() {
  const [highlights, setHighlights] = useState<KidsHighlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    const load = async () => {
      try {
        const data = await fetchKidsHighlights()
        if (vivo) setHighlights(data)
      } catch (err) {
        console.error('Erro ao carregar destaques do mês:', err)
        if (vivo) setHighlights([]) // falha → seção some, home segue de pé
      } finally {
        if (vivo) setLoading(false)
      }
    }
    load()
    return () => {
      vivo = false
    }
  }, [])

  // Realtime: medalha atribuída/removida no painel reflete na home na hora.
  useRealtime('class_medals', () => {
    fetchKidsHighlights()
      .then((data) => setHighlights(data))
      .catch(() => {})
  })

  const mesRef = brasiliaMonthKeyLocal()
  const mesPorExtenso = new Date(`${mesRef}-15T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  // Tratamento gracioso: sem destaques (ainda carregando ou lista vazia) → nada.
  if (loading || highlights.length === 0) return null

  return (
    <section className="relative bg-[#FAF6F0] border-y border-[#E8E0D5] py-14 overflow-hidden">
      {/* Sol vermelho ao fundo, discreto — mesmo padrão da seção do Instagram */}
      <HeroSun className="absolute -right-24 -top-28 w-72 h-72 opacity-5 sm:opacity-15 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho no padrão das outras seções: etiqueta, título, pincel */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A31B21] uppercase tracking-widest font-serif">
            <Star className="w-3.5 h-3.5" />
            Fica fica
          </span>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
            Alunos <span className="text-[#A31B21]">destaque do mês</span>
          </h2>
          <p className="text-sm text-[#4A443F] mt-2 capitalize">
            Destaques de {mesPorExtenso} — quem brilhou nas turmas infantis do Judô Tatsu.
          </p>
          <BrushDivider className="w-40 mx-auto mt-4 text-[#C1272D]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights.map((h) => (
            <div
              key={h.studentId}
              className="relative bg-white rounded-2xl border border-[#E8E0D5] shadow-xs hover:shadow-md transition-all duration-200 p-6 flex flex-col items-center text-center overflow-hidden"
            >
              {/* Etiqueta do mês com clip-path de pincel, cor da academia */}
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-[#C1272D] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 [clip-path:polygon(3%_20%,97%_10%,100%_55%,97%_90%,3%_96%,0_50%)]">
                <Star className="w-3 h-3" />
                Destaque
              </span>

              {/* Foto do aluno: avatar gravado ou iniciais sobre washi */}
              {h.avatarUrl ? (
                <img
                  src={h.avatarUrl}
                  alt={h.studentName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#F7E4E2] shadow-sm"
                  loading="lazy"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#FAF6F0] border-4 border-[#F7E4E2] shadow-sm flex items-center justify-center font-serif font-black text-2xl text-[#C1272D]">
                  {(h.studentName || '?')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()}
                </div>
              )}

              <h3 className="font-serif font-bold text-lg text-[#1C1B1A] mt-4">{h.studentName}</h3>
              <p className="text-xs font-semibold text-[#6B6560] mt-1">{h.className}</p>
              <p className="text-[11px] text-[#A31B21] font-bold uppercase tracking-wider mt-3">
                ⭐ Medalha fica fica
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
