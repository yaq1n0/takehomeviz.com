import { Money } from '../../../money.js';
import type { Deduction } from '../../../types.js';

/**
 * UK salary-sacrifice pension contribution. A flat percentage of `grossAnnual`
 * is sacrificed pre-tax. The sacrifice reduces the taxable base for **both**
 * income tax and National Insurance — this is the defining feature of salary
 * sacrifice versus "relief at source" schemes.
 *
 * Rounds to integer minor units (pence) using Math.round (half-away-from-zero
 * on positive values matches PLAN.md §5.3 example).
 *
 * @example
 *   // £60,000 gross, 5% salary sacrifice
 *   // contribution = 60,000 × 0.05 = £3,000 (300,000 pence)
 *   // taxableBaseAfter = 60,000 − 3,000 = £57,000
 *   const result = salarySacrificePension(
 *     new Money(60_000_00, 'GBP'),
 *     { regionId: 'uk-eng', year: year(2026), grossAnnual: new Money(60_000_00, 'GBP'), pensionPct: 5 },
 *     [],
 *   );
 *   result.amount.amount;          // 3_000_00
 *   result.taxableBaseAfter.amount // 57_000_00
 */
export const salarySacrificePension: Deduction = (taxableBase, ctx) => {
  const currency = taxableBase.currency;
  const pct = ctx.pensionPct ?? 0;
  if (pct <= 0) {
    return {
      name: 'salary-sacrifice-pension',
      amount: Money.zero(currency),
      taxableBaseAfter: taxableBase,
      meta: { pensionPct: 0 },
    };
  }
  if (pct > 100) {
    throw new RangeError(`pensionPct must be in [0, 100], got ${pct}`);
  }
  const pence = Math.round((ctx.grossAnnual.amount * pct) / 100);
  const amount = new Money(pence, currency);
  return {
    name: 'salary-sacrifice-pension',
    amount,
    taxableBaseAfter: taxableBase.sub(amount),
    meta: { pensionPct: pct },
  };
};
