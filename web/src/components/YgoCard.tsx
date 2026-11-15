import { memo, useRef } from 'react'
import type { CardDraft } from '../types'
import { levelInfo, serialNumber, typeLine } from '../lib/labels'
import { AttributeIcon } from './AttributeIcon'

interface YgoCardProps {
  card: CardDraft & { id?: string }
}

/**
 * Renderizador da carta. O markup e as classes espelham
 * src/app/templates/_card.html (página de compartilhamento no servidor).
 *
 * O foil é pointer-driven: o ponteiro escreve `--px`, `--py`, `--o`, `--rx` e
 * `--ry` na própria carta e o CSS de cada raridade usa esses valores em
 * `background-position`/`transform`.
 */
export const YgoCard = memo(function YgoCard({ card }: YgoCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  const frame = useRef(0)
  const target = useRef({ x: 0, y: 0, o: 0.55 })
  const current = useRef({ x: 0, y: 0, o: 0.55 })

  const attrKey = card.kind === 'monster' ? (card.attribute ?? 'light') : card.kind
  const level = levelInfo(card)
  const showStats = card.kind === 'monster'
  const nameClass = card.name.length > 30 ? 'is-xs' : card.name.length > 22 ? 'is-sm' : ''

  function animate() {
    const node = cardRef.current
    if (!node) return
    const now = current.current
    const goal = target.current

    now.x += (goal.x - now.x) * 0.16
    now.y += (goal.y - now.y) * 0.16
    now.o += (goal.o - now.o) * 0.12

    node.style.setProperty('--px', `${now.x.toFixed(1)}px`)
    node.style.setProperty('--py', `${now.y.toFixed(1)}px`)
    node.style.setProperty('--o', now.o.toFixed(2))
    node.style.setProperty('--rx', `${(-now.y / 30).toFixed(2)}deg`)
    node.style.setProperty('--ry', `${(now.x / 30).toFixed(2)}deg`)

    const settled =
      Math.abs(goal.x - now.x) < 0.4 &&
      Math.abs(goal.y - now.y) < 0.4 &&
      Math.abs(goal.o - now.o) < 0.01

    frame.current = settled ? 0 : requestAnimationFrame(animate)
  }

  function start() {
    if (!frame.current) frame.current = requestAnimationFrame(animate)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const node = cardRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    const distance = Math.hypot(x, y) / Math.hypot(rect.width / 2, rect.height / 2)
    target.current = { x, y, o: Math.max(0.25, Math.min(1, 1.1 - distance * 0.55)) }
    node.classList.add('is-tilting')
    start()
  }

  function handlePointerLeave() {
    target.current = { x: 0, y: 0, o: 0.55 }
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
