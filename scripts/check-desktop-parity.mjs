import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const ROOT = resolve(import.meta.dirname, '..')
const BASELINE_PATH = resolve(ROOT, 'docs/windows-desktop/feature-parity-baseline.json')
const REPORT_PATH = resolve(ROOT, 'docs/windows-desktop/FEATURE-PARITY-REPORT.md')
const SOURCE_COMMIT = '52819e7'
const SCANNER_VERSION = 1

const EXCLUSIONS = new Map([
  ['src/components/settings/NS0EvalPanel.tsx', '开发评测面板，不进入生产导航或稳定桌面身份'],
  ['src/runtime/tauri/dev-smoke.ts', '仅供 dev identity 的合成实机验收钩子'],
])

const RUNTIME_CALLEES = new Set([
  'executeAiRequest', 'bindAiCredential', 'deleteAiCredential',
  'setInterval', 'setTimeout', 'addEventListener',
])

function slash(value) {
  return value.replaceAll('\\', '/')
}

function digest(value, length = 16) {
  return createHash('sha256').update(value).digest('hex').slice(0, length)
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function literal(node) {
  return ts.isStringLiteralLike(node) ? node.text : undefined
}

function sourceLocation(source, node) {
  const point = source.getLineAndCharacterOfPosition(node.getStart(source))
  return { line: point.line + 1, column: point.character + 1 }
}

function fpId(kind, actionId) {
  return `FP-${kind.toUpperCase().replaceAll('_', '-')}-${digest(actionId, 12).toUpperCase()}`
}

function makeAction(kind, signature, source, node, details = {}) {
  const actionId = `${kind}:${digest(`${source}|${signature}`)}`
  return {
    actionId,
    fpId: fpId(kind, actionId),
    kind,
    signature,
    source,
    ...(node ? sourceLocation(details.sourceFile, node) : {}),
    status: 'REGISTERED_M1',
    evidence: kind === 'runtime'
      ? 'tests/desktop-contract/tauri-runtime.test.ts'
      : kind === 'route' || kind === 'sidebar' || kind === 'dispatch'
        ? 'npm run check:desktop-routes'
        : 'npm test + M1 synthetic desktop contract',
    ...details.extra,
  }
}

function jsxLabel(opening, source) {
  const attributes = opening.attributes.properties
  for (const attribute of attributes) {
    if (!ts.isJsxAttribute(attribute)) continue
    const name = attribute.name.getText(source)
    if (!['aria-label', 'title', 'name', 'type'].includes(name)) continue
    if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
      return `${name}=${normalize(attribute.initializer.text)}`
    }
  }
  return opening.tagName.getText(source)
}

function scanSource(fileName) {
  const sourcePath = slash(relative(ROOT, fileName))
  if (EXCLUSIONS.has(sourcePath)) return []
  const sourceText = readFileSync(fileName, 'utf8')
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const found = []

  function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const eventName = node.name.getText(sourceFile)
      if (/^on[A-Z]/.test(eventName) && node.initializer) {
        const opening = node.parent.parent
        const handler = normalize(node.initializer.getText(sourceFile))
        const label = ts.isJsxOpeningLikeElement(opening) ? jsxLabel(opening, sourceFile) : 'jsx'
        found.push(makeAction(
          'ui',
          `${eventName}|${label}|${handler}`,
          sourcePath,
          node,
          { sourceFile },
        ))
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = normalize(node.expression.getText(sourceFile))
      const isRuntime = /getRuntime\(\)\.(ai|gist|files|secrets|clipboard|external|durability|distribution|updates|diagnostics)\./.test(callee)
        || RUNTIME_CALLEES.has(callee.split('.').at(-1))
      if (isRuntime) {
        const signature = `${callee}|${normalize(node.arguments.map(argument => argument.getText(sourceFile)).join(','))}`
        found.push(makeAction('runtime', signature, sourcePath, node, { sourceFile }))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function parseAppRoutes() {
  const fileName = resolve(ROOT, 'src/App.tsx')
  const sourcePath = 'src/App.tsx'
  const sourceFile = ts.createSourceFile(fileName, readFileSync(fileName, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const actions = []
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'Route') {
      const pathAttribute = node.attributes.properties.find(property =>
        ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'path')
      if (pathAttribute && ts.isJsxAttribute(pathAttribute) && pathAttribute.initializer && ts.isStringLiteral(pathAttribute.initializer)) {
        const path = pathAttribute.initializer.text
        actions.push(makeAction('route', `route:${path}`, sourcePath, node, {
          sourceFile,
          extra: { route: path },
        }))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return actions
}

function parseSidebarContract() {
  const fileName = resolve(ROOT, 'src/components/layout/sidebar-tree.ts')
  const sourcePath = 'src/components/layout/sidebar-tree.ts'
  const sourceFile = ts.createSourceFile(fileName, readFileSync(fileName, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const modules = new Set()
  const visible = new Set()
  const actions = []

  function visit(node) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'SidebarModule') {
      function collect(typeNode) {
        if (ts.isUnionTypeNode(typeNode)) typeNode.types.forEach(collect)
        else if (ts.isLiteralTypeNode(typeNode)) {
          const value = literal(typeNode.literal)
          if (value) modules.add(value)
        }
      }
      collect(node.type)
    }
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'leaf') {
      const value = node.arguments[0] && literal(node.arguments[0])
      if (value) {
        visible.add(value)
        actions.push(makeAction('sidebar', `sidebar:${value}`, sourcePath, node, {
          sourceFile,
          extra: { module: value },
        }))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const workspaceFile = resolve(ROOT, 'src/pages/WorkspacePage.tsx')
  const workspacePath = 'src/pages/WorkspacePage.tsx'
  const workspace = ts.createSourceFile(workspaceFile, readFileSync(workspaceFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const dispatch = new Map()
  function visitWorkspace(node) {
    if (ts.isCaseClause(node)) {
      const value = literal(node.expression)
      if (value) dispatch.set(value, node)
    }
    ts.forEachChild(node, visitWorkspace)
  }
  visitWorkspace(workspace)

  const missingDispatch = [...modules].filter(module => !dispatch.has(module))
  if (missingDispatch.length > 0) {
    throw new Error(`SidebarModule without Workspace dispatch: ${missingDispatch.join(', ')}`)
  }
  const unknownDispatch = [...dispatch].map(([module]) => module).filter(module => !modules.has(module))
  if (unknownDispatch.length > 0) {
    throw new Error(`Workspace dispatch not declared by SidebarModule: ${unknownDispatch.join(', ')}`)
  }
  for (const module of [...modules].sort()) {
    const node = dispatch.get(module)
    actions.push(makeAction('dispatch', `dispatch:${module}`, workspacePath, node, {
      sourceFile: workspace,
      extra: { module, visibility: visible.has(module) ? 'visible' : 'compatibility' },
    }))
  }
  return actions
}

function discover() {
  const sourceFiles = ts.sys.readDirectory(resolve(ROOT, 'src'), ['.ts', '.tsx'], undefined, ['**/*'])
    .filter(file => !file.endsWith('.d.ts'))
    .filter(file => !/\.(test|spec)\.[^.]+$/.test(file))
  const actions = [
    ...parseAppRoutes(),
    ...parseSidebarContract(),
    ...sourceFiles.flatMap(scanSource),
  ]
  const groups = Object.groupBy(actions, action => action.actionId)
  for (const group of Object.values(groups)) {
    if (!group || group.length < 2) continue
    group
      .sort((left, right) => left.source.localeCompare(right.source)
        || (left.line ?? 0) - (right.line ?? 0)
        || (left.column ?? 0) - (right.column ?? 0))
      .forEach((action, index) => {
        action.signature = `${action.signature}|occurrence:${index + 1}`
        action.actionId = `${action.kind}:${digest(`${action.source}|${action.signature}`)}`
        action.fpId = fpId(action.kind, action.actionId)
      })
  }
  const seen = new Map()
  for (const action of actions) {
    const existing = seen.get(action.actionId)
    if (existing) {
      throw new Error(`Duplicate actionId ${action.actionId}: ${existing.source} and ${action.source}`)
    }
    seen.set(action.actionId, action)
  }
  return actions.sort((left, right) => left.actionId.localeCompare(right.actionId))
}

function baselineDocument(actions) {
  return {
    schemaVersion: 1,
    scannerVersion: SCANNER_VERSION,
    sourceCommit: SOURCE_COMMIT,
    policy: {
      unknownStatusFails: true,
      blockedStatusFails: true,
      sourceExecutionForbidden: true,
    },
    exclusions: [...EXCLUSIONS].map(([source, reason]) => ({ source, reason })),
    actions,
  }
}

function report(document) {
  const counts = Object.groupBy(document.actions, action => action.kind)
  const count = kind => counts[kind]?.length ?? 0
  const lines = [
    '# Windows Desktop Feature Parity Report',
    '',
    `- Source freeze: \`${document.sourceCommit}\``,
    `- Scanner: v${document.scannerVersion} (TypeScript AST; production modules are never executed)`,
    `- Registered actions: **${document.actions.length}**`,
    `- Routes: ${count('route')}; visible sidebar leaves: ${count('sidebar')}; workspace dispatch cases: ${count('dispatch')}; UI handlers: ${count('ui')}; runtime/background calls: ${count('runtime')}`,
    '- Gate: any added/deleted/unmapped action, duplicate actionId/FP ID, UNKNOWN, or BLOCKED status fails `npm run check:desktop-parity`.',
    '',
    '## Explicit exclusions',
    '',
    '| Source | Reason |',
    '| --- | --- |',
    ...document.exclusions.map(item => `| \`${item.source}\` | ${item.reason} |`),
    '',
    '## Acceptance registry',
    '',
    '| actionId | FP ID | Kind | Source | Status | Evidence |',
    '| --- | --- | --- | --- | --- | --- |',
    ...document.actions.map(action =>
      `| \`${action.actionId}\` | \`${action.fpId}\` | ${action.kind} | \`${action.source}:${action.line ?? 1}\` | ${action.status} | ${action.evidence} |`),
    '',
  ]
  return lines.join('\n')
}

function canonicalActions(actions) {
  return actions.map(({ actionId, fpId, kind, signature, source, status, evidence, route, module, visibility }) => ({
    actionId, fpId, kind, signature, source, status, evidence, route, module, visibility,
  }))
}

const write = process.argv.includes('--write')
const actions = discover()
const document = baselineDocument(actions)
if (write) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(document, null, 2)}\n`)
  writeFileSync(REPORT_PATH, report(document))
  console.log(`Wrote ${actions.length} desktop action registrations.`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const statuses = new Set(baseline.actions.map(action => action.status))
if (statuses.has('UNKNOWN') || statuses.has('BLOCKED')) {
  throw new Error(`Desktop parity baseline contains failing status: ${[...statuses].join(', ')}`)
}
const fpIds = baseline.actions.map(action => action.fpId)
if (new Set(fpIds).size !== fpIds.length) throw new Error('Desktop parity baseline contains duplicate FP IDs')
if (JSON.stringify(canonicalActions(baseline.actions)) !== JSON.stringify(canonicalActions(actions))) {
  throw new Error('Desktop action inventory drifted. Review production changes and run `npm run generate:desktop-parity`.')
}
if (readFileSync(REPORT_PATH, 'utf8') !== report(baseline)) {
  throw new Error('FEATURE-PARITY-REPORT.md is stale. Run `npm run generate:desktop-parity`.')
}
console.log(`Desktop parity registry OK: ${actions.length} actions, ${fpIds.length} unique FP IDs.`)
