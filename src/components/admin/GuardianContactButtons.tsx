import { MessageCircle, Phone } from 'lucide-react'
import { digitosTelefoneValido, telUrlResponsavel, waMeUrlResponsavel } from '@/services/whatsapp'

/**
 * Botões compactos "Ligar" e "WhatsApp" para contato sobre um aluno.
 *
 * Fallback de número:
 *  1. Telefone do responsável válido (10/11 dígitos com DDD; 12/13 só com 55)
 *     → liga e abre WhatsApp com o responsável (comportamento de sempre);
 *  2. Sem responsável com número válido → usa o TELEFONE PRÓPRIO do aluno
 *     (campo `phone` da ficha) pela MESMA regra — o botão de WhatsApp aparece
 *     para todo aluno com algum número válido, mesmo maior de idade sem
 *     responsável. O botão de ligar continua apontando para o número usado
 *     (responsável quando existe, senão o próprio);
 *  3. Nenhum número válido → não renderiza NADA — nada muda para os demais.
 */
export const GuardianContactButtons: React.FC<{
  phone?: string
  studentPhone?: string
  className?: string
}> = ({ phone, studentPhone, className }) => {
  const digitos = digitosTelefoneValido(phone || '') || digitosTelefoneValido(studentPhone || '')
  if (!digitos) return null

  const doResponsavel = !!digitosTelefoneValido(phone || '')
  const titulo = doResponsavel ? 'responsável' : 'aluno(a)'

  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      <a
        href={telUrlResponsavel(digitos)}
        title={`Ligar para o ${titulo}`}
        aria-label={`Ligar para o ${titulo}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#C1272D]/25 text-[#C1272D] transition-colors hover:bg-[#C1272D] hover:text-white"
      >
        <Phone className="w-3 h-3" />
      </a>
      <a
        href={waMeUrlResponsavel(digitos)}
        target="_blank"
        rel="noopener noreferrer"
        title={`WhatsApp do ${titulo}`}
        aria-label={`Abrir WhatsApp do ${titulo}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#128C4B]/25 text-[#128C4B] transition-colors hover:bg-[#128C4B] hover:text-white"
      >
        <MessageCircle className="w-3 h-3" />
      </a>
    </span>
  )
}
