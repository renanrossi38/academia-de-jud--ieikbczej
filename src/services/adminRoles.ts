import pb from '@/lib/pocketbase/client'
import { AdminArea } from '@/lib/adminAreas'

/**
 * Gestão de administradores — apenas o admin PRINCIPAL (is_owner) tem acesso.
 *
 * As rotas do backend (pb_hook admin_roles.js) barram qualquer chamada de
 * admin secundário com 403, então o front também esconde a página e o item
 * de menu. O cargo concedido mantém role = 'admin' (mesmo valor do dono) e
 * is_owner = false: quem separa principal de secundário é o is_owner, pois as
 * regras de API das coleções liberam o painel por role = 'admin'. O admin
 * principal nunca é alterado.
 *
 * Permissões por área: admin_permissions em users (select múltiplo). Lista
 * vazia = acesso total (compatibilidade); lista preenchida = só as áreas
 * marcadas. O dono ignora o campo.
 */

export interface AdminRoleRecord {
  id: string
  name: string
  email: string
  role: 'admin' | 'aluno' | string
  is_owner: boolean
  /** Áreas liberadas do painel; vazio = acesso total. */
  admin_permissions?: AdminArea[]
  created?: string
}

export interface AdminListResponse {
  admins: AdminRoleRecord[]
  total: number
}

/** Lista todos os administradores (principal + secundários). */
export async function listAdmins(): Promise<AdminListResponse> {
  return pb.send<AdminListResponse>('/backend/v1/admins', {})
}

/** Concede o cargo de administrador (secundário) a um usuário existente. */
export async function grantAdmin(userId: string, areas?: AdminArea[]): Promise<AdminRoleRecord> {
  return pb
    .send<{ admin: AdminRoleRecord }>('/backend/v1/admins', {
      method: 'POST',
      body: { user_id: userId, areas: areas ?? [] },
    })
    .then((res) => res.admin)
}

/** Revoga o cargo de administrador (o usuário volta a ser aluno). */
export async function revokeAdmin(userId: string): Promise<AdminRoleRecord> {
  return pb
    .send<{ admin: AdminRoleRecord }>('/backend/v1/admins/revoke', {
      method: 'POST',
      body: { user_id: userId },
    })
    .then((res) => res.admin)
}

/** Grava as áreas liberadas de um admin secundário (lista vazia = todas). */
export async function setPermissions(userId: string, areas: AdminArea[]): Promise<AdminRoleRecord> {
  return pb
    .send<{ admin: AdminRoleRecord }>('/backend/v1/admins/permissions', {
      method: 'POST',
      body: { user_id: userId, areas },
    })
    .then((res) => res.admin)
}

/** Rótulo legível do cargo (o principal é distinguído pelo is_owner). */
export function roleLabel(role: string, isOwner: boolean): string {
  if (isOwner) return 'Administrador principal'
  if (role === 'admin') return 'Administrador (secundário)'
  return 'Aluno'
}
