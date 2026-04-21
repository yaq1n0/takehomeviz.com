import type { BandSchedule } from '../../../types.js';

/**
 * UK Postgraduate Student Loan bands for tax year 2026-27.
 * 6% of earnings above £21,000. Postgraduate loan repayments are additive:
 * a borrower with, say, a Plan 2 and a Postgrad loan pays both.
 *
 * @example
 *   applyBands(new Money(50_000_00, 'GBP'), ukStudentLoanPostgrad_2026_27, 'GBP');
 *   // (50,000 − 21,000) × 0.06 = 1,740.00
 */
export const ukStudentLoanPostgrad_2026_27: BandSchedule = {
  source: 'https://www.gov.uk/repaying-your-student-loan/what-you-pay',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: 21_000_00, rate: 0.0 },
    { from: 21_000_00, to: Infinity, rate: 0.06 },
  ],
};
