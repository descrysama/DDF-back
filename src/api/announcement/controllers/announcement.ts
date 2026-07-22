/**
 * announcement controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::announcement.announcement', ({ strapi }) => ({
  /** Publishes the current draft content, making the announcement publicly visible. */
  async publish(ctx) {
    const { id: documentId } = ctx.params;
    const { entries } = await strapi.documents('api::announcement.announcement').publish({ documentId });
    ctx.body = { data: entries[0] ?? null };
  },

  /** Unpublishes the announcement, removing it from public visibility without deleting the draft. */
  async unpublish(ctx) {
    const { id: documentId } = ctx.params;
    const { entries } = await strapi.documents('api::announcement.announcement').unpublish({ documentId });
    ctx.body = { data: entries[0] ?? null };
  },
}));
