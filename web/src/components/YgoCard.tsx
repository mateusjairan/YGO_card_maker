import { memo, useRef } from 'react'
import type { CardDraft } from '../types'
import { levelInfo, serialNumber, typeLine } from '../lib/labels'
import { AttributeIcon } from './AttributeIcon'

interface YgoCardProps {
  card: CardDraft & { id?: string }
}

interface PointerState {
  pointerX: number
  pointerY: number
  backgroundX: number
  backgroundY: number
  opacity: number
}

const REST: PointerState = {
  pointerX: 50,
  pointerY: 50,
  backgroundX: 50,
  backgroundY: 50,
  opacity: 0.55,
}

/** Comprime 0–100 (ponteiro) para 37–63 / 33–67 (parallax), como no cards-css. */
function adjust(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

const lerp = (from: number, to: number, ratio: number) => from + (to - from) * ratio

/**
 * Renderizador da carta. O markup e as classes espelham
 * src/app/templates/_card.html (página de compartilhamento no servidor).
 *
 * O foil é pointer-driven: `--pointer-x/y` movem o glare, `--background-x/y`
 * (comprimidos) dão o parallax do padrão e `--card-opacity` acende as camadas.
 */
export const YgoCard = memo(function YgoCard({ card }: YgoCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  const frame = useRef(0)
  const target = useRef<PointerState>({ ...REST })
  const current = useRef<PointerState>({ ...REST })

  const attrKey = card.kind === 'monster' ? (card.attribute ?? 'light') : card.kind
  const level = levelInfo(card)
  const showStats = card.kind === 'monster'
  const nameClass = card.name.length > 30 ? 'is-xs' : card.name.length > 22 ? 'is-sm' : ''

  function animate() {
    const node = cardRef.current
    if (!node) return
    const now = current.current
    const goal = target.current

    now.pointerX = lerp(now.pointerX, goal.pointerX, 0.18)
    now.pointerY = lerp(now.pointerY, goal.pointerY, 0.18)
    now.backgroundX = lerp(now.backgroundX, goal.backgroundX, 0.16)
    now.backgroundY = lerp(now.backgroundY, goal.backgroundY, 0.16)
    now.opacity = lerp(now.opacity, goal.opacity, 0.12)

    const offsetX = (now.pointerX - 50) * 4.2
    const offsetY = (now.pointerY - 50) * 6.12
    const fromCenter = Math.min(1, Math.hypot(now.pointerX - 50, now.pointerY - 50) / 50)

    node.style.setProperty('--pointer-x', `${now.pointerX.toFixed(2)}%`)
    node.style.setProperty('--pointer-y', `${now.pointerY.toFixed(2)}%`)
    node.style.setProperty('--background-x', `${now.backgroundX.toFixed(2)}%`)
    node.style.setProperty('--background-y', `${now.backgroundY.toFixed(2)}%`)
    node.style.setProperty('--pointer-from-center', fromCenter.toFixed(3))
    node.style.setProperty('--pointer-from-top', (now.pointerY / 100).toFixed(3))
    node.style.setProperty('--pointer-from-left', (now.pointerX / 100).toFixed(3))
    node.style.setProperty('--card-opacity', now.opacity.toFixed(2))
    node.style.setProperty('--px', `${offsetX.toFixed(1)}px`)
    node.style.setProperty('--py', `${offsetY.toFixed(1)}px`)
    node.style.setProperty('--rx', `${(-offsetY / 30).toFixed(2)}deg`)
    node.style.setProperty('--ry', `${(offsetX / 30).toFixed(2)}deg`)

    const settled =
      Math.abs(goal.pointerX - now.pointerX) < 0.15 &&
      Math.abs(goal.pointerY - now.pointerY) < 0.15 &&
      Math.abs(goal.opacity - now.opacity) < 0.005

    frame.current = settled ? 0 : requestAnimationFrame(animate)
  }

  function start() {
    if (!frame.current) frame.current = requestAnimationFrame(animate)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const node = cardRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const pointerX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
    const pointerY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))

    target.current = {
      pointerX,
      pointerY,
      backgroundX: adjust(pointerX, 0, 100, 37, 63),
      backgroundY: adjust(pointerY, 0, 100, 33, 67),
      opacity: 1,
    }
    node.classList.add('is-tilting')
    start()
  }

  function handlePointerLeave() {
    target.current = { ...REST }
    cardRef.current?.classList.remove('is-tilting')
    start()
  }

  return (
    <article
      className="ygo-card"
      ref={cardRef}
      data-kind={card.kind}
      data-attribute={card.kind === 'monster' ? attrKey : undefined}
      data-rarity={card.rarity}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="ygo-card__surface">
        <header className="ygo-card__header">
          <div className="ygo-card__namebar">
            <h1 className={`ygo-card__name ${nameClass}`.trim()}>{card.name || 'Carta sem nome'}</h1>
          </div>
          <div className="ygo-card__attribute">
            <AttributeIcon name={attrKey} />
          </div>
        </header>

        {level.visible &&
          (level.link ? (
            <div className="ygo-card__levelrow">
              <span className="ygo-card__linkbadge">LINK-{level.count}</span>
            </div>
          ) : (
            <div className="ygo-card__levelrow" data-rank={String(level.rank)}>
              {Array.from({ length: level.count }, (_, index) => (
                <span key={index} className="ygo-card__star" />
              ))}
            </div>
          ))}

        <div className="ygo-card__art">
          {card.image_url ? (
            <img
              className="ygo-card__artimg"
              src={card.image_url}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="ygo-card__artplaceholder">sem arte</div>
          )}
          {card.image_url && (
            <>
              <div className="ygo-card__holo" />
              <div className="ygo-card__foil" />
              <div className="ygo-card__grain" />
              <div className="ygo-card__stars" />
              <div className="ygo-card__sparkle" />
            </>
          )}
        </div>

        <div className="ygo-card__infobox">
          <div className="ygo-card__type">
            <span className="ygo-card__bracket">[</span> {typeLine(card)}{' '}
            <span className="ygo-card__bracket">]</span>
          </div>
          <p className="ygo-card__desc">
            {card.description || 'Escreva aqui o efeito, a história ou os detalhes da sua carta.'}
          </p>
          {showStats && (
            <div className="ygo-card__stats">
              <span>
                ATK/<b>{card.atk ?? '?'}</b>
              </span>
              {card.defense !== null && (
                <span>
                  DEF/<b>{card.defense}</b>
                </span>
              )}
            </div>
          )}
        </div>

        <footer className="ygo-card__footer">
          <span>YGO Card Maker</span>
          <span className="ygo-card__serial">{serialNumber(card.id)}</span>
        </footer>
      </div>

      <div className="ygo-card__glare" aria-hidden="true" />
    </article>
  )
})
