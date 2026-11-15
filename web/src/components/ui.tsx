import { useEffect, useState, type ReactNode } from 'react'

/* --- seção de formulário -------------------------------------------------- */
export function Section({
  step,
  title,
  children,
}: {
  step: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel__title">
        <span className="step">{step}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

/* --- campo ---------------------------------------------------------------- */
export function Field({
  label,
  hint,
  counter,
  children,
}: {
  label: string
  hint?: ReactNode
  counter?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">
        <span>{label}</span>
        {counter ?? (hint ? <span className="field__hint">{hint}</span> : null)}
      </span>
      {children}
    </label>
  )
}

/* --- chips ---------------------------------------------------------------- */
export interface ChipOption {
  value: string
  label: string
  color?: string
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: ChipOption[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="chips" role="group">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`chip${option.value === value ? ' active' : ''}`}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
        >
          {option.color && (
            <span className="chip__dot" style={{ background: option.color }} aria-hidden="true" />
          )}
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* --- switch --------------------------------------------------------------- */
export function Toggle({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="toggle">
      <div className="toggle__text">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

/* --- estrelas de nível ----------------------------------------------------- */
export function Stars({
  value,
  onChange,
  max = 12,
}: {
  value: number | null
  onChange: (value: number) => void
  max?: number
}) {
  const current = value ?? 0
  return (
    <div className="stars" role="group" aria-label="Nível">
      {Array.from({ length: max }, (_, index) => {
        const level = index + 1
        return (
          <button
            type="button"
            key={level}
            className={`star-btn${level <= current ? ' active' : ''}`}
            onClick={() => onChange(level)}
            aria-label={`Nível ${level}`}
            aria-pressed={level <= current}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

/* --- stepper numérico ------------------------------------------------------ */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 5000,
  step = 100,
}: {
  value: number | null
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const current = value ?? min

  const clamp = (next: number) => Math.max(min, Math.min(max, next))

  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(current - step))} aria-label="Diminuir">
        −
      </button>
      <input
        type="number"
        value={current}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10)
          if (!Number.isNaN(parsed)) onChange(clamp(parsed))
        }}
      />
      <button type="button" onClick={() => onChange(clamp(current + step))} aria-label="Aumentar">
        +
      </button>
    </div>
  )
}

/* --- toast ---------------------------------------------------------------- */
export interface ToastMessage {
  kind: 'ok' | 'error'
  title: string
  message?: string
}

export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = window.setTimeout(() => {
      setVisible(false)
      onClose()
    }, 5200)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast || !visible) return null

  return (
    <div className={`toast toast--${toast.kind}`} role="status">
      <div>
        <strong>{toast.title}</strong>
        {toast.message && <p>{toast.message}</p>}
      </div>
      <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
        Fechar
      </button>
    </div>
  )
}
