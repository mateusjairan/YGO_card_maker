// Micro-benchmark sequencial: onde está o tempo de cada rota?
const base = 'http://127.0.0.1:8000'
const rounds = 200

async function measure(path) {
  const times = []
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now()
    const response = await fetch(base + path)
    await response.arrayBuffer()
    times.push(performance.now() - started)
  }
  times.sort((a, b) => a - b)
  const at = (p) => times[Math.floor((times.length - 1) * p)]
  const avg = times.reduce((sum, value) => sum + value, 0) / times.length
  return {
    path,
    avg: Number(avg.toFixed(2)),
    p50: Number(at(0.5).toFixed(2)),
    p95: Number(at(0.95).toFixed(2)),
  }
}

for (const path of ['/health', '/api/cards?limit=12', '/api/cards?q=carta']) {
  console.log(JSON.stringify(await measure(path)))
}
