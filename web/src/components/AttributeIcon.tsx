interface AttributeIconProps {
  name: string
  className?: string
}

/**
 * Ícones dos atributos (mesmos paths usados no template Jinja da API).
 * SVGs com fill/stroke em currentColor para herdar a cor do selo.
 */
export function AttributeIcon({ name, className }: AttributeIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      {name === 'light' && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path
            d="M12 1.6v3.1M12 19.3v3.1M1.6 12h3.1M19.3 12h3.1M4.4 4.4l2.2 2.2M17.4 17.4l2.2 2.2M19.6 4.4l-2.2 2.2M6.6 17.4l-2.2 2.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </>
      )}
      {name === 'dark' && <path d="M20.6 14.4A8.8 8.8 0 1 1 9.6 3.4a7.1 7.1 0 0 0 11 11z" />}
      {name === 'earth' && (
        <>
          <path d="M12 3.5 21 20.5H3z" />
          <path d="M12 9.8 16.2 17.4H7.8z" opacity=".35" />
        </>
      )}
      {name === 'water' && (
        <path d="M12 2.4c3.6 4.2 6.4 7.4 6.4 10.7a6.4 6.4 0 0 1-12.8 0C5.6 9.8 8.4 6.6 12 2.4z" />
      )}
      {name === 'fire' && (
        <path d="M13.2 2.2c.6 3.7 4.6 5.3 4.6 9.6a5.8 5.8 0 0 1-11.6 0c0-2.6 1.4-4.3 2.8-5.6-.2 1.8.8 2.8 1.9 2.8 1.6 0 2-1.9 2.3-6.8z" />
      )}
      {name === 'wind' && (
        <path
          d="M2.8 8.2h10.4a2.6 2.6 0 1 0-2.6-2.6M2.8 13.1h13a3.1 3.1 0 1 1-3.1 3.1M2.8 18h7.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      )}
      {name === 'divine' && (
        <path d="M12 1.5l2.7 6.6 6.8.6-5.2 4.5 1.6 6.7L12 16.6 6.1 19.9l1.6-6.7L2.5 8.7l6.8-.6z" />
      )}
      {name === 'spell' && (
        <>
          <circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="2.9" />
          <path
            d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      )}
      {name === 'trap' && (
        <>
          <path
            d="M12 3.2 21.4 20H2.6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M12 9.4v4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16.9" r="1.05" />
        </>
      )}
    </svg>
  )
}

/** Ícones grandes usados no seletor de tipo de carta. */
export function KindIcon({ kind }: { kind: 'monster' | 'spell' | 'trap' }) {
  if (kind === 'spell') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.4 14.4 9l6.7 2-6.7 2L12 19.7 9.6 13 2.9 11l6.7-2z" />
        <circle cx="19" cy="5" r="1.4" />
      </svg>
    )
  }
  if (kind === 'trap') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.8 22 20.6H2z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13c0-4 2.8-7 6.4-7 2.3 0 4 1.3 4.6 3.2l3.4-2.6v3.6l2.6-1.4-.6 3.4 2.1 1.9-3 1.2.5 3.1-3.4-1.2-1 3-2.3-2.4-2.4 2.2-.9-3.1-3.3 1.1.8-3.2L4 13z" />
    </svg>
  )
}
