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

/**
 * A API roda no plano free do Render e hiberna após ~15 min ociosos: a primeira
 * requisição depois disso espera o cold start (30–50 s). Por isso o timeout é
 * generoso e requisições idempotentes ganham uma segunda chance.
 */
const REQUEST_TIMEOUT_MS = 75_000
const RETRY_DELAY_MS = 2_500
const RETRYABLE_STATUS = new Set([502, 503, 504])

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

  /** Falha de transporte (API dormindo, offline, timeout): não invalida a sessão. */
}

/** Traduz os erros de validação do FastAPI numa frase útil. */
function humanizeErrors(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null
  const first = errors[0] as { type?: string; loc?: unknown[]; msg?: string }
  const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1]) : ''
  if (first.type === 'string_too_short' && field === 'password') {
    return 'A senha precisa ter pelo menos 8 caracteres.'
  }
  if (first.type === 'value_error' && field === 'email') return 'Informe um e-mail válido.'
  if (first.type === 'missing') return `Preencha o campo ${field || 'obrigatório'}.`
  return first.msg ?? null
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const isFormData = init.body instanceof FormData
  if (!isFormData && init.body !== undefined) headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const method = (init.method ?? 'GET').toUpperCase()
  const canRetry = method === 'GET' || method === 'HEAD'
  const response = await fetchWithRetry(path, { ...init, headers }, canRetry)

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
      humanizeErrors(data.errors) ??
      (typeof data.detail === 'string'
        ? data.detail
        : `O servidor respondeu HTTP ${response.status} sem JSON. Confira se /api está apontando para a API.`)
    throw new ApiError(detail, response.status, data.code, data.errors)
  }

  return payload as T
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** fetch com timeout próprio: o cold start do Render pode passar de 40 s. */
async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Requisições idempotentes ganham uma segunda tentativa: 502/503/504 e quedas
 * de conexão são o sintoma clássico da instância do Render acordando.
 */
async function fetchWithRetry(
  path: string,
  init: RequestInit,
  canRetry: boolean,
): Promise<Response> {
  const attempts = canRetry ? 2 : 1
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS)
    try {
      const response = await fetchWithTimeout(path, init)
      if (attempt === attempts - 1 || !RETRYABLE_STATUS.has(response.status)) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }

  throw transportError(lastError)
}

/** Erro de transporte (API dormindo, offline, timeout): não invalida a sessão. */
function transportError(error: unknown): ApiError {
  const timedOut = error instanceof DOMException && error.name === 'AbortError'
  const message = timedOut
    ? 'A API demorou demais para responder. No plano free ela hiberna e pode levar até ~1 minuto para acordar — tente de novo.'
    : 'Não foi possível falar com a API. Ela pode estar acordando (cold start ~40 s) — tente de novo em instantes.'
  return new ApiError(message, 0, timedOut ? 'timeout' : 'network_error')
}

let warmupPromise: Promise<boolean> | null = null

/**
 * Acorda a API sem bloquear a UI. Chamado no boot do app para que o cold start
 * aconteça enquanto a pessoa lê a tela, e não no clique de "salvar carta".
 * Usa /health/live: é barato e não consulta o Supabase.
 */
export function warmupApi(): Promise<boolean> {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      try {
        const response = await fetch(`${BASE}/health/live`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: 'no-store',
        })
        return response.ok
      } catch {
        return false
      }
    })()
    // falha não fica memorizada para sempre: a próxima chamada tenta de novo
    void warmupPromise.then((ok) => {
      if (!ok) warmupPromise = null
    })
  }
  return warmupPromise
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  warmup: warmupApi,

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
