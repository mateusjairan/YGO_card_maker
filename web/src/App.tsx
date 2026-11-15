import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { EditorPage } from './pages/Editor'
import { HomePage } from './pages/Home'
import { MyCardsPage } from './pages/MyCards'
import { NotFoundPage } from './pages/NotFound'

export function App() {
  return (
    <>
      <header className="site-header">
        <div className="shell site-header__inner">
          <Link className="brand" to="/">
            <span className="brand__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 3v12h10V6H7zm2 2h6v6H9V8z" />
              </svg>
            </span>
            YGO <span>Card Maker</span>
          </Link>

          <nav className="nav">
            <NavLink to="/criar">Criar</NavLink>
            <NavLink to="/minhas">Minhas cartas</NavLink>
          </nav>

          <div className="spacer" />

          <Link className="btn btn--primary btn--small" to="/criar">
            Nova carta
          </Link>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/criar" element={<EditorPage />} />
          <Route path="/editar/:id" element={<EditorPage />} />
          <Route path="/minhas" element={<MyCardsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer shell">
        <span>YGO Card Maker · projeto final Full Cycle · React + FastAPI + Supabase</span>
        <span>
          <a href="https://github.com/mateusjairan/YGO_card_maker" target="_blank" rel="noreferrer">
            Repositório
          </a>{' '}
          · <a href="/docs">API</a>
        </span>
      </footer>
    </>
  )
}
