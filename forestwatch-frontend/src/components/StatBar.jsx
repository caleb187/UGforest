export default function StatBar({ label, pct, color, icon }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 12,
          color: '#d1fae5',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{icon}</span>
          {label}
        </span>
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          color,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}>
          {pct}%
        </span>
      </div>
      <div style={{
        height: 7,
        background: 'rgba(34,197,94,0.08)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          borderRadius: 4,
          boxShadow: `0 0 12px ${color}40`,
          transition: 'width 1s ease-out',
        }} />
      </div>
    </div>
  )
}
