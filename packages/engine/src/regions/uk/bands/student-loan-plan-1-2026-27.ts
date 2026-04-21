import type { BandSchedule } from '../../../types.js';

/**
 * UK Student Loan Plan 1 bands for tax year 2026-27.
 * 9% of earnings above £26,065.
 *
 * @example
 *   applyBands(new Money(40_000_00, 'GBP'), ukStudentLoanPlan1_2026_27, 'GBP');
 *   // (40,000 − 26,065) × 0.09 = 1,254.15
 */
export const ukStudentLoanPlan1_2026_27: BandSchedule = {
  source: 'https://www.gov.uk/repaying-your-student-loan/what-you-pay',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: 26_065_00, rate: 0.0 },
    { from: 26_065_00, to: Infinity, rate: 0.09 },
  ],
};
