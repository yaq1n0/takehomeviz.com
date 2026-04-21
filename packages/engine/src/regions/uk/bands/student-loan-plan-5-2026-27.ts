import type { BandSchedule } from '../../../types.js';

/**
 * UK Student Loan Plan 5 bands for tax year 2026-27.
 * 9% of earnings above £25,000. Plan 5 covers undergraduate loans from courses
 * starting on or after 1 August 2023 (England).
 *
 * @example
 *   applyBands(new Money(35_000_00, 'GBP'), ukStudentLoanPlan5_2026_27, 'GBP');
 *   // (35,000 − 25,000) × 0.09 = 900.00
 */
export const ukStudentLoanPlan5_2026_27: BandSchedule = {
  source: 'https://www.gov.uk/repaying-your-student-loan/what-you-pay',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: 25_000_00, rate: 0.0 },
    { from: 25_000_00, to: Infinity, rate: 0.09 },
  ],
};
