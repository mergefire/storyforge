/**
 * Phase 35-a — 词条系统的 AI 上下文构建（上游设定注入）
 *
 * 词条属「上游设定」：作者填写 → AI 写作时读取。本模块把词条按分类紧凑格式化，
 * 注入到写作/大纲/场景等生成链路，避免词条独立于 AI 生成体系之外。
 *
 * 架构约束：
 *  - 单世界且无任何词条时返回 ''（对现有写作链路零影响）。
 *  - 多世界按 worldGroupId 隔离（与 buildCurrentWorldContext 同源）；
 *    传 null/undefined 表示主世界/单世界，读取未归属世界组的词条。
 */
import { db } from '../db/schema'
import {
  parseEntryFields, parseEntryRefs, parseFieldSchema,
  type CodexCategory, type CodexEntry,
} from '../types/codex'

interface BuildOptions {
  /** 总长度预算（字符），默认 2500 */
  maxChars?: number
  /** 每个分类最多展示的词条数，默认 30 */
  maxPerCategory?: number
  /** 每条词条最多内联的专属字段数，默认 3 */
  maxFieldsPerEntry?: number
  /** 大纲等强一致性链路：所有可见词条及完整详情必须出现，供确认后 AI 语义压缩。 */
  complete?: boolean
}

interface CompleteCodexEntry {
  ordinal: number
  prefix: string
  details: string
}

interface CompleteCodexCategory {
  heading: string
  entries: CompleteCodexEntry[]
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseTags(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      : []
  } catch {
    return []
  }
}

function renderCompleteCodex(
  categories: CompleteCodexCategory[],
  entryCount: number,
): string {
  const blocks = [
    `【设定词条 · 全量 ${entryCount}/${entryCount} 条】（作者设定，写作时须遵守，勿自创冲突设定）`,
  ]
  for (const category of categories) {
    const lines = [category.heading]
    for (const entry of category.entries) {
      lines.push(`- [词条#${entry.ordinal}] ${entry.prefix}`)
      lines.push(`  详情：${entry.details || '（未填写）'}`)
    }
    blocks.push(lines.join('\n'))
  }
  blocks.push(`【词条完整性】${entryCount}/${entryCount} 条及其原始详情均已完整载入。`)
  return blocks.join('\n')
}

/**
 * 构建词条上下文。
 * @param worldGroupId 多世界：所属世界组；null/undefined = 主世界/单世界（未归属世界组的词条）
 */
export async function buildCodexContext(
  projectId: number,
  worldGroupId?: number | null,
  opts: BuildOptions = {},
): Promise<string> {
  const maxChars = opts.maxChars ?? 2500
  const maxPerCategory = opts.maxPerCategory ?? 30
  const maxFields = opts.maxFieldsPerEntry ?? 3

  const [allCats, allEntries] = await Promise.all([
    db.codexCategories.where('projectId').equals(projectId).toArray(),
    db.codexEntries.where('projectId').equals(projectId).toArray(),
  ])
  if (allEntries.length === 0) return ''

  const wg = worldGroupId ?? null
  // 全局项（worldGroupId=null，如内置分类）在任何世界都可见；
  // 世界专属项仅在其所属世界可见。单世界（wg=null）时只含全局项。
  const inWorld = <T extends { worldGroupId?: number | null }>(x: T) => {
    const w = x.worldGroupId ?? null
    return w === null || w === wg
  }

  // 仅取当前世界、未隐藏分类下的词条
  const cats = allCats
    .filter(c => !c.hidden && inWorld(c))
    .sort((a, b) => a.order - b.order)
  const catById = new Map<number, CodexCategory>(cats.map(c => [c.id!, c]))

  const entriesByCat = new Map<number, CodexEntry[]>()
  for (const e of allEntries) {
    if (!inWorld(e)) continue
    if (!catById.has(e.categoryId)) continue
    const list = entriesByCat.get(e.categoryId) || []
    list.push(e)
    entriesByCat.set(e.categoryId, list)
  }
  if (entriesByCat.size === 0) return ''

  if (opts.complete) {
    const visibleEntries = Array.from(entriesByCat.values()).flat()
    const entryById = new Map(visibleEntries.map(entry => [entry.id!, entry]))
    const completeCategories: CompleteCodexCategory[] = []
    let entryCount = 0
    let ordinal = 0

    for (const cat of cats) {
      const list = (entriesByCat.get(cat.id!) || [])
        .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || a.order - b.order)
      if (!list.length) continue
      const schema = parseFieldSchema(cat.fieldSchema)
      const entries = list.map(entry => {
        ordinal += 1
        const fields = parseEntryFields(entry.fields)
        const refs = parseEntryRefs(entry.refs)
        const tags = parseTags(entry.tags)
        const details = [
          entry.summary.trim() ? `简介=${compactWhitespace(entry.summary)}` : '',
          entry.description.trim() ? `详情=${compactWhitespace(entry.description)}` : '',
          ...schema.map(definition => {
            if (definition.type === 'ref') {
              const names = (refs[definition.key] || [])
                .map(id => entryById.get(id)?.name.trim())
                .filter((name): name is string => Boolean(name))
              return names.length ? `${definition.label}=${names.join('、')}` : ''
            }
            const value = compactWhitespace(fields[definition.key] || '')
            return value ? `${definition.label}=${value}` : ''
          }),
          tags.length ? `标签=${tags.join('、')}` : '',
        ].filter(Boolean).join('；')
        const stars = (entry.importance ?? 0) > 0
          ? `${'★'.repeat(Math.min(5, entry.importance!))} `
          : ''
        return {
          ordinal,
          prefix: `${stars}${compactWhitespace(entry.name)}`,
          details,
        }
      })
      entryCount += entries.length
      completeCategories.push({ heading: `[${cat.icon || ''} ${cat.name}]`, entries })
    }

    return renderCompleteCodex(completeCategories, entryCount)
  }

  const blocks: string[] = ['【设定词条】（作者设定，写作时须遵守，勿自创冲突设定）']

  for (const cat of cats) {
    // 按重要度降序优先(高星地点等先占预算、截断时先保住),同星级再按 order
    const list = (entriesByCat.get(cat.id!) || [])
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || a.order - b.order)
    if (list.length === 0) continue

    const schema = parseFieldSchema(cat.fieldSchema)
    // 选取适合内联的字段（非 ref，有 label）
    const inlineDefs = schema.filter(d => d.type !== 'ref').slice(0, maxFields)

    const lines: string[] = [`[${cat.icon || ''} ${cat.name}]`]
    for (const entry of list.slice(0, maxPerCategory)) {
      const fields = parseEntryFields(entry.fields)
      const attrs = inlineDefs
        .map(d => {
          const v = (fields[d.key] || '').trim()
          return v ? `${d.label}:${v.slice(0, 40)}` : ''
        })
        .filter(Boolean)
      const stars = (entry.importance ?? 0) > 0 ? '★'.repeat(Math.min(5, entry.importance!)) + ' ' : ''
      const head = `- ${stars}${entry.name}${entry.summary ? `：${entry.summary.slice(0, 60)}` : ''}`
      lines.push(attrs.length ? `${head}（${attrs.join('；')}）` : head)
    }
    blocks.push(lines.join('\n'))
  }

  if (blocks.length <= 1) return ''
  const text = blocks.join('\n')
  return text.length > maxChars ? text.slice(0, maxChars) + '\n…（词条较多，已截断）' : text
}
