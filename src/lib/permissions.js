// ============================================================================
// Battery Vital — Role-Based Access Control (RBAC) System
// Roles: 'admin', 'operator', 'viewer'
// ============================================================================

export const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
}

export const PERMISSIONS = {
  VIEW_TELEMETRY: 'view_telemetry',
  CONTROL_HARDWARE: 'control_hardware',
  MANAGE_ALERTS: 'manage_alerts',
  MANAGE_USERS: 'manage_users',
  ACCESS_AI: 'access_ai',
  EXPORT_DATA: 'export_data',
  EDIT_SETTINGS: 'edit_settings',
}

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.CONTROL_HARDWARE,
    PERMISSIONS.MANAGE_ALERTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.ACCESS_AI,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.EDIT_SETTINGS,
  ],
  [ROLES.OPERATOR]: [
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.CONTROL_HARDWARE,
    PERMISSIONS.MANAGE_ALERTS,
    PERMISSIONS.ACCESS_AI,
    PERMISSIONS.EXPORT_DATA,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_TELEMETRY,
    PERMISSIONS.ACCESS_AI,
    PERMISSIONS.EXPORT_DATA,
  ],
}

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(role, permission) {
  if (!role) return false
  const list = ROLE_PERMISSIONS[role.toLowerCase()] || []
  return list.includes(permission)
}

/**
 * Check if role can execute actuator control commands (LED, Buzzer, Relays)
 */
export function canControlHardware(role) {
  return hasPermission(role, PERMISSIONS.CONTROL_HARDWARE)
}

/**
 * Check if role can manage team accounts
 */
export function canManageUsers(role) {
  return hasPermission(role, PERMISSIONS.MANAGE_USERS)
}

/**
 * Check if role can acknowledge or configure alerts
 */
export function canManageAlerts(role) {
  return hasPermission(role, PERMISSIONS.MANAGE_ALERTS)
}
