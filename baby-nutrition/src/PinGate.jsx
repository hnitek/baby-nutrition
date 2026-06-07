import React, { useState } from 'react'

const CORRECT_PIN = import.meta.env.VITE_APP_PIN || '1234'

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', '⌫'],
]

export default function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState(false)
  const pinLen = CORRECT_PIN.length

  function press(key) {
    if (shake) return

    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      setError(false)
      return
    }

    const next = (pin + key).slice(0, pinLen)
    setPin(next)
    setError(false)

    if (next.length === pinLen) {
      if (next === CORRECT_PIN) {
        setTimeout(onUnlock, 150)
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => { setPin(''); setShake(false); setError(false) }, 700)
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fef9f0 0%, #fdf0e8 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif",
      padding: '24px',
      userSelect: 'none',
    }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-10px)}
          40%{transform:translateX(10px)}
          60%{transform:translateX(-7px)}
          80%{transform:translateX(7px)}
        }
        .pin-key:active { transform: scale(0.92); background: #fed7aa !important; }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ fontSize: '52px', marginBottom: '10px' }}>🍼</div>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '22px', fontWeight: 700, color: '#92400e',
        }}>Dzienniczek żywieniowy</div>
      </div>

      {/* Dots */}
      <div style={{
        display: 'flex',
        gap: '14px',
        marginBottom: '10px',
        animation: shake ? 'shake 0.6s ease' : 'none',
      }}>
        {Array.from({ length: pinLen }).map((_, i) => (
          <div key={i} style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: error ? '#ef4444' : i < pin.length ? '#f97316' : '#fde68a',
            transition: 'background 0.15s',
            boxShadow: i < pin.length ? '0 0 0 3px rgba(249,115,22,0.2)' : 'none',
          }} />
        ))}
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Nieprawidłowy PIN
        </div>
      )}
      {!error && <div style={{ height: '21px', marginBottom: '8px' }} />}

      {/* Numpad */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: '10px' }}>
            {row.map((key, ki) => (
              <button
                key={ki}
                className="pin-key"
                onClick={() => key && press(key)}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: 'none',
                  background: key ? '#fff' : 'transparent',
                  boxShadow: key ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
                  fontSize: key === '⌫' ? '22px' : '26px',
                  fontWeight: 700,
                  fontFamily: "'Nunito', sans-serif",
                  color: '#92400e',
                  cursor: key ? 'pointer' : 'default',
                  transition: 'transform 0.1s, background 0.1s',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
