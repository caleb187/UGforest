const BASE = 'http://localhost:8000'

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const analyzeForest = (lat, lng, year, radius_km = 5) =>
  api('POST', '/analyze', { lat, lng, year, radius_km })

export const compareForest = (lat, lng, year_a, year_b, radius_km = 5) =>
  api('POST', '/compare', { lat, lng, year_a, year_b, radius_km })

export const getMapTiles = (lat, lng, year_a, year_b, radius_km = 10) =>
  api('POST', '/tiles', { lat, lng, year_a, year_b, radius_km })

export const listForests = () =>
  api('GET', '/forests').then(d => d.forests)