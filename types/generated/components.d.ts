import type { Schema, Struct } from '@strapi/strapi';

export interface SharedAnimalMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_animal_media';
  info: {
    displayName: 'Animal Media';
    icon: 'images';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
    is_cover: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
  };
}

export interface SharedMedicalEvent extends Struct.ComponentSchema {
  collectionName: 'components_shared_medical_events';
  info: {
    displayName: 'Medical Event';
    icon: 'health';
  };
  attributes: {
    event_date: Schema.Attribute.Date & Schema.Attribute.Required;
    event_type: Schema.Attribute.Enumeration<
      ['vaccination', 'sterilisation', 'consultation', 'traitement', 'autre']
    > &
      Schema.Attribute.DefaultTo<'consultation'>;
    note: Schema.Attribute.Text;
    veterinarian: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.animal-media': SharedAnimalMedia;
      'shared.medical-event': SharedMedicalEvent;
    }
  }
}
