import { useState, useEffect } from 'react'
import Map          from './components/Map'
import StatsPanel   from './components/StatsPanel'
import ComparePanel from './components/ComparePanel'
import AlertBadge   from './components/AlertBadge'
import InsightPanel from './components/InsightPanel'
import AlertsPanel  from './components/AlertsPanel'
import TimeSeriesPanel from './components/TimeSeriesPanel'
import { analyzeForest, compareForest, getMapTiles, getLatestAlerts } from './api'

export default function App() {
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [compareResult, setCompareResult] = useState(null)
  const [tiles,         setTiles]         = useState(null)
  const [tilesLoading,  setTilesLoading]  = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [activeTab,     setActiveTab]     = useState('analyze')
  const [year,          setYear]          = useState(2024)
  const [yearA,         setYearA]         = useState("")
  const [yearB,         setYearB]         = useState("")
  const [radiusKm,      setRadiusKm]      = useState(5)
  const [error,         setError]         = useState(null)
  const [drawerOpen,    setDrawerOpen]    = useState(false)
  const [resultsOpen,   setResultsOpen]   = useState(false)
  const [alertsData,    setAlertsData]    = useState(null)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [showTimeSeries,setShowTimeSeries]= useState(false)

  const handleMapClick = (lat, lng) => {
    setSelectedPoint([lat, lng])
    setShowTimeSeries(false)
  }

  const alertLevel = analyzeResult?.alert?.level
                  || compareResult?.alert?.level

  useEffect(() => {
    if (!selectedPoint || activeTab === 'alerts') return
    
    // Prevent compare fetch if years are not selected
    if (activeTab === 'compare' && (yearA === "" || yearB === "")) {
      setError("Please select both years to compare.")
      setTiles(null)
      setAnalyzeResult(null)
      setCompareResult(null)
      setShowTimeSeries(false)
      return
    }

    const fetchData = async () => {

      const [lat, lng] = selectedPoint
      setError(null)
      setLoading(true)
      setTilesLoading(true)
      setTiles(null)
      // Clear previous results to trigger loading visual
      setAnalyzeResult(null)
      setCompareResult(null)

      const tileYearA = activeTab === 'analyze' ? year - 1 : yearA
      const tileYearB = activeTab === 'analyze' ? year     : yearB

      try {
        const [analysisResult] = await Promise.all([
          activeTab === 'analyze'
            ? analyzeForest(lat, lng, year, radiusKm)
            : compareForest(lat, lng, yearA, yearB, radiusKm),

          getMapTiles(lat, lng, tileYearA, tileYearB, radiusKm)
            .then(t => setTiles(t))
            .catch(() => {})
            .finally(() => setTilesLoading(false)),
        ])

        if (activeTab === 'analyze') setAnalyzeResult(analysisResult)
        else                          setCompareResult(analysisResult)

        setResultsOpen(true) // Pop out results when data arrives

      } catch {
        setError('Could not reach backend. Is it running on port 8000?')
        setTilesLoading(false)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedPoint, activeTab, year, yearA, yearB, radiusKm])

  // Fetch alerts when the alerts tab is selected
  useEffect(() => {
    if (activeTab !== 'alerts') return
    setAlertsLoading(true)
    setResultsOpen(true)
    getLatestAlerts()
      .then(data => setAlertsData(data.alerts))
      .catch(() => setError('Could not load alerts. Is the backend running?'))
      .finally(() => setAlertsLoading(false))
  }, [activeTab])


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(34,197,94,0.1)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(6,13,7,0.98) 0%, rgba(10,30,12,0.95) 100%)',
        flexShrink: 0,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: 28,
            filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.3))'
          }}>🛰️</div>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 20,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}>
              ForestWatch<span style={{ color: '#4ade80' }}>AI</span>
            </div>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 8.5,
              color: '#4b5563',
              letterSpacing: 2.5,
              marginTop: '2px',
              fontWeight: 500
            }}>
              UGANDA FOREST INTELLIGENCE
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(249,115,22,0.1) 100%)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 20,
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ef4444',
            animation: 'pulse 1.5s infinite',
            boxShadow: '0 0 8px rgba(239,68,68,0.6)'
          }} />
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 9,
            color: '#ef4444',
            letterSpacing: 1,
            fontWeight: 600
          }}>LIVE</span>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Drawer Toggle Button */}
        <button 
          onClick={() => setDrawerOpen(!drawerOpen)}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1000,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: drawerOpen ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
            border: drawerOpen ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(34,197,94,0.4)',
            color: drawerOpen ? '#ef4444' : '#22c55e',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}>
          {drawerOpen ? '✕' : '☰'}
        </button>

        {/* Drawer Overlay */}
        {drawerOpen && (
          <div 
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 999,
              animation: 'fadeIn 0.3s ease'
            }}
          />
        )}

        {/* Sidebar Drawer */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 340,
          borderRight: '1px solid rgba(34,197,94,0.1)',
          background: 'linear-gradient(180deg, rgba(6,13,7,0.98) 0%, rgba(10,30,12,0.95) 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: 'blur(5px)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          zIndex: 1000,
          boxShadow: drawerOpen ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(34,197,94,0.08)', padding: '8px 0' }}>
            {[['analyze', '🔍 Analyze'], ['compare', '📊 Compare'], ['alerts', '🔔 Alerts']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: activeTab === key ? 'rgba(34,197,94,0.1)' : 'transparent',
                borderBottom: activeTab === key ? '2px solid #4ade80' : '2px solid transparent',
                color: activeTab === key ? '#4ade80' : '#4b5563',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: activeTab === key ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}>{label}</button>
            ))}
          </div>

          {/* Controls — hidden on alerts tab */}
          {activeTab !== 'alerts' && (
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(34,197,94,0.08)' }}>
            {activeTab === 'analyze' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{
                  fontSize: 11,
                  color: '#4b5563',
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: 1,
                  fontWeight: 600
                }}>
                  YEAR — <span style={{ color: '#22c55e', fontWeight: 700 }}>{year}</span>
                  <select value={year} onChange={e => setYear(+e.target.value)} style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 6,
                    background: 'rgba(34,197,94,0.12)',
                    border: '1.5px solid rgba(34,197,94,0.3)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    color: '#e2f5e8',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                    optionColor: '#000',
                  }}>
                    {Array.from({length: 24}, (_, i) => 2003 + i).reverse().map(y =>
                      <option key={y} value={y} style={{ color: '#000', background: '#fff' }}>{y}</option>
                    )}
                  </select>
                </label>
                <label style={{
                  fontSize: 11,
                  color: '#4b5563',
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: 1,
                  fontWeight: 600
                }}>
                  RADIUS — <span style={{ color: '#22c55e', fontWeight: 700 }}>{radiusKm}</span> km
                  <input type="range" min={2} max={20} value={radiusKm}
                    onChange={e => setRadiusKm(+e.target.value)}
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 8,
                      accentColor: '#22c55e',
                      cursor: 'pointer'
                    }}
                  />
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[['BASELINE YEAR', yearA, setYearA], ['COMPARE YEAR', yearB, setYearB]].map(([lbl, val, setter]) => (
                  <label key={lbl} style={{
                    fontSize: 11,
                    color: '#4b5563',
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: 1,
                    fontWeight: 600
                  }}>
                    {lbl} — <span style={{ color: '#22c55e', fontWeight: 700 }}>{val}</span>
                    <select value={val} onChange={e => setter(e.target.value === "" ? "" : +e.target.value)} style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 6,
                      background: 'rgba(34,197,94,0.12)',
                      border: '1.5px solid rgba(34,197,94,0.3)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: '#e2f5e8',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}>
                      <option value="" disabled>Select year</option>
                      {Array.from({length: 24}, (_, i) => 2003 + i).reverse().map(y =>
                        <option key={y} value={y} style={{ color: '#000', background: '#fff' }}>{y}</option>
                      )}
                    </select>
                  </label>
                ))}
                <label style={{
                  fontSize: 11,
                  color: '#4b5563',
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: 1,
                  fontWeight: 600
                }}>
                  RADIUS — <span style={{ color: '#22c55e', fontWeight: 700 }}>{radiusKm}</span> km
                  <input type="range" min={2} max={20} value={radiusKm}
                    onChange={e => setRadiusKm(+e.target.value)}
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 8,
                      accentColor: '#22c55e',
                      cursor: 'pointer'
                    }}
                  />
                </label>
                
                <button
                  onClick={() => setShowTimeSeries(true)}
                  disabled={!selectedPoint || yearA === "" || yearB === ""}
                  style={{
                    marginTop: 8,
                    padding: '12px',
                    background: (!selectedPoint || yearA === "" || yearB === "") ? 'rgba(34,197,94,0.05)' : 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(22,163,74,0.15) 100%)',
                    border: `1px solid ${(!selectedPoint || yearA === "" || yearB === "") ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.4)'}`,
                    borderRadius: 8,
                    color: (!selectedPoint || yearA === "" || yearB === "") ? '#4b5563' : '#4ade80',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: (!selectedPoint || yearA === "" || yearB === "") ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  📈 View Time Series
                </button>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Secondary Drawer: Results Panel (Spawns to the right of the Control Drawer) */}
        <div style={{
          position: 'absolute',
          left: drawerOpen ? 340 : 0, 
          top: 0,
          bottom: 0,
          width: 420,
          background: 'linear-gradient(180deg, rgba(6,13,7,0.95) 0%, rgba(10,30,12,0.92) 100%)',
          borderRight: '1px solid rgba(34,197,94,0.2)',
          display: 'flex',
          flexDirection: 'column',
          transform: resultsOpen && (selectedPoint || loading || activeTab === 'alerts') ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 998, // Just behind main drawer
          backdropFilter: 'blur(10px)',
          boxShadow: resultsOpen ? '8px 0 32px rgba(0,0,0,0.5)' : 'none',
        }}>
          {/* Results Header w/ Close Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(34,197,94,0.1)'
          }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              fontWeight: 600,
              color: '#22c55e',
              letterSpacing: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {loading || alertsLoading ? '⏳ PROCESSING' : activeTab === 'alerts' ? '🔔 AUTOMATED ALERTS' : '📋 ANALYSIS RESULTS'}
            </div>
            <button onClick={() => setResultsOpen(false)} style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28, height: 28,
              borderRadius: '50%',
              transition: 'all 0.2s',
            }} onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
               onMouseOut={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }}
            >
              ✕
            </button>
          </div>

          {/* Results Body */}
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10,
                fontSize: 12,
                color: '#ef4444',
                fontWeight: 500
              }}>
                ⚠️ {error}
              </div>
            )}

            {!selectedPoint && !loading && !error && (
               <div style={{ textAlign: 'center', marginTop: 40, color: '#4b5563', fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
                 WAITING FOR MAP INPUT...
               </div>
            )}

            {selectedPoint && (
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                color: '#6b7280',
                letterSpacing: 0.5,
                fontWeight: 500,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6,
                display: 'inline-block',
                alignSelf: 'flex-start'
              }}>
                📍 {selectedPoint[0].toFixed(4)}°N, {selectedPoint[1].toFixed(4)}°E
              </div>
            )}

            {analyzeResult && !loading && (
              <div style={{ animation: 'fadeUp 0.4s ease' }}>
                <AlertBadge
                  level={alertLevel}
                  score={analyzeResult.alert.score}
                  message={analyzeResult.alert.message}
                  large
                />
              </div>
            )}

            {activeTab === 'analyze' && analyzeResult && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StatsPanel
                  stats={analyzeResult?.stats}
                  ndvi={analyzeResult?.ndvi_mean}
                  year={year}
                  loading={loading}
                />
                <InsightPanel
                  analysisData={analyzeResult ? {
                    lat: analyzeResult.location.lat,
                    lng: analyzeResult.location.lng,
                    year: analyzeResult.year,
                    location_name: analyzeResult.location.name || 'Unknown Forest',
                    healthy_pct: analyzeResult.stats.healthy_pct,
                    at_risk_pct: analyzeResult.stats.at_risk_pct,
                    degraded_pct: analyzeResult.stats.degraded_pct,
                    cleared_pct: analyzeResult.stats.cleared_pct,
                    total_area_ha: analyzeResult.stats.total_area_ha,
                    ndvi_mean: analyzeResult.stats.ndvi_mean,
                    alert_level: analyzeResult.alert.level,
                    risk_score: analyzeResult.alert.score,
                  } : null}
                />
              </div>
            )}
            
            {activeTab === 'compare' && compareResult && !loading && (
              <ComparePanel data={compareResult} loading={loading} />
            )}

            {activeTab === 'alerts' && (
              <AlertsPanel alerts={alertsData} loading={alertsLoading} />
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Map
            selectedPoint={selectedPoint}
            alertLevel={alertLevel}
            onMapClick={handleMapClick}
            radiusKm={radiusKm}
            tiles={tiles}
            tilesLoading={tilesLoading}
          />
          
          {showTimeSeries && selectedPoint && activeTab === 'compare' && yearA !== "" && yearB !== "" && (
            <TimeSeriesPanel
              lat={selectedPoint[0]}
              lng={selectedPoint[1]}
              startYear={yearA}
              endYear={yearB}
              radiusKm={radiusKm}
              onClose={() => setShowTimeSeries(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}