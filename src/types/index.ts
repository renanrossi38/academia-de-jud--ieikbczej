export type UserRole = 'admin' | 'aluno'

export type Belt =
  | 'branca'
  | 'branca_ponta_cinza'
  | 'cinza'
  | 'cinza_ponta_azul'
  | 'azul'
  | 'azul_ponta_amarela'
  | 'amarela'
  | 'amarela_ponta_laranja'
  | 'laranja'
  | 'verde'
  | 'roxa'
  | 'marrom'
  | 'preta'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  /** Verdadeiro só para o administrador PRINCIPAL (o dono da academia). */
  is_owner?: boolean
  /**
   * Áreas do painel liberadas para um administrador SECUNDÁRIO
   * (select múltiplo; vazio/ausente = acesso total — ver lib/adminAreas.ts).
   */
  admin_permissions?: string[]
  phone?: string
  belt?: Belt
  active?: boolean
  verified?: boolean
  created: string
  updated: string
}

/** Aluno da academia (controle interno). E-mail e conta de acesso são opcionais. */
export interface Student {
  collectionId: string
  collectionName: string
  id: string
  name: string
  phone?: string
  belt?: Belt | ''
  email?: string
  address?: string
  birth_date?: string
  /** Responsável (aluno menor de idade) — só contato, sem conta própria no app. */
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
  /** Foto do aluno (file único, migration 0039) — usada nos destaques. */
  photo?: string
  active: boolean
  /** Conta de acesso ao site (users), quando já criada. */
  user?: string
  created: string
  updated: string
  /**
   * Expansão da conta de acesso (students?expand=user) — o painel usa
   * role/is_owner para exibir o selo de cargo de administrador ao lado do nome.
   */
  expand?: {
    user?: Pick<User, 'id' | 'role' | 'is_owner'>
  }
}

export type ProductCategory = 'uniformes' | 'faixas' | 'camisetas' | 'equipamentos' | 'planos'

/**
 * Opção de um campo personalizado "escolha". O formato legado (string simples)
 * continua suportado — veja customOptionLabel/customOptionDelta em customOptions.ts.
 */
export interface CustomFieldOption {
  /** Rótulo da opção (ex.: "Branco", "Trançado pesado"). */
  label: string
  /** Acréscimo de preço em R$ para esta opção (0 ou ausente = sem ajuste). */
  price_delta?: number
}

/**
 * Campo personalizado de um produto "sob medida" (ex.: kimono feito sob medida).
 * Configurado pelo admin no produto; o comprador preenche na página do produto.
 */
export interface CustomField {
  /** Rótulo exibido ao comprador (ex.: "Peso", "Estatura", "Cor", "Modelo"). */
  name: string
  /** "texto" → input livre; "numero" → input numérico; "escolha" → select com options. */
  type: 'texto' | 'numero' | 'escolha'
  /**
   * Opções permitidas quando type = "escolha" (ex.: ["Branco", "Azul"]).
   * Aceita string legada ou { label, price_delta? } — ver customOptions.ts.
   */
  options?: (string | CustomFieldOption)[]
  /** Quando true, o comprador precisa preencher antes de adicionar ao carrinho. */
  required?: boolean
}

export interface Product {
  collectionId: string
  collectionName: string
  id: string
  name: string
  slug: string
  description: string
  price: number
  image?: string
  /** Galeria de fotos (file múltiplo, migration 0028). 1ª posição = imagem principal. */
  gallery?: string[]
  category: ProductCategory
  active: boolean
  /** Campos personalizados (sob medida). Produto "sob medida" = lista não vazia. */
  custom_options?: CustomField[] | null
  created: string
  updated: string
}

export interface ProductVariation {
  id: string
  product: string
  label: string
  price_delta: number
  stock: number
  created: string
  updated: string
}

export type OrderStatus =
  | 'novo'
  | 'confirmado'
  | 'em_preparacao'
  | 'pronto'
  | 'entregue'
  | 'cancelado'
export type DeliveryType = 'retirada' | 'entrega'

export interface Order {
  id: string
  collectionId: string
  collectionName: string
  /** Conta do comprador — opcional: pode ter sido excluída (aluno removido). */
  user: string
  status: OrderStatus
  total: number
  customer_name: string
  phone: string
  delivery_type: DeliveryType
  address?: string
  notes?: string
  created: string
  updated: string
  /** Expansão da conta do comprador (orders?expand=user) — ausente quando removida. */
  expand?: {
    user?: Pick<User, 'id' | 'name' | 'email'>
  }
}

/** Etapa de rastreio personalizada criada pelo admin (order_tracking, migration 0034). */
export interface OrderTrackingStep {
  id: string
  collectionId: string
  collectionName: string
  order: string
  /** Texto livre da etapa (ex.: "Encomendado na fábrica", "Em produção"). */
  label: string
  /** Quem registrou (preenchido pelo hook via e.auth — pode não existir mais). */
  user: string
  created: string
  updated: string
  expand?: {
    user?: Pick<User, 'id' | 'name'>
  }
}

/** Etapa do pedido gravada pelo hook server-side (order_status_log). */
export interface OrderStatusLog {
  id: string
  collectionId: string
  collectionName: string
  order: string
  /** Executor da mudança (pode não existir mais — admin removido). */
  user: string
  from_status: OrderStatus | ''
  to_status: OrderStatus
  created: string
  updated: string
  expand?: {
    user?: Pick<User, 'id' | 'name'>
  }
}

export interface OrderItem {
  id: string
  order: string
  product: string
  variation?: string
  product_name: string
  variation_label?: string
  unit_price: number
  quantity: number
  subtotal: number
  /** Respostas do comprador nos campos personalizados (produto sob medida). */
  custom_answers?: Record<string, string> | null
  created: string
  updated: string
}

export interface CartItem {
  productId: string
  productName: string
  productSlug: string
  productImage?: string
  category: ProductCategory
  variationId?: string
  variationLabel?: string
  unitPrice: number
  quantity: number
  /** Respostas dos campos personalizados (produto sob medida). */
  customAnswers?: Record<string, string>
}

export type AttendanceStatus = 'presente' | 'ausente' | 'justificado'

/** Nível de uma turma. */
export type ClassLevel = 'iniciante' | 'intermediario' | 'avancado'

/** Turma de treino (ex.: "Infantil — Ter/Qui"). */
export interface Class {
  collectionId: string
  collectionName: string
  id: string
  name: string
  level?: ClassLevel | ''
  active: boolean
  /** Horário das aulas, ex.: "Ter/Qui — 19h às 20h30". */
  schedule?: string
  /** Mensalidade da turma em R$. */
  monthly_fee?: number
  /** Número de vagas da turma (limite de matrículas). */
  vagas: number
  /** Imagem de capa da turma (file único, migration 0028). */
  cover?: string
  /** Turma infantil (habilita medalhas dorme dorme / fica fica, migration 0035). */
  is_kids?: boolean
  created: string
  updated: string
}

/** Matrícula de um aluno em uma turma (junção class ↔ student). */
export interface ClassStudent {
  collectionId: string
  collectionName: string
  id: string
  class: string
  student: string
  created: string
  updated: string
  expand?: {
    student?: Student
    class?: Class
  }
}

export interface Attendance {
  collectionId: string
  collectionName: string
  id: string
  student: string
  date: string
  status: AttendanceStatus
  notes?: string
  created: string
  updated: string
  expand?: {
    student?: Student
  }
}

/** Linha do snapshot arquivado de um ranking de um ano encerrado. */
export interface RankingArchiveRow {
  collectionId: string
  collectionName: string
  id: string
  year: number
  rank: number
  student_name: string
  student_id?: string
  belt?: Belt | ''
  total_points: number
  presences: number
  manual_points: number
  created: string
  updated: string
}

/** Status de uma mensalidade lançada (primeira versão: sem pagamento online). */
export type MonthlyFeeStatus = 'pago' | 'pendente'

/** Mensalidade lançada para um aluno em um mês de referência ("YYYY-MM"). */
export interface MonthlyFee {
  collectionId: string
  collectionName: string
  id: string
  student: string
  /** Mês de referência no formato "YYYY-MM". */
  reference_month: string
  /** Valor em R$. */
  amount: number
  status: MonthlyFeeStatus
  /** Método de pagamento registrado pelo admin (opcional). */
  payment_method?: PaymentMethod
  /** Vencimento (padrão do app: dia 15 do mês seguinte ao mês de referência). */
  due_date?: string
  /** Quando foi marcado como pago (presente só quando status = "pago"). */
  paid_at?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    student?: Student
  }
}

/** Método de pagamento registrado em uma mensalidade (opcional). */
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao'

export type ExpenseCategory =
  | 'aluguel'
  | 'energia'
  | 'agua'
  | 'internet'
  | 'insumos'
  | 'equipamento'
  | 'salarios'
  | 'impostos'
  | 'outro'

/** Despesa da academia lançada pelo admin (painel financeiro). */
export interface Expense {
  collectionId: string
  collectionName: string
  id: string
  description: string
  /** Valor em R$ (sempre positivo — a direção do lançamento é o próprio tipo). */
  amount: number
  /** Data da despesa ("YYYY-MM-DD" — define o mês do gráfico, pode ser retroativa). */
  date: string
  category?: ExpenseCategory | ''
  notes?: string
  created: string
  updated: string
}

/** Promoção de faixa registrada (histórico de graduação do aluno, migration 0023). */
export interface BeltPromotion {
  collectionId: string
  collectionName: string
  id: string
  student: string
  belt: Belt
  /** Data da promoção (exame) — meio-dia UTC para não deslocar em Brasília. */
  promoted_at: string
  notes?: string
  /** Nota do exame (0–10, opcional — migration 0035). */
  exam_score?: number | null
  created: string
  updated: string
  expand?: {
    student?: Student
  }
}

/** Medalha mensal de turma infantil (class_medals, migration 0035). */
export type MedalKind = 'dorme_dorme' | 'fica_fica'

export interface ClassMedal {
  collectionId: string
  collectionName: string
  id: string
  class: string
  student: string
  /** Mês de referência no formato "YYYY-MM". */
  month: string
  kind: MedalKind
  /** Dia em que a medalha foi recebida ("YYYY-MM-DD", Brasília) — migration 0036. */
  received_at?: string
  created: string
  updated: string
  expand?: {
    student?: Student
  }
}

/** Lançamento manual de pontos do ranking (competição/evento). */
export interface PointEntry {
  /** Ano a que o lançamento pertence (pela data da competição/evento). */
  year?: number
  collectionId: string
  collectionName: string
  id: string
  student: string
  points: number
  description: string
  date?: string
  created: string
  updated: string
  expand?: {
    student?: Student
  }
}
