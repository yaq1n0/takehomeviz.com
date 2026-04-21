import { applyBands } from '../../../bands.js';
import type { Year } from '../../../year.js';
import type { BandSchedule, Deduction } from '../../../types.js';
import { ukIncomeTax2026_27 } from '../bands/income-tax-2026-27.js';

/**
 * UK (England / Wales / NI) income tax deduction, year-keyed.
 *
 * Reads the incoming `taxableBase` (which the prior pipeline step has already
 * reduced by any salary-sacrifice pension). Computes tax using the year's band
 * schedule (including the personal-allowance taper above £100k). Does **not**
 * further reduce `taxableBase` — later deductions like NI still see the
 * post-pension base.
 *
 * @example
 *   const d = incomeTax(year(2026));
 *   d(new Money(57_000_00, 'GBP'), scenario, []);
 *   // => tax on £57,000 = (50,270 − 12,570)·20% + (57,000 − 50,270)·40%
 *   //                   = 7,540 + 2,692 = £10,232
 */
export function incomeTax(year: Year): Deduction {
  const schedule = getSchedule(year);
  return (taxableBase) => {
    const { total, bandBreakdown } = applyBands(taxableBase, schedule, taxableBase.currency);
    return {
      name: 'income-tax',
      amount: total,
      taxableBaseAfter: taxableBase,
      meta: { bandBreakdown, scheduleSource: schedule.source },
    };
  };
}

function getSchedule(year: Year): BandSchedule {
  // v1 supports only 2026-27 for uk-eng (see PLAN.md §7 / SUPPORTED_YEARS).
  if ((year as number) === 2026) return ukIncomeTax2026_27;
  throw new Error(`uk-eng income tax: no band schedule for year ${year as number}`);
}
