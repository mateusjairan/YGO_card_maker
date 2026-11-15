/**
 * Smoke test manual contra a API em execução.
 * Uso: node scripts/smoke.mjs [http://127.0.0.1:8000]
 */
const base = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const stamp = Date.now()

let token = ''
const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

async function call(path, init = {}) {
  const response = await fetch(base + path, { ...init, headers: { ...auth(), ...(init.headers ?? {}) } })
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

const health = await fetch(`${base}/health`)
check('GET /health', health.status === 200)

const registered = await call('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email: `smoke-${stamp}@exemplo.com`, password: 'senha-forte-123' }),
})
token = registered.body?.access_token ?? ''
check('POST /api/auth/register', registered.status === 201 && Boolean(token), registered.body?.detail ?? '')
check(
  'cota inicial 0/5',
  registered.body?.user?.uploads_used === 0 && registered.body?.user?.uploads_limit === 5,
)

const me = await call('/api/auth/me')
check('GET /api/auth/me', me.status === 200 && me.body.email.includes('smoke-'))

const login = await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: `smoke-${stamp}@exemplo.com`, password: 'senha-forte-123' }),
})
check('POST /api/auth/login', login.status === 200)

const created = await call('/api/cards', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Aurora, Sentinela do Véu',
    kind: 'monster',
    description:
      'Quando esta carta é invocada, olhe para o céu: o primeiro desejo que você fizer vira um escudo.',
    monster_kind: 'effect',
    attribute: 'light',
    race: 'Fada',
    archetype: 'Véu',
    level: 7,
    atk: 2400,
    defense: 1800,
    rarity: 'secret',
    is_public: true,
  }),
})
check(
  'POST /api/cards',
  created.status === 201 && Boolean(created.body?.slug),
  String(created.body?.detail ?? ''),
)
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

// upload padronizado: a API recorta em 1:1 e nunca faz upscale
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const form = new FormData()
form.append('file', new Blob([pixel], { type: 'image/png' }), 'pixel.png')
const upload = await fetch(`${base}/api/uploads`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
})
const uploadBody = await upload.json()
check(
  'POST /api/uploads (quadrado + webp)',
  upload.status === 201 && uploadBody.width === uploadBody.height && uploadBody.url.endsWith('.webp'),
  `${uploadBody.width}x${uploadBody.height} · ${uploadBody.uploads_used}/${uploadBody.uploads_limit}`,
)

const patched = await call(`/api/cards/${card.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ name: `${card.name} (revista)`, level: 8 }),
})
check('PATCH /api/cards/{id}', patched.status === 200 && patched.body.name.endsWith('(revista)'))

const anonymous = await fetch(`${base}/api/cards/mine`)
check('GET /api/cards/mine sem token retorna 401', anonymous.status === 401)

const metrics = await fetch(`${base}/metrics`)
const metricsText = await metrics.text()
check(
  'GET /metrics',
  metrics.status === 200 &&
    metricsText.includes('http_requests_total') &&
    metricsText.includes('ygo_cards_created_total'),
)

const removed = await call(`/api/cards/${card.id}`, { method: 'DELETE' })
check('DELETE /api/cards/{id}', removed.status === 204)

const deletedPage = await fetch(`${base}/c/${card.slug}`)
check('Página pública após exclusão retorna 404', deletedPage.status === 404)

const failed = steps.filter((step) => !step.ok)
console.log(`\n${steps.length - failed.length}/${steps.length} verificações passaram`)
process.exit(failed.length === 0 ? 0 : 1)
