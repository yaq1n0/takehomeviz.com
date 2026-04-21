import { describe, expect, it } from 'vitest';
import { Money } from '../../money.js';
import { runPipeline } from '../../pipeline.js';
import type { Scenario } from '../../types.js';
import { year } from '../../year.js';
import { ukEngland } from './eng.js';

const Y = year(2026);

function run(scenario: Scenario) {
  return runPipeline(scenario, ukEngland);
}

// ---------------------------------------------------------------------------
// Reference scenarios
// All hand-calculated; figures in £ unless labelled otherwise.
// ---------------------------------------------------------------------------

describe('ukEngland 2026-27 reference scenarios', () => {
  it('£30,000 gross, no pension, no student loan', () => {
    // Taxable for IT/NI: 30,000
    // IT: (30,000 − 12,570) × 0.20 = 3,486.00
    // NI: (30,000 − 12,570) × 0.08 = 1,394.40
    // SL: 0
    // Net: 30,000 − 3,486 − 1,394.40 = 25,119.60
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(30_000_00, 'GBP'),
    });
    expect(b.deductions.find((d) => d.name === 'income-tax')?.amount.amount).toBe(3_486_00);
    expect(b.deductions.find((d) => d.name === 'ni-class-1')?.amount.amount).toBe(1_394_40);
    expect(b.net.amount).toBe(25_119_60);
  });

  it('£60,000 gross, 5% pension, Plan 2', () => {
    // Pension: 60,000 × 0.05 = 3,000
    // Taxable for IT/NI: 57,000
    // IT: (50,270 − 12,570) × 0.20 + (57,000 − 50,270) × 0.40
    //   = 7,540 + 2,692 = 10,232
    // NI: (50,270 − 12,570) × 0.08 + (57,000 − 50,270) × 0.02
    //   = 3,016 + 134.60 = 3,150.60
    // SL Plan 2 (on GROSS £60,000, threshold 28,470):
    //   (60,000 − 28,470) × 0.09 = 2,837.70
    // Net: 60,000 − 3,000 − 10,232 − 3,150.60 − 2,837.70 = 40,779.70
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(60_000_00, 'GBP'),
      pensionPct: 5,
      studentLoan: { plan: 'uk-plan-2' },
    });
    const get = (name: string) => b.deductions.find((d) => d.name === name)?.amount.amount;
    expect(get('salary-sacrifice-pension')).toBe(3_000_00);
    expect(get('income-tax')).toBe(10_232_00);
    expect(get('ni-class-1')).toBe(3_150_60);
    expect(get('student-loan-uk-plan-2')).toBe(2_837_70);
    expect(b.net.amount).toBe(40_779_70);
  });

  it('£120,000 gross, no pension (triggers PA taper)', () => {
    // Taxable: 120,000
    // PA taper: excess over 100,000 = 20,000 → PA reduced by 10,000 (min(12,570, 10,000))
    // IT base:
    //   12,570..50,270 at 20%  =  7,540
    //   50,270..120,000 at 40% = 27,892
    //   pre-modifier total     = 35,432
    // Taper surcharge: 10,000 × 0.20 = 2,000
    // IT total: 37,432
    // NI: 3,016 + (120,000 − 50,270) × 0.02 = 3,016 + 1,394.60 = 4,410.60
    // Net: 120,000 − 37,432 − 4,410.60 = 78,157.40
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(120_000_00, 'GBP'),
    });
    const get = (name: string) => b.deductions.find((d) => d.name === name)?.amount.amount;
    expect(get('income-tax')).toBe(37_432_00);
    expect(get('ni-class-1')).toBe(4_410_60);
    expect(b.net.amount).toBe(78_157_40);
  });

  it('£200,000 gross, 10% pension, Plan 2', () => {
    // NOTE: task spec asked for "Plan 2 + Postgrad" but the current Scenario
    // type only carries a single studentLoan plan. See Postgrad tested
    // separately below. This scenario covers Plan 2 only.
    // Pension: 20,000
    // Taxable for IT/NI: 180,000
    // PA taper: excess 80,000 → reduction min(12,570, 40,000) = 12,570 (fully tapered)
    // IT base on 180,000:
    //   12,570..50,270   at 20% =  7,540
    //   50,270..125,140  at 40% = 29,948
    //   125,140..180,000 at 45% = 24,687
    //   pre-modifier total      = 62,175
    // Taper surcharge: 12,570 × 0.20 = 2,514
    // IT total: 64,689
    // NI: 3,016 + (180,000 − 50,270) × 0.02 = 3,016 + 2,594.60 = 5,610.60
    // SL Plan 2 on GROSS £200,000: (200,000 − 28,470) × 0.09 = 15,437.70
    // Net: 200,000 − 20,000 − 64,689 − 5,610.60 − 15,437.70 = 94,262.70
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(200_000_00, 'GBP'),
      pensionPct: 10,
      studentLoan: { plan: 'uk-plan-2' },
    });
    const get = (name: string) => b.deductions.find((d) => d.name === name)?.amount.amount;
    expect(get('salary-sacrifice-pension')).toBe(20_000_00);
    expect(get('income-tax')).toBe(64_689_00);
    expect(get('ni-class-1')).toBe(5_610_60);
    expect(get('student-loan-uk-plan-2')).toBe(15_437_70);
    expect(b.net.amount).toBe(94_262_70);
  });

  it('£10,000 gross, below all thresholds, zero deductions', () => {
    // Taxable 10,000 < 12,570 PA → IT = 0
    // 10,000 < 12,570 primary threshold → NI = 0
    // No student loan
    // Net = gross
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(10_000_00, 'GBP'),
    });
    const get = (name: string) => b.deductions.find((d) => d.name === name)?.amount.amount;
    expect(get('income-tax')).toBe(0);
    expect(get('ni-class-1')).toBe(0);
    expect(b.net.amount).toBe(10_000_00);
  });
});

// ---------------------------------------------------------------------------
// Pension interaction: reduces base for both IT and NI
// ---------------------------------------------------------------------------

describe('salary-sacrifice pension', () => {
  it('reduces the base for both income tax and NI', () => {
    // At £60,000 gross:
    //   without pension: IT on 60,000 = 7,540 + (60,000-50,270)·0.40 = 7,540 + 3,892 = 11,432
    //                    NI on 60,000 = 3,016 + (60,000-50,270)·0.02 = 3,016 + 194.60 = 3,210.60
    //   with 10% pension (£6,000): IT on 54,000 = 7,540 + (54,000-50,270)·0.40 = 7,540 + 1,492 = 9,032
    //                              NI on 54,000 = 3,016 + (54,000-50,270)·0.02 = 3,016 + 74.60 = 3,090.60
    const without = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(60_000_00, 'GBP'),
    });
    const withPension = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(60_000_00, 'GBP'),
      pensionPct: 10,
    });
    const get = (b: ReturnType<typeof run>, name: string) =>
      b.deductions.find((d) => d.name === name)?.amount.amount ?? 0;

    expect(get(without, 'income-tax')).toBe(11_432_00);
    expect(get(without, 'ni-class-1')).toBe(3_210_60);
    expect(get(withPension, 'income-tax')).toBe(9_032_00);
    expect(get(withPension, 'ni-class-1')).toBe(3_090_60);
    // Both IT and NI shrunk, confirming sal-sac reduces BOTH bases.
    expect(get(withPension, 'income-tax')).toBeLessThan(get(without, 'income-tax'));
    expect(get(withPension, 'ni-class-1')).toBeLessThan(get(without, 'ni-class-1'));
  });

  it('is a no-op when pensionPct is missing or 0', () => {
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(50_000_00, 'GBP'),
    });
    expect(b.deductions[0]?.name).toBe('salary-sacrifice-pension');
    expect(b.deductions[0]?.amount.amount).toBe(0);
    expect(b.deductions[0]?.taxableBaseAfter.amount).toBe(50_000_00);
  });

  it('rejects pensionPct > 100', () => {
    expect(() =>
      run({
        regionId: 'uk-eng',
        year: Y,
        grossAnnual: new Money(50_000_00, 'GBP'),
        pensionPct: 150,
      }),
    ).toThrow(/pensionPct/);
  });
});

// ---------------------------------------------------------------------------
// PA taper at the £100k boundary
// ---------------------------------------------------------------------------

describe('personal allowance taper', () => {
  it('no taper at exactly £100,000', () => {
    // Taxable 100,000, excess 0 → no taper surcharge.
    // IT: 7,540 + (100,000 − 50,270) × 0.40 = 7,540 + 19,892 = 27,432
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(100_000_00, 'GBP'),
    });
    expect(b.deductions.find((d) => d.name === 'income-tax')?.amount.amount).toBe(27_432_00);
  });

  it('£100,001 → PA reduced by 50p (surcharge = 10p)', () => {
    // Excess = 1 (100 pence). PA reduction = floor(100/2) = 50 pence (£0.50).
    // Surcharge: 50 pence × 0.20 = 10 pence.
    // Base bands on 100,001:
    //   12,570..50,270   at 20% =  7,540
    //   50,270..100,001  at 40% = 19,892.40
    //   total                   = 27,432.40 (= 27,432,40 in pence)
    // + surcharge 10 pence → 27,432.50 total (2,743,250 pence).
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(100_001_00, 'GBP'),
    });
    expect(b.deductions.find((d) => d.name === 'income-tax')?.amount.amount).toBe(27_432_50);
  });

  it('PA fully tapered at £125,140 (reduction = £12,570)', () => {
    // At 125,140 excess = 25,140, floor(25,140/2) = 12,570 → fully tapered.
    // Base bands on 125,140:
    //   12,570..50,270  at 20% =  7,540
    //   50,270..125,140 at 40% = 29,948
    //   total pre-modifier     = 37,488
    // Surcharge: 12,570 × 0.20 = 2,514
    // IT = 40,002
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(125_140_00, 'GBP'),
    });
    expect(b.deductions.find((d) => d.name === 'income-tax')?.amount.amount).toBe(40_002_00);
  });
});

// ---------------------------------------------------------------------------
// Student loan plan thresholds
// ---------------------------------------------------------------------------

describe('student loan plan thresholds', () => {
  // Table-driven: [plan, threshold, rate, testGrossJustAbove, expectedAmountPence]
  const cases: Array<{
    plan: 'uk-plan-1' | 'uk-plan-2' | 'uk-plan-4' | 'uk-plan-5' | 'uk-postgrad';
    threshold: number;
    rate: number;
  }> = [
    { plan: 'uk-plan-1', threshold: 26_065_00, rate: 0.09 },
    { plan: 'uk-plan-2', threshold: 28_470_00, rate: 0.09 },
    { plan: 'uk-plan-4', threshold: 32_745_00, rate: 0.09 },
    { plan: 'uk-plan-5', threshold: 25_000_00, rate: 0.09 },
    { plan: 'uk-postgrad', threshold: 21_000_00, rate: 0.06 },
  ];

  for (const { plan, threshold, rate } of cases) {
    it(`${plan}: zero at exactly threshold, charges above`, () => {
      const atThreshold = run({
        regionId: 'uk-eng',
        year: Y,
        grossAnnual: new Money(threshold, 'GBP'),
        studentLoan: { plan },
      });
      expect(
        atThreshold.deductions.find((d) => d.name === `student-loan-${plan}`)?.amount.amount,
      ).toBe(0);

      const aboveGross = threshold + 1_000_00; // +£1,000
      const above = run({
        regionId: 'uk-eng',
        year: Y,
        grossAnnual: new Money(aboveGross, 'GBP'),
        studentLoan: { plan },
      });
      // 1,000 × rate, rounded to integer pence.
      const expected = Math.round(1_000_00 * rate);
      expect(above.deductions.find((d) => d.name === `student-loan-${plan}`)?.amount.amount).toBe(
        expected,
      );
    });

    it(`${plan}: just-below threshold pays zero`, () => {
      const justBelow = run({
        regionId: 'uk-eng',
        year: Y,
        grossAnnual: new Money(threshold - 100, 'GBP'), // £1 below
        studentLoan: { plan },
      });
      expect(
        justBelow.deductions.find((d) => d.name === `student-loan-${plan}`)?.amount.amount,
      ).toBe(0);
    });
  }

  it('Plan 2 at exactly £28,470 gross → zero student loan (threshold inclusive)', () => {
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(28_470_00, 'GBP'),
      studentLoan: { plan: 'uk-plan-2' },
    });
    expect(b.deductions.find((d) => d.name === 'student-loan-uk-plan-2')?.amount.amount).toBe(0);
  });

  it('no student loan emits a zero-amount marker deduction', () => {
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(50_000_00, 'GBP'),
    });
    const sl = b.deductions.find((d) => d.name === 'student-loan-none');
    expect(sl).toBeDefined();
    expect(sl?.amount.amount).toBe(0);
  });

  it('Postgrad at £50,000 gross → (50,000 − 21,000) × 6% = £1,740', () => {
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(50_000_00, 'GBP'),
      studentLoan: { plan: 'uk-postgrad' },
    });
    expect(b.deductions.find((d) => d.name === 'student-loan-uk-postgrad')?.amount.amount).toBe(
      1_740_00,
    );
  });

  it('student loan uses GROSS, not post-pension base', () => {
    // £60,000 gross, 10% pension → post-pension = 54,000.
    // If SL were on the post-pension base: (54,000 − 28,470) × 0.09 = 2,297.70
    // On gross: (60,000 − 28,470) × 0.09 = 2,837.70 — expect the latter.
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(60_000_00, 'GBP'),
      pensionPct: 10,
      studentLoan: { plan: 'uk-plan-2' },
    });
    expect(b.deductions.find((d) => d.name === 'student-loan-uk-plan-2')?.amount.amount).toBe(
      2_837_70,
    );
  });
});

// ---------------------------------------------------------------------------
// Pipeline shape
// ---------------------------------------------------------------------------

describe('pipeline shape', () => {
  it('has region id, label, currency, pipeline order', () => {
    expect(ukEngland.id).toBe('uk-eng');
    expect(ukEngland.currency).toBe('GBP');
    expect(ukEngland.label).toMatch(/England/);
    const steps = ukEngland.pipeline(Y);
    expect(steps).toHaveLength(4);
  });

  it('emits deductions in legal order: pension, IT, NI, student loan', () => {
    const b = run({
      regionId: 'uk-eng',
      year: Y,
      grossAnnual: new Money(60_000_00, 'GBP'),
      pensionPct: 5,
      studentLoan: { plan: 'uk-plan-2' },
    });
    expect(b.deductions.map((d) => d.name)).toEqual([
      'salary-sacrifice-pension',
      'income-tax',
      'ni-class-1',
      'student-loan-uk-plan-2',
    ]);
  });

  it('throws on unsupported year', () => {
    expect(() =>
      run({
        regionId: 'uk-eng',
        year: year(2025),
        grossAnnual: new Money(50_000_00, 'GBP'),
      }),
    ).toThrow(/2025/);
  });
});
