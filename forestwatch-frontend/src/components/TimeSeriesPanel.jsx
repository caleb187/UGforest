import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import InsightPanel from './InsightPanel'
import { analyzeForest } from '../api'

const RISK_COLORS = {
  LOW:      '#22c55e',
  MEDIUM:   '#f59e0b',
  HIGH:     '#f97316',
  CRITICAL: '#ef4444',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = RISK_COLORS[data.riskLevel] || '#22c55e';
    return (
      <div style={{
        background: 'rgba(10,30,12,0.95)',
        border: `1px solid ${color}50`,
        padding: '10px 14px',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
      }}>
        <p style={{ margin: 0, fontFamily: "'Space Mono', monospace", color: '#fff', fontSize: 13, fontWeight: 600 }}>{`Year: ${label}`}</p>
        <p style={{ margin: '4px 0 0 0', color: '#e2f5e8', fontSize: 12, fontWeight: 500 }}>
          {`NDVI: ${data.ndvi.toFixed(3)}`}
        </p>
        <p style={{ margin: '2px 0 0 0', color: '#9ca3af', fontSize: 11 }}>
          {`Risk: ${data.riskLevel}`}
        </p>
        <div style={{ marginTop: 8, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: '#22c55e' }}>🌲 Healthy: {data.healthy_pct}%</span>
          <span style={{ color: '#f59e0b' }}>⚠️ At Risk: {data.at_risk_pct}%</span>
          <span style={{ color: '#f97316' }}>📉 Degraded: {data.degraded_pct}%</span>
          <span style={{ color: '#ef4444' }}>❌ Cleared: {data.cleared_pct}%</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function TimeSeriesPanel({ lat, lng, startYear, endYear, radiusKm, onClose }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true;
    const fetchAllYears = async () => {
      setLoading(true)
      setData([])
      setError(null)
      
      const years = []
      const s = Math.min(startYear, endYear)
      const e = Math.max(startYear, endYear)
      for (let y = s; y <= e; y++) {
        years.push(y)
      }

      const results = []
      for (const y of years) {
         if (!active) return;
         try {
           const res = await analyzeForest(lat, lng, y, radiusKm)
           results.push({
             year: y,
             ndvi: res.stats.ndvi_mean,
             riskLevel: res.alert.level,
             healthy_pct: res.stats.healthy_pct,
             at_risk_pct: res.stats.at_risk_pct,
             degraded_pct: res.stats.degraded_pct,
             cleared_pct: res.stats.cleared_pct,
             stats: res.stats,
             alert: res.alert
           })
           setData([...results]) // Update chart progressively
         } catch (err) {
           setError(`Failed to fetch data for ${y}`)
           setLoading(false)
           return;
         }
      }
      setLoading(false)
    }

    fetchAllYears()
    return () => { active = false }
  }, [lat, lng, startYear, endYear, radiusKm])

  // Build the time series insight data using exact InsightRequest schema shape
  let trendInsightData = null;
  if (data.length > 0 && !loading) {
    const latest = data[data.length - 1]; // Use the most recent year's data for base schema
    trendInsightData = {
      lat, lng, 
      year: latest.year,
      location_name: "Time Series Area",
      healthy_pct: latest.healthy_pct,
      at_risk_pct: latest.at_risk_pct,
      degraded_pct: latest.degraded_pct,
      cleared_pct: latest.cleared_pct,
      total_area_ha: latest.stats.total_area_ha,
      ndvi_mean: latest.ndvi,
      alert_level: latest.riskLevel,
      risk_score: latest.alert.score,
      time_series: data.map(d => ({ year: d.year, ndvi: d.ndvi, risk: d.riskLevel, healthy_pct: d.healthy_pct, at_risk_pct: d.at_risk_pct, degraded_pct: d.degraded_pct, cleared_pct: d.cleared_pct })),
      trend_analysis_request: true 
    };
  }

  return (
    <>
      <style>{`
        .ts-panel-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .ts-panel-scroll::-webkit-scrollbar-track {
          background: rgba(10,30,12,0.5);
          border-radius: 8px;
        }
        .ts-panel-scroll::-webkit-scrollbar-thumb {
          background: rgba(34,197,94,0.3);
          border-radius: 8px;
        }
        .ts-panel-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(34,197,94,0.6);
        }
      `}</style>
      <div className="ts-panel-scroll" style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: 700,
        background: 'linear-gradient(180deg, rgba(6,13,7,0.98) 0%, rgba(10,30,12,0.95) 100%)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 16,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        zIndex: 2000,
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(34,197,94,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'linear-gradient(180deg, rgba(6,13,7,1) 0%, rgba(8,21,10,0.98) 100%)',
          borderTopLeftRadius: 15,
          borderTopRightRadius: 15,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600, color: '#22c55e', letterSpacing: 1 }}>
                NDVI TIME SERIES
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                {Math.min(startYear, endYear)} - {Math.max(startYear, endYear)}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: 16,
            width: 28, height: 28,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }} onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
             onMouseOut={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Chart Area */}
          <div style={{ height: 200, width: '100%', position: 'relative' }}>
             {loading && data.length === 0 ? (
               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontFamily: "'Space Mono'", fontSize: 11, letterSpacing: 1, animation: 'pulse 1.5s infinite'}}>
                  ⏳ FETCHING HISTORICAL DATA...
               </div>
             ) : error ? (
               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 12 }}>
                  ⚠️ {error}
               </div>
             ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis 
                  dataKey="year" 
                  stroke="#4b5563" 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: "'Space Mono'" }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  yAxisId="ndvi"
                  orientation="right"
                  domain={['dataMin - 0.05', 'dataMax + 0.05']} 
                  stroke="#4b5563"
                  tick={{ fill: '#e2f5e8', fontSize: 10, fontFamily: "'Space Mono'" }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="left"
                  domain={[0, 100]}
                  stroke="#4b5563"
                  tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: "'Space Mono'" }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                   verticalAlign="bottom" 
                   height={36} 
                   iconType="circle"
                   wrapperStyle={{ fontSize: 11, fontFamily: "'Inter', sans-serif" }}
                   payload={[
                     { value: '🌲 Healthy', type: 'circle', id: 'healthy_pct', color: '#22c55e' },
                     { value: '⚠️ At Risk', type: 'circle', id: 'at_risk_pct', color: '#f59e0b' },
                     { value: '📉 Degraded', type: 'circle', id: 'degraded_pct', color: '#f97316' },
                     { value: '❌ Cleared', type: 'circle', id: 'cleared_pct', color: '#ef4444' },
                     { value: 'NDVI Mean (Right Axis)', type: 'line', id: 'ndvi', color: '#e2f5e8' },
                   ]}
                />
                <Line 
                  yAxisId="ndvi"
                  type="monotone" 
                  dataKey="ndvi" 
                  stroke="#e2f5e8" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#0a1e0c', stroke: '#e2f5e8' }}
                  activeDot={{ r: 6, fill: '#e2f5e8', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1500}
                />
                <Line yAxisId="pct" type="monotone" dataKey="healthy_pct" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} animationDuration={1500} />
                <Line yAxisId="pct" type="monotone" dataKey="at_risk_pct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} animationDuration={1500} />
                <Line yAxisId="pct" type="monotone" dataKey="degraded_pct" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} animationDuration={1500} />
                <Line yAxisId="pct" type="monotone" dataKey="cleared_pct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} animationDuration={1500} />
              </LineChart>

            </ResponsiveContainer>
           )}
           
           {/* Progress state when partially loaded */}
           {loading && data.length > 0 && (
              <div style={{ position: 'absolute', top: 10, right: 10, color: '#4ade80', fontSize: 10, fontFamily: "'Space Mono'" }}>
                 ⏳ Loading {data.length} / {Math.abs(endYear - startYear) + 1}
              </div>
           )}
        </div>

        {/* AI Insight Section */}
        {!loading && data.length > 0 && (
           <InsightPanel analysisData={trendInsightData} label="Trend Analysis" />
        )}

      </div>
      </div>
    </>
  )
}
