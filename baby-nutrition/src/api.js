const WORKER_URL = import.meta.env.VITE_WORKER_URL

async function callClaude(message, max_tokens = 1024) {
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, max_tokens }),
  })
  if (!response.ok) {
    throw new Error(`Worker error: ${response.status}`)
  }
  const data = await response.json()
  return data.text
}

export async function analyzeMeal(description, mealType) {
  const prompt = `Jesteś ekspertem ds. żywienia dzieci. Przeanalizuj posiłek dla 15-miesięcznego dziecka.

Posiłek (${mealType}): "${description}"

Zwróć TYLKO obiekt JSON (bez markdown, bez komentarzy) w tym formacie:
{
  "kalorie": <liczba kcal>,
  "bialko": <gramy>,
  "tluszcze": <gramy>,
  "weglowodany": <gramy>,
  "zelazo": <mg>,
  "wapn": <mg>,
  "witD": <mcg>,
  "witC": <mg>,
  "cynk": <mg>,
  "blonnik": <gramy>,
  "uwagi": "<krótka uwaga po polsku, max 100 znaków>"
}`

  const text = await callClaude(prompt, 512)
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export async function assessDay(meals, date) {
  const mealsText = meals
    .map(m => `- ${m.type}: ${m.description} (${m.nutrients?.kalorie ?? '?'} kcal)`)
    .join('\n')

  const prompt = `Jesteś ekspertem ds. żywienia dzieci. Oceń całodniową dietę 15-miesięcznego dziecka (${date}).

Posiłki:
${mealsText}

Normy dzienne dla 15-miesiecznika:
- Kalorie: 1000-1300 kcal
- Białko: 13-16 g
- Żelazo: 7 mg
- Wapń: 700 mg
- Witamina D: 15 mcg

Napisz po polsku ocenę diety w 3-5 zdaniach. Wskaż co było dobre, czego brakowało i jak to poprawić. Bądź ciepły i pomocny jak przyjazny pediatra.`

  return await callClaude(prompt, 600)
}

export async function assessWeek(days) {
  const daysText = days
    .map(d => {
      const total = d.meals.reduce((s, m) => s + (m.nutrients?.kalorie ?? 0), 0)
      return `- ${d.date}: ${d.meals.length} posiłków, ~${total} kcal`
    })
    .join('\n')

  const prompt = `Jesteś ekspertem ds. żywienia dzieci. Oceń tygodniową dietę 15-miesięcznego dziecka.

Podsumowanie tygodnia:
${daysText}

Napisz po polsku podsumowanie tygodniowe w 4-6 zdaniach. Oceń regularność posiłków, kaloryczność, różnorodność. Daj 2-3 konkretne wskazówki na następny tydzień. Bądź motywujący dla rodzica.`

  return await callClaude(prompt, 800)
}
