<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  getCountries,
  getAllCitiesOfCountry,
  type ICountry,
  type ICity,
} from '@countrystatecity/countries-browser';
import type { RegionId } from '@takehomeviz/engine';
import { regionFromLocation } from '../lib/regionFromLocation';
import type { Location } from '../schemas';

const props = defineProps<{ location: Location | undefined }>();
const emit = defineEmits<{
  (e: 'select', payload: { location: Location | null; suggestedRegionId: RegionId | null }): void;
}>();

const MAX_RESULTS = 50;

let countriesPromise: Promise<ICountry[]> | null = null;
function loadCountries(): Promise<ICountry[]> {
  if (!countriesPromise) countriesPromise = getCountries();
  return countriesPromise;
}
const cityCache = new Map<string, Promise<ICity[]>>();
function loadCities(countryCode: string): Promise<ICity[]> {
  const existing = cityCache.get(countryCode);
  if (existing) return existing;
  // @countrystatecity/countries-browser@1.0.0 ships a states list per country
  // but is missing the corresponding per-subdivision city JSON files for some
  // countries (e.g. GB), so getAllCitiesOfCountry rejects with 404s. Swallow
  // those and degrade to an empty list rather than bubbling up.
  const p = getAllCitiesOfCountry(countryCode).catch(() => [] as ICity[]);
  cityCache.set(countryCode, p);
  return p;
}

const countries = ref<ICountry[]>([]);
const cities = ref<ICity[]>([]);
const citiesLoading = ref(false);

const countryQuery = ref('');
const cityQuery = ref('');

const countryOpen = ref(false);
const cityOpen = ref(false);

const countryHighlight = ref(0);
const cityHighlight = ref(0);

const selectedCountry = ref<{ code: string; name: string } | null>(null);

watch(
  () => props.location,
  (loc) => {
    if (loc) {
      selectedCountry.value = { code: loc.countryCode, name: loc.countryName };
      countryQuery.value = loc.countryName;
      cityQuery.value = loc.cityName;
      void loadCities(loc.countryCode).then((list) => {
        cities.value = list;
      });
    } else {
      selectedCountry.value = null;
      countryQuery.value = '';
      cityQuery.value = '';
      cities.value = [];
    }
  },
  { immediate: true },
);

loadCountries().then((list) => {
  countries.value = list;
});

// Debounced query updates — mirror the 150ms pattern used elsewhere.
const debouncedCountryQuery = ref('');
const debouncedCityQuery = ref('');
let countryTimer: number | null = null;
let cityTimer: number | null = null;
watch(countryQuery, (v) => {
  if (countryTimer !== null) window.clearTimeout(countryTimer);
  countryTimer = window.setTimeout(() => {
    debouncedCountryQuery.value = v;
  }, 150);
});
watch(cityQuery, (v) => {
  if (cityTimer !== null) window.clearTimeout(cityTimer);
  cityTimer = window.setTimeout(() => {
    debouncedCityQuery.value = v;
  }, 150);
});

const filteredCountries = computed(() => {
  const q = debouncedCountryQuery.value.trim().toLowerCase();
  const src = countries.value;
  if (!q) return src.slice(0, MAX_RESULTS);
  return src
    .filter((c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS);
});

const filteredCities = computed(() => {
  const q = debouncedCityQuery.value.trim().toLowerCase();
  const src = cities.value;
  if (!q) return src.slice(0, MAX_RESULTS);
  return src.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
});

const cityOverCap = computed(() => {
  const q = debouncedCityQuery.value.trim().toLowerCase();
  if (!q) return cities.value.length > MAX_RESULTS;
  return cities.value.filter((c) => c.name.toLowerCase().includes(q)).length > MAX_RESULTS;
});

function pickCountry(c: ICountry): void {
  selectedCountry.value = { code: c.iso2, name: c.name };
  countryQuery.value = c.name;
  countryOpen.value = false;
  cityQuery.value = '';
  cities.value = [];
  citiesLoading.value = true;
  void loadCities(c.iso2)
    .then((list) => {
      cities.value = list;
    })
    .finally(() => {
      citiesLoading.value = false;
    });
}

function clearCountry(): void {
  selectedCountry.value = null;
  countryQuery.value = '';
  cityQuery.value = '';
  cities.value = [];
  emit('select', { location: null, suggestedRegionId: null });
}

function pickCity(c: ICity): void {
  const country = selectedCountry.value;
  if (!country) return;
  cityQuery.value = c.name;
  cityOpen.value = false;
  const location: Location = {
    countryCode: country.code,
    countryName: country.name,
    cityName: c.name,
  };
  const suggested = regionFromLocation(country.code, c.state_code);
  emit('select', { location, suggestedRegionId: suggested });
}

function onCountryKey(e: KeyboardEvent): void {
  const list = filteredCountries.value;
  if (e.key === 'ArrowDown') {
    countryOpen.value = true;
    countryHighlight.value = Math.min(countryHighlight.value + 1, list.length - 1);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    countryHighlight.value = Math.max(countryHighlight.value - 1, 0);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    const hit = list[countryHighlight.value];
    if (hit) {
      pickCountry(hit);
      e.preventDefault();
    }
  } else if (e.key === 'Escape') {
    countryOpen.value = false;
  }
}

function onCityKey(e: KeyboardEvent): void {
  const list = filteredCities.value;
  if (e.key === 'ArrowDown') {
    cityOpen.value = true;
    cityHighlight.value = Math.min(cityHighlight.value + 1, list.length - 1);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    cityHighlight.value = Math.max(cityHighlight.value - 1, 0);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    const hit = list[cityHighlight.value];
    if (hit) {
      pickCity(hit);
      e.preventDefault();
    }
  } else if (e.key === 'Escape') {
    cityOpen.value = false;
  }
}

watch(debouncedCountryQuery, () => {
  countryHighlight.value = 0;
});
watch(debouncedCityQuery, () => {
  cityHighlight.value = 0;
});

function onCountryBlur(): void {
  window.setTimeout(() => {
    countryOpen.value = false;
    if (selectedCountry.value && countryQuery.value !== selectedCountry.value.name) {
      countryQuery.value = selectedCountry.value.name;
    } else if (!selectedCountry.value && countryQuery.value === '') {
      // nothing
    }
  }, 120);
}
function onCityBlur(): void {
  window.setTimeout(() => {
    cityOpen.value = false;
  }, 120);
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <label class="block relative">
      <span
        class="text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
        >Country</span
      >
      <div
        class="mt-1 flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 focus-within:border-neutral-400 dark:focus-within:border-neutral-600"
      >
        <input
          class="flex-1 bg-transparent focus:outline-none text-sm text-neutral-900 dark:text-neutral-100 min-w-0"
          placeholder="Country"
          :value="countryQuery"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="countryOpen"
          aria-controls="location-country-listbox"
          @input="
            (e) => {
              countryQuery = (e.target as HTMLInputElement).value;
              countryOpen = true;
            }
          "
          @focus="countryOpen = true"
          @blur="onCountryBlur"
          @keydown="onCountryKey"
        />
        <button
          v-if="selectedCountry"
          type="button"
          class="shrink-0 inline-flex items-center justify-center p-0 leading-none text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
          :aria-label="'Clear country'"
          @mousedown.prevent="clearCountry"
        >
          <FontAwesomeIcon icon="xmark" class="text-xs" />
        </button>
      </div>
      <ul
        v-if="countryOpen && filteredCountries.length > 0"
        id="location-country-listbox"
        role="listbox"
        class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg text-sm"
      >
        <li
          v-for="(c, i) in filteredCountries"
          :id="`location-country-opt-${i}`"
          :key="c.iso2"
          role="option"
          :aria-selected="i === countryHighlight"
          class="px-2 py-1.5 cursor-pointer flex items-center gap-2"
          :class="
            i === countryHighlight
              ? 'bg-neutral-100 dark:bg-neutral-800'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
          "
          @mousedown.prevent="pickCountry(c)"
          @mouseenter="countryHighlight = i"
        >
          <span>{{ c.emoji }}</span>
          <span class="flex-1 truncate text-neutral-900 dark:text-neutral-100">{{ c.name }}</span>
          <span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">{{ c.iso2 }}</span>
        </li>
      </ul>
    </label>

    <label class="block relative">
      <span
        class="text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
        >City</span
      >
      <div
        class="mt-1 flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 focus-within:border-neutral-400 dark:focus-within:border-neutral-600"
        :class="!selectedCountry ? 'opacity-50' : ''"
      >
        <input
          class="flex-1 bg-transparent focus:outline-none text-sm text-neutral-900 dark:text-neutral-100 min-w-0"
          :placeholder="
            selectedCountry ? (citiesLoading ? 'Loading…' : 'City') : 'Pick country first'
          "
          :value="cityQuery"
          :disabled="!selectedCountry"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="cityOpen"
          aria-controls="location-city-listbox"
          @input="
            (e) => {
              cityQuery = (e.target as HTMLInputElement).value;
              cityOpen = true;
            }
          "
          @focus="cityOpen = true"
          @blur="onCityBlur"
          @keydown="onCityKey"
        />
      </div>
      <ul
        v-if="cityOpen && selectedCountry && filteredCities.length > 0"
        id="location-city-listbox"
        role="listbox"
        class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg text-sm"
      >
        <li
          v-for="(c, i) in filteredCities"
          :key="c.id"
          role="option"
          :aria-selected="i === cityHighlight"
          class="px-2 py-1.5 cursor-pointer"
          :class="
            i === cityHighlight
              ? 'bg-neutral-100 dark:bg-neutral-800'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
          "
          @mousedown.prevent="pickCity(c)"
          @mouseenter="cityHighlight = i"
        >
          <span class="text-neutral-900 dark:text-neutral-100">{{ c.name }}</span>
          <span class="ml-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">{{
            c.state_code
          }}</span>
        </li>
        <li
          v-if="cityOverCap"
          class="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 italic"
        >
          keep typing to narrow…
        </li>
      </ul>
    </label>
  </div>
</template>
