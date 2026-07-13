/**
 * animal custom routes — additive to the core router in routes/animal.ts
 *
 * `/animal-discovery` (not `/animals/discover`): the core router already has
 * `GET /animals/:id`, which is the same shape as `/animals/discover` and
 * matches first — "discover" gets swallowed as an id and 404s. Keeping this
 * one segment away from `/animals/*` sidesteps the collision entirely.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/animal-discovery',
      handler: 'animal.discover',
      config: {},
    },
    {
      method: 'GET',
      path: '/animals/:id/compatibility',
      handler: 'animal.compatibility',
      config: {},
    },
  ],
};
