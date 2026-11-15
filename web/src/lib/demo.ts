import type { CardDraft } from '../types'

/** Carta de exemplo usada na home (arte: /demo-julia.png). */
export const DEMO_CARD: CardDraft & { id: string } = {
  id: '0f3d9a52-7c1e-4a6b-9a41-2c7e5b1d8f03',
  name: 'Julia, Dama de Köln',
  kind: 'monster',
  description:
    'Da base da catedral de Köln ela ascende, uma jovem dama envolta em histórias que apenas as gárgulas sussurram. A beleza gótica de sua alma é um eco dos vitrais ancestrais, mas seu coração, tão forte quanto a pedra da igreja, protege a cidade das sombras com uma graça serena.',
  monster_kind: 'effect',
  spell_kind: null,
  trap_kind: null,
  attribute: 'dark',
  race: 'Mago',
  archetype: 'Guardiões de Köln',
  level: 8,
  atk: 2500,
  defense: 2000,
  image_url: '/demo-julia.png',
  image_path: null,
  holo: true,
  is_public: true,
}
