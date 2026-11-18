import type { Recipe } from '../domain/recipes';
import type { CountryCode } from '../domain/types';
import ES from './recipes/ES.json';
import IT from './recipes/IT.json';
import DE from './recipes/DE.json';
import PL from './recipes/PL.json';
import TR from './recipes/TR.json';

export const recipesByCountry = { ES, IT, DE, PL, TR } as Record<CountryCode, Recipe[]>;
export const allRecipes: Recipe[] = Object.values(recipesByCountry).flat();
