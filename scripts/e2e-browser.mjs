import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const appUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const apiUrl = (process.argv[3] ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const port = Number(process.argv[4] ?? 9222)
const downloads = path.join(os.tmpdir(), 'ygo-e2e-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
fs.mkdirSync(downloads, { recursive: true })

const results = []
const consoleErrors = []
const pageErrors = []

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// conta fixa: login ou cadastro (idempotente entre execuções)
const email = 'e2e-ui@exemplo.com'
const password = 'senha-do-navegador-123'
const authHeaders = { 'Content-Type': 'application/json' }

let session = await fetch(`${apiUrl}/api/auth/login`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ email, password }),
}).then((r) => r.json())

if (!session.access_token) {
  session = await fetch(`${apiUrl}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json())
}
if (!session.access_token) throw new Error('sessão falhou: ' + JSON.stringify(session))

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
const target = targets.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails.text ?? 'exception')
  }
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
}

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const messageId = ++id
    pending.set(messageId, resolve)
    ws.send(JSON.stringify({ id: messageId, method, params }))
  })

const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.text)
  }
  return response.result?.result?.value
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(expression, timeout = 10000, label = expression) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true
    await sleep(150)
  }
  throw new Error(`timeout esperando ${label}`)
}

const click = (text) =>
  evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}));
    if (!button) throw new Error('botão não encontrado');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  })()`)

await new Promise((resolve) => (ws.onopen = resolve))
await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: downloads,
  eventsEnabled: true,
})
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
})

// --- 1. página de login renderiza -------------------------------------------
await send('Page.navigate', { url: appUrl + '/' })
await sleep(1200)
await evaluate('localStorage.clear()')
await send('Page.navigate', { url: appUrl + '/entrar' })
await waitFor(`document.querySelectorAll('.auth-form input').length >= 2`, 15000, 'formulário de login')
check('página de login renderiza', true)

// --- 2. sessão injetada (mesmo storage que o login grava) -------------------
await evaluate(`localStorage.setItem('ygo.token', ${JSON.stringify(session.access_token)})`)
await send('Page.navigate', { url: appUrl + '/criar' })
await waitFor(`document.querySelectorAll('input.input').length > 0`, 15000, 'editor')
check('editor abre com sessão', true)

// --- 3. prévia em tempo real ------------------------------------------------
await evaluate(`(() => {
  const input = [...document.querySelectorAll('input.input')].find((el) => el.placeholder.includes('Mago'));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'Sentinela do Navegador');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`)
await sleep(500)
const previewName = await evaluate(`document.querySelector('.ygo-card__name')?.textContent`)
check('prévia reflete o nome digitado', previewName === 'Sentinela do Navegador', previewName)

// --- 4. raridade muda o acabamento -----------------------------------------
await click('Starlight')
await sleep(400)
const rarity = await evaluate(`document.querySelector('.ygo-card').dataset.rarity`)
check('seletor de raridade aplica data-rarity', rarity === 'starlight', rarity)

// --- 5. salva ----------------------------------------------------------------
await click('Salvar carta')
await waitFor(`document.querySelector('.share-box') !== null`, 15000, 'share-box depois de salvar')
const shareLink = await evaluate(`document.querySelector('.share-box code')?.textContent`)
check('salvar gera link público', Boolean(shareLink) && shareLink.includes('/c/'), shareLink)

// --- 6. página pública --------------------------------------------------------
const sharePath = new URL(shareLink).pathname
const shareResponse = await fetch(`${apiUrl}${sharePath}`)
const shareHtml = await shareResponse.text()
check(
  'página pública responde com Open Graph e raridade',
  shareResponse.status === 200 &&
    shareHtml.includes('og:title') &&
    shareHtml.includes('data-rarity="starlight"'),
)

// --- 7. export PNG ------------------------------------------------------------
// Headless não grava download de data:; intercepta o anchor e valida os bytes.
await evaluate(`(() => {
  window.__exported = null;
  const original = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('data:image/png')) {
      const bin = atob(this.href.split(',')[1]);
      const read = (offset) =>
        (bin.charCodeAt(offset) << 24) |
        (bin.charCodeAt(offset + 1) << 16) |
        (bin.charCodeAt(offset + 2) << 8) |
        bin.charCodeAt(offset + 3);
      window.__exported = {
        name: this.download,
        width: read(16),
        height: read(20),
        bytes: bin.length,
        signature: bin.charCodeAt(0) === 0x89 && bin.slice(1, 4) === 'PNG',
      };
    }
    return original.apply(this, arguments);
  };
  return true;
})()`)

await click('Baixar PNG')
for (let i = 0; i < 25; i += 1) {
  await sleep(400)
  if (await evaluate('Boolean(window.__exported)')) break
}
const exported = JSON.parse(await evaluate(`JSON.stringify(window.__exported)`))
check('exportação gera PNG', Boolean(exported), exported ? `${exported.bytes} bytes` : 'nada')
check(
  'PNG válido em 840x1224',
  exported && exported.width === 840 && exported.height === 1224 && exported.signature,
  exported ? `${exported.width}x${exported.height}` : '',
)

// --- 8. minhas cartas ---------------------------------------------------------
await send('Page.navigate', { url: appUrl + '/minhas' })
await waitFor(`document.querySelectorAll('.card-tile').length > 0`, 12000, 'minhas cartas')
const tiles = await evaluate(`document.querySelectorAll('.card-tile').length`)
check('minhas cartas lista a carta criada', tiles >= 1, `${tiles} carta(s)`)

// --- 9. mobile sem overflow ---------------------------------------------------
for (const route of ['/criar', '/', '/minhas']) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send('Page.navigate', { url: `${appUrl}${route}` })
  await sleep(1600)
  const metrics = JSON.parse(
    await evaluate(
      `JSON.stringify({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth })`,
    ),
  )
  check(
    `sem overflow horizontal em ${route} (390px)`,
    metrics.scroll <= metrics.inner + 1,
    `${metrics.scroll} vs ${metrics.inner}`,
  )
}

// --- 10. console limpo --------------------------------------------------------
const fatal = consoleErrors.filter((message) => !/favicon|404 \(Not Found\)/i.test(message))
check('sem erro de console', fatal.length === 0, fatal.slice(0, 2).join(' | '))
check('sem exceção de página', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

// limpeza: não deixa carta de teste na galeria
const mine = await fetch(`${apiUrl}/api/cards/mine?limit=100`, {
  headers: { Authorization: `Bearer ${session.access_token}` },
}).then((r) => r.json())
for (const item of mine.items ?? []) {
  await fetch(`${apiUrl}/api/cards/${item.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}
const leftover = await fetch(`${apiUrl}/api/cards/mine`, {
  headers: { Authorization: `Bearer ${session.access_token}` },
}).then((r) => r.json())
check('limpeza: nenhuma carta de teste sobrando', (leftover.items ?? []).length === 0)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`)
ws.close()
process.exit(failed.length ? 1 : 0)
