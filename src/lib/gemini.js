// Gemini AI integration for battery analysis and failure prediction.
// Uses the REST generateContent endpoint so it works in serverless environments.

export async function analyzeBatteryData(data) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
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

  return generateContent(prompt)
}

export async function predictFailure(historicalData) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
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

  return generateContent(prompt)
}

async function generateContent(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
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
