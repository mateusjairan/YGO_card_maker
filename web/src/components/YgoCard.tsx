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
 * As camadas de foil (`.ygo-card__foil`, `__grain`, `__stars`, `__shine`) são
 * controladas pela raridade via CSS: `data-rarity`.
 */
export const YgoCard = memo(function YgoCard({ card }: YgoCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  const frame = useRef(0)

  const attrKey = card.kind === 'monster' ? (card.attribute ?? 'light') : card.kind
  const level = levelInfo(card)
  const showStats = card.kind === 'monster'
  const nameClass = card.name.length > 30 ? 'is-xs' : card.name.length > 22 ? 'is-sm' : ''

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const node = cardRef.current
    if (!node || frame.current) return
    const { clientX, clientY } = event
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const rect = node.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      node.style.setProperty('--shine-x', `${x.toFixed(1)}%`)
      node.style.setProperty('--shine-y', `${y.toFixed(1)}%`)
    })
  }

  return (
    <article
      className="ygo-card"
      ref={cardRef}
      data-kind={card.kind}
      data-attribute={card.kind === 'monster' ? attrKey : undefined}
      data-rarity={card.rarity}
      onPointerMove={handlePointerMove}
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
      <div className="ygo-card__shine" aria-hidden="true" />
    </article>
  )
})
