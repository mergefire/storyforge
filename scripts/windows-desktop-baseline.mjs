#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  canonicalFixtureManifestJson,
  validateFixtureManifest,
  verifyFixtureManifest,
} from './lib/windows-desktop-fixture-manifest.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')

const paths = {
  packageJson: path.join(repoRoot, 'package.json'),
  packageLock: path.join(repoRoot, 'package-lock.json'),
  protocol: path.join(repoRoot, 'docs', 'windows-desktop', 'BASELINE-PROTOCOL.md'),
  referenceEnvironment: path.join(repoRoot, 'docs', 'windows-desktop', 'REFERENCE-ENVIRONMENT.md'),
  fixtureSpec: path.join(repoRoot, 'docs', 'windows-desktop', 'baseline-fixtures.json'),
  reportSchema: path.join(repoRoot, 'docs', 'windows-desktop', 'schemas', 'baseline-report.schema.json'),
  sampleReport: path.join(repoRoot, 'docs', 'windows-desktop', 'samples', 'baseline-report.not-measured.json'),
  fixtureArtifactManifest: path.join(
    repoRoot,
    'tests',
    'fixtures',
    'windows-desktop',
    'd0.4-v1',
    'fixture-manifest.json',
  ),
  registry: path.join(repoRoot, 'src', 'lib', 'registry', 'project-tables.ts'),
  databaseSchema: path.join(repoRoot, 'src', 'lib', 'db', 'schema.ts'),
}

export const PROTOCOL_VERSION = 'd0.4-v2'
export const LEGACY_PROTOCOL_VERSIONS = Object.freeze(['d0.4-v1'])
export const REQUIRED_REFERENCE_MODES = Object.freeze(['web-tab'])
export const SUPPLEMENTAL_REFERENCE_MODES = Object.freeze(['installed-pwa'])
const ALLOWED_REFERENCE_MODES = Object.freeze([
  ...REQUIRED_REFERENCE_MODES,
  ...SUPPLEMENTAL_REFERENCE_MODES,
])

export const PERFORMANCE_SCENARIO_IDS = Object.freeze([
  'PERF-START-COLD',
  'PERF-START-WARM',
  'PERF-OPEN-LARGE',
  'PERF-EDITOR-TYPE',
  'PERF-SAVE',
  'PERF-AI-STREAM',
  'PERF-MEM-30',
  'PERF-VIDEO-IDLE',
  'PERF-VIDEO-EDIT',
  'PERF-VIDEO-AI',
  'PERF-BLOB-10M',
  'PERF-BLOB-100M',
  'PERF-BLOB-500M',
  'PERF-BLOB-1G',
  'PERF-CANVAS',
])

export const SECURITY_SCENARIO_IDS = Object.freeze([
  'SEC-DATA-LOSS',
  'SEC-XSS-IPC',
  'SEC-SECRET',
  'SEC-CONTENT',
  'SEC-URL',
  'SEC-PATH',
  'SEC-UPDATE',
  'SEC-UDF',
])

export const FIXTURE_IDS = Object.freeze([
  'empty-v1',
  'small-v1',
  'large-synthetic-v1',
  'blob-ladder-v1',
  'legacy-matrix-v1',
  'real-anonymized-v1',
])

export const AGGREGATE_MINIMUM_SAMPLES = Object.freeze({
  min: 1,
  max: 1,
  p50: 30,
  mean: 30,
  standardDeviation: 30,
  p95: 200,
  p99: 1000,
})

const P95_PASS_REQUIREMENT = Object.freeze({
  minimumSamples: 200,
  requiredAggregates: Object.freeze(['p95']),
})
const SESSION_PASS_REQUIREMENT = Object.freeze({
  minimumSamples: 3,
  requiredAggregates: Object.freeze(['min', 'max']),
})

export const PERFORMANCE_PASS_REQUIREMENTS = Object.freeze({
  'PERF-START-COLD': P95_PASS_REQUIREMENT,
  'PERF-START-WARM': P95_PASS_REQUIREMENT,
  'PERF-OPEN-LARGE': P95_PASS_REQUIREMENT,
  'PERF-EDITOR-TYPE': P95_PASS_REQUIREMENT,
  'PERF-SAVE': P95_PASS_REQUIREMENT,
  'PERF-AI-STREAM': P95_PASS_REQUIREMENT,
  'PERF-MEM-30': SESSION_PASS_REQUIREMENT,
  'PERF-VIDEO-IDLE': SESSION_PASS_REQUIREMENT,
  'PERF-VIDEO-EDIT': SESSION_PASS_REQUIREMENT,
  'PERF-VIDEO-AI': SESSION_PASS_REQUIREMENT,
  'PERF-BLOB-10M': SESSION_PASS_REQUIREMENT,
  'PERF-BLOB-100M': SESSION_PASS_REQUIREMENT,
  'PERF-BLOB-500M': SESSION_PASS_REQUIREMENT,
  'PERF-BLOB-1G': SESSION_PASS_REQUIREMENT,
  'PERF-CANVAS': P95_PASS_REQUIREMENT,
})

const NULL_AGGREGATES = Object.freeze({
  min: null,
  p50: null,
  p95: null,
  p99: null,
  max: null,
  mean: null,
  standardDeviation: null,
})

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath))
}

export function readCommittedFixtureEvidence() {
  const raw = fs.readFileSync(paths.fixtureArtifactManifest)
  const text = raw.toString('utf8')
  const manifest = JSON.parse(text)
  validateFixtureManifest(manifest)
  if (canonicalFixtureManifestJson(manifest) !== text) {
    throw new Error('committed fixture manifest is not canonical JSON')
  }
  verifyFixtureManifest({
    manifest,
    fixtureRoot: path.dirname(paths.fixtureArtifactManifest),
  })
  return {
    manifest,
    manifestSha256: sha256(raw),
  }
}

export function canonicalSourceTextForFingerprint(value) {
  if (typeof value !== 'string') throw new TypeError('registry source must be a string')
  return value.replace(/\r\n?/g, '\n')
}

function sameMembers(actual, expected) {
  return actual.length === expected.length
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index])
}

function findForbiddenProperty(value, forbidden, currentPath = '$') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findForbiddenProperty(value[index], forbidden, currentPath + '[' + index + ']')
      if (result) return result
    }
    return null
  }
  if (!value || typeof value !== 'object') return null

  for (const [key, child] of Object.entries(value)) {
    if (key === forbidden) return currentPath + '.' + key
    const result = findForbiddenProperty(child, forbidden, currentPath + '.' + key)
    if (result) return result
  }
  return null
}

export function readRegistryFacts() {
  const source = fs.readFileSync(paths.registry, 'utf8')
  const declarationStart = source.indexOf('export const PROJECT_TABLES')
  const declarationEnd = source.indexOf('export const REGISTRY_BY_NAME')

  if (declarationStart < 0 || declarationEnd <= declarationStart) {
    throw new Error('Unable to locate PROJECT_TABLES declaration boundaries')
  }

  const declaration = source.slice(declarationStart, declarationEnd)
  const names = [...declaration.matchAll(/\bname:\s*['"]([A-Za-z0-9_]+)['"]/g)]
    .map(match => match[1])
  const uniqueNames = [...new Set(names)]

  if (names.length === 0 || uniqueNames.length !== names.length) {
    throw new Error('PROJECT_TABLES names are missing or duplicated')
  }

  return {
    count: uniqueNames.length,
    sourceSha256: sha256(Buffer.from(canonicalSourceTextForFingerprint(source), 'utf8')),
    nameSetSha256: sha256(Buffer.from([...uniqueNames].sort().join('\n'), 'utf8')),
  }
}

export function readDatabaseSchemaVersionFacts() {
  const source = fs.readFileSync(paths.databaseSchema, 'utf8')
  const versions = [...source.matchAll(/this\.version\((\d+)\)/g)]
    .map(match => Number(match[1]))
  const uniqueVersions = [...new Set(versions)].sort((left, right) => left - right)
  if (uniqueVersions.length === 0 || uniqueVersions.some(version => !Number.isInteger(version))) {
    throw new Error('No Dexie schema versions were derived from schema.ts')
  }
  return {
    count: uniqueVersions.length,
    minimum: uniqueVersions[0],
    maximum: uniqueVersions[uniqueVersions.length - 1],
    declarationSetSha256: sha256(Buffer.from(uniqueVersions.join('\n'), 'utf8')),
  }
}

function validateNotMeasuredPerformance(scenario, errors) {
  if (!scenario.reasonCode || typeof scenario.reasonCode !== 'string') {
    errors.push(scenario.id + ': NOT_MEASURED requires reasonCode')
  }
  if (scenario.verdict !== 'NOT_EVALUATED') {
    errors.push(scenario.id + ': NOT_MEASURED verdict must be NOT_EVALUATED')
  }
  if (scenario.sampleCount !== 0) {
    errors.push(scenario.id + ': NOT_MEASURED sampleCount must be 0')
  }
  if (scenario.rawSamplesPath !== null) {
    errors.push(scenario.id + ': NOT_MEASURED rawSamplesPath must be null')
  }
  if (!Array.isArray(scenario.evidence) || scenario.evidence.length !== 0) {
    errors.push(scenario.id + ': NOT_MEASURED evidence must be empty')
  }
  for (const key of Object.keys(NULL_AGGREGATES)) {
    if (!scenario.aggregates || scenario.aggregates[key] !== null) {
      errors.push(scenario.id + ': NOT_MEASURED aggregate ' + key + ' must be null')
    }
  }
}

function validateNotMeasuredSecurity(scenario, errors) {
  if (!scenario.reasonCode || typeof scenario.reasonCode !== 'string') {
    errors.push(scenario.id + ': NOT_MEASURED requires reasonCode')
  }
  if (scenario.verdict !== 'NOT_EVALUATED') {
    errors.push(scenario.id + ': NOT_MEASURED verdict must be NOT_EVALUATED')
  }
  if (!Array.isArray(scenario.observations) || scenario.observations.length !== 0) {
    errors.push(scenario.id + ': NOT_MEASURED observations must be empty')
  }
  if (!Array.isArray(scenario.evidence) || scenario.evidence.length !== 0) {
    errors.push(scenario.id + ': NOT_MEASURED evidence must be empty')
  }
}

function validateMeasuredPerformance(scenario, errors) {
  if (!['PASS', 'FAIL'].includes(scenario.verdict)) {
    errors.push(scenario.id + ': MEASURED verdict must be PASS or FAIL')
  }
  if (!Number.isInteger(scenario.sampleCount) || scenario.sampleCount < 1) {
    errors.push(scenario.id + ': MEASURED requires at least one sample')
  }
  if (!scenario.rawSamplesPath) errors.push(scenario.id + ': MEASURED requires rawSamplesPath')
  if (!Array.isArray(scenario.evidence) || scenario.evidence.length === 0) {
    errors.push(scenario.id + ': MEASURED requires evidence')
  }

  for (const [aggregate, minimumSamples] of Object.entries(AGGREGATE_MINIMUM_SAMPLES)) {
    const value = scenario.aggregates?.[aggregate]
    if (value === null) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(scenario.id + ': aggregate ' + aggregate + ' must be a finite number or null')
    } else if (scenario.sampleCount < minimumSamples) {
      errors.push(
        scenario.id + ': aggregate ' + aggregate + ' requires at least '
        + minimumSamples + ' samples',
      )
    }
  }

  if (scenario.verdict !== 'PASS') return
  const passRequirement = PERFORMANCE_PASS_REQUIREMENTS[scenario.id]
  if (!passRequirement) {
    errors.push(scenario.id + ': no PASS aggregate requirement is registered')
    return
  }
  if (scenario.sampleCount < passRequirement.minimumSamples) {
    errors.push(
      scenario.id + ': PASS requires at least '
      + passRequirement.minimumSamples + ' samples',
    )
  }
  for (const aggregate of passRequirement.requiredAggregates) {
    const value = scenario.aggregates?.[aggregate]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(scenario.id + ': PASS requires aggregate ' + aggregate)
    }
  }
}

export function validateReport(report, fixtureSpec, registryFacts) {
  const errors = []

  if (report.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0')
  if (LEGACY_PROTOCOL_VERSIONS.includes(report.protocolVersion)) {
    errors.push(
      'protocolVersion ' + report.protocolVersion
      + ' is legacy read-only; retain the artifact and regenerate it as ' + PROTOCOL_VERSION,
    )
  } else if (report.protocolVersion !== PROTOCOL_VERSION) {
    errors.push('protocolVersion must be ' + PROTOCOL_VERSION)
  }
  if (!report.reportId) errors.push('reportId is required')
  if (!['STATIC_ONLY', 'FULL_BASELINE'].includes(report.reportKind)) {
    errors.push('reportKind is invalid')
  }
  if (!['web-tab', 'installed-pwa', 'tauri-dev', 'desktop-production', 'not-launched'].includes(report.mode)) {
    errors.push('mode is invalid')
  }

  const functional = report.functional
  if (!functional || functional.required !== true) {
    errors.push('functional baseline gate is required')
  } else if (functional.status === 'NOT_MEASURED') {
    if (!functional.reasonCode) errors.push('functional: NOT_MEASURED requires reasonCode')
    if (functional.verdict !== 'NOT_EVALUATED') {
      errors.push('functional: NOT_MEASURED verdict must be NOT_EVALUATED')
    }
    if (functional.aggregateRowCount !== null || functional.actionCount !== null) {
      errors.push('functional: NOT_MEASURED counts must be null')
    }
    if (!Array.isArray(functional.evidence) || functional.evidence.length !== 0) {
      errors.push('functional: NOT_MEASURED evidence must be empty')
    }
  } else if (functional.status === 'MEASURED') {
    if (!['PASS', 'FAIL'].includes(functional.verdict)) {
      errors.push('functional: MEASURED verdict must be PASS or FAIL')
    }
    if (!(functional.aggregateRowCount > 0)) {
      errors.push('functional: MEASURED requires aggregate rows')
    }
    if (!Array.isArray(functional.evidence) || functional.evidence.length === 0) {
      errors.push('functional: MEASURED requires evidence')
    }
  } else if (!['BLOCKED', 'INVALID'].includes(functional.status)) {
    errors.push('functional: invalid collection status')
  } else if (functional.verdict !== 'NOT_EVALUATED' || !functional.reasonCode) {
    errors.push('functional: ' + functional.status + ' requires reasonCode and NOT_EVALUATED')
  }

  const comparison = report.comparison
  let comparisonComplete = false
  if (!comparison || !['COMPLETE', 'INCOMPLETE'].includes(comparison.status)) {
    errors.push('comparison status is invalid')
  } else {
    const referenceModes = Array.isArray(comparison.referenceModes)
      ? comparison.referenceModes
      : []
    const referenceReportIds = Array.isArray(comparison.referenceReportIds)
      ? comparison.referenceReportIds
      : []
    const evidence = Array.isArray(comparison.evidence) ? comparison.evidence : []

    if (!Array.isArray(comparison.referenceModes)) {
      errors.push('comparison referenceModes must be an array')
    }
    if (!Array.isArray(comparison.referenceReportIds)) {
      errors.push('comparison referenceReportIds must be an array')
    }
    if (!Array.isArray(comparison.evidence)) {
      errors.push('comparison evidence must be an array')
    }
    if (new Set(referenceModes).size !== referenceModes.length) {
      errors.push('comparison referenceModes must be unique')
    }
    if (referenceModes.some(mode => !ALLOWED_REFERENCE_MODES.includes(mode))) {
      errors.push('comparison referenceModes may contain only web-tab and installed-pwa')
    }
    if (new Set(referenceReportIds).size !== referenceReportIds.length) {
      errors.push('comparison referenceReportIds must be unique')
    }

    const requiredReferenceReady = REQUIRED_REFERENCE_MODES.every(mode => (
      referenceModes.includes(mode)
    ))
      && referenceReportIds.length === referenceModes.length
      && referenceReportIds.length >= REQUIRED_REFERENCE_MODES.length
      && new Set(referenceModes).size === referenceModes.length
      && new Set(referenceReportIds).size === referenceReportIds.length
      && referenceModes.every(mode => ALLOWED_REFERENCE_MODES.includes(mode))
      && evidence.length > 0

    if (comparison.status === 'INCOMPLETE') {
      if (!comparison.reasonCode) errors.push('incomplete comparison requires reasonCode')
      if (requiredReferenceReady) {
        errors.push(
          'comparison status must be COMPLETE when web-tab report ID and evidence are present; installed-pwa is optional',
        )
      }
    } else {
      comparisonComplete = comparison.reasonCode === null && requiredReferenceReady
      if (!comparisonComplete) {
        errors.push(
          'complete comparison requires web-tab report ID and evidence; installed-pwa is optional',
        )
      }
    }
  }

  const performanceIds = Array.isArray(report.performance)
    ? report.performance.map(scenario => scenario.id)
    : []
  const securityIds = Array.isArray(report.security)
    ? report.security.map(scenario => scenario.id)
    : []
  if (!sameMembers(performanceIds, PERFORMANCE_SCENARIO_IDS)) {
    errors.push('performance scenario IDs do not match the protocol')
  }
  if (!sameMembers(securityIds, SECURITY_SCENARIO_IDS)) {
    errors.push('security scenario IDs do not match the protocol')
  }

  for (const scenario of report.performance || []) {
    if (scenario.required !== true) errors.push(scenario.id + ': required must be true')
    if (scenario.status === 'NOT_MEASURED') {
      validateNotMeasuredPerformance(scenario, errors)
    } else if (scenario.status === 'MEASURED') {
      validateMeasuredPerformance(scenario, errors)
    } else if (!['BLOCKED', 'INVALID'].includes(scenario.status)) {
      errors.push(scenario.id + ': invalid collection status')
    } else if (scenario.verdict !== 'NOT_EVALUATED' || !scenario.reasonCode) {
      errors.push(scenario.id + ': ' + scenario.status + ' requires reasonCode and NOT_EVALUATED')
    }
  }

  for (const scenario of report.security || []) {
    if (scenario.required !== true) errors.push(scenario.id + ': required must be true')
    if (scenario.status === 'NOT_MEASURED') {
      validateNotMeasuredSecurity(scenario, errors)
    } else if (scenario.status === 'MEASURED') {
      if (!['PASS', 'FAIL'].includes(scenario.verdict)) {
        errors.push(scenario.id + ': MEASURED verdict must be PASS or FAIL')
      }
      if (!Array.isArray(scenario.observations) || scenario.observations.length === 0) {
        errors.push(scenario.id + ': MEASURED requires observations')
      }
      if (!Array.isArray(scenario.evidence) || scenario.evidence.length === 0) {
        errors.push(scenario.id + ': MEASURED requires evidence')
      }
    } else if (!['BLOCKED', 'INVALID'].includes(scenario.status)) {
      errors.push(scenario.id + ': invalid collection status')
    } else if (scenario.verdict !== 'NOT_EVALUATED' || !scenario.reasonCode) {
      errors.push(scenario.id + ': ' + scenario.status + ' requires reasonCode and NOT_EVALUATED')
    }
  }

  const fixtureIds = Array.isArray(report.fixtures?.states)
    ? report.fixtures.states.map(fixture => fixture.id)
    : []
  if (!sameMembers(fixtureIds, fixtureSpec.fixtures.map(fixture => fixture.id))) {
    errors.push('fixture state IDs do not match baseline-fixtures.json')
  }
  if (report.fixtures?.specVersion !== fixtureSpec.fixtureSpecVersion) {
    errors.push('fixture spec version does not match')
  }
  if (report.fixtures?.registryTableCount !== registryFacts.count) {
    errors.push('registry table count is stale')
  }
  if (report.fixtures?.registryFingerprint !== registryFacts.sourceSha256) {
    errors.push('registry fingerprint is stale')
  }

  for (const fixture of fixtureSpec.fixtures) {
    const state = report.fixtures?.states?.find(candidate => candidate.id === fixture.id)
    if (!state) continue
    if (state.required !== fixture.required) {
      errors.push(fixture.id + ': required flag does not match fixture specification')
    }
    if (state.artifactStatus !== fixture.artifactStatus) {
      errors.push(fixture.id + ': artifact status does not match fixture specification')
    }
    if (state.artifactStatus === 'GENERATED_VALID') {
      if (!/^[a-f0-9]{64}$/.test(state.manifestSha256 || '')) {
        errors.push(fixture.id + ': GENERATED_VALID requires manifestSha256')
      }
    } else if (['NOT_GENERATED', 'NOT_AVAILABLE'].includes(state.artifactStatus)
      && state.manifestSha256 !== null) {
      errors.push(fixture.id + ': ungenerated fixture manifestSha256 must be null')
    }
  }

  const requiredScenarios = [functional, ...(report.performance || []), ...(report.security || [])]
    .filter(scenario => scenario?.required)
  const measured = requiredScenarios.filter(scenario => scenario.status === 'MEASURED')
  const passed = measured.filter(scenario => scenario.verdict === 'PASS')
  const failed = measured.filter(scenario => scenario.verdict === 'FAIL')
  const notEvaluated = requiredScenarios.length - measured.length
  const counts = report.overall?.requiredScenarioCounts
  const expectedCounts = {
    total: requiredScenarios.length,
    measured: measured.length,
    passed: passed.length,
    failed: failed.length,
    notEvaluated,
  }
  for (const [key, value] of Object.entries(expectedCounts)) {
    if (counts?.[key] !== value) errors.push('overall requiredScenarioCounts.' + key + ' is incorrect')
  }

  const requiredFixturesReady = fixtureSpec.fixtures
    .filter(fixture => fixture.required)
    .every(fixture => {
      const state = report.fixtures?.states?.find(candidate => candidate.id === fixture.id)
      return state?.artifactStatus === 'GENERATED_VALID'
        && /^[a-f0-9]{64}$/.test(state.manifestSha256 || '')
    })
  const environmentComplete = report.environment?.captureStatus === 'COMPLETE'
    && Array.isArray(report.environment.unresolvedFields)
    && report.environment.unresolvedFields.length === 0
  const sourceCommitResolved = /^[a-f0-9]{7,64}$/i.test(report.source?.sourceCommit || '')
  const fullBaselineEnvelope = report.reportKind === 'FULL_BASELINE'
    && report.mode !== 'not-launched'
    && environmentComplete
    && sourceCommitResolved
    && requiredFixturesReady
    && comparisonComplete

  let expectedEligibility = 'NOT_ELIGIBLE'
  if (notEvaluated === 0 && failed.length > 0) {
    expectedEligibility = 'ELIGIBLE_NO_GO'
  } else if (notEvaluated === 0
    && passed.length === requiredScenarios.length
    && fullBaselineEnvelope) {
    expectedEligibility = 'ELIGIBLE_GO'
  }

  if (report.overall?.eligibility !== expectedEligibility) {
    errors.push('overall eligibility must be ' + expectedEligibility + ' for the report evidence')
  }
  if (expectedEligibility === 'NOT_ELIGIBLE' && report.overall?.healthScore !== null) {
    errors.push('healthScore must be null while the report is NOT_ELIGIBLE')
  }

  return errors
}

export function validateStaticContract() {
  const errors = []
  for (const filePath of Object.values(paths)) {
    if (!fs.existsSync(filePath)) errors.push('missing required file: ' + path.relative(repoRoot, filePath))
  }
  if (errors.length) return errors

  const protocol = fs.readFileSync(paths.protocol, 'utf8')
  const referenceEnvironment = fs.readFileSync(paths.referenceEnvironment, 'utf8')
  const fixtureSpec = readJson(paths.fixtureSpec)
  const schema = readJson(paths.reportSchema)
  const sample = readJson(paths.sampleReport)
  const registryFacts = readRegistryFacts()
  const databaseSchemaVersions = readDatabaseSchemaVersionFacts()
  let fixtureEvidence = null
  try {
    fixtureEvidence = readCommittedFixtureEvidence()
  } catch (error) {
    errors.push('committed fixture evidence is invalid: ' + error.message)
  }

  for (const id of [...PERFORMANCE_SCENARIO_IDS, ...SECURITY_SCENARIO_IDS]) {
    if (!protocol.includes(id)) errors.push('protocol is missing scenario ' + id)
  }
  if (!sameMembers(Object.keys(PERFORMANCE_PASS_REQUIREMENTS), PERFORMANCE_SCENARIO_IDS)) {
    errors.push('performance PASS requirements do not cover every protocol scenario')
  }
  if (!protocol.includes('NOT_MEASURED') || !protocol.includes('NOT_ELIGIBLE')) {
    errors.push('protocol must state the unmeasured and ineligible status explicitly')
  }
  for (const [aggregate, minimumSamples] of [
    ['p50/mean/standardDeviation', 30],
    ['p95', 200],
    ['p99', 1000],
  ]) {
    if (!protocol.includes('至少需要 ' + minimumSamples)) {
      errors.push('protocol is missing the ' + aggregate + ' sample gate of ' + minimumSamples)
    }
  }

  const fixtureIds = fixtureSpec.fixtures?.map(fixture => fixture.id) || []
  if (!sameMembers(fixtureIds, FIXTURE_IDS)) {
    errors.push('fixture IDs do not match the D0.4 contract')
  }
  const duplicateFixtureIds = fixtureIds.filter((id, index) => fixtureIds.indexOf(id) !== index)
  if (duplicateFixtureIds.length) errors.push('fixture IDs are duplicated')
  const forbiddenPath = findForbiddenProperty(fixtureSpec, 'tableNames')
  if (forbiddenPath) errors.push('fixture spec contains forbidden second registry at ' + forbiddenPath)
  if (fixtureSpec.registryCoverage?.source !== 'src/lib/registry/project-tables.ts#PROJECT_TABLES') {
    errors.push('fixture registry coverage must point to PROJECT_TABLES')
  }
  const legacyMatrix = fixtureSpec.fixtures.find(fixture => fixture.id === 'legacy-matrix-v1')
  if (legacyMatrix?.expected?.currentlyDetectedRange?.minimum !== databaseSchemaVersions.minimum
    || legacyMatrix?.expected?.currentlyDetectedRange?.maximum !== databaseSchemaVersions.maximum) {
    errors.push('legacy fixture schema range is stale')
  }
  if (fixtureSpec.protocolVersion !== PROTOCOL_VERSION) {
    errors.push('fixture specification protocolVersion must be ' + PROTOCOL_VERSION)
  }
  if (fixtureEvidence) {
    const { manifest, manifestSha256 } = fixtureEvidence
    if (manifest.protocolVersion !== fixtureSpec.protocolVersion
      || manifest.fixtureSpecVersion !== fixtureSpec.fixtureSpecVersion) {
      errors.push('committed fixture manifest protocol/spec version is stale')
    }
    if (manifest.registry.count !== registryFacts.count
      || manifest.registry.sourceSha256 !== registryFacts.sourceSha256
      || manifest.registry.nameSetSha256 !== registryFacts.nameSetSha256) {
      errors.push('committed fixture manifest registry facts are stale')
    }
    for (const fixture of fixtureSpec.fixtures) {
      const generated = manifest.fixtures.find(candidate => candidate.id === fixture.id)
      if (generated && (fixture.artifactStatus !== 'GENERATED_VALID'
        || fixture.manifestSha256 !== manifestSha256
        || fixture.manifestPath !== 'tests/fixtures/windows-desktop/d0.4-v1/fixture-manifest.json'
        || fixture.artifactPath !== 'tests/fixtures/windows-desktop/d0.4-v1/' + generated.artifactPath
        || fixture.artifactBytes !== generated.byteLength
        || fixture.artifactSha256 !== generated.sha256
        || fixture.dataSourceCommit !== manifest.dataSourceCommit)) {
        errors.push(fixture.id + ': fixture specification is stale against committed manifest')
      }
      if (!generated && fixture.artifactStatus === 'GENERATED_VALID') {
        errors.push(fixture.id + ': GENERATED_VALID is missing from committed manifest')
      }
    }
  }

  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('report schema must use JSON Schema Draft 2020-12')
  }
  if (schema.properties?.protocolVersion?.const !== PROTOCOL_VERSION) {
    errors.push('report schema protocolVersion const is missing')
  }
  const comparisonSchema = schema.properties?.comparison
  const allowedReferenceModes = comparisonSchema?.properties?.referenceModes?.items?.enum || []
  if (!sameMembers(allowedReferenceModes, ALLOWED_REFERENCE_MODES)) {
    errors.push('report schema comparison reference modes are stale')
  }
  const completeComparisonSchema = comparisonSchema?.allOf?.find(clause => (
    clause.if?.properties?.status?.const === 'COMPLETE'
  ))?.then?.properties
  if (completeComparisonSchema?.referenceModes?.minItems !== REQUIRED_REFERENCE_MODES.length
    || completeComparisonSchema?.referenceModes?.contains?.const !== REQUIRED_REFERENCE_MODES[0]
    || completeComparisonSchema?.referenceReportIds?.minItems !== REQUIRED_REFERENCE_MODES.length) {
    errors.push('report schema must require only the web-tab reference for a complete comparison')
  }
  if (!schema.$defs?.performanceScenario || !schema.$defs?.securityScenario) {
    errors.push('report schema scenario definitions are missing')
  }
  const performanceSchemaText = JSON.stringify(schema.$defs?.performanceScenario || {})
  for (const minimumSamples of [30, 200, 1000]) {
    if (!performanceSchemaText.includes('"minimum":' + minimumSamples)) {
      errors.push('report schema is missing aggregate sample minimum ' + minimumSamples)
    }
  }

  errors.push(...validateReport(sample, fixtureSpec, registryFacts))
  if (sample.reportKind !== 'STATIC_ONLY' || sample.mode !== 'not-launched') {
    errors.push('sample report must be a not-launched static report')
  }
  if (sample.functional?.status !== 'NOT_MEASURED') {
    errors.push('sample report must not claim measured functional parity')
  }
  if (sample.comparison?.status !== 'INCOMPLETE') {
    errors.push('sample report must not claim complete required web-tab reference evidence')
  }
  if (sample.performance.some(scenario => scenario.status !== 'NOT_MEASURED')) {
    errors.push('sample report must not claim measured performance')
  }
  if (sample.security.some(scenario => scenario.status !== 'NOT_MEASURED')) {
    errors.push('sample report must not claim measured security')
  }
  if (fixtureEvidence) {
    const generatedIds = new Set(fixtureEvidence.manifest.fixtures.map(fixture => fixture.id))
    for (const state of sample.fixtures.states) {
      if (generatedIds.has(state.id)) {
        if (state.artifactStatus !== 'GENERATED_VALID'
          || state.manifestSha256 !== fixtureEvidence.manifestSha256) {
          errors.push(state.id + ': sample report fixture evidence is stale')
        }
      } else if (state.manifestSha256 !== null) {
        errors.push(state.id + ': incomplete sample fixture must not claim a manifest hash')
      }
    }
  }

  const dependencySignals = ['780 packages', '18', '1 low', '8 moderate', '7 high', '2 critical']
  for (const signal of dependencySignals) {
    if (!referenceEnvironment.includes(signal)) {
      errors.push('reference environment is missing npm ci summary signal: ' + signal)
    }
  }
  if (!referenceEnvironment.includes('不能把这些数量直接当作产品风险等级')) {
    errors.push('reference environment must state that npm audit counts are not a risk classification')
  }

  return errors
}

function safeToolVersion(command, args = ['--version']) {
  try {
    const executable = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')
      ? 'C:\\Windows\\System32\\cmd.exe'
      : command
    const executableArgs = executable.endsWith('cmd.exe')
      ? ['/d', '/c', command, ...args]
      : args
    return {
      status: 'MEASURED_STATIC',
      version: execFileSync(executable, executableArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10000,
        windowsHide: true,
      }).trim(),
    }
  } catch (error) {
    return {
      status: 'NOT_MEASURED',
      version: null,
      reasonCode: 'TOOL_VERSION_QUERY_FAILED_' + (error?.code || 'UNKNOWN'),
    }
  }
}

function compareVersionDirectories(left, right) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (rightParts[index] || 0) - (leftParts[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

function latestVersionDirectory(rootPath) {
  try {
    return fs.readdirSync(rootPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+\.\d+$/.test(entry.name))
      .map(entry => entry.name)
      .sort(compareVersionDirectories)[0] || null
  } catch {
    return null
  }
}

function captureBrowserRuntimeDirectories() {
  if (process.platform !== 'win32') return []
  const candidates = [
    {
      name: 'edge',
      installScope: 'system-x86',
      root: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application',
    },
    {
      name: 'edge',
      installScope: 'system-x64',
      root: 'C:\\Program Files\\Microsoft\\Edge\\Application',
    },
    {
      name: 'chrome',
      installScope: 'system-x86',
      root: 'C:\\Program Files (x86)\\Google\\Chrome\\Application',
    },
    {
      name: 'chrome',
      installScope: 'system-x64',
      root: 'C:\\Program Files\\Google\\Chrome\\Application',
    },
    {
      name: 'webview2',
      installScope: 'system-x86',
      root: 'C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application',
    },
    {
      name: 'webview2',
      installScope: 'system-x64',
      root: 'C:\\Program Files\\Microsoft\\EdgeWebView\\Application',
    },
  ]

  return candidates.flatMap(candidate => {
    const version = latestVersionDirectory(candidate.root)
    return version
      ? [{
          name: candidate.name,
          status: 'MEASURED_STATIC',
          version,
          installScope: candidate.installScope,
          versionSource: 'VERSION_DIRECTORY_NAME',
        }]
      : []
  })
}

function captureWindowsFacts() {
  if (process.platform !== 'win32') {
    return {
      status: 'NOT_MEASURED',
      reasonCode: 'STATIC_COLLECTOR_REQUIRES_WINDOWS',
      os: null,
      processors: [],
      videoControllers: [],
      browserRuntimes: [],
    }
  }

  const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture",
    "$cpu = @(Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors)",
    "$gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion)",
    "$runtimeCandidates = @(",
    "  @{ Name = 'edge'; Scope = 'system-x86'; Path = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },",
    "  @{ Name = 'edge'; Scope = 'system-x64'; Path = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },",
    "  @{ Name = 'chrome'; Scope = 'system-x86'; Path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },",
    "  @{ Name = 'chrome'; Scope = 'system-x64'; Path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }",
    ")",
    "$runtimes = @()",
    "foreach ($candidate in $runtimeCandidates) {",
    "  if (Test-Path -LiteralPath $candidate.Path) {",
    "    $version = (Get-Item -LiteralPath $candidate.Path).VersionInfo.ProductVersion",
    "    $runtimes += [pscustomobject]@{ name = $candidate.Name; status = 'MEASURED_STATIC'; version = $version; installScope = $candidate.Scope }",
    "  }",
    "}",
    "$webViewRoots = @('C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application', 'C:\\Program Files\\Microsoft\\EdgeWebView\\Application')",
    "foreach ($root in $webViewRoots) {",
    "  if (Test-Path -LiteralPath $root) {",
    "    $versionDirectory = Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name -Descending | Select-Object -First 1",
    "    if ($null -ne $versionDirectory) {",
    "      $runtimes += [pscustomobject]@{ name = 'webview2'; status = 'MEASURED_STATIC'; version = $versionDirectory.Name; installScope = 'system' }",
    "      break",
    "    }",
    "  }",
    "}",
    "[pscustomobject]@{ status = 'MEASURED_STATIC'; os = $os; processors = $cpu; videoControllers = $gpu; browserRuntimes = $runtimes } | ConvertTo-Json -Depth 6 -Compress",
  ].join('\r\n')

  try {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const rawOutput = execFileSync(powershell, [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      encoded,
    ], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
      windowsHide: true,
    })
    const outputEncoding = rawOutput[0] === 0xff && rawOutput[1] === 0xfe
      ? 'utf16le'
      : 'utf8'
    const output = rawOutput.toString(outputEncoding).replace(/^\uFEFF/, '').trim()
    return JSON.parse(output)
  } catch {
    return {
      status: 'NOT_MEASURED',
      reasonCode: 'WINDOWS_STATIC_QUERY_FAILED',
      os: null,
      processors: [],
      videoControllers: [],
      browserRuntimes: [],
    }
  }
}

function assertOutputInsideRepository(outputPath) {
  const relative = path.relative(repoRoot, outputPath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Output must be a new directory inside the repository')
  }
}

function optionValue(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return null
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(name + ' requires a value')
  }
  return args[index + 1]
}

function makeReportId(now) {
  return now.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z-static')
}

export function collectStatic(options = {}) {
  const contractErrors = validateStaticContract()
  if (contractErrors.length) {
    throw new Error('Baseline contract check failed:\n- ' + contractErrors.join('\n- '))
  }

  const now = new Date()
  const reportId = options.reportId || makeReportId(now)
  const outputPath = options.outputPath
    ? path.resolve(repoRoot, options.outputPath)
    : path.join(repoRoot, '.qa-reports', 'windows-desktop', reportId)
  assertOutputInsideRepository(outputPath)
  if (fs.existsSync(outputPath)) {
    throw new Error('Refusing to overwrite existing report directory: ' + outputPath)
  }

  const sourceCommit = options.sourceCommit || 'UNRESOLVED'
  if (sourceCommit !== 'UNRESOLVED' && !/^[a-fA-F0-9]{7,64}$/.test(sourceCommit)) {
    throw new Error('--source-commit must be a 7-64 character hexadecimal commit ID')
  }

  const packageJson = readJson(paths.packageJson)
  const fixtureSpec = readJson(paths.fixtureSpec)
  const sample = readJson(paths.sampleReport)
  const registryFacts = readRegistryFacts()
  const databaseSchemaVersions = readDatabaseSchemaVersionFacts()
  const committedFixtureEvidence = readCommittedFixtureEvidence()
  const windowsFacts = captureWindowsFacts()
  const browserRuntimeDirectories = captureBrowserRuntimeDirectories()
  const browserRuntimes = [...(windowsFacts.browserRuntimes || []), ...browserRuntimeDirectories]
    .filter((runtime, index, values) => values.findIndex(candidate => (
      candidate.name === runtime.name
      && candidate.version === runtime.version
      && candidate.installScope === runtime.installScope
    )) === index)
  const runtimeNames = new Set(browserRuntimes.map(runtime => runtime.name))
  const unresolvedFields = [
    'browserRuntimeConfiguration',
    'displayConfiguration',
    'fixtureArtifacts',
    'physicalPowerState',
    'videoFixture',
  ]
  if (sourceCommit === 'UNRESOLVED') unresolvedFields.push('sourceCommit')
  if (!runtimeNames.has('edge')) unresolvedFields.push('edgeVersion')
  if (!runtimeNames.has('chrome')) unresolvedFields.push('chromeVersion')
  if (!runtimeNames.has('webview2')) unresolvedFields.push('webView2Version')
  unresolvedFields.sort()

  const environment = {
    schemaVersion: '1.0.0',
    protocolVersion: PROTOCOL_VERSION,
    capturedAt: now.toISOString(),
    captureKind: 'STATIC_ONLY',
    privacy: {
      hostnameCaptured: false,
      usernameCaptured: false,
      environmentVariableValuesCaptured: false,
      browserProfilesRead: false,
      userProjectsRead: false,
    },
    repository: {
      appVersion: packageJson.version,
      sourceCommit,
      packageJsonSha256: sha256File(paths.packageJson),
      packageLockSha256: sha256File(paths.packageLock),
      registrySourceSha256: registryFacts.sourceSha256,
      registryTableCount: registryFacts.count,
      databaseSchemaVersionFacts: databaseSchemaVersions,
      fixtureSpecSha256: sha256File(paths.fixtureSpec),
      reportSchemaSha256: sha256File(paths.reportSchema),
    },
    nodeRuntime: {
      status: 'MEASURED_STATIC',
      version: process.version,
      architecture: process.arch,
      platform: process.platform,
    },
    hostRuntime: {
      status: 'MEASURED_STATIC',
      osRelease: os.release(),
      architecture: os.arch(),
      logicalProcessorCount: os.cpus().length,
      processorModel: os.cpus()[0]?.model || null,
      physicalMemoryBytes: os.totalmem(),
    },
    tools: {
      npm: safeToolVersion('npm.cmd'),
      rustc: safeToolVersion('rustc'),
    },
    browserRuntimes,
    windows: windowsFacts,
    unresolvedFields,
  }

  const fixtureManifest = {
    schemaVersion: '1.0.0',
    fixtureSpecVersion: fixtureSpec.fixtureSpecVersion,
    capturedAt: now.toISOString(),
    registry: {
      source: fixtureSpec.registryCoverage.source,
      tableCount: registryFacts.count,
      sourceSha256: registryFacts.sourceSha256,
      nameSetSha256: registryFacts.nameSetSha256,
      namesIncludedInManifest: false,
    },
    databaseSchemaVersions,
    fixtures: fixtureSpec.fixtures.map(fixture => {
      const committed = committedFixtureEvidence.manifest.fixtures
        .find(candidate => candidate.id === fixture.id)
      return {
        id: fixture.id,
        required: fixture.required,
        artifactStatus: fixture.artifactStatus,
        manifestSha256: committed ? committedFixtureEvidence.manifestSha256 : null,
      }
    }),
    assertionsExecuted: committedFixtureEvidence.manifest.fixtures
      .flatMap(fixture => fixture.assertions.map(assertion => assertion.id)),
    assertionStatus: 'PARTIAL_PASS',
    reasonCode: 'REQUIRED_FIXTURE_ARTIFACTS_INCOMPLETE',
  }

  const processRecord = {
    schemaVersion: '1.0.0',
    capturedAt: now.toISOString(),
    status: 'NOT_MEASURED',
    reasonCode: 'NO_APPLICATION_LAUNCHED',
    launchedProcesses: [],
    remoteDebuggingPorts: [],
    profileDirectories: [],
  }

  const report = structuredClone(sample)
  report.reportId = reportId
  report.generatedAt = now.toISOString()
  report.source.appVersion = packageJson.version
  report.source.sourceCommit = sourceCommit
  report.environment.unresolvedFields = unresolvedFields
  report.fixtures.registryTableCount = registryFacts.count
  report.fixtures.registryFingerprint = registryFacts.sourceSha256
  report.fixtures.states = fixtureManifest.fixtures

  const reportErrors = validateReport(report, fixtureSpec, registryFacts)
  if (reportErrors.length) {
    throw new Error('Generated static report is invalid:\n- ' + reportErrors.join('\n- '))
  }

  fs.mkdirSync(outputPath, { recursive: true })
  const writeJson = (name, value) => {
    fs.writeFileSync(path.join(outputPath, name), JSON.stringify(value, null, 2) + '\n', 'utf8')
  }
  writeJson('environment.json', environment)
  writeJson('fixture-manifest.json', fixtureManifest)
  writeJson('process-record.json', processRecord)
  writeJson('summary.json', report)
  fs.writeFileSync(path.join(outputPath, 'samples.ndjson'), '', 'utf8')
  fs.writeFileSync(path.join(outputPath, 'README.md'), [
    '# StoryForge Windows baseline static report',
    '',
    '- Report kind: STATIC_ONLY',
    '- Application/browser launched: no',
    '- Functional baseline: NOT_MEASURED',
    '- Performance scenarios: NOT_MEASURED',
    '- Dynamic security scenarios: NOT_MEASURED',
    '- Overall eligibility: NOT_ELIGIBLE',
    '',
    'This directory contains static repository and host facts only. It is not a Web, PWA, or desktop benchmark result.',
    '',
  ].join('\n'), 'utf8')

  return {
    outputPath,
    report,
    environment,
    fixtureManifest,
    processRecord,
  }
}

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/windows-desktop-baseline.mjs check',
    '  node scripts/windows-desktop-baseline.mjs collect-static [--output <repo-relative-dir>] [--source-commit <hex>]',
    '',
    'The static collector never launches a browser or application and never invokes Git.',
  ].join('\n'))
}

function runCli() {
  const [, , command, ...args] = process.argv
  if (command === 'check') {
    const errors = validateStaticContract()
    if (errors.length) {
      console.error('D0.4 baseline contract check failed:')
      for (const error of errors) console.error('- ' + error)
      process.exitCode = 1
      return
    }
    const registryFacts = readRegistryFacts()
    console.log('D0.4 baseline contract check passed.')
    console.log('PROJECT_TABLES entries derived: ' + registryFacts.count + '.')
    console.log('Measurement status remains NOT_ELIGIBLE; no browser or application was launched.')
    return
  }

  if (command === 'collect-static') {
    const sourceCommit = optionValue(args, '--source-commit') || 'UNRESOLVED'
    const output = optionValue(args, '--output')
    const result = collectStatic({
      sourceCommit,
      outputPath: output,
    })
    console.log('Static baseline report written to: ' + result.outputPath)
    console.log('Performance and dynamic security status: NOT_MEASURED.')
    console.log('Overall eligibility: NOT_ELIGIBLE.')
    return
  }

  printUsage()
  if (command && !['help', '--help', '-h'].includes(command)) process.exitCode = 1
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) runCli()
