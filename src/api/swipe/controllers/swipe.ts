/**
 * swipe controller
 *
 * Swiping the same animal twice is a re-swipe, not a duplicate: `create`
 * upserts on (user, animal) so a changed mind (pass -> like) doesn't leave
 * stale rows behind.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::swipe.swipe', ({ strapi }) => ({
  async create(ctx) {
    const { animal, direction } = ctx.request.body?.data ?? {};
    // The caller's own identity — never trust a client-supplied `user` field,
    // or any authenticated user could record swipes on someone else's behalf.
    const user = ctx.state.user?.id;

    if (!user || !animal || !direction) {
      return ctx.badRequest('user, animal et direction sont requis');
    }

    const existing = await strapi.documents('api::swipe.swipe').findFirst({
      filters: { user: { id: user }, animal: { documentId: animal } },
    });

    const document = existing
      ? await strapi.documents('api::swipe.swipe').update({
          documentId: existing.documentId,
          data: { direction },
        })
      : await strapi.documents('api::swipe.swipe').create({
          data: { user, animal, direction },
        });

    ctx.body = { data: document };
  },
}));
