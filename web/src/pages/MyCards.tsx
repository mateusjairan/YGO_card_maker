import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { CardRecord } from '../types'
import { CardScaler } from '../components/CardScaler'
import { YgoCard } from '../components/YgoCard'
import { Toast, type ToastMessage } from '../components/ui'

const KIND_LABEL: Record<CardRecord['kind'], string> = {
  monster: 'Monstro',
  spell: 'Magia',
  trap: 'Armadilha',
}

export function MyCardsPage() {
  const [cards, setCards] = useState<CardRecord[] | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    let active = true
    api
      .listMine()
      .then((response) => {
        if (active) setCards(response.items)
      })
      .catch((error: Error) => {
        if (!active) return
        setCards([])
        setToast({ kind: 'error', title: 'Não foi possível carregar', message: error.message })
      })
    return () => {
      active = false
    }
  }, [])

  async function handleDelete(card: CardRecord) {
    if (!window.confirm(`Excluir "${card.name}"? Essa ação não tem volta.`)) return
    try {
      await api.remove(card.id)
      setCards((previous) => (previous ?? []).filter((item) => item.id !== card.id))
      setToast({ kind: 'ok', title: 'Carta excluída' })
    } catch (error) {
      setToast({
        kind: 'error',
        title: 'Não foi possível excluir',
        message: (error as Error).message,
      })
    }
  }

  async function handleCopy(card: CardRecord) {
    const url = `${window.location.origin}/c/${card.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setToast({ kind: 'ok', title: 'Link copiado', message: url })
    } catch {
      setToast({ kind: 'error', title: 'Copie manualmente', message: url })
    }
  }

  return (
    <div className="shell page">
      <div className="section__head" style={{ border: 'none', paddingBottom: 0 }}>
        <div>
          <p className="eyebrow">Sua coleção</p>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
            Minhas cartas
          </h1>
        </div>
        <Link className="btn btn--primary" to="/criar">
          Nova carta
        </Link>
      </div>

      {cards === null && (
        <div className="grid-cards" style={{ marginTop: 26 }}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className="skeleton" key={index} style={{ height: 420 }} />
          ))}
        </div>
      )}

      {cards !== null && cards.length === 0 && (
        <div className="empty" style={{ marginTop: 26 }}>
          <h2>Nenhuma carta por aqui ainda</h2>
          <p>
            As cartas ficam ligadas a este navegador por uma chave anônima. Crie a primeira e ela
            aparece nesta lista.
          </p>
          <Link className="btn btn--primary" to="/criar">
            Criar minha primeira carta
          </Link>
        </div>
      )}

      {cards !== null && cards.length > 0 && (
        <div className="grid-cards" style={{ marginTop: 26 }}>
          {cards.map((card) => (
            <article className="card-tile" key={card.id}>
              <div className="card-tile__stage">
                <CardScaler maxWidth={240}>
                  <YgoCard card={card} />
                </CardScaler>
              </div>
              <h3 className="card-tile__title">{card.name}</h3>
              <div className="card-tile__meta">
                <span>{KIND_LABEL[card.kind]}</span>
                <span>{new Date(card.created_at).toLocaleDateString('pt-BR')}</span>
                <span>{card.views} views</span>
              </div>
              <div className="card-tile__actions">
                <Link className="btn btn--small" to={`/editar/${card.id}`}>
                  Editar
                </Link>
                <a className="btn btn--small" href={`/c/${card.slug}`} target="_blank" rel="noreferrer">
                  Ver
                </a>
                <button type="button" className="btn btn--small" onClick={() => void handleCopy(card)}>
                  Link
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  onClick={() => void handleDelete(card)}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
