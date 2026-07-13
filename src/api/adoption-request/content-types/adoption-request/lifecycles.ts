/**
 * adoption-request lifecycles
 *
 * On creation, resolves who should handle the request — the animal's
 * referent if available, otherwise the first available backup — fills it
 * in when not already set, and emails them. Never lets a notification
 * failure (no provider configured, bad SMTP creds, …) break the request.
 */

export default {
  async afterCreate(event: any) {
    try {
      const request = await strapi.documents('api::adoption-request.adoption-request').findOne({
        documentId: event.result.documentId,
        populate: { animal: true, referent: true },
      });
      if (!request) return;

      let referent = request.referent as any;

      if (!referent && request.animal) {
        const animal = await strapi.documents('api::animal.animal').findOne({
          documentId: (request.animal as any).documentId,
          populate: { referent: true, backup_referents: true },
        });
        if (animal) {
          referent = strapi.service('api::animal.animal').resolveActiveReferent(animal);
          if (referent) {
            await strapi.documents('api::adoption-request.adoption-request').update({
              documentId: request.documentId,
              data: { referent: referent.id },
            });
          }
        }
      }

      if (referent?.email) {
        const animalName = (request.animal as any)?.name;
        await strapi.plugin('email').service('email').send({
          to: referent.email,
          subject: `Nouvelle demande d'adoption${animalName ? ` — ${animalName}` : ''}`,
          text: `Une nouvelle demande d'adoption vient d'être soumise${animalName ? ` pour ${animalName}` : ''}. Connectez-vous à l'administration pour la traiter.`,
        });
      }
    } catch (err) {
      strapi.log.error('[adoption-request afterCreate] notification failed', err);
    }
  },
};
