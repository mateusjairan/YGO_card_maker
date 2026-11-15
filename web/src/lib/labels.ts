import type { Attribute, CardDraft, MonsterKind, SpellKind, TrapKind } from '../types'

export interface Option<T extends string> {
  value: T
  label: string
  hint?: string
}

export const MONSTER_KINDS: Option<MonsterKind>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'effect', label: 'Efeito' },
  { value: 'ritual', label: 'Ritual' },
  { value: 'fusion', label: 'Fusão' },
  { value: 'synchro', label: 'Sincro' },
  { value: 'xyz', label: 'Xyz' },
  { value: 'link', label: 'Link' },
  { value: 'pendulum', label: 'Pêndulo' },
  { value: 'token', label: 'Ficha' },
]

export const SPELL_KINDS: Option<SpellKind>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'continuous', label: 'Contínua' },
  { value: 'equip', label: 'Equipamento' },
  { value: 'quick_play', label: 'Rápida' },
  { value: 'field', label: 'Campo' },
  { value: 'ritual', label: 'Ritual' },
]

export const TRAP_KINDS: Option<TrapKind>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'continuous', label: 'Contínua' },
  { value: 'counter', label: 'Contra' },
]

export const ATTRIBUTES: (Option<Attribute> & { color: string })[] = [
  { value: 'light', label: 'Luz', color: '#f3dd8d' },
  { value: 'dark', label: 'Trevas', color: '#8d78b5' },
  { value: 'earth', label: 'Terra', color: '#b98a55' },
  { value: 'water', label: 'Água', color: '#6fa8d8' },
  { value: 'fire', label: 'Fogo', color: '#d1654a' },
  { value: 'wind', label: 'Vento', color: '#74bb92' },
  { value: 'divine', label: 'Divino', color: '#f0cf70' },
]

export const MONSTER_KIND_LABEL: Record<MonsterKind, string> = {
  normal: 'Normal',
  effect: 'Efeito',
  ritual: 'Ritual',
  fusion: 'Fusão',
  synchro: 'Sincro',
  xyz: 'Xyz',
  link: 'Link',
  pendulum: 'Pêndulo',
  token: 'Ficha',
}

export const SPELL_KIND_LABEL: Record<SpellKind, string> = {
  normal: 'Normal',
  continuous: 'Contínua',
  equip: 'Equipamento',
  quick_play: 'Rápida',
  field: 'Campo',
  ritual: 'Ritual',
}

export const TRAP_KIND_LABEL: Record<TrapKind, string> = {
  normal: 'Normal',
  continuous: 'Contínua',
  counter: 'Contra',
}

export const RACES = [
  'Dragão',
  'Mago',
  'Guerreiro',
  'Fada',
  'Demônio',
  'Máquina',
  'Zumbi',
  'Aqua',
  'Piro',
  'Rocha',
  'Besta',
  'Besta-Guerreira',
  'Inseto',
  'Dinossauro',
  'Peixe',
  'Serpente Marinha',
  'Réptil',
  'Trovão',
  'Planta',
  'Psíquico',
  'Wyrm',
  'Ciberso',
  'Ilusão',
  'Divindade',
]

/** Linha de tipo no formato clássico: `DRAGÃO / EFEITO / "ARQUÉTIPO"`. */
export function typeLine(card: Pick<CardDraft, 'kind' | 'monster_kind' | 'spell_kind' | 'trap_kind' | 'race' | 'archetype'>): string {
  if (card.kind === 'monster') {
    const parts: string[] = []
    if (card.race) parts.push(card.race.toUpperCase())
    if (card.monster_kind) parts.push(MONSTER_KIND_LABEL[card.monster_kind].toUpperCase())
    if (card.archetype) parts.push(`"${card.archetype.toUpperCase()}"`)
    return parts.join(' / ') || 'MONSTRO'
  }
  if (card.kind === 'spell') {
    return card.spell_kind ? `MAGIA ${SPELL_KIND_LABEL[card.spell_kind].toUpperCase()}` : 'MAGIA'
  }
  return card.trap_kind ? `ARMADILHA ${TRAP_KIND_LABEL[card.trap_kind].toUpperCase()}` : 'ARMADILHA'
}

export function serialNumber(id: string | undefined): string {
  if (!id) return 'YGO-0000-0000'
  const raw = id.replace(/-/g, '').toUpperCase()
  return `YGO-${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

export function levelInfo(card: Pick<CardDraft, 'kind' | 'monster_kind' | 'level'>) {
  if (card.kind !== 'monster' || !card.level) {
    return { visible: false, rank: false, link: false, count: 0 }
  }
  if (card.monster_kind === 'link') {
    return { visible: true, rank: false, link: true, count: card.level }
  }
  return { visible: true, rank: card.monster_kind === 'xyz', link: false, count: card.level }
}

export function slugifyFilename(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'carta'
  )
}
