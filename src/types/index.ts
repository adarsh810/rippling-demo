export type Vertical = 'full_time' | 'hourly' | 'contractor'
export type ChangeType = 'simple' | 'complex'
export type BulkChangeStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'rolled_back'
export type ItemStatus = 'pending' | 'applied' | 'rolled_back'

export interface Employee {
  id: string
  name: string
  email: string
  work_email: string | null
  manager: string | null
  department: string
  title: string
  manager_id: string | null
  location: string
  compensation: number
  vertical: Vertical
  status: string
  created_at: string
  // full_time specific
  equity_grant: number | null
  pto_days: number | null
  bonus_target: number | null
  // hourly specific
  hourly_rate: number | null
  overtime_eligible: boolean | null
  shift_type: string | null
  // contractor specific
  contract_end_date: string | null
  agency_name: string | null
  bill_rate: number | null
}

export const VERTICAL_ATTRS: Record<string, { key: string; label: string; type: string }[]> = {
  full_time: [
    { key: 'equity_grant',  label: 'Equity Grant ($)', type: 'number' },
    { key: 'pto_days',      label: 'PTO Days',         type: 'number' },
    { key: 'bonus_target',  label: 'Bonus Target (%)', type: 'number' },
  ],
  hourly: [
    { key: 'hourly_rate',      label: 'Hourly Rate ($)',    type: 'number' },
    { key: 'overtime_eligible',label: 'OT Eligible',        type: 'boolean' },
    { key: 'shift_type',       label: 'Shift',              type: 'text' },
  ],
  contractor: [
    { key: 'contract_end_date', label: 'Contract End',  type: 'date' },
    { key: 'agency_name',       label: 'Agency',        type: 'text' },
    { key: 'bill_rate',         label: 'Bill Rate ($/hr)', type: 'number' },
  ],
}

export interface BulkChange {
  id: string
  event_type: string
  event_description: string | null
  change_type: ChangeType
  status: BulkChangeStatus
  created_by: string
  approved_by: string | null
  approved_at: string | null
  effective_date: string | null
  rollback_window_expires_at: string | null
  employee_count: number
  affected_systems: string[]
  ai_suggestions: Record<string, unknown>
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface BulkChangeItem {
  id: string
  bulk_change_id: string
  employee_id: string
  attribute: string
  old_value: string | null
  new_value: string
  status: ItemStatus
  created_at: string
  employee?: Employee
}

export interface AuditLog {
  id: string
  bulk_change_id: string | null
  action: string
  actor: string
  details: Record<string, unknown>
  created_at: string
}

export interface DownstreamSystem {
  name: string
  icon: string
  severity: 'hard' | 'soft'
  description: string
  affectedCount: number
}

export const EVENT_TEMPLATES = [
  {
    id: 'reorg',
    label: 'Re-Org',
    description: 'Department restructuring or reporting line changes',
    icon: '🏢',
    changeType: 'complex' as ChangeType,
    suggestedAttrs: ['department', 'title', 'manager_id'],
  },
  {
    id: 'perf_cycle',
    label: 'Perf Cycle',
    description: 'Performance-based compensation and title updates',
    icon: '📈',
    changeType: 'complex' as ChangeType,
    suggestedAttrs: ['compensation', 'title'],
  },
  {
    id: 'new_office',
    label: 'New Office',
    description: 'Employees relocating to a new office location',
    icon: '📍',
    changeType: 'simple' as ChangeType,
    suggestedAttrs: ['location'],
  },
  {
    id: 'device_refresh',
    label: 'Device Refresh',
    description: 'Update device policy or equipment assignments',
    icon: '💻',
    changeType: 'simple' as ChangeType,
    suggestedAttrs: ['location'],
  },
  {
    id: 'contractor_renewal',
    label: 'Contractor Renewal',
    description: 'Extend contract end dates and update bill rates in bulk',
    icon: '📝',
    changeType: 'simple' as ChangeType,
    suggestedAttrs: ['contract_end_date', 'bill_rate'],
  },
  {
    id: 'role_change',
    label: 'Role Change',
    description: 'Bulk title and department updates across a team or org',
    icon: '🔄',
    changeType: 'complex' as ChangeType,
    suggestedAttrs: ['title', 'department'],
  },
]

export const DOWNSTREAM_SYSTEMS_MAP: Record<string, DownstreamSystem[]> = {
  compensation: [
    { name: 'Payroll', icon: '💰', severity: 'hard', description: 'Payroll recalculation required before next cutoff', affectedCount: 0 },
    { name: 'Benefits', icon: '🏥', severity: 'soft', description: 'Benefits enrollment tiers may shift', affectedCount: 0 },
    { name: 'Tax Engine', icon: '📋', severity: 'hard', description: 'Tax withholding rates will be recalculated', affectedCount: 0 },
  ],
  location: [
    { name: 'Payroll', icon: '💰', severity: 'hard', description: 'State tax jurisdiction will change', affectedCount: 0 },
    { name: 'Benefits', icon: '🏥', severity: 'soft', description: 'Benefits plans are location-dependent', affectedCount: 0 },
    { name: 'Slack', icon: '💬', severity: 'soft', description: 'Location-based Slack channels will update', affectedCount: 0 },
  ],
  department: [
    { name: 'Slack', icon: '💬', severity: 'soft', description: 'Department Slack groups will update', affectedCount: 0 },
    { name: 'GitHub', icon: '🐙', severity: 'soft', description: 'GitHub team memberships will change', affectedCount: 0 },
    { name: 'Device Mgmt', icon: '💻', severity: 'soft', description: 'Device policies are department-scoped', affectedCount: 0 },
  ],
  title: [
    { name: 'Org Chart', icon: '📊', severity: 'soft', description: 'Org chart titles will update automatically', affectedCount: 0 },
    { name: 'Slack', icon: '💬', severity: 'soft', description: 'Slack display names will reflect new title', affectedCount: 0 },
  ],
  manager_id: [
    { name: 'Org Chart', icon: '📊', severity: 'hard', description: 'Reporting structure will change — check for circular dependencies', affectedCount: 0 },
    { name: 'Slack', icon: '💬', severity: 'soft', description: 'Manager-based Slack group memberships will update', affectedCount: 0 },
  ],
}
