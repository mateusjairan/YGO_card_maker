import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'

type Mode = 'login' | 'register'

export function LoginPage() {
  const { user, loading, login, register } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/criar'

  if (!loading && user) return <Navigate to={redirectTo} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === 'register' && password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell page auth-page">
      <div className="auth-card panel">
        <p className="eyebrow">Duelista</p>
        <h1 className="display auth-card__title">
          {mode === 'login' ? 'Entrar no duelo' : 'Criar conta'}
        </h1>
        <p className="auth-card__lede">
          {mode === 'login'
            ? 'Acesse com o seu e-mail para editar as suas cartas.'
            : 'Cinco uploads de arte por conta. Escolha com carinho.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="duelista@exemplo.com"
            />
          </label>

          <label className="field">
            <span className="field__label">
              <span>Senha</span>
              {mode === 'register' && <span className="field__hint">mínimo 8 caracteres</span>}
            </span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              <span>Primeira vez aqui?</span>
              <button type="button" onClick={() => setMode('register')}>
                Criar conta
              </button>
            </>
          ) : (
            <>
              <span>Já tem conta?</span>
              <button type="button" onClick={() => setMode('login')}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>

      <p className="auth-back">
        <Link to="/">← Voltar para a galeria</Link>
      </p>
    </div>
  )
}
