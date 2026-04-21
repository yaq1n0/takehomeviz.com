import type { BandSchedule } from '../../../types.js';

/**
 * UK income tax bands for England, Wales, and Northern Ireland, tax year
 * 2026-27. Personal allowance taper above £100,000 (£1 reduction per £2 over)
 * is applied as a modifier — below.
 *
 * @example
 *   import { applyBands } from '../../../bands.js';
 *   import { Money } from '../../../money.js';
 *   applyBands(new Money(60_000_00, 'GBP'), ukIncomeTax2026_27, 'GBP');
 *   // basic:  (50,270 − 12,570) × 0.20 =  7,540
 *   // higher: (60,000 − 50,270) × 0.40 =  3,892
 *   // total:                              11,432
 *   // => Money { amount: 11_432_00, currency: 'GBP' }
 */

const PERSONAL_ALLOWANCE = 12_570_00;
const TAPER_START = 100_000_00;

/**
 * Personal-allowance taper. For every £2 of taxable income above £100,000,
 * reduce the personal allowance by £1 (so the marginal rate in the taper zone
 * is 40% + 20% = 60%). PA is fully withdrawn at taxable = £125,140.
 *
 * Implementation note: the *band schedule* keeps a static £12,570 PA; the
 * reduction is expressed as an additive surcharge — every £1 of PA reduction
 * moves £1 from the 0% band to the 20% band, so tax increases by £1 × 0.20.
 *
 * Source: https://www.gov.uk/income-tax-rates/income-over-100000
 */
function paTaper(amountDue: number, taxableBase: number): number {
  if (taxableBase <= TAPER_START) return amountDue;
  const excess = taxableBase - TAPER_START;
  const paReduction = Math.min(PERSONAL_ALLOWANCE, Math.floor(excess / 2));
  // Each £1 of PA that's lost shifts £1 from the 0% band to the 20% band.
  return amountDue + paReduction * 0.2;
}

export const ukIncomeTax2026_27: BandSchedule = {
  source: 'https://www.gov.uk/income-tax-rates',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: PERSONAL_ALLOWANCE, rate: 0.0 },
    { from: PERSONAL_ALLOWANCE, to: 50_270_00, rate: 0.2 },
    { from: 50_270_00, to: 125_140_00, rate: 0.4 },
    { from: 125_140_00, to: Infinity, rate: 0.45 },
  ],
  modifiers: [paTaper],
};
