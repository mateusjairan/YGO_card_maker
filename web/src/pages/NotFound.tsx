import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="shell page">
      <div className="empty" style={{ marginTop: 40 }}>
        <h2>Essa carta não existe</h2>
        <p>O link pode ter expirado ou a carta foi removida pelo dono.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn--primary" to="/criar">
            Criar uma carta
          </Link>
          <Link className="btn" to="/">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
