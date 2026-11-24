import { useEffect, useState } from 'react'
import { fetchHighlights, HighlightsPayload, iniciaisDoNome } from '@/services/highlights'
import { useRealtime } from '@/hooks/use-realtime'
import { BrushDivider } from '@/components/hero/HeroDecor'
import { Award, GraduationCap, Medal, Trophy } from 'lucide-react'

/**
 * Seção única "Destaques" da home (Judô Tatsu — vermelho/preto):
 *  - Destaque do mês: alunos com medalha fica fica vigente (foto, nome, turma).
 *  - Destaques de competição: criados no painel (foto, nome, título/motivo).
 * Some inteira quando nenhum dos grupos tem conteúdo.
 * Tempo real: useRealtime em students / class_medals / student_highlights.
 */
export const HighlightsSection = () => {
  const [data, setData] = useState<HighlightsPayload | null>(null)

  const load = () => {
    fetchHighlights().then(setData)
  }

  useEffect(() => {
    load()
  }, [])

  // Realtime: qualquer mudança em alunos, medalhas fica fica ou destaques de
  // competição recarrega a rota pública (fotos são arquivos, não coleções).
  useRealtime('students', load)
  useRealtime('class_medals', load)
  useRealtime('student_highlights', load)

  const hasMonth = !!data && data.month.length > 0
  const hasComp = !!data && data.competition.length > 0
  if (!hasMonth && !hasComp) return null

  return (
    <section id="destaques" className="py-14 sm:py-20 bg-[#FAF6F0]">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Cabeçalho no idioma da casa: etiqueta + divisor em pincelada */}
        <div className="flex flex-col items-center text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#C1272D] text-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest shadow-sm">
            <Medal className="w-3.5 h-3.5" />
            Destaques
          </span>
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1C1B1A] mt-4">
            Nossos talentos em cena
          </h2>
          <BrushDivider className="w-48 h-3 mt-3" />
          <p className="text-xs sm:text-sm text-[#6B6560] mt-3 max-w-xl leading-relaxed">
            Alunos que brilharam no tatame: o destaque do mês de cada turma infantil e as medalhas
            conquistadas nos campeonatos.
          </p>
        </div>

        {/* (a) Destaques do mês — fica fica vigente */}
        {hasMonth && (
          <div className="mb-12">
            <h3 className="flex items-center justify-center gap-2 font-serif font-bold text-lg sm:text-xl text-[#1C1B1A] mb-5">
              <Award className="w-5 h-5 text-[#C1272D]" />
              Destaques do mês
            </h3>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              {data!.month.map((m) => (
                <HighlightCard
                  key={'m-' + m.studentId + '-' + m.classId}
                  photoUrl={m.photoUrl}
                  name={m.studentName}
                  subtitle={m.className}
                  subtitleIcon={<GraduationCap className="w-3.5 h-3.5" />}
                  ringClass="ring-[#C1272D]"
                />
              ))}
            </div>
          </div>
        )}

        {/* (b) Destaques de competição — criados no painel */}
        {hasComp && (
          <div>
            <h3 className="flex items-center justify-center gap-2 font-serif font-bold text-lg sm:text-xl text-[#1C1B1A] mb-5">
              <Trophy className="w-5 h-5 text-[#C1272D]" />
              Destaques em competições
            </h3>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              {data!.competition.map((c) => (
                <HighlightCard
                  key={'c-' + c.id}
                  photoUrl={c.photoUrl}
                  name={c.studentName}
                  subtitle={c.reason}
                  subtitleIcon={<Trophy className="w-3.5 h-3.5" />}
                  ringClass="ring-[#1C1B1A]"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/** Card redondo com foto (ou iniciais vermelhas) + nome + legenda. */
const HighlightCard = ({
  photoUrl,
  name,
  subtitle,
  subtitleIcon,
  ringClass,
}: {
  photoUrl: string
  name: string
  subtitle: string
  subtitleIcon: React.ReactNode
  ringClass: string
}) => (
  <div className="flex flex-col items-center text-center w-36 sm:w-44">
    <div
      className={
        'w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-white shadow-md ring-2 ' + ringClass
      }
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={'Foto de ' + name}
          className="w-full h-full rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-[#F7E4E2] flex items-center justify-center">
          <span className="font-serif font-bold text-2xl sm:text-3xl text-[#C1272D]">
            {iniciaisDoNome(name)}
          </span>
        </div>
      )}
    </div>
    <p className="mt-3 font-serif font-bold text-sm sm:text-base text-[#1C1B1A] leading-tight">
      {name}
    </p>
    {subtitle && (
      <p className="mt-1 inline-flex items-center gap-1 text-[11px] sm:text-xs text-[#6B6560] leading-snug">
        {subtitleIcon}
        <span>{subtitle}</span>
      </p>
    )}
  </div>
)
