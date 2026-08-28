'use client'
import Layout from '../../components/Layout'
import AIInsights from '../../components/AIInsights'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { useAI } from '../../hooks/useAI'
import { useState, useEffect } from 'react'
import styles from '../../styles/pages.module.css'

export default function AIPage() {
  const { connected, data } = useRealTimeData()
  const { analysis, loading, runAnalysis } = useAI()
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetch('/api/predictions?limit=10').then((r) => r.json()).then(setHistory).catch(() => {})
  }, [])

  const handleAnalyze = (form) => {
    let payload = form
    if (form && Object.keys(form).length === 0) {
      payload = {
        voltage: data?.battery?.voltage ?? data?.voltage,
        current: data?.battery?.current ?? data?.current,
        temperature: data?.environment?.temperature ?? data?.temperature,
        humidity: data?.environment?.humidity ?? data?.humidity,
        soc: data?.battery?.soc ?? data?.soc,
        bhi: data?.risk?.bhi ?? data?.bhi,
        safety: data?.battery?.safety ?? data?.safety ?? 'SAFE',
        power: data?.battery?.power ?? data?.power,
      }
    }
    runAnalysis({ payload }).then(() => {
      fetch('/api/predictions?limit=10').then((r) => r.json()).then(setHistory).catch(() => {})
    })
  }

  return (
    <Layout connected={connected}>
      <h1 className={styles.pageTitle}>AI Vital Analyst</h1>
      <p className={styles.subtitle}>Powered by Google Gemini AI - Predictive Battery Intelligence</p>
      <AIInsights analysis={analysis} loading={loading} onAnalyze={handleAnalyze} />

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Recent Analyses</h3>
          <button className={styles.refreshBtn} onClick={() => fetch('/api/predictions?limit=10').then((r) => r.json()).then(setHistory)}>Refresh</button>
        </div>
        {history.length === 0 ? (
          <div className={styles.empty}>No analyses yet</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((p) => (
              <div key={p._id || p.timestamp} className={styles.historyItem}>
                <span className={styles.severityPill}>{p.riskLevel || 'LOW'}</span>
                <span className={styles.historyText}>{p.analysis || p.recommendations?.[0] || 'Prediction'}</span>
                <span className={styles.historyTime}>{p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : '--'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
