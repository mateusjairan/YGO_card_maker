import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './lib/session'
import { EditorPage } from './pages/Editor'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { MyCardsPage } from './pages/MyCards'
import { NotFoundPage } from './pages/NotFound'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="shell page">
        <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

function QuotaBadge() {
  const { user } = useSession()
  if (!user) return null

  const used = user.uploads_used
  const limit = user.uploads_limit
  const full = used >= limit

  return (
    <div className={`quota${full ? ' quota--full' : ''}`} title="Artes em cartas salvas (a cota volta ao remover a arte)">
      <span className="quota__label">Artes</span>
      <span className="quota__pips" aria-hidden="true">
        {Array.from({ length: limit }, (_, index) => (
          <i key={index} className={index < used ? 'on' : ''} />
        ))}
      </span>
      <span className="quota__value">
        {used}/{limit}
      </span>
    </div>
  )
}

export function App() {
  const { user, logout } = useSession()

  return (
    <>
      <header className="site-header">
        <div className="shell site-header__inner">
          <Link className="brand" to="/">
            <span className="brand__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 1.6 21.2 6.8v10.4L12 22.4 2.8 17.2V6.8L12 1.6zm0 3.1L5.3 8.4v7.2L12 19.3l6.7-3.7V8.4L12 4.7zm0 3.2 3.9 2.1v4.2L12 16.3l-3.9-2.1V9.9L12 7.9z" />
              </svg>
            </span>
            <span className="brand__text">
              YGO <em>Card Maker</em>
            </span>
          </Link>

          <nav className="nav">
            <NavLink to="/criar">Criar</NavLink>
            <NavLink to="/minhas">Minhas cartas</NavLink>
          </nav>

          <div className="spacer" />

          <div className="session-bar">
            {user ? (
              <>
                <QuotaBadge />
                <span className="session-bar__email" title={user.email}>
                  {user.email}
                </span>
                <button type="button" className="btn btn--ghost btn--small" onClick={logout}>
                  Sair
                </button>
              </>
            ) : (
              <Link className="btn btn--primary btn--small" to="/entrar">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route
            path="/criar"
            element={
              <RequireAuth>
                <EditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/editar/:id"
            element={
              <RequireAuth>
                <EditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/minhas"
            element={
              <RequireAuth>
                <MyCardsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer shell">
        <span>YGO Card Maker · projeto final Full Cycle</span>
        <span>
          React + FastAPI + Supabase ·{' '}
          <a href="https://github.com/mateusjairan/YGO_card_maker" target="_blank" rel="noreferrer">
            repositório
          </a>
        </span>
      </footer>
    </>
  )
}
