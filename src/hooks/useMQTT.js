'use client'
import { useEffect, useRef, useState } from 'react'

function brokerUrl() {
  const b = process.env.NEXT_PUBLIC_MQTT_BROKER
  if (!b) return null
  if (b.startsWith('ws://') || b.startsWith('wss://')) {
    return b.includes('/mqtt') ? b : b + '/mqtt'
  }
  return `wss://${b}:8884/mqtt`
}

export function useMQTT(topics = ['batteryvitals/+/data']) {
  const [connected, setConnected] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const clientRef = useRef(null)

  useEffect(() => {
    const url = brokerUrl()
    // Fall back to polling when MQTT is not configured
    if (!url) {
      setConnected(false)
      setError('MQTT broker not configured')
      return
    }

    let client
    let mounted = true

    async function loadMQTT() {
      const mqtt = (await import('mqtt')).default
      client = mqtt.connect(url, {
        username: process.env.NEXT_PUBLIC_MQTT_USERNAME,
        password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
        clientId: 'web_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 10000,
      })
      clientRef.current = client

      client.on('connect', () => {
        if (!mounted) return
        setConnected(true)
        setError(null)
        topics.forEach((t) => client.subscribe(t))
      })

      client.on('message', (topic, message) => {
        try {
          const json = JSON.parse(message.toString())
          if (mounted) setData(json)
        } catch (err) {
          console.error('MQTT parse error:', err)
        }
      })

      client.on('error', (err) => {
        console.error('MQTT error:', err)
        if (mounted) {
          setConnected(false)
          setError(err.message)
        }
      })

      client.on('close', () => {
        if (mounted) setConnected(false)
      })
    }

    loadMQTT()

    return () => {
      mounted = false
      if (client) client.end(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const publish = (topic, payload) => {
    const client = clientRef.current
    if (client && connected) {
      client.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload))
    }
  }

  return { connected, data, publish, error }
}
