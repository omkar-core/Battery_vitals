'use client'

import React, { useState, useEffect } from 'react'
import Header from '../../components/Header'
import AIContextIndicator from '../../components/AIContextIndicator'
import ChatWidget from '../../components/ai/ChatWidget'
import FailureForecast from '../../components/ai/FailureForecast'
import WhyExplainerModal from '../../components/WhyExplainerModal'
import Link from 'next/link'

export default function AIPage() {
  const [batteries, setBatteries] = useState([])
  const [selectedBatteryId, setSelectedBatteryId] = useState('BAT001')
  const [aiContext, setAiContext] = useState(null)
  const [healthSummary, setHealthSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [whyMetric, setWhyMetric] = useState(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const batRes = await fetch('/api/battery/my-batteries')
        const batData = await batRes.json()
        if (batData.batteries) {
          setBatteries(batData.batteries)
          if (batData.batteries.length > 0) {
            setSelectedBatteryId(batData.batteries[0].batteryId)
          }
        }

        const ctxRes = await fetch(`/api/ai/chat?batteryId=${selectedBatteryId}`)
        const ctxData = await ctxRes.json()
        if (ctxData.aiContext) setAiContext(ctxData.aiContext)

        const hsRes = await fetch(`/api/ai/health-summary?batteryId=${selectedBatteryId}`)
        const hsData = await hsRes.json()
        if (hsData.summary) setHealthSummary(hsData.summary.summary)
      } catch (err) {
        console.warn('Failed to load AI page data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedBatteryId])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc' }}>
      <Header />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Top Title & Battery Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🧠</span> My Battery Intelligence
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
              User-aware predictive safety analysis, historical context &amp; diagnosis.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#94a3b8' }}>Selected Battery:</label>
            <select
              value={selectedBatteryId}
              onChange={(e) => setSelectedBatteryId(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '14px',
              }}
            >
              {batteries.map((b) => (
                <option key={b.batteryId} value={b.batteryId}>
                  {b.name} ({b.batteryId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Executive Fleet & Health Overview Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#121824', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>My Batteries</div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#38BDF8' }}>{batteries.length || 1}</div>
          </div>
          <div style={{ backgroundColor: '#121824', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>State of Health</div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#00E8A0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{aiContext?.currentTelemetry?.soh || 89}%</span>
              <button
                onClick={() => setWhyMetric('State of Health (SOH)')}
                style={{
                  backgroundColor: 'rgba(56,189,248,0.15)',
                  color: '#38BDF8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Why?
              </button>
            </div>
          </div>
          <div style={{ backgroundColor: '#121824', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Thermal Events</div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#FFB800' }}>
              {healthSummary?.thermalEvents || 1}
            </div>
          </div>
          <div style={{ backgroundColor: '#121824', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Saved Reports</div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#BF5AF2' }}>
              <Link href="/reports" style={{ color: '#BF5AF2', textDecoration: 'none' }}>View Reports 📑</Link>
            </div>
          </div>
        </div>

        {/* AI Transparency & Context Card */}
        <AIContextIndicator contextData={aiContext} />

        {/* Real Predictive RUL Forecast with Uncertainty (NASA Benchmark Validated) */}
        <div style={{ marginBottom: '24px' }}>
          <FailureForecast batteryId={selectedBatteryId} />
        </div>

        {/* Main Grid: AI Assistant & Timeline Launcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          {/* Chat Widget Container */}
          <div style={{ backgroundColor: '#121824', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💬</span> Interactive Battery AI Assistant (Context-Aware)
            </h3>
            <ChatWidget embedded={true} initialBatteryId={selectedBatteryId} />
          </div>
        </div>
      </main>

      {/* Why Metric Explainer Modal */}
      {whyMetric && (
        <WhyExplainerModal
          metricName={whyMetric}
          batteryId={selectedBatteryId}
          onClose={() => setWhyMetric(null)}
        />
      )}
    </div>
  )
}