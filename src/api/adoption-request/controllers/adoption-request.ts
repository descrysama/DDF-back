/**
 * adoption-request controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::adoption-request.adoption-request', ({ strapi }) => ({
  /**
   * Auto-fills `match_score` from the same weighted algorithm used on the
   * public animal/discover pages (`api::animal.animal`'s computeCompatibility),
   * so a request created through the public adoption form carries the same
   * score the adopter saw on the cat's page — instead of staying null forever
   * (nothing else in the app ever set it for real submissions; only the dev
   * seed hardcodes a score). Only runs when the caller didn't already supply
   * one (the admin panel lets a referent set it by hand).
   */
  async create(ctx) {
    const data = ctx.request.body?.data ?? {};

    if (data.match_score == null && data.animal && data.adopter) {
      const adopterId = typeof data.adopter === 'object' ? data.adopter.id : data.adopter;
      const animal = await strapi.documents('api::animal.animal').findOne({ documentId: data.animal });
      const profile = animal
        ? await strapi.documents('api::adopter-profile.adopter-profile').findFirst({
            filters: { user: { id: adopterId } },
          })
        : null;

      if (animal && profile) {
        data.match_score = strapi.service('api::animal.animal').computeCompatibility(animal, profile);
        ctx.request.body.data = data;
      }
    }

    return super.create(ctx);
  },
}));
