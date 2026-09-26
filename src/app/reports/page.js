'use client'

import React, { useState, useEffect } from 'react'
import Header from '../../components/Header'

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    async function loadReports() {
      setLoading(true)
      try {
        const res = await fetch('/api/ai/report?batteryId=BAT001')
        const data = await res.json()
        if (data.reports) setReports(data.reports)
      } catch (err) {
        console.warn('Failed to fetch reports:', err)
      } finally {
        setLoading(false)
      }
    }
    loadReports()
  }, [])

  const handleGenerateReport = async (period = 'weekly') => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryId: 'BAT001', period }),
      })
      const data = await res.json()
      if (data.report) {
        setReports([data.report, ...reports])
        setSelectedReport(data.report)
      }
    } catch (err) {
      alert('Failed to generate report: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      <Header />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📑</span> My Reports History
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Saved AI health, capacity retention &amp; safety reports.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => handleGenerateReport('weekly')}
              disabled={generating}
              style={{
                backgroundColor: '#00E8A0',
                color: '#090d16',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {generating ? 'Generating...' : '+ Generate Weekly Report'}
            </button>
            <button
              onClick={() => handleGenerateReport('monthly')}
              disabled={generating}
              style={{
                backgroundColor: '#38BDF8',
                color: '#090d16',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Generate Monthly Report
            </button>
          </div>
        </div>

        {/* Layout: Reports List vs Report Viewer */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '24px' }}>
          {/* Reports Sidebar */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-secondary)' }}>Saved Reports ({reports.length})</h3>

            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading reports...</div>
            ) : reports.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No saved reports found. Click generate above!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reports.map((r) => (
                  <div
                    key={r.reportId}
                    onClick={() => setSelectedReport(r)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: selectedReport?.reportId === r.reportId ? 'var(--bg-surface-raised)' : 'transparent',
                      border: '1px solid',
                      borderColor: selectedReport?.reportId === r.reportId ? 'var(--accent-primary)' : 'var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Period: {r.period}</span>
                      <span>{new Date(r.generatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Report Main Content Viewer */}
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            {selectedReport ? (
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text-primary)' }}>{selectedReport.title}</h2>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
                  Generated on {new Date(selectedReport.generatedAt).toLocaleString()} • Battery ID: {selectedReport.batteryId}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', padding: '16px', borderRadius: '10px' }}>
                    <h4 style={{ margin: '0 0 6px 0', color: '#00E8A0', fontSize: '14px' }}>Executive Summary</h4>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {selectedReport.summary || selectedReport.content?.executiveSummary}
                    </p>
                  </div>

                  {selectedReport.content?.healthAssessment && (
                    <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', padding: '16px', borderRadius: '10px' }}>
                      <h4 style={{ margin: '0 0 6px 0', color: '#38BDF8', fontSize: '14px' }}>Health &amp; Capacity Retention</h4>
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {selectedReport.content.healthAssessment}
                      </p>
                    </div>
                  )}

                  {selectedReport.content?.actionableRecommendations && (
                    <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', padding: '16px', borderRadius: '10px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#FFB800', fontSize: '14px' }}>Actionable Recommendations</h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {selectedReport.content.actionableRecommendations.map((rec, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a report from the left sidebar to view details.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
