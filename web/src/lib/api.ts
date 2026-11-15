import type {
  AuthResponse,
  CardDraft,
  CardListResponse,
  CardRecord,
  UploadResponse,
  User,
} from '../types'
import { clearToken, getToken, setToken } from './token'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const isFormData = init.body instanceof FormData
  if (!isFormData && init.body !== undefined) headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Não foi possível falar com a API. Ela está rodando?', 0, 'network_error')
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('ygo:unauthorized'))
    }
    const data = (payload ?? {}) as { detail?: unknown; code?: string; errors?: unknown }
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.errors) && data.errors.length > 0
          ? String((data.errors[0] as { msg?: string }).msg ?? 'Dados inválidos')
          : 'Falha na requisição'
    throw new ApiError(detail, response.status, data.code, data.errors)
  }

  return payload as T
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  register: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((response) => {
      setToken(response.access_token)
      return response
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((response) => {
      setToken(response.access_token)
      return response
    }),

  me: () => request<User>('/api/auth/me'),

  logout: () => clearToken(),

  listPublic: (limit = 8) => request<CardListResponse>(`/api/cards?limit=${limit}`),

  listMine: () => request<CardListResponse>('/api/cards/mine?limit=100'),

  get: (id: string) => request<CardRecord>(`/api/cards/${encodeURIComponent(id)}`),

  getBySlug: (slug: string) => request<CardRecord>(`/api/cards/slug/${encodeURIComponent(slug)}`),

  create: (draft: CardDraft) =>
    request<CardRecord>('/api/cards', { method: 'POST', body: JSON.stringify(draft) }),

  update: (id: string, draft: CardDraft) =>
    request<CardRecord>(`/api/cards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    }),

  remove: (id: string) =>
    request<void>(`/api/cards/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<UploadResponse>('/api/uploads', { method: 'POST', body: form })
  },
}

/** URL pública (renderizada no servidor) usada no compartilhamento. */
export function shareUrl(slug: string): string {
  return `${window.location.origin}/c/${slug}`
}
