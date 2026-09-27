'use client'
import { useState, useCallback } from 'react'
import { authHeaders as headerAuth } from '../lib/clientToken'

// AI hook: structured diagnostics via the Battery Intelligence Engine, plus
// the legacy /api/analyze path used by the dashboard.
export function useAI() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [diagnostic, setDiagnostic] = useState(null)
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)
  const [diagnosticError, setDiagnosticError] = useState(null)

  // Legacy single-reading analysis (dashboard + custom input).
  const runAnalysis = useCallback(async ({ batteryId = 'BAT001', analysisType = 'current', payload = null } = {}) => {
    setLoading(true)
    setAnalysisError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify(payload || { batteryId, analysisType }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errorMsg =
          result?.error?.message ||
          (typeof result?.error === 'string' ? result.error : null) ||
          result?.message ||
          (res.status === 401
            ? 'Authentication required. Please sign in via the top-right button to run AI Safety Diagnostics.'
            : 'AI analysis failed')
        throw new Error(errorMsg)
      }
      if (result.analysis) {
        setAnalysis(result.analysis)
        setAnalysisError(null)
      }
      return result
    } catch (e) {
      const msg = e.message || 'AI analysis failed'
      console.warn('AI analysis notice:', msg)
      setAnalysisError(msg)
      return { error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  // Structured diagnostic: validation -> deterministic safety -> Gemini -> DB.
  const runDiagnostic = useCallback(async ({ batteryId = 'BAT001', forced = false } = {}) => {
    setDiagnosticLoading(true)
    setDiagnosticError(null)
    try {
      const res = await fetch('/api/ai/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
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
  }, [])

  const fetchDiagnostics = useCallback(async ({ batteryId = 'BAT001', limit = 20 } = {}) => {
    try {
      const res = await fetch(
        `/api/ai/diagnostics?batteryId=${encodeURIComponent(batteryId)}&limit=${limit}`,
        { headers: headerAuth() }
      )
      if (!res.ok) return []
      const data = await res.json()
      return data.diagnostics || []
    } catch (e) {
      console.error('fetch diagnostics failed:', e)
      return []
    }
  }, [])

  const deleteDiagnostic = useCallback(async (id) => {
    try {
      const res = await fetch('/api/ai/diagnostics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ id }),
      })
      return res.ok
    } catch (e) {
      console.error('delete diagnostic failed:', e)
      return false
    }
  }, [])

  return {
    analysis,
    loading,
    analysisError,
    runAnalysis,
    diagnostic,
    diagnosticLoading,
    diagnosticError,
    runDiagnostic,
    fetchDiagnostics,
    deleteDiagnostic,
  }
}