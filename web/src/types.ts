export type CardKind = 'monster' | 'spell' | 'trap'

export type MonsterKind =
  | 'normal'
  | 'effect'
  | 'ritual'
  | 'fusion'
  | 'synchro'
  | 'xyz'
  | 'link'
  | 'pendulum'
  | 'token'

export type SpellKind = 'normal' | 'continuous' | 'equip' | 'quick_play' | 'field' | 'ritual'

export type TrapKind = 'normal' | 'continuous' | 'counter'

export type Attribute = 'light' | 'dark' | 'earth' | 'water' | 'fire' | 'wind' | 'divine'

export type Rarity =
  | 'common'
  | 'rare'
  | 'super'
  | 'ultra'
  | 'secret'
  | 'prismatic'
  | 'ultimate'
  | 'ghost'
  | 'starlight'

/** Campos editáveis de uma carta (contrato de POST/PATCH da API). */
export interface CardDraft {
  name: string
  kind: CardKind
  description: string
  monster_kind: MonsterKind | null
  spell_kind: SpellKind | null
  trap_kind: TrapKind | null
  attribute: Attribute | null
  race: string | null
  archetype: string | null
  level: number | null
  atk: number | null
  defense: number | null
  image_url: string | null
  image_path: string | null
  rarity: Rarity
  is_public: boolean
}

/** Carta persistida, como a API devolve. */
export interface CardRecord extends CardDraft {
  id: string
  slug: string
  views: number
  created_at: string
  updated_at: string
}

export interface CardListResponse {
  items: CardRecord[]
  limit: number
  offset: number
}

export interface UploadResponse {
  url: string
  path: string
  width: number
  height: number
  content_type: string
  uploads_used: number
  uploads_limit: number
}

export interface User {
  id: string
  email: string
  uploads_used: number
  uploads_limit: number
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  app: string
  env: string
  storage: string
  version: string
  checks: Record<string, boolean>
}
