export default function InsightPanel({ insight, loading }) {
  if (loading) return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#4b5563' }}>
        🤖 AI ANALYZING...
      </div>
    </div>
  )

  if (!insight) return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 8,
      fontSize: 11,
      color: '#fca5a5',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      fontFamily: "'Space Mono', monospace"
    }}>
      <span>⚠️</span>
      <span>AI Insights currently unavailable (Quota exceeded or API error). Check server logs.</span>
    </div>
  )

  return (
    <div className="fade-up" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 12, 
      marginTop: 16,
      maxHeight: '100%',
      overflow: 'auto',
      paddingRight: 8
    }}>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(34,197,94,0.1)' }} />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#4b5563', letterSpacing: 1 }}>
          🤖 AI INSIGHT
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(34,197,94,0.1)' }} />
      </div>

      {/* Summary */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(34,197,94,0.04)',
        border: '1px solid rgba(34,197,94,0.12)',
        borderRadius: 8,
        fontSize: 12,
        color: '#d1fae5',
        lineHeight: 1.7,
      }}>
        {insight.summary}
      </div>

      {/* Likely cause */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.15)',
        borderRadius: 8,
      }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#f59e0b', letterSpacing: 1, marginBottom: 4 }}>
          LIKELY CAUSE
        </div>
        <div style={{ fontSize: 12, color: '#fde68a' }}>
          {insight.likely_cause}
        </div>
      </div>

      {/* Recommended actions */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(34,197,94,0.1)',
        borderRadius: 8,
      }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#4b5563', letterSpacing: 1, marginBottom: 8 }}>
          RECOMMENDED ACTIONS
        </div>
        {insight.recommended_actions.map((action, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8,
            marginBottom: 6, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Space Mono', monospace",
              fontSize: 8, color: '#4ade80',
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
              {action}
            </span>
          </div>
        ))}
      </div>

      {/* Trend */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(239,68,68,0.04)',
        border: '1px solid rgba(239,68,68,0.1)',
        borderRadius: 8,
        borderLeft: '3px solid rgba(239,68,68,0.4)',
        fontSize: 12,
        color: '#9ca3af',
        lineHeight: 1.6,
      }}>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>Forecast: </span>
        {insight.trend_assessment}
      </div>
    </div>
  )
}