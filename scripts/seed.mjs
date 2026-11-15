// Popula a API com N cartas sintéticas (para medir desempenho com volume).
const base = 'http://127.0.0.1:8000'
const total = Number(process.argv[2] ?? 500)
const perOwner = 100
const kinds = ['monster', 'spell', 'trap']
const attributes = ['light', 'dark', 'earth', 'water', 'fire', 'wind', 'divine']

async function create(index) {
  const owner = `seed-owner-${Math.floor(index / perOwner)}-key`
  const kind = kinds[index % 3]
  const payload =
    kind === 'monster'
      ? {
          name: `Carta Sintética ${index}`,
          kind,
          description: `Descrição gerada para o teste de volume número ${index}.`,
          monster_kind: 'effect',
          attribute: attributes[index % 7],
          race: 'Mago',
          level: (index % 12) + 1,
          atk: 1000 + (index % 40) * 100,
          defense: 1000 + (index % 30) * 100,
          is_public: true,
        }
      : {
          name: `Carta Sintética ${index}`,
          kind,
          description: `Descrição gerada para o teste de volume número ${index}.`,
          ...(kind === 'spell' ? { spell_kind: 'normal' } : { trap_kind: 'normal' }),
          is_public: true,
        }

  const response = await fetch(`${base}/api/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Owner-Key': owner },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`falhou em ${index}: ${response.status}`)
}

const started = Date.now()
let done = 0
const workers = Array.from({ length: 8 }, async () => {
  while (done < total) {
    const index = done++
    await create(index)
  }
})
await Promise.all(workers)
console.log(`${total} cartas em ${((Date.now() - started) / 1000).toFixed(1)}s`)
