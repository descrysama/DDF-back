/**
 * The plugin's default `user.update` controller (PUT /api/users/:id) updates
 * whichever id is in the URL with no check against the caller — granting the
 * `user.update` permission to any role lets that role edit *any* user's
 * email/username/password, not just their own. We only need this action for
 * the self-service absence toggle on /profile (which always passes the
 * caller's own id), so scope the controller to self here instead of trusting
 * every caller to pass their own id.
 */
export default (plugin: any) => {
  const defaultUpdate = plugin.controllers.user.update;

  plugin.controllers.user.update = async (ctx: any) => {
    const callerId = ctx.state.user?.id;
    if (!callerId || String(ctx.params.id) !== String(callerId)) {
      return ctx.forbidden('You can only update your own account.');
    }
    return defaultUpdate(ctx);
  };

  /**
   * Admin-only role assignment: PUT /api/users/:id/role with `{ "role": <id> }`.
   *
   * The self-scoped `update` above deliberately blocks admins from editing other
   * users, so role changes need their own door. This one is narrower on purpose —
   * it writes the `role` relation and nothing else, so it can never be used to
   * change an email, username, or password the way `update` could.
   *
   * Authorization is by API token: this route is not granted to the public or
   * authenticated roles, so only a caller holding STRAPI_TOKEN reaches it. The
   * frontend gates it further with requireAdmin() in the server action.
   */
  plugin.controllers.user.updateRole = async (ctx: any) => {
    const { id } = ctx.params;
    const { role } = ctx.request.body ?? {};

    const roleId = Number(role);
    if (!Number.isInteger(roleId)) {
      return ctx.badRequest('A numeric `role` id is required.');
    }

    const userQuery = strapi.query('plugin::users-permissions.user');

    const target = await userQuery.findOne({ where: { id } });
    if (!target) {
      return ctx.notFound('User not found.');
    }

    const roleExists = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: roleId } });
    if (!roleExists) {
      return ctx.badRequest('Unknown role id.');
    }

    await userQuery.update({ where: { id }, data: { role: roleId } });

    ctx.body = await userQuery.findOne({ where: { id }, populate: ['role'] });
  };

  plugin.routes['content-api'].routes.push({
    method: 'PUT',
    path: '/users/:id/role',
    handler: 'user.updateRole',
    config: { prefix: '' },
  });

  plugin.controllers.user.me = async (ctx: any) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const userWithRole = await strapi
      .query('plugin::users-permissions.user')
      .findOne({
        where: { id: user.id },
        populate: ['role'],
      });

    ctx.body = userWithRole;
  };

  return plugin;
};
