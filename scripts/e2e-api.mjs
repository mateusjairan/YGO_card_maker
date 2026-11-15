const base = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const stamp = Date.now()
const email = `audit-${stamp}@exemplo.com`
const password = 'senha-auditoria-123'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function call(path, { token, json, method = 'GET', form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }
  if (form) body = form
  const res = await fetch(base + path, { method, headers, body })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data, headers: res.headers }
}

// 1) saúde
const health = await call('/health')
check('health ok', health.status === 200 && health.data.checks.database === true)

// 2) cadastro / duplicado / senha errada
const reg = await call('/api/auth/register', {
  method: 'POST',
  json: { email, password },
})
check('register 201', reg.status === 201 && Boolean(reg.data.access_token))
const token = reg.data.access_token

const dup = await call('/api/auth/register', { method: 'POST', json: { email, password } })
check('register duplicado 409', dup.status === 409 && dup.data.code === 'conflict')

const wrong = await call('/api/auth/login', {
  method: 'POST',
  json: { email, password: 'senha-errada-123' },
})
check('login senha errada 401', wrong.status === 401)

const login = await call('/api/auth/login', { method: 'POST', json: { email, password } })
check('login 200', login.status === 200)

// 3) validações
const invalid = await call('/api/cards', {
  token,
  method: 'POST',
  json: { name: 'Sem atributo', kind: 'monster', monster_kind: 'effect', level: 4 },
})
check('payload inválido 422', invalid.status === 422)

const badRarity = await call('/api/cards', {
  token,
  method: 'POST',
  json: {
    name: 'Raridade inválida',
    kind: 'spell',
    spell_kind: 'normal',
    rarity: 'gold',
  },
})
check('raridade inválida 422', badRarity.status === 422)

const anonymous = await call('/api/cards', { method: 'GET' })
check('lista pública sem token 200', anonymous.status === 200)
const anonMine = await call('/api/cards/mine')
check('mine sem token 401', anonMine.status === 401)

// 4) cria carta
const created = await call('/api/cards', {
  token,
  method: 'POST',
  json: {
    name: 'Sentinela da Auditoria',
    kind: 'monster',
    description: 'Carta criada pelo script de auditoria.',
    monster_kind: 'effect',
    attribute: 'wind',
    race: 'Guerreiro',
    level: 6,
    atk: 2100,
    defense: 1600,
    rarity: 'secret',
  },
})
check('cria carta 201', created.status === 201 && created.data.rarity === 'secret', created.data?.slug)
const card = created.data

// default de raridade
const noRarity = await call('/api/cards', {
  token,
  method: 'POST',
  json: { name: 'Carta sem raridade', kind: 'trap', trap_kind: 'normal' },
})
check('raridade padrão secret', noRarity.status === 201 && noRarity.data.rarity === 'secret')

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

// 5) cota: upload sozinho não consome; conta artes em cartas salvas
for (let i = 1; i <= 6; i += 1) {
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), `arte-${i}.png`)
  const up = await call('/api/uploads', { token, method: 'POST', form })
  check(`upload ${i} sem salvar não consome cota`, up.status === 201 && up.data.uploads_used === 0)
}

const draftUpload = await (async () => {
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'arte-final.png')
  return (await call('/api/uploads', { token, method: 'POST', form })).data
})()

const withArt = []
for (let i = 1; i <= 5; i += 1) {
  const response = await call('/api/cards', {
    token,
    method: 'POST',
    json: {
      name: `Arte auditada ${i}`,
      kind: 'spell',
      spell_kind: 'normal',
      image_url: draftUpload.url,
      image_path: draftUpload.path,
    },
  })
  if (response.status === 201) withArt.push(response.data)
}
check('5 cartas com arte aceitas', withArt.length === 5)

const meFull = await call('/api/auth/me', { token })
check('cota passa a 5/5', meFull.data.uploads_used === 5 && meFull.data.uploads_limit === 5)

const sixthCard = await call('/api/cards', {
  token,
  method: 'POST',
  json: {
    name: 'Carta excedente',
    kind: 'spell',
    spell_kind: 'normal',
    image_url: draftUpload.url,
    image_path: draftUpload.path,
  },
})
check('6ª carta com arte bloqueada 403', sixthCard.status === 403 && sixthCard.data.code === 'quota_exceeded')

const sixthUpload = new FormData()
sixthUpload.append('file', new Blob([png], { type: 'image/png' }), 'sexto.png')
const over = await call('/api/uploads', { token, method: 'POST', form: sixthUpload })
check('upload bloqueado com cota cheia 403', over.status === 403 && over.data.code === 'quota_exceeded')

// 6) remover a arte devolve a cota
await call(`/api/cards/${withArt[0].id}`, {
  token,
  method: 'PATCH',
  json: { image_url: '', image_path: '' },
})
const meAfterRemove = await call('/api/auth/me', { token })
check('remover arte devolve a cota (4/5)', meAfterRemove.data.uploads_used === 4)

// 7) posse
const otherReg = await call('/api/auth/register', {
  method: 'POST',
  json: { email: `intruso-${stamp}@exemplo.com`, password },
})
const otherToken = otherReg.data.access_token
const invade = await call(`/api/cards/${card.id}`, {
  token: otherToken,
  method: 'PATCH',
  json: { name: 'invadida' },
})
check('outro usuário não edita (403)', invade.status === 403)
const invadeDelete = await call(`/api/cards/${card.id}`, { token: otherToken, method: 'DELETE' })
check('outro usuário não apaga (403)', invadeDelete.status === 403)

// 8) privacidade
const priv = await call('/api/cards', {
  token,
  method: 'POST',
  json: { name: 'Carta privada', kind: 'spell', spell_kind: 'normal', is_public: false },
})
const gallery = await call('/api/cards?limit=60')
check(
  'carta privada fora da galeria',
  !gallery.data.items.some((item) => item.id === priv.data.id),
)
const privPage = await call(`/c/${priv.data.slug}`)
check('share de carta privada 404', privPage.status === 404)
const ownerPage = await call(`/c/${card.slug}`)
check('share de carta pública 200 + OG', ownerPage.status === 200 && String(ownerPage.data).includes('og:title'))

// 9) atualização
const patched = await call(`/api/cards/${card.id}`, {
  token,
  method: 'PATCH',
  json: { rarity: 'starlight', atk: 3000 },
})
check('PATCH aplica raridade e ATK', patched.status === 200 && patched.data.rarity === 'starlight' && patched.data.atk === 3000)

// 10) remoção
const removed = await call(`/api/cards/${card.id}`, { token, method: 'DELETE' })
check('DELETE 204', removed.status === 204)
const gone = await call(`/api/cards/${card.id}`)
check('carta removida 404', gone.status === 404)

// 11) CORS preflight
const preflight = await fetch(`${base}/api/cards`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:5173',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
  },
})
check('CORS preflight libera origem', preflight.status === 200 && preflight.headers.get('access-control-allow-origin') === 'http://localhost:5173')

// 12) métricas
const metrics = await fetch(`${base}/metrics`)
const text = await metrics.text()
check('metrics expõe http e negócio', text.includes('http_requests_total') && text.includes('ygo_cards_created_total') && text.includes('ygo_uploads_total'))

// 13) XSS: nome/descrição com HTML não viram marcação na página pública
const xss = await call('/api/cards', {
  token,
  method: 'POST',
  json: {
    name: '<script>alert(1)</script>',
    kind: 'spell',
    spell_kind: 'normal',
    description: '<img src=x onerror=alert(2)>',
    is_public: true,
  },
})
const xssPage = await fetch(`${base}/c/${xss.data.slug}`)
const xssHtml = await xssPage.text()
check(
  'HTML da página pública é escapado',
  xssPage.status === 200 &&
    !xssHtml.includes('<script>alert(1)</script>') &&
    xssHtml.includes('&lt;script&gt;'),
)

// 14) token adulterado é rejeitado
const forged = await call('/api/cards/mine', { token: 'a'.repeat(40) + '.b.c' })
check('token forjado 401', forged.status === 401)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`)
process.exit(failed.length ? 1 : 0)
