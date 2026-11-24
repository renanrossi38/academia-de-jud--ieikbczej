import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/types'
import { AdminArea, hasArea } from '@/lib/adminAreas'

/**
 * A sessão pode "morrer" no servidor sem o front saber (backend recriado,
 * tokenKey girado, senhas/tokens revogados): o authStore local continua
 * "válido" mas o PocketBase responde cada request como anônimo — GET do
 * próprio usuário vira 404 e toda escrita falha em API rule (404/400
 * mascarados como "não encontrado"). Nesse estado o painel mostra um admin
 * fantasma: vê o menu, mas não salva nada nem carrega áreas.
 */
const isAuthError = (err: unknown): boolean => {
  const status = (err as { status?: number } | null)?.status
  return status === 401 || status === 403 || status === 404
}

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  /** Verdadeiro só para o administrador PRINCIPAL (dono) — gerencia admins. */
  isOwner: boolean
  /** Verdadeiro se o admin logado pode acessar a área do painel dada. */
  hasArea: (area: AdminArea) => boolean
  isLoading: boolean
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    return (pb.authStore.record as unknown as User) || null
  })
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.record) {
        const fresh = await pb.collection('users').getOne<User>(pb.authStore.record.id)
        setUser(fresh)
      } else {
        setUser(null)
      }
    } catch (err) {
      // Token morto/revogado no servidor (401/403/404 ao buscar o próprio
      // registro): a sessão local é FANTASMA — limpa o authStore de verdade
      // para o usuário relogar, em vez de manter um admin que não consegue
      // salvar nada (causa do "erro ao salvar" persistente em /painel/site).
      if (isAuthError(err)) {
        pb.authStore.clear()
        setUser(null)
      } else {
        // Erro de rede/outro: mantém o registro local (o app funciona offline).
        setUser((pb.authStore.record as unknown as User) || null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()

    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser((model as unknown as User) || null)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'
  const isOwner = isAdmin === true && user?.is_owner === true

  // hasArea é estável: só muda quando o usuário (ou as permissões dele) mudam.
  const hasAreaFn = useMemo(() => {
    const owner = isOwner
    const perms = user?.admin_permissions
    return (area: AdminArea) => hasArea(owner, perms, area)
  }, [user, isOwner])

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, isOwner, hasArea: hasAreaFn, isLoading, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
