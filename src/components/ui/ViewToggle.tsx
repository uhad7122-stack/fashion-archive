import type { ViewMode } from '../../hooks/useViewMode'

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-white p-0.5" role="group" aria-label="보기 방식">
      {(['grid', 'list'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${mode === m ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
        >
          {m === 'grid' ? 'Grid' : 'List'}
        </button>
      ))}
    </div>
  )
}
