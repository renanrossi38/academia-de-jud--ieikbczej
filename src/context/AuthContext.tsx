import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  /** Verdadeiro só para o administrador PRINCIPAL (dono) — gerencia admins. */
  isOwner: boolean
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
    } catch (_) {
      setUser((pb.authStore.record as unknown as User) || null)
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

  return (
    <AuthContext.Provider value={{ user, isAdmin, isOwner, isLoading, logout, refreshUser }}>
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
