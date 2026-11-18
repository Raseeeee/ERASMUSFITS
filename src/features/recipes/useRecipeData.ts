import { useMemo } from 'react';
import { countries, priceTables, seedFoodMap } from '../../data/countries';
import { recipesByCountry } from '../../data/recipes';
import { activeCountry } from '../../domain/profile';
import { recipeInfo, type RecipeInfo } from '../../domain/recipes';
import type { CountryCode } from '../../domain/types';
import { useAppStore } from '../../store/appStore';

/** País donde se compra (destino o nacionalidad) y país de origen si es Erasmus. */
export function useCountries(): { buyCountry: CountryCode; origin: CountryCode | null } {
  const trip = useAppStore((s) => s.trip);
  if (!trip) return { buyCountry: 'ES', origin: null };
  return { buyCountry: activeCountry(trip), origin: trip.erasmus ? trip.origin : null };
}

/**
 * Información de las recetas de `recipeCountry`, con precios del país donde compras.
 * `familiar`: ≥ 50 % de los ingredientes son básicos de tu país de origen.
 */
export function useRecipeInfos(recipeCountry: CountryCode): (RecipeInfo & { familiar: boolean })[] {
  const { buyCountry, origin } = useCountries();
  return useMemo(() => {
    const originStaples = origin ? new Set(countries[origin].staples) : null;
    return recipesByCountry[recipeCountry].map((r) => {
      const info = recipeInfo(r, seedFoodMap, priceTables[buyCountry]);
      const familiar =
        !!originStaples &&
        r.ingredients.filter((i) => originStaples.has(i.foodId)).length / r.ingredients.length >= 0.5;
      return { ...info, familiar };
    });
  }, [recipeCountry, buyCountry, origin]);
}
