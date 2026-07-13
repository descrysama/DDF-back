import type { Core } from '@strapi/strapi';
import { seed } from './seed';
import { configureRolesAndPermissions } from './bootstrap/permissions';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seed(strapi);
    await configureRolesAndPermissions(strapi);
  },
};
