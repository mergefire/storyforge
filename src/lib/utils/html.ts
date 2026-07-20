/**
 * HTML 与纯文本互转工具
 * 用于 TipTap 富文本 <-> 旧纯文本内容 的双向兼容
 */

/** 判断字符串是否为 HTML（启发式：包含任意 HTML 标签） */
export function isHtml(s: string): boolean {
  if (!s) return false
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

/**
 * 纯文本 → HTML。
 *
 * AI 正文通常用两个换行符分隔普通段落；编辑器的 <p> 已自带段间距，
 * 因此不能再把其中那一条空白行转换成额外的空段落。只有连续两条及以上
 * 空白行才视为作者明确保留的场景分隔，并收敛为一个空段落。
 */
export function plainTextToHtml(text: string): string {
  if (!text) return ''
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const paragraphs: string[] = []
  let blankLineCount = 0

  for (const line of lines) {
    if (line.trim().length === 0) {
      blankLineCount += 1
      continue
    }

    if (paragraphs.length > 0 && blankLineCount >= 2) {
      paragraphs.push('<p></p>')
    }
    paragraphs.push(`<p>${escape(line)}</p>`)
    blankLineCount = 0
  }

  return paragraphs.join('')
}

/** 纯文本 → 行内 HTML：用于单段选区替换，避免把新的 <p> 节点嵌入原段落。 */
export function plainTextToInlineHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br>')
}

/** 将任意内容（可能是 HTML 或纯文本）标准化为 HTML */
export function toHtml(content: string): string {
  if (!content) return ''
  return isHtml(content) ? content : plainTextToHtml(content)
}

/** HTML → 纯文本（剥离标签，段落之间用 \n 分隔） */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  if (!isHtml(html)) return html
  if (typeof document === 'undefined') {
    // SSR fallback：简单去标签
    return html
      .replace(/<\/(p|div|h[1-6]|li|blockquote|br)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  // 将块级元素转为换行
  const blocks = tmp.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,br')
  blocks.forEach(el => {
    if (el.tagName === 'BR') {
      el.replaceWith('\n')
    } else {
      el.append('\n')
    }
  })
  return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

/** 统计字数（中文按字符数、英文按单词拆分再合计） */
export function countWords(plainText: string): number {
  if (!plainText) return 0
  // 简化处理：直接返回非空白字符数（与旧实现一致）
  return plainText.replace(/\s/g, '').length
}
