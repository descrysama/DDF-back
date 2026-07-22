import type { Core } from '@strapi/strapi';
import { seed, seedAboutContent, seedCharacters, seedConstraints } from './seed';
import { configureRolesAndPermissions } from './bootstrap/permissions';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seed(strapi);
    await seedCharacters(strapi);
    await seedConstraints(strapi);
    await seedAboutContent(strapi);
    await configureRolesAndPermissions(strapi);
  },
};
