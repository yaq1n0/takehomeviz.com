import { applyBands } from '../../../bands.js';
import { Money } from '../../../money.js';
import type { Year } from '../../../year.js';
import type { BandSchedule, Deduction, StudentLoanPlanId } from '../../../types.js';
import { ukStudentLoanPlan1_2026_27 } from '../bands/student-loan-plan-1-2026-27.js';
import { ukStudentLoanPlan2_2026_27 } from '../bands/student-loan-plan-2-2026-27.js';
import { ukStudentLoanPlan4_2026_27 } from '../bands/student-loan-plan-4-2026-27.js';
import { ukStudentLoanPlan5_2026_27 } from '../bands/student-loan-plan-5-2026-27.js';
import { ukStudentLoanPostgrad_2026_27 } from '../bands/student-loan-postgrad-2026-27.js';

/**
 * UK Student Loan deduction, year-keyed. Handles Plans 1/2/4/5 and Postgrad.
 *
 * Reads `ctx.grossAnnual` rather than the incoming `taxableBase`: per PLAN.md
 * §5.2 student-loan thresholds are tested against gross earnings, not the
 * post-pension base. This matches thesalarycalculator.co.uk, MoneySavingExpert
 * and the worked example in the task brief.
 *
 * TODO(yaqin): verify — strictly, HMRC CA38 says SL deductions are based on
 * "earnings for NI" for the pay period, which for *salary-sacrifice* pensions
 * is the already-reduced figure (sal-sac contractually lowers gross pay).
 * For *net-pay / relief-at-source* pension schemes SL is on gross. The v1
 * engine only models salary-sacrifice, so there is a real-world discrepancy
 * here worth a follow-up PR after confirming with gov.uk docs.
 * https://www.gov.uk/guidance/how-to-collect-student-loan-repayments-in-payroll
 *
 * Does not reduce the taxable base (student loan is not pre-tax for anything).
 *
 * @example
 *   // £60,000 gross, Plan 2 (threshold £28,470, rate 9%)
 *   // (60,000 − 28,470) × 0.09 = £2,837.70
 */
export function studentLoan(year: Year): Deduction {
  return (taxableBase, ctx) => {
    const currency = taxableBase.currency;
    if (!ctx.studentLoan) {
      return {
        name: 'student-loan-none',
        amount: Money.zero(currency),
        taxableBaseAfter: taxableBase,
      };
    }
    const schedule = getSchedule(year, ctx.studentLoan.plan);
    if (!schedule) {
      // v1.1 placeholder (us-federal-ibr) — emit a zero deduction with a meta
      // note so callers can see it was recognised but not computed.
      return {
        name: `student-loan-${ctx.studentLoan.plan}`,
        amount: Money.zero(currency),
        taxableBaseAfter: taxableBase,
        meta: { note: 'plan not implemented in v1' },
      };
    }
    const { total, bandBreakdown } = applyBands(ctx.grossAnnual, schedule, currency);
    return {
      name: `student-loan-${ctx.studentLoan.plan}`,
      amount: total,
      taxableBaseAfter: taxableBase,
      meta: { bandBreakdown, scheduleSource: schedule.source },
    };
  };
}

function getSchedule(year: Year, plan: StudentLoanPlanId): BandSchedule | undefined {
  if ((year as number) !== 2026) {
    throw new Error(`uk-eng student loan: no band schedule for year ${year as number}`);
  }
  switch (plan) {
    case 'uk-plan-1':
      return ukStudentLoanPlan1_2026_27;
    case 'uk-plan-2':
      return ukStudentLoanPlan2_2026_27;
    case 'uk-plan-4':
      return ukStudentLoanPlan4_2026_27;
    case 'uk-plan-5':
      return ukStudentLoanPlan5_2026_27;
    case 'uk-postgrad':
      return ukStudentLoanPostgrad_2026_27;
    case 'us-federal-ibr':
      return undefined;
  }
}
