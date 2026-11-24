// Áreas do painel administrativo e verificação de permissão (Judô Tatsu).
//
// Hierarquia: dono (is_owner = true) vê SEMPRE tudo. O secundário (role
// 'admin', is_owner false) com admin_permissions VAZIA também vê tudo
// (compatibilidade com o comportamento anterior). Com a lista preenchida,
// só as áreas marcadas ficam visíveis — no menu, nas rotas e nas regras de
// API do PocketBase (migration 0031).

export type AdminArea =
  | 'alunos'
  | 'mensalidades'
  | 'presencas'
  | 'produtos'
  | 'pedidos'
  | 'financeiro'
  | 'site'

export const ADMIN_AREAS: AdminArea[] = [
  'alunos',
  'mensalidades',
  'presencas',
  'produtos',
  'pedidos',
  'financeiro',
  'site',
]

export const ADMIN_AREA_LABELS: Record<AdminArea, string> = {
  alunos: 'Alunos',
  mensalidades: 'Mensalidades',
  presencas: 'Presenças e Ranking',
  produtos: 'Loja (Produtos)',
  pedidos: 'Pedidos',
  financeiro: 'Financeiro',
  // A permissão "site" abre DUAS páginas separadas no menu, com propósito
  // claro: "Página inicial" (/painel/site, conteúdo da home) e
  // "Configurações" (/painel/configuracoes, mensagens de cobrança + Pix).
  site: 'Página inicial',
}

export const ADMIN_AREA_DESCRIPTIONS: Record<AdminArea, string> = {
  alunos: 'Ficha dos alunos, graduações e credenciais de acesso',
  mensalidades: 'Mensalidades, cobranças e avisos de atraso',
  presencas: 'Chamadas, turmas e ranking de pontos',
  produtos: 'Produtos, variações e estoque da loja',
  pedidos: 'Pedidos da loja e status de entrega',
  financeiro: 'Receitas, despesas e relatórios anuais',
  site: 'Conteúdo da página inicial e configurações de cobrança/Pix (duas páginas)',
}

// Valores aceitos pelo select do banco (admin_permissions em users) —
// ignorados: valores desconhecidos vindo do servidor.
const VALID = new Set<string>(ADMIN_AREAS)

/**
 * O admin pode acessar a área?
 * - dono: sempre sim
 * - permissões vazias/ausentes: sim (acesso total por padrão)
 * - lista preenchida: só se a área estiver nela
 */
export const hasArea = (
  isOwner: boolean,
  permissions: string[] | null | undefined,
  area: AdminArea,
): boolean => {
  if (isOwner) return true
  if (!permissions || permissions.length === 0) return true
  return permissions.includes(area)
}

/** Permissões vindas do servidor, filtradas para valores conhecidos. */
export const normalizePermissions = (raw: unknown): AdminArea[] => {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is AdminArea => typeof v === 'string' && VALID.has(v))
}

/** Rota inicial do painel: a primeira área liberada (para o link "Ir ao painel"). */
export const firstAllowedArea = (
  isOwner: boolean,
  permissions: string[] | null | undefined,
): AdminArea => ADMIN_AREAS.find((a) => hasArea(isOwner, permissions, a)) ?? 'alunos'
