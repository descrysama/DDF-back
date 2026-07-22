/**
 * swipe controller
 *
 * Swiping the same announcement twice is a re-swipe, not a duplicate:
 * `create` upserts on (user, announcement) so a changed mind (pass -> like)
 * doesn't leave stale rows behind.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::swipe.swipe', ({ strapi }) => ({
  async create(ctx) {
    const { announcement, direction } = ctx.request.body?.data ?? {};
    // The caller's own identity — never trust a client-supplied `user` field,
    // or any authenticated user could record swipes on someone else's behalf.
    const user = ctx.state.user?.id;

    if (!user || !announcement || !direction) {
      return ctx.badRequest('user, announcement et direction sont requis');
    }

    const existing = await strapi.documents('api::swipe.swipe').findFirst({
      filters: { user: { id: user }, announcement: { documentId: announcement } },
    });

    const document = existing
      ? await strapi.documents('api::swipe.swipe').update({
          documentId: existing.documentId,
          data: { direction },
        })
      : await strapi.documents('api::swipe.swipe').create({
          data: { user, announcement, direction },
        });

    ctx.body = { data: document };
  },
}));
