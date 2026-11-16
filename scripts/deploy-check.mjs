/**
 * Verifica um deploy publicado (API no Render + front no Pages).
 *
 * Uso: node scripts/deploy-check.mjs https://sua-api.onrender.com https://seu-site.pages.dev
 */

const api = (process.argv[2] ?? '').replace(/\/$/, '')
const web = (process.argv[3] ?? '').replace(/\/$/, '')

if (!api) {
  console.error('uso: node scripts/deploy-check.mjs <api-url> [web-url]')
  process.exit(2)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function get(url, options = {}) {
  const started = Date.now()
  try {
    const response = await fetch(url, { redirect: 'manual', ...options })
    const text = await response.text()
    return { status: response.status, text, headers: response.headers, ms: Date.now() - started }
  } catch (error) {
    return { status: 0, text: String(error), headers: new Headers(), ms: Date.now() - started }
  }
}

// 1) API
const health = await get(`${api}/health`)
let parsed = {}
try {
  parsed = JSON.parse(health.text)
} catch {
  /* corpo não-JSON */
}
check('API /health responde 200', health.status === 200, `${health.ms} ms (cold start pode passar de 10 s)`)
check('banco conectado', parsed?.checks?.database === true, JSON.stringify(parsed?.checks ?? {}))
check('storage em produção', ['supabase', 'sqlite'].includes(parsed?.storage), parsed?.storage)

const live = await get(`${api}/health/live`)
check('API /health/live responde 200 (keep-alive)', live.status === 200, `${live.ms} ms`)

const docs = await get(`${api}/docs`)
check('Swagger em /docs', docs.status === 200)

const openapi = await get(`${api}/openapi.json`)
check('OpenAPI em /openapi.json', openapi.status === 200 && openapi.text.includes('"/api/cards"'))

const metrics = await get(`${api}/metrics`)
check('métricas em /metrics', metrics.status === 200 && metrics.text.includes('http_requests_total'))

const gallery = await get(`${api}/api/cards?limit=5`)
let cards = []
try {
  cards = JSON.parse(gallery.text).items ?? []
} catch {
  /* ignora */
}
check('galeria pública responde', gallery.status === 200, `${cards.length} carta(s)`)

// 2) página pública + OG
const withArt = cards.find((card) => card.image_url)
if (withArt) {
  const share = await get(`${api}/c/${withArt.slug}`)
  const og = /property="og:image" content="([^"]+)/.exec(share.text)
  check('página /c/{slug} responde 200', share.status === 200)
  check(
    'og:image absoluto e acessível',
    Boolean(og) && og[1].startsWith('https://'),
    og ? og[1].slice(0, 70) : 'sem og:image',
  )
  if (og) {
    const image = await fetch(og[1])
    check('arte pública responde 200', image.status === 200, image.headers.get('content-type') ?? '')
  }
} else {
  check('página pública (sem carta com arte para testar)', true, 'galeria vazia')
}

// 3) CORS
if (web) {
  const preflight = await fetch(`${api}/api/cards`, {
    method: 'OPTIONS',
    headers: {
      Origin: web,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })
  const allow = preflight.headers.get('access-control-allow-origin')
  check('CORS libera o domínio do front', preflight.status === 200 && allow === web, allow ?? 'sem header')

  const page = await get(web)
  check('front no Pages responde 200', page.status === 200, `${page.ms} ms`)
  const proxied = await get(`${web}/api/cards?limit=1`)
  check(
    'proxy /api do Pages chega na API',
    proxied.status === 200 && proxied.text.includes('items'),
    String(proxied.status),
  )
  const redirectRule = await get(`${web}/shop`)
  check('SPA fallback (rota desconhecida cai no index)', redirectRule.status === 200)
} else {
  console.log('SKIP  checagens do front (passe a URL do Pages como 2º argumento)')
}

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`)
process.exit(failed.length ? 1 : 0)
