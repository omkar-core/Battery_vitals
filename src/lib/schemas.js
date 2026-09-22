// src/lib/schemas.js
import { z } from 'zod';

export const TelemetryPayloadSchema = z.object({
  deviceId: z.string().min(3).max(10).regex(/^[A-Z0-9_-]+$/),
  timestamp: z.number().int().positive().optional(),
  voltage: z.number().min(0.5).max(100.0),
  current: z.number().min(-500.0).max(500.0),
  temperature: z.number().min(-40.0).max(150.0),
  humidity: z.number().min(0.0).max(100.0).optional(),
  mq2: z.number().min(0).max(10000).optional(),
  mq135: z.number().min(0).max(10000).optional(),
  ina_ok: z.boolean().optional(),
  dht_ok: z.boolean().optional()
});

export const LEDControlSchema = z.object({
  deviceId: z.string().min(3).max(10),
  led: z.enum(['green', 'yellow', 'red']),
  state: z.boolean()
});

export const BuzzerControlSchema = z.object({
  deviceId: z.string().min(3).max(10),
  mode: z.enum(['off', 'slow_beep', 'fast_beep', 'continuous'])
});

export const AlertThresholdConfigSchema = z.object({
  voltage_max: z.number().min(12.0).max(30.0),
  voltage_min: z.number().min(8.0).max(13.0),
  temp_warning: z.number().min(30.0).max(45.0),
  temp_critical: z.number().min(40.0).max(65.0),
  mq2_warning: z.number().min(300).max(1000),
  mq2_critical: z.number().min(500).max(3000)
});

// Outbound alert dispatch settings. Deliberately a flat, server-side config so
// secrets (Telegram token) are never read back to the browser unmasked.
export const AlertDispatchSchema = z.object({
  enabled: z.boolean().default(false),
  webhookUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith('https://'), { message: 'Webhook URL must use HTTPS (SSRF defense)' })
    .or(z.literal(''))
    .default(''),
  webhookSecret: z.string().max(200).default(''),
  telegramBotToken: z.string().max(200).default(''),
  telegramChatId: z.string().max(100).default(''),
  minSeverity: z.enum(['ALL', 'WARNING', 'CRITICAL']).default('CRITICAL'),
});

// Battery profile library. Identity is user-selected, never voltage-guessed:
// the ESP32 applies the deployed numeric limits generically.
export const BatteryProfileSchema = z.object({
  profileId: z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/i).optional(),
  name: z.string().min(2).max(80),
  chemistry: z.enum(['LI_ION', 'LIFEPO4', 'LEAD_ACID', 'NIMH', 'CUSTOM']),
  series: z.number().int().min(1).max(16),
  parallel: z.number().int().min(1).max(8).default(1),
  nominalVoltage: z.number().min(1).max(60).optional(),
  capacityAh: z.number().min(0.1).max(500).optional(),
  manufacturerName: z.string().max(60).default(''),
  // Layer 1 metadata extensions
  serialNumber: z.string().max(80).optional(),
  manufacturingDate: z.string().max(40).optional(),
  installationDate: z.string().max(40).optional(),
  location: z.string().max(100).optional(),
  ownerId: z.string().max(60).optional(),
  datasheetUrl: z.string().max(300).optional(),
  bmsType: z.string().max(60).optional(),
  cellManufacturer: z.string().max(60).optional(),
  cellModel: z.string().max(60).optional(),
  ratedEnergyWh: z.number().min(0).max(10000).optional(),
  maxContinuousPowerW: z.number().min(0).max(5000).optional(),
  recommendedChargeRateC: z.number().min(0.01).max(10).optional(),
  recommendedDischargeRateC: z.number().min(0.01).max(20).optional(),
  profileSource: z.enum(['MANUAL', 'AI_SCAN', 'MANUFACTURER_IMPORT']).default('MANUAL'),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('APPROVED'),
  revision: z.number().int().min(1).default(1),
  changeHistory: z.array(z.object({
    timestamp: z.string(),
    author: z.string(),
    field: z.string(),
    oldVal: z.any().optional(),
    newVal: z.any().optional(),
  })).default([]),
  manufacturer: z.object({
    manufacturer: z.string().max(60).default(''),
    model: z.string().max(60).default(''),
    cellVMin: z.number().min(0.5).max(5).optional(),
    cellVMax: z.number().min(0.5).max(5).optional(),
    cellVNom: z.number().min(0.5).max(5).optional(),
    chargeMaxA: z.number().min(0.1).max(500).optional(),
    dischargeMaxA: z.number().min(0.1).max(500).optional(),
    chargeTempMin: z.number().min(-40).max(60).optional(),
    chargeTempMax: z.number().min(-40).max(85).optional(),
    dischargeTempMin: z.number().min(-40).max(60).optional(),
    dischargeTempMax: z.number().min(-40).max(85).optional(),
    vMin: z.number().min(0.5).max(60).optional(),
    vMax: z.number().min(0.5).max(60).optional(),
  }).default({}),
  user: z.object({
    cellVMin: z.number().min(0.5).max(5).optional(),
    cellVMax: z.number().min(0.5).max(5).optional(),
    cellVNom: z.number().min(0.5).max(5).optional(),
    chargeMaxA: z.number().min(0.1).max(500).optional(),
    dischargeMaxA: z.number().min(0.1).max(500).optional(),
    vMin: z.number().min(0.5).max(60).optional(),
    vMax: z.number().min(0.5).max(60).optional(),
  }).default({}),
}).refine((p) => {
  const m = p.manufacturer || {}
  if (m.cellVMin != null && m.cellVMax != null) return m.cellVMax > m.cellVMin
  return true
}, { message: 'Manufacturer cellVMax must exceed cellVMin' })

export const DeployProfileSchema = z.object({
  deviceId: z.string().min(3).max(10).regex(/^[A-Z0-9_-]+$/),
  profileId: z.string().min(3).max(40),
});

export const ConnectionEventSchema = z.object({
  batteryId: z.string().min(3).max(20),
  sessionId: z.string().min(6).max(60),
  eventType: z.enum(['CONNECTED', 'DISCONNECTED', 'RECONNECTED', 'REMOVED']),
  voltage: z.number().optional(),
  timestamp: z.string(),
});

export const AuditLogSchema = z.object({
  entityType: z.enum(['PROFILE', 'THRESHOLD', 'COMMAND', 'ALERT']),
  entityId: z.string(),
  action: z.string(),
  actor: z.string(),
  changes: z.record(z.any()),
  timestamp: z.string(),
});

// User update schema — only whitelisted fields, prevents privilege escalation.
export const UserUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  title: z.string().max(80).optional(),
  department: z.string().max(80).optional(),
  avatar: z.string().max(10).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']).optional(),
}).strict()

// Fleet device registration. IDs follow the firmware's BAT### convention.
export const DeviceSchema = z.object({
  deviceId: z.string().min(3).max(10).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(2).max(60).default(''),
  location: z.string().max(80).default(''),
  chemistry: z.string().max(30).default('LiFePO4'),
  nominalVoltage: z.number().min(3.2).max(48).default(12.8),
});

// AI Feature Schemas
export const AIChatSchema = z.object({
  batteryId: z.string().min(2).max(30).default('BAT001'),
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(2000),
  })).optional().default([]),
  stream: z.boolean().optional().default(false),
});

export const AIReportSchema = z.object({
  batteryId: z.string().min(2).max(30).default('BAT001'),
  period: z.enum(['weekly', 'monthly', 'custom']).default('weekly'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const AIExplainAlertSchema = z.object({
  batteryId: z.string().min(2).max(30).default('BAT001'),
  alertId: z.string().max(60).optional(),
  fingerprint: z.string().max(80).optional(),
  alert: z.object({
    field: z.string().max(40).optional(),
    severity: z.string().max(20).optional(),
    message: z.string().max(500).optional(),
    value: z.any().optional(),
    threshold: z.any().optional(),
    timestamp: z.any().optional(),
  }).optional(),
});

export const AIThresholdSuggestSchema = z.object({
  chemistry: z.enum(['LI_ION', 'LIFEPO4', 'LEAD_ACID', 'NIMH', 'CUSTOM']).default('LIFEPO4'),
  series: z.number().int().min(1).max(16).default(4),
  parallel: z.number().int().min(1).max(8).default(1),
  capacityAh: z.number().min(0.1).max(500).optional(),
  usageContext: z.string().max(300).optional(),
  ambientTempRange: z.string().max(100).optional(),
  criticality: z.enum(['STANDARD', 'HIGH', 'MISSION_CRITICAL']).default('STANDARD'),
});

export const AILabelScanSchema = z.object({
  imageBase64: z.string().min(20).max(10000000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).default('image/jpeg'),
});

export const AIRootCauseSchema = z.object({
  batteryId: z.string().min(2).max(30).default('BAT001'),
  windowStart: z.number().optional(),
  windowEnd: z.number().optional(),
  alert: z.object({
    field: z.string().optional(),
    severity: z.string().optional(),
    message: z.string().optional(),
    value: z.any().optional(),
    timestamp: z.any().optional(),
  }).optional(),
  telemetrySamples: z.array(z.record(z.any())).max(100).optional(),
});

export const AIOnboardingWizardSchema = z.object({
  batteryId: z.string().min(2).max(30).default('BAT001'),
  step: z.number().int().min(1).max(10).default(1),
  answers: z.record(z.any()).default({}),
});

export const AIFleetSummarySchema = z.object({
  batteryIds: z.array(z.string().min(2).max(30)).min(1).max(50).optional(),
  fleetId: z.string().max(40).optional(),
});