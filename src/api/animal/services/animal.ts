/**
 * animal service
 */

import { factories } from '@strapi/strapi';

type AgePreference = 'chaton' | 'adulte' | 'senior' | 'peu_importe';

interface AnimalCriteria {
  age: number;
  ok_with_children: boolean;
  ok_with_dogs: boolean;
  ok_with_cats: boolean;
  indoor_only: boolean;
  activity_level: 'low' | 'medium' | 'high' | null;
}

interface AdopterCriteria {
  has_children: boolean;
  has_dogs: boolean;
  has_cats: boolean;
  has_garden: boolean;
  housing_type: 'house' | 'apartment' | null;
  experience_level: 'none' | 'some' | 'experienced';
  age_preference?: AgePreference | null;
}

interface Absentable {
  is_absent?: boolean | null;
  absent_until?: string | null;
}

function animalAgeCategory(age: number): 'chaton' | 'adulte' | 'senior' {
  if (age <= 1) return 'chaton';
  if (age >= 10) return 'senior';
  return 'adulte';
}

function isUserAvailable(user: Absentable | null | undefined): boolean {
  if (!user) return false;
  if (!user.is_absent) return true;
  if (!user.absent_until) return false;
  return new Date(user.absent_until) < new Date();
}

export default factories.createCoreService('api::animal.animal', () => ({
  /**
   * Weighted match between a cat's known constraints and an adopter's
   * declared household. Each criterion only costs points when there's an
   * actual conflict — a profile with no children isn't penalised against
   * `ok_with_children`, since there's nothing to be incompatible with.
   */
  computeCompatibility(animal: AnimalCriteria, profile: AdopterCriteria): number {
    let score = 0;

    score += profile.has_children && !animal.ok_with_children ? 0 : 20;
    score += profile.has_dogs && !animal.ok_with_dogs ? 0 : 15;
    score += profile.has_cats && !animal.ok_with_cats ? 0 : 15;

    const hasOutdoorAccess = profile.housing_type === 'house' || profile.has_garden;
    score += !animal.indoor_only && !hasOutdoorAccess ? 0 : 20;

    const needsExperience = animal.activity_level === 'high';
    score += needsExperience && profile.experience_level === 'none' ? 5 : 15;

    const agePreference = profile.age_preference;
    const ageMatches = !agePreference || agePreference === 'peu_importe' || agePreference === animalAgeCategory(animal.age);
    score += ageMatches ? 15 : 5;

    return score;
  },

  /**
   * Referent if present and available, otherwise the first available backup.
   * `is_absent` alone means "away indefinitely"; `absent_until` in the past
   * counts as back.
   */
  resolveActiveReferent<T extends Absentable & { id: number }>(animal: {
    referent?: T | null;
    backup_referents?: T[] | null;
  }): T | null {
    const candidates = [animal.referent, ...(animal.backup_referents ?? [])];
    return candidates.find((u): u is T => isUserAvailable(u)) ?? null;
  },
}));
