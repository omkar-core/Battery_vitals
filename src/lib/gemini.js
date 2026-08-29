// Gemini AI integration for battery analysis, predictive maintenance, and conversational chatbot.

// Never fabricate telemetry. Values that are missing from the live packet are
// reported honestly as "not reported" instead of substituted with placeholders.
const orNotReported = (v) => (v == null || v === '' ? 'not reported' : v)

export async function askBatteryAssistant(question, data = {}) {
  if (!process.env.GEMINI_API_KEY) {
    return generateSmartFallback(question, data)
  }

  const prompt = `You are the Battery Vital AI Health Assistant — a world-class battery safety engineer and conversational assistant.
Answer the user's question about their battery system in clear, plain language with zero unnecessary jargon.

Current Live Telemetry from the Battery System:
- Voltage: ${orNotReported(data.voltage)}V
- Current: ${orNotReported(data.current)}A (Direction: ${orNotReported(data.opDirection)})
- Cell Temperature: ${orNotReported(data.temperature)}°C
- Ambient Humidity: ${orNotReported(data.humidity)}%
- Combustible Gas (MQ-2): ${orNotReported(data.gasIndex?.mq2)} ADC
- Air Quality / VOC (MQ-135): ${orNotReported(data.gasIndex?.mq135)} ADC
- State of Charge (SOC): ${orNotReported(data.soc)}%
- State of Health (SOH): ${orNotReported(data.soh)}%
- Battery Health Index (BHI): ${orNotReported(data.bhi)} / 100
- Safety State: ${orNotReported(data.safety)}
- Internal Resistance: ${orNotReported(data.resistance)} mOhm

User Question: "${question}"

Instructions:
1. Provide a direct, reassuring, and context-aware answer referencing the actual live values where available. If a telemetry value is "not reported", do not invent a number for it.
2. If BHI is elevated (>30), explain which parameters are causing drift (e.g. temperature rise or voltage sag).
3. If asked about replacement, reference the 80% SOH industry threshold and current cycle life.
4. Keep the tone helpful, professional, and safety-oriented.`

  try {
    return await generateContent(prompt)
  } catch (e) {
    console.warn('Gemini API call failed, using intelligent fallback:', e.message)
    return generateSmartFallback(question, data)
  }
}

export async function analyzeBatteryData(data) {
  if (!process.env.GEMINI_API_KEY) {
    return generateStructuredFallback(data)
  }

  const prompt = `Battery safety expert. Analyze this battery data and provide insights:
- Voltage: ${data.voltage}V
- Current: ${data.current}A
- Temperature: ${data.temperature}C
- Humidity: ${data.humidity}%
- Gas MQ2: ${data.gasIndex?.mq2}
- Gas MQ135: ${data.gasIndex?.mq135}
- SOC: ${data.soc}%
- SOH: ${data.soh}%
- BHI: ${data.bhi}
- State: ${data.safety}
- Internal Resistance: ${data.resistance} mOhm
- Power: ${data.power}W
- Direction: ${data.opDirection}

Provide:
1. Current battery health assessment
2. Potential issues or risks (include thermal runaway risk)
3. Recommendations for optimal usage
4. Predicted lifespan estimate
Keep response concise and actionable.`

  try {
    return await generateContent(prompt)
  } catch (e) {
    return generateStructuredFallback(data)
  }
}

export async function predictFailure(historicalData) {
  if (!process.env.GEMINI_API_KEY) {
    return generatePredictionFallback(historicalData)
  }

  const dataPoints = historicalData.slice(-20).map((d) => ({
    time: new Date(d.timestamp || d.receivedAt).toISOString(),
    voltage: d.voltage,
    temperature: d.temperature,
    bhi: d.bhi,
  }))

  const prompt = `Battery safety expert. Based on this battery monitoring data over time:
${JSON.stringify(dataPoints, null, 2)}

Predict:
1. Likelihood of failure in next 24 hours (%)
2. Critical parameters to monitor
3. Early warning signs present
4. Recommended actions
Keep response concise and actionable.`

  try {
    return await generateContent(prompt)
  } catch (e) {
    return generatePredictionFallback(historicalData)
  }
}

async function generateContent(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error('Gemini API error ' + response.status + ': ' + text)
  }

  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available'
}

function generateSmartFallback(question, data) {
  const q = question.toLowerCase()
  const v = data.voltage
  const t = data.temperature
  const bhi = data.bhi
  const soh = data.soh
  const r = data.resistance

  if (q.includes('bhi') || q.includes('high') || q.includes('score')) {
    if (bhi == null) {
      return 'Your Battery Health Index (BHI) has not been reported by the device yet, so a risk assessment cannot be computed. Please try again once live telemetry is flowing.'
    }
    return `Your current Battery Health Index (BHI) is **${bhi} / 100**, which falls in the **${
      bhi < 20 ? 'Optimal (Safe)' : bhi < 50 ? 'Moderate Caution' : 'Elevated Risk'
    }** zone. BHI aggregates voltage sag, internal resistance (${
      r != null ? `${r} mΩ` : 'not reported'
    }), temperature (${t != null ? `${t}°C` : 'not reported'}), and gas levels.`
  }

  if (q.includes('replace') || q.includes('when') || q.includes('life')) {
    if (soh == null) {
      return 'Your battery State of Health (SOH) has not been reported by the device yet, so a replacement timeline cannot be estimated. Please try again once live telemetry is flowing.'
    }
    return `Based on your battery's current State of Health (**${soh}% SOH**), replacement or second-life reassignment is typically warranted once SOH drops below **80%**.`
  }

  if (q.includes('gas') || q.includes('mq') || q.includes('smoke')) {
    const mq2 = data.gasIndex?.mq2
    const mq135 = data.gasIndex?.mq135
    if (mq2 == null && mq135 == null) {
      return 'Gas sensor readings (MQ-2 / MQ-135) have not been reported by the device yet. Please try again once live telemetry is flowing.'
    }
    return `Your MQ-2 reading is **${mq2 != null ? `${mq2} ADC` : 'not reported'}** and MQ-135 is **${
      mq135 != null ? `${mq135} ADC` : 'not reported'
    }**. 2,200 ADC is the configured warning threshold.`
  }

  const parts = []
  if (v != null) parts.push(`Voltage ${v}V`)
  if (t != null) parts.push(`Temp ${t}°C`)
  if (soh != null) parts.push(`SOH ${soh}%`)
  const summary = parts.length ? `Your live vitals (${parts.join(', ')})` : 'Telemetry has not been reported by the device yet'
  return `Based on ${summary}, the battery system remains under nominal observation. Keep the discharge rate below 1C and prevent temperatures from exceeding 35°C during hot ambient conditions.`
}

function generateStructuredFallback(data) {
  const fmt = (v, suffix) => (v != null ? `${v}${suffix}` : 'not reported')
  return `### Comprehensive Battery Health Assessment

1. **Current Health State:**
   - Operating State: **${data.safety || 'not reported'}** (BHI: ${fmt(data.bhi, '/100')})
   - Voltage (${fmt(data.voltage, 'V')}) relative to current SOC (${fmt(data.soc, '%')}).
   - Internal resistance ${fmt(data.resistance, ' mΩ')}.

2. **Thermal & Gas Safety:**
   - Cell temperature: **${fmt(data.temperature, '°C')}**.
   - Gas sensors (MQ-2 & MQ-135): ${data.gasIndex ? `raw readings ${fmt(data.gasIndex.mq2, ' ADC')} and ${fmt(data.gasIndex.mq135, ' ADC')}` : 'not reported'}.

3. **Recommendations:**
   - Continue monitoring; keep ambient temperature below 35°C and avoid discharges below 20% SOC.`
}

function generatePredictionFallback(historicalData) {
  const points = Array.isArray(historicalData) ? historicalData : []
  const last = points[points.length - 1] || {}
  const latestParts = []
  if (last.voltage != null) latestParts.push(`voltage ${last.voltage}V`)
  if (last.temperature != null) latestParts.push(`temperature ${last.temperature}°C`)
  if (last.bhi != null) latestParts.push(`BHI ${last.bhi}/100`)
  const latest = latestParts.length ? latestParts.join(', ') : 'none reported'
  return `### Predictive Failure Risk Assessment
- **24-Hour Failure Probability:** Cannot be computed — the AI insights API key is not configured on this deployment, so no synthetic risk percentages are fabricated.
- **Observed Data:** ${points.length} telemetry points reviewed. Latest sample: ${latest}.
- **Monitoring Guidance:** Keep ambient cell operating temperatures below 40°C during continuous discharge and watch for BHI values above 55.
- **Action Required:** Reconfigure the AI insights provider to enable automated failure prediction.`
}
