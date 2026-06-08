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

export async function analyzeMeal(description, mealType, context = '') {
  const contextLine = context ? `\nKontekst o dziecku: ${context}` : ''
  const prompt = `Jesteś życzliwym dietetykiem dziecięcym. Oceń posiłek dla 15-miesięcznego dziecka, które nie pije już mleka modyfikowanego.${contextLine}

Posiłek (${mealType}): "${description}"

Zwróć TYLKO obiekt JSON (bez markdown, bez komentarzy):
{
  "ocena": "<1-2 zdania — zacznij od pozytywów, ton spokojny i motywujący, bez alarmowania, po polsku>",
  "skladniki": ["<TYLKO nazwy składników odżywczych realnie obecnych w posiłku, np.: białko, żelazo, wapń, witamina C, witamina D, cynk, kwasy omega-3, błonnik — nie wpisuj nazw produktów ani ilości, uwzględnij kontekst>"],
  "wskazowka": "<krótka pozytywna sugestia co można dodać przy kolejnym posiłku, lub null, max 90 znaków>"
}`

  const text = await callClaude(prompt, 400)
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export async function assessDay(meals, date, context = '') {
  const mealsText = meals
    .map(m => `- ${m.type}: ${m.description}`)
    .join('\n')
  const contextLine = context ? `\nKontekst: ${context}` : ''

  const prompt = `Jesteś życzliwym dietetykiem dziecięcym. Oceń całodniową dietę 15-miesięcznego dziecka, które nie pije mleka modyfikowanego (${date}).${contextLine}

Posiłki:
${mealsText}

Napisz po polsku ocenę w 4-5 zdaniach. Zacznij od tego co dziś poszło dobrze. Wspomnij co można uzupełnić jutro — spokojnie i konkretnie, bez alarmowania. Bądź ciepły jak przyjazny pediatra, który docenia wysiłek rodziców.

Ważne: pisz zwykłym tekstem, bez formatowania markdown (bez gwiazdek, bez nagłówków, bez myślników na początku linii).`

  return await callClaude(prompt, 600)
}

export async function assessWeek(days, context = '') {
  const daysText = days
    .map(d => `- ${d.date}: ${d.meals.length} posiłków — ${d.meals.map(m => m.description).join(', ')}`)
    .join('\n')
  const contextLine = context ? `\nKontekst: ${context}` : ''

  const prompt = `Jesteś życzliwym dietetykiem dziecięcym. Oceń tygodniową dietę 15-miesięcznego dziecka, które nie pije mleka modyfikowanego.${contextLine}

Posiłki tygodnia:
${daysText}

Napisz po polsku podsumowanie w 4-6 zdaniach. Zacznij od tego co rodzice robią dobrze w tym tygodniu. Oceń różnorodność. Zasugeruj 1-2 rzeczy na następny tydzień — spokojnie i konkretnie. Bądź motywujący.

Ważne: pisz zwykłym tekstem, bez formatowania markdown (bez gwiazdek, bez nagłówków, bez myślników na początku linii).`

  return await callClaude(prompt, 800)
}
