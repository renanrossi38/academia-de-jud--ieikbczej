import { MessageCircle, Phone } from 'lucide-react'
import { digitosTelefoneValido, telUrlResponsavel, waMeUrlResponsavel } from '@/services/whatsapp'

/**
 * Botões compactos "Ligar" e "WhatsApp" para o telefone do responsável,
 * exibidos apenas quando o número é válido (10 ou 11 dígitos com DDD).
 * Sem telefone válido o componente não renderiza NADA — nada muda para os
 * demais alunos.
 */
export const GuardianContactButtons: React.FC<{
  phone?: string
  className?: string
}> = ({ phone, className }) => {
  const digitos = digitosTelefoneValido(phone || '')
  if (!digitos) return null

  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      <a
        href={telUrlResponsavel(digitos)}
        title="Ligar para o responsável"
        aria-label="Ligar para o responsável"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#C1272D]/25 text-[#C1272D] transition-colors hover:bg-[#C1272D] hover:text-white"
      >
        <Phone className="w-3 h-3" />
      </a>
      <a
        href={waMeUrlResponsavel(digitos)}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp do responsável"
        aria-label="Abrir WhatsApp do responsável"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#128C4B]/25 text-[#128C4B] transition-colors hover:bg-[#128C4B] hover:text-white"
      >
        <MessageCircle className="w-3 h-3" />
      </a>
    </span>
  )
}
