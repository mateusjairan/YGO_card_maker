/**
 * Worker do Cloudflare para o front do YGO Card Maker.
 *
 * Serve os assets do build (`web/dist`) e faz proxy das rotas de API para o
 * serviço do Render — o equivalente ao `_redirects` do Pages.
 *
 * Só é usado se você publicar como Worker (wrangler). No Pages, o
 * `web/public/_redirects` já faz esse trabalho.
 *
 * O plano free do Render hiberna a API; por isso:
 *   - GET/HEAD ganham uma segunda tentativa quando o origin responde 502/503/504
 *     (sintoma de instância ainda subindo);
 *   - se mesmo assim falhar, /api/* devolve JSON `api_waking` em vez de um 502
 *     sem corpo, e o front mostra uma mensagem compreensível.
 */

const API_ORIGIN = 'https://ygo-card-maker.onrender.com'

const PROXIED = [
  /^\/api\//,
  /^\/c\//,
  /^\/static\//,
  /^\/media\//,
  /^\/docs$/,
  /^\/openapi\.json$/,
  /^\/health$/,
  /^\/health\/live$/,
  /^\/metrics$/,
]

const RETRYABLE = new Set([502, 503, 504])
const RETRY_DELAY_MS = 2000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function wakingResponse() {
  return new Response(
    JSON.stringify({
      detail:
        'A API está acordando (cold start do Render). No plano free ela hiberna depois de ~15 min parada — tente de novo em alguns segundos.',
      code: 'api_waking',
    }),
    {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '15',
      },
    },
  )
}

async function proxy(request, url) {
  const target = new URL(url.pathname + url.search, API_ORIGIN)
  const send = () => {
    const headers = new Headers(request.headers)
    headers.set('x-forwarded-host', url.host)
    return fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      }),
    )
  }

  // só métodos sem corpo podem ser repetidos com segurança (o body é um stream)
  const idempotent = request.method === 'GET' || request.method === 'HEAD'

  let response = await send()
  if (idempotent && RETRYABLE.has(response.status)) {
    await sleep(RETRY_DELAY_MS)
    response = await send()
  }

  if (RETRYABLE.has(response.status) && url.pathname.startsWith('/api/')) {
    return wakingResponse()
  }

  return response
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (PROXIED.some((pattern) => pattern.test(url.pathname))) {
      return proxy(request, url)
    }

    return env.ASSETS.fetch(request)
  },
}
