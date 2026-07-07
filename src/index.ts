import type { Core } from '@strapi/strapi';
import { seed } from './seed';

/**
 * Content types exposed publicly (find / findOne) without authentication.
 * Deliberately excludes personal-data types (adopter-profile, adoption-request,
 * foster-family, evaluation, volunteer-assignment, …).
 */
const PUBLIC_READ_APIS = [
  'animal',
  'breed',
  'tag',
  'announcement',
  'article',
  'category',
  'author',
  'about',
  'global',
];

/**
 * Grants the Public role find/findOne on browse-facing content types.
 * Idempotent — runs on every bootstrap so it survives an already-seeded DB.
 */
async function ensurePublicPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) {
    strapi.log.warn('[permissions] Rôle "public" introuvable, permissions non appliquées');
    return;
  }

  const actions = PUBLIC_READ_APIS.flatMap((api) => [
    `api::${api}.${api}.find`,
    `api::${api}.${api}.findOne`,
  ]);

  let granted = 0;
  for (const action of actions) {
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });

    if (!existing) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: publicRole.id } });
      granted += 1;
    }
  }

  if (granted > 0) {
    strapi.log.info(`[permissions] ${granted} permission(s) publique(s) accordée(s)`);
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seed(strapi);
    await ensurePublicPermissions(strapi);
  },
};
