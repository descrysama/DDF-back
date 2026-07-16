/**
 * animal controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::animal.animal', ({ strapi }) => ({
  /**
   * Swipe deck feed: available cats the given user hasn't swiped on yet,
   * each carrying a compatibility score when the user has an adopter profile.
   */
  async discover(ctx) {
    const userId = ctx.query.user ? Number(ctx.query.user) : null;
    const limit = ctx.query.limit ? Number(ctx.query.limit) : 20;

    let excludeDocumentIds: string[] = [];
    if (userId) {
      const swipes = await strapi.documents('api::swipe.swipe').findMany({
        filters: { user: { id: userId } },
        populate: { animal: true },
        limit: 1000,
      });
      excludeDocumentIds = swipes
        .map((s: any) => s.animal?.documentId)
        .filter((id: unknown): id is string => Boolean(id));
    }

    const animals = await strapi.documents('api::animal.animal').findMany({
      filters: {
        status: 'available',
        ...(excludeDocumentIds.length ? { documentId: { $notIn: excludeDocumentIds } } : {}),
      },
      populate: { breed: true, bonded_with: true, medias: { populate: ['image'] } },
      limit,
    });

    const profile = userId
      ? await strapi.documents('api::adopter-profile.adopter-profile').findFirst({
          filters: { user: { id: userId } },
        })
      : null;

    const animalService = strapi.service('api::animal.animal');

    ctx.body = {
      data: animals.map((animal: any) => ({
        ...animal,
        compatibility: profile ? animalService.computeCompatibility(animal, profile) : null,
      })),
    };
  },

  /** Compatibility score for a single cat, used on its detail page. */
  async compatibility(ctx) {
    const { id } = ctx.params;
    const userId = ctx.query.user ? Number(ctx.query.user) : null;

    if (!userId) {
      ctx.body = { data: { score: null } };
      return;
    }

    const animal = await strapi.documents('api::animal.animal').findOne({ documentId: id });
    const profile = await strapi.documents('api::adopter-profile.adopter-profile').findFirst({
      filters: { user: { id: userId } },
    });

    if (!animal || !profile) {
      ctx.body = { data: { score: null } };
      return;
    }

    const score = strapi.service('api::animal.animal').computeCompatibility(animal, profile);
    ctx.body = { data: { score } };
  },
}));
