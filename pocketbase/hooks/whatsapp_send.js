// WhatsApp de cobrança (Judô Tatsu) — helpers de mensagem, compartilhados pelo
// hook de avisos de atraso (pocketbase/hooks/fee_overdue_notice.js) e por
// qualquer outro caminho server-side.
//
// ⚠️ Restrição da JSVM: as callbacks não enxergam declarações de nível
// superior — este arquivo existe como referência/documentação do formato da
// mensagem; a rotina de envio precisa estar colada inline dentro de cada
// callback (como em fee_overdue_notice.js).
//
// Envio server-side:
//   $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
//     text: texto,
//     to_number: numero,
//     phone_number_id: $os.getenv('WHATSAPP_PHONE_NUMBER_ID'),
//   })
//   → { successful, data, error } — falha NUNCA crasha o chamador: logar e
//     seguir para o próximo aluno/canal.
//
// Normalização do número (mesma do frontend, src/services/whatsapp.ts):
//   só dígitos; sem DDI → prefixa 55; sem DDD (10–11 dígitos totais → 8–9
//   locais) → prefixa 21 (Rio) como fallback; resultado: 55 + 10–13 dígitos.

var DEFAULT_WHATSAPP_TEMPLATE =
  '{saudacao}, {aluno}!\n\n' +
  'Passando para lembrar que a mensalidade de {mes} da academia Judô Tatsu ' +
  'está pendente de pagamento. 🥋\n\n' +
  'Se você já pagou, desconsidere esta mensagem — pode ter sido só o ' +
  'lançamento que ainda não chegou ao sistema.\n\n' +
  'Qualquer dúvida, é só responder aqui.\n\n' +
  'Atenciosamente,\nEquipe Tatsu'
