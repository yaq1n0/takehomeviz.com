import type { BandSchedule } from '../../../types.js';

/**
 * UK Student Loan Plan 2 bands for tax year 2026-27.
 * 9% of earnings above £28,470.
 *
 * @example
 *   applyBands(new Money(60_000_00, 'GBP'), ukStudentLoanPlan2_2026_27, 'GBP');
 *   // (60,000 − 28,470) × 0.09 = 2,837.70
 */
export const ukStudentLoanPlan2_2026_27: BandSchedule = {
  source: 'https://www.gov.uk/repaying-your-student-loan/what-you-pay',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: 28_470_00, rate: 0.0 },
    { from: 28_470_00, to: Infinity, rate: 0.09 },
  ],
};
