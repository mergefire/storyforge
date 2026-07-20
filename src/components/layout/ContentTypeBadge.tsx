import { BookOpenCheck, DatabaseZap, PenLine, Settings2, WandSparkles } from 'lucide-react'
import {
  MODULE_CONTENT_TYPE_DEFINITIONS,
  type ModuleContentType,
} from './sidebar-tree'

interface Props {
  contentType: ModuleContentType
  compact?: boolean
  showDescription?: boolean
  className?: string
}

const TYPE_STYLES: Record<ModuleContentType, string> = {
  upstream: 'border-border bg-bg-elevated text-text-secondary',
  writing: 'border-accent/25 bg-accent/10 text-accent',
  downstream: 'border-border bg-bg-elevated text-text-secondary',
  tool: 'border-border bg-bg-elevated text-text-secondary',
  system: 'border-border bg-bg-elevated text-text-secondary',
}

const TYPE_ICONS = {
  upstream: BookOpenCheck,
  writing: PenLine,
  downstream: DatabaseZap,
  tool: WandSparkles,
  system: Settings2,
} satisfies Record<ModuleContentType, typeof BookOpenCheck>

export default function ContentTypeBadge({
  contentType,
  compact = false,
  showDescription = false,
  className = '',
}: Props) {
  const definition = MODULE_CONTENT_TYPE_DEFINITIONS[contentType]
  const Icon = TYPE_ICONS[contentType]

  if (compact) {
    return (
      <span
        data-content-type={contentType}
        aria-hidden="true"
        title={`${definition.label}：${definition.description}`}
        className={`ml-auto inline-flex shrink-0 items-center rounded-sm bg-bg-hover px-1 py-0.5 text-[9px] font-medium text-text-secondary ${className}`}
      >
        {definition.label}
      </span>
    )
  }

  return (
    <span
      data-content-type={contentType}
      title={`${definition.label}：${definition.description}`}
      className={`inline-flex min-w-0 items-center gap-1.5 rounded border px-2 py-1 text-xs ${TYPE_STYLES[contentType]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="shrink-0 font-medium">{definition.label}</span>
      {showDescription && (
        <span className="hidden truncate text-text-muted xl:inline">{definition.description}</span>
      )}
    </span>
  )
}
