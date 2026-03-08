const COLORS = {
  LOW:      { 
    bg: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.08) 100%)',
    border: '#22c55e',
    text: '#22c55e'
  },
  MEDIUM:   { 
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.08) 100%)',
    border: '#f59e0b',
    text: '#f59e0b'
  },
  HIGH:     { 
    bg: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.08) 100%)',
    border: '#f97316',
    text: '#f97316'
  },
  CRITICAL: { 
    bg: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)',
    border: '#ef4444',
    text: '#ef4444'
  },
}

export default function AlertBadge({ level, score, message, large }) {
  const c = COLORS[level] || COLORS.LOW

  return (
    <div style={{
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      borderRadius: large ? 14 : 10,
      padding: large ? '18px 22px' : '10px 14px',
      animation: 'fadeUp 0.3s ease',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: message ? 8 : 0
      }}>
        {/* Pulsing dot for critical */}
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: c.border,
          animation: level === 'CRITICAL' ? 'pulse 1.2s infinite' : 'none',
          boxShadow: `0 0 8px ${c.border}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: large ? 13 : 11,
          fontWeight: 700,
          color: c.text,
          letterSpacing: 0.5,
        }}>
          {level}  ·  {score}/100
        </span>
      </div>
      {message && (
        <p style={{
          fontSize: large ? 13 : 12,
          color: '#9ca3af',
          lineHeight: 1.6,
          margin: 0,
          fontWeight: 500
        }}>
          {message}
        </p>
      )}
    </div>
  )
}