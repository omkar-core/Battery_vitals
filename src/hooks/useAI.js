'use client'
import { useState } from 'react'

// AI hook: structured diagnostics via the Battery Intelligence Engine, plus
// the legacy /api/analyze path used by the dashboard.
export function useAI() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [diagnostic, setDiagnostic] = useState(null)
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)
  const [diagnosticError, setDiagnosticError] = useState(null)

  // Legacy single-reading analysis (dashboard + custom input).
  const runAnalysis = async ({ batteryId = 'BAT001', analysisType = 'current', payload = null } = {}) => {
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || { batteryId, analysisType }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || result.message || 'Analysis failed')
      if (result.analysis) setAnalysis(result.analysis)
      return result
    } catch (e) {
      console.error('AI analysis failed:', e)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Structured diagnostic: validation -> deterministic safety -> Gemini -> DB.
  const runDiagnostic = async ({ batteryId = 'BAT001', forced = false } = {}) => {
    setDiagnosticLoading(true)
    setDiagnosticError(null)
    try {
      const res = await fetch('/api/ai/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryId, forced }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Diagnostic failed')
      setDiagnostic(data.result)
      return data
    } catch (e) {
      setDiagnosticError(e.message || 'Diagnostic failed')
      console.error('AI diagnostic failed:', e)
      return { error: e.message }
    } finally {
      setDiagnosticLoading(false)
    }
  }

  const fetchDiagnostics = async ({ batteryId = 'BAT001', limit = 20 } = {}) => {
    try {
      const res = await fetch(`/api/ai/diagnostics?batteryId=${encodeURIComponent(batteryId)}&limit=${limit}`)
      const data = await res.json()
      return data.diagnostics || []
    } catch (e) {
      console.error('fetch diagnostics failed:', e)
      return []
    }
  }

  const deleteDiagnostic = async (id) => {
    try {
      const res = await fetch('/api/ai/diagnostics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      return res.ok
    } catch (e) {
      console.error('delete diagnostic failed:', e)
      return false
    }
  }

  return {
    analysis,
    loading,
    runAnalysis,
    diagnostic,
    diagnosticLoading,
    diagnosticError,
    runDiagnostic,
    fetchDiagnostics,
    deleteDiagnostic,
  }
}