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
 *     sem corpo, e o front mostra uma mensagem compreensível;
 *   - um Cron Trigger (`scheduled`) pinga /health/live a cada 10 min para a
 *     instância não hibernar. O cron do Cloudflare é pontual e publica junto com
 *     este Worker (o workflow do GitHub em .github/workflows/keepalive.yml fica
 *     como reserva, porque o cron do Actions pode atrasar e pode ser descartado
 *     em horário de pico).
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
const KEEPALIVE_PATH = '/health/live'
// marcador para conferir em produção qual versão do Worker está no ar
const WORKER_VERSION = 'cron-2'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Hora em America/Sao_Paulo: UTC-3 o ano todo (sem horário de verão desde 2019). */
function brazilHour(date) {
  return (date.getUTCHours() + 21) % 24
}

/**
 * O Render dorme após ~15 min ociosos. Pingar 24/7 consome 720–744 h/mês das 750
 * gratuitas (sem margem para deploys), então o keep-alive cobre 06:00–23:59 de
 * Brasília (~540 h/mês): quem entra de madrugada paga o cold start, mas o front
 * avisa "Acordando a API".
 */
export function keepaliveDue(now = new Date()) {
  return brazilHour(now) >= 6
}

async function pingKeepalive() {
  const started = Date.now()
  const response = await fetch(`${API_ORIGIN}${KEEPALIVE_PATH}`, {
    headers: { 'user-agent': 'ygo-card-maker-keepalive/2.0' },
    signal: AbortSignal.timeout(75_000),
  })
  const body = (await response.text()).slice(0, 120)
  console.log(`keepalive http=${response.status} ms=${Date.now() - started} ${body}`)
  return response.ok
}

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

  // carimba a versão só no /health/live (usado para validar o deploy do Worker)
  if (url.pathname === KEEPALIVE_PATH) {
    const marked = new Response(response.body, response)
    marked.headers.set('x-ygo-worker', WORKER_VERSION)
    return marked
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

  /**
   * Cron Trigger configurado em wrangler.jsonc (a cada 10 minutos).
   * Mantém a API do Render acordada dentro da janela 06h–24h de Brasília.
   */
  async scheduled(controller) {
    const scheduledAt = new Date(controller?.scheduledTime ?? Date.now())

    if (!keepaliveDue(scheduledAt)) {
      console.log(`keepalive_skip hora_brt=${brazilHour(scheduledAt)}`)
      return
    }

    try {
      await pingKeepalive()
    } catch (error) {
      // não relança: erro de rede no keep-alive não deve virar retry infinito
      console.log(`keepalive_erro ${String(error)}`)
    }
  },
}
