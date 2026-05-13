import clsx from 'clsx'

const STEPS = [
  { n: 1, label: 'Event' },
  { n: 2, label: 'Scope' },
  { n: 3, label: 'Changes' },
  { n: 4, label: 'Preview' },
  { n: 5, label: 'Approve' },
]

export default function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-shrink-0">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
              s.n < current   ? 'bg-orange-500 text-white' :
              s.n === current ? 'bg-orange-500 text-white ring-2 ring-orange-200' :
                                'bg-gray-200 text-gray-500'
            )}>
              {s.n < current ? '✓' : s.n}
            </div>
            <span className={clsx(
              'text-xs md:text-sm whitespace-nowrap',
              s.n === current ? 'text-gray-900 font-medium' : 'text-gray-400'
            )}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={clsx('w-4 md:w-8 h-px mx-1.5 md:mx-3', s.n < current ? 'bg-orange-400' : 'bg-gray-200')} />
          )}
        </div>
      ))}
    </div>
  )
}
