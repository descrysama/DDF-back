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

interface AdopterCriteria {
  has_children: boolean;
  has_dogs: boolean;
  has_cats: boolean;
  has_garden: boolean;
  housing_type: 'house' | 'apartment' | null;
  experience_level: 'none' | 'some' | 'experienced';
}

function mapHousingType(type: unknown): 'house' | 'apartment' | null {
  if (type === 'Maison') return 'house';
  if (type === 'Appartement') return 'apartment';
  return null;
}

/**
 * By the time this DB-level lifecycle fires, the Document Service has
 * already normalized a to-one relation input (a bare documentId string, as
 * sent by the front) into its internal `{ set: [{ id }] }` shape — it is
 * never still a plain string here. Reads the numeric id out of that shape
 * (or falls back to a bare string/number, in case a caller ever passes one
 * directly, e.g. from a script or a future admin action).
 */
function extractRelationId(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || null;
  if (value && Array.isArray(value.set) && value.set[0]) return value.set[0].id ?? null;
  if (value && Array.isArray(value.connect) && value.connect[0]) return value.connect[0].id ?? null;
  if (value && typeof value === 'object' && 'id' in value) return value.id;
  return null;
}

function isExperienceLevel(v: unknown): v is 'none' | 'some' | 'experienced' {
  return v === 'none' || v === 'some' || v === 'experienced';
}

/**
 * Adoption-request match_score, distinct from
 * `api::animal.animal.computeCompatibility` (used by /matches swipe
 * discovery). That shared formula spends 20 of its 100 points on age/energy
 * *preferences* — meaningless here, since applying for a specific cat isn't
 * expressing a preference, you've already picked one, so those two
 * dimensions were always full and never differentiated anything. Here they're
 * replaced by a graduated experience score (10/20/30), which does vary with
 * what the adopter actually declared.
 */
function computeRequestMatchScore(
  animal: { ok_with_children: boolean; ok_with_dogs: boolean; ok_with_cats: boolean; indoor_only: boolean },
  profile: AdopterCriteria
): number {
  let score = 0;

  score += profile.has_children && !animal.ok_with_children ? 0 : 20;
  score += profile.has_dogs && !animal.ok_with_dogs ? 0 : 15;
  score += profile.has_cats && !animal.ok_with_cats ? 0 : 15;

  const hasOutdoorAccess = profile.housing_type === 'house' || profile.has_garden;
  score += !animal.indoor_only && !hasOutdoorAccess ? 0 : 20;

  score += profile.experience_level === 'experienced' ? 30 : profile.experience_level === 'some' ? 20 : 10;

  return score;
}

/**
 * Builds compatibility criteria straight from the fields the adoption-request
 * form itself already collects (household/housing/outdoor/other_pets/
 * cat_experience) — every real submission has these, unlike the separate,
 * optional adopter-profile (/profile), which most adopters never fill in
 * before applying.
 */
function buildAdopterCriteriaFromRequestData(data: any): AdopterCriteria | null {
  const household = data.household;
  const housing = data.housing;
  if (!household || !housing) return null;

  const otherPets = data.other_pets;
  const hasOtherPets = Boolean(otherPets?.has_other_pets);

  return {
    has_children: Boolean(household.has_children),
    has_dogs: hasOtherPets && Boolean(otherPets?.has_dog),
    has_cats: hasOtherPets && Boolean(otherPets?.has_cat),
    has_garden: Boolean(data.outdoor?.garden?.has_garden),
    housing_type: mapHousingType(housing.type),
    experience_level: isExperienceLevel(data.cat_experience) ? data.cat_experience : 'some',
  };
}

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
  /**
   * Auto-computes match_score from the linked animal + the household data
   * submitted with this very request (preferred — always present), falling
   * back to the adopter's separate /profile if that request-level data is
   * missing (e.g. a request created directly in admin without those fields).
   * Skipped entirely if match_score was already set explicitly (manual admin
   * entry, or a caller that computed its own).
   */
  async beforeCreate(event: any) {
    try {
      const data = event.params?.data;
      if (!data || data.match_score != null || !data.animal) return;

      const animalId = extractRelationId(data.animal);
      if (animalId == null) return;

      const animal = await strapi.db.query('api::animal.animal').findOne({ where: { id: animalId } });
      if (!animal) return;

      let profile = buildAdopterCriteriaFromRequestData(data);
      const adopterId = extractRelationId(data.adopter);
      if (!profile && adopterId != null) {
        profile = (await strapi.documents('api::adopter-profile.adopter-profile').findFirst({
          filters: { user: { id: adopterId } },
        })) as any;
      }
      if (!profile) return;

      data.match_score = computeRequestMatchScore(animal as any, profile as any);
    } catch (err) {
      strapi.log.error('[adoption-request beforeCreate] match_score computation failed', err);
    }
  },

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
