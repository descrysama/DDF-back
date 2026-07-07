import type { Core } from '@strapi/strapi';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Seed de démonstration pour DDF (Défense Des Félins)
 * Appelé depuis bootstrap() dans src/index.ts
 * Ne s'exécute que si la base est vide (vérifié via les breeds)
 */
export async function seed(strapi: Core.Strapi) {
  const existingBreed = await strapi.db.query('api::breed.breed').findOne({});
  if (existingBreed) return; // Déjà seedé

  strapi.log.info('[seed] Démarrage du seed...');

  // ─── 1. Breeds ─────────────────────────────────────────────────────────────

  const [europeen, persan, maineCoon, siamois, bengal] = await Promise.all([
    strapi.db.query('api::breed.breed').create({ data: { name: 'Européen',  species: 'chat' } }),
    strapi.db.query('api::breed.breed').create({ data: { name: 'Persan',    species: 'chat' } }),
    strapi.db.query('api::breed.breed').create({ data: { name: 'Maine Coon', species: 'chat' } }),
    strapi.db.query('api::breed.breed').create({ data: { name: 'Siamois',   species: 'chat' } }),
    strapi.db.query('api::breed.breed').create({ data: { name: 'Bengal',    species: 'chat' } }),
  ]);

  // ─── 2. Users (via users-permissions) ─────────────────────────────────────

  const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
  });
  const roleId = defaultRole?.id ?? 1;

  let adminRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { name: 'Admin' },
  });
  if (!adminRole) {
    adminRole = await strapi.db.query('plugin::users-permissions.role').create({
      data: {
        name: 'Admin',
        description: 'Administrateur applicatif DDF (accès /admin côté front)',
        type: 'authenticated',
      },
    });
    strapi.log.info('[seed] Rôle "admin" créé');
  }
  const adminRoleId = adminRole.id;

  // Permissions pour le rôle admin : CRUD sur tous les content types + auth de base
  const adminContentTypes = [
    'api::animal.animal',
    'api::announcement.announcement',
    'api::adoption-request.adoption-request',
    'api::foster-family.foster-family',
    'api::foster-assignment.foster-assignment',
    'api::breed.breed',
    'api::tag.tag',
    'api::evaluation.evaluation',
    'api::volunteer-assignment.volunteer-assignment',
    'api::adopter-profile.adopter-profile',
  ];
  const crudActions = ['find', 'findOne', 'create', 'update', 'delete'];

  const adminPermissions = [
    ...adminContentTypes.flatMap((ct) =>
      crudActions.map((action) => `${ct}.${action}`)
    ),
    'plugin::users-permissions.auth.logout',
    'plugin::users-permissions.auth.changePassword',
    'plugin::users-permissions.user.me',
    'plugin::users-permissions.user.find',
    'plugin::users-permissions.user.findOne',
  ];

  const existingAdminPerms = await strapi.db.query('plugin::users-permissions.permission').findMany({
    where: { role: adminRoleId },
  });

  if (existingAdminPerms.length === 0) {
    await Promise.all(
      adminPermissions.map((action) =>
        strapi.db.query('plugin::users-permissions.permission').create({
          data: { action, role: adminRoleId },
        })
      )
    );
    strapi.log.info(`[seed] ${adminPermissions.length} permissions ajoutées au rôle admin`);
  }

  const createUser = (data: object) =>
    strapi.plugin('users-permissions').service('user').add({
      confirmed: true,
      blocked:   false,
      role:      roleId,
      ...data,
    });

  await createUser({
    username: 'admin',
    email:    'admin@ddf.fr',
    password: 'Admin123!',
    role:     adminRoleId,
  });

  const [marie, jean, sophie, luc, emma] = await Promise.all([
    createUser({ username: 'marie.dupont',   email: 'marie@ddf.fr',   password: 'Password123!' }),
    createUser({ username: 'jean.martin',    email: 'jean@ddf.fr',    password: 'Password123!' }),
    createUser({ username: 'sophie.bernard', email: 'sophie@ddf.fr',  password: 'Password123!' }),
    createUser({ username: 'luc.petit',      email: 'luc@ddf.fr',     password: 'Password123!' }),
    createUser({ username: 'emma.moreau',    email: 'emma@ddf.fr',    password: 'Password123!' }),
  ]);

  // ─── 3. Animals ─────────────────────────────────────────────────────────────

  const [mimi, oscar, luna, felix, nala, tigrou, bella] = await Promise.all([
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Mimi', age: 3, gender: 'female',
        description: 'Mimi est une petite chatte câline qui adore les câlins. Parfaite pour une famille.',
        status: 'available', breed: europeen.id,
        ok_with_children: true, ok_with_dogs: false, ok_with_cats: true,
        indoor_only: true, activity_level: 'low',
      },
    }),
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Oscar', age: 5, gender: 'male',
        description: 'Oscar est un grand Maine Coon tranquille, idéal pour un foyer calme.',
        status: 'available', breed: maineCoon.id,
        ok_with_children: true, ok_with_dogs: false, ok_with_cats: true,
        indoor_only: true, activity_level: 'low',
      },
    }),
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Luna', age: 2, gender: 'female',
        description: 'Luna est en famille d\'accueil, elle s\'épanouit doucement. Un peu réservée au début.',
        status: 'in_foster', breed: persan.id,
        ok_with_children: false, ok_with_dogs: false, ok_with_cats: true,
        indoor_only: true, activity_level: 'low',
        diet_notes: 'Croquettes sans céréales uniquement.',
      },
    }),
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Félix', age: 4, gender: 'male',
        description: 'Félix et Nala sont inséparables depuis leur arrivée. Ils ne peuvent être adoptés qu\'ensemble.',
        status: 'in_foster', breed: siamois.id,
        ok_with_children: true, ok_with_dogs: false, ok_with_cats: true,
        indoor_only: true, activity_level: 'medium',
      },
    }),
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Nala', age: 4, gender: 'female',
        description: 'Nala est la compagne de Félix. Ensemble, ils forment un duo complice et joueur.',
        status: 'in_foster', breed: siamois.id,
        ok_with_children: true, ok_with_dogs: false, ok_with_cats: true,
        indoor_only: true, activity_level: 'medium',
      },
    }),
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Tigrou', age: 6, gender: 'male',
        description: 'Tigrou est un Bengal timide qui a besoin de temps et de patience. Récompense garantie.',
        status: 'reserved', breed: bengal.id,
        ok_with_children: false, ok_with_dogs: false, ok_with_cats: false,
        indoor_only: true, activity_level: 'high',
      },
    }),
    strapi.db.query('api::animal.animal').create({
      data: {
        name: 'Bella', age: 8, gender: 'female',
        description: 'Bella a trouvé son foyer définitif. Une belle histoire d\'adoption réussie.',
        status: 'adopted', breed: europeen.id,
        ok_with_children: true, ok_with_dogs: true, ok_with_cats: true,
        indoor_only: false, activity_level: 'low',
      },
    }),
  ]);

  // ─── 4. Images ─────────────────────────────────────────────────────────────

  strapi.log.info('[seed] Téléchargement des images...');
  await uploadAnimalImages(strapi, { mimi, oscar, luna, felix, nala, tigrou, bella });

  // Lien duo : Félix <-> Nala (relation self-référentielle)
  await Promise.all([
    strapi.db.query('api::animal.animal').update({ where: { id: felix.id }, data: { bonded_with: nala.id } }),
    strapi.db.query('api::animal.animal').update({ where: { id: nala.id }, data: { bonded_with: felix.id } }),
  ]);

  // ─── 5. Foster Family ───────────────────────────────────────────────────────

  const sophieFosterFamily = await strapi.db.query('api::foster-family.foster-family').create({
    data: {
      user:         sophie.id,
      address:      '12 rue des Lilas, 69001 Lyon',
      has_children: false,
      has_dogs:     false,
      has_cats:     false,
      max_capacity: 3,
    },
  });

  // ─── 6. Foster Assignments ─────────────────────────────────────────────────

  const today = new Date();
  const oneMonthAgo = new Date(today); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const threeWeeksAgo = new Date(today); threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

  const [assignmentLuna, assignmentFelix, assignmentNala] = await Promise.all([
    strapi.db.query('api::foster-assignment.foster-assignment').create({
      data: {
        animal:        luna.id,
        foster_family: sophieFosterFamily.id,
        start_date:    oneMonthAgo.toISOString().split('T')[0],
        status:        'active',
      },
    }),
    strapi.db.query('api::foster-assignment.foster-assignment').create({
      data: {
        animal:        felix.id,
        foster_family: sophieFosterFamily.id,
        start_date:    threeWeeksAgo.toISOString().split('T')[0],
        status:        'active',
      },
    }),
    strapi.db.query('api::foster-assignment.foster-assignment').create({
      data: {
        animal:        nala.id,
        foster_family: sophieFosterFamily.id,
        start_date:    threeWeeksAgo.toISOString().split('T')[0],
        status:        'active',
      },
    }),
  ]);

  // ─── 7. Evaluations ────────────────────────────────────────────────────────

  const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  await Promise.all([
    strapi.db.query('api::evaluation.evaluation').create({
      data: {
        animal:           luna.id,
        foster_family:    sophieFosterFamily.id,
        author:           marie.id,
        energy_level:     'low',
        ok_with_children: false,
        ok_with_dogs:     false,
        ok_with_cats:     true,
        behaviour_notes:  'Luna est très douce mais prend du temps pour s\'approcher. Elle commence à venir d\'elle-même pour les câlins.',
        diet_notes:       'Mange bien ses croquettes sans céréales. Bon appétit.',
        evaluated_at:     twoWeeksAgo.toISOString().split('T')[0],
      },
    }),
    strapi.db.query('api::evaluation.evaluation').create({
      data: {
        animal:           felix.id,
        foster_family:    sophieFosterFamily.id,
        author:           marie.id,
        energy_level:     'medium',
        ok_with_children: true,
        ok_with_dogs:     false,
        ok_with_cats:     true,
        behaviour_notes:  'Félix est joueur et sociable. Il cherche constamment Nala. Inséparables.',
        diet_notes:       'Bon appétit, mange avec Nala sans problème.',
        evaluated_at:     twoWeeksAgo.toISOString().split('T')[0],
      },
    }),
  ]);

  // ─── 8. Adopter Profiles ───────────────────────────────────────────────────

  await Promise.all([
    strapi.db.query('api::adopter-profile.adopter-profile').create({
      data: {
        user:             luc.id,
        housing_type:     'apartment',
        has_garden:       false,
        has_children:     false,
        has_dogs:         false,
        has_cats:         true,
        experience_level: 'some',
        motivation:       'J\'ai toujours eu des chats et je cherche une compagne pour mon chat actuel. Je suis à la maison en télétravail, donc l\'animal ne sera jamais seul.',
      },
    }),
    strapi.db.query('api::adopter-profile.adopter-profile').create({
      data: {
        user:             emma.id,
        housing_type:     'house',
        has_garden:       true,
        has_children:     true,
        has_dogs:         false,
        has_cats:         false,
        experience_level: 'some',
        motivation:       'Ma famille souhaite accueillir un duo de chats. Nous avons une maison avec jardin sécurisé et beaucoup d\'amour à donner.',
      },
    }),
  ]);

  // ─── 9. Tags ───────────────────────────────────────────────────────────────

  const [tagSociable, tagTimide, tagDuo, tagUrgent, tagChaton] = await Promise.all([
    strapi.db.query('api::tag.tag').create({ data: { name: 'sociable' } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'timide'   } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'duo'      } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'urgent'   } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'chaton'   } }),
  ]);

  // ─── 10. Announcements ──────────────────────────────────────────────────────

  const [announceMimi, announceDuo, announceTigrou] = await Promise.all([
    strapi.db.query('api::announcement.announcement').create({
      data: {
        title:       'Mimi cherche un foyer aimant',
        description: 'Mimi est une petite chatte européenne de 3 ans, câline et douce. Elle s\'entend bien avec les autres chats et les enfants. Idéale pour une famille ou un foyer en télétravail.',
        status:      'open',
        animals:     [mimi.id],
        tags:        [tagSociable.id],
      },
    }),
    strapi.db.query('api::announcement.announcement').create({
      data: {
        title:       'Duo inséparable : Félix & Nala',
        description: 'Félix et Nala sont deux siamois de 4 ans qui ne peuvent vivre l\'un sans l\'autre. Ils cherchent un foyer prêt à les accueillir ensemble. Adoption urgente, leur famille d\'accueil déménage.',
        status:      'open',
        animals:     [felix.id, nala.id],
        tags:        [tagDuo.id, tagUrgent.id],
      },
    }),
    strapi.db.query('api::announcement.announcement').create({
      data: {
        title:       'Tigrou, un grand timide qui n\'attend que vous',
        description: 'Tigrou est un Bengal de 6 ans au caractère sauvage. Il a besoin d\'un adoptant patient et expérimenté, sans autres animaux ni enfants en bas âge. L\'effort en vaut la peine !',
        status:      'open',
        animals:     [tigrou.id],
        tags:        [tagTimide.id],
      },
    }),
  ]);

  // ─── 11. Adoption Requests ─────────────────────────────────────────────────

  await Promise.all([
    strapi.db.query('api::adoption-request.adoption-request').create({
      data: {
        announcement: announceMimi.id,
        adopter:      luc.id,
        referent:     marie.id,
        message:      'Je suis en télétravail toute la semaine, Mimi ne serait jamais seule. J\'ai déjà un chat mâle castré de 4 ans très sociable.',
        status:       'pending',
        match_score:  82,
        request_date: today.toISOString().split('T')[0],
      },
    }),
    strapi.db.query('api::adoption-request.adoption-request').create({
      data: {
        announcement: announceDuo.id,
        adopter:      emma.id,
        referent:     marie.id,
        message:      'Nous avons une grande maison avec jardin sécurisé. Nos enfants ont 8 et 11 ans et adorent les animaux. Nous sommes prêts à accueillir le duo.',
        status:       'pending',
        match_score:  91,
        request_date: today.toISOString().split('T')[0],
      },
    }),
  ]);

  // ─── 12. Volunteer Assignments ─────────────────────────────────────────────

  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  await Promise.all([
    strapi.db.query('api::volunteer-assignment.volunteer-assignment').create({
      data: {
        volunteer:   jean.id,
        animal:      mimi.id,
        task_type:   'transport',
        assigned_at: yesterday.toISOString().split('T')[0],
      },
    }),
    strapi.db.query('api::volunteer-assignment.volunteer-assignment').create({
      data: {
        volunteer:   jean.id,
        animal:      tigrou.id,
        task_type:   'vet',
        assigned_at: today.toISOString().split('T')[0],
      },
    }),
  ]);

  strapi.log.info('[seed] Seed terminé avec succès.');
}

// ─── Helpers images ──────────────────────────────────────────────────────────

// fetch natif (Node 20+) gère les redirects et les URLs protocol-relative automatiquement
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

async function uploadImage(
  strapi: Core.Strapi,
  url: string,
  name: string,
  altText: string,
): Promise<{ id: number; documentId: string } | null> {
  const tmpPath = path.join(os.tmpdir(), `${name}.jpg`);
  try {
    await downloadFile(url, tmpPath);
    const stats = fs.statSync(tmpPath);
    const [file] = await strapi.plugin('upload').service('upload').upload({
      data: { fileInfo: { name: `${name}.jpg`, alternativeText: altText, caption: altText } },
      files: { filepath: tmpPath, originalFilename: `${name}.jpg`, mimetype: 'image/jpeg', size: stats.size },
    });
    return file;
  } catch (err) {
    strapi.log.warn(`[seed] Impossible de télécharger l'image ${name}: ${err}`);
    return null;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

type AnimalEntry = { id: number; documentId: string };
type FileEntry   = { id: number; documentId: string } | null;

// Loremflickr : images libres de droits, reproductibles via le paramètre lock
async function uploadAnimalImages(
  strapi: Core.Strapi,
  animals: Record<string, AnimalEntry>,
) {
  const base = 'https://loremflickr.com/800/600';

  const [
    mimiCover,    mimiExtra,
    oscarCover,   oscarExtra,
    lunaCover,    lunaExtra,
    felixCover,   felixExtra,
    nalaCover,    nalaExtra,
    tigrouCover,  tigrouExtra,
    bellaCover,   bellaExtra,
  ] = await Promise.all([
    uploadImage(strapi, `${base}/cat?lock=11`,         'mimi-cover',   'Mimi'),
    uploadImage(strapi, `${base}/cat?lock=12`,         'mimi-2',       'Mimi'),
    uploadImage(strapi, `${base}/maine-coon?lock=21`,  'oscar-cover',  'Oscar'),
    uploadImage(strapi, `${base}/maine-coon?lock=22`,  'oscar-2',      'Oscar'),
    uploadImage(strapi, `${base}/persian-cat?lock=31`, 'luna-cover',   'Luna'),
    uploadImage(strapi, `${base}/persian-cat?lock=32`, 'luna-2',       'Luna'),
    uploadImage(strapi, `${base}/siamese-cat?lock=41`, 'felix-cover',  'Félix'),
    uploadImage(strapi, `${base}/siamese-cat?lock=42`, 'felix-2',      'Félix'),
    uploadImage(strapi, `${base}/siamese-cat?lock=51`, 'nala-cover',   'Nala'),
    uploadImage(strapi, `${base}/siamese-cat?lock=52`, 'nala-2',       'Nala'),
    uploadImage(strapi, `${base}/bengal-cat?lock=61`,  'tigrou-cover', 'Tigrou'),
    uploadImage(strapi, `${base}/bengal-cat?lock=62`,  'tigrou-2',     'Tigrou'),
    uploadImage(strapi, `${base}/cat?lock=71`,         'bella-cover',  'Bella'),
    uploadImage(strapi, `${base}/cat?lock=72`,         'bella-2',      'Bella'),
  ]);

  const toMedias = (cover: FileEntry, extra: FileEntry) =>
    [
      cover ? { image: cover.id, is_cover: true }  : null,
      extra ? { image: extra.id, is_cover: false } : null,
    ].filter(Boolean);

  const imageMap: Record<string, ReturnType<typeof toMedias>> = {
    mimi:   toMedias(mimiCover,   mimiExtra),
    oscar:  toMedias(oscarCover,  oscarExtra),
    luna:   toMedias(lunaCover,   lunaExtra),
    felix:  toMedias(felixCover,  felixExtra),
    nala:   toMedias(nalaCover,   nalaExtra),
    tigrou: toMedias(tigrouCover, tigrouExtra),
    bella:  toMedias(bellaCover,  bellaExtra),
  };

  // Le Document Service gère la création inline de composants avec leurs relations media
  await Promise.all(
    Object.entries(animals).map(([name, animal]) => {
      const medias = imageMap[name];
      if (!medias?.length) return Promise.resolve();
      return (strapi.documents as any)('api::animal.animal').update({
        documentId: animal.documentId,
        data: { medias },
      });
    }),
  );
}
