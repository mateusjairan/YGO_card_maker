import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { DEMO_CARD } from '../lib/demo'
import type { CardRecord } from '../types'
import { CardScaler } from '../components/CardScaler'
import { YgoCard } from '../components/YgoCard'

const FEATURES = [
  {
    title: 'Moldura por atributo',
    text: 'Luz, Trevas, Terra, Água, Fogo, Vento e Divino — cada atributo tem a sua paleta, como nas cartas originais.',
  },
  {
    title: 'Holográfico de verdade',
    text: 'Brilho que reage ao mouse, textura metálica e estrelas em relevo. O PNG sai com o mesmo acabamento.',
  },
  {
    title: 'Link com prévia',
    text: 'Cada carta ganha uma página pública com Open Graph: a arte aparece no WhatsApp, Discord e X.',
  },
]

export function HomePage() {
  const [recent, setRecent] = useState<CardRecord[]>([])

  useEffect(() => {
    let active = true
    api
      .listPublic(6)
      .then((response) => {
        if (active) setRecent(response.items)
      })
      .catch(() => {
        /* galeria é opcional: a home funciona mesmo com a API fora */
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Yu-Gi-Oh! · criador de cartas</p>
          <h1 className="display hero__title">
            Sua história.
            <br />
            <em>Sua carta.</em>
          </h1>
          <p className="lede">
            Escolha o atributo, escreva o efeito, envie a arte e leve a carta pronta em PNG — ou
            compartilhe um link com prévia para mandar no grupo.
          </p>
          <div className="hero__actions">
            <Link className="btn btn--primary" to="/criar">
              Criar minha carta
            </Link>
            <Link className="btn" to="/minhas">
              Minhas cartas
            </Link>
          </div>
          <div className="hero__stats">
            <div className="hero__stat">
              <strong>7</strong>
              <span>atributos</span>
            </div>
            <div className="hero__stat">
              <strong>3</strong>
              <span>tipos de carta</span>
            </div>
            <div className="hero__stat">
              <strong>2×</strong>
              <span>resolução do PNG</span>
            </div>
          </div>
        </div>

        <div className="hero__stage">
          <CardScaler maxWidth={460}>
            <YgoCard card={DEMO_CARD} />
          </CardScaler>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Feito para parecer carta de verdade</h2>
          <Link className="btn btn--small" to="/criar">
            Começar
          </Link>
        </div>
        <div className="features">
          {FEATURES.map((feature, index) => (
            <article className="feature" key={feature.title}>
              <span className="feature__num">0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>Últimas cartas criadas</h2>
            <span className="badge">{recent.length} públicas</span>
          </div>
          <div className="gallery">
            {recent.map((card) => (
              <a className="gallery__item" key={card.id} href={`/c/${card.slug}`}>
                <CardScaler maxWidth={260}>
                  <YgoCard card={card} />
                </CardScaler>
                <div className="gallery__meta">
                  <h3>{card.name}</h3>
                  <span>{card.views} ✦</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
