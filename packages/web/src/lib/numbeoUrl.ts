import type { Location } from '../schemas';

function numbeoSlug(s: string): string {
  return s.trim().replace(/\s+/g, '-');
}

export function numbeoUrlFor(loc: Location): string {
  return `https://www.numbeo.com/cost-of-living/in/${encodeURIComponent(numbeoSlug(loc.cityName))}`;
}
