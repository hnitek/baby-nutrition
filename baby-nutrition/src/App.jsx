import React, { useState, useEffect, useCallback } from 'react'
import { analyzeMeal, assessDay, assessWeek } from './api.js'
import { fetchAllMeals, dbInsert, dbUpdate, dbDelete, fetchAssessment, saveAssessment } from './db.js'

const SUPABASE_ENABLED = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
)

const MEAL_TYPES = ['Śniadanie', 'II Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja']

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function weekKey() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return `week-${d.toISOString().slice(0, 10)}`
}

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem('baby-nutrition-data') || '{}')
  } catch {
    return {}
  }
}

function saveStorage(data) {
  localStorage.setItem('baby-nutrition-data', JSON.stringify(data))
}

function rowsToData(rows) {
  const d = {}
  rows.forEach(row => {
    if (!d[row.date]) d[row.date] = { meals: [] }
    d[row.date].meals.push({
      id: row.id,
      type: row.meal_type,
      description: row.description,
      time: row.meal_time,
      nutrients: row.nutrients,
    })
  })
  Object.values(d).forEach(day => day.meals.sort((a, b) => a.id - b.id))
  return d
}

function NutrientsDisplay({ n }) {
  if (!n) return <div style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>⏳ Analizowanie...</div>

  // New qualitative format
  if (n.ocena) {
    return (
      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5, marginBottom: '6px' }}>
          {n.ocena}
        </div>
        {n.skladniki?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '4px' }}>
            {n.skladniki.map((s, i) => (
              <span key={i} style={{
                background: '#f0fdf4', color: '#065f46',
                borderRadius: '8px', padding: '2px 8px', fontSize: '12px', fontWeight: 600,
              }}>✓ {s}</span>
            ))}
          </div>
        )}
        {n.wskazowka && (
          <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', marginTop: '4px' }}>
            💡 {n.wskazowka}
          </div>
        )}
      </div>
    )
  }

  // Legacy numeric format (backward compat)
  return (
    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {[
        { k: 'kalorie', l: 'kcal' },
        { k: 'bialko', l: 'g białka' },
        { k: 'zelazo', l: 'mg Fe' },
        { k: 'wapn', l: 'mg Ca' },
        { k: 'witD', l: 'mcg D' },
      ].map(({ k, l }) => n[k] != null && (
        <span key={k} style={{
          background: '#f0fdf4', color: '#065f46',
          borderRadius: '8px', padding: '2px 8px', fontSize: '12px', fontWeight: 600,
        }}>{n[k]} {l}</span>
      ))}
      {n.uwagi && (
        <span style={{ width: '100%', fontSize: '12px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
          💡 {n.uwagi}
        </span>
      )}
    </div>
  )
}

function MealCard({ meal, onDelete, onSave }) {
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(meal.description)
  const [editType, setEditType] = useState(meal.type)

  function startEdit() {
    setEditDesc(meal.description)
    setEditType(meal.type)
    setEditing(true)
  }

  function cancelEdit() { setEditing(false) }

  function save() {
    if (!editDesc.trim()) return
    onSave(editDesc.trim(), editType)
    setEditing(false)
  }

  const iconBtn = (onClick, title, children) => (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#9ca3af', fontSize: '16px', lineHeight: 1, padding: '0 3px',
      transition: 'color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.color = '#6b7280'}
      onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
    >{children}</button>
  )

  return (
    <div style={{
      background: editing ? '#fff7ed' : '#fffbf5',
      border: `1px solid ${editing ? '#fb923c' : '#fde68a'}`,
      borderRadius: '14px',
      padding: '14px 16px',
      marginBottom: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      {editing ? (
        <>
          <textarea
            autoFocus
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) save() }}
            style={{
              width: '100%', minHeight: '70px',
              border: '2px solid #fb923c', borderRadius: '10px',
              padding: '10px', fontSize: '14px',
              fontFamily: "'Nunito', sans-serif",
              outline: 'none', resize: 'vertical',
              boxSizing: 'border-box', background: '#fff',
            }}
          />
          <select
            value={editType}
            onChange={e => setEditType(e.target.value)}
            style={{
              width: '100%', marginTop: '8px',
              border: '2px solid #fb923c', borderRadius: '10px',
              padding: '8px 10px', fontSize: '14px',
              fontFamily: "'Nunito', sans-serif",
              background: '#fff', outline: 'none',
              boxSizing: 'border-box', cursor: 'pointer',
            }}
          >
            {MEAL_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={save}
              disabled={!editDesc.trim()}
              style={{
                flex: 1, padding: '9px', border: 'none', borderRadius: '10px',
                background: editDesc.trim() ? 'linear-gradient(135deg,#f97316,#fb923c)' : '#e5e7eb',
                color: editDesc.trim() ? '#fff' : '#9ca3af',
                fontWeight: 800, fontSize: '14px',
                fontFamily: "'Nunito', sans-serif", cursor: editDesc.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              💾 Zapisz i przelicz
            </button>
            <button
              onClick={cancelEdit}
              style={{
                padding: '9px 14px', border: '2px solid #e5e7eb', borderRadius: '10px',
                background: '#fff', color: '#6b7280', fontWeight: 700, fontSize: '14px',
                fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
              <span style={{
                background: '#fef3c7', color: '#92400e',
                borderRadius: '8px', padding: '2px 8px',
                fontSize: '12px', fontWeight: 700, marginRight: '8px',
              }}>{meal.type}</span>
              <span style={{ fontSize: '14px', color: '#374151', fontWeight: 600 }}>{meal.description}</span>
            </div>
            <div style={{ display: 'flex', flexShrink: 0 }}>
              {iconBtn(startEdit, 'Edytuj posiłek', '✏️')}
              {meal.nutrients && iconBtn(() => onSave(meal.description, meal.type), 'Przelicz ponownie', '🔄')}
              {iconBtn(onDelete, 'Usuń posiłek', '×')}
            </div>
          </div>
          <NutrientsDisplay n={meal.nutrients} />
        </>
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('today')
  const [data, setData] = useState(loadStorage)
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState('Śniadanie')
  const [loading, setLoading] = useState(false)
  const [assessLoading, setAssessLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState('idle')

  const today = todayKey()
  const todayMeals = data[today]?.meals || []

  const [dayAssessment, setDayAssessment] = useState(
    () => (!SUPABASE_ENABLED ? localStorage.getItem(`baby-nutrition-day-${todayKey()}`) : '') || ''
  )
  const [weekAssessment, setWeekAssessment] = useState('')

  useEffect(() => { saveStorage(data) }, [data])

  useEffect(() => {
    async function sync() {
      if (!SUPABASE_ENABLED) return
      setSyncStatus('syncing')
      try {
        const [rows, dayText, weekText] = await Promise.all([
          fetchAllMeals(),
          fetchAssessment(`day-${todayKey()}`),
          fetchAssessment(weekKey()),
        ])
        const remote = rowsToData(rows)
        setData(remote)
        saveStorage(remote)
        if (dayText) setDayAssessment(dayText)
        if (weekText) setWeekAssessment(weekText)
        setSyncStatus('idle')
      } catch {
        setSyncStatus('error')
      }
    }
    sync()
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  function copyMeals() {
    const lines = todayMeals.map(m => `${m.type}: ${m.description}`).join('\n')
    navigator.clipboard?.writeText(lines)
  }

  async function addMeal() {
    if (!description.trim()) return
    const meal = {
      id: Date.now(),
      type: mealType,
      description: description.trim(),
      time: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      nutrients: null,
    }
    setData(prev => ({
      ...prev,
      [today]: { meals: [...(prev[today]?.meals || []), meal] },
    }))
    setDescription('')
    setLoading(true)
    if (SUPABASE_ENABLED) {
      try { await dbInsert(meal, today) } catch {}
    }
    try {
      const nutrients = await analyzeMeal(meal.description, meal.type)
      setData(prev => ({
        ...prev,
        [today]: {
          meals: (prev[today]?.meals || []).map(m =>
            m.id === meal.id ? { ...m, nutrients } : m
          ),
        },
      }))
      if (SUPABASE_ENABLED) {
        try { await dbUpdate(meal.id, { nutrients }) } catch {}
      }
    } finally {
      setLoading(false)
    }
  }

  function deleteMeal(dateKey, id) {
    setData(prev => ({
      ...prev,
      [dateKey]: { meals: (prev[dateKey]?.meals || []).filter(m => m.id !== id) },
    }))
    if (SUPABASE_ENABLED) {
      dbDelete(id).catch(() => {})
    }
  }

  async function updateMeal(dateKey, id, newDescription, newType) {
    setData(prev => ({
      ...prev,
      [dateKey]: {
        meals: (prev[dateKey]?.meals || []).map(m =>
          m.id === id ? { ...m, description: newDescription, type: newType, nutrients: null } : m
        ),
      },
    }))
    if (SUPABASE_ENABLED) {
      try { await dbUpdate(id, { description: newDescription, meal_type: newType, nutrients: null }) } catch {}
    }
    try {
      const nutrients = await analyzeMeal(newDescription, newType)
      setData(prev => ({
        ...prev,
        [dateKey]: {
          meals: (prev[dateKey]?.meals || []).map(m =>
            m.id === id ? { ...m, nutrients } : m
          ),
        },
      }))
      if (SUPABASE_ENABLED) {
        try { await dbUpdate(id, { nutrients }) } catch {}
      }
    } catch {}
  }

  async function handleAssessDay() {
    setAssessLoading(true)
    try {
      const text = await assessDay(todayMeals, today)
      setDayAssessment(text)
      if (SUPABASE_ENABLED) {
        saveAssessment(`day-${today}`, text).catch(() => {})
      } else {
        localStorage.setItem(`baby-nutrition-day-${today}`, text)
      }
    } finally {
      setAssessLoading(false)
    }
  }

  async function handleAssessWeek() {
    setAssessLoading(true)
    try {
      const days = Object.entries(data)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 7)
        .map(([date, val]) => ({ date, meals: val.meals || [] }))
      const text = await assessWeek(days)
      setWeekAssessment(text)
      if (SUPABASE_ENABLED) {
        saveAssessment(weekKey(), text).catch(() => {})
      }
    } finally {
      setAssessLoading(false)
    }
  }

  const styles = {
    root: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fef9f0 0%, #fdf0e8 100%)',
      fontFamily: "'Nunito', sans-serif",
      padding: '0 0 40px 0',
    },
    header: {
      background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
      color: '#fff',
      padding: '24px 20px 20px',
      textAlign: 'center',
    },
    h1: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '26px',
      fontWeight: 700,
      margin: 0,
      letterSpacing: '-0.5px',
    },
    subtitle: { fontSize: '14px', opacity: 0.85, marginTop: '4px' },
    tabs: {
      display: 'flex',
      background: '#fff',
      borderBottom: '2px solid #fed7aa',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    tab: (active) => ({
      flex: 1,
      padding: '14px 8px',
      border: 'none',
      background: active ? '#fff7ed' : '#fff',
      color: active ? '#f97316' : '#9ca3af',
      fontFamily: "'Nunito', sans-serif",
      fontWeight: active ? 800 : 600,
      fontSize: '14px',
      cursor: 'pointer',
      borderBottom: active ? '2px solid #f97316' : '2px solid transparent',
      marginBottom: '-2px',
      transition: 'all 0.2s',
    }),
    container: { maxWidth: '600px', margin: '0 auto', padding: '20px 16px' },
    card: {
      background: '#fff',
      borderRadius: '18px',
      padding: '20px',
      marginBottom: '18px',
      boxShadow: '0 2px 12px rgba(249,115,22,0.08)',
      border: '1px solid #fde68a',
    },
    label: { display: 'block', fontWeight: 700, color: '#374151', marginBottom: '8px', fontSize: '14px' },
    textarea: {
      width: '100%',
      minHeight: '80px',
      border: '2px solid #fde68a',
      borderRadius: '12px',
      padding: '12px',
      fontSize: '15px',
      fontFamily: "'Nunito', sans-serif",
      outline: 'none',
      resize: 'vertical',
      boxSizing: 'border-box',
      background: '#fffbf5',
      color: '#1f2937',
    },
    select: {
      width: '100%',
      border: '2px solid #fde68a',
      borderRadius: '12px',
      padding: '10px 12px',
      fontSize: '15px',
      fontFamily: "'Nunito', sans-serif",
      background: '#fffbf5',
      color: '#1f2937',
      outline: 'none',
      cursor: 'pointer',
      marginTop: '10px',
      boxSizing: 'border-box',
    },
    btn: (color = '#f97316', disabled = false) => ({
      width: '100%',
      padding: '13px',
      background: disabled ? '#e5e7eb' : `linear-gradient(135deg, ${color}, ${color}dd)`,
      color: disabled ? '#9ca3af' : '#fff',
      border: 'none',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: 800,
      fontFamily: "'Nunito', sans-serif",
      cursor: disabled ? 'not-allowed' : 'pointer',
      marginTop: '12px',
      transition: 'opacity 0.2s',
    }),
    sectionTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '18px',
      color: '#92400e',
      fontWeight: 700,
      marginBottom: '14px',
    },
    assessBox: {
      background: '#f0fdf4',
      border: '1px solid #86efac',
      borderRadius: '12px',
      padding: '14px',
      fontSize: '14px',
      lineHeight: 1.7,
      color: '#166534',
      marginTop: '12px',
      whiteSpace: 'pre-wrap',
    },
    historyDay: {
      background: '#fff',
      borderRadius: '14px',
      padding: '14px 16px',
      marginBottom: '12px',
      border: '1px solid #fde68a',
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    },
    emptyState: {
      textAlign: 'center',
      color: '#9ca3af',
      padding: '40px 20px',
      fontSize: '15px',
    },
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h1 style={styles.h1}>🍼 Dzienniczek żywieniowy</h1>
        <div style={styles.subtitle}>
          dla 15-miesięcznej córeczki
          {SUPABASE_ENABLED && syncStatus === 'syncing' && <span style={{ opacity: 0.7 }}> · synchronizuje…</span>}
          {SUPABASE_ENABLED && syncStatus === 'error' && <span> · ⚠️ offline</span>}
        </div>
      </div>

      <div style={styles.tabs}>
        {[['today', '📅 Dziś'], ['week', '📊 Tydzień'], ['history', '📚 Historia']].map(([id, label]) => (
          <button key={id} style={styles.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div style={styles.container}>

        {/* ─── TAB: DZIŚ ─── */}
        {tab === 'today' && (
          <>
            <div style={styles.card}>
              <div style={styles.sectionTitle}>Dodaj posiłek</div>
              <label style={styles.label}>Opis posiłku</label>
              <textarea
                style={styles.textarea}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='np. "owsianka z mlekiem i bananem, zjedzone prawie wszystko"'
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && addMeal()}
              />
              <select style={styles.select} value={mealType} onChange={e => setMealType(e.target.value)}>
                {MEAL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <button
                style={styles.btn('#f97316', loading || !description.trim())}
                onClick={addMeal}
                disabled={loading || !description.trim()}
              >
                {loading ? '⏳ Analizuję...' : '+ Dodaj i analizuj'}
              </button>
            </div>

            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ ...styles.sectionTitle, marginBottom: 0 }}>Posiłki — {today}</div>
                {todayMeals.length > 0 && (
                  <button onClick={copyMeals} style={{
                    background: 'none', border: '1.5px solid #fed7aa', borderRadius: '10px',
                    padding: '5px 10px', fontSize: '13px', fontWeight: 700,
                    color: '#c2410c', cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
                  }}>📋 Kopiuj</button>
                )}
              </div>
              {todayMeals.length === 0 ? (
                <div style={styles.emptyState}>
                  🌱 Brak posiłków. Dodaj pierwszy posiłek córeczki!
                </div>
              ) : (
                todayMeals.map(meal => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onDelete={() => deleteMeal(today, meal.id)}
                    onSave={(desc, type) => updateMeal(today, meal.id, desc, type)}
                  />
                ))
              )}
              {todayMeals.length > 0 && (
                <>
                  <button
                    style={styles.btn('#059669', assessLoading)}
                    onClick={handleAssessDay}
                    disabled={assessLoading}
                  >
                    {assessLoading ? '⏳ Oceniam...' : '🩺 Oceń całodniową dietę'}
                  </button>
                  {dayAssessment && <div style={styles.assessBox}>{dayAssessment}</div>}
                </>
              )}
            </div>
          </>
        )}

        {/* ─── TAB: TYDZIEŃ ─── */}
        {tab === 'week' && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Podsumowanie tygodnia</div>
            {Object.entries(data).length === 0 ? (
              <div style={styles.emptyState}>📭 Brak danych. Zacznij śledzić dietę w zakładce "Dziś".</div>
            ) : (
              <>
                {Object.entries(data)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 7)
                  .map(([date, val]) => {
                    const meals = val.meals || []
                    return (
                      <div key={date} style={styles.historyDay}>
                        <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                          📅 {date}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>
                          {meals.length} posiłków
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {meals.map(m => (
                            <span key={m.id} style={{
                              background: '#fff7ed', color: '#c2410c',
                              borderRadius: '6px', padding: '2px 7px', fontSize: '12px',
                            }}>{m.type}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                <button
                  style={styles.btn('#7c3aed', assessLoading)}
                  onClick={handleAssessWeek}
                  disabled={assessLoading}
                >
                  {assessLoading ? '⏳ Analizuję...' : '📊 Podsumowanie tygodniowe AI'}
                </button>
                {weekAssessment && <div style={styles.assessBox}>{weekAssessment}</div>}
              </>
            )}
          </div>
        )}

        {/* ─── TAB: HISTORIA ─── */}
        {tab === 'history' && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Historia posiłków</div>
            {Object.entries(data).length === 0 ? (
              <div style={styles.emptyState}>📭 Brak historii.</div>
            ) : (
              Object.entries(data)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, val]) => (
                  <div key={date} style={{ marginBottom: '20px' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: '#92400e', marginBottom: '8px', fontSize: '16px' }}>
                      📅 {date}
                    </div>
                    {(val.meals || []).map(meal => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        onDelete={() => deleteMeal(date, meal.id)}
                        onSave={(desc, type) => updateMeal(date, meal.id, desc, type)}
                      />
                    ))}
                    {(val.meals || []).length === 0 && (
                      <div style={{ color: '#9ca3af', fontSize: '13px' }}>Brak posiłków</div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

      </div>
    </div>
  )
}
