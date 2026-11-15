import { toPng } from 'html-to-image'
import { slugifyFilename } from './labels'

/** Exporta um nó `.ygo-card` para PNG em 2x (840x1224), pronto para impressão. */
export async function exportCardAsPng(node: HTMLElement, cardName: string): Promise<void> {
  await document.fonts.ready

  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    width: 420,
    height: 612,
    cacheBust: true,
    skipAutoScale: true,
    style: { margin: '0', transform: 'none' },
  })

  const link = document.createElement('a')
  link.download = `${slugifyFilename(cardName)}.png`
  link.href = dataUrl
  link.click()
}
