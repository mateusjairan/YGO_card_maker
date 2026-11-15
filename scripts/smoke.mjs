/**
 * Smoke test manual contra a API em execução.
 * Uso: node scripts/smoke.mjs [http://127.0.0.1:8000]
 */
const base = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const owner = 'smoke-test-owner-key-0001'

const headers = { 'Content-Type': 'application/json', 'X-Owner-Key': owner }

async function call(path, init = {}) {
  const response = await fetch(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

const steps = []
function check(name, condition, detail) {
  steps.push({ name, ok: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const health = await call('/health')
check('GET /health', health.status === 200 && health.body.status === 'ok', `db=${health.body?.checks?.database}`)

const created = await call('/api/cards', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Aurora, Sentinela do Véu',
    kind: 'monster',
    description: 'Quando esta carta é invocada, olhe para o céu: o primeiro desejo que você fizer vira um escudo.',
    monster_kind: 'effect',
    attribute: 'light',
    race: 'Fada',
    archetype: 'Véu',
    level: 7,
    atk: 2400,
    defense: 1800,
    holo: true,
    is_public: true,
  }),
})
check('POST /api/cards', created.status === 201 && Boolean(created.body?.slug), String(created.body?.detail ?? ''))
const card = created.body

const mine = await call('/api/cards/mine')
check('GET /api/cards/mine', mine.status === 200 && mine.body.items.some((item) => item.id === card.id))

const publicList = await call('/api/cards?limit=5')
check('GET /api/cards (galeria)', publicList.status === 200 && publicList.body.items.length > 0)

const bySlug = await call(`/api/cards/slug/${card.slug}`)
check('GET /api/cards/slug/{slug}', bySlug.status === 200 && bySlug.body.name === card.name)

const page = await fetch(`${base}/c/${card.slug}`)
const html = await page.text()
check(
  'GET /c/{slug} (HTML com Open Graph)',
  page.status === 200 && html.includes(card.name) && html.includes('og:title'),
)

const patched = await call(`/api/cards/${card.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ name: `${card.name} (revista)`, level: 8 }),
})
check('PATCH /api/cards/{id}', patched.status === 200 && patched.body.name.endsWith('(revista)'))

const forbidden = await call(`/api/cards/${card.id}`, {
  method: 'PATCH',
  headers: { 'X-Owner-Key': 'outro-dono-qualquer-1234' },
  body: JSON.stringify({ name: 'invasão' }),
})
check('PATCH com outra chave retorna 403', forbidden.status === 403)

const metrics = await fetch(`${base}/metrics`)
const metricsText = await metrics.text()
check(
  'GET /metrics',
  metrics.status === 200 && metricsText.includes('http_requests_total') && metricsText.includes('ygo_cards_created_total'),
)

const removed = await call(`/api/cards/${card.id}`, { method: 'DELETE' })
check('DELETE /api/cards/{id}', removed.status === 204)

const deletedPage = await fetch(`${base}/c/${card.slug}`)
check('Página pública após exclusão retorna 404', deletedPage.status === 404)

const failed = steps.filter((step) => !step.ok)
console.log(`\n${steps.length - failed.length}/${steps.length} verificações passaram`)
process.exit(failed.length === 0 ? 0 : 1)
