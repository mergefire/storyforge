import { useState } from 'react'
import { Archive, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import AIConfigPanel from './AIConfigPanel'
import { resetWelcomeGuide } from '../guide/WelcomeGuide'
import NS0EvalPanel from './NS0EvalPanel'
import { getRuntime } from '../../runtime'

/**
 * 设置页（Phase 4 之后）：
 * 「提示词管理」已升级为侧边栏一级菜单，所以这里只剩 AI 配置。
 * 保留这个外壳是为了未来可能再加其他「设置」类目（快捷键、语言、备份策略等）。
 */
export default function SettingsPage() {
  const [guideReset, setGuideReset] = useState(false)
  const canExportProfile = getRuntime().migration.policy.canExportProfile

  return (
    <div className="h-full overflow-auto p-6">
      <AIConfigPanel />
      {import.meta.env.DEV && <NS0EvalPanel />}

      {/* 其他设置 */}
      <div className="max-w-2xl mt-6 p-4 bg-bg-surface border border-border rounded-xl">
        <h3 className="text-sm font-semibold text-text-primary mb-3">其他</h3>
        {canExportProfile && (
          <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-sm text-text-secondary">迁移到桌面客户端</p>
              <p className="text-xs text-text-muted">只读导出项目、正文、历史记录、附件和非敏感偏好</p>
            </div>
            <Link
              to="/migration-export"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-bg-elevated px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              导出
            </Link>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">新手引导</p>
            <p className="text-xs text-text-muted">重新显示首次使用时的新手引导教程</p>
          </div>
          <button
            onClick={() => { resetWelcomeGuide(); setGuideReset(true) }}
            disabled={guideReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-bg-elevated text-text-secondary rounded-lg hover:bg-bg-hover disabled:opacity-50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {guideReset ? '已重置（刷新生效）' : '重新引导'}
          </button>
        </div>
      </div>
    </div>
  )
}
