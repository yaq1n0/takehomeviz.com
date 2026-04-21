import type { BandSchedule } from '../../../types.js';

/**
 * UK National Insurance Class 1 (employee) bands for tax year 2026-27.
 *
 * - £0 – £12,570 (Primary Threshold): 0%
 * - £12,570 – £50,270 (Upper Earnings Limit): 8%
 * - £50,270+: 2%
 *
 * v1 annualised approximation: real PAYE computes NI per-pay-period (weekly /
 * monthly), which for employees who hit bands unevenly across the year can
 * differ slightly. For a flat, 12-even-months annual comparison this is fine
 * and matches how every UK salary calculator ships by default.
 *
 * @example
 *   applyBands(new Money(60_000_00, 'GBP'), ukNiClass1_2026_27, 'GBP');
 *   // main: (50,270 − 12,570) × 0.08 = 3,016
 *   // upper:(60,000 − 50,270) × 0.02 =   194.60
 *   // total:                            3,210.60
 */
export const ukNiClass1_2026_27: BandSchedule = {
  source: 'https://www.gov.uk/national-insurance-rates-letters',
  effectiveFrom: '2026-04-06',
  bands: [
    { from: 0, to: 12_570_00, rate: 0.0 },
    { from: 12_570_00, to: 50_270_00, rate: 0.08 },
    { from: 50_270_00, to: Infinity, rate: 0.02 },
  ],
};
