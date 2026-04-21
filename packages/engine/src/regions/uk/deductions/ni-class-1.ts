import { applyBands } from '../../../bands.js';
import type { Year } from '../../../year.js';
import type { BandSchedule, Deduction } from '../../../types.js';
import { ukNiClass1_2026_27 } from '../bands/ni-class-1-2026-27.js';

/**
 * UK National Insurance Class 1 (employee) deduction, year-keyed.
 *
 * Runs against the same post-pension base as income tax (salary-sacrifice
 * reduces NI-able pay). Does not further reduce `taxableBase`.
 *
 * @example
 *   const d = niClass1(year(2026));
 *   d(new Money(57_000_00, 'GBP'), scenario, []);
 *   // main: (50,270 − 12,570)·8%  = 3,016
 *   // upper:(57,000 − 50,270)·2%  = 134.60
 *   // total:                        3,150.60
 */
export function niClass1(year: Year): Deduction {
  const schedule = getSchedule(year);
  return (taxableBase) => {
    const { total, bandBreakdown } = applyBands(taxableBase, schedule, taxableBase.currency);
    return {
      name: 'ni-class-1',
      amount: total,
      taxableBaseAfter: taxableBase,
      meta: { bandBreakdown, scheduleSource: schedule.source },
    };
  };
}

function getSchedule(year: Year): BandSchedule {
  if ((year as number) === 2026) return ukNiClass1_2026_27;
  throw new Error(`uk-eng NI Class 1: no band schedule for year ${year as number}`);
}
