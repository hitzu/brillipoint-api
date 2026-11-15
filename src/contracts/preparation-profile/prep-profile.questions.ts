export type PrepProfileQuestionGroup =
  | 'celebracion'
  | 'concepto'
  | 'vestido'
  | 'accesorios'
  | 'maquillaje'
  | 'peinado'
  | 'tatuajes';

export type PrepProfileQuestionType =
  | 'string'
  | 'textarea'
  | 'radio'
  | 'date'
  | 'time'
  | 'boolean'
  | 'object'
  | 'asset'
  | 'asset_array';

export type PrepProfileRadioOption = {
  value: string;
  label: string;
};

export interface PrepAssetMetadata {
  assetId?: number;
  path: string;
  mime: string;
}

export interface PrepProfileQuestionDefinition {
  id: string;
  type: PrepProfileQuestionType;
  label?: string;
  placeholder?: string;
  group?: PrepProfileQuestionGroup;
  options?: PrepProfileRadioOption[];
}

export const SOCIAL_PREFIX = (n: number) => `social-n-${n}-`;

export const stripSocialPrefix = (questionId: string): string => {
  return questionId.replace(/^social-n-\d+-/, '');
};

export const getSocialIndex = (questionId: string): number | null => {
  const m = questionId.match(/^social-n-(\d+)-/);
  if (!m?.[1]) {
    return null;
  }
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

const BRIDE_QUESTIONS: PrepProfileQuestionDefinition[] = [
  // CELEBRACIÓN
  {
    id: 'event_start_time',
    type: 'time',
    group: 'celebracion',
    label: '¿Hora de inicio del evento?',
    placeholder: 'Ej: 17:00',
  },
  {
    id: 'event_end_time',
    type: 'time',
    group: 'celebracion',
    label: '¿Hora de fin del evento?',
    placeholder: 'Ej: 23:00',
  },
  {
    id: 'venue_type',
    type: 'radio',
    group: 'celebracion',
    label: 'Tipo de venue',
    options: [
      { value: 'salon_jardin', label: 'Salón jardín' },
      { value: 'salon_eventos', label: 'Salón de eventos' },
      { value: 'hotel', label: 'Hotel' },
      { value: 'casa', label: 'Casa' },
      { value: 'otro', label: 'Otro' },
    ],
  },
  {
    id: 'event_daypart',
    type: 'radio',
    group: 'celebracion',
    label: '¿En qué momento del día es tu evento?',
    options: [
      { value: 'dia', label: 'Día' },
      { value: 'tarde', label: 'Tarde' },
      { value: 'noche', label: 'Noche' },
    ],
  },
  {
    id: 'event_setting',
    type: 'radio',
    group: 'celebracion',
    label: '¿El venue es interior o al aire libre?',
    options: [
      { value: 'interior', label: 'Interior' },
      { value: 'aire_libre', label: 'Aire libre' },
      { value: 'mixto', label: 'Mixto' },
    ],
  },
  {
    id: 'prep_at_salon',
    type: 'radio',
    group: 'celebracion',
    label:
      '¿Dónde te gustaría realizar tu maquillaje y peinado el día de tu boda?',
    options: [
      { value: 'sucursal', label: 'En nuestra sucursal (opción recomendada)' },
      {
        value: 'otra_ubicacion',
        label: 'En otra ubicación (hotel / domicilio / venue)',
      },
    ],
  },
  {
    id: 'prep_location_maps_url',
    type: 'string',
    group: 'celebracion',
    label: 'Ubicación exacta donde te arreglarás (link de Google Maps)',
    placeholder:
      'Pega aquí el enlace de Google Maps.\n\nNota: El servicio fuera de la sucursal puede generar un costo adicional por traslado y logística, el cual se cotiza según la ubicación.',
  },

  // CONCEPTO
  {
    id: 'wedding_concept_style',
    type: 'radio',
    group: 'concepto',
    label: '¿Qué estilo o concepto quieres proyectar como guía ese día?',
    options: [
      { value: 'romantico', label: 'Romántico' },
      { value: 'elegante', label: 'Elegante' },
      { value: 'natural', label: 'Natural' },
      { value: 'sensual', label: 'Sensual' },
      { value: 'atrevida', label: 'Atrevida' },
      { value: 'no_definido', label: 'No definido' },
      { value: 'sexy', label: 'Sexy' },
      { value: 'romantica', label: 'Romántica' },
      { value: 'glam', label: 'Glam' },
      { value: 'boho', label: 'Boho' },
      { value: 'minimal', label: 'Minimalista' },
      { value: 'otro', label: 'Otro' },
    ],
  },
  {
    id: 'wedding_palette_preferred',
    type: 'string',
    group: 'concepto',
    label: 'Paleta de colores (colores de preferencia)',
    placeholder: 'Ej: nude, blanco, dorado, pasteles',
  },
  {
    id: 'wedding_palette_vetoed',
    type: 'string',
    group: 'concepto',
    label: 'Paleta de colores (colores vetados)',
    placeholder: 'Ej: rojo, morado, neón',
  },
  {
    id: 'ready_by_time',
    type: 'time',
    group: 'concepto',
    label: '¿A qué hora necesitas estar lista?',
    placeholder: 'Ej: 14:00',
  },
  {
    id: 'desired_feeling',
    type: 'radio',
    group: 'concepto',
    label: '¿Cómo te gustaría sentirte ese día?',
    options: [
      { value: 'natural', label: 'Natural' },
      { value: 'elegante', label: 'Elegante' },
      { value: 'glam', label: 'Glam' },
      { value: 'romantica', label: 'Romántica' },
    ],
  },

  // VESTIDO
  {
    id: 'dress',
    type: 'object',
    group: 'vestido',
    label: 'Vestido',
    placeholder: 'Indica si ya tienes vestido y sube una foto (si aplica)',
  },

  // ACCESORIOS
  {
    id: 'accessories',
    type: 'object',
    group: 'accesorios',
    label: 'Accesorios',
    placeholder:
      'Marca lo que ya tienes y sube una foto por cada accesorio (evita multicarga).',
  },

  // MAQUILLAJE
  {
    id: 'makeup_intensity',
    type: 'radio',
    group: 'maquillaje',
    label: '¿Qué tan intenso te gustaría tu maquillaje?',
    options: [
      { value: 'natural', label: 'Natural / suave' },
      { value: 'medio', label: 'Medio' },
      { value: 'intenso', label: 'Intenso' },
    ],
  },
  {
    id: 'highlight_focus',
    type: 'textarea',
    group: 'maquillaje',
    label: '¿Qué te gustaría resaltar u ocultar?',
    placeholder:
      'Ej: resaltar ojos / ocultar ojeras / piel más luminosa / etc.',
  },
  {
    id: 'dislikes_makeup',
    type: 'textarea',
    group: 'maquillaje',
    label: 'Cosas que NO te gustan en maquillaje',
    placeholder: 'Ej: base pesada, glitter, cejas muy marcadas',
  },
  {
    id: 'skincare_routine',
    type: 'textarea',
    group: 'maquillaje',
    label: '¿Sigues alguna rutina de skincare?',
    placeholder:
      'Cuéntanos brevemente cuáles son los productos que utilizas y cómo sueles aplicarlos.',
  },
  {
    id: 'face_photos',
    type: 'asset_array',
    group: 'maquillaje',
    label: 'Fotos de tu carita (2 fotos)',
    placeholder:
      'Sube 2 fotos con buena luz, sin filtros: una de frente y una de perfil.',
  },
  {
    id: 'makeup_references',
    type: 'asset_array',
    group: 'maquillaje',
    label: 'Referencia de maquillaje (2 fotos)',
    placeholder:
      'Sube 2 fotos de referencia de maquillaje (evita multicarga en un solo campo).',
  },
  {
    id: 'makeup_idea',
    type: 'textarea',
    group: 'maquillaje',
    label: 'Idea general de maquillaje',
    placeholder: 'Describe tu idea o lo que te inspira',
  },

  // PEINADO
  {
    id: 'dislikes_hair',
    type: 'textarea',
    group: 'peinado',
    label: 'Cosas que NO te gustan en peinado',
    placeholder: 'Ej: muy tirante, mucho volumen, ondas muy marcadas',
  },
  {
    id: 'hair_photos',
    type: 'asset_array',
    group: 'peinado',
    label: 'Fotos de tu cabello (2 fotos)',
    placeholder: 'Sube 2 fotos: por ejemplo frontal y perfil (sin filtros).',
  },
  {
    id: 'hair_references',
    type: 'asset_array',
    group: 'peinado',
    label: 'Referencia de peinado (2 fotos)',
    placeholder:
      'Sube 2 fotos de referencia de peinado (evita multicarga en un solo campo).',
  },
  {
    id: 'hair_idea',
    type: 'textarea',
    group: 'peinado',
    label: 'Idea general de peinado',
    placeholder: 'Describe tu idea o lo que te inspira',
  },
];

// Glitter bar: the client uploads up to 5 tattoo designs. Managed by the
// dedicated tattoo-designs flow (see tattoo-designs.policy.ts), never by the
// generic answer endpoints, and never part of the Make up completion check.
const TATTOO_QUESTIONS: PrepProfileQuestionDefinition[] = [
  {
    id: 'tattoo_designs',
    type: 'asset_array',
    group: 'tatuajes',
    label: 'Diseños de tatuajes (hasta 5)',
    placeholder: 'Sube hasta 5 imágenes con los diseños que quieres.',
  },
];

const buildSocialQuestions = (n: number): PrepProfileQuestionDefinition[] => {
  const p = SOCIAL_PREFIX(n);
  return [
    {
      id: `${p}ready_by_time`,
      type: 'time',
      group: 'celebracion',
      label: '¿A qué hora necesitas estar lista? (social)',
      placeholder: 'Ej: 14:00',
    },
    {
      id: `${p}gift_face_photo`,
      type: 'asset',
      group: 'maquillaje',
      label: 'Foto de rostro (social de regalo)',
      placeholder: 'Sube una foto con buena luz (sin filtros).',
    },
    {
      id: `${p}gift_makeup_references`,
      type: 'asset_array',
      group: 'maquillaje',
      label: 'Referencias de maquillaje (social de regalo) (2 fotos)',
      placeholder: 'Sube 2 fotos de referencia de maquillaje.',
    },
    {
      id: `${p}makeup_note`,
      type: 'textarea',
      group: 'maquillaje',
      label: 'Nota para maquillista',
      placeholder:
        'Indica qué te gustaría resaltar u ocultar y si hay algo con lo que debamos tener especial cuidado.',
    },
    {
      id: `${p}gift_hair_photo`,
      type: 'asset_array',
      group: 'peinado',
      label: 'Fotos de cabello (social de regalo) (2 fotos)',
      placeholder: 'Sube 2 fotos: espalda y perfil.',
    },
    {
      id: `${p}gift_hair_references`,
      type: 'asset_array',
      group: 'peinado',
      label: 'Referencias de peinado (social de regalo) (2 fotos)',
      placeholder: 'Sube 2 fotos de referencia de peinado.',
    },
    {
      id: `${p}hair_note`,
      type: 'textarea',
      group: 'peinado',
      label: 'Nota para peinadora',
      placeholder:
        'Indica qué te gustaría resaltar u ocultar y si hay algo con lo que debamos tener especial cuidado.',
    },
  ];
};

export const PREP_PROFILE_QUESTIONS: ReadonlyArray<PrepProfileQuestionDefinition> =
  [
    ...BRIDE_QUESTIONS,
    ...TATTOO_QUESTIONS,
    // Workaround: hoy solo existe social #1 (futuro: agregar buildSocialQuestions(2), etc.)
    ...buildSocialQuestions(1),
  ] as const satisfies ReadonlyArray<PrepProfileQuestionDefinition>;

export type PrepProfileQuestionId = (typeof PREP_PROFILE_QUESTIONS)[number]['id'];

export const PREP_PROFILE_QUESTION_BY_ID: Record<
  PrepProfileQuestionId,
  PrepProfileQuestionDefinition
> = PREP_PROFILE_QUESTIONS.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<PrepProfileQuestionId, PrepProfileQuestionDefinition>,
);

export const PREP_PROFILE_QUESTION_IDS = new Set<string>(
  PREP_PROFILE_QUESTIONS.map((q) => q.id),
);

/** Omitidas del chequeo de perfil completo (no se envían desde el formulario público actual). */
export const PREP_PROFILE_QUESTION_IDS_OPTIONAL_FOR_COMPLETION = new Set<string>([
  'event_setting',
  'desired_feeling',
  'tattoo_designs',
]);

export function isPrepAssetMetadata(value: unknown): value is PrepAssetMetadata {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.path !== 'string' || record.path.trim().length === 0) {
    return false;
  }
  if (typeof record.mime !== 'string' || record.mime.trim().length === 0) {
    return false;
  }
  if (record.assetId != null && typeof record.assetId !== 'number') {
    return false;
  }

  return true;
}
