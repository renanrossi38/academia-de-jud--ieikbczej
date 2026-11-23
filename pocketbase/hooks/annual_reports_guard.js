/**
 * annual_reports: um relatório arquivado só pode ser CRIADO (ou regravado
 * sobre o existente) para o ANO CORRENTE, em horário de Brasília (UTC-3).
 *
 * Por quê: arquivar ano retroativo permitiria "fechar" 2025 hoje com números
 * inventados — o snapshot parece legítimo porque leva created/updated atuais.
 * A camada de serviço do frontend recusa; este hook blinda também a API REST
 * (qualquer chamada direta de admin/superuser).
 *
 * Válidos:
 *  - criar o relatório do ano corrente (o caso normal do fechamento);
 *  - REgravar o relatório do ano corrente (substituição do fechamento).
 *
 * Recusado:
 *  - criar/atualizar apontando year != ano corrente (Brasília);
 *  - mudar o `year` de um relatório existente (renomear 2026 para 2025);
 *  - editar os valores de um relatório de ano fechado — snapshot é imutável.
 *
 * Nota: callbacks do JSVM não enxergam declarações de nível superior — o
 * cálculo do ano corrente está inline nos dois callbacks.
 */
onRecordCreateRequest((e) => {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const currentYear = now.getUTCFullYear()
  const year = e.record.getInt('year')
  if (year !== currentYear) {
    throw new BadRequestError(
      'Só é possível arquivar o relatório do ano corrente (' +
        currentYear +
        '); anos anteriores não podem ser gerados agora.',
    )
  }
  e.next()
}, 'annual_reports')

onRecordUpdateRequest((e) => {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const currentYear = now.getUTCFullYear()
  const year = e.record.getInt('year')
  const originalYear = e.record.original().getInt('year')
  if (year !== originalYear) {
    throw new BadRequestError('O ano do relatório arquivado não pode ser alterado após a criação.')
  }
  if (year !== currentYear) {
    throw new BadRequestError(
      'O relatório de ' +
        year +
        ' já está fechado — não pode mais ser alterado. Só o relatório do ano corrente (' +
        currentYear +
        ') pode ser arquivado ou regravado.',
    )
  }
  e.next()
}, 'annual_reports')
