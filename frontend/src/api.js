const API = 'http://localhost:8001'

export async function sendStimulus(userId, stimulusId) {
  const res = await fetch(`${API}/stimulus/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, stimulus_id: stimulusId }),
  })
  if (!res.ok) throw new Error(`stimulus/send failed: ${res.status}`)
  return res.json()
}

export async function sendResponse(data) {
  const res = await fetch(`${API}/response/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`response/submit failed: ${res.status}`)
  return res.json()
}

export async function getScore(userId) {
  const res = await fetch(`${API}/score/${userId}`)
  if (!res.ok) throw new Error(`score failed: ${res.status}`)
  return res.json()
}

export async function getHistory(userId) {
  const res = await fetch(`${API}/history/${userId}`)
  if (!res.ok) throw new Error(`history failed: ${res.status}`)
  return res.json()
}

export async function getBrain(userId) {
  const res = await fetch(`${API}/brain/${userId}`)
  if (!res.ok) throw new Error(`brain failed: ${res.status}`)
  return res.json()
}
