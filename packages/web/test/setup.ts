import { vi } from 'vitest';

if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => {
        counter += 1;
        return `00000000-0000-0000-0000-${counter.toString().padStart(12, '0')}`;
      },
    },
  });
}
