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
  'api::announcement.announcement.find',
  'api::announcement.announcement.findOne',
  'api::tag.tag.find',
];

const ADOPTANT_ACTIONS = [
  ...PUBLIC_READ,
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
];

const ADMIN_ACTIONS = [
  ...PUBLIC_READ,
  ...MEMBRE_ACTIONS,
  'api::animal.animal.create',
  'api::animal.animal.delete',
  'api::foster-family.foster-family.delete',
  'api::adoption-request.adoption-request.create',
  'api::adoption-request.adoption-request.delete',
  'api::swipe.swipe.find',
  'api::adopter-profile.adopter-profile.find',
];

const MEMBRE_USERNAMES = ['marie.dupont', 'jean.martin', 'sophie.bernard'];
const ADOPTANT_USERNAMES = ['luc.petit', 'emma.moreau'];

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
  }

  // No user auto-assigned here on purpose — who becomes admin is a deliberate
  // choice made from the Strapi panel (Content Manager > User > role), not
  // something to decide silently in a bootstrap script.
  const adminRole = await findOrCreateRole(strapi, 'Admin', "Administrateur — gère l'ensemble des chats et des utilisateurs");
  if (adminRole) await grantActions(strapi, adminRole.id, ADMIN_ACTIONS);
}
