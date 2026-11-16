/**
 * Worker do Cloudflare para o front do YGO Card Maker.
 *
 * Serve os assets do build (`web/dist`) e faz proxy das rotas de API para o
 * serviço do Render — o equivalente ao `_redirects` do Pages.
 *
 * Só é usado se você publicar como Worker (wrangler). No Pages, o
 * `web/public/_redirects` já faz esse trabalho.
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
  /^\/metrics$/,
]

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (PROXIED.some((pattern) => pattern.test(url.pathname))) {
      const target = new URL(url.pathname + url.search, API_ORIGIN)
      const headers = new Headers(request.headers)
      headers.set('x-forwarded-host', url.host)
      return fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: 'manual' }))
    }

    return env.ASSETS.fetch(request)
  },
}
