/**
 * Script de génération des content types Strapi v5
 * Usage: node generate-schemas.js
 *
 * Génère 10 content types depuis le schéma dbdiagram DDF
 * Note: "users" est géré par le plugin users-permissions de Strapi → pas recréé
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, 'src', 'api');

// ─── Définition des content types ────────────────────────────────────────────

const contentTypes = [

  // ── 1. Breed ──────────────────────────────────────────────────────────────
  {
    name: 'breed',
    schema: {
      kind: 'collectionType',
      collectionName: 'breeds',
      info: { singularName: 'breed', pluralName: 'breeds', displayName: 'Breed' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        name:    { type: 'string', required: true },
        species: { type: 'string' },
        animals: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::animal.animal', mappedBy: 'breed',
        },
      },
    },
  },

  // ── 2. Animal ─────────────────────────────────────────────────────────────
  {
    name: 'animal',
    schema: {
      kind: 'collectionType',
      collectionName: 'animals',
      info: { singularName: 'animal', pluralName: 'animals', displayName: 'Animal' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        name:        { type: 'string', required: true },
        age:         { type: 'integer' },
        gender:      { type: 'enumeration', enum: ['male', 'female', 'unknown'] },
        description: { type: 'text' },
        status: {
          type: 'enumeration',
          enum: ['available', 'in_foster', 'reserved', 'adopted'],
          default: 'available',
        },
        breed: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::breed.breed', inversedBy: 'animals',
        },
        bonded_with: {
          type: 'relation', relation: 'oneToOne',
          target: 'api::animal.animal',
        },
        diet_notes:      { type: 'text' },
        ok_with_children: { type: 'boolean', default: false },
        ok_with_dogs:    { type: 'boolean', default: false },
        ok_with_cats:    { type: 'boolean', default: false },
        indoor_only:     { type: 'boolean', default: false },
        activity_level: {
          type: 'enumeration',
          enum: ['low', 'medium', 'high'],
        },
        announcements: {
          type: 'relation', relation: 'manyToMany',
          target: 'api::announcement.announcement', mappedBy: 'animals',
        },
        foster_assignments: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::foster-assignment.foster-assignment', mappedBy: 'animal',
        },
        evaluations: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::evaluation.evaluation', mappedBy: 'animal',
        },
        volunteer_assignments: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::volunteer-assignment.volunteer-assignment', mappedBy: 'animal',
        },
      },
    },
  },

  // ── 3. Foster Family ──────────────────────────────────────────────────────
  {
    name: 'foster-family',
    schema: {
      kind: 'collectionType',
      collectionName: 'foster_families',
      info: { singularName: 'foster-family', pluralName: 'foster-families', displayName: 'Foster Family' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        user: {
          type: 'relation', relation: 'oneToOne',
          target: 'plugin::users-permissions.user',
        },
        address:      { type: 'string' },
        has_children: { type: 'boolean', default: false },
        has_dogs:     { type: 'boolean', default: false },
        has_cats:     { type: 'boolean', default: false },
        max_capacity: { type: 'integer' },
        foster_assignments: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::foster-assignment.foster-assignment', mappedBy: 'foster_family',
        },
        evaluations: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::evaluation.evaluation', mappedBy: 'foster_family',
        },
      },
    },
  },

  // ── 4. Foster Assignment ──────────────────────────────────────────────────
  {
    name: 'foster-assignment',
    schema: {
      kind: 'collectionType',
      collectionName: 'foster_assignments',
      info: { singularName: 'foster-assignment', pluralName: 'foster-assignments', displayName: 'Foster Assignment' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        animal: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::animal.animal', inversedBy: 'foster_assignments',
        },
        foster_family: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::foster-family.foster-family', inversedBy: 'foster_assignments',
        },
        start_date: { type: 'date' },
        end_date:   { type: 'date' },
        status: {
          type: 'enumeration',
          enum: ['active', 'completed'],
          default: 'active',
        },
      },
    },
  },

  // ── 5. Evaluation ─────────────────────────────────────────────────────────
  {
    name: 'evaluation',
    schema: {
      kind: 'collectionType',
      collectionName: 'evaluations',
      info: { singularName: 'evaluation', pluralName: 'evaluations', displayName: 'Evaluation' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        animal: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::animal.animal', inversedBy: 'evaluations',
        },
        foster_family: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::foster-family.foster-family', inversedBy: 'evaluations',
        },
        author: {
          type: 'relation', relation: 'manyToOne',
          target: 'plugin::users-permissions.user',
        },
        energy_level:    { type: 'string' },
        ok_with_children: { type: 'boolean', default: false },
        ok_with_dogs:    { type: 'boolean', default: false },
        ok_with_cats:    { type: 'boolean', default: false },
        behaviour_notes: { type: 'text' },
        diet_notes:      { type: 'text' },
        evaluated_at:    { type: 'date' },
      },
    },
  },

  // ── 6. Adopter Profile ────────────────────────────────────────────────────
  {
    name: 'adopter-profile',
    schema: {
      kind: 'collectionType',
      collectionName: 'adopter_profiles',
      info: { singularName: 'adopter-profile', pluralName: 'adopter-profiles', displayName: 'Adopter Profile' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        user: {
          type: 'relation', relation: 'oneToOne',
          target: 'plugin::users-permissions.user',
        },
        housing_type: {
          type: 'enumeration',
          enum: ['house', 'apartment'],
        },
        has_garden:   { type: 'boolean', default: false },
        has_children: { type: 'boolean', default: false },
        has_dogs:     { type: 'boolean', default: false },
        has_cats:     { type: 'boolean', default: false },
        experience_level: {
          type: 'enumeration',
          enum: ['none', 'some', 'experienced'],
          default: 'none',
        },
        motivation: { type: 'text' },
      },
    },
  },

  // ── 7. Tag ────────────────────────────────────────────────────────────────
  {
    name: 'tag',
    schema: {
      kind: 'collectionType',
      collectionName: 'tags',
      info: { singularName: 'tag', pluralName: 'tags', displayName: 'Tag' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        name: { type: 'string', required: true },
        announcements: {
          type: 'relation', relation: 'manyToMany',
          target: 'api::announcement.announcement', mappedBy: 'tags',
        },
      },
    },
  },

  // ── 8. Announcement ───────────────────────────────────────────────────────
  {
    name: 'announcement',
    schema: {
      kind: 'collectionType',
      collectionName: 'announcements',
      info: { singularName: 'announcement', pluralName: 'announcements', displayName: 'Announcement' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        title:       { type: 'string', required: true },
        description: { type: 'text' },
        status: {
          type: 'enumeration',
          enum: ['open', 'closed'],
          default: 'open',
        },
        published_at: { type: 'datetime' },
        animals: {
          type: 'relation', relation: 'manyToMany',
          target: 'api::animal.animal', inversedBy: 'announcements',
        },
        tags: {
          type: 'relation', relation: 'manyToMany',
          target: 'api::tag.tag', inversedBy: 'announcements',
        },
        adoption_requests: {
          type: 'relation', relation: 'oneToMany',
          target: 'api::adoption-request.adoption-request', mappedBy: 'announcement',
        },
      },
    },
  },

  // ── 9. Adoption Request ───────────────────────────────────────────────────
  {
    name: 'adoption-request',
    schema: {
      kind: 'collectionType',
      collectionName: 'adoption_requests',
      info: { singularName: 'adoption-request', pluralName: 'adoption-requests', displayName: 'Adoption Request' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        message:      { type: 'text' },
        status: {
          type: 'enumeration',
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        match_score:  { type: 'integer' },
        request_date: { type: 'date' },
        announcement: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::announcement.announcement', inversedBy: 'adoption_requests',
        },
        adopter: {
          type: 'relation', relation: 'manyToOne',
          target: 'plugin::users-permissions.user',
        },
        referent: {
          type: 'relation', relation: 'manyToOne',
          target: 'plugin::users-permissions.user',
        },
      },
    },
  },

  // ── 10. Volunteer Assignment ──────────────────────────────────────────────
  {
    name: 'volunteer-assignment',
    schema: {
      kind: 'collectionType',
      collectionName: 'volunteer_assignments',
      info: { singularName: 'volunteer-assignment', pluralName: 'volunteer-assignments', displayName: 'Volunteer Assignment' },
      options: { draftAndPublish: false },
      pluginOptions: {},
      attributes: {
        volunteer: {
          type: 'relation', relation: 'manyToOne',
          target: 'plugin::users-permissions.user',
        },
        animal: {
          type: 'relation', relation: 'manyToOne',
          target: 'api::animal.animal', inversedBy: 'volunteer_assignments',
        },
        task_type: {
          type: 'enumeration',
          enum: ['transport', 'vet', 'socialization'],
        },
        assigned_at:  { type: 'date' },
        completed_at: { type: 'date' },
      },
    },
  },
];

// ─── Boilerplate TS ───────────────────────────────────────────────────────────

const boilerplate = (type, uid) => ({
  controller: `/**\n * ${type} controller\n */\n\nimport { factories } from '@strapi/strapi';\n\nexport default factories.createCoreController('${uid}');\n`,
  route:      `/**\n * ${type} router\n */\n\nimport { factories } from '@strapi/strapi';\n\nexport default factories.createCoreRouter('${uid}');\n`,
  service:    `/**\n * ${type} service\n */\n\nimport { factories } from '@strapi/strapi';\n\nexport default factories.createCoreService('${uid}');\n`,
});

// ─── Génération ───────────────────────────────────────────────────────────────

let created = 0;
let skipped = 0;

for (const ct of contentTypes) {
  const { name, schema } = ct;
  const uid = `api::${name}.${name}`;

  const dirs = {
    contentType: path.join(API_DIR, name, 'content-types', name),
    controllers: path.join(API_DIR, name, 'controllers'),
    routes:      path.join(API_DIR, name, 'routes'),
    services:    path.join(API_DIR, name, 'services'),
  };

  // Vérification : ne pas écraser un content type existant
  const schemaPath = path.join(dirs.contentType, 'schema.json');
  if (fs.existsSync(schemaPath)) {
    console.log(`⏭  Skipping "${name}" — déjà existant`);
    skipped++;
    continue;
  }

  // Créer les dossiers
  Object.values(dirs).forEach(d => fs.mkdirSync(d, { recursive: true }));

  // schema.json
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');

  // controller, route, service
  const bp = boilerplate(name, uid);
  fs.writeFileSync(path.join(dirs.controllers, `${name}.ts`), bp.controller);
  fs.writeFileSync(path.join(dirs.routes,      `${name}.ts`), bp.route);
  fs.writeFileSync(path.join(dirs.services,    `${name}.ts`), bp.service);

  console.log(`✅  Créé : ${name}`);
  created++;
}

console.log(`\nTerminé — ${created} créé(s), ${skipped} ignoré(s).`);
console.log('Redémarre Strapi avec : npm run develop');
