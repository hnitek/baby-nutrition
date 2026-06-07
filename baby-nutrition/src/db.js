import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function fetchAllMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function dbInsert(meal, dateKey) {
  const { error } = await supabase.from('meals').insert({
    id: meal.id,
    date: dateKey,
    meal_type: meal.type,
    description: meal.description,
    meal_time: meal.time,
    nutrients: meal.nutrients,
  })
  if (error) throw error
}

export async function dbUpdate(id, fields) {
  const { error } = await supabase.from('meals').update(fields).eq('id', id)
  if (error) throw error
}

export async function dbDelete(id) {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) throw error
}
