/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '../types'
import { api, ApiError } from './api'
import { clearToken, getToken } from './token'

interface SessionValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      setUser(await api.me())
    } catch (error) {
      // Só 401 derruba a sessão: se a API está hibernando (cold start do Render)
      // o token continua válido e o próximo carregamento restaura o login.
      if (error instanceof ApiError && error.status === 401) clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // token expirado/revogado: a API avisa e a UI volta para o estado deslogado
  useEffect(() => {
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('ygo:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('ygo:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password)
    setUser(response.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const response = await api.register(email, password)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    api.logout()
    setUser(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ user, loading, login, register, logout, setUser, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession precisa estar dentro de <SessionProvider>')
  return context
}
