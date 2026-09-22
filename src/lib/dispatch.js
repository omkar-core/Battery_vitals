import { getDB } from './mongodb'
import { sanitizeString, sanitizeNumber } from './security'

// Outbound alert dispatch: webhook and Telegram. Called fire-and-forget after
// an alert is persisted. Every field that reaches a third party is sanitized.

const SEVERITY_ORDER = { INFO: 0, CAUTION: 1, WARNING: 2, CRITICAL: 3, EMERGENCY: 4 }

export const DEFAULT_DISPATCH = {
  enabled: false,
  webhookUrl: '',
  webhookSecret: '',
  telegramBotToken: '',
  telegramChatId: '',
  minSeverity: 'CRITICAL',
}

export async function loadDispatchSettings() {
  try {
    const db = await getDB()
    const doc = await db.collection('settings').findOne({ key: 'alert_dispatch' })
    if (doc?.config) return { ...DEFAULT_DISPATCH, ...doc.config }
  } catch (e) {
    console.warn('[dispatch] settings load failed:', e.message)
  }
  return { ...DEFAULT_DISPATCH }
}

function shouldDispatch(settings, severity) {
  if (!settings.enabled) return false
  const min = SEVERITY_ORDER[settings.minSeverity] ?? SEVERITY_ORDER.CRITICAL
  return (SEVERITY_ORDER[severity] ?? 0) >= min
}

function formatAlertText(alert) {
  const sevIcon = { INFO: 'ℹ️', CAUTION: '🟡', WARNING: '🟠', CRITICAL: '🔴', EMERGENCY: '⛔' }[alert.severity] || '🔔'
  return `${sevIcon} [${alert.severity}] ${alert.type}\n${sanitizeString(alert.message, 500)}\nBattery: ${sanitizeString(alert.batteryId || 'BAT001', 30)}` +
    (alert.bhi != null ? ` · BHI ${sanitizeNumber(alert.bhi, 0, 100)}/100` : '')
}

async function postJson(url, body, headers = {}, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    return res.ok
  } catch (e) {
    console.warn('[dispatch] request failed:', e.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Dispatch a single alert to configured webhook(s) and Telegram. Never blocks
 * the caller for more than a moment, and never throws.
 */
export async function dispatchAlert(alert, settings = null) {
  const cfg = settings || (await loadDispatchSettings())
  const severity = sanitizeString(alert.severity || 'INFO', 20).toUpperCase()
  if (!shouldDispatch(cfg, severity)) return { dispatched: 0, skipped: true }

  const text = formatAlertText(alert)
  let dispatched = 0

  const jobs = []

  if (cfg.webhookUrl) {
    const headers = {}
    if (cfg.webhookSecret) headers['X-Webhook-Secret'] = sanitizeString(cfg.webhookSecret, 200)
    jobs.push(postJson(sanitizeString(cfg.webhookUrl, 500), { event: 'battery_alert', severity, message: text, alert }, headers).then((ok) => (ok ? 1 : 0)))
  }

  if (cfg.telegramBotToken && cfg.telegramChatId) {
    const url = `https://api.telegram.org/bot${sanitizeString(cfg.telegramBotToken, 200)}/sendMessage`
    jobs.push(
      postJson(url, {
        chat_id: sanitizeString(cfg.telegramChatId, 100),
        text,
        disable_notification: severity === 'CRITICAL' ? false : true,
      }).then((ok) => (ok ? 1 : 0))
    )
  }

  const results = await Promise.allSettled(jobs)
  dispatched = results.filter((r) => r.status === 'fulfilled').reduce((acc, r) => acc + r.value, 0)
  return { dispatched, skipped: false }
}