import { useEffect, useRef, useState, type ReactNode } from 'react'

interface CardScalerProps {
  children: ReactNode
  /** Largura máxima disponível; a carta (420px) é reduzida proporcionalmente. */
  maxWidth?: number
}

/** Escala a carta mantendo a proporção 420x612 sem distorcer o layout interno. */
export function CardScaler({ children, maxWidth = 420 }: CardScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    // Mede o espaço real do pai: o card não pode definir a largura do grid
    // (era o que estourava o layout no mobile).
    const update = () => {
      const available = Math.min(
        element.parentElement?.clientWidth ?? element.clientWidth,
        element.clientWidth || Number.POSITIVE_INFINITY,
        maxWidth,
        420,
      )
      setScale(Math.min(1, Math.max(0.28, available / 420)))
    }

    const frame = requestAnimationFrame(update)
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [maxWidth])

  return (
    <div className="card-scaler" ref={containerRef}>
      <div className="card-scaler__box" style={{ width: 420 * scale, height: 612 * scale }}>
        <div className="card-scaler__inner" style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
