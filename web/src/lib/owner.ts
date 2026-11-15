const STORAGE_KEY = 'ygo.ownerKey'

/**
 * Identidade anônima do duelista: uma chave aleatória guardada no navegador.
 * Não é login — prova apenas que este navegador é dono das cartas criadas.
 */
export function getOwnerKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length >= 16) return existing
    const generated = generateKey()
    localStorage.setItem(STORAGE_KEY, generated)
    return generated
  } catch {
    return generateKey()
  }
}

function generateKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  const random = () => Math.random().toString(36).slice(2, 10)
  return `ygo-${random()}${random()}-${random()}${random()}`
}
