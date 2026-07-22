/**
 * announcement custom routes — additive to the core router in routes/announcement.ts
 *
 * POST/:id/publish and POST/:id/unpublish, one segment past the documentId so
 * they don't collide with the core router's PUT /announcements/:id.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/announcements/:id/publish',
      handler: 'announcement.publish',
      config: {},
    },
    {
      method: 'POST',
      path: '/announcements/:id/unpublish',
      handler: 'announcement.unpublish',
      config: {},
    },
  ],
};
