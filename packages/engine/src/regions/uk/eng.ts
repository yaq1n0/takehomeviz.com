import type { Region } from '../../types.js';
import { incomeTax } from './deductions/income-tax.js';
import { niClass1 } from './deductions/ni-class-1.js';
import { salarySacrificePension } from './deductions/salary-sacrifice-pension.js';
import { studentLoan } from './deductions/student-loan.js';

/**
 * UK region covering England, Wales, and Northern Ireland. Scotland is a
 * separate region (`uk-sct`, v1.1) because of its different income-tax bands.
 *
 * Pipeline order (legally meaningful — see PLAN.md §5.2):
 *   1. Salary-sacrifice pension — reduces base for both income tax AND NI.
 *   2. Income tax                — runs on the post-pension base, does not
 *                                  reduce it further.
 *   3. NI Class 1 (employee)     — runs on the post-pension base.
 *   4. Student loan              — runs on GROSS (not post-pension); see the
 *                                  TODO in deductions/student-loan.ts.
 *
 * @example
 *   import { calculate, Money, year } from '@takehomeviz/engine';
 *   calculate({
 *     regionId: 'uk-eng',
 *     year: year(2026),
 *     grossAnnual: new Money(60_000_00, 'GBP'),
 *     pensionPct: 5,
 *     studentLoan: { plan: 'uk-plan-2' },
 *   });
 */
export const ukEngland: Region = {
  id: 'uk-eng',
  label: 'UK (England, Wales, NI)',
  currency: 'GBP',
  pipeline: (year) => [salarySacrificePension, incomeTax(year), niClass1(year), studentLoan(year)],
};
