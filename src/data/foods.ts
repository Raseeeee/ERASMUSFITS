import type { Food } from '../domain/foods';
import seed from './foods.seed.json';

export const seedFoods = seed as Food[];
