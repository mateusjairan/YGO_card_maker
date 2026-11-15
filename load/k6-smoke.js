import http from 'k6/http'
import { check, sleep } from 'k6'

/**
 * Smoke test k6 — fluxo principal do YGO Card Maker.
 *
 *   BASE_URL=http://localhost:8000 k6 run load/k6-smoke.js
 *
 * SLO: p95 < 300 ms e menos de 1% de falhas nas leituras.
 */
export const options = {
  stages: [
    { duration: '10s', target: 20 }, // ramp-up
    { duration: '30s', target: 20 }, // carga estável
    { duration: '5s', target: 0 }, // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000'

export function setup() {
  const response = http.get(`${BASE_URL}/health`)
  if (response.status !== 200) {
    throw new Error(`API indisponível em ${BASE_URL}: ${response.status}`)
  }
  return { baseUrl: BASE_URL }
}

export default function () {
  const list = http.get(`${BASE_URL}/api/cards?limit=12`)
  check(list, {
    'lista status 200': (r) => r.status === 200,
    'lista tem items': (r) => Array.isArray(r.json('items')),
  })

  const first = list.json('items.0.slug')
  if (first) {
    const share = http.get(`${BASE_URL}/c/${first}`)
    check(share, {
      'página pública status 200': (r) => r.status === 200,
      'página tem Open Graph': (r) => r.body.includes('og:title'),
    })
  }

  sleep(0.2)
}
