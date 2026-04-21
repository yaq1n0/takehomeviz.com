import { ukEngland } from './uk/eng.js';
import { usCalifornia } from './us/ca.js';
import { usNewYork } from './us/ny.js';
import { usTexas } from './us/tx.js';
import { usWashington } from './us/wa.js';
import type { Region, RegionId } from '../types.js';

const REGIONS: Record<RegionId, Region> = {
  'uk-eng': ukEngland,
  'us-ca': usCalifornia,
  'us-ny': usNewYork,
  'us-wa': usWashington,
  'us-tx': usTexas,
};

export function getRegion(id: RegionId): Region {
  const region = REGIONS[id];
  if (!region) {
    throw new Error(`Unknown region: ${id}`);
  }
  return region;
}

export function listRegions(): Array<{ id: RegionId; label: string; currency: 'GBP' | 'USD' }> {
  return (Object.keys(REGIONS) as RegionId[]).map((id) => {
    const region = REGIONS[id];
    return { id: region.id, label: region.label, currency: region.currency };
  });
}
