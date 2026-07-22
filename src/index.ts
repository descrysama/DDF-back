import type { Core } from '@strapi/strapi';
import { seed, seedAboutContent, seedCharacters } from './seed';
import { configureRolesAndPermissions } from './bootstrap/permissions';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seed(strapi);
    await seedCharacters(strapi);
    await seedAboutContent(strapi);
    await configureRolesAndPermissions(strapi);
  },
};
