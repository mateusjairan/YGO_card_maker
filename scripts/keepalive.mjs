/**
 * Keep-alive da API no Render.
 *
 * No plano free o serviço hiberna após ~15 min sem tráfego e a próxima
 * requisição paga um cold start de 30–50 s. Este script bate em
 * `/health/live` (endpoint barato, que não consulta o Supabase) para manter a
 * instância acordada — ou para acordá-la antes de uma demo.
 *
 * Uso:
 *   node scripts/keepalive.mjs                            # URL padrão do projeto
 *   node scripts/keepalive.mjs https://minha-api.onrender.com
 *   API_URL=https://minha-api.onrender.com node scripts/keepalive.mjs
 *
 * Opções:
 *   --attempts N     tentativas antes de desistir (padrão: 4)
 *   --timeout MS     limite por tentativa, cobre o cold start (padrão: 75000)
 *   --interval MS    espera entre tentativas (padrão: 5000)
 *   --quiet          só imprime o resultado final (bom para cron)
 *
 * Códigos de saída: 0 = API respondeu 200; 1 = não respondeu; 2 = uso inválido.
 *
 * Agendamento: cron a cada 10 min, cron-job.org/UptimeRobot, Agendador de
 * Tarefas do Windows ou `.github/workflows/keepalive.yml`.
 */

const DEFAULT_API = 'https://ygo-card-maker.onrender.com'

const argv = process.argv.slice(2)
const options = { attempts: 4, timeout: 75_000, interval: 5_000, quiet: false }
const positional = []

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index]
  if (arg === '--quiet') options.quiet = true
  else if (arg === '--attempts') options.attempts = Number(argv[(index += 1)])
  else if (arg === '--timeout') options.timeout = Number(argv[(index += 1)])
  else if (arg === '--interval') options.interval = Number(argv[(index += 1)])
  else if (arg.startsWith('-')) usage(`opção desconhecida: ${arg}`)
  else positional.push(arg)
}

if (!Number.isInteger(options.attempts) || options.attempts < 1) usage('--attempts inválido')
if (!Number.isFinite(options.timeout) || options.timeout < 1_000) usage('--timeout inválido')
if (!Number.isFinite(options.interval) || options.interval < 0) usage('--interval inválido')

const base = (positional[0] ?? process.env.API_URL ?? DEFAULT_API).replace(/\/+$/, '')
if (!/^https?:\/\//.test(base)) usage(`URL inválida: ${base}`)

const target = `${base}/health/live`
const log = (...args) => {
  if (!options.quiet) console.log(...args)
}

/** Uma tentativa: devolve status, latência e corpo; nunca lança. */
async function ping() {
  const started = Date.now()
  try {
    const response = await fetch(target, {
      headers: { 'user-agent': 'ygo-card-maker-keepalive/1.0' },
      signal: AbortSignal.timeout(options.timeout),
      cache: 'no-store',
    })
    const text = await response.text()
    return { status: response.status, text: text.slice(0, 200), ms: Date.now() - started }
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? `timeout de ${options.timeout} ms` : String(error)
    return { status: 0, text: reason, ms: Date.now() - started }
  }
}

function usage(message) {
  if (message) console.error(`erro: ${message}\n`)
  console.error('uso: node scripts/keepalive.mjs [url] [--attempts N] [--timeout MS] [--interval MS] [--quiet]')
  process.exit(2)
}

let last = { status: 0, text: 'sem tentativas', ms: 0 }

for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
  last = await ping()
  // 200 é o caso normal; alguns hosts devolvem 3xx/404 em proxy mal configurado
  if (last.status === 200) {
    const note = last.ms > 5_000 ? ' (acordou agora: cold start)' : ''
    log(`ok  ${target}  HTTP 200 em ${last.ms} ms${note}  ${last.text}`)
    process.exit(0)
  }
  log(`falhou tentativa ${attempt}/${options.attempts}: HTTP ${last.status} em ${last.ms} ms — ${last.text}`)
  if (attempt < options.attempts) await new Promise((resolve) => setTimeout(resolve, options.interval))
}

console.error(`erro: ${target} não respondeu 200 (último: HTTP ${last.status} — ${last.text})`)
process.exit(1)
