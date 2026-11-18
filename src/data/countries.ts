import type { CountryInfo, PriceTable, SubstitutionGroup } from '../domain/prices';
import type { CountryCode } from '../domain/types';
import countriesJson from './countries.json';
import ES from './prices/ES.json';
import IT from './prices/IT.json';
import DE from './prices/DE.json';
import PL from './prices/PL.json';
import TR from './prices/TR.json';
import { seedFoods } from './foods';
import type { Food } from '../domain/foods';

export const countries = countriesJson.countries as Record<CountryCode, CountryInfo>;
export const substitutionGroups = countriesJson.substitutionGroups as Record<string, SubstitutionGroup>;
export const priceTables = { ES, IT, DE, PL, TR } as Record<CountryCode, PriceTable>;
export const seedFoodMap: Map<string, Food> = new Map(seedFoods.map((f) => [f.id, f]));
