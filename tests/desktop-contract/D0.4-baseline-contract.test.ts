import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  AGGREGATE_MINIMUM_SAMPLES,
  FIXTURE_IDS,
  PERFORMANCE_PASS_REQUIREMENTS,
  PERFORMANCE_SCENARIO_IDS,
  SECURITY_SCENARIO_IDS,
  readDatabaseSchemaVersionFacts,
  readRegistryFacts,
  validateReport,
  validateStaticContract,
} from '../../scripts/windows-desktop-baseline.mjs'

const root = process.cwd()
const fixtureSpecPath = path.join(
  root,
  'docs',
  'windows-desktop',
  'baseline-fixtures.json',
)
const samplePath = path.join(
  root,
  'docs',
  'windows-desktop',
  'samples',
  'baseline-report.not-measured.json',
)

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function containsProperty(value: unknown, property: string): boolean {
  if (Array.isArray(value)) {
    return value.some(item => containsProperty(item, property))
  }
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(
    ([key, child]) => key === property || containsProperty(child, property),
  )
}

function makeFullyMeasuredReport(): {
  fixtureSpec: any
  registryFacts: ReturnType<typeof readRegistryFacts>
  report: any
} {
  const fixtureSpec = readJson(fixtureSpecPath)
  const registryFacts = readRegistryFacts()
  const report = structuredClone(readJson(samplePath))
  const evidenceHash = '0'.repeat(64)

  report.reportKind = 'FULL_BASELINE'
  report.mode = 'desktop-production'
  report.source.sourceCommit = 'a'.repeat(40)
  report.environment.captureStatus = 'COMPLETE'
  report.environment.unresolvedFields = []
  report.fixtures.states = report.fixtures.states.map((fixture: any) => (
    fixture.required
      ? {
          ...fixture,
          artifactStatus: 'GENERATED_VALID',
          manifestSha256: evidenceHash,
        }
      : fixture
  ))
  report.functional = {
    ...report.functional,
    status: 'MEASURED',
    reasonCode: null,
    verdict: 'PASS',
    aggregateRowCount: 1,
    actionCount: null,
    evidence: ['evidence/functional.json'],
  }
  report.comparison = {
    status: 'COMPLETE',
    reasonCode: null,
    referenceModes: ['web-tab', 'installed-pwa'],
    referenceReportIds: ['web-baseline', 'pwa-baseline'],
    evidence: ['evidence/comparison.json'],
  }
  report.performance = report.performance.map((scenario: any) => ({
    ...scenario,
    status: 'MEASURED',
    reasonCode: null,
    verdict: 'PASS',
    sampleCount: 1000,
    aggregates: {
      min: 1,
      p50: 1,
      p95: 1,
      p99: 1,
      max: 1,
      mean: 1,
      standardDeviation: 0,
    },
    rawSamplesPath: 'samples.ndjson',
    evidence: ['evidence/' + scenario.id + '.json'],
  }))
  report.security = report.security.map((scenario: any) => ({
    ...scenario,
    status: 'MEASURED',
    reasonCode: null,
    verdict: 'PASS',
    observations: ['expected synthetic canary behavior observed'],
    evidence: ['evidence/' + scenario.id + '.json'],
  }))

  const requiredCount = Number(report.functional.required)
    + report.performance.filter((scenario: any) => scenario.required).length
    + report.security.filter((scenario: any) => scenario.required).length
  report.overall = {
    eligibility: 'ELIGIBLE_GO',
    reasonCodes: ['ALL_REQUIRED_GATES_PASSED'],
    healthScore: 100,
    requiredScenarioCounts: {
      total: requiredCount,
      measured: requiredCount,
      passed: requiredCount,
      failed: 0,
      notEvaluated: 0,
    },
  }

  return { fixtureSpec, registryFacts, report }
}

describe('D0.4 Windows baseline contract', () => {
  it('keeps the checked-in protocol, fixtures, schema and sample coherent', () => {
    expect(validateStaticContract()).toEqual([])
  })

  it('derives registry facts from PROJECT_TABLES instead of a copied table list', () => {
    const fixtureSpec = readJson(fixtureSpecPath)
    const registryFacts = readRegistryFacts()

    expect(registryFacts.count).toBeGreaterThan(0)
    expect(registryFacts.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(registryFacts.nameSetSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(fixtureSpec.registryCoverage.source).toBe(
      'src/lib/registry/project-tables.ts#PROJECT_TABLES',
    )
    expect(containsProperty(fixtureSpec, 'tableNames')).toBe(false)
    expect(fixtureSpec.fixtures.map((fixture: any) => fixture.id).sort()).toEqual(
      [...FIXTURE_IDS].sort(),
    )

    const schemaVersions = readDatabaseSchemaVersionFacts()
    const legacyMatrix = fixtureSpec.fixtures.find(
      (fixture: any) => fixture.id === 'legacy-matrix-v1',
    )
    expect(legacyMatrix.expected.currentlyDetectedRange).toEqual({
      minimum: schemaVersions.minimum,
      maximum: schemaVersions.maximum,
    })
  })

  it('freezes rigorous aggregate sample gates for every performance scenario', () => {
    expect(AGGREGATE_MINIMUM_SAMPLES).toEqual({
      min: 1,
      max: 1,
      p50: 30,
      mean: 30,
      standardDeviation: 30,
      p95: 200,
      p99: 1000,
    })
    expect(Object.keys(PERFORMANCE_PASS_REQUIREMENTS).sort()).toEqual(
      [...PERFORMANCE_SCENARIO_IDS].sort(),
    )
  })

  it('does not turn an unexecuted sample into performance or security evidence', () => {
    const fixtureSpec = readJson(fixtureSpecPath)
    const sample = readJson(samplePath)
    const registryFacts = readRegistryFacts()

    expect(validateReport(sample, fixtureSpec, registryFacts)).toEqual([])
    expect(sample.performance.map((scenario: any) => scenario.id).sort()).toEqual(
      [...PERFORMANCE_SCENARIO_IDS].sort(),
    )
    expect(sample.security.map((scenario: any) => scenario.id).sort()).toEqual(
      [...SECURITY_SCENARIO_IDS].sort(),
    )
    expect(sample.performance.every((scenario: any) => (
      scenario.status === 'NOT_MEASURED'
      && scenario.sampleCount === 0
      && Object.values(scenario.aggregates).every(value => value === null)
    ))).toBe(true)
    expect(sample.security.every((scenario: any) => (
      scenario.status === 'NOT_MEASURED'
      && scenario.observations.length === 0
      && scenario.evidence.length === 0
    ))).toBe(true)
    expect(sample.overall).toMatchObject({
      eligibility: 'NOT_ELIGIBLE',
      healthScore: null,
    })
    const expectedRequiredCount = Number(sample.functional.required)
      + sample.performance.filter((scenario: any) => scenario.required).length
      + sample.security.filter((scenario: any) => scenario.required).length
    expect(sample.overall.requiredScenarioCounts).toEqual({
      total: expectedRequiredCount,
      measured: 0,
      passed: 0,
      failed: 0,
      notEvaluated: expectedRequiredCount,
    })
  })

  it('rejects fabricated samples on a NOT_MEASURED scenario', () => {
    const fixtureSpec = readJson(fixtureSpecPath)
    const sample = readJson(samplePath)
    const registryFacts = readRegistryFacts()
    const fabricated = structuredClone(sample)

    fabricated.performance[0].sampleCount = 1
    fabricated.performance[0].aggregates.p95 = 123

    expect(validateReport(fabricated, fixtureSpec, registryFacts)).toEqual(
      expect.arrayContaining([
        'PERF-START-COLD: NOT_MEASURED sampleCount must be 0',
        'PERF-START-COLD: NOT_MEASURED aggregate p95 must be null',
      ]),
    )
  })

  it('rejects an eligible verdict while required scenarios are not evaluated', () => {
    const fixtureSpec = readJson(fixtureSpecPath)
    const sample = readJson(samplePath)
    const registryFacts = readRegistryFacts()
    const fabricated = structuredClone(sample)

    fabricated.overall.eligibility = 'ELIGIBLE_GO'
    fabricated.overall.healthScore = 100

    expect(validateReport(fabricated, fixtureSpec, registryFacts)).toEqual(
      expect.arrayContaining([
        'overall eligibility must be NOT_ELIGIBLE for the report evidence',
        'healthScore must be null while the report is NOT_ELIGIBLE',
      ]),
    )
  })

  it('accepts GO only when every gate passes and the baseline envelope is complete', () => {
    const { fixtureSpec, registryFacts, report } = makeFullyMeasuredReport()

    expect(validateReport(report, fixtureSpec, registryFacts)).toEqual([])
  })

  it('requires NO_GO when all required gates are measured and any gate fails', () => {
    const { fixtureSpec, registryFacts, report } = makeFullyMeasuredReport()
    report.performance[0].verdict = 'FAIL'
    report.overall.requiredScenarioCounts.passed -= 1
    report.overall.requiredScenarioCounts.failed = 1

    expect(validateReport(report, fixtureSpec, registryFacts)).toContain(
      'overall eligibility must be ELIGIBLE_NO_GO for the report evidence',
    )

    report.overall.eligibility = 'ELIGIBLE_NO_GO'
    report.overall.reasonCodes = ['PERF_START_COLD_FAILED']
    expect(validateReport(report, fixtureSpec, registryFacts)).toEqual([])
  })

  it('rejects GO when all scenarios pass but fixtures or comparison evidence are incomplete', () => {
    const { fixtureSpec, registryFacts, report } = makeFullyMeasuredReport()
    const requiredFixture = report.fixtures.states.find((fixture: any) => fixture.required)
    requiredFixture.artifactStatus = 'NOT_GENERATED'
    requiredFixture.manifestSha256 = null

    expect(validateReport(report, fixtureSpec, registryFacts)).toContain(
      'overall eligibility must be NOT_ELIGIBLE for the report evidence',
    )

    requiredFixture.artifactStatus = 'GENERATED_VALID'
    requiredFixture.manifestSha256 = '0'.repeat(64)
    report.comparison.status = 'INCOMPLETE'
    report.comparison.reasonCode = 'PWA_REFERENCE_MISSING'
    report.comparison.referenceModes = ['web-tab']
    report.comparison.referenceReportIds = ['web-baseline']
    report.comparison.evidence = []

    expect(validateReport(report, fixtureSpec, registryFacts)).toContain(
      'overall eligibility must be NOT_ELIGIBLE for the report evidence',
    )
  })

  it('rejects aggregates that claim more statistical confidence than the sample count', () => {
    const { fixtureSpec, registryFacts, report } = makeFullyMeasuredReport()
    const scenario = report.performance.find(
      (candidate: any) => candidate.id === 'PERF-START-COLD',
    )
    scenario.sampleCount = 199
    scenario.aggregates.p99 = null

    expect(validateReport(report, fixtureSpec, registryFacts)).toEqual(
      expect.arrayContaining([
        'PERF-START-COLD: aggregate p95 requires at least 200 samples',
        'PERF-START-COLD: PASS requires at least 200 samples',
      ]),
    )

    scenario.sampleCount = 29
    scenario.verdict = 'FAIL'
    scenario.aggregates.p95 = null
    expect(validateReport(report, fixtureSpec, registryFacts)).toEqual(
      expect.arrayContaining([
        'PERF-START-COLD: aggregate p50 requires at least 30 samples',
        'PERF-START-COLD: aggregate mean requires at least 30 samples',
        'PERF-START-COLD: aggregate standardDeviation requires at least 30 samples',
      ]),
    )

    scenario.sampleCount = 999
    scenario.aggregates.p99 = 1
    expect(validateReport(report, fixtureSpec, registryFacts)).toContain(
      'PERF-START-COLD: aggregate p99 requires at least 1000 samples',
    )
  })

  it('allows an evidenced hard FAIL with low samples when unsupported aggregates stay null', () => {
    const { fixtureSpec, registryFacts, report } = makeFullyMeasuredReport()
    const scenario = report.performance.find(
      (candidate: any) => candidate.id === 'PERF-START-COLD',
    )
    scenario.verdict = 'FAIL'
    scenario.sampleCount = 1
    scenario.aggregates = {
      min: 1,
      p50: null,
      p95: null,
      p99: null,
      max: 1,
      mean: null,
      standardDeviation: null,
    }
    report.overall.eligibility = 'ELIGIBLE_NO_GO'
    report.overall.reasonCodes = ['HARD_FAILURE_OBSERVED']
    report.overall.requiredScenarioCounts.passed -= 1
    report.overall.requiredScenarioCounts.failed = 1

    expect(validateReport(report, fixtureSpec, registryFacts)).toEqual([])
  })

  it('does not allow PASS when its scenario-specific required aggregate is null', () => {
    const { fixtureSpec, registryFacts, report } = makeFullyMeasuredReport()
    const scenario = report.performance.find(
      (candidate: any) => candidate.id === 'PERF-START-COLD',
    )
    scenario.aggregates.p95 = null

    expect(validateReport(report, fixtureSpec, registryFacts)).toContain(
      'PERF-START-COLD: PASS requires aggregate p95',
    )
  })
})
