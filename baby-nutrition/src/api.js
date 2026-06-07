const WORKER_URL = import.meta.env.VITE_WORKER_URL

async function callClaude(message, max_tokens = 1024) {
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, max_tokens }),
  })
  if (!response.ok) {
    throw new Error(`Worker error: ${response.status}`)
  }
  const data = await response.json()
  return data.text
}

export async function analyzeMeal(description, mealType) {
  const prompt = `Jesteś dietetykiem dziecięcym. Oceń posiłek dla 15-miesięcznego dziecka, które nie pije już mleka modyfikowanego — wszystkie składniki odżywcze muszą pochodzić wyłącznie z jedzenia.

Posiłek (${mealType}): "${description}"

Zwróć TYLKO obiekt JSON (bez markdown, bez komentarzy):
{
  "ocena": "<1-2 zdania ogólnej oceny wartości odżywczej posiłku po polsku>",
  "skladniki": ["<lista wykrytych kluczowych składników, np. żelazo, witamina C, białko, wapń, witamina D, cynk, omega-3, błonnik — tylko te które faktycznie są w posiłku>"],
  "wskazowka": "<krótka wskazówka uzupełnienia lub null jeśli posiłek kompletny, max 90 znaków>"
}`

  const text = await callClaude(prompt, 400)
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export async function assessDay(meals, date) {
  const mealsText = meals
    .map(m => `- ${m.type}: ${m.description}`)
    .join('\n')

  const prompt = `Jesteś dietetykiem dziecięcym. Oceń całodniową dietę 15-miesięcznego dziecka, które nie pije mleka modyfikowanego — wszystkie składniki odżywcze muszą pochodzić z posiłków (${date}).

Posiłki:
${mealsText}

Kluczowe składniki do oceny: żelazo, wapń, witamina D, witamina C, cynk, białko, kwasy omega-3, błonnik.

Napisz po polsku ocenę w 4-5 zdaniach: które składniki były dobrze pokryte, czego wyraźnie brakowało, i jedną konkretną wskazówkę na jutro. Bądź ciepły i pomocny jak przyjazny pediatra.`

  return await callClaude(prompt, 600)
}

export async function assessWeek(days) {
  const daysText = days
    .map(d => `- ${d.date}: ${d.meals.length} posiłków — ${d.meals.map(m => m.description).join(', ')}`)
    .join('\n')

  const prompt = `Jesteś dietetykiem dziecięcym. Oceń tygodniową dietę 15-miesięcznego dziecka, które nie pije mleka modyfikowanego.

Posiłki tygodnia:
${daysText}

Napisz po polsku podsumowanie w 4-6 zdaniach: oceń różnorodność i regularność, wskaż które składniki (żelazo, wapń, wit. D, wit. C, białko) były dobrze reprezentowane a których brakowało. Daj 2-3 konkretne wskazówki na następny tydzień. Bądź motywujący dla rodzica.`

  return await callClaude(prompt, 800)
}
