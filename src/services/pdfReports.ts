/**
 * Geração de relatórios PDF no navegador, no MESMO padrão do comprovante de
 * mensalidade (FeeReceiptPage): uma folha A4 limpa, preto sobre branco, com o
 * cabeçalho da academia (logo + "Judô Tatsu" em vermelho/preto), data de
 * emissão e contagens — aberta em nova aba/janela com o botão
 * "Imprimir / Salvar PDF" (window.print; @media print esconde a barra de
 * ações). Nada é salvo no servidor: só leitura dos dados que a tela já tem.
 */

import { officialLogoUrl } from '@/components/HankoStamp'

/** Data e hora da emissão, em horário de Brasília (UTC-3 o ano todo). */
export function emitDateTimeBrasilia(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes(),
  ).padStart(2, '0')}`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Abre a janela de impressão com o HTML da folha (padrão do comprovante). */
function openPrintWindow(opts: {
  /** Nome sugerido do arquivo ao "Salvar como PDF". */
  title: string
  /** Rótulo pequeno no canto (ex.: "Relatório de alunos"). */
  docLabel: string
  /** Título central da folha. */
  heading: string
  /** Linha de contexto logo abaixo do título (filtros, período etc.). */
  subheading: string
  /** Meta em uma linha (data de emissão, filtros, totais). */
  meta: string[]
  bodyHtml: string
}) {
  const { title, docLabel, heading, subheading, meta, bodyHtml } = opts
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) {
    throw new Error(
      'O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.',
    )
  }
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px; background: #FAF6F0;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1C1B1A;
  }
  .report-actions { max-width: 820px; margin: 0 auto 14px; display: flex;
    justify-content: flex-end; }
  .report-actions button {
    background: #C1272D; color: #fff; border: none; border-radius: 10px;
    padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
    font-family: inherit;
  }
  .report-actions button:hover { background: #A01E23; }
  .sheet {
    max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #E8E0D5;
    border-radius: 14px; overflow: hidden; padding: 0;
  }
  .band { height: 8px; background: #C1272D; }
  .inner { padding: 28px 32px 24px; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
    gap: 16px; padding-bottom: 18px; border-bottom: 1px solid #E8E0D5; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 56px; height: 56px; object-fit: contain; }
  .brand-name { font-family: Georgia, 'Times New Roman', serif; font-weight: 700;
    font-size: 18px; line-height: 1.15; }
  .brand-sub { font-size: 11px; color: #6B6560; margin-top: 2px; }
  .doc-label { text-align: right; }
  .doc-label .tag { font-family: Georgia, serif; font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: #C1272D; }
  .doc-label .date { font-size: 11px; color: #6B6560; margin-top: 4px;
    font-variant-numeric: tabular-nums; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px;
    text-align: center; margin: 22px 0 6px; }
  .subheading { text-align: center; font-size: 12px; color: #6B6560; margin: 0 0 6px; }
  .meta { text-align: center; font-size: 11px; color: #6B6560; margin: 0 0 18px; }
  .meta span { margin: 0 8px; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead th {
    text-align: left; font-family: Georgia, serif; text-transform: uppercase;
    letter-spacing: 1px; font-size: 10px; color: #6B6560; background: #FAF6F0;
    border-bottom: 1px solid #E8E0D5; padding: 8px 10px;
  }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #F0EBE2;
    vertical-align: top; }
  tbody tr:nth-child(even) td { background: #FAF6F0/40; }
  tbody tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .paid { color: #2E7D4F; font-weight: 600; }
  .due { color: #C1272D; font-weight: 600; }
  .dim { color: #6B6560; }
  tfoot td { padding: 10px; border-top: 2px solid #E8E0D5; background: #FAF6F0;
    font-weight: 700; }
  .totals { margin-top: 18px; border: 1px solid #E8E0D5; border-radius: 12px;
    overflow: hidden; }
  .totals .row { display: flex; justify-content: space-between; gap: 16px;
    padding: 9px 14px; font-size: 12.5px; border-bottom: 1px solid #F0EBE2; }
  .totals .row:last-child { border-bottom: none; }
  .totals .row.even { background: #FAF6F0; }
  .totals .row .k { color: #6B6560; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; font-size: 10.5px; align-self: center; }
  .totals .row .v { font-weight: 700; font-variant-numeric: tabular-nums; }
  .totals .row.balance .v.pos { color: #2E7D4F; }
  .totals .row.balance .v.neg { color: #C1272D; }
  footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #E8E0D5;
    display: flex; justify-content: space-between; gap: 12px; font-size: 10px;
    color: #6B6560; }
  @media print {
    body { background: #fff !important; padding: 0 !important; }
    .report-actions { display: none !important; }
    .sheet { border: none !important; border-radius: 0 !important; max-width: none !important; }
    @page { size: A4; margin: 12mm; }
    thead { display: table-header-group; }
    tr, .totals, footer { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="report-actions">
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>
  <div class="sheet">
    <div class="band"></div>
    <div class="inner">
      <header>
        <div class="brand">
          <img src="${officialLogoUrl}" alt="Logo Judô Tatsu" />
          <div>
            <div class="brand-name" style="color:#1C1B1A">Judô <span style="color:#C1272D">Tatsu</span></div>
            <div class="brand-sub">Academia de Judô</div>
          </div>
        </div>
        <div class="doc-label">
          <div class="tag">${esc(docLabel)}</div>
          <div class="date">Emitido em ${esc(emitDateTimeBrasilia())}</div>
        </div>
      </header>
      <h1>${esc(heading)}</h1>
      <p class="subheading">${esc(subheading)}</p>
      <p class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</p>
      ${bodyHtml}
      <footer>
        <span>Documento gerado pelo painel da academia — apenas leitura, não altera dados.</span>
        <span>Judô Tatsu · Academia de Judô</span>
      </footer>
    </div>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.focus() }, 50) }</script>
</body>
</html>`)
  win.document.close()
}

/* ------------------------------------------------------------------ */
/* Relatório de alunos                                                 */
/* ------------------------------------------------------------------ */

export interface StudentReportRow {
  name: string
  belt: string
  classes: string
  active: boolean
  feeStatus: string
  phone: string
  guardian: string
  email: string
}

/** Relatório da listagem de alunos — recebe as linhas JÁ FILTRADAS da tela. */
export function openStudentsReport(opts: {
  rows: StudentReportRow[]
  /** Descrição dos filtros aplicados (ex.: busca ativa). */
  filterNote: string
  totals: { active: number; inactive: number; emDia: number; atrasados: number }
}) {
  const { rows, filterNote, totals } = opts
  const body = `
    <table>
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Faixa</th>
          <th>Turma(s)</th>
          <th>Status</th>
          <th>Mensalidade</th>
          <th>Contato</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length === 0
            ? `<tr><td colspan="6" class="dim">Nenhum aluno para exibir com os filtros atuais.</td></tr>`
            : rows
                .map(
                  (r) => `<tr>
            <td><strong>${esc(r.name)}</strong>${r.email ? `<br /><span class="dim">${esc(r.email)}</span>` : ''}</td>
            <td>${esc(r.belt)}</td>
            <td class="dim">${esc(r.classes)}</td>
            <td class="${r.active ? 'paid' : 'due'}">${r.active ? 'Ativo' : 'Inativo'}</td>
            <td class="${r.feeStatus === 'Inadimplente' ? 'due' : r.feeStatus === 'Em dia' ? 'paid' : 'dim'}">${esc(r.feeStatus)}</td>
            <td class="dim">
              ${r.phone ? esc(r.phone) : ''}
              ${r.guardian ? `${r.phone ? '<br />' : ''}Resp.: ${esc(r.guardian)}` : ''}
              ${!r.phone && !r.guardian ? '—' : ''}
            </td>
          </tr>`,
                )
                .join('')
        }
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6">Total de alunos nesta listagem: ${rows.length}</td>
        </tr>
      </tfoot>
    </table>
    <div class="totals">
      <div class="row"><span class="k">Ativos</span><span class="v">${totals.active}</span></div>
      <div class="row even"><span class="k">Inativos</span><span class="v">${totals.inactive}</span></div>
      <div class="row"><span class="k">Em dia (mensalidade)</span><span class="v paid">${totals.emDia}</span></div>
      <div class="row even"><span class="k">Inadimplentes</span><span class="v due">${totals.atrasados}</span></div>
    </div>`

  openPrintWindow({
    title: 'Relatório de alunos — Judô Tatsu',
    docLabel: 'Relatório de alunos',
    heading: 'Listagem de alunos',
    subheading: filterNote || 'Listagem completa do cadastro da academia',
    meta: [
      `Total: ${rows.length} ${rows.length === 1 ? 'aluno' : 'alunos'}`,
      `Ativos: ${totals.active}`,
      `Inadimplentes: ${totals.atrasados}`,
    ],
    bodyHtml: body,
  })
}

/* ------------------------------------------------------------------ */
/* Relatório financeiro                                                */
/* ------------------------------------------------------------------ */

export interface FinanceFeeRow {
  student: string
  referenceMonth: string
  amount: number
  status: string
  method: string
}

export interface FinanceExpenseRow {
  description: string
  date: string
  category: string
  amount: number
}

/** Relatório financeiro do mês em exibição (mensalidades, despesas e totais). */
export function openFinanceReport(opts: {
  monthLabel: string
  fees: FinanceFeeRow[]
  expenses: FinanceExpenseRow[]
  totals: {
    received: number
    pending: number
    overdue: number
    expenses: number
    products: number
    balance: number
  }
}) {
  const { monthLabel, fees, expenses, totals } = opts
  const statusCell = (s: string) => (s === 'Pago' ? 'paid' : s === 'Atrasado' ? 'due' : 'dim')

  const feesBody = `
    <h2 style="font-family:Georgia,serif;font-size:15px;margin:4px 0 8px">Mensalidades — ${esc(monthLabel)}</h2>
    <table>
      <thead>
        <tr><th>Aluno</th><th>Mês de referência</th><th class="num">Valor</th><th>Status</th><th>Forma de pagamento</th></tr>
      </thead>
      <tbody>
        ${
          fees.length === 0
            ? `<tr><td colspan="5" class="dim">Nenhuma mensalidade lançada para ${esc(monthLabel)}.</td></tr>`
            : fees
                .map(
                  (f) => `<tr>
            <td><strong>${esc(f.student)}</strong></td>
            <td class="dim">${esc(f.referenceMonth)}</td>
            <td class="num">${fmtBRL(f.amount)}</td>
            <td class="${statusCell(f.status)}">${esc(f.status)}</td>
            <td class="dim">${esc(f.method)}</td>
          </tr>`,
                )
                .join('')
        }
      </tbody>
      <tfoot>
        <tr><td colspan="5">${fees.length} ${fees.length === 1 ? 'lançamento' : 'lançamentos'}</td></tr>
      </tfoot>
    </table>`

  const expensesBody =
    expenses.length > 0
      ? `
    <h2 style="font-family:Georgia,serif;font-size:15px;margin:20px 0 8px">Despesas — ${esc(monthLabel)}</h2>
    <table>
      <thead>
        <tr><th>Descrição</th><th>Data</th><th>Categoria</th><th class="num">Valor</th></tr>
      </thead>
      <tbody>
        ${expenses
          .map(
            (e) => `<tr>
          <td><strong>${esc(e.description)}</strong></td>
          <td class="dim">${esc(e.date)}</td>
          <td class="dim">${esc(e.category || '—')}</td>
          <td class="num due">-${fmtBRL(e.amount)}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="3">Total de despesas</td><td class="num due">-${fmtBRL(totals.expenses)}</td></tr>
      </tfoot>
    </table>`
      : ''

  const body = `${feesBody}${expensesBody}
    <div class="totals">
      <div class="row"><span class="k">Recebido (mensalidades pagas)</span><span class="v paid">${fmtBRL(totals.received)}</span></div>
      <div class="row even"><span class="k">Pendente</span><span class="v">${fmtBRL(totals.pending)}</span></div>
      <div class="row"><span class="k">Em atraso</span><span class="v due">${fmtBRL(totals.overdue)}</span></div>
      <div class="row even"><span class="k">Ganho com produtos</span><span class="v">${fmtBRL(totals.products)}</span></div>
      <div class="row"><span class="k">Despesas</span><span class="v due">-${fmtBRL(totals.expenses)}</span></div>
      <div class="row even balance"><span class="k">Saldo do mês</span><span class="v ${totals.balance >= 0 ? 'pos' : 'neg'}">${fmtBRL(totals.balance)}</span></div>
    </div>`

  openPrintWindow({
    title: `Relatório financeiro ${monthLabel} — Judô Tatsu`,
    docLabel: 'Relatório financeiro',
    heading: `Financeiro — ${monthLabel}`,
    subheading: 'Mensalidades, despesas e totais do período em exibição no painel',
    meta: [
      'Período: ' + monthLabel,
      `Mensalidades recebidas: ${fmtBRL(totals.received)}`,
      `Saldo: ${fmtBRL(totals.balance)}`,
    ],
    bodyHtml: body,
  })
}
