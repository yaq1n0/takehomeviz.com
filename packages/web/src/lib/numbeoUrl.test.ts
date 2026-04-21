import { describe, it, expect } from 'vitest';
import { numbeoUrlFor } from './numbeoUrl';

describe('numbeoUrlFor', () => {
  it('uses city name only', () => {
    expect(
      numbeoUrlFor({ countryCode: 'GB', countryName: 'United Kingdom', cityName: 'London' }),
    ).toBe('https://www.numbeo.com/cost-of-living/in/London');
  });

  it('replaces multi-space runs with single dashes and trims', () => {
    expect(
      numbeoUrlFor({
        countryCode: 'US',
        countryName: 'United States',
        cityName: '  San  Francisco ',
      }),
    ).toBe('https://www.numbeo.com/cost-of-living/in/San-Francisco');
  });

  it('URL-encodes accented characters', () => {
    const url = numbeoUrlFor({ countryCode: 'CA', countryName: 'Canada', cityName: 'Montréal' });
    expect(url).toBe('https://www.numbeo.com/cost-of-living/in/Montr%C3%A9al');
  });

  it('handles empty city without throwing', () => {
    expect(numbeoUrlFor({ countryCode: 'XX', countryName: '', cityName: '' })).toBe(
      'https://www.numbeo.com/cost-of-living/in/',
    );
  });
});
