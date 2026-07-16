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

  return plugin;
};
