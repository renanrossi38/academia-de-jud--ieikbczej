/**
 * PDF do relatório de presença — MESMA folha A4 dos relatórios de alunos e
 * financeiro (pdfReports.ts): logo, vermelho/preto, data de emissão em
 * Brasília e botão "Imprimir / Salvar PDF" do navegador. Nada é salvo no
 * servidor: só leitura dos números que a tela já calculou. O HTML do corpo é
 * gerado aqui e enviado ao openPrintWindow (mesma folha, mesmo CSS).
 */

import { openPrintWindow, emitDateTimeBrasilia } from '@/services/pdfReports'
import type { AttendanceReportData, AttendanceReportRow } from '@/services/attendanceReport'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

const BELT_LABELS: Record<string, string> = {
  branca: 'Branca',
  branca_ponta_cinza: 'Branca ponta cinza',
  cinza: 'Cinza',
  cinza_ponta_azul: 'Cinza ponta azul',
  azul: 'Azul',
  azul_ponta_amarela: 'Azul ponta amarela',
  amarela: 'Amarela',
  amarela_ponta_laranja: 'Amarela ponta laranja',
  laranja: 'Laranja',
  verde: 'Verde',
  roxa: 'Roxa',
  marrom: 'Marrom',
  preta: 'Preta',
}

const beltLabel = (belt?: string) => BELT_LABELS[belt || ''] || ''

function rowsTable(rows: AttendanceReportRow[]): string {
  if (rows.length === 0) {
    return `<table><tbody><tr><td class="dim">Nenhuma marcação de presença gravada para o período.</td></tr></tbody></table>`
  }
  return `
    <table>
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Turma(s)</th>
          <th class="num">Presenças</th>
          <th class="num">Ausências</th>
          <th class="num">Justificadas</th>
          <th class="num">Frequência</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td><strong>${esc(r.student.name || '—')}</strong>${
            beltLabel(r.student.belt)
              ? `<br /><span class="dim">${esc(beltLabel(r.student.belt))}</span>`
              : ''
          }</td>
          <td class="dim">${esc(r.turmas)}</td>
          <td class="num paid">${r.presente}</td>
          <td class="num due">${r.ausente}</td>
          <td class="num dim">${r.justificado}</td>
          <td class="num"><strong>${fmtPct(r.taxaPresenca)}</strong></td>
        </tr>`,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="6">${rows.length} ${rows.length === 1 ? 'aluno' : 'alunos'} com marcação no período</td></tr>
      </tfoot>
    </table>`
}

function semRegistroTable(sem: AttendanceReportData['semRegistro']): string {
  if (sem.length === 0) return ''
  return `
    <h2 style="font-family:Georgia,serif;font-size:15px;margin:20px 0 8px">Alunos ativos sem registro no período</h2>
    <table>
      <thead>
        <tr><th>Aluno</th><th>Turma(s)</th></tr>
      </thead>
      <tbody>
        ${sem
          .map(
            (s) => `<tr>
          <td><strong>${esc(s.student.name || '—')}</strong></td>
          <td class="dim">${esc(s.turmas)}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="2">${sem.length} ${sem.length === 1 ? 'aluno' : 'alunos'} sem nenhuma marcação de presença</td></tr>
      </tfoot>
    </table>`
}

/** Abre a folha A4 do relatório de presença com os números da tela. */
export function openAttendanceReport(input: {
  periodLabel: string
  classLabel: string
  data: AttendanceReportData
}): void {
  const { periodLabel, classLabel, data } = input
  const totalPresentes = data.rows.reduce((a, r) => a + r.presente, 0)
  const totalAusentes = data.rows.reduce((a, r) => a + r.ausente, 0)
  const totalJustificadas = data.rows.reduce((a, r) => a + r.justificado, 0)
  const totalMarcacoes = totalPresentes + totalAusentes + totalJustificadas
  const taxaGeral = totalMarcacoes > 0 ? (totalPresentes / totalMarcacoes) * 100 : 0

  const body = `
    ${rowsTable(data.rows)}
    ${semRegistroTable(data.semRegistro)}
    <div class="totals">
      <div class="row"><span class="k">Dias com aula registrada</span><span class="v">${fmtN(data.diasComAula)}</span></div>
      <div class="row even"><span class="k">Média de presenças por dia de aula</span><span class="v">${fmtN(data.mediaPresencaPorAula)}</span></div>
      <div class="row"><span class="k">Total de presenças</span><span class="v paid">${totalPresentes}</span></div>
      <div class="row even"><span class="k">Total de ausências</span><span class="v due">${totalAusentes}</span></div>
      <div class="row"><span class="k">Faltas justificadas</span><span class="v">${totalJustificadas}</span></div>
      <div class="row even"><span class="k">Frequência geral (todas as marcações)</span><span class="v ${taxaGeral >= 75 ? 'paid' : 'due'}">${fmtPct(taxaGeral)}</span></div>
    </div>`

  openPrintWindow({
    title: 'Relatório de presença — Judô Tatsu',
    docLabel: 'Relatório de presença',
    heading: 'Presença por aluno',
    subheading: `${periodLabel} · ${classLabel}`,
    meta: [
      `Emitido em ${emitDateTimeBrasilia()}`,
      `Dias com aula: ${fmtN(data.diasComAula)}`,
      `Média por aula: ${fmtN(data.mediaPresencaPorAula)}`,
      `Frequência geral: ${fmtPct(taxaGeral)}`,
    ],
    bodyHtml: body,
  })
}
