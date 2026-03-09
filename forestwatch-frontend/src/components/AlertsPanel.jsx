import AlertBadge from './AlertBadge'

export default function AlertsPanel({ alerts, loading }) {
  if (loading) return (
    <div style={{
      padding: 32,
      textAlign: 'center',
      color: '#4b5563',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    }}>
      <div>
        <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }}>🔔</div>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          letterSpacing: 1,
          fontWeight: 600,
        }}>
          LOADING ALERTS...
        </div>
      </div>
    </div>
  )

  if (!alerts || alerts.length === 0) return (
    <div style={{
      padding: '28px 20px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 36, opacity: 0.4 }}>✅</div>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 12,
        color: '#22c55e',
        letterSpacing: 1,
        fontWeight: 600,
      }}>
        NO RECENT ALERTS
      </div>
      <div style={{
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 1.7,
        maxWidth: 280,
      }}>
        All monitored forests are stable. The system scans automatically every week.
      </div>
    </div>
  )

  function timeAgo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottom: '1px solid rgba(34,197,94,0.1)',
      }}>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
          color: '#4b5563',
          letterSpacing: 1.2,
          fontWeight: 600,
        }}>
          LAST 7 DAYS
        </div>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444',
          padding: '4px 10px',
          borderRadius: 12,
          fontWeight: 600,
          letterSpacing: 0.5,
        }}>
          {alerts.length} ALERT{alerts.length !== 1 ? 'S' : ''}
        </div>
      </div>

      {/* Alert cards */}
      {alerts.map((alert) => (
        <div key={alert.id} style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12,
          backdropFilter: 'blur(8px)',
          animation: 'fadeUp 0.4s ease',
        }}>
          {/* Forest name + time */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: '#e2f5e8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              🌲 {alert.forest_name}
            </div>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 9,
              color: '#6b7280',
              letterSpacing: 0.5,
            }}>
              {timeAgo(alert.detected_at)}
            </div>
          </div>

          {/* What changed */}
          <div style={{
            fontSize: 12,
            color: '#fca5a5',
            lineHeight: 1.7,
            marginBottom: 12,
            padding: '10px 12px',
            background: 'rgba(239,68,68,0.06)',
            borderRadius: 8,
            borderLeft: '3px solid rgba(239,68,68,0.4)',
          }}>
            {alert.message}
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 12,
          }}>
            <div style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 8,
                color: '#6b7280',
                letterSpacing: 1,
                marginBottom: 4,
              }}>HEALTHY COVER</div>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: '#ef4444',
              }}>
                {alert.healthy_pct_prev}% → {alert.healthy_pct_now}%
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 8,
                color: '#6b7280',
                letterSpacing: 1,
                marginBottom: 4,
              }}>RISK SCORE</div>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: '#f97316',
              }}>
                {alert.risk_score_prev} → {alert.risk_score_now}
              </div>
            </div>
          </div>

          {/* Alert badge */}
          <AlertBadge
            level={alert.alert_level}
            score={alert.risk_score}
            message={null}
          />
        </div>
      ))}
    </div>
  )
}
