import { useState } from 'react'
import { Bot, Loader } from 'lucide-react'
import styles from './components.module.css'

export default function AIInsights({ analysis, loading = false, onAnalyze }) {
  const [inputMode, setInputMode] = useState(false)
  const [form, setForm] = useState({})

  const fields = ['voltage', 'current', 'temperature', 'humidity', 'soc', 'bhi', 'safety', 'resistance', 'power']

  const submit = () => {
    if (onAnalyze) onAnalyze(form)
  }

  return (
    <div className={styles.aiCard}>
      <div className={styles.aiHeader}>
        <Bot size={16} color="#BF5AF2" />
        <h3 className={styles.panelTitle}>AI Vital Analyst</h3>
      </div>

      <div className={styles.aiActions}>
        <button className={styles.primaryBtn} disabled={loading} onClick={() => { setInputMode(false); if (onAnalyze) onAnalyze({}) }}>
          {loading ? <Loader className={styles.spin} size={15} /> : 'AI Analysis'}
        </button>
        <button className={styles.secondaryBtn} disabled={loading} onClick={() => setInputMode(!inputMode)}>
          Custom Input
        </button>
      </div>

      {inputMode && (
        <div className={styles.aiForm}>
          <div className={styles.aiGrid}>
            {fields.map((f) => (
              <label key={f} className={styles.aiField}>
                <span className={styles.aiLabel}>{f}</span>
                <input
                  className={styles.aiInput}
                  value={form[f] ?? ''}
                  placeholder="--"
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <button className={styles.primaryBtn} style={{ marginTop: 8 }} onClick={submit}>
            Analyze Custom Data
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.aiLoading}>
          <Loader className={styles.spin} size={28} color="#BF5AF2" />
          <span>Gemini is analyzing your battery...</span>
        </div>
      ) : analysis ? (
        <pre className={styles.aiOutput}>{analysis}</pre>
      ) : (
        <div className={styles.aiEmpty}>
          Run an AI analysis to get battery health assessment, risk prediction, and recommendations.
        </div>
      )}
    </div>
  )
}
