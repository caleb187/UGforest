import AlertBadge from './AlertBadge'
import StatBar   from './StatBar'

export default function ComparePanel({ data, loading }) {
  if (loading) return (
    <div style={{ padding: 24, textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 11,
        fontWeight: 600,
        color: '#22c55e',
        letterSpacing: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        ⏳ COMPARING YEARS...
      </div>
    </div>
  )

  if (!data) return null

  const lost   = data.forest_lost_pct
  const lostHa = data.forest_lost_ha

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary headline */}
      <div style={{
        padding: '18px 20px',
        background: lost > 0
          ? 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)'
          : 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.08) 100%)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${lost > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
        borderRadius: 10,
        boxShadow: `0 8px 32px ${lost > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 24,
          fontWeight: 800,
          background: lost > 0 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>
          {lost > 0 ? `▼ ${lost}%` : `▲ ${Math.abs(lost)}%`}
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, fontWeight: 500 }}>
          {lostHa > 0
            ? `📉 ${lostHa} hectares of forest lost between ${data.year_a} and ${data.year_b}`
            : `✅ Forest cover stable between ${data.year_a} and ${data.year_b}`
          }
        </div>
      </div>

      {/* Alert */}
      <AlertBadge
        level={data.alert.level}
        score={data.alert.score}
        message={data.alert.message}
        large
      />

      {/* Side by side year comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { year: data.year_a, stats: data.stats_a, label: 'BASELINE', emoji: '📍' },
          { year: data.year_b, stats: data.stats_b, label: 'CURRENT',  emoji: '📊' },
        ].map(({ year, stats, label, emoji }) => (
          <div key={year} style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              color: '#22c55e',
              letterSpacing: 1.2,
              marginBottom: 12,
              textTransform: 'uppercase',
            }}>
              {emoji} {label} · {year}
            </div>

            <StatBar label="Healthy"  pct={stats.healthy_pct}  color="#22c55e" icon="🌲" />
            <StatBar label="At Risk"  pct={stats.at_risk_pct}  color="#f59e0b" icon="⚠️" />
            <StatBar label="Degraded" pct={stats.degraded_pct} color="#f97316" icon="📉" />
            <StatBar label="Cleared"  pct={stats.cleared_pct}  color="#ef4444" icon="❌" />

            <div style={{
              marginTop: 12,
              fontSize: 11,
              color: '#9ca3af',
              borderTop: '1px solid rgba(34,197,94,0.1)',
              paddingTop: 8,
            }}>
              📊 Total: {stats.total_area_ha} ha
            </div>
          </div>
        ))}
      </div>

      {/* Change summary */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        border: '1px solid rgba(34,197,94,0.2)',
        fontSize: 13,
        color: '#cbd5e1',
        lineHeight: 1.7,
        fontWeight: 500,
        borderLeft: '4px solid rgba(34,197,94,0.4)',
        boxShadow: '0 8px 32px rgba(34,197,94,0.08)',
      }}>
        {data.change_summary}
      </div>

      {/* AI Insight */}
      {/* AI Analysis Section */}
      <div style={{
        marginTop: 20,
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 12,
        padding: 16,
        border: '1px solid rgba(148, 163, 184, 0.1)',
      }}>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          color: '#22c55e',
          letterSpacing: 1.2,
          marginBottom: 12,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          🤖 AI ANALYSIS
        </div>

        {!data.insight ? (
          <div style={{
            fontSize: 13, color: '#fca5a5', lineHeight: 1.6,
            padding: 12, background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            AI Insights currently unavailable (Quota exceeded or API error). Check server logs.
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 13, color: '#cbd5e1', lineHeight: 1.7,
              marginBottom: 12, fontWeight: 500,
              borderBottom: '1px solid rgba(34,197,94,0.1)', paddingBottom: 12,
            }}>
              {data.insight.summary}
            </div>

            {data.insight.likely_cause && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fca5a5', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚡ Likely Cause
                </div>
                <div style={{ fontSize: 12, color: '#d1fae5', lineHeight: 1.6 }}>
                  {data.insight.likely_cause}
                </div>
              </div>
            )}

            {data.insight.trend_assessment && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📈 Trend Assessment
                </div>
                <div style={{ fontSize: 12, color: '#d1fae5', lineHeight: 1.6 }}>
                  {data.insight.trend_assessment}
                </div>
              </div>
            )}

            {data.insight.recommended_actions?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#86efac', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ✓ Recommended Actions
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#d1fae5', lineHeight: 1.7 }}>
                  {data.insight.recommended_actions.map((action, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}