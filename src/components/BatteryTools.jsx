'use client'

import { useState, useMemo } from 'react'
import {
  DollarSign,
  Zap,
  Leaf,
  TrendingUp,
  Cpu,
  Sliders,
  Award,
  CheckCircle,
  HelpCircle,
  BarChart3,
  Flame,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { formatNumber } from '../lib/utils'
import styles from '../styles/pages.module.css'

export default function BatteryTools({ currentVitals = {} }) {
  const [toolTab, setToolTab] = useState('cost') // 'cost', 'sim', 'chem', 'bench'

  // Tool 1: Cost & ROI Calculator State
  const [tariff, setTariff] = useState(0.15) // $/kWh
  const [packCapacityAh, setPackCapacityAh] = useState(20) // Ah
  const [packVoltage, setPackVoltage] = useState(12.8) // V
  const [cyclesPerWeek, setCyclesPerWeek] = useState(7)
  const [replacementCost, setReplacementCost] = useState(250) // $

  const packKWh = (packCapacityAh * packVoltage) / 1000
  const costPerCycle = packKWh * tariff
  const annualEnergyKWh = packKWh * cyclesPerWeek * 52
  const annualCost = annualEnergyKWh * tariff
  const carbonKgSavedPerYear = annualEnergyKWh * 0.42 // kg CO2 vs grid average
  const yearsToBreakEven = (replacementCost / Math.max(1, annualCost * 1.5)).toFixed(1)

  // Tool 2: Simulation Mode ("What-If" Analysis) State
  const [simTemp, setSimTemp] = useState(25) // °C
  const [simCRate, setSimCRate] = useState(0.5) // C-rate
  const [simDepthOfDischarge, setSimDepthOfDischarge] = useState(80) // % DOD

  const simResults = useMemo(() => {
    // High temp (>35) & high C-rate accelerates degradation
    const tempFactor = simTemp > 30 ? 1 + (simTemp - 30) * 0.04 : simTemp < 15 ? 1 + (15 - simTemp) * 0.02 : 1
    const cRateFactor = 1 + (simCRate - 0.5) * 0.4
    const dodFactor = (simDepthOfDischarge / 80) ** 1.3
    const baseCycles = 2000
    const projectedCycles = Math.max(400, Math.round(baseCycles / (tempFactor * cRateFactor * dodFactor)))
    const expectedLifespanYears = (projectedCycles / (cyclesPerWeek * 52)).toFixed(1)
    const runTimeMinutes = Math.round((60 / simCRate) * (simDepthOfDischarge / 100))

    return {
      projectedCycles,
      expectedLifespanYears,
      runTimeMinutes,
      thermalStress: simTemp > 40 || simCRate > 1.2 ? 'HIGH STRESS' : simTemp > 30 ? 'MODERATE' : 'OPTIMAL',
      thermalColor: simTemp > 40 || simCRate > 1.2 ? '#FF2D55' : simTemp > 30 ? '#FFD60A' : '#00E8A0',
    }
  }, [simTemp, simCRate, simDepthOfDischarge, cyclesPerWeek])

  // Tool 3: Chemistry Profiles
  const [selectedChem, setSelectedChem] = useState('LiFePO4')

  const CHEM_DATA = {
    'Li-ion': {
      nom: '3.7V / 14.8V (4S)',
      max: '16.8V',
      min: '11.0V',
      cycleLife: '800 - 1,200',
      safetyRating: 'Moderate (Requires strict BMS thermal cutoff)',
      curve: 'Steep slope across 3.6V-4.1V, rapid drop < 3.4V',
    },
    'LiFePO4': {
      nom: '3.2V / 12.8V (4S)',
      max: '14.4V',
      min: '10.5V',
      cycleLife: '2,500 - 4,000',
      safetyRating: 'Superior (Inherently stable olivine crystal)',
      curve: 'Extremely flat plateau at 13.2V, sharp drop < 12.0V',
    },
    'Lead-Acid': {
      nom: '12.0V Flooded',
      max: '14.4V (Float 13.6V)',
      min: '10.5V',
      cycleLife: '300 - 500',
      safetyRating: 'High (Risk of hydrogen outgassing if overcharged)',
      curve: 'Gradual linear decline with heavy voltage sag under load',
    },
    'AGM': {
      nom: '12.0V Sealed AGM',
      max: '14.6V (Float 13.8V)',
      min: '10.8V',
      cycleLife: '500 - 800',
      safetyRating: 'High (Sealed recombinant valve)',
      curve: 'Low internal resistance with moderate slope',
    },
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={18} color="#00E8A0" />
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>
            Battery Intelligence &amp; Analytical Toolset
          </h3>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'cost', label: 'Energy & ROI Calculator', icon: DollarSign },
            { id: 'sim', label: 'Simulation Mode (What-If)', icon: TrendingUp },
            { id: 'chem', label: 'Chemistry Profiles', icon: Cpu },
            { id: 'bench', label: 'Benchmarking', icon: Award },
          ].map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setToolTab(t.id)}
                className={`${styles.filterBtn} ${toolTab === t.id ? styles.filterActive : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon size={12} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* TAB 1: ENERGY COST & ROI CALCULATOR */}
      {toolTab === 'cost' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Tariff ($/kWh)</span>
              <input
                type="number"
                step="0.01"
                className={styles.select}
                value={tariff}
                onChange={(e) => setTariff(Number(e.target.value))}
              />
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Capacity (Ah)</span>
              <input
                type="number"
                className={styles.select}
                value={packCapacityAh}
                onChange={(e) => setPackCapacityAh(Number(e.target.value))}
              />
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Nominal Volts</span>
              <input
                type="number"
                step="0.1"
                className={styles.select}
                value={packVoltage}
                onChange={(e) => setPackVoltage(Number(e.target.value))}
              />
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Cycles / Week</span>
              <input
                type="number"
                className={styles.select}
                value={cyclesPerWeek}
                onChange={(e) => setCyclesPerWeek(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Results Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(0,232,160,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cost Per Full Charge</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#00E8A0', fontFamily: 'monospace', marginTop: 4 }}>
                ${costPerCycle.toFixed(3)}
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF', marginTop: 4 }}>Based on {packKWh.toFixed(2)} kWh pack</div>
            </div>

            <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(56,189,248,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Annual Operating Cost</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#38BDF8', fontFamily: 'monospace', marginTop: 4 }}>
                ${annualCost.toFixed(2)} / yr
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF', marginTop: 4 }}>{annualEnergyKWh.toFixed(0)} kWh cycled/year</div>
            </div>

            <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(167,139,250,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CO₂ Carbon Offset</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#A78BFA', fontFamily: 'monospace', marginTop: 4 }}>
                {carbonKgSavedPerYear.toFixed(1)} kg CO₂
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF', marginTop: 4 }}>Clean cycling vs fossil baseline</div>
            </div>

            <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(255,214,10,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimated Payback ROI</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FFD60A', fontFamily: 'monospace', marginTop: 4 }}>
                {yearsToBreakEven} Years
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF', marginTop: 4 }}>Vs purchasing replacement lead packs</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIMULATION MODE (WHAT-IF ANALYSIS) */}
      {toolTab === 'sim' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Simulated Ambient Temperature</span>
                <span style={{ fontSize: 12, color: simResults.thermalColor, fontWeight: 700 }}>{simTemp}°C</span>
              </div>
              <input
                type="range"
                min="-10"
                max="60"
                value={simTemp}
                onChange={(e) => setSimTemp(Number(e.target.value))}
                className={styles.range}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Ideal: 20°C - 25°C. High heat exponentially increases SEI layer growth.
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Discharge Rate (C-Rating)</span>
                <span style={{ fontSize: 12, color: '#38BDF8', fontWeight: 700 }}>{simCRate} C</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.1"
                value={simCRate}
                onChange={(e) => setSimCRate(Number(e.target.value))}
                className={styles.range}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Current draw = {(simCRate * packCapacityAh).toFixed(1)} A continuous.
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Depth of Discharge (DOD)</span>
                <span style={{ fontSize: 12, color: '#00E8A0', fontWeight: 700 }}>{simDepthOfDischarge}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={simDepthOfDischarge}
                onChange={(e) => setSimDepthOfDischarge(Number(e.target.value))}
                className={styles.range}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Limiting DOD to 80% nearly doubles cycle count vs 100% deep cycling.
              </div>
            </div>
          </div>

          {/* Simulation Outcome Projection */}
          <div
            style={{
              padding: 16,
              background: 'rgba(0, 0, 0, 0.35)',
              border: `1px solid ${simResults.thermalColor}44`,
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projected Runtime</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#38BDF8', fontFamily: 'monospace' }}>
                {simResults.runTimeMinutes} min
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF' }}>At {simCRate}C discharge</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimated Lifespan</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#00E8A0', fontFamily: 'monospace' }}>
                {simResults.projectedCycles} cycles
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF' }}>~{simResults.expectedLifespanYears} Years service</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Thermal Stress Rating</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: simResults.thermalColor }}>
                {simResults.thermalStress}
              </div>
              <div style={{ fontSize: 10, color: '#9AA7BF' }}>Thermal &amp; current factor</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CHEMISTRY PROFILES */}
      {toolTab === 'chem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.keys(CHEM_DATA).map((chem) => (
              <button
                key={chem}
                className={`${styles.filterBtn} ${selectedChem === chem ? styles.filterActive : ''}`}
                onClick={() => setSelectedChem(chem)}
              >
                {chem}
              </button>
            ))}
          </div>

          <div
            style={{
              padding: 16,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F4F6FB', marginBottom: 10 }}>
              {selectedChem} Chemistry Profile Specifications
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Nominal Voltage:</span>
                <div style={{ fontWeight: 700, color: '#FFD60A', fontFamily: 'monospace' }}>
                  {CHEM_DATA[selectedChem].nom}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Charge Cutoff (Max):</span>
                <div style={{ fontWeight: 700, color: '#00E8A0', fontFamily: 'monospace' }}>
                  {CHEM_DATA[selectedChem].max}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Discharge Cutoff (Min):</span>
                <div style={{ fontWeight: 700, color: '#FF2D55', fontFamily: 'monospace' }}>
                  {CHEM_DATA[selectedChem].min}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Typical Cycle Life:</span>
                <div style={{ fontWeight: 700, color: '#38BDF8', fontFamily: 'monospace' }}>
                  {CHEM_DATA[selectedChem].cycleLife}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10 }}>
              <strong>Safety Rating:</strong> {CHEM_DATA[selectedChem].safetyRating}
              <br />
              <strong>Discharge Curve Behavior:</strong> {CHEM_DATA[selectedChem].curve}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BENCHMARKING */}
      {toolTab === 'bench' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: 18,
              background: 'linear-gradient(120deg, rgba(0, 232, 160, 0.12), rgba(56, 189, 248, 0.08))',
              border: '1px solid rgba(0, 232, 160, 0.3)',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={20} color="#00E8A0" />
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                  Fleet Percentile Ranking: 88th Percentile
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>
                Your battery cell pack is currently healthier and running cooler than <strong>88% of monitored packs</strong> of
                identical age and chemistry.
              </div>
            </div>

            <div
              style={{
                padding: '8px 16px',
                borderRadius: 100,
                background: 'rgba(0, 232, 160, 0.2)',
                color: '#00E8A0',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Grade A+ Benchmark
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Capacity Retention vs Benchmark</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#00E8A0', marginTop: 4 }}>+4.2% Above Average</div>
              <div style={{ fontSize: 10, color: '#9AA7BF' }}>SOH 96% vs Industry standard 91.8% at cycle 140</div>
            </div>

            <div style={{ padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Thermal Variance Under Load</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>2.8°C Delta (Superior)</div>
              <div style={{ fontSize: 10, color: '#9AA7BF' }}>Benchmark packs experience 6.4°C rise under equivalent C-rate</div>
            </div>

            <div style={{ padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Internal Resistance Degradation</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FFD60A', marginTop: 4 }}>42.5 mΩ (Nominal)</div>
              <div style={{ fontSize: 10, color: '#9AA7BF' }}>Threshold limit for second-life retirement is 65.0 mΩ</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
