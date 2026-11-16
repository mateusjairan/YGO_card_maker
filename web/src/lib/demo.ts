import type { CardDraft } from '../types'

/**
 * Arte do card de exemplo. O repositório traz uma ilustração original
 * (`/demo-mago-negro.png`); para usar outra imagem localmente sem versioná-la,
 * salve em `web/public/local-mago.png` e defina VITE_DEMO_ART=/local-mago.png
 * em `web/.env.local` (ignorado pelo git).
 */
const DEMO_ART = import.meta.env.VITE_DEMO_ART ?? '/demo-mago-negro.png'

/**
 * Crédito da arte de exemplo. Só aparece se VITE_DEMO_CREDIT estiver definido.
 * Use junto com VITE_DEMO_CREDIT_URL quando a imagem for de terceiros.
 */
export const DEMO_CREDIT: { label: string; url?: string } | null = import.meta.env
  .VITE_DEMO_CREDIT
  ? {
      label: import.meta.env.VITE_DEMO_CREDIT,
      url: import.meta.env.VITE_DEMO_CREDIT_URL,
    }
  : null

/** Carta de exemplo usada na home (arte: /demo-mago-negro.png). */
export const DEMO_CARD: CardDraft & { id: string } = {
  id: '0f3d9a52-7c1e-4a6b-9a41-2c7e5b1d8f03',
  name: 'Mago Negro',
  kind: 'monster',
  description:
    'Um mago que trocou o próprio nome por poder. Dizem que ele atravessa o Véu entre os mundos para atender a quem o invoca — e que o preço cobrado é sempre uma lembrança. Nenhum grimório registra o seu rosto, apenas os olhos que brilham no escuro.',
  monster_kind: 'normal',
  spell_kind: null,
  trap_kind: null,
  attribute: 'dark',
  race: 'Mago',
  archetype: '',
  level: 7,
  atk: 2500,
  defense: 2100,
  image_url: DEMO_ART,
  image_path: null,
  rarity: 'super',
  is_public: true,
}
