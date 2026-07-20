import type { Core } from '@strapi/strapi';

/**
 * Idempotent role + permission setup, re-run on every boot (unlike seed.ts,
 * which only runs once). Lets an already-seeded dev database self-heal when
 * this list changes, instead of requiring a fresh DB.
 */

const PUBLIC_READ = [
  'api::animal.animal.find',
  'api::animal.animal.findOne',
  'api::breed.breed.find',
  'api::breed.breed.findOne',
  'api::announcement.announcement.find',
  'api::announcement.announcement.findOne',
  'api::tag.tag.find',
  'api::tag.tag.findOne',
];

// Every logged-in role needs these to use the front at all: `user.me` backs
// getCurrentUser() (called on every page load / middleware check), and
// `user.update` backs the self-service absence toggle on /profile. Both are
// self-scoped: `me` always returns the caller, and the `user.update` route is
// restricted to the caller's own id by a controller override in
// src/extensions/users-permissions/strapi-server.ts — so granting them here
// can't let one account edit another's.
const SELF_SERVICE_ACTIONS = [
  'plugin::users-permissions.user.me',
  'plugin::users-permissions.user.update',
  'plugin::users-permissions.role.find',
];

const ADOPTANT_ACTIONS = [
  ...PUBLIC_READ,
  ...SELF_SERVICE_ACTIONS,
  'api::animal.animal.discover',
  'api::animal.animal.compatibility',
  'api::adoption-request.adoption-request.create',
  'api::swipe.swipe.create',
  'api::swipe.swipe.find',
  'api::adopter-profile.adopter-profile.find',
  'api::adopter-profile.adopter-profile.create',
  'api::adopter-profile.adopter-profile.update',
];

const MEMBRE_ACTIONS = [
  ...PUBLIC_READ,
  ...SELF_SERVICE_ACTIONS,
  'api::foster-family.foster-family.find',
  'api::foster-family.foster-family.findOne',
  'api::foster-family.foster-family.create',
  'api::foster-family.foster-family.update',
  'api::foster-assignment.foster-assignment.find',
  'api::foster-assignment.foster-assignment.create',
  'api::foster-assignment.foster-assignment.update',
  'api::evaluation.evaluation.find',
  'api::evaluation.evaluation.create',
  'api::evaluation.evaluation.update',
  'api::adoption-request.adoption-request.find',
  'api::adoption-request.adoption-request.findOne',
  'api::adoption-request.adoption-request.update',
  'api::volunteer-assignment.volunteer-assignment.find',
  'api::volunteer-assignment.volunteer-assignment.create',
  'api::volunteer-assignment.volunteer-assignment.update',
  'api::animal.animal.update',
  'api::distribution.distribution.find',
  'api::distribution.distribution.findOne',
  'api::distribution.distribution.create',
  'api::distribution.distribution.update',
];

// Admin = accès complet (CRUD) sur tout le domaine métier + lecture des comptes
// utilisateurs. C'est le rôle le plus permissif de l'appli (à distinguer du
// super-admin du panel Strapi, géré séparément dans seed.ts).
const ADMIN_ACTIONS = [
  ...PUBLIC_READ,
  ...MEMBRE_ACTIONS,
  // ...et les actions Adoptant : un admin reste un utilisateur qui peut ouvrir
  // /matches. Sans ça il hérite de `swipe.find` par la liste ci-dessous sans
  // jamais obtenir `discover`/`compatibility`/`swipe.create` — le deck répond
  // 403 alors que le rôle est censé être le plus permissif de l'appli.
  ...ADOPTANT_ACTIONS,
  'api::animal.animal.create',
  'api::animal.animal.delete',
  'api::breed.breed.create',
  'api::breed.breed.update',
  'api::breed.breed.delete',
  'api::announcement.announcement.create',
  'api::announcement.announcement.update',
  'api::announcement.announcement.delete',
  'api::tag.tag.create',
  'api::tag.tag.update',
  'api::tag.tag.delete',
  'api::foster-family.foster-family.delete',
  'api::foster-assignment.foster-assignment.findOne',
  'api::foster-assignment.foster-assignment.delete',
  'api::evaluation.evaluation.findOne',
  'api::evaluation.evaluation.delete',
  'api::adoption-request.adoption-request.delete',
  'api::volunteer-assignment.volunteer-assignment.findOne',
  'api::volunteer-assignment.volunteer-assignment.delete',
  'api::adopter-profile.adopter-profile.findOne',
  'api::adopter-profile.adopter-profile.delete',
  'api::distribution.distribution.delete',
  'plugin::users-permissions.user.find',
  'plugin::users-permissions.user.findOne',
];

const MEMBRE_USERNAMES = ['marie.dupont', 'jean.martin', 'sophie.bernard'];
const ADOPTANT_USERNAMES = ['luc.petit', 'emma.moreau'];
const ADMIN_USERNAMES = ['admin'];

async function grantActions(strapi: Core.Strapi, roleId: number, actions: string[]) {
  for (const action of actions) {
    const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
      where: { action, role: roleId },
    });
    if (!existing) {
      await strapi.db.query('plugin::users-permissions.permission').create({
        data: { action, role: roleId },
      });
    }
  }
}

async function findOrCreateRole(strapi: Core.Strapi, name: string, description: string) {
  const existing = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { name } });
  if (existing) return existing;

  await strapi.plugin('users-permissions').service('role').createRole({ name, description });
  return strapi.db.query('plugin::users-permissions.role').findOne({ where: { name } });
}

async function assignUsersToRole(strapi: Core.Strapi, usernames: string[], roleId: number) {
  for (const username of usernames) {
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { username } });
    if (user) {
      await strapi.db.query('plugin::users-permissions.user').update({ where: { id: user.id }, data: { role: roleId } });
    }
  }
}

// Public self-registration (POST /api/auth/local/register) assigns whatever
// role is configured here as "default_role" — point it at Adoptant so anyone
// signing up through the public form lands in that role instead of Strapi's
// generic "Authenticated". Becoming Membre/Admin stays a manual panel change.
async function setDefaultRegistrationRole(strapi: Core.Strapi, roleType: string) {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const settings = (await pluginStore.get({ key: 'advanced' })) as Record<string, unknown> | null;
  if (settings && settings.default_role !== roleType) {
    await pluginStore.set({ key: 'advanced', value: { ...settings, default_role: roleType } });
  }
}

export async function configureRolesAndPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (publicRole) await grantActions(strapi, publicRole.id, PUBLIC_READ);

  const membreRole = await findOrCreateRole(strapi, 'Membre', "Bénévole ou salarié de l'association");
  if (membreRole) {
    await grantActions(strapi, membreRole.id, MEMBRE_ACTIONS);
    await assignUsersToRole(strapi, MEMBRE_USERNAMES, membreRole.id);
  }

  const adoptantRole = await findOrCreateRole(strapi, 'Adoptant', 'Personne inscrite pour adopter un chat');
  if (adoptantRole) {
    await grantActions(strapi, adoptantRole.id, ADOPTANT_ACTIONS);
    await assignUsersToRole(strapi, ADOPTANT_USERNAMES, adoptantRole.id);
    await setDefaultRegistrationRole(strapi, adoptantRole.type);
  }

  // Dev seed only: the 'admin' user created in seed.ts (throwaway admin123
  // credentials, for quickly testing admin-only permissions from the front)
  // is assigned here, same pattern as Membre/Adoptant above.
  const adminRole = await findOrCreateRole(strapi, 'Admin', "Administrateur — gère l'ensemble des chats et des utilisateurs");
  if (adminRole) {
    await grantActions(strapi, adminRole.id, ADMIN_ACTIONS);
    await assignUsersToRole(strapi, ADMIN_USERNAMES, adminRole.id);
  }
}
