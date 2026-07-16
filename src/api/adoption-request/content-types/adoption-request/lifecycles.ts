/**
 * adoption-request lifecycles
 *
 * On creation, resolves who should handle the request — the animal's
 * referent if available, otherwise the first available backup — fills it
 * in when not already set, emails them, and sends the adopter an
 * acknowledgement. On every status change, emails the adopter again so they
 * know their request moved to in_progress/approved/rejected.
 *
 * Never lets a notification failure (no provider configured, bad SMTP
 * creds, …) break the request itself.
 */

const STATUS_EMAIL: Record<string, { subject: string; text: string }> = {
  in_progress: {
    subject: 'Votre demande d\'adoption est en cours de traitement',
    text: 'Un membre de notre association a commencé à étudier votre demande. Nous revenons vers vous très vite.',
  },
  approved: {
    subject: 'Votre demande d\'adoption a été acceptée !',
    text: 'Bonne nouvelle : votre demande a été acceptée. Un membre de notre association va vous recontacter pour organiser la suite.',
  },
  rejected: {
    subject: 'Votre demande d\'adoption',
    text: 'Après étude, nous ne pouvons malheureusement pas donner suite à votre demande. Merci pour votre intérêt et votre engagement envers nos chats.',
  },
};

export default {
  async afterCreate(event: any) {
    try {
      const request = await strapi.documents('api::adoption-request.adoption-request').findOne({
        documentId: event.result.documentId,
        populate: { animal: true, referent: true, adopter: true },
      });
      if (!request) return;

      let referent = request.referent as any;
      const animalName = (request.animal as any)?.name;

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
        await strapi.plugin('email').service('email').send({
          to: referent.email,
          subject: `Nouvelle demande d'adoption${animalName ? ` — ${animalName}` : ''}`,
          text: `Une nouvelle demande d'adoption vient d'être soumise${animalName ? ` pour ${animalName}` : ''}. Connectez-vous à l'administration pour la traiter.`,
        });
      }

      const adopter = request.adopter as any;
      if (adopter?.email) {
        await strapi.plugin('email').service('email').send({
          to: adopter.email,
          subject: `Demande reçue${animalName ? ` — ${animalName}` : ''}`,
          text: `Merci pour votre demande d'adoption${animalName ? ` concernant ${animalName}` : ''} ! Notre équipe bénévole reviendra vers vous sous 48h pour un premier échange.`,
        });
      }
    } catch (err) {
      strapi.log.error('[adoption-request afterCreate] notification failed', err);
    }
  },

  async beforeUpdate(event: any) {
    try {
      const { where } = event.params;
      if (!where) return;
      const existing = await strapi.db.query('api::adoption-request.adoption-request').findOne({
        where,
        populate: { adopter: true, animal: true },
      });
      event.state = {
        previousStatus: existing?.status ?? null,
        adopter: existing?.adopter ?? null,
        animal: existing?.animal ?? null,
      };
    } catch (err) {
      strapi.log.error('[adoption-request beforeUpdate] state capture failed', err);
    }
  },

  async afterUpdate(event: any) {
    try {
      const newStatus = event.params?.data?.status;
      const previousStatus = event.state?.previousStatus;
      if (!newStatus || newStatus === previousStatus) return;

      const template = STATUS_EMAIL[newStatus];
      if (!template) return;

      const adopter = event.state?.adopter;
      if (!adopter?.email) return;

      const animalName = event.state?.animal?.name;
      await strapi.plugin('email').service('email').send({
        to: adopter.email,
        subject: `${template.subject}${animalName ? ` — ${animalName}` : ''}`,
        text: template.text,
      });
    } catch (err) {
      strapi.log.error('[adoption-request afterUpdate] notification failed', err);
    }
  },
};
