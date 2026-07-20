export interface EditorSelectionSnapshot {
  from: number
  to: number
  text: string
  /** 只读邻文，供 AI 判断语境，不属于可写范围。 */
  beforeText: string
  /** 只读邻文，供 AI 判断语境，不属于可写范围。 */
  afterText: string
}

/**
 * 编辑器选区的瞬时展示信息。
 * snapshot 是可校验的写回边界；top/left 只用于定位浮动工具栏，不参与持久化。
 */
export interface EditorSelectionPresentation {
  snapshot: EditorSelectionSnapshot
  top: number
  left: number
  /** 每次重新选择/重新聚焦递增；用于让同一坐标的工具条可以重新出现。 */
  revision: number
  tooLong?: boolean
}
