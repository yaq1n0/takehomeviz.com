import type { BandSchedule } from '../../../types.js';

/**
 * UK Student Loan Plan 4 (Scotland) bands for tax year 2026-27.
 * 9% of earnings above £32,745. Borrowers on Plan 4 may be employed anywhere in
 * the UK — the plan label refers to the loan origin, not employment region.
 *
 * @example
 *   applyBands(new Money(50_000_00, 'GBP'), ukStudentLoanPlan4_2026_27, 'GBP');
 *   // (50,000 − 32,745) × 0.09 = 1,552.95
 */
export const ukStudentLoanPlan4_2026_27: BandSchedule = {
  source: 'https://www.gov.uk/repaying-your-student-loan/what-you-pay',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: 32_745_00, rate: 0.0 },
    { from: 32_745_00, to: Infinity, rate: 0.09 },
  ],
};
