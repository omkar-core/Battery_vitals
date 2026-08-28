'use client'
import { useState } from 'react'

// AI analysis hook: calls the Gemini-backed /api/analyze endpoint.
export function useAI() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  const runAnalysis = async ({ batteryId = 'BAT001', analysisType = 'current', payload = null } = {}) => {
    setLoading(true)
    try {
      let body
      let endpoint = '/api/analyze'

      if (payload) {
        // Use the lightweight single-reading analyze route that accepts raw fields
        body = payload
        endpoint = '/api/analyze'
      } else {
        body = { batteryId, analysisType }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  return { analysis, loading, runAnalysis }
}
