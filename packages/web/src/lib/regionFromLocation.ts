import type { RegionId } from '@takehomeviz/engine';

export function regionFromLocation(countryCode: string, stateCode?: string): RegionId | null {
  if (countryCode === 'GB') return 'uk-eng';
  if (countryCode === 'US') {
    switch (stateCode) {
      case 'CA':
        return 'us-ca';
      case 'NY':
        return 'us-ny';
      case 'WA':
        return 'us-wa';
      case 'TX':
        return 'us-tx';
      default:
        return null;
    }
  }
  return null;
}
