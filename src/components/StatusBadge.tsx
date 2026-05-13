import { BulkChangeStatus } from '@/types'
import clsx from 'clsx'

const CONFIG: Record<BulkChangeStatus, { label: string; cls: string }> = {
  draft:            { label: 'Draft',            cls: 'bg-gray-100 text-gray-600' },
  pending_approval: { label: 'Pending Approval', cls: 'bg-yellow-100 text-yellow-700' },
  approved:         { label: 'Approved',         cls: 'bg-blue-100 text-blue-700' },
  rejected:         { label: 'Rejected',         cls: 'bg-red-100 text-red-700' },
  executed:         { label: 'Executed',         cls: 'bg-green-100 text-green-700' },
  rolled_back:      { label: 'Rolled Back',      cls: 'bg-purple-100 text-purple-700' },
}

export default function StatusBadge({ status }: { status: BulkChangeStatus }) {
  const { label, cls } = CONFIG[status] ?? CONFIG.draft
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cls)}>
      {label}
    </span>
  )
}
