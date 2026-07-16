import type { Core } from '@strapi/strapi';
import os from 'os';
import path from 'path';
import fse from 'fs-extra';
import mime from 'mime-types';

/**
 * Récupère une photo de chat aléatoire depuis cataas.com (Cat as a Service,
 * API publique dédiée aux photos de chats de test) et l'upload dans la
 * médiathèque Strapi. Renvoie l'id du média créé, ou null si le
 * téléchargement échoue (pas de connexion, API indisponible...) — le seed
 * ne doit pas planter le boot juste parce qu'une photo n'a pas pu être
 * récupérée.
 */
async function uploadCatPhoto(strapi: Core.Strapi, filenameBase: string): Promise<number | null> {
  try {
    const response = await fetch('https://cataas.com/cat');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = mime.extension(contentType) || 'jpg';
    const buffer = Buffer.from(await response.arrayBuffer());

    const tmpDir = await fse.mkdtemp(path.join(os.tmpdir(), 'ddf-seed-'));
    const filename = `${filenameBase}.${ext}`;
    const filepath = path.join(tmpDir, filename);
    try {
      await fse.writeFile(filepath, buffer);
      const [uploaded] = await strapi.plugin('upload').service('upload').upload({
        data: {},
        files: {
          filepath,
          originalFilename: filename,
          mimetype: contentType,
          size: buffer.length,
        },
      });
      return uploaded.id;
    } finally {
      await fse.remove(tmpDir);
    }
  } catch (err) {
    strapi.log.warn(`[seed] Photo indisponible pour ${filenameBase} : ${(err as Error).message}`);
    return null;
  }
}

/**
 * Télécharge `count` photos et les attache à l'animal via le champ `medias`
 * (composant shared.animal-media). La première photo récupérée est marquée
 * comme couverture (is_cover). Passe par le Document Service (et non
 * strapi.db.query, utilisé partout ailleurs dans ce fichier) car c'est la
 * seule couche qui sait créer correctement les lignes de composant et leur
 * relation media — strapi.db.query ne gère pas la création de composants
 * imbriqués.
 */
async function attachCatPhotos(strapi: Core.Strapi, animal: { id: number; documentId: string }, name: string, count = 2) {
  const photoIds: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = await uploadCatPhoto(strapi, `${name.toLowerCase()}-${i + 1}`);
    if (id) photoIds.push(id);
  }
  if (photoIds.length === 0) return;

  await strapi.documents('api::animal.animal').update({
    documentId: animal.documentId,
    data: {
      medias: photoIds.map((id, i) => ({ is_cover: i === 0, image: id })),
    },
  });
}

/**
 * Dev seed only : crée un compte super-admin du panel Strapi (/admin) avec
 * des identifiants jetables, pour pouvoir se connecter immédiatement sur une
 * base fraîchement seedée sans passer par le flow d'invitation. Ne fait rien
 * si un compte existe déjà avec cet email.
 */
async function ensureSuperAdmin(strapi: Core.Strapi) {
  const userService = strapi.service('admin::user');
  const roleService = strapi.service('admin::role');

  if (await userService.exists({ email: 'admin@ddf.fr' })) return;

  const superAdminRole = await roleService.getSuperAdmin();
  if (!superAdminRole) return;

  await userService.create({
    email: 'admin@ddf.fr',
    firstname: 'Admin',
    lastname: 'DDF',
    password: 'admin123',
    isActive: true,
    roles: [superAdminRole.id],
  });

  strapi.log.info('[seed] Compte admin Strapi créé : admin@ddf.fr / admin123');
}

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

  const createUser = (data: object) =>
    strapi.plugin('users-permissions').service('user').add({
      confirmed: true,
      blocked:   false,
      role:      roleId,
      ...data,
    });

  const [marie, jean, sophie, luc, emma] = await Promise.all([
    createUser({ username: 'marie.dupont',   email: 'marie@ddf.fr',   password: 'Password123!' }),
    createUser({ username: 'jean.martin',    email: 'jean@ddf.fr',    password: 'Password123!' }),
    createUser({ username: 'sophie.bernard', email: 'sophie@ddf.fr',  password: 'Password123!' }),
    createUser({ username: 'luc.petit',      email: 'luc@ddf.fr',     password: 'Password123!' }),
    createUser({ username: 'emma.moreau',    email: 'emma@ddf.fr',    password: 'Password123!' }),
    // Dev seed only : compte "Admin" (rôle API, assigné dans configureRolesAndPermissions)
    // avec des identifiants jetables pour tester rapidement les permissions admin côté front.
    createUser({ username: 'admin',          email: 'admin@ddf.fr',  password: 'admin123' }),
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

  // Lien duo : Félix <-> Nala (relation self-référentielle)
  await Promise.all([
    strapi.db.query('api::animal.animal').update({ where: { id: felix.id }, data: { bonded_with: nala.id } }),
    strapi.db.query('api::animal.animal').update({ where: { id: nala.id }, data: { bonded_with: felix.id } }),
  ]);

  // ─── 3bis. Chats supplémentaires ────────────────────────────────────────────

  const breedCycle = [europeen, persan, maineCoon, siamois, bengal];

  const extraCatsData = [
    { name: 'Milo',       age: 1, gender: 'male',    status: 'available', ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: true,  activity_level: 'high',   description: "Milo est un chaton plein d'énergie, toujours partant pour jouer." },
    { name: 'Chaussette', age: 2, gender: 'female',  status: 'available', ok_with_children: true,  ok_with_dogs: false, ok_with_cats: true,  indoor_only: true,  activity_level: 'low',    description: 'Chaussette adore dormir au soleil et se faire câliner des heures.' },
    { name: 'Pompon',     age: 4, gender: 'male',    status: 'available', ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: false, activity_level: 'medium', description: 'Pompon est un colosse doux comme un agneau, parfait avec les enfants.' },
    { name: 'Cannelle',   age: 3, gender: 'female',  status: 'in_foster', ok_with_children: false, ok_with_dogs: false, ok_with_cats: true,  indoor_only: true,  activity_level: 'medium', description: "Cannelle apprend à faire confiance dans sa famille d'accueil." },
    { name: 'Biscotte',   age: 5, gender: 'female',  status: 'available', ok_with_children: true,  ok_with_dogs: false, ok_with_cats: false, indoor_only: true,  activity_level: 'high',   description: "Biscotte a besoin d'un foyer sans autre chat, elle aime être reine du logis." },
    { name: 'Praline',    age: 1, gender: 'female',  status: 'available', ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: true,  activity_level: 'medium', description: 'Praline est une petite chatte curieuse qui explore tout.' },
    { name: 'Ninja',      age: 2, gender: 'male',    status: 'reserved',  ok_with_children: true,  ok_with_dogs: false, ok_with_cats: true,  indoor_only: true,  activity_level: 'low',    description: 'Ninja se faufile partout, digne de son nom. Adoption en cours.' },
    { name: 'Salem',      age: 7, gender: 'male',    status: 'available', ok_with_children: false, ok_with_dogs: false, ok_with_cats: false, indoor_only: true,  activity_level: 'low',    description: 'Salem est un vieux sage qui préfère la tranquillité.' },
    { name: 'Choupette',  age: 3, gender: 'female',  status: 'in_foster', ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: true,  activity_level: 'medium', description: "Choupette s'entend avec tout le monde, un vrai amour." },
    { name: 'Grisou',     age: 6, gender: 'male',    status: 'available', ok_with_children: false, ok_with_dogs: false, ok_with_cats: true,  indoor_only: true,  activity_level: 'high',   description: "Grisou est très actif, il lui faut de l'espace pour se dépenser." },
    { name: 'Caramel',    age: 2, gender: 'male',    status: 'adopted',   ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: false, activity_level: 'medium', description: 'Caramel a rejoint sa famille pour toujours, une belle réussite.' },
    { name: 'Pixel',      age: 1, gender: 'unknown', status: 'available', ok_with_children: true,  ok_with_dogs: false, ok_with_cats: true,  indoor_only: true,  activity_level: 'medium', description: "Pixel a été trouvé errant, on ne connaît pas encore tout son caractère." },
    { name: 'Loki',       age: 4, gender: 'male',    status: 'available', ok_with_children: true,  ok_with_dogs: false, ok_with_cats: true,  indoor_only: false, activity_level: 'high',   description: 'Loki adore faire des bêtises mais reste très affectueux.' },
    { name: 'Misty',      age: 5, gender: 'female',  status: 'in_foster', ok_with_children: true,  ok_with_dogs: false, ok_with_cats: true,  indoor_only: true,  activity_level: 'low',    description: "Misty se remet doucement d'une opération, calme requis." },
    { name: 'Cléo',       age: 3, gender: 'female',  status: 'reserved',  ok_with_children: false, ok_with_dogs: false, ok_with_cats: false, indoor_only: true,  activity_level: 'high',   description: 'Cléo attend sa nouvelle famille, dossier en cours de validation.' },
    { name: 'Winston',    age: 8, gender: 'male',    status: 'adopted',   ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: false, activity_level: 'low',    description: 'Winston coule des jours heureux dans son nouveau foyer.' },
    { name: 'Olive',      age: 2, gender: 'female',  status: 'available', ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: true,  activity_level: 'medium', description: "Olive est douce et sociable, elle s'entend avec tout le monde." },
    { name: 'Simba',      age: 3, gender: 'male',    status: 'available', ok_with_children: true,  ok_with_dogs: true,  ok_with_cats: true,  indoor_only: false, activity_level: 'medium', description: 'Simba est un grand costaud très câlin malgré son air impressionnant.' },
  ];

  const extraCats = await Promise.all(
    extraCatsData.map((cat, i) =>
      strapi.db.query('api::animal.animal').create({
        data: { ...cat, breed: breedCycle[i % breedCycle.length].id },
      }),
    ),
  );

  strapi.log.info(`[seed] ${extraCats.length} chats supplémentaires créés.`);

  // ─── 3ter. Photos des chats ─────────────────────────────────────────────────
  // Récupérées depuis une API publique de photos de chats (cataas.com) au
  // premier démarrage sur base vide — nécessite un accès réseau sortant ;
  // en son absence, chaque échec est loggé et l'animal reste sans photo.

  const allAnimals = [mimi, oscar, luna, felix, nala, tigrou, bella, ...extraCats];
  await Promise.all(allAnimals.map((animal) => attachCatPhotos(strapi, animal, animal.name)));

  strapi.log.info('[seed] Photos attachées aux chats.');

  // ─── 4. Foster Family ───────────────────────────────────────────────────────

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

  // ─── 5. Foster Assignments ─────────────────────────────────────────────────

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

  // ─── 6. Evaluations ────────────────────────────────────────────────────────

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

  // ─── 7. Adopter Profiles ───────────────────────────────────────────────────

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

  // ─── 8. Tags ───────────────────────────────────────────────────────────────

  const [tagSociable, tagTimide, tagDuo, tagUrgent, tagChaton] = await Promise.all([
    strapi.db.query('api::tag.tag').create({ data: { name: 'sociable' } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'timide'   } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'duo'      } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'urgent'   } }),
    strapi.db.query('api::tag.tag').create({ data: { name: 'chaton'   } }),
  ]);

  // ─── 9. Announcements ──────────────────────────────────────────────────────

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

  // ─── 10. Adoption Requests ─────────────────────────────────────────────────

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

  // ─── 11. Volunteer Assignments ─────────────────────────────────────────────

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

  // ─── 12. Compte admin Strapi ───────────────────────────────────────────────

  await ensureSuperAdmin(strapi);

  strapi.log.info('[seed] ✅ Seed terminé avec succès.');
}
