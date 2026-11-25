import type {
  ActiveStatus,
  Character,
  CharacterCondition,
  CharacterWeapon,
  CollateralDamageConfig,
  CombatStatusKey,
  Combatant,
  D6RollSummary,
  DamageDie,
  DamageKind,
  DamageRollSummary,
  DieType,
  DispelTargetScope,
  EffectSubType,
  ElementalStatusKind,
  FormulaConfig,
  MagePhysicalVariant,
  MusicianInstrumentId,
  OrderCategory,
  RollBreakdownItem,
  Spell,
  SpellCastRequirement,
  SpellDependencyConfig,
  SpellDependencyScope,
  SpellElementalStatusConfig,
  SpellMasteryStatus,
  SpellStatusParamConfig,
  StatKey,
  SynergyReactionType,
  WeaponPreset,
  BeastProfile,
} from '../types/rpg';

export const ARMOR_ELEMENTS: string[] = [
  'Tierra',
  'Fuego',
  'Agua',
  'Hielo',
  'Aire',
  'Rayo',
  'Metal',
  'Flora',
  'Luz',
  'Sombra',
  'Sónico',
  'Arcano',
];

export const LEVEL_POINTS: Record<number, number> = {
  1: 0,
  2: 10,
  3: 20,
  4: 40,
  5: 80,
  6: 160,
};

export const DEFAULT_STAT_MILESTONES: number[] = [0, 10, 20, 40, 80, 160];

export const DEFAULT_FORMULA: FormulaConfig = {
  base: 0,
  multiplier: 1,
  notes: '',
  masteryBaseMilestone: 10,
  masteryGrowth: 'linear',
  masteryCustomMilestones: [0, 10, 20, 30, 40],
  masteryAssuredBonusPerLevel: 0,
  masteryMaxDieUpgrades: 2,
  statMilestones: [...DEFAULT_STAT_MILESTONES],
};

export function normalizeStatMilestones(raw?: number[] | null): number[] {
  if (!Array.isArray(raw) || raw.length < 2) {
    return [...DEFAULT_STAT_MILESTONES];
  }
  const res = raw.slice(0, 6).map((n, idx) =>
    idx === 0 ? 0 : Math.max(1, Number(n) || DEFAULT_STAT_MILESTONES[idx] || idx * 10)
  );
  while (res.length < 6) {
    const prev = res[res.length - 1] || 10;
    res.push(prev * 2);
  }
  for (let i = 1; i < res.length; i++) {
    if (res[i] < res[i - 1]) {
      res[i] = res[i - 1] + 1;
    }
  }
  return res;
}

export function normalizeFormula(raw?: Partial<FormulaConfig> | null): FormulaConfig {
  const custom =
    Array.isArray(raw?.masteryCustomMilestones) && raw.masteryCustomMilestones.length >= 2
      ? raw.masteryCustomMilestones.map((n, idx) =>
          idx === 0 ? 0 : Math.max(1, Number(n) || idx * 10)
        )
      : [...DEFAULT_FORMULA.masteryCustomMilestones];

  return {
    base: typeof raw?.base === 'number' ? Math.max(0, raw.base) : DEFAULT_FORMULA.base,
    multiplier:
      typeof raw?.multiplier === 'number'
        ? Math.max(0, raw.multiplier)
        : DEFAULT_FORMULA.multiplier,
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    masteryBaseMilestone:
      typeof raw?.masteryBaseMilestone === 'number' && raw.masteryBaseMilestone >= 1
        ? raw.masteryBaseMilestone
        : DEFAULT_FORMULA.masteryBaseMilestone,
    masteryGrowth:
      raw?.masteryGrowth === 'linear' ||
      raw?.masteryGrowth === 'stepped' ||
      raw?.masteryGrowth === 'custom' ||
      raw?.masteryGrowth === 'double'
        ? raw.masteryGrowth
        : DEFAULT_FORMULA.masteryGrowth,
    masteryCustomMilestones: custom,
    masteryAssuredBonusPerLevel:
      typeof raw?.masteryAssuredBonusPerLevel === 'number' &&
      raw.masteryAssuredBonusPerLevel >= 0
        ? raw.masteryAssuredBonusPerLevel
        : 0,
    masteryMaxDieUpgrades:
      typeof raw?.masteryMaxDieUpgrades === 'number' && raw.masteryMaxDieUpgrades >= 0
        ? Math.min(4, Math.floor(raw.masteryMaxDieUpgrades))
        : DEFAULT_FORMULA.masteryMaxDieUpgrades,
    statMilestones: normalizeStatMilestones(raw?.statMilestones),
  };
}

export const STAT_NAMES: Record<StatKey, string> = {
  fisico: 'Físico',
  manipulacion: 'Manipulación',
  influencia: 'Influencia',
};

export const DIE_TYPES: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

export const IMBUE_ELEMENTS: string[] = [
  'Fuego',
  'Agua',
  'Hielo',
  'Aire',
  'Rayo',
  'Tierra / Roca',
  'Flora',
  'Luz',
  'Sombra',
  'Sónico',
  'Veneno',
  'Arcano',
];

export const WEAPON_PRESETS: WeaponPreset[] = [
  // Cuerpo a cuerpo
  {
    id: 'wp_daga',
    name: 'Daga',
    category: 'melee',
    dice: [{ type: 'd4', count: 1 }],
    description: 'Arma ligera cuerpo a cuerpo (1d4).',
  },
  {
    id: 'wp_espada_corta',
    name: 'Espada Corta',
    category: 'melee',
    dice: [{ type: 'd6', count: 1 }],
    description: 'Espada ágil a una mano (1d6).',
  },
  {
    id: 'wp_espada_larga',
    name: 'Espada Larga',
    category: 'melee',
    dice: [{ type: 'd8', count: 1 }],
    description: 'Espada versátil de combate (1d8).',
  },
  {
    id: 'wp_hacha_corta',
    name: 'Hacha Corta',
    category: 'melee',
    dice: [{ type: 'd4', count: 1 }],
    description: 'Hacha ligera de mano (1d4).',
  },
  {
    id: 'wp_hacha_guerra',
    name: 'Hacha de Guerra',
    category: 'melee',
    dice: [{ type: 'd12', count: 1 }],
    description: 'Hacha pesada de alto impacto (1d12).',
  },
  {
    id: 'wp_espadon',
    name: 'Espadón',
    category: 'melee',
    dice: [{ type: 'd6', count: 2 }],
    description: 'Mandoble a dos manos (2d6).',
  },
  {
    id: 'wp_lanza',
    name: 'Lanza',
    category: 'melee',
    dice: [{ type: 'd4', count: 2 }],
    description: 'Arma de asta con alcance (2d4).',
  },
  {
    id: 'wp_maza_corta',
    name: 'Maza Corta',
    category: 'melee',
    dice: [{ type: 'd6', count: 1 }],
    description: 'Maza contundente a una mano (1d6).',
  },
  {
    id: 'wp_maza_corta_2d6',
    name: 'Maza Corta (2d6)',
    category: 'melee',
    dice: [{ type: 'd6', count: 2 }],
    description: 'Maza pesada de impacto reforzado (2d6).',
  },
  {
    id: 'wp_alabarda',
    name: 'Alabarda',
    category: 'melee',
    dice: [{ type: 'd8', count: 2 }],
    description: 'Arma larga combinada de filo y punta (2d8).',
  },
  // A distancia
  {
    id: 'wp_arco',
    name: 'Arco',
    category: 'ranged',
    dice: [{ type: 'd6', count: 1 }],
    description: 'Arco estándar a distancia (1d6).',
  },
  {
    id: 'wp_arco_pesado',
    name: 'Arco pesado',
    category: 'ranged',
    dice: [{ type: 'd8', count: 1 }],
    description: 'Arco largo de gran tensión (1d8).',
  },
  {
    id: 'wp_ballesta_mano',
    name: 'Ballesta de Mano',
    category: 'ranged',
    dice: [{ type: 'd4', count: 1 }],
    description: 'Ballesta compacta a una mano (1d4).',
  },
  // Naturales / Desarmado
  {
    id: 'wp_garras',
    name: 'Garras',
    category: 'natural',
    dice: [{ type: 'd4', count: 1 }],
    isNatural: true,
    description: 'Ataque natural cortante con garras.',
  },
  {
    id: 'wp_mordidas',
    name: 'Mordidas',
    category: 'natural',
    dice: [{ type: 'd4', count: 1 }],
    isNatural: true,
    description: 'Ataque natural perforante con fauces.',
  },
  {
    id: 'wp_punetazos',
    name: 'Puñetazos no mágicos',
    category: 'natural',
    dice: [{ type: 'd4', count: 1 }],
    isNatural: true,
    description: 'Golpes cuerpo a cuerpo sin magia.',
  },
  // Catalizadores mágicos especiales
  {
    id: 'cat_1_mano',
    name: 'Catalizador mágico (1 mano)',
    category: 'catalyst',
    dice: [{ type: 'd6', count: 1 }],
    isMagicalCatalyst: true,
    catalystKind: 'one_hand',
    addsManipulacionLevel: true,
    addsInfluenciaLevel: true,
    description:
      'Arma mágica a una mano: al imbuir hace daño meramente mágico (1d6 + Nv. Influencia + Nv. Manipulación/maná).',
  },
  {
    id: 'cat_arco',
    name: 'Catalizador mágico (arco)',
    category: 'catalyst',
    dice: [{ type: 'd6', count: 1 }],
    isMagicalCatalyst: true,
    catalystKind: 'bow',
    addsManipulacionLevel: true,
    addsInfluenciaLevel: true,
    description:
      'Arco catalizador: al imbuir dispara daño meramente mágico (1d6 + Nv. Influencia + Nv. Manipulación/maná).',
  },
  {
    id: 'cat_grande',
    name: 'Catalizador mágico grande',
    category: 'catalyst',
    dice: [{ type: 'd6', count: 2 }],
    isMagicalCatalyst: true,
    catalystKind: 'great',
    addsManipulacionLevel: true,
    addsInfluenciaLevel: true,
    description:
      'Catalizador a dos manos: al imbuir hace daño meramente mágico (2d6 + valor fijo Nv. Manipulación + valor fijo Nv. Influencia).',
  },
  {
    id: 'cat_escudo',
    name: 'Catalizador mágico escudo (rodela)',
    category: 'catalyst',
    dice: [],
    isMagicalCatalyst: true,
    catalystKind: 'shield',
    reducesDefenseManaBy: 1,
    canExpandWithMana: true,
    description:
      'Rodela mágica: se expande según el maná que quieras usar y reduce en 1 el costo de maná de los hechizos de protección/defensa.',
  },
];

export type MageNatureCategory =
  | 'elemental'
  | 'luz_oscuridad'
  | 'arcana'
  | 'espacio_fuerza'
  | 'oscura'
  | 'fisica'
  | 'otra';

export const MAGE_NATURE_CATEGORIES: { id: MageNatureCategory; label: string }[] = [
  { id: 'elemental', label: 'Elementales y Clima' },
  { id: 'luz_oscuridad', label: 'Luz, Oscuridad y Vacío' },
  { id: 'arcana', label: 'Tiempo, Gravedad y Arcano' },
  { id: 'espacio_fuerza', label: 'Espacio, Portales y Fuerza' },
  { id: 'oscura', label: 'Drenaje, Sangre y Veneno' },
  { id: 'fisica', label: 'Transformación y Cuerpo' },
  { id: 'otra', label: 'Personalizada' },
];

export interface MageNaturePreset {
  id: string;
  label: string;
  category: MageNatureCategory;
  orders: string[];
  affinityOrders: string[];
  damageNote: string;
  defaultPhysicalVariant: MagePhysicalVariant;
}

export const MAGE_NATURES: MageNaturePreset[] = [
  // Elementales y Clima
  {
    id: 'fuego',
    label: 'Fuego / Ígneo',
    category: 'elemental',
    orders: ['Proyectar', 'Generar fuego'],
    affinityOrders: ['Generar fuego', 'Controlar llamas', 'Magma / Fundir'],
    damageNote: 'ígneo a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'agua',
    label: 'Agua / Mareas',
    category: 'elemental',
    orders: ['Proyectar', 'Controlar agua'],
    affinityOrders: ['Controlar agua', 'Vapor / Hervir', 'Invocar niebla'],
    damageNote: 'agua/mareas a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'hielo',
    label: 'Hielo / Escarcha',
    category: 'elemental',
    orders: ['Proyectar', 'Congelar / Hielo'],
    affinityOrders: ['Congelar / Hielo', 'Ventisca', 'Contener'],
    damageNote: 'hielo/escarcha a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'aire',
    label: 'Aire / Viento',
    category: 'elemental',
    orders: ['Proyectar', 'Corriente de aire'],
    affinityOrders: ['Corriente de aire', 'Impulsar / Empujar', 'Levitar / Flotar', 'Acelerar'],
    damageNote: 'aire/viento a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'rayo',
    label: 'Rayo / Electricidad',
    category: 'elemental',
    orders: ['Proyectar', 'Descarga eléctrica'],
    affinityOrders: ['Descarga eléctrica', 'Relámpago encadenado', 'Sobrecargar', 'Acelerar'],
    damageNote: 'rayo/eléctrico a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'tierra',
    label: 'Tierra / Roca',
    category: 'elemental',
    orders: ['Proyectar', 'Moldear roca'],
    affinityOrders: ['Levantar tierra', 'Moldear roca', 'Temblor / Fisura'],
    damageNote: 'tierra/roca a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'flora',
    label: 'Flora / Naturaleza',
    category: 'elemental',
    orders: ['Proyectar', 'Hacer crecer flora'],
    affinityOrders: ['Hacer crecer flora', 'Enredar / Raíces', 'Esporas / Polen'],
    damageNote: 'flora/espinas a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'tormenta',
    label: 'Tormenta / Clima',
    category: 'elemental',
    orders: ['Proyectar', 'Relámpago encadenado'],
    affinityOrders: ['Relámpago encadenado', 'Ventisca', 'Invocar niebla', 'Corriente de aire'],
    damageNote: 'tempestuoso/climático a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'magma',
    label: 'Magma / Volcánico',
    category: 'elemental',
    orders: ['Proyectar', 'Magma / Fundir'],
    affinityOrders: ['Magma / Fundir', 'Temblor / Fisura', 'Vapor / Hervir', 'Generar fuego'],
    damageNote: 'magmático/fundido a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'metal',
    label: 'Metal / Forja',
    category: 'elemental',
    orders: ['Proyectar', 'Manipular metal'],
    affinityOrders: ['Manipular metal', 'Moldear', 'Fragmentar', 'Escudo'],
    damageNote: 'metálico/cortante a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'sonico',
    label: 'Sónico / Ondas sonoras',
    category: 'elemental',
    orders: ['Proyección sonora', 'Proyectar'],
    affinityOrders: ['Proyección sonora', 'Vibración de ondas', 'Estruendo', 'Resonancia'],
    damageNote: 'sónico (vibración de ondas) a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },

  // Luz, Oscuridad y Vacío
  {
    id: 'luz',
    label: 'Luz / Radiancia',
    category: 'luz_oscuridad',
    orders: ['Proyectar', 'Proyectar luz'],
    affinityOrders: [
      'Proyectar luz',
      'Rayo solar',
      'Destello cegador',
      'Refractar / Prisma',
      'Bendecir',
      'Consagrar terreno',
      'Juicio lumínico',
      'Purificar / Limpiar',
    ],
    damageNote: 'lumínico/radiante a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'sombra',
    label: 'Sombra / Oscuridad',
    category: 'luz_oscuridad',
    orders: ['Proyectar', 'Manipular sombra'],
    affinityOrders: [
      'Manipular sombra',
      'Sombra sólida',
      'Paso umbrío',
      'Cadenas umbrías',
      'Manto de oscuridad',
      'Infundir miedo / Terror',
      'Corromper',
    ],
    damageNote: 'umbrío/oscuro a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'eclipse',
    label: 'Eclipse / Crepúsculo',
    category: 'luz_oscuridad',
    orders: ['Proyectar', 'Eclipse'],
    affinityOrders: [
      'Eclipse',
      'Consumir luz',
      'Refractar / Prisma',
      'Sombra sólida',
      'Juicio lumínico',
      'Manto de oscuridad',
      'Drenar',
    ],
    damageNote: 'crepuscular (luz y sombra) a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'vacio',
    label: 'Vacío / Abismo',
    category: 'luz_oscuridad',
    orders: ['Proyectar', 'Grieta del vacío'],
    affinityOrders: [
      'Grieta del vacío',
      'Anular magia / Vacío',
      'Consumir luz',
      'Marca del abismo',
      'Corromper',
      'Pesadilla',
      'Drenar maná',
    ],
    damageNote: 'del vacío/corruptor a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  // Bestia
  {
  id: 'doma_bestias',
  label: 'Domador / Controlador de Bestias',
  category: 'otra',
  orders: ['Domar', 'Vínculo', 'Manada'],
  affinityOrders: ['Domar', 'Vínculo', 'Manada', 'Instinto', 'Canto'],
  damageNote: 'de vínculo instintivo a distancia',
  defaultPhysicalVariant: 'golpe_fisico',
},
  // Musica
  {
    id: 'musico',
    label: 'Músico / Bardo',
    category: 'otra',
    orders: ['Proyección sonora', 'Resonancia', 'Curar'],
    affinityOrders: [
      'Proyección sonora',
      'Resonancia',
      'Pulso acústico',
      'Eco / Reverberación',
      'Curar',
    ],
    damageNote: 'palabra musical / sónico a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  // Tiempo, Gravedad y Arcano
  {
    id: 'tiempo',
    label: 'Tiempo / Cronomancia',
    category: 'arcana',
    orders: ['Proyectar', 'Eco temporal'],
    affinityOrders: [
      'Acelerar tiempo',
      'Ralentizar tiempo',
      'Fijar / Estasis',
      'Revertir instante',
      'Premonición',
      'Eco temporal',
    ],
    damageNote: 'temporal/distorsión a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'gravedad',
    label: 'Gravedad / Gravitomancia',
    category: 'arcana',
    orders: ['Proyectar', 'Aumentar gravedad'],
    affinityOrders: ['Aumentar gravedad', 'Anular gravedad', 'Comprimir', 'Atraer', 'Levitar / Flotar'],
    damageNote: 'gravitatorio/aplastante a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'espacio',
    label: 'Espacio / Telequinesis',
    category: 'espacio_fuerza',
    orders: ['Proyectar', 'Comprimir'],
    affinityOrders: ['Teletransportar', 'Impulsar / Empujar', 'Atraer', 'Expandir', 'Contener'],
    damageNote: 'espacial/cinético a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'portales',
    label: 'Portales / Umbrales',
    category: 'espacio_fuerza',
    orders: ['Proyectar', 'Abrir portal'],
    affinityOrders: [
      'Abrir portal',
      'Anclar portal',
      'Vincular destinos',
      'Redirigir trayectoria',
      'Atravesar portal',
      'Cerrar portal',
    ],
    damageNote: 'espacial/umbral a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'explosion',
    label: 'Explosión / Fuerza expansiva',
    category: 'espacio_fuerza',
    orders: ['Proyectar', 'Detonar'],
    affinityOrders: [
      'Concentrar fuerza',
      'Acumular presión',
      'Detonar',
      'Liberar onda expansiva',
      'Fragmentar',
      'Implosionar',
    ],
    damageNote: 'cinético/explosivo a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'runas',
    label: 'Runas / Sigilos',
    category: 'arcana',
    orders: ['Proyectar', 'Inscribir runa'],
    affinityOrders: ['Inscribir runa', 'Activar por proximidad', 'Anclar en zona', 'Trazar círculo', 'Detonar'],
    damageNote: 'rúnico/detonante a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'arcano',
    label: 'Arcano / Meta-magia',
    category: 'arcana',
    orders: ['Proyectar', 'Potenciar'],
    affinityOrders: ['Potenciar', 'Dividir proyectil', 'Teledirigir', 'Sobrecargar', 'Contrarrestar', 'Sifonar maná'],
    damageNote: 'arcano puro a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'mente',
    label: 'Mente / Ilusión',
    category: 'arcana',
    orders: ['Proyectar', 'Ilusión'],
    affinityOrders: ['Ilusión', 'Encantar', 'Desorientar', 'Silenciar', 'Intimidar', 'Vincular'],
    damageNote: 'psíquico/ilusorio a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'alquimia',
    label: 'Alquimia / Transmutación',
    category: 'arcana',
    orders: ['Proyectar', 'Transmutar'],
    affinityOrders: ['Transmutar', 'Imbuir', 'Purificar', 'Crear', 'Sellar', 'Curar'],
    damageNote: 'alquímico/transmutado a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },

  // Veneno, Sangre y Drenaje
  {
    id: 'veneno',
    label: 'Veneno / Corrosión',
    category: 'oscura',
    orders: ['Proyectar', 'Corroer / Ácido'],
    affinityOrders: ['Envenenar', 'Corroer / Ácido', 'Debilitar', 'Marchitar', 'Esporas / Polen'],
    damageNote: 'tóxico/corrosivo a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'sangre',
    label: 'Sangre / Hemomancia',
    category: 'oscura',
    orders: ['Proyectar', 'Sangrar'],
    affinityOrders: ['Sangrar', 'Pacto de sangre', 'Drenar vitalidad', 'Regenerar tejido'],
    damageNote: 'hemomántico/vital a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
  {
    id: 'drenaje',
    label: 'Drenaje / Maldición',
    category: 'oscura',
    orders: ['Proyectar', 'Drenar'],
    affinityOrders: [
      'Drenar',
      'Drenar vitalidad',
      'Drenar maná',
      'Drenar escudo / Barrera',
      'Drenar fuerza (Físico)',
      'Sifón vital',
      'Maldecir',
      'Debilitar',
    ],
    damageNote: 'de drenaje/maldición a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },

  // Transformación y Cuerpo
  {
    id: 'transformacion_garras',
    label: 'Transformación Bestial (Garras)',
    category: 'fisica',
    orders: ['Proyectar', 'Forma bestial / Licantropía'],
    affinityOrders: ['Forma bestial / Licantropía', 'Garras / Colmillos', 'Sentidos agudos', 'Agilizar reflejos'],
    damageNote: 'energía bestial a distancia',
    defaultPhysicalVariant: 'garras',
  },
  {
    id: 'transformacion_mordida',
    label: 'Transformación Depredador (Mordida)',
    category: 'fisica',
    orders: ['Proyectar', 'Garras / Colmillos'],
    affinityOrders: ['Garras / Colmillos', 'Forma bestial / Licantropía', 'Regenerar tejido', 'Intimidar'],
    damageNote: 'instinto salvaje a distancia',
    defaultPhysicalVariant: 'mordida',
  },
  {
    id: 'cuerpo_reforzado',
    label: 'Cuerpo Reforzado / Marcial',
    category: 'fisica',
    orders: ['Proyectar', 'Endurecer piel'],
    affinityOrders: ['Endurecer piel', 'Aumentar tamaño', 'Mitigar daño', 'Impulsar / Empujar'],
    damageNote: 'onda cinética a distancia',
    defaultPhysicalVariant: 'embestida',
  },

  // Personalizada
  {
    id: 'personalizada',
    label: 'Otra naturaleza (personalizada)',
    category: 'otra',
    orders: ['Proyectar', 'Imbuir'],
    affinityOrders: [],
    damageNote: 'canalizado a distancia',
    defaultPhysicalVariant: 'golpe_fisico',
  },
];

export const PHYSICAL_VARIANTS: Record<
  MagePhysicalVariant,
  {
    label: string;
    spellName: string;
    orders: string[];
    notes: string;
    description: string;
  }
> = {
  golpe_fisico: {
    label: 'Golpe Físico (estándar)',
    spellName: 'Golpe Físico',
    orders: [],
    notes: 'físico contundente',
    description: 'Ataque físico directo sin consumo de maná.',
  },
  garras: {
    label: 'Garras (transformación / bestial)',
    spellName: 'Zarpazo de Garras',
    orders: ['Garras / Colmillos'],
    notes: 'físico cortante (garras)',
    description: 'Ataque cuerpo a cuerpo con garras naturales o transformadas sin consumo de maná.',
  },
  mordida: {
    label: 'Mordida (licántropo / depredador)',
    spellName: 'Mordida Feroz',
    orders: ['Garras / Colmillos'],
    notes: 'físico perforante (mordida)',
    description: 'Ataque físico directo con colmillos o fauces sin consumo de maná.',
  },
  embestida: {
    label: 'Embestida / Golpe Reforzado',
    spellName: 'Embestida Reforzada',
    orders: ['Endurecer piel'],
    notes: 'físico contundente reforzado',
    description: 'Ataque cuerpo a cuerpo usando endurecimiento o masa física sin consumo de maná.',
  },
  personalizado: {
    label: 'Variante física personalizada',
    spellName: 'Ataque Físico Propio',
    orders: ['Transformar forma'],
    notes: 'físico propio',
    description: 'Ataque cuerpo a cuerpo adaptado a la naturaleza física del mago.',
  },
};
export interface MusicianInstrumentPreset {
  id: MusicianInstrumentId;
  label: string;
  family: 'Viento y Voz' | 'Cuerda' | 'Percusión';
  focus: 'curacion' | 'ataque' | 'defensa' | 'control_eco';
  bonusText: string;
  description: string;
}

export const MUSICIAN_INSTRUMENTS: Record<MusicianInstrumentId, MusicianInstrumentPreset> = {
  voz: {
    id: 'voz',
    label: 'Voz',
    family: 'Viento y Voz',
    focus: 'curacion',
    bonusText: '+1 éxito asegurado en «Curar heridas» y +1 bono en «Compás»',
    description: 'Proyección vocal directa; fuerte en aliento, curación y sostén de ritmo.',
  },
  ocarina: {
    id: 'ocarina',
    label: 'Ocarina',
    family: 'Viento y Voz',
    focus: 'control_eco',
    bonusText: '+1 éxito asegurado en «Eco» y +1 bono en «Curar heridas»',
    description: 'Aire puro y melódico; favorece ecos armónicos y curaciones suaves.',
  },
  flauta: {
    id: 'flauta',
    label: 'Flauta',
    family: 'Viento y Voz',
    focus: 'control_eco',
    bonusText: '+1 éxito asegurado en «Disonancia» y +1 bono en «Eco»',
    description: 'Melodía ágil y aguda; ideal para disonar y encadenar ecos.',
  },
  trompeta: {
    id: 'trompeta',
    label: 'Trompeta',
    family: 'Viento y Voz',
    focus: 'ataque',
    bonusText: '+1 éxito asegurado en «Lanza» y +1 bono en «Disonancia»',
    description: 'Potencia metálica y frontal; proyecta estocadas sonoras y notas estridentes.',
  },
  guitarra: {
    id: 'guitarra',
    label: 'Guitarra',
    family: 'Cuerda',
    focus: 'ataque',
    bonusText: '+1 éxito asegurado en «Lanza» y +1 bono en «Compás»',
    description: 'Cuerda pulsada y rasgueada; versátil entre impacto dirigido y ritmo.',
  },
  laud: {
    id: 'laud',
    label: 'Laúd',
    family: 'Cuerda',
    focus: 'curacion',
    bonusText: '+1 éxito asegurado en «Curar heridas» y +1 bono en «Eco»',
    description: 'Clásico de bardo; equilibra restauración, melodía y resonancia.',
  },
  arpa: {
    id: 'arpa',
    label: 'Arpa',
    family: 'Cuerda',
    focus: 'curacion',
    bonusText: '+1 éxito asegurado en «Curar heridas» y +1 bono en «Eco»',
    description: 'Armonía amplia y envolvente; potencia curaciones y ecos prolongados.',
  },
  banjo: {
    id: 'banjo',
    label: 'Banjo',
    family: 'Cuerda',
    focus: 'ataque',
    bonusText: '+1 éxito asegurado en «Lanza» y +1 bono en «Compás»',
    description: 'Pulso percutido y vivo; destaca en ataques ágiles y cadencia marcada.',
  },
  tambor: {
    id: 'tambor',
    label: 'Tambor',
    family: 'Percusión',
    focus: 'defensa',
    bonusText: '+1 éxito asegurado en «Muralla» y +1 bono en «Compás»',
    description: 'Percusión grave y firme; levanta barreras rítmicas y marca el tiempo.',
  },
  pandereta: {
    id: 'pandereta',
    label: 'Pandereta',
    family: 'Percusión',
    focus: 'control_eco',
    bonusText: '+1 éxito asegurado en «Disonancia» y +1 bono en «Compás»',
    description: 'Ritmo tintineante y ágil; altera el compás y descoloca al rival.',
  },
};

export function buildMusicianWordSpells(params: {
  charId: string;
  instrument: MusicianInstrumentId;
}): Spell[] {
  const inst = MUSICIAN_INSTRUMENTS[params.instrument] || MUSICIAN_INSTRUMENTS.voz;
  const tag = inst.label;

  return [
    {
      id: generateId('sp_'),
      name: `Palabra: «Curar heridas» (${tag})`,
      manaCost: 2,
      orders: ['Curar', 'Proyección sonora', 'Resonancia'],
      statuses: [],
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'influencia',
      manualCastDice: 0,
      assuredSuccess: inst.focus === 'curacion' ? 1 : 0,
      combatStats: [],
      damageMode: 'auto',
      effectType: 'heal',
      damage: {
        dice: [{ type: 'd6', count: 1 }],
        bonus: inst.focus === 'curacion' ? 2 : 1,
        notes: `palabra musical · ${tag}`,
      },
      effectDescription: `Invoca «Curar heridas» con ${tag} para restaurar PV a un aliado.`,
      duration: 'Instantáneo',
      isBasic: false,
    },
    {
      id: generateId('sp_'),
      name: `Palabra: «Lanza» (${tag})`,
      manaCost: 2,
      orders: ['Proyectar', 'Proyección sonora', 'Vibración de ondas'],
      statuses: [],
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: inst.focus === 'ataque' ? 1 : 0,
      combatStats: ['influencia', 'manipulacion'],
      damageMode: 'auto',
      effectType: 'damage',
      damageKind: 'magico',
      damage: {
        dice: [{ type: 'd6', count: 1 }],
        bonus: inst.focus === 'ataque' ? 2 : 1,
        notes: `palabra musical · ${tag}`,
      },
      effectDescription: `Invoca «Lanza» con ${tag} para lanzar un impacto sonoro punzante.`,
      duration: 'Instantáneo',
      isBasic: false,
    },
    {
      id: generateId('sp_'),
      name: `Palabra: «Muralla» (${tag})`,
      manaCost: 2,
      orders: ['Proteger', 'Barrera', 'Resonancia'],
      statuses: [],
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: inst.focus === 'defensa' ? 1 : 0,
      combatStats: ['influencia', 'manipulacion'],
      damageMode: 'auto',
      effectType: 'defense',
      damage: { dice: [], bonus: 0, notes: `palabra musical · ${tag}` },
      effectDescription: `Invoca «Muralla» con ${tag} para alzar una defensa sonora ante ataques.`,
      duration: 'Instantáneo',
      isBasic: false,
    },
    {
      id: generateId('sp_'),
      name: `Palabra: «Disonancia» (${tag})`,
      manaCost: 2,
      orders: ['Proyección sonora', 'Ensordecer', 'Desorientar'],
      statuses: ['Ensordecer'],
      statusParams: { Ensordecer: { autoFails: 1 } },
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'influencia',
      manualCastDice: 0,
      assuredSuccess: inst.focus === 'control_eco' ? 1 : 0,
      combatStats: [],
      damageMode: 'auto',
      effectType: 'effect',
      effectSubType: 'debuff',
      damage: { dice: [], bonus: 0, notes: `palabra musical · ${tag}` },
      effectDescription: `Invoca «Disonancia» con ${tag} para aplicar Ensordecer mediante Influencia.`,
      duration: '1 turno',
      durationTurns: 1,
      isBasic: false,
    },
    {
      id: generateId('sp_'),
      name: `Palabra: «Compás» (${tag})`,
      manaCost: 2,
      orders: ['Acelerar', 'Pulso acústico'],
      statuses: [],
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'influencia',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: [],
      damageMode: 'auto',
      effectType: 'effect',
      effectSubType: 'buff',
      damage: {
        dice: [],
        bonus:
          inst.focus === 'curacion' || inst.focus === 'ataque' || inst.focus === 'defensa'
            ? 1
            : 0,
        notes: `palabra musical · ${tag}`,
      },
      effectDescription: `Marca el ritmo con «Compás» (${tag}) durante 2 turnos.`,
      duration: '2 turnos',
      durationTurns: 2,
      isBasic: false,
    },
    {
      id: generateId('sp_'),
      name: `Palabra: «Eco» (${tag})`,
      manaCost: 2,
      orders: ['Eco / Reverberación', 'Potenciar'],
      statuses: [],
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: inst.focus === 'control_eco' ? 1 : 0,
      combatStats: ['influencia', 'manipulacion'],
      damageMode: 'auto',
      effectType: 'damage',
      damageKind: 'magico',
      damage: {
        dice: [{ type: 'd4', count: 2 }],
        bonus: inst.focus === 'control_eco' ? 1 : 0,
        notes: `palabra musical · ${tag}`,
      },
      effectDescription: `Invoca «Eco» con ${tag} para proyectar una reverberación de 2d4 mágico.`,
      duration: 'Instantáneo',
      isBasic: false,
    },
  ];
}
export const ORDER_LIBRARY: OrderCategory[] = [
  {
    id: 'elemental',
    name: 'Elementales',
    description: 'Fuego, agua, hielo, aire, rayo, tierra, flora y metal.',
    orders: [
      'Generar fuego',
      'Controlar llamas',
      'Controlar agua',
      'Congelar / Hielo',
      'Corriente de aire',
      'Descarga eléctrica',
      'Levantar tierra',
      'Moldear roca',
      'Hacer crecer flora',
      'Manipular metal',
    ],
  },
  {
    id: 'light_radiance',
    name: 'Luz y Radiancia',
    description:
      'Luz solar, destellos, refracción en prismas, purificación, bendiciones, consagración y juicios lumínicos.',
    orders: [
      'Proyectar luz',
      'Destello cegador',
      'Rayo solar',
      'Refractar / Prisma',
      'Haz concentrado',
      'Espejismo lumínico',
      'Revelar lo oculto',
      'Purificar / Limpiar',
      'Quemadura radiante',
      'Bendecir',
      'Consagrar terreno',
      'Juicio lumínico',
      'Halo protector',
      'Sellar oscuridad',
      'Cadenas de luz',
      'Aura radiante',
    ],
  },
  {
    id: 'darkness_void',
    name: 'Oscuridad, Sombras y Vacío',
    description:
      'Sombras sólidas, paso umbrío, eclipse, grietas del vacío, miedo, corrupción, cadenas umbrías y maldiciones oscuras.',
    orders: [
      'Manipular sombra',
      'Sombra sólida',
      'Paso umbrío',
      'Manto de oscuridad',
      'Ocultar en sombras',
      'Eclipse',
      'Grieta del vacío',
      'Consumir luz',
      'Anular magia / Vacío',
      'Filo umbrío',
      'Cadenas umbrías',
      'Corromper',
      'Infundir miedo / Terror',
      'Pesadilla',
      'Maldición oscura',
      'Marca del abismo',
      'Velo de silencio',
    ],
  },
  {
    id: 'sonic',
    name: 'Sónico y Ondas',
    description: 'Proyección sonora (base de todos los hechizos sónicos), vibración de ondas, estruendo y resonancia.',
    orders: [
      'Proyección sonora',
      'Vibración de ondas',
      'Estruendo',
      'Onda expansiva sonora',
      'Resonancia',
      'Pulso acústico',
      'Eco / Reverberación',
      'Frecuencia / Ultrasonido',
    ],
  },
  {
    id: 'transformation',
    name: 'Transformación y Cuerpo',
    description: 'Licantropía, metamorfosis, rasgos bestiales y mejora corporal.',
    orders: [
      'Transformar forma',
      'Forma bestial / Licantropía',
      'Endurecer piel',
      'Garras / Colmillos',
      'Alas / Vuelo',
      'Aumentar tamaño',
      'Reducir tamaño',
      'Agilizar reflejos',
      'Regenerar tejido',
      'Camuflaje / Mimetismo',
      'Sentidos agudos',
    ],
  },
  {
    id: 'force_space',
    name: 'Fuerza, Movimiento y Espacio',
    description: 'Impulso, gravedad, telequinesis, desplazamiento y contención.',
    orders: [
      'Proyectar',
      'Impulsar / Empujar',
      'Atraer',
      'Comprimir',
      'Expandir',
      'Levitar / Flotar',
      'Deslizar',
      'Teletransportar',
      'Contener',
      'Retrasar',
      'Acelerar',
      'Sostener',
    ],
  },
  {
    id: 'portals',
    name: 'Portales y Umbrales',
    description: 'Apertura, anclaje, conexión, redirección y cierre de portales.',
    orders: [
      'Abrir portal',
      'Anclar portal',
      'Vincular destinos',
      'Redirigir trayectoria',
      'Atravesar portal',
      'Cerrar portal',
    ],
  },
  {
    id: 'explosive_force',
    name: 'Explosión y Fuerza de Choque',
    description:
      'Compresión y liberación de fuerza, detonaciones y ondas de impacto; no presupone fuego ni Quemadura.',
    orders: [
      'Concentrar fuerza',
      'Acumular presión',
      'Detonar',
      'Liberar onda expansiva',
      'Fragmentar',
      'Implosionar',
    ],
  },
  {
    id: 'defense',
    name: 'Defensa y Protección',
    description: 'Escudos, barreras, desvíos, absorción y disipación.',
    orders: [
      'Escudo',
      'Barrera',
      'Proteger',
      'Esquivar',
      'Desviar',
      'Absorber',
      'Reflejar',
      'Disipar',
      'Mitigar daño',
    ],
  },
  {
    id: 'mind_spirit',
    name: 'Mente, Ilusión y Espíritu',
    description: 'Ilusiones, alteración sensorial, vínculo y aura.',
    orders: [
      'Ilusión',
      'Iluminar',
      'Cegar',
      'Ensordecer',
      'Silenciar',
      'Encantar',
      'Intimidar',
      'Detectar',
      'Vincular',
      'Invocar',
      'Desorientar',
    ],
  },
  {
    id: 'matter_heal',
    name: 'Materia, Alquimia y Restauración',
    description: 'Curación, transmutación, reparación y creación material.',
    orders: [
      'Curar',
      'Purificar',
      'Reparar',
      'Crear',
      'Moldear',
      'Adherir',
      'Fragmentar',
      'Transmutar',
      'Imbuir',
      'Sellar',
    ],
  },
  {
    id: 'metamagic',
    name: 'Meta-magia y Arcano puro',
    description: 'Modificadores arcanos que potencian, dividen, redirigen o alteran otros hechizos.',
    orders: [
      'Potenciar',
      'Dividir proyectil',
      'Teledirigir',
      'Aumentar alcance',
      'Prolongar duración',
      'Ocultar lanzamiento',
      'Sifonar maná',
      'Sobrecargar',
      'Contrarrestar',
    ],
  },
  {
    id: 'runes_zone',
    name: 'Runas, Trampas y Zona',
    description: 'Inscripción rúnica, control de área, disparadores por proximidad y detonación.',
    orders: [
      'Inscribir runa',
      'Activar por proximidad',
      'Anclar en zona',
      'Expandir área',
      'Concentrar en punto',
      'Encadenar objetivos',
      'Trazar círculo',
      'Canalizar',
      'Detonar',
    ],
  },
  {
    id: 'time_gravity',
    name: 'Tiempo y Gravedad',
    description: 'Alteración temporal, estasis, premonición y manipulación gravitatoria.',
    orders: [
      'Acelerar tiempo',
      'Ralentizar tiempo',
      'Fijar / Estasis',
      'Revertir instante',
      'Aumentar gravedad',
      'Anular gravedad',
      'Premonición',
      'Eco temporal',
    ],
  },
  {
    id: 'poison_drain',
    name: 'Veneno, Corrosión y Drenaje',
    description:
      'Drenaje puro y absorción de vida, maná, escudos o estadísticas, junto a toxinas, ácido, maldiciones y magia de sangre.',
    orders: [
      'Drenar',
      'Drenar vitalidad',
      'Drenar maná',
      'Drenar escudo / Barrera',
      'Drenar fuerza (Físico)',
      'Drenar precisión (Manipulación)',
      'Drenar voluntad (Influencia)',
      'Sifón vital',
      'Absorber energía',
      'Transferir vitalidad',
      'Envenenar',
      'Corroer / Ácido',
      'Maldecir',
      'Debilitar',
      'Marchitar',
      'Sangrar',
      'Pacto de sangre',
    ],
  },
  {
    id: 'weather_nature',
    name: 'Clima y Naturaleza avanzada',
    description: 'Fenómenos atmosféricos, magma, vapor, ventiscas, raíces y sismos.',
    orders: [
      'Invocar niebla',
      'Enredar / Raíces',
      'Temblor / Fisura',
      'Magma / Fundir',
      'Vapor / Hervir',
      'Ventisca',
      'Esporas / Polen',
      'Relámpago encadenado',
    ],
  },
];

export const PRESET_ORDERS: string[] = [
  ...new Set(ORDER_LIBRARY.flatMap((cat) => cat.orders)),
];

export const PRESET_STATUSES: string[] = [
  'Cegar',
  'Noquear',
  'Aturdir',
  'Derribar',
  'Inmovilizar',
  'Ralentizar',
  'Empujar',
  'Silenciar',
  'Ensordecer',
  'Desarmar',
  'Intimidar',
  'Envenenado',
  'Quemadura',
  'Congelado',
  'Electrificado',
  'Sangrando',
  'Disipar',
  'Vinculado',
];

export const BASIC_SPELLS: Spell[] = [
  {
    id: 'basic_golpe_fisico',
    name: 'Golpe Físico',
    manaCost: 0,
    orders: [],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['fisico'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'físico no mágico' },
    effectDescription: 'Ataque físico directo sin consumo de maná. Apto para cualquier PJ o PNJ.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_esquiva_fisica',
    name: 'Esquiva Física',
    manaCost: 0,
    orders: ['Esquivar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['fisico'],
    damageMode: 'auto',
    effectType: 'defense',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription: 'Acción defensiva física básica para evitar o bloquear un impacto.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_ataque_canalizado',
    name: 'Impacto Canalizado',
    manaCost: 1,
    orders: ['Proyectar', 'Imbuir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'mágico a distancia' },
    effectDescription:
      'Ataque mágico base a distancia de todos los magos (1d4 mágico). Se lanza directo sin casteo previo.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_luz_mago',
    name: 'Luz de Mago',
    manaCost: 0,
    orders: ['Iluminar', 'Proyectar luz'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'general',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription: 'Siempre se efectúa sin tirada: crea una esfera de luz que sigue al lanzador.',
    duration: 'Hasta ser disipado',
    isBasic: true,
  },
  {
    id: 'basic_escudo_magico',
    name: 'Escudo Mágico',
    manaCost: 0,
    orders: ['Proteger', 'Escudo'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 1,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'defense',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription: 'Bloquea un ataque manipulando maná. Suma +1 éxito asegurado a la defensa.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_curar_heridas',
    name: 'Curar Heridas Leves',
    manaCost: 0,
    orders: ['Curar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'heal',
    noMastery: true,
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'curación' },
    effectDescription: 'Siempre se efectúa sin tirada de casteo: cura 1d4 PV a un ser vivo tocado. No mejora por maestría.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_destello_cegador',
    name: 'Destello Cegador',
    manaCost: 2,
    orders: ['Proyectar', 'Cegar'],
    statuses: ['Cegar'],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'debuff',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription: 'Proyecta una ráfaga o destello para cegar al objetivo (tirada por Influencia).',
    duration: '1 turno',
    durationTurns: 1,
    isBasic: true,
  },
  {
    id: 'basic_choque_noqueador',
    name: 'Onda Contundente',
    manaCost: 2,
    orders: ['Comprimir', 'Proyectar'],
    statuses: ['Noquear'],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'debuff',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription: 'Descarga de impacto seco que intenta noquear al objetivo (tirada por Influencia).',
    duration: '1 turno',
    durationTurns: 1,
    isBasic: true,
  },
  {
    id: 'basic_proteccion',
    name: 'Protección',
    manaCost: 1,
    orders: ['Proteger', 'Mitigar daño'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Gasta 1 punto de maná para reducir el daño a tu vida en 3 si es mágico o en 5 si es físico. Puede usarse múltiples veces con el mismo ataque.',
    duration: '1 ataque',
    isBasic: true,
  },
  {
    id: 'basic_presentir_mana',
    name: 'Presentir Maná',
    manaCost: 1,
    orders: ['Detectar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'general',
    noMastery: true,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Gasta 1 punto de maná para detectar en un área de 30 pies todo foco de maná que se pueda percibir y no se esté ocultando.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_reforzar_hechizo',
    name: 'Reforzar Hechizo',
    manaCost: 1,
    orders: ['Imbuir', 'Expandir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Gasta 1 punto de maná para tirar dos veces los dados de daño de un hechizo y aplicar el resultado más alto.',
    duration: '1 hechizo',
    isBasic: true,
  },
  {
    id: 'basic_hechizo_veloz',
    name: 'Hechizo Veloz',
    manaCost: 3,
    orders: ['Acelerar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Gasta 3 puntos de maná para realizar un segundo hechizo de ataque en tu turno.',
    duration: '1 turno',
    durationTurns: 1,
    isBasic: true,
  },
  {
    id: 'basic_elevar_limite',
    name: 'Elevar el Límite',
    manaCost: 5,
    orders: ['Acelerar', 'Expandir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Gasta 5 puntos de maná para realizar un tercer ataque en tu turno, luego de haber usado Hechizo Veloz.',
    duration: '1 turno',
    durationTurns: 1,
    isBasic: true,
  },
  {
    id: 'basic_interrumpir_circulo',
    name: 'Interrumpir Círculo',
    manaCost: 7,
    orders: ['Disipar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['influencia', 'manipulacion'],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'general',
    noMastery: true,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Gasta 7 puntos de maná para realizar una tirada enfrentada de Influencia + Manipulación de maná e intentar anular un hechizo.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'basic_foco_arcano',
    name: 'Foco Arcano',
    manaCost: 2,
    orders: ['Comprimir', 'Imbuir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    unlearnedByDefault: true,
    catalogChainGroup: 'Foco Arcano',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Buff base de preparación: condensás maná puro alrededor de tu cuerpo durante 3 turnos. Habilita hechizos dependientes como Descarga Focalizada (lo mantiene activo) y Estallido Conmocionante (lo consume para aturdir). Sin maestría.',
    duration: '3 turnos',
    durationTurns: 3,
    isBasic: true,
  },
  {
    id: 'basic_descarga_focalizada',
    name: 'Descarga Focalizada',
    manaCost: 2,
    orders: ['Proyectar', 'Comprimir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    noMastery: false,
    unlearnedByDefault: true,
    catalogChainGroup: 'Foco Arcano',
    damage: { dice: [{ type: 'd6', count: 2 }], bonus: 0, notes: 'descarga focalizada' },
    effectDescription:
      'Ataque mágico general de alto impacto (2d6 mágico). Requiere tener Foco Arcano activo y lo mantiene encendido tras disparar. Admite maestría.',
    duration: 'Instantáneo',
    dependency: {
      enabled: true,
      scope: 'self_active',
      requiredSpellId: 'basic_foco_arcano',
      requiredName: 'Foco Arcano',
      consumeOnUse: false,
    },
    isBasic: true,
  },
  {
    id: 'basic_estallido_conmocionante',
    name: 'Estallido Conmocionante',
    manaCost: 3,
    orders: ['Comprimir', 'Expandir', 'Aturdir'],
    statuses: ['Aturdir'],
    statusParams: {
      Aturdir: { untilHit: true },
    },
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'debuff',
    noMastery: true,
    unlearnedByDefault: true,
    catalogChainGroup: 'Foco Arcano',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Debuff mayor general: libera toda la energía de Foco Arcano (lo consume al lanzarse) en una onda de choque para intentar Aturdir al objetivo por Influencia (hasta recibir 1 golpe). Sin maestría.',
    duration: 'Hasta recibir 1 golpe',
    durationTurns: 1,
    dependency: {
      enabled: true,
      scope: 'self_active',
      requiredSpellId: 'basic_foco_arcano',
      requiredName: 'Foco Arcano',
      consumeOnUse: true,
    },
    isBasic: true,
  },
];

export const BASIC_SPELL_IDS = BASIC_SPELLS.map((s) => s.id);

export const UNLEARNED_BASIC_SPELL_IDS = BASIC_SPELLS.filter((s) => s.unlearnedByDefault).map(
  (s) => s.id
);

export const STARTER_MAGE_SPELL_IDS = [
  'basic_golpe_fisico',
  'basic_esquiva_fisica',
  'basic_ataque_canalizado',
  'basic_luz_mago',
  'basic_escudo_magico',
  'basic_curar_heridas',
  'basic_proteccion',
  'basic_presentir_mana',
  'basic_reforzar_hechizo',
  'basic_hechizo_veloz',
  'basic_elevar_limite',
  'basic_interrumpir_circulo',
];

export const STARTER_NPC_SPELL_IDS = [
  'basic_golpe_fisico',
  'basic_esquiva_fisica',
];

export const INITIAL_CHARACTERS: Character[] = [
  {
    id: 'char_mago',
    name: 'Mago',
    kind: 'mage',
    characterLevel: 1,
    progressionHistory: [],
    nature: 'Arcano / Meta-magia',
    physicalVariant: 'golpe_fisico',
    stats: { fisico: 1, manipulacion: 1, influencia: 1 },
    statPoints: { fisico: 0, manipulacion: 0, influencia: 0 },
    hp: { current: 20, max: 20 },
    mana: { current: 15, max: 15 },
    knownSpells: [...STARTER_MAGE_SPELL_IDS],
    spellMastery: {},
    weapons: [],
    condition: 'active',
    notes: 'Mago base (valor inicial 0 · Nivel 1)',
    resistances: '',
  },
  {
    id: 'char_maniqui',
    name: 'Maniquí de pruebas',
    kind: 'npc',
    characterLevel: 1,
    progressionHistory: [],
    stats: { fisico: 1, manipulacion: 1, influencia: 1 },
    statPoints: { fisico: 0, manipulacion: 0, influencia: 0 },
    hp: { current: 30, max: 30 },
    mana: { current: 20, max: 20 },
    knownSpells: [...STARTER_NPC_SPELL_IDS],
    spellMastery: {},
    weapons: [],
    condition: 'active',
    notes: 'Maniquí de pruebas para testear ataques, defensas y hechizos',
    resistances: '',
  },
];

export function generateId(prefix = 'id_'): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createWeaponFromPreset(presetId: string): CharacterWeapon | null {
  const preset = WEAPON_PRESETS.find((w) => w.id === presetId);
  if (!preset) return null;
  return {
    id: generateId('wpn_'),
    presetId: preset.id,
    name: preset.name,
    category: preset.category,
    dice: preset.dice.map((d) => ({ ...d })),
    isMagicalCatalyst: Boolean(preset.isMagicalCatalyst),
    catalystKind: preset.catalystKind,
    addsManipulacionLevel: preset.addsManipulacionLevel,
    addsInfluenciaLevel: preset.addsInfluenciaLevel,
    reducesDefenseManaBy: preset.reducesDefenseManaBy,
    canExpandWithMana: preset.canExpandWithMana,
    isNatural: preset.isNatural,
    imbued: null,
    destroyed: false,
  };
}

export function getEffectiveDefenseManaCost(
  character: Character | undefined,
  spell: Spell,
  isDisarmed = false
): { cost: number; discount: number; shieldName?: string } {
  const baseCost = Math.max(0, spell.manaCost || 0);
  if (
    isDisarmed ||
    (spell.effectType !== 'defense' && spell.id !== 'basic_proteccion') ||
    !character ||
    baseCost === 0
  ) {
    return { cost: baseCost, discount: 0 };
  }
  const activeShield = (character.weapons || []).find(
    (w) => !w.destroyed && (w.reducesDefenseManaBy || 0) > 0
  );
  if (!activeShield) return { cost: baseCost, discount: 0 };
  const reduction = activeShield.reducesDefenseManaBy || 0;
  const finalCost = Math.max(0, baseCost - reduction);
  return {
    cost: finalCost,
    discount: baseCost - finalCost,
    shieldName: activeShield.name,
  };
}

export function getWeaponDamageFormula(
  weapon: CharacterWeapon,
  character: Character | undefined
): {
  dice: DamageDie[];
  bonus: number;
  damageKind: DamageKind;
  text: string;
} {
  const manipLvl = character?.stats.manipulacion ?? 0;
  const infLvl = character?.stats.influencia ?? 0;

  let beastBonus = 0;
  if (weapon.presetId.startsWith('beast_natural:')) {
    const parsed = Number(weapon.presetId.split(':')[1]);
    if (!Number.isNaN(parsed)) {
      beastBonus = parsed;
    }
  }

  const bonus =
    (weapon.addsManipulacionLevel ? manipLvl : 0) +
    (weapon.addsInfluenciaLevel ? infLvl : 0) +
    beastBonus;

  const damageKind: DamageKind =
    weapon.imbued || weapon.isMagicalCatalyst ? 'magico' : 'fisico';

  const diceStr = weapon.dice.map((d) => `${d.count}${d.type}`).join(' + ');
  const bonusParts: string[] = [];
  if (weapon.addsInfluenciaLevel) bonusParts.push(`Inf ${infLvl}`);
  if (weapon.addsManipulacionLevel) bonusParts.push(`Man ${manipLvl}`);
  if (beastBonus !== 0) bonusParts.push(`Bestia ${beastBonus > 0 ? `+${beastBonus}` : beastBonus}`);

  const text =
    diceStr +
    (bonus !== 0 ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : '') +
    (bonusParts.length > 0 ? ` (${bonusParts.join(' + ')})` : '');

  return {
    dice: weapon.dice,
    bonus,
    damageKind,
    text: text || 'Sin daño directo',
  };
}

export function isSonicSpell(
  spell: Pick<Spell, 'name' | 'orders' | 'damage'>
): boolean {
  const normalized = [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(proyeccion sonora|sonico|sonora|sonoro|vibracion de ondas|estruendo|resonancia|pulso acustico|reverberacion|ultrasonido|onda expansiva sonora)\b/.test(
    normalized
  );
}

export function getEffectiveSpellDamageKind(spell: Spell): DamageKind {
  if (isSonicSpell(spell)) return 'magico';
  if (spell.damageKind === 'fisico') return 'fisico';
  return 'magico';
}

export function isSpellMagical(spell: Spell): boolean {
  if (isSonicSpell(spell)) return true;
  if (spell.effectType === 'damage') {
    return getEffectiveSpellDamageKind(spell) === 'magico';
  }
  if (spell.id === 'basic_esquiva_fisica' || spell.damageKind === 'fisico') {
    return false;
  }
  if (
    spell.manaCost > 0 ||
    spell.castStat !== 'none' ||
    spell.effectType === 'heal' ||
    spell.effectType === 'effect' ||
    (spell.statuses && spell.statuses.length > 0) ||
    spell.combatStats.includes('manipulacion') ||
    spell.combatStats.includes('influencia')
  ) {
    return true;
  }
  return false;
}

export type SpellCategory = 'damage' | 'defense' | 'heal' | 'buff' | 'debuff' | 'effect';

export const SPELL_CATEGORY_LABELS: Record<SpellCategory, string> = {
  damage: 'Ataque',
  defense: 'Defensa',
  heal: 'Curación',
  buff: 'Buff',
  debuff: 'Debuff',
  effect: 'Efecto',
};

export function getEffectiveEffectSubType(spell: Spell): EffectSubType {
  if (spell.armorConfig?.isArmor) return 'buff';
  if (
    spell.effectSubType === 'buff' ||
    spell.effectSubType === 'debuff' ||
    spell.effectSubType === 'general'
  ) {
    return spell.effectSubType;
  }
  if (spell.statuses && spell.statuses.length > 0) return 'debuff';
  return 'general';
}

export function getSpellCategory(spell: Spell): SpellCategory {
  if (spell.effectType === 'damage') return 'damage';
  if (spell.effectType === 'defense') return 'defense';
  if (spell.effectType === 'heal') return 'heal';
  const sub = getEffectiveEffectSubType(spell);
  if (sub === 'buff') return 'buff';
  if (sub === 'debuff') return 'debuff';
  return 'effect';
}

export function parseDurationTurns(
  spell: Pick<Spell, 'duration' | 'durationTurns'>
): number | undefined {
  if (typeof spell.durationTurns === 'number' && Number.isFinite(spell.durationTurns) && spell.durationTurns > 0) {
    return Math.floor(spell.durationTurns);
  }
  const raw = (spell.duration || '').trim().toLowerCase();
  const match = raw.match(/^(\d+)\s*(turno|turnos|ronda|rondas|t)\b/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val > 0) return val;
  }
  return undefined;
}

export function formatTurnDuration(turns?: number): string {
  if (!turns || turns <= 0) return '';
  return turns === 1 ? '1 turno' : `${turns} turnos`;
}

export const SONIC_BASE_ORDER = 'Proyección sonora';

export const SONIC_ORDERS: string[] = [
  'Proyección sonora',
  'Vibración de ondas',
  'Estruendo',
  'Onda expansiva sonora',
  'Resonancia',
  'Pulso acústico',
  'Eco / Reverberación',
  'Frecuencia / Ultrasonido',
];

export function doesCharacterControlSonic(
  character: Character | undefined,
  spells: Spell[] = []
): boolean {
  if (!character) return false;
  const natureNorm = (character.nature || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/\b(sonico|sonora|sonoro|sonido|ondas?|estruendo|acustic\w*)\b/.test(natureNorm)) {
    return true;
  }
  const knownIds = new Set(character.knownSpells || []);
  return spells.some(
    (sp) =>
      knownIds.has(sp.id) &&
      !sp.isBasic &&
      sp.orders.some((ord) =>
        /\b(sonora|sonoro|sonico|ondas|estruendo|resonancia|acustico|ultrasonido)\b/.test(
          ord
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
        )
      )
  );
}

export function doesCharacterControlEarth(
  character: Character | undefined,
  spells: Spell[] = []
): boolean {
  if (!character) return false;
  const natureRaw = (character.nature || '').toLowerCase();
  if (/\b(tierra|roca|piedra|arena|mineral|geomanc\w*)\b/i.test(natureRaw)) {
    return true;
  }
  const knownIds = new Set(character.knownSpells || []);
  return spells.some(
    (sp) =>
      knownIds.has(sp.id) &&
      !sp.isBasic &&
      sp.orders.some((ord) => /\b(tierra|roca)\b/i.test(ord))
  );
}

export function getDefaultArmorElementForCharacter(
  character: Character | undefined,
  spells: Spell[] = []
): string {
  if (!character) return 'Arcano';
  if (doesCharacterControlEarth(character, spells)) return 'Tierra';
  const nature = (character.nature || '').trim();
  if (!nature) return 'Arcano';
  if (/transformaci[oó]n|cuerpo reforzado/i.test(nature)) return 'Arcano';
  const primary = nature.split('/')[0]?.trim();
  return primary || 'Arcano';
}

export const MAX_BURN_STACKS = 10;
export const BURN_DURATION_TURNS = 2;
export const MAX_ELEMENTAL_STACKS = 10;

export const DISPEL_SCOPE_LABELS: Record<DispelTargetScope, string> = {
  armor: 'Armaduras y escudos (ej. Armadura de Tierra)',
  buffs: 'Buffs enemigos (hechizos por turno)',
  debuffs: 'Debuffs y estados negativos',
  all_magical: 'Todos los efectos mágicos',
  any: 'Cualquier efecto activo',
};

export interface ElementalStatusMeta {
  kind: ElementalStatusKind;
  name: string;
  defaultDuration: number;
  defaultTickDie?: DieType;
  defaultDamageKind: DamageKind;
  defaultTrigger: 'max_die' | 'upper_half' | 'always';
  triggerLabel: string;
  description: string;
}

export const ELEMENTAL_STATUS_META: Record<ElementalStatusKind, ElementalStatusMeta> = {
  burn: {
    kind: 'burn',
    name: 'Quemadura',
    defaultDuration: 2,
    defaultTickDie: 'd4',
    defaultDamageKind: 'magico',
    defaultTrigger: 'max_die',
    triggerLabel: 'Dado máximo (o cargas fijas)',
    description: 'Daño de fuego continuo al inicio del turno (1d4/carga). Puede detonarse.',
  },
  poison: {
    kind: 'poison',
    name: 'Envenenado',
    defaultDuration: 3,
    defaultTickDie: 'd4',
    defaultDamageKind: 'magico',
    defaultTrigger: 'upper_half',
    triggerLabel: '50% (mitad positiva del dado)',
    description: 'Daño tóxico continuo al inicio del turno (1d4/carga). Puede drenarse/sifonarse.',
  },
  frozen: {
    kind: 'frozen',
    name: 'Congelado',
    defaultDuration: 2,
    defaultTickDie: 'd4',
    defaultDamageKind: 'magico',
    defaultTrigger: 'upper_half',
    triggerLabel: '50% (mitad positiva del dado)',
    description: 'Escarcha y daño de frío continuo (1d4/carga). Vulnerable a quebrarse.',
  },
  electrified: {
    kind: 'electrified',
    name: 'Electrificado',
    defaultDuration: 3,
    defaultTickDie: undefined,
    defaultDamageKind: 'magico',
    defaultTrigger: 'always',
    triggerLabel: '100% al atacar con rayo',
    description: 'Antena conductora: al atacar con rayo a otro objetivo, los Electrificados reciben daño de expansión.',
  },
  bleeding: {
    kind: 'bleeding',
    name: 'Sangrando',
    defaultDuration: 3,
    defaultTickDie: 'd4',
    defaultDamageKind: 'fisico',
    defaultTrigger: 'always',
    triggerLabel: '100% en cortes / ataques cortantes',
    description: 'Hemorragia continua al inicio del turno (1d4 físico/carga). Puede desgarrarse.',
  },
};

export const SYNERGY_LABELS: Record<SynergyReactionType, string> = {
  none: 'Sin sinergia / reacción especial',
  detonate_burn: 'Detonar Quemadura (consume 1 carga por defecto → 1d6 mágico/carga)',
  siphon_poison: 'Sifonar Envenenado (consume 1 carga por defecto → 1d4 + cura PV y Maná)',
  shatter_frozen: 'Quebrar Congelado (consume 1 carga por defecto → 1d8 físico/carga)',
  overload_electrified: 'Descargar Antena Eléctrica (consume 1 carga por objetivo → 1d6 mágico/carga)',
  hemorrhage_bleed: 'Desgarrar Sangrado (consume 1 carga por defecto → 1d6 físico/carga)',
};

/**
 * Devuelve cuántas cargas se consumen en una reacción de sinergia.
 * Regla base: solo se consume 1 carga por efecto, a menos que el hechizo indique otra cantidad (o 'all').
 */
export function getSynergyConsumeCount(
  availableStacks: number,
  configured?: number | 'all'
): number {
  if (availableStacks <= 0) return 0;
  if (configured === 'all') return availableStacks;
  const requested = typeof configured === 'number' && configured >= 1 ? Math.floor(configured) : 1;
  return Math.min(availableStacks, requested);
}

/**
 * Consume N cargas de un estado elemental retirando primero las cargas con menor duración restante.
 */
export function consumeElementalStacks(
  existingStacks: number[],
  consumeCount: number
): number[] {
  const valid = existingStacks.filter((t) => t > 0);
  if (consumeCount <= 0) return valid;
  if (consumeCount >= valid.length) return [];
  const sortedAsc = [...valid].sort((a, b) => a - b);
  return sortedAsc.slice(consumeCount);
}

export const AREA_MODE_LABELS: Record<
  NonNullable<Spell['areaConfig']>['mode'],
  string
> = {
  area_selected: 'Área libre / Selección múltiple (ej. Bola de Fuego)',
  all_enemies: 'Todos los enemigos en combate',
  all_electrified: 'Cadena / Arco Voltaico (todos los Electrificados)',
  all_with_status: 'Todos los objetivos con un estado específico',
};

export function formatSpellAreaSummary(area?: Spell['areaConfig']): string {
  if (!area?.enabled) return '';
  const maxText = area.maxTargets && area.maxTargets > 0 ? ` · máx. ${area.maxTargets}` : '';
  const shapeText = area.shapeNote?.trim() ? ` (${area.shapeNote.trim()})` : '';
  if (area.mode === 'all_electrified') {
    return `Área: Electrificados${maxText}${shapeText}`;
  }
  if (area.mode === 'all_with_status') {
    const stName = area.requiredStatusName?.trim() || 'estado';
    return `Área: con ${stName}${maxText}${shapeText}`;
  }
  if (area.mode === 'all_enemies') {
    return `Área: todos los enemigos${maxText}${shapeText}`;
  }
  return `Área múltiple${maxText}${shapeText}`;
}

export function resolveSpellAreaTargets(params: {
  spell: Spell;
  attackerCharacterId: string;
  combatants: Combatant[];
  characters: Character[];
  primaryTargetId?: string;
}): { targetIds: string[]; label: string; emptyConditionReason?: string } {
  const { spell, attackerCharacterId, combatants, characters, primaryTargetId } = params;
  const area = spell.areaConfig;
  const otherCbs = combatants.filter((cb) => cb.characterId !== attackerCharacterId);

  if (!area?.enabled) {
    const primary =
      otherCbs.find((cb) => cb.id === primaryTargetId) || otherCbs[0];
    return {
      targetIds: primary ? [primary.id] : [],
      label: '',
    };
  }

  const attackerChar = characters.find((c) => c.id === attackerCharacterId);
  const attackerIsBot = Boolean(attackerChar?.isBotPreset);
  const enemiesOnly = otherCbs.filter((cb) => {
    const ch = characters.find((c) => c.id === cb.characterId);
    if (!ch) return false;
    if (ch.condition === 'dead') return false;
    // Si hay bots y jugadores mezclados, priorizar bando contrario
    const hasBots = combatants.some((c) => {
      const cc = characters.find((x) => x.id === c.characterId);
      return Boolean(cc?.isBotPreset);
    });
    if (hasBots) {
      return Boolean(ch.isBotPreset) !== attackerIsBot;
    }
    return true;
  });
  const basePool = enemiesOnly.length > 0 ? enemiesOnly : otherCbs;

  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  let matched: Combatant[] = [];
  let emptyConditionReason: string | undefined;

  if (area.mode === 'all_electrified') {
    matched = otherCbs.filter((cb) =>
      (cb.activeStatuses || []).some((st) => getStatusElementalKind(st) === 'electrified')
    );
    if (matched.length === 0) {
      emptyConditionReason = 'No hay enemigos con el estado Electrificado actualmente.';
    }
  } else if (area.mode === 'all_with_status') {
    const req = norm(area.requiredStatusName || '');
    matched = req
      ? otherCbs.filter((cb) =>
          (cb.activeStatuses || []).some((st) => norm(st.name).includes(req))
        )
      : basePool;
    if (matched.length === 0 && req) {
      emptyConditionReason = `No hay objetivos con el estado «${area.requiredStatusName}».`;
    }
  } else {
    // area_selected o all_enemies
    matched = [...basePool];
  }

  // Poner el objetivo principal primero si forma parte del conjunto
  if (primaryTargetId) {
    const idx = matched.findIndex((cb) => cb.id === primaryTargetId);
    if (idx > 0) {
      const [first] = matched.splice(idx, 1);
      matched.unshift(first);
    }
  }

  const maxLimit =
    typeof area.maxTargets === 'number' && area.maxTargets > 0
      ? Math.floor(area.maxTargets)
      : 0;
  const finalList = maxLimit > 0 ? matched.slice(0, maxLimit) : matched;

  const baseLabel = formatSpellAreaSummary(area);
  const label = `${baseLabel} · ${finalList.length} ${finalList.length === 1 ? 'objetivo' : 'objetivos'}`;

  return {
    targetIds: finalList.map((cb) => cb.id),
    label,
    emptyConditionReason,
  };
}

function normalizeSpellSearchText(
  spell: Pick<Spell, 'name' | 'orders' | 'damage' | 'effectDescription'>
): string {
  return [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
    spell.effectDescription || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isFireDamageSpell(
  spell: Pick<Spell, 'name' | 'orders' | 'effectType' | 'damage' | 'elementalStatus'>
): boolean {
  if (spell.elementalStatus?.kind === 'burn') return true;
  if (spell.effectType !== 'damage') return false;
  const normalized = [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(fuego|llamas?|igne[oa]s?|incend\w*|piro\w*|quemad\w*|llamarad\w*|brasas?|magma|lava)\b/.test(
    normalized
  );
}

export function isPoisonDamageSpell(
  spell: Pick<Spell, 'name' | 'orders' | 'effectType' | 'damage' | 'elementalStatus'>
): boolean {
  if (spell.elementalStatus?.kind === 'poison') return true;
  if (spell.effectType !== 'damage') return false;
  const normalized = [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(venen\w*|envenen\w*|toxic\w*|ponzon\w*|acid\w*|corro\w*|esporas?)\b/.test(normalized);
}

export function isIceDamageSpell(
  spell: Pick<Spell, 'name' | 'orders' | 'effectType' | 'damage' | 'elementalStatus'>
): boolean {
  if (spell.elementalStatus?.kind === 'frozen') return true;
  if (spell.effectType !== 'damage') return false;
  const normalized = [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(hielo|congel\w*|fri[oa]s?|escarch\w*|glacial\w*|ventisca|crio\w*|helad\w*)\b/.test(
    normalized
  );
}

export function isElectricDamageSpell(
  spell: Pick<Spell, 'name' | 'orders' | 'effectType' | 'damage' | 'elementalStatus'>
): boolean {
  if (spell.elementalStatus?.kind === 'electrified') return true;
  if (spell.effectType !== 'damage') return false;
  const normalized = [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(rayo|rayos|electr\w*|relampag\w*|voltaic\w*|trueno|chispa|tempest\w*|tormenta)\b/.test(
    normalized
  );
}

export function isBleedingDamageSpell(
  spell: Pick<Spell, 'name' | 'orders' | 'effectType' | 'damage' | 'elementalStatus'>
): boolean {
  if (spell.elementalStatus?.kind === 'bleeding') return true;
  if (spell.effectType !== 'damage') return false;
  const normalized = [
    spell.name || '',
    ...(spell.orders || []),
    spell.damage?.notes || '',
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(sangr\w*|cortant\w*|corte|cortes|tajo|filo|hemomanc\w*|hemorrag\w*|zarpazo|garras|desgarr\w*|cuchill\w*)\b/.test(
    normalized
  );
}

export function detectSpellSynergy(spell: Spell): SynergyReactionType {
  if (spell.synergyReaction && spell.synergyReaction !== 'none') {
    return spell.synergyReaction;
  }
  const ordersLower = (spell.orders || []).map((o) =>
    o
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );
  const text = normalizeSpellSearchText(spell);
  if (
    ordersLower.some((o) => o.includes('detonar')) ||
    /\b(detonar|detonacion)\b/.test(text)
  ) {
    return 'detonate_burn';
  }
  if (
    ordersLower.some(
      (o) =>
        o === 'drenar' ||
        o.includes('drenar vitalidad') ||
        o.includes('sifon vital') ||
        o.includes('sifonar mana')
    ) ||
    /\b(sifonar|sifon|drenar veneno)\b/.test(text)
  ) {
    return 'siphon_poison';
  }
  return 'none';
}

export function mergeElementalStacks(
  existingStacks: number[],
  addedCount: number,
  durationTurns: number,
  maxStacks = MAX_ELEMENTAL_STACKS
): number[] {
  const safeDur = Math.max(1, Math.floor(durationTurns || 2));
  const next = existingStacks.filter((t) => t > 0).slice(0, maxStacks);
  const toAdd = Math.max(0, Math.floor(addedCount));
  for (let i = 0; i < toAdd; i++) {
    if (next.length < maxStacks) {
      next.push(safeDur);
    } else {
      let minIdx = 0;
      for (let j = 1; j < next.length; j++) {
        if (next[j] < next[minIdx]) minIdx = j;
      }
      if (next[minIdx] < safeDur) {
        next[minIdx] = safeDur;
      }
    }
  }
  return next;
}

export function mergeBurnStacks(existingStacks: number[], addedCount: number): number[] {
  return mergeElementalStacks(existingStacks, addedCount, BURN_DURATION_TURNS, MAX_BURN_STACKS);
}

export function getStatusElementalKind(st: ActiveStatus): ElementalStatusKind | undefined {
  if (st.elementalKind) return st.elementalKind;
  if (Array.isArray(st.burnStackTurns) && st.burnStackTurns.length > 0) return 'burn';
  const low = (st.name || '').toLowerCase();
  if (low === 'quemadura') return 'burn';
  if (low === 'envenenado') return 'poison';
  if (low === 'congelado') return 'frozen';
  if (low === 'electrificado') return 'electrified';
  if (low === 'sangrando') return 'bleeding';
  return undefined;
}

export function getStatusStackTurns(st: ActiveStatus): number[] {
  if (Array.isArray(st.burnStackTurns) && st.burnStackTurns.length > 0) {
    return st.burnStackTurns;
  }
  if (Array.isArray(st.stackTurns) && st.stackTurns.length > 0) {
    return st.stackTurns;
  }
  return [];
}

export function matchesDispelScope(st: ActiveStatus, scope: DispelTargetScope): boolean {
  const lowName = (st.name || '').toLowerCase();
  const isArmor =
    (st.armorReduction || 0) > 0 ||
    (st.armorDivisor !== undefined && st.armorDivisor !== 1) ||
    typeof st.maxHits === 'number' ||
    lowName.includes('armadura') ||
    lowName.includes('escudo') ||
    lowName.includes('barrera');
  const isBuff = st.kind === 'buff' || isArmor || Boolean(st.isReinforceBuff);
  const isDebuff =
    st.kind === 'debuff' ||
    st.kind === 'status' ||
    Boolean(getStatusElementalKind(st)) ||
    Boolean(st.collateralConfig);

  switch (scope) {
    case 'armor':
      return isArmor;
    case 'buffs':
      return isBuff;
    case 'debuffs':
      return isDebuff;
    case 'all_magical':
      return st.isMagical !== false;
    case 'any':
    default:
      return true;
  }
}

export function getCharacterLevel(character: Character | undefined): number {
  if (!character) return 1;
  return Math.max(1, Math.floor(character.characterLevel ?? 1));
}

export function formatCollateralValue(
  col: Pick<CollateralDamageConfig, 'mode' | 'fixedAmount' | 'dice' | 'bonus'>
): string {
  if (col.mode === 'fixed') {
    return `${Math.max(0, col.fixedAmount || 0)} daño`;
  }
  const diceStr =
    (col.dice || [])
      .filter((d) => d.count > 0)
      .map((d) => `${d.count}${d.type}`)
      .join(' + ') || '1d4';
  const b = col.bonus || 0;
  return b > 0 ? `${diceStr} + ${b}` : diceStr;
}

export function getSpellCastRequirement(spell: Spell): SpellCastRequirement {
  if (
    spell.castRequirement === 'none' ||
    spell.castRequirement === 'prepare' ||
    spell.castRequirement === 'conditional'
  ) {
    return spell.castRequirement;
  }
  if (
    spell.id === 'basic_golpe_fisico' ||
    spell.id === 'basic_ataque_canalizado' ||
    spell.name.startsWith('Impacto Canalizado') ||
    spell.damageKind === 'fisico'
  ) {
    return 'none';
  }
  if (spell.effectType === 'damage') {
    if (
      spell.castStat !== 'none' ||
      (spell.duration &&
        spell.duration.trim() !== '' &&
        spell.duration.toLowerCase() !== 'instantáneo' &&
        spell.duration.toLowerCase() !== '1 golpe')
    ) {
      return 'prepare';
    }
    return 'none';
  }
  return spell.castStat !== 'none' ? 'prepare' : 'none';
}

export function spellAllowsDirectCastButton(spell: Spell): boolean {
  const req = getSpellCastRequirement(spell);
  return req === 'prepare' || req === 'conditional';
}

export function buildMageSignatureSpells(params: {
  charId: string;
  natureId: string;
  customNatureLabel?: string;
  physicalVariant: MagePhysicalVariant;
  customPhysicalName?: string;
}): {
  natureLabel: string;
  createdSpells: Spell[];
  replaceBasicAttackId: boolean;
  replaceBasicPhysicalId: boolean;
} {
  const preset =
    MAGE_NATURES.find((n) => n.id === params.natureId) ||
    MAGE_NATURES.find((n) => n.id === 'arcano') ||
    MAGE_NATURES[0];
  const natureLabel =
    params.natureId === 'personalizada'
      ? params.customNatureLabel?.trim() || 'Personalizado'
      : preset.label;
  const shortElement = natureLabel.split('/')[0].trim();

  const createdSpells: Spell[] = [];

  const canalizadoSpell: Spell = {
    id: generateId('sp_'),
    name: `Impacto Canalizado (${shortElement})`,
    manaCost: 1,
    orders: preset.orders,
    statuses: [],
    ownerCharacterId: params.charId,
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    damage: {
      dice: [{ type: 'd4', count: 1 }],
      bonus: 0,
      notes:
        params.natureId === 'personalizada'
          ? `${shortElement.toLowerCase()} mágico a distancia`
          : `${preset.damageNote} (mágico)`,
    },
    effectDescription: `Ataque mágico base a distancia de ${natureLabel} (1d4 mágico). Se lanza directo sin casteo previo.`,
    duration: 'Instantáneo',
    isBasic: false,
  };
  createdSpells.push(canalizadoSpell);

  let replaceBasicPhysicalId = false;
  if (params.physicalVariant !== 'golpe_fisico') {
    const variant = PHYSICAL_VARIANTS[params.physicalVariant];
    const physName =
      params.physicalVariant === 'personalizado'
        ? params.customPhysicalName?.trim() || variant.spellName
        : variant.spellName;
    const physSpell: Spell = {
      id: generateId('sp_'),
      name: physName,
      manaCost: 0,
      orders: variant.orders,
      statuses: [],
      ownerCharacterId: params.charId,
      castRequirement: 'none',
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: ['fisico'],
      damageMode: 'auto',
      effectType: 'damage',
      damageKind: 'fisico',
      damage: {
        dice: [{ type: 'd4', count: 1 }],
        bonus: 0,
        notes: variant.notes,
      },
      effectDescription: `${variant.description} (Reemplaza a Golpe Físico por naturaleza ${natureLabel}).`,
      duration: 'Instantáneo',
      isBasic: false,
    };
    createdSpells.push(physSpell);
    replaceBasicPhysicalId = true;
  }

  return {
    natureLabel,
    createdSpells,
    replaceBasicAttackId: true,
    replaceBasicPhysicalId,
  };
}

export function isSignatureCanalizadoSpell(spell: Spell): boolean {
  return !spell.isBasic && spell.name.trim().startsWith('Impacto Canalizado (');
}

export function isSignaturePhysicalSpell(spell: Spell): boolean {
  return (
    !spell.isBasic &&
    (spell.effectDescription || '').includes('(Reemplaza a Golpe Físico por naturaleza ')
  );
}

export function characterHasNatureCanalizado(
  character: Character | undefined,
  spells: Spell[]
): boolean {
  if (!character) return false;
  const known = new Set(character.knownSpells || []);
  return spells.some(
    (s) =>
      isSignatureCanalizadoSpell(s) &&
      (s.ownerCharacterId === character.id || known.has(s.id))
  );
}

export function getMageStarterBasicIds(character: Character, spells: Spell[]): string[] {
  const existingSet = new Set(spells.map((s) => s.id));
  const knownSet = new Set(character.knownSpells || []);
  const shortNature = (character.nature || '').split('/')[0].trim().toLowerCase();

  const ownedCanalizados = spells.filter(
    (s) => isSignatureCanalizadoSpell(s) && s.ownerCharacterId === character.id
  );
  const preferredCanalizado =
    ownedCanalizados.find(
      (s) => shortNature && s.name.toLowerCase() === `impacto canalizado (${shortNature})`
    ) ||
    ownedCanalizados.find((s) => knownSet.has(s.id)) ||
    ownedCanalizados[0];

  const ownedPhysicals = spells.filter(
    (s) => isSignaturePhysicalSpell(s) && s.ownerCharacterId === character.id
  );
  const preferredPhysical =
    character.physicalVariant && character.physicalVariant !== 'golpe_fisico'
      ? ownedPhysicals.find((s) => knownSet.has(s.id)) || ownedPhysicals[0]
      : undefined;

  const result: string[] = [];
  if (preferredCanalizado) {
    result.push(preferredCanalizado.id);
  }
  if (preferredPhysical) {
    result.push(preferredPhysical.id);
  }

  for (const id of STARTER_MAGE_SPELL_IDS) {
    if (!existingSet.has(id)) continue;
    if (id === 'basic_ataque_canalizado' && preferredCanalizado) continue;
    if (id === 'basic_golpe_fisico' && preferredPhysical) continue;
    result.push(id);
  }

  return [...new Set(result)];
}

export function sanitizeSignatureSpellsState(
  rawSpells: Spell[],
  rawCharacters: Character[]
): { spells: Spell[]; characters: Character[] } {
  // 1. Deduplicar hechizos por ID exacto
  const seenIds = new Set<string>();
  const workingSpells: Spell[] = [];
  for (const sp of rawSpells) {
    if (!sp || !sp.id || seenIds.has(sp.id)) continue;
    seenIds.add(sp.id);
    workingSpells.push({ ...sp });
  }

  const validCharIds = new Set(rawCharacters.map((c) => c.id));
  const workingChars: Character[] = rawCharacters.map((c) => ({
    ...c,
    knownSpells: Array.isArray(c.knownSpells) ? [...c.knownSpells] : [],
    spellMastery: c.spellMastery && typeof c.spellMastery === 'object' ? { ...c.spellMastery } : {},
  }));

  const removeSpellIds = new Set<string>();
  const clonedSpellsToAdd: Spell[] = [];

  // 2. Corregir hechizos firma (Impacto Canalizado (...) o variante física) huérfanos o sin dueño
  for (const sp of workingSpells) {
    if (!isSignatureCanalizadoSpell(sp) && !isSignaturePhysicalSpell(sp)) continue;
    if (sp.ownerCharacterId && validCharIds.has(sp.ownerCharacterId)) continue;

    const knowers = workingChars.filter((c) => c.knownSpells.includes(sp.id));
    if (knowers.length === 0) {
      removeSpellIds.add(sp.id);
    } else if (knowers.length === 1) {
      sp.ownerCharacterId = knowers[0].id;
    } else {
      // Si varios personajes compartían el mismo hechizo firma sin dueño, aislar una copia por personaje
      sp.ownerCharacterId = knowers[0].id;
      for (let i = 1; i < knowers.length; i++) {
        const knower = knowers[i];
        const clonedId = generateId('sp_');
        clonedSpellsToAdd.push({
          ...sp,
          id: clonedId,
          ownerCharacterId: knower.id,
        });
        knower.knownSpells = knower.knownSpells.map((id) => (id === sp.id ? clonedId : id));
        if (knower.spellMastery && knower.spellMastery[sp.id]) {
          knower.spellMastery[clonedId] = knower.spellMastery[sp.id];
          delete knower.spellMastery[sp.id];
        }
      }
    }
  }

  const allSpells = [
    ...workingSpells.filter((s) => !removeSpellIds.has(s.id)),
    ...clonedSpellsToAdd,
  ];

  // 3. Por cada personaje, colapsar duplicados de Impacto Canalizado (...) y variantes físicas
  const remapByChar = new Map<string, Map<string, string>>();
  const finalRemoveIds = new Set<string>();

  const dedupeCharSignatureGroup = (
    char: Character,
    groupSpells: Spell[],
    matchNatureName?: string
  ) => {
    if (groupSpells.length === 0) return;
    const knownSet = new Set(char.knownSpells);
    const byName = new Map<string, Spell[]>();
    for (const sp of groupSpells) {
      const key = sp.name.trim().toLowerCase();
      const arr = byName.get(key) || [];
      arr.push(sp);
      byName.set(key, arr);
    }

    const charRemap = remapByChar.get(char.id) || new Map<string, string>();
    const canonicalPerName: Spell[] = [];

    for (const copies of byName.values()) {
      // Elegir la mejor copia: primero la aprendida, luego la de mayor maestría
      const sorted = [...copies].sort((a, b) => {
        const aKnown = knownSet.has(a.id) ? 1 : 0;
        const bKnown = knownSet.has(b.id) ? 1 : 0;
        if (aKnown !== bKnown) return bKnown - aKnown;
        const aMast = char.spellMastery?.[a.id] || 0;
        const bMast = char.spellMastery?.[b.id] || 0;
        return bMast - aMast;
      });
      const keep = sorted[0];
      canonicalPerName.push(keep);
      for (let i = 1; i < sorted.length; i++) {
        const dup = sorted[i];
        charRemap.set(dup.id, keep.id);
        finalRemoveIds.add(dup.id);
      }
    }

    // Eliminar hechizos firma no aprendidos que quedaron colgados de cambios previos de naturaleza
    const learnedCanonicals = canonicalPerName.filter((s) => knownSet.has(s.id));
    if (learnedCanonicals.length > 0) {
      for (const sp of canonicalPerName) {
        if (!knownSet.has(sp.id)) {
          finalRemoveIds.add(sp.id);
        }
      }
    } else if (canonicalPerName.length > 1) {
      const preferred =
        (matchNatureName
          ? canonicalPerName.find((s) => s.name.trim().toLowerCase() === matchNatureName)
          : undefined) || canonicalPerName[canonicalPerName.length - 1];
      for (const sp of canonicalPerName) {
        if (sp.id !== preferred.id) {
          finalRemoveIds.add(sp.id);
        }
      }
    }

    remapByChar.set(char.id, charRemap);
  };

  for (const char of workingChars) {
    const shortNature = (char.nature || '').split('/')[0].trim().toLowerCase();
    const expectedCanalizadoName = shortNature
      ? `impacto canalizado (${shortNature})`
      : undefined;

    const charCanalizados = allSpells.filter(
      (s) => s.ownerCharacterId === char.id && isSignatureCanalizadoSpell(s)
    );
    dedupeCharSignatureGroup(char, charCanalizados, expectedCanalizadoName);

    const charPhysicals = allSpells.filter(
      (s) => s.ownerCharacterId === char.id && isSignaturePhysicalSpell(s)
    );
    dedupeCharSignatureGroup(char, charPhysicals);
  }

  const finalSpells = allSpells.filter((s) => !finalRemoveIds.has(s.id));
  const finalSpellMap = new Map(finalSpells.map((s) => [s.id, s]));

  // 4. Actualizar knownSpells y spellMastery de cada personaje y quitar duplicados genéricos
  const finalCharacters = workingChars.map((char) => {
    const charRemap = remapByChar.get(char.id);
    const nextMastery: Record<string, number> = {};
    for (const [spId, val] of Object.entries(char.spellMastery || {})) {
      const mapped = charRemap?.get(spId) || spId;
      if (!finalSpellMap.has(mapped)) continue;
      nextMastery[mapped] = Math.max(nextMastery[mapped] || 0, val);
    }

    let nextKnown = [
      ...new Set(
        char.knownSpells
          .map((id) => charRemap?.get(id) || id)
          .filter((id) => finalSpellMap.has(id))
      ),
    ];

    const hasLearnedSignatureCanalizado = nextKnown.some((id) => {
      const sp = finalSpellMap.get(id);
      return Boolean(sp && isSignatureCanalizadoSpell(sp));
    });
    if (hasLearnedSignatureCanalizado) {
      nextKnown = nextKnown.filter((id) => id !== 'basic_ataque_canalizado');
    }

    const hasLearnedSignaturePhysical = nextKnown.some((id) => {
      const sp = finalSpellMap.get(id);
      return Boolean(sp && isSignaturePhysicalSpell(sp));
    });
    if (
      hasLearnedSignaturePhysical &&
      char.physicalVariant &&
      char.physicalVariant !== 'golpe_fisico'
    ) {
      nextKnown = nextKnown.filter((id) => id !== 'basic_golpe_fisico');
    }

    return {
      ...char,
      knownSpells: nextKnown,
      spellMastery: nextMastery,
    };
  });

  return { spells: finalSpells, characters: finalCharacters };
}


export function getStatMilestones(formula: FormulaConfig): number[] {
  return normalizeStatMilestones(formula.statMilestones);
}

export function calcStatLevelFromPoints(points: number, formula: FormulaConfig): number {
  const safePoints = Math.max(0, Math.floor(points || 0));
  const milestones = getStatMilestones(formula);
  let level = 1;
  for (let i = 1; i < milestones.length; i++) {
    if (safePoints >= milestones[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}
function getPointsForDesiredStatLevel(desiredLevel: number, formula?: FormulaConfig): number {
  const safeLevel = Math.max(1, Math.floor(desiredLevel || 1));
  if (!formula) return 0;
  const milestones = getStatMilestones(formula);
  const idx = safeLevel - 1;
  if (idx <= 0) return 0;
  return milestones[idx] ?? milestones[milestones.length - 1] ?? 0;
}
export function getStatLevelStatus(
  points: number,
  formula: FormulaConfig
): {
  points: number;
  level: number;
  currentThreshold: number;
  nextThreshold: number | null;
  progressPct: number;
} {
  const safePoints = Math.max(0, Math.floor(points || 0));
  const milestones = getStatMilestones(formula);
  const level = calcStatLevelFromPoints(safePoints, formula);
  const idx = level - 1;
  const currentThreshold = milestones[idx] ?? 0;
  const nextThreshold = idx + 1 < milestones.length ? milestones[idx + 1] : null;
  const span = nextThreshold !== null ? Math.max(1, nextThreshold - currentThreshold) : 1;
  const progressPct =
    nextThreshold === null
      ? 100
      : Math.max(0, Math.min(100, ((safePoints - currentThreshold) / span) * 100));
  return {
    points: safePoints,
    level,
    currentThreshold,
    nextThreshold,
    progressPct,
  };
}

export function getCharacterStatPoints(
  character: Character | undefined,
  stat: StatKey,
  formula: FormulaConfig
): number {
  if (!character) return 0;
  if (typeof character.statPoints?.[stat] === 'number') {
    return Math.max(0, character.statPoints[stat]);
  }
  const milestones = getStatMilestones(formula);
  const lvl = Math.max(1, character.stats[stat] ?? 1);
  return milestones[lvl - 1] ?? 0;
}

export function calcStatDice(level: number, formula: FormulaConfig): number {
  const raw = formula.base + level * formula.multiplier;
  return Math.max(0, Math.floor(raw));
}

export function getCharacterStatDice(
  character: Character | undefined,
  stat: StatKey,
  formula: FormulaConfig
): number {
  if (!character) return 0;
  return calcStatDice(character.stats[stat] ?? 0, formula);
}

export function getHighestCharacterStat(
  character: Character | undefined,
  formula: FormulaConfig
): { stat: StatKey; tiedStats: StatKey[]; dice: number } {
  if (!character) {
    return { stat: 'manipulacion', tiedStats: ['manipulacion'], dice: 0 };
  }
  const keys: StatKey[] = ['manipulacion', 'fisico', 'influencia'];
  let maxDice = -1;
  let tiedStats: StatKey[] = [];
  for (const k of keys) {
    const dice = getCharacterStatDice(character, k, formula);
    if (dice > maxDice) {
      maxDice = dice;
      tiedStats = [k];
    } else if (dice === maxDice) {
      tiedStats.push(k);
    }
  }
  return {
    stat: tiedStats[0] || 'manipulacion',
    tiedStats,
    dice: Math.max(0, maxDice),
  };
}

export function countRawD6Successes(rolls: number[]): number {
  let total = 0;
  for (const r of rolls) {
    if (r === 5) total += 1;
    else if (r === 6) total += 2;
  }
  return total;
}

export function getMasteryMilestones(formula: FormulaConfig): number[] {
  const norm = normalizeFormula(formula);
  if (norm.masteryGrowth === 'custom') {
    const cleaned = [...norm.masteryCustomMilestones];
    cleaned[0] = 0;
    for (let i = 1; i < cleaned.length; i++) {
      if (cleaned[i] < cleaned[i - 1]) {
        cleaned[i] = cleaned[i - 1] + 1;
      }
    }
    return cleaned;
  }

  const base = Math.max(1, norm.masteryBaseMilestone);
  if (norm.masteryGrowth === 'linear') {
    return [0, base, base * 2, base * 3, base * 4];
  }
  if (norm.masteryGrowth === 'stepped') {
    return [0, base, base * 3, base * 6, base * 10];
  }
  // 'double': 0, base, 2*base, 4*base, 8*base
  return [0, base, base * 2, base * 4, base * 8];
}

export function upgradeDieType(type: DieType, steps: number): DieType {
  if (steps <= 0) return type;
  const idx = DIE_TYPES.indexOf(type);
  if (idx === -1) return type;
  const nextIdx = Math.min(DIE_TYPES.length - 1, idx + steps);
  return DIE_TYPES[nextIdx];
}

export function upgradeDamageDice(dice: DamageDie[], steps: number): DamageDie[] {
  if (steps <= 0) return dice;
  return dice.map((d) => ({
    ...d,
    type: upgradeDieType(d.type, steps),
  }));
}

export function spellSupportsMastery(spell: Pick<Spell, 'id' | 'noMastery'>): boolean {
  return !spell.noMastery && spell.id !== 'basic_curar_heridas';
}

export function getEffectiveSpellDamageDice(
  spell: Spell,
  mastery: SpellMasteryStatus
): DamageDie[] {
  if (!spellSupportsMastery(spell) || spell.effectType !== 'damage' || mastery.dieUpgradeSteps <= 0) {
    return spell.damage.dice;
  }
  return upgradeDamageDice(spell.damage.dice, mastery.dieUpgradeSteps);
}

export function getSpellMasteryStatus(
  rawSuccesses: number,
  formula: FormulaConfig
): SpellMasteryStatus {
  const norm = normalizeFormula(formula);
  const successes = Math.max(0, Math.floor(rawSuccesses || 0));
  const milestones = getMasteryMilestones(norm);

  let level = 1;
  let currentThreshold = 0;
  let nextThreshold: number | null = null;

  if (norm.masteryGrowth === 'linear') {
    const step = Math.max(1, norm.masteryBaseMilestone);
    level = Math.floor(successes / step) + 1;
    currentThreshold = (level - 1) * step;
    nextThreshold = level * step;
  } else {
    for (let i = 1; i < milestones.length; i++) {
      if (successes >= milestones[i]) {
        level = i + 1;
      } else {
        break;
      }
    }
    currentThreshold = milestones[level - 1] ?? 0;
    nextThreshold = level < milestones.length ? milestones[level] : null;
  }

  const isMaxLevel = nextThreshold === null;
  const span = nextThreshold !== null ? Math.max(1, nextThreshold - currentThreshold) : 1;
  const progressPct = isMaxLevel
    ? 100
    : Math.max(0, Math.min(100, ((successes - currentThreshold) / span) * 100));

  const perLevelBonus = Math.max(0, norm.masteryAssuredBonusPerLevel || 0);
  const bonusAssured = (level - 1) * perLevelBonus;
  const dieUpgradeSteps = Math.min(
    Math.max(0, norm.masteryMaxDieUpgrades ?? 2),
    Math.max(0, level - 1)
  );

  return {
    successes,
    level,
    currentThreshold,
    nextThreshold,
    progressPct,
    isMaxLevel,
    bonusAssured,
    dieUpgradeSteps,
  };
}

export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollSingleDie(type: DieType): number {
  const sides = parseInt(type.replace('d', ''), 10);
  return Math.floor(Math.random() * sides) + 1;
}

export function rollD6Pool(
  diceCount: number,
  assured = 0,
  breakdown?: RollBreakdownItem[],
  statusAutoFails = 0,
  statusPenaltyNotes?: string[]
): D6RollSummary {
  const safeCount = Math.max(0, diceCount);
  const safeAutoFails = Math.max(0, Math.floor(statusAutoFails || 0));
  const rolls: number[] = [];
  let successes = assured;
  let fails = safeAutoFails;

  for (let i = 0; i < safeCount; i++) {
    const r = rollD6();
    rolls.push(r);
    if (r === 1) fails += 1;
    else if (r === 5) successes += 1;
    else if (r === 6) successes += 2;
  }

  return {
    rolls,
    successes,
    fails,
    assured,
    net: successes - fails,
    totalDice: safeCount,
    breakdown,
    statusAutoFails: safeAutoFails > 0 ? safeAutoFails : undefined,
    statusPenaltyNotes:
      safeAutoFails > 0 && statusPenaltyNotes && statusPenaltyNotes.length > 0
        ? statusPenaltyNotes
        : undefined,
  };
}

export function rollCombinedStats(
  character: Character,
  stats: StatKey[],
  formula: FormulaConfig,
  assured = 0,
  statusAutoFails = 0,
  statusPenaltyNotes?: string[]
): D6RollSummary {
  let totalDice = 0;
  const breakdown: RollBreakdownItem[] = [];

  for (const stat of stats) {
    const dice = getCharacterStatDice(character, stat, formula);
    totalDice += dice;
    breakdown.push({ stat, dice });
  }

  return rollD6Pool(totalDice, assured, breakdown, statusAutoFails, statusPenaltyNotes);
}

export function rollDamageDice(
  diceList: DamageDie[],
  bonus: number,
  notes: string,
  damageKind?: DamageKind
): DamageRollSummary {
  const parts: string[] = [];
  let sum = 0;
  let maxDieCount = 0;
  let upperHalfDieCount = 0;

  for (const item of diceList) {
    const sides = parseInt(item.type.replace('d', ''), 10);
    const rolls: number[] = [];
    for (let i = 0; i < item.count; i++) {
      const r = rollSingleDie(item.type);
      rolls.push(r);
      sum += r;
      if (sides > 0 && r === sides) {
        maxDieCount += 1;
      }
      if (sides > 0 && r > sides / 2) {
        upperHalfDieCount += 1;
      }
    }
    parts.push(`${item.count}${item.type} [${rolls.join(', ')}]`);
  }

  return {
    parts,
    bonus,
    total: Math.max(0, sum + bonus),
    damageKind,
    maxDieCount,
    upperHalfDieCount,
    notes,
    isManual: false,
  };
}

export function rollCriticalDamageDice(
  diceList: DamageDie[],
  bonus: number,
  notes: string,
  damageKind?: DamageKind,
  criticalReason = 'Aturdido'
): DamageRollSummary {
  const parts: string[] = [];
  let sum = 0;
  let maxDieCount = 0;
  let upperHalfDieCount = 0;

  for (const item of diceList) {
    const sides = parseInt(item.type.replace('d', ''), 10);
    const rolls: number[] = [];
    for (let i = 0; i < item.count; i++) {
      const r = Math.max(1, sides);
      rolls.push(r);
      sum += r;
      maxDieCount += 1;
      upperHalfDieCount += 1;
    }
    parts.push(`${item.count}${item.type} [${rolls.join(', ')}]`);
  }

  const critNote = `Crítico automático (${criticalReason})`;
  return {
    parts,
    bonus,
    total: Math.max(0, sum + bonus),
    damageKind,
    maxDieCount,
    upperHalfDieCount,
    isCriticalHit: true,
    criticalReason,
    notes: notes ? `${notes} · ${critNote}` : critNote,
    isManual: false,
  };
}

export function deriveCondition(
  hpCurrent: number,
  manaCurrent: number,
  previousCondition: CharacterCondition,
  wasLethal = false,
  manaMax = 1,
  ignoreManaUnconsciousness = false
): CharacterCondition {
  if (hpCurrent <= 0) {
    if (previousCondition === 'dead' || wasLethal) return 'dead';
    return 'unconscious_hp';
  }
  if (!ignoreManaUnconsciousness && manaMax > 0 && manaCurrent <= 0) {
    return 'unconscious_mana';
  }
  return 'active';
}

export function conditionLabel(condition: CharacterCondition): string {
  switch (condition) {
    case 'dead':
      return 'Muerto (0 PV · letal)';
    case 'unconscious_hp':
      return 'Inconsciente (0 PV · no letal)';
    case 'unconscious_mana':
      return 'Inconsciente (0 maná)';
    default:
      return 'Activo';
  }
}

export function formatFormulaText(formula: FormulaConfig): string {
  const { base, multiplier } = formula;
  if (base === 0 && multiplier === 0) return '0 dados';
  if (base === 0 && multiplier === 1) return 'nivel';
  if (base === 1 && multiplier === 1) return '1 + nivel';
  if (multiplier === 0) return `${base} fijo`;
  if (multiplier === 1) return `${base} + nivel`;
  return `${base} + ${multiplier}×nivel`;
}

export interface TurnActionStatus {
  used: number;
  max: number;
  remaining: number;
  hasHechizoVeloz: boolean;
  hasElevarLimite: boolean;
  canActivateElevarLimite: boolean;
  isSlowed?: boolean;
}

export const FREE_TURN_SPELL_IDS = new Set<string>([
  'basic_hechizo_veloz',
  'basic_elevar_limite',
  'basic_reforzar_hechizo',
  'basic_proteccion',
  'basic_interrumpir_circulo',
]);

export function spellConsumesTurnAction(spell: Pick<Spell, 'id' | 'effectType'>): boolean {
  if (spell.effectType === 'defense') return false;
  return !FREE_TURN_SPELL_IDS.has(spell.id);
}

export function sortCombatantsByInitiative<T extends { initiative: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.initiative - a.initiative);
}

export function getCombatantTurnActionStatus(
  combatant: {
    attacksUsedThisTurn?: number;
    activeStatuses?: Array<{ name: string }>;
  } | undefined
): TurnActionStatus {
  const statuses = combatant?.activeStatuses || [];
  const hasHechizoVeloz = statuses.some((st) => st.name === 'Hechizo Veloz');
  const hasElevarLimite = statuses.some((st) => st.name === 'Elevar el Límite');
  const isSlowed = statuses.some((st) => normalizeCombatStatusKey(st.name) === 'ralentizar');
  const max = isSlowed ? 1 : hasHechizoVeloz ? (hasElevarLimite ? 3 : 2) : 1;
  const used = Math.max(0, Math.floor(combatant?.attacksUsedThisTurn || 0));
  const remaining = Math.max(0, max - used);
  return {
    used,
    max,
    remaining,
    hasHechizoVeloz,
    hasElevarLimite,
    canActivateElevarLimite: !isSlowed && hasHechizoVeloz && !hasElevarLimite,
    isSlowed,
  };
}

export interface DirectProtectionSummary {
  stacks: number;
  manaCost: number;
  firstStackDiscount: number;
  shieldName?: string;
  reductionPerStack: number;
  reduction: number;
}

export function calcDirectProtectionSummary(
  character: Character | undefined,
  spells: Spell[],
  damageKind: DamageKind,
  stacks: number,
  isDisarmed = false
): DirectProtectionSummary {
  const safeStacks = Math.max(0, Math.floor(stacks || 0));
  const reductionPerStack = damageKind === 'magico' ? 3 : 5;
  if (safeStacks === 0) {
    return {
      stacks: 0,
      manaCost: 0,
      firstStackDiscount: 0,
      reductionPerStack,
      reduction: 0,
    };
  }
  const protSpell =
    spells.find((s) => s.id === 'basic_proteccion') ||
    BASIC_SPELLS.find((s) => s.id === 'basic_proteccion');
  const firstInfo = protSpell
    ? getEffectiveDefenseManaCost(character, protSpell, isDisarmed)
    : { cost: 1, discount: 0, shieldName: undefined };
  const manaCost = firstInfo.cost + Math.max(0, safeStacks - 1);
  return {
    stacks: safeStacks,
    manaCost,
    firstStackDiscount: firstInfo.discount,
    shieldName: firstInfo.shieldName,
    reductionPerStack,
    reduction: safeStacks * reductionPerStack,
  };
}

export function getMaxAffordableProtectionStacks(
  character: Character | undefined,
  spells: Spell[],
  manaMode: 'auto' | 'manual',
  availableManaOverride?: number,
  isDisarmed = false
): number {
  if (!character) return 0;
  if (manaMode === 'manual') return 10;
  const availableMana =
    typeof availableManaOverride === 'number'
      ? Math.max(0, availableManaOverride)
      : Math.max(0, character.mana.current);
  if (character.condition !== 'active' && availableManaOverride === undefined) {
    return 0;
  }
  const protSpell =
    spells.find((s) => s.id === 'basic_proteccion') ||
    BASIC_SPELLS.find((s) => s.id === 'basic_proteccion');
  const firstInfo = protSpell
    ? getEffectiveDefenseManaCost(character, protSpell, isDisarmed)
    : { cost: 1, discount: 0 };
  if (availableMana < firstInfo.cost) return 0;
  return Math.min(10, 1 + (availableMana - firstInfo.cost));
}

export const SPELL_DEPENDENCY_SCOPE_LABELS: Record<SpellDependencyScope, string> = {
  self_active: 'El lanzador debe tener el efecto activo o el hechizo preparado.',
  ally_active:
    'El requisito puede estar activo sobre vos o un aliado; el sistema revisa primero al lanzador.',
  target_status: 'El objetivo seleccionado debe tener aplicado el estado o debuff.',
};

export const SPELL_DEPENDENCY_SCOPE_SHORT: Record<SpellDependencyScope, string> = {
  self_active: 'Sobre vos',
  ally_active: 'Vos o un aliado',
  target_status: 'En el objetivo',
};

export interface SpellDependencyMatch {
  combatantId: string;
  characterName: string;
  sourceType: 'status' | 'prepared';
  itemId: string;
  itemName: string;
}

export interface SpellDependencyCheckResult {
  hasDependency: boolean;
  met: boolean;
  requiredName: string;
  scope: SpellDependencyScope;
  consumeOnUse: boolean;
  missingReason?: string;
  match?: SpellDependencyMatch;
}

function normalizeDependencyKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function formatSpellDependencyLine(
  dep?: SpellDependencyConfig
): string | null {
  if (!dep?.enabled || !dep.requiredName?.trim()) return null;
  const location =
    dep.scope === 'target_status'
      ? 'aplicado al objetivo'
      : dep.scope === 'ally_active'
        ? 'activo o preparado sobre vos o un aliado'
        : 'activo o preparado sobre vos';
  const outcome = dep.consumeOnUse ? 'Se consume al ejecutar' : 'Se mantiene activo';
  return `Requiere «${dep.requiredName.trim()}» ${location} · ${outcome}`;
}

export function evaluateSpellDependency(params: {
  spell: Spell;
  casterCharacterId?: string;
  combatants: Combatant[];
  characters: Character[];
  targetCombatantId?: string;
}): SpellDependencyCheckResult {
  const dep = params.spell.dependency;
  if (!dep?.enabled || !dep.requiredName?.trim()) {
    return {
      hasDependency: false,
      met: true,
      requiredName: '',
      scope: 'self_active',
      consumeOnUse: false,
    };
  }

  const reqName = dep.requiredName.trim();
  const reqKey = normalizeDependencyKey(reqName);
  const reqSpellId = dep.requiredSpellId?.trim() || undefined;
  const { combatants, characters, casterCharacterId, targetCombatantId } = params;

  const casterCb = casterCharacterId
    ? combatants.find((cb) => cb.characterId === casterCharacterId)
    : undefined;

  const getCharName = (cb: Combatant) =>
    characters.find((c) => c.id === cb.characterId)?.name || 'Combatiente';

  const findOnCombatant = (
    cb: Combatant,
    includePrepared: boolean
  ): SpellDependencyMatch | undefined => {
    const matchedStatus = (cb.activeStatuses || []).find((st) => {
      if (reqSpellId && st.sourceSpellId === reqSpellId) return true;
      return normalizeDependencyKey(st.name) === reqKey;
    });
    if (matchedStatus) {
      return {
        combatantId: cb.id,
        characterName: getCharName(cb),
        sourceType: 'status',
        itemId: matchedStatus.id,
        itemName: matchedStatus.name,
      };
    }

    if (includePrepared) {
      const matchedPrepared = (cb.preparedSpells || []).find((prep) => {
        if (reqSpellId && prep.spellId === reqSpellId) return true;
        return normalizeDependencyKey(prep.spellName) === reqKey;
      });
      if (matchedPrepared) {
        return {
          combatantId: cb.id,
          characterName: getCharName(cb),
          sourceType: 'prepared',
          itemId: matchedPrepared.id,
          itemName: matchedPrepared.spellName,
        };
      }
    }

    return undefined;
  };

  if (dep.scope === 'self_active') {
    if (!casterCb) {
      return {
        hasDependency: true,
        met: false,
        requiredName: reqName,
        scope: dep.scope,
        consumeOnUse: dep.consumeOnUse,
        missingReason: `No se encontró al lanzador para comprobar «${reqName}».`,
      };
    }
    const match = findOnCombatant(casterCb, true);
    if (match) {
      return {
        hasDependency: true,
        met: true,
        requiredName: reqName,
        scope: dep.scope,
        consumeOnUse: dep.consumeOnUse,
        match,
      };
    }
    return {
      hasDependency: true,
      met: false,
      requiredName: reqName,
      scope: dep.scope,
      consumeOnUse: dep.consumeOnUse,
      missingReason: `Necesitás tener «${reqName}» activo sobre vos o preparado.`,
    };
  }

  if (dep.scope === 'ally_active') {
    // Primero revisar el propio lanzador
    if (casterCb) {
      const selfMatch = findOnCombatant(casterCb, true);
      if (selfMatch) {
        return {
          hasDependency: true,
          met: true,
          requiredName: reqName,
          scope: dep.scope,
          consumeOnUse: dep.consumeOnUse,
          match: selfMatch,
        };
      }
    }

    // Luego revisar aliados en combate (mismo bando, excluyendo al objetivo enemigo seleccionado)
    const casterIsBot = Boolean(casterCb?.isBotControlled);
    const allyCombatants = combatants.filter((cb) => {
      if (casterCb && cb.id === casterCb.id) return false;
      if (Boolean(cb.isBotControlled) !== casterIsBot) return false;
      if (!casterIsBot && targetCombatantId && cb.id === targetCombatantId) return false;
      return true;
    });

    for (const allyCb of allyCombatants) {
      const allyMatch = findOnCombatant(allyCb, true);
      if (allyMatch) {
        return {
          hasDependency: true,
          met: true,
          requiredName: reqName,
          scope: dep.scope,
          consumeOnUse: dep.consumeOnUse,
          match: allyMatch,
        };
      }
    }

    return {
      hasDependency: true,
      met: false,
      requiredName: reqName,
      scope: dep.scope,
      consumeOnUse: dep.consumeOnUse,
      missingReason: `Necesitás tener «${reqName}» activo o preparado vos o un aliado.`,
    };
  }

  // scope === 'target_status'
  const resolvedTarget =
    (targetCombatantId
      ? combatants.find(
          (cb) => cb.id === targetCombatantId && cb.characterId !== casterCharacterId
        )
      : undefined) ||
    combatants.find((cb) => cb.characterId !== casterCharacterId);

  if (!resolvedTarget) {
    return {
      hasDependency: true,
      met: false,
      requiredName: reqName,
      scope: dep.scope,
      consumeOnUse: dep.consumeOnUse,
      missingReason: `Elegí un objetivo que tenga aplicado «${reqName}».`,
    };
  }

  const targetMatch = findOnCombatant(resolvedTarget, false);
  if (targetMatch) {
    return {
      hasDependency: true,
      met: true,
      requiredName: reqName,
      scope: dep.scope,
      consumeOnUse: dep.consumeOnUse,
      match: targetMatch,
    };
  }

  const targetName = getCharName(resolvedTarget);
  return {
    hasDependency: true,
    met: false,
    requiredName: reqName,
    scope: dep.scope,
    consumeOnUse: dep.consumeOnUse,
    missingReason: `El objetivo ${targetName} no tiene aplicado «${reqName}».`,
  };
}

// ============================================================================
// MECÁNICAS DE ESTADOS DE CONTROL Y COMBATE (NO ELEMENTALES)
// Nota: Quemadura, Envenenado, Congelado, Electrificado y Sangrando mantienen
// su propio sistema elemental intacto.
// ============================================================================

export interface CombatStatusMechanicMeta {
  key: CombatStatusKey;
  canonicalName: string;
  shortRule: string;
  detailedRule: string;
  supportsAutoFails?: boolean;
  autoFailsTargetLabel?: string;
  defaultAutoFails?: number;
  supportsUntilHit?: boolean;
  defaultUntilHit?: boolean;
}

export const COMBAT_STATUS_MECHANICS: Record<CombatStatusKey, CombatStatusMechanicMeta> = {
  aturdir: {
    key: 'aturdir',
    canonicalName: 'Aturdir',
    shortRule: 'Movilidad 0 · Sin reacción · Sin atacar/defender · Crítico automático entrante',
    detailedRule:
      'Movilidad = 0, capacidad de reaccionar = 0, imposibilidad de atacar o defenderse y los golpes entrantes son críticos automáticos (dados al máximo). Dura hasta recibir un golpe o según la duración definida en el hechizo.',
    supportsUntilHit: true,
    defaultUntilHit: true,
  },
  cegar: {
    key: 'cegar',
    canonicalName: 'Cegar',
    shortRule: 'Fallos automáticos en ataque y defensa (salvo inmune a ceguera)',
    detailedRule:
      'El objetivo sufre fallos automáticos en sus tiradas de ataque y defensa mientras dure el efecto (a menos que sea ciego o perciba por otros sentidos).',
    supportsAutoFails: true,
    autoFailsTargetLabel: 'en ataque y defensa',
    defaultAutoFails: 1,
  },
  derribar: {
    key: 'derribar',
    canonicalName: 'Derribar',
    shortRule: 'Fallos automáticos en ataque y defensa mientras esté en el suelo',
    detailedRule:
      'El objetivo cae al suelo y recibe fallos automáticos en sus tiradas de ataque y defensa hasta levantarse o que termine el efecto.',
    supportsAutoFails: true,
    autoFailsTargetLabel: 'en ataque y defensa',
    defaultAutoFails: 1,
  },
  desarmar: {
    key: 'desarmar',
    canonicalName: 'Desarmar',
    shortRule: 'Suelta arma/escudo · Requiere 1 acción en su turno para recuperarlos',
    detailedRule:
      'El objetivo suelta su arma o escudo (armas no naturales y escudos catalizadores quedan bloqueados) y no puede usarlos hasta gastar 1 acción en su turno para recuperarlos.',
  },
  empujar: {
    key: 'empujar',
    canonicalName: 'Empujar',
    shortRule: 'Retrocede (pierde defensa al impacto) y aplica Derribar automáticamente',
    detailedRule:
      'El objetivo retrocede perdiendo su defensa en el momento del impacto y cae automáticamente Derribado.',
    supportsAutoFails: true,
    autoFailsTargetLabel: 'para el Derribar aplicado',
    defaultAutoFails: 1,
  },
  ensordecer: {
    key: 'ensordecer',
    canonicalName: 'Ensordecer',
    shortRule: 'Fallos automáticos en tiradas de defensa mientras dure',
    detailedRule:
      'El objetivo pierde orientación auditiva y sufre fallos automáticos únicamente en sus tiradas de defensa hasta que termine el efecto.',
    supportsAutoFails: true,
    autoFailsTargetLabel: 'en defensa',
    defaultAutoFails: 1,
  },
  inmovilizar: {
    key: 'inmovilizar',
    canonicalName: 'Inmovilizar',
    shortRule: 'Movilidad 0 · No puede atacar, defenderse ni desplazarse',
    detailedRule:
      'El objetivo queda sujeto y no puede desplazarse, atacar ni defenderse hasta que termine el efecto.',
  },
  noquear: {
    key: 'noquear',
    canonicalName: 'Noquear',
    shortRule: 'Inconsciente · Movilidad 0 · Sin acciones/reacción · Crítico automático',
    detailedRule:
      'Deja al objetivo fuera de combate temporalmente: movilidad 0, sin reacciones ni acciones, no puede atacar ni defenderse y los golpes entrantes son críticos automáticos.',
  },
  ralentizar: {
    key: 'ralentizar',
    canonicalName: 'Ralentizar',
    shortRule: 'Movilidad ½ · Máx. 1 acción/turno · Fallos automáticos en defensa',
    detailedRule:
      'Reduce la movilidad a la mitad, limita las acciones por turno a 1 (impide acciones extra como Hechizo Veloz) y suma fallos automáticos en defensa.',
    supportsAutoFails: true,
    autoFailsTargetLabel: 'en defensa',
    defaultAutoFails: 1,
  },
  silenciar: {
    key: 'silenciar',
    canonicalName: 'Silenciar',
    shortRule: 'Bloquea hechizos y reacciones mágicas (acciones físicas permitidas)',
    detailedRule:
      'Impide lanzar o preparar hechizos mágicos y usar reacciones mágicas (Protección / Interrumpir Círculo) mientras dure el efecto. Los ataques y esquivas físicas siguen disponibles.',
  },
  intimidar: {
    key: 'intimidar',
    canonicalName: 'Intimidar',
    shortRule: 'Fallos automáticos en ataque y en tiradas de Influencia',
    detailedRule:
      'Infunde temor o vacilación: aplica fallos automáticos en tiradas de ataque y en tiradas de Influencia mientras dure el efecto.',
    supportsAutoFails: true,
    autoFailsTargetLabel: 'en ataque e Influencia',
    defaultAutoFails: 1,
  },
};

export function normalizeCombatStatusKey(rawName: string): CombatStatusKey | null {
  const norm = rawName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!norm) return null;
  if (norm === 'aturdir' || norm === 'aturdido' || norm === 'aturdida') return 'aturdir';
  if (norm === 'cegar' || norm === 'cegado' || norm === 'cegada' || norm === 'ceguera') return 'cegar';
  if (norm === 'derribar' || norm === 'derribado' || norm === 'derribada') return 'derribar';
  if (norm === 'desarmar' || norm === 'desarmado' || norm === 'desarmada') return 'desarmar';
  if (norm === 'empujar' || norm === 'empujado' || norm === 'empujada' || norm === 'empujon') return 'empujar';
  if (norm === 'ensordecer' || norm === 'ensordecido' || norm === 'ensordecida' || norm === 'sordera') return 'ensordecer';
  if (norm === 'inmovilizar' || norm === 'inmovilizado' || norm === 'inmovilizada') return 'inmovilizar';
  if (norm === 'noquear' || norm === 'noqueado' || norm === 'noqueada') return 'noquear';
  if (norm === 'ralentizar' || norm === 'ralentizado' || norm === 'ralentizada') return 'ralentizar';
  if (norm === 'silenciar' || norm === 'silenciado' || norm === 'silenciada' || norm === 'silencio') return 'silenciar';
  if (norm === 'intimidar' || norm === 'intimidado' || norm === 'intimidada') return 'intimidar';
  return null;
}

export function getSpellStatusParam(
  spell: Pick<Spell, 'statusParams'> | undefined,
  statusName: string
): SpellStatusParamConfig | undefined {
  if (!spell?.statusParams) return undefined;
  if (spell.statusParams[statusName]) return spell.statusParams[statusName];
  const targetKey = normalizeCombatStatusKey(statusName);
  if (!targetKey) return undefined;
  for (const [k, v] of Object.entries(spell.statusParams)) {
    if (normalizeCombatStatusKey(k) === targetKey) return v;
  }
  return undefined;
}

export interface AggregatedStatusEffects {
  activeKeys: CombatStatusKey[];
  mobility: 'normal' | 'half' | 'zero';
  cannotAct: boolean;
  cannotActReasons: string[];
  cannotReact: boolean;
  cannotReactReasons: string[];
  cannotAttack: boolean;
  cannotAttackReasons: string[];
  cannotDefend: boolean;
  cannotDefendReasons: string[];
  cannotCastMagic: boolean;
  cannotCastMagicReasons: string[];
  incomingAutoCrit: boolean;
  incomingAutoCritReasons: string[];
  disarmed: boolean;
  disarmedStatusIds: string[];
  proneStatusIds: string[];
  maxActionsOverride: number | null;
  autoFailsAttack: number;
  autoFailsAttackNotes: string[];
  autoFailsDefense: number;
  autoFailsDefenseNotes: string[];
  autoFailsInfluence: number;
  autoFailsInfluenceNotes: string[];
  ignoredBlind: boolean;
  summaryTags: string[];
}

export function getCombatantStatusEffects(
  combatant: Pick<Combatant, 'activeStatuses'> | undefined,
  character?: Pick<Character, 'immuneToBlind'>
): AggregatedStatusEffects {
  const result: AggregatedStatusEffects = {
    activeKeys: [],
    mobility: 'normal',
    cannotAct: false,
    cannotActReasons: [],
    cannotReact: false,
    cannotReactReasons: [],
    cannotAttack: false,
    cannotAttackReasons: [],
    cannotDefend: false,
    cannotDefendReasons: [],
    cannotCastMagic: false,
    cannotCastMagicReasons: [],
    incomingAutoCrit: false,
    incomingAutoCritReasons: [],
    disarmed: false,
    disarmedStatusIds: [],
    proneStatusIds: [],
    maxActionsOverride: null,
    autoFailsAttack: 0,
    autoFailsAttackNotes: [],
    autoFailsDefense: 0,
    autoFailsDefenseNotes: [],
    autoFailsInfluence: 0,
    autoFailsInfluenceNotes: [],
    ignoredBlind: false,
    summaryTags: [],
  };

  if (!combatant?.activeStatuses?.length) return result;

  const pushUnique = (arr: string[], val: string) => {
    if (!arr.includes(val)) arr.push(val);
  };

  for (const st of combatant.activeStatuses) {
    const key = normalizeCombatStatusKey(st.name);
    if (!key) continue;
    if (!result.activeKeys.includes(key)) {
      result.activeKeys.push(key);
    }

    const meta = COMBAT_STATUS_MECHANICS[key];
    const failsCount = Math.max(1, Math.floor(st.autoFails ?? meta.defaultAutoFails ?? 1));

    switch (key) {
      case 'aturdir':
        result.mobility = 'zero';
        result.cannotAct = true;
        pushUnique(result.cannotActReasons, st.name);
        result.cannotReact = true;
        pushUnique(result.cannotReactReasons, st.name);
        result.cannotAttack = true;
        pushUnique(result.cannotAttackReasons, st.name);
        result.cannotDefend = true;
        pushUnique(result.cannotDefendReasons, st.name);
        result.incomingAutoCrit = true;
        pushUnique(result.incomingAutoCritReasons, st.name);
        break;
      case 'noquear':
        result.mobility = 'zero';
        result.cannotAct = true;
        pushUnique(result.cannotActReasons, st.name);
        result.cannotReact = true;
        pushUnique(result.cannotReactReasons, st.name);
        result.cannotAttack = true;
        pushUnique(result.cannotAttackReasons, st.name);
        result.cannotDefend = true;
        pushUnique(result.cannotDefendReasons, st.name);
        result.cannotCastMagic = true;
        pushUnique(result.cannotCastMagicReasons, st.name);
        result.incomingAutoCrit = true;
        pushUnique(result.incomingAutoCritReasons, st.name);
        break;
      case 'inmovilizar':
        result.mobility = 'zero';
        result.cannotAttack = true;
        pushUnique(result.cannotAttackReasons, st.name);
        result.cannotDefend = true;
        pushUnique(result.cannotDefendReasons, st.name);
        break;
      case 'cegar':
        if (character?.immuneToBlind) {
          result.ignoredBlind = true;
        } else {
          result.autoFailsAttack += failsCount;
          result.autoFailsAttackNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
          result.autoFailsDefense += failsCount;
          result.autoFailsDefenseNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        }
        break;
      case 'derribar':
        result.proneStatusIds.push(st.id);
        result.autoFailsAttack += failsCount;
        result.autoFailsAttackNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        result.autoFailsDefense += failsCount;
        result.autoFailsDefenseNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        break;
      case 'desarmar':
        result.disarmed = true;
        result.disarmedStatusIds.push(st.id);
        break;
      case 'empujar':
        result.cannotDefend = true;
        pushUnique(result.cannotDefendReasons, `${st.name} (retroceso)`);
        break;
      case 'ensordecer':
        result.autoFailsDefense += failsCount;
        result.autoFailsDefenseNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        break;
      case 'ralentizar':
        if (result.mobility === 'normal') result.mobility = 'half';
        result.maxActionsOverride = 1;
        result.autoFailsDefense += failsCount;
        result.autoFailsDefenseNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        break;
      case 'silenciar':
        result.cannotCastMagic = true;
        pushUnique(result.cannotCastMagicReasons, st.name);
        break;
      case 'intimidar':
        result.autoFailsAttack += failsCount;
        result.autoFailsAttackNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        result.autoFailsInfluence += failsCount;
        result.autoFailsInfluenceNotes.push(`${st.name} (+${failsCount} fallo${failsCount > 1 ? 's' : ''})`);
        break;
    }
  }

  if (result.mobility === 'zero') result.summaryTags.push('Movilidad 0');
  else if (result.mobility === 'half') result.summaryTags.push('Movilidad ½');
  if (result.cannotReact) result.summaryTags.push('Reacción 0');
  if (result.incomingAutoCrit) result.summaryTags.push('Crítico automático entrante');
  if (result.cannotAttack && result.cannotDefend) result.summaryTags.push('No ataca ni defiende');
  else if (result.cannotAttack) result.summaryTags.push('No ataca');
  else if (result.cannotDefend) result.summaryTags.push('Sin defensa');
  if (result.cannotCastMagic && !result.cannotAct) result.summaryTags.push('Sin magia');
  if (result.disarmed) result.summaryTags.push('Desarmado');
  if (result.maxActionsOverride === 1) result.summaryTags.push('Máx. 1 acción');
  if (result.autoFailsAttack > 0) {
    result.summaryTags.push(`Atq +${result.autoFailsAttack} fallo${result.autoFailsAttack > 1 ? 's' : ''}`);
  }
  if (result.autoFailsDefense > 0) {
    result.summaryTags.push(`Def +${result.autoFailsDefense} fallo${result.autoFailsDefense > 1 ? 's' : ''}`);
  }
  if (result.autoFailsInfluence > 0) {
    result.summaryTags.push(`Inf +${result.autoFailsInfluence} fallo${result.autoFailsInfluence > 1 ? 's' : ''}`);
  }
  if (result.ignoredBlind) {
    result.summaryTags.push('Inmune a Cegar');
  }

  return result;
}

export function formatStatusChipMechanics(
  status: Pick<ActiveStatus, 'name' | 'autoFails' | 'endsOnHit'>,
  character?: Pick<Character, 'immuneToBlind'>
): string | null {
  const key = normalizeCombatStatusKey(status.name);
  if (!key) return null;
  const meta = COMBAT_STATUS_MECHANICS[key];
  const f = Math.max(1, Math.floor(status.autoFails ?? meta.defaultAutoFails ?? 1));

  switch (key) {
    case 'aturdir':
      return status.endsOnHit !== false
        ? 'Mov 0 · Reac 0 · Crítico · hasta 1 golpe'
        : 'Mov 0 · Reac 0 · Crítico';
    case 'cegar':
      return character?.immuneToBlind
        ? 'Sin efecto (ve por otros sentidos)'
        : `+${f} fallo${f > 1 ? 's' : ''} atq/def`;
    case 'derribar':
      return `+${f} fallo${f > 1 ? 's' : ''} atq/def`;
    case 'desarmar':
      return 'Arma/escudo soltado (1 acción recuperar)';
    case 'empujar':
      return 'Sin defensa al impacto';
    case 'ensordecer':
      return `+${f} fallo${f > 1 ? 's' : ''} def`;
    case 'inmovilizar':
      return 'Mov 0 · Sin atacar/defender';
    case 'noquear':
      return 'Inconsciente · Mov 0 · Crítico';
    case 'ralentizar':
      return `Mov ½ · Máx 1 acc · +${f} fallo${f > 1 ? 's' : ''} def`;
    case 'silenciar':
      return 'Sin hechizos ni reacciones mágicas';
    case 'intimidar':
      return `+${f} fallo${f > 1 ? 's' : ''} atq/Inf`;
  }
}

// ============================================================================
// ARCHIVO ARCANO — 10 HECHIZOS BASE ADAPTABLES Y MOTOR DE ADAPTACIÓN ELEMENTAL
// ============================================================================

export const ADAPTABLE_CATALOG_SPELLS: Spell[] = [
  {
    id: 'cat_egida_elemental',
    name: 'Égida de [Elemento]',
    manaCost: 4,
    orders: ['Proteger', 'Comprimir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'armor',
    catalogChainGroup: 'Égida Elemental',
    armorConfig: {
      isArmor: true,
      element: '[Elemento]',
      damageReduction: 5,
      damageDivisor: 1,
      maxHits: 4,
    },
    maxHits: 4,
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Armadura elemental superior a la base: envuelve tu cuerpo en [Elemento] durante 3 turnos, reduciendo 5 de daño entrante hasta soportar 4 golpes. Habilita Ruptura de Égida. Sin maestría.',
    duration: '3 turnos',
    durationTurns: 3,
    isBasic: true,
  },
  {
    id: 'cat_ruptura_egida',
    name: 'Ruptura de Égida',
    manaCost: 3,
    orders: ['Expandir', 'Impulsar / Empujar'],
    statuses: ['Empujar'],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    noMastery: false,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'attack',
    catalogChainGroup: 'Égida Elemental',
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      shapeNote: 'Onda expansiva en área alrededor del lanzador',
    },
    dependency: {
      enabled: true,
      scope: 'self_active',
      requiredSpellId: 'cat_egida_elemental',
      requiredName: 'Égida de [Elemento]',
      consumeOnUse: true,
    },
    damage: { dice: [{ type: 'd6', count: 2 }], bonus: 0, notes: 'detonación de [Elemento]' },
    effectDescription:
      'Detona tu Égida de [Elemento] (la consume al usar) en una onda expansiva en área que inflige 2d6 mágico e intenta Empujar (y Derribar) a los objetivos alcanzados. Admite maestría.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'cat_manto_elemental',
    name: 'Manto de [Elemento]',
    manaCost: 2,
    orders: ['Imbuir', 'Comprimir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'buff',
    noMastery: true,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'buff',
    catalogChainGroup: 'Manto Elemental',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Buff ágil de combate: reviste tu aura con [Elemento] durante 3 turnos. Habilita técnicas dependientes como Lanza Perforante de [Elemento] (lo mantiene) y Juicio de [Elemento] (lo consume). Sin maestría.',
    duration: '3 turnos',
    durationTurns: 3,
    isBasic: true,
  },
  {
    id: 'cat_lanza_perforante',
    name: 'Lanza Perforante de [Elemento]',
    manaCost: 3,
    orders: ['Proyectar', 'Comprimir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 1,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    noMastery: false,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'attack',
    catalogChainGroup: 'Manto Elemental',
    dependency: {
      enabled: true,
      scope: 'self_active',
      requiredSpellId: 'cat_manto_elemental',
      requiredName: 'Manto de [Elemento]',
      consumeOnUse: false,
    },
    damage: { dice: [{ type: 'd6', count: 2 }], bonus: 2, notes: 'lanza concentrada de [Elemento]' },
    effectDescription:
      'Proyectil perforante de precisión (+1 éxito asegurado, 2d6+2 mágico de [Elemento]). Requiere tener Manto de [Elemento] activo y lo mantiene encendido tras disparar. Admite maestría.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'cat_juicio_elemental',
    name: 'Juicio de [Elemento]',
    manaCost: 5,
    orders: ['Comprimir', 'Expandir', 'Noquear'],
    statuses: ['Noquear'],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    noMastery: true,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'control',
    catalogChainGroup: 'Manto Elemental',
    dependency: {
      enabled: true,
      scope: 'self_active',
      requiredSpellId: 'cat_manto_elemental',
      requiredName: 'Manto de [Elemento]',
      consumeOnUse: true,
    },
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'descarga abrumadora de [Elemento]' },
    effectDescription:
      'Remate mayor: consume Manto de [Elemento] para descargar un impacto directo (1d4 mágico) e intentar Noquear al objetivo durante 1 turno por Influencia. Sin maestría para equilibrar Noquear.',
    duration: '1 turno',
    durationTurns: 1,
    isBasic: true,
  },
  {
    id: 'cat_prision_elemental',
    name: 'Prisión de [Elemento]',
    manaCost: 3,
    orders: ['Contener', 'Inmovilizar'],
    statuses: ['Inmovilizar'],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'debuff',
    noMastery: false,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'control',
    catalogChainGroup: 'Prisión y Sentencia',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Ata o encierra al objetivo con [Elemento] aplicando Inmovilizar durante 2 turnos mediante tirada de Influencia. Prepara el terreno para Sentencia sobre Atrapado. Admite maestría.',
    duration: '2 turnos',
    durationTurns: 2,
    isBasic: true,
  },
  {
    id: 'cat_sentencia_atrapado',
    name: 'Sentencia sobre Atrapado',
    manaCost: 3,
    orders: ['Proyectar', 'Comprimir'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    noMastery: false,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'attack',
    catalogChainGroup: 'Prisión y Sentencia',
    dependency: {
      enabled: true,
      scope: 'target_status',
      requiredName: 'Inmovilizar',
      consumeOnUse: true,
    },
    damage: { dice: [{ type: 'd6', count: 3 }], bonus: 0, notes: 'ejecución de [Elemento]' },
    effectDescription:
      'Ataque ejecutor concentrado (3d6 mágico de [Elemento]). Requiere que el objetivo esté bajo Inmovilizar y consume esa atadura al impactar. Admite maestría.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'cat_tormenta_elemental',
    name: 'Tormenta de [Elemento]',
    manaCost: 5,
    orders: ['Expandir', 'Proyectar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: ['manipulacion'],
    damageMode: 'auto',
    effectType: 'damage',
    damageKind: 'magico',
    noMastery: false,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'attack',
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      shapeNote: 'Radio 20 pies',
    },
    damage: { dice: [{ type: 'd6', count: 2 }], bonus: 0, notes: 'tormenta en área de [Elemento]' },
    effectDescription:
      'Desata una tormenta de [Elemento] en un radio de 20 pies que golpea a múltiples enemigos simultáneamente con 2d6 mágico. Admite maestría.',
    duration: 'Instantáneo',
    isBasic: true,
  },
  {
    id: 'cat_choque_desarmador',
    name: 'Choque Desarmador de [Elemento]',
    manaCost: 2,
    orders: ['Proyectar', 'Desarmar', 'Ensordecer'],
    statuses: ['Desarmar', 'Ensordecer'],
    statusParams: {
      Ensordecer: { autoFails: 1 },
    },
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'effect',
    effectSubType: 'debuff',
    noMastery: false,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'control',
    damage: { dice: [], bonus: 0, notes: '' },
    effectDescription:
      'Estallido táctico de [Elemento] por Influencia: intenta Desarmar al objetivo (suelta arma/escudo, 1 acción para recuperar) y aplicar Ensordecer (+1 fallo automático en defensa durante 1 turno). Admite maestría.',
    duration: '1 turno',
    durationTurns: 1,
    isBasic: true,
  },
  {
    id: 'cat_pulso_regenerador',
    name: 'Pulso Regenerador de [Elemento]',
    manaCost: 3,
    orders: ['Curar', 'Canalizar'],
    statuses: [],
    castRequirement: 'none',
    castStat: 'none',
    manualCastDice: 0,
    assuredSuccess: 0,
    combatStats: [],
    damageMode: 'auto',
    effectType: 'heal',
    noMastery: true,
    unlearnedByDefault: true,
    isAdaptableTemplate: true,
    adaptableElementRole: 'heal',
    damage: { dice: [{ type: 'd4', count: 2 }], bonus: 1, notes: 'curación canalizada de [Elemento]' },
    effectDescription:
      'Canaliza energía vital de [Elemento] para restaurar 2d4 + 1 PV a un aliado o a vos mismo sin tirada previa. Sin maestría (consistente con Curar Heridas Leves).',
    duration: 'Instantáneo',
    isBasic: true,
  },
];

const NATURE_SHORT_ELEMENT_MAP: Record<string, string> = {
  fuego: 'Fuego',
  agua: 'Agua',
  hielo: 'Hielo',
  aire: 'Aire',
  rayo: 'Rayo',
  tierra: 'Tierra',
  flora: 'Flora',
  tormenta: 'Tormenta',
  magma: 'Magma',
  metal: 'Metal',
  sonico: 'Sonido',
  luz: 'Luz',
  sombra: 'Sombra',
  eclipse: 'Eclipse',
  vacio: 'Vacío',
  tiempo: 'Tiempo',
  gravedad: 'Gravedad',
  espacio: 'Espacio',
  portales: 'Portales',
  explosion: 'Explosión',
  runas: 'Runas',
  arcano: 'Arcano',
  mente: 'Mente',
  alquimia: 'Alquimia',
  veneno: 'Veneno',
  sangre: 'Sangre',
  drenaje: 'Drenaje',
  transformacion_garras: 'Bestia',
  transformacion_mordida: 'Depredador',
  cuerpo_reforzado: 'Fuerza',
  personalizada: 'Arcano',
};

export function resolveNaturePresetForCharacter(
  character?: Pick<Character, 'nature'>,
  overrideNatureId?: string
): { preset: MageNaturePreset; elementName: string; rawLabel: string } {
  const defaultPreset =
    MAGE_NATURES.find((n) => n.id === 'arcano') || MAGE_NATURES[0];

  if (overrideNatureId) {
    const byOverride = MAGE_NATURES.find((n) => n.id === overrideNatureId);
    if (byOverride) {
      return {
        preset: byOverride,
        elementName:
          NATURE_SHORT_ELEMENT_MAP[byOverride.id] ||
          byOverride.label.split('/')[0].trim() ||
          'Arcano',
        rawLabel: byOverride.label,
      };
    }
  }

  const rawNature = (character?.nature || '').trim();
  if (!rawNature) {
    return { preset: defaultPreset, elementName: 'Arcano', rawLabel: defaultPreset.label };
  }

  const norm = rawNature
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const exactMatch = MAGE_NATURES.find((n) => {
    const labelNorm = n.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const firstSegment = labelNorm.split('/')[0].trim();
    return (
      n.id === norm ||
      labelNorm === norm ||
      norm.startsWith(firstSegment) ||
      labelNorm.includes(norm)
    );
  });

  if (exactMatch) {
    return {
      preset: exactMatch,
      elementName:
        NATURE_SHORT_ELEMENT_MAP[exactMatch.id] ||
        exactMatch.label.split('/')[0].trim() ||
        'Arcano',
      rawLabel: exactMatch.label,
    };
  }

  // Custom free-text nature (e.g. "Cristal / Diamante" -> "Cristal")
  const customShort = rawNature.split('/')[0].trim() || 'Arcano';
  return {
    preset: defaultPreset,
    elementName: customShort,
    rawLabel: rawNature,
  };
}

export function getElementalStatusForNature(
  natureId: string,
  elementName: string
): SpellElementalStatusConfig | undefined {
  const key = `${natureId} ${elementName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(fuego|igneo|magma|volcan|llama|brasas)\b/.test(key)) {
    return {
      kind: 'burn',
      trigger: 'max_die',
      stacks: 1,
      durationTurns: 3,
      tickDie: 'd4',
      damageKind: 'magico',
    };
  }
  if (/\b(hielo|escarcha|crio|frio|glaciar)\b/.test(key)) {
    return {
      kind: 'frozen',
      trigger: 'upper_half',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    };
  }
  if (/\b(rayo|electric|relampago|tormenta|volt|trueno)\b/.test(key)) {
    return {
      kind: 'electrified',
      trigger: 'always',
      stacks: 1,
      durationTurns: 3,
      tickDie: 'd4',
      damageKind: 'magico',
    };
  }
  if (/\b(veneno|toxico|acido|corros|flora|espora)\b/.test(key)) {
    return {
      kind: 'poison',
      trigger: 'upper_half',
      stacks: 1,
      durationTurns: 3,
      tickDie: 'd4',
      damageKind: 'magico',
    };
  }
  if (/\b(sangre|hemomanc|corte|filo|cuchilla)\b/.test(key)) {
    return {
      kind: 'bleeding',
      trigger: 'always',
      stacks: 1,
      durationTurns: 3,
      tickDie: 'd4',
      damageKind: 'fisico',
    };
  }
  return undefined;
}

export function getCatalogPrerequisiteTemplateId(template: Spell): string | undefined {
  if (!template.dependency?.enabled) return undefined;
  if (template.dependency.requiredSpellId) {
    return template.dependency.requiredSpellId;
  }
  // Sentencia sobre Atrapado depends on Inmovilizar -> link Prisión de [Elemento] as chain helper
  if (template.id === 'cat_sentencia_atrapado') {
    return 'cat_prision_elemental';
  }
  return undefined;
}

export function adaptCatalogSpellForCharacter(
  template: Spell,
  character?: Pick<Character, 'id' | 'nature'>,
  options?: {
    overrideNatureId?: string;
    materialize?: boolean;
    existingLearnedSpells?: Spell[];
  }
): Spell {
  const { preset, elementName } = resolveNaturePresetForCharacter(
    character,
    options?.overrideNatureId
  );
  const replaceToken = (text: string) => text.replace(/\[Elemento\]/g, elementName);

  const primaryAffinityOrder =
    preset.affinityOrders[0] ||
    preset.orders.find((o) => o !== 'Proyectar') ||
    preset.orders[0];

  const mergedOrders = primaryAffinityOrder
    ? Array.from(new Set([...template.orders, primaryAffinityOrder]))
    : [...template.orders];

  const adaptedArmorConfig = template.armorConfig
    ? {
        ...template.armorConfig,
        element: template.armorConfig.isArmor ? elementName : template.armorConfig.element,
      }
    : undefined;

  let adaptedDependency = template.dependency
    ? {
        ...template.dependency,
        requiredName: replaceToken(template.dependency.requiredName),
      }
    : undefined;

  if (adaptedDependency?.requiredSpellId) {
    const prereqTemplateId = adaptedDependency.requiredSpellId;
    const learnedPrereq = options?.existingLearnedSpells?.find(
      (s) => s.catalogTemplateId === prereqTemplateId || s.id === prereqTemplateId
    );
    adaptedDependency = {
      ...adaptedDependency,
      requiredSpellId: learnedPrereq ? learnedPrereq.id : undefined,
      requiredName: learnedPrereq ? learnedPrereq.name : adaptedDependency.requiredName,
    };
  }

  const adaptedElementalStatus =
    template.elementalStatus ||
    (template.adaptableElementRole === 'attack'
      ? getElementalStatusForNature(preset.id, elementName)
      : undefined);

  const materialize = Boolean(options?.materialize);

  return {
    ...template,
    id: materialize ? generateId('sp_') : template.id,
    name: replaceToken(template.name),
    orders: mergedOrders,
    statuses: [...template.statuses],
    statusParams: template.statusParams ? { ...template.statusParams } : undefined,
    combatStats: [...template.combatStats],
    armorConfig: adaptedArmorConfig,
    areaConfig: template.areaConfig ? { ...template.areaConfig } : undefined,
    dependency: adaptedDependency,
    elementalStatus: adaptedElementalStatus,
    damage: {
      dice: template.damage.dice.map((d) => ({ ...d })),
      bonus: template.damage.bonus,
      notes: replaceToken(template.damage.notes || ''),
    },
    effectDescription: replaceToken(template.effectDescription),
    ownerCharacterId: materialize ? character?.id : template.ownerCharacterId,
    isBasic: materialize ? false : template.isBasic,
    unlearnedByDefault: materialize ? false : template.unlearnedByDefault,
    isAdaptableTemplate: materialize ? false : template.isAdaptableTemplate,
    catalogTemplateId: template.id,
  };
}

// ============================================================================
// AUDITORÍA ELEMENTAL 1 A 1 + SISTEMA DE LLAVE DEL ARCHIVO ARCANO
// ============================================================================

export const ALL_ARCHIVE_LOCKED_IDS: string[] = [
  ...ADAPTABLE_CATALOG_SPELLS.map((s) => s.id),
  'basic_foco_arcano',
  'basic_descarga_focalizada',
  'basic_estallido_conmocionante',
];

export interface NatureElementalCapabilities {
  /** Puede formar coraza/armadura física o campo rígido capaz de mitigar golpes (Égida + Ruptura) */
  canFormSolidArmor: boolean;
  /** Puede envolver al lanzador en un manto/aura de su elemento (Manto) */
  canFormMantle: boolean;
  /** Puede proyectar un ataque concentrado perforante (Lanza Perforante) */
  canFormPiercingLance: boolean;
  /** Puede descargar un impacto abrumador que intente Noquear (Juicio) */
  canFormKnockoutJudgment: boolean;
  /** Puede apresar, congelar, enredar, encadenar o fijar para Inmovilizar (Prisión) */
  canFormPhysicalPrison: boolean;
  /** Puede desatar una tormenta/ataque masivo en área de 20 pies (Tormenta) */
  canFormAreaStorm: boolean;
  /** Puede generar impacto/estallido táctico que Desarme y Ensordezca (Choque Desarmador) */
  canFormDisarmingShock: boolean;
  /** Posee afinidad vital, purificadora o regeneradora para curar PV (Pulso Regenerador) */
  canHealVitality: boolean;
  /** Evoluciones o sub-elementos afines sugeridos (ej. fuego -> magma, agua -> hielo) */
  suggestedEvolutions?: string[];
  /** Motivos específicos por capacidad cuando no es viable */
  customReasons?: Partial<Record<'armor' | 'prison' | 'storm' | 'disarm' | 'heal', string>>;
}

export const NATURE_ELEMENTAL_CAPABILITIES: Record<string, NatureElementalCapabilities> = {
  fuego: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['magma'],
    customReasons: {
      armor:
        'El fuego es llama intangible y no puede formar una coraza física sólida que frene golpes. Si desbloqueás Magma, podrás forjar Égida de Magma.',
      prison:
        'Las llamas queman pero no sujetan físicamente el cuerpo para Inmovilizar. Si desbloqueás Magma, podrás endurecer una Prisión volcánica.',
      heal: 'El fuego cauteriza o destruye tejido; no posee afinidad vital para regenerar PV.',
    },
  },
  agua: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: true,
    suggestedEvolutions: ['hielo'],
    customReasons: {
      armor:
        'El agua líquida cede ante impactos directos y no forma una armadura sólida rígida. Si desbloqueás Hielo, podrás crear Égida de Hielo.',
    },
  },
  hielo: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['agua'],
    customReasons: {
      heal: 'El hielo congela o adormece, pero no regenera tejido vivo. Desbloqueá Agua o una afinidad curativa para Pulso Regenerador.',
    },
  },
  aire: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['tormenta', 'rayo'],
    customReasons: {
      armor:
        'El aire es gaseoso e intangible; puede desviar ataques pero no formar una armadura sólida rígida.',
      prison:
        'El viento empuja y desequilibra, pero no aprisiona sólidamente al objetivo para Inmovilizarlo durante turnos.',
      heal: 'El viento no posee afinidad vital para regenerar PV.',
    },
  },
  rayo: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['tormenta', 'metal'],
    customReasons: {
      armor:
        'La electricidad es descarga pura sin masa; no puede sostener una coraza sólida que detenga golpes físicos.',
      prison:
        'El rayo electrocuta al instante, pero no materializa ataduras físicas que mantengan Inmovilizado al rival.',
      heal: 'La electricidad no regenera tejido ni restaura PV.',
    },
  },
  tierra: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['magma', 'metal', 'flora'],
    customReasons: {
      heal: 'La roca ofrece coraza y contundencia, pero no regenera tejido vivo.',
    },
  },
  flora: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: true,
    suggestedEvolutions: ['veneno', 'tierra'],
    customReasons: {
      disarm:
        'La flora puede enredar o arrancar un arma con lianas, pero no genera un estallido acústico capaz de Ensordecer.',
    },
  },
  tormenta: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['hielo', 'agua'],
    customReasons: {
      armor:
        'La tormenta combina viento y relámpagos intangibles; no conforma una armadura física sólida. Desbloqueá Hielo para Égida de Hielo.',
      prison:
        'El clima tempestuoso golpea la zona, pero no aprisiona sólidamente al rival. Desbloqueá Hielo para congelar en prisión.',
      heal: 'Las fuerzas climáticas destructivas no regeneran PV.',
    },
  },
  magma: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['tierra', 'metal'],
    customReasons: {
      heal: 'El magma fundido incinera; no posee propiedades curativas.',
    },
  },
  metal: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['alquimia', 'tierra'],
    customReasons: {
      heal: 'El metal forjado protege y corta, pero no regenera tejido orgánico.',
    },
  },
  sonico: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['aire', 'espacio'],
    customReasons: {
      armor:
        'Las ondas sonoras son vibraciones intangibles en el aire y no pueden formar una coraza sólida.',
      prison:
        'El sonido aturde y empuja, pero no inmoviliza físicamente con una prisión sólida.',
      heal: 'Las ondas sonoras no regeneran tejido herido.',
    },
  },
  luz: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: true,
    suggestedEvolutions: ['eclipse', 'runas'],
    customReasons: {
      armor:
        'La luz pura es energía fotónica intangible; no forma una armadura material sólida (desbloqueá Eclipse o Runas para forjar Égida).',
      prison:
        'La luz ciega y quema, pero no ata físicamente el cuerpo sin sellos rúnicos o sombra sólida.',
      disarm:
        'La luz pura no produce estruendo acústico para Ensordecer (su especialidad táctica es Cegar).',
    },
  },
  sombra: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: false,
    suggestedEvolutions: ['eclipse', 'vacio'],
    customReasons: {
      disarm:
        'Las sombras actúan en silencio y no generan un estallido acústico capaz de Ensordecer.',
      heal: 'La oscuridad corrompe y debilita; no regenera PV.',
    },
  },
  eclipse: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: true,
    suggestedEvolutions: ['luz', 'sombra'],
    customReasons: {
      disarm:
        'El eclipse combina luz y sombra silenciosa; no produce una detonación acústica para Ensordecer.',
    },
  },
  vacio: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['sombra', 'espacio'],
    customReasons: {
      armor: 'El vacío es ausencia y anulación de materia; no construye armaduras físicas sólidas.',
      prison: 'El vacío desgarra y consume, pero no forma una prisión física sólida.',
      heal: 'El vacío drena y corrompe; jamás regenera vitalidad.',
    },
  },
  tiempo: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: false,
    canFormDisarmingShock: false,
    canHealVitality: true,
    suggestedEvolutions: ['espacio', 'gravedad'],
    customReasons: {
      armor: 'La cronomancia altera el flujo temporal, no fabrica una armadura física sólida.',
      storm: 'El tiempo no convoca tormentas elementales destructivas en un radio de 20 pies.',
      disarm: 'Alterar el tiempo no produce un estruendo acústico para Ensordecer.',
    },
  },
  gravedad: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['espacio', 'tierra'],
    customReasons: {
      armor:
        'La gravedad manipula peso y atracción, pero no materializa una coraza física detonable.',
      heal: 'La gravitomancia no posee afinidad vital para regenerar PV.',
    },
  },
  espacio: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['gravedad', 'tiempo'],
    customReasons: {
      heal: 'La telequinesis y el espacio desplazan materia, no regeneran tejido herido.',
    },
  },
  portales: {
    canFormSolidArmor: false,
    canFormMantle: false,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: false,
    canFormPhysicalPrison: false,
    canFormAreaStorm: false,
    canFormDisarmingShock: false,
    canHealVitality: false,
    suggestedEvolutions: ['espacio', 'vacio'],
    customReasons: {
      armor: 'Los portales conectan o redirigen trayectorias, pero no forman una coraza sólida.',
      prison: 'La magia de portales no retiene físicamente a un objetivo con las reglas de combate actuales.',
      storm: 'Abrir umbrales no produce por sí mismo un ataque de área masivo.',
      disarm: 'La magia de portales no genera por sí misma el impacto acústico de un choque desarmador.',
      heal: 'Los portales desplazan materia, pero no regeneran tejido herido.',
    },
  },
  explosion: {
    canFormSolidArmor: false,
    canFormMantle: false,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['aire', 'sonico', 'espacio'],
    customReasons: {
      armor: 'La fuerza explosiva produce impactos, no una coraza sólida que mitigue golpes.',
      prison: 'Una detonación puede empujar o derribar, pero no mantiene al objetivo inmovilizado.',
      heal: 'La fuerza explosiva no regenera tejido herido.',
    },
  },
  runas: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['alquimia', 'luz'],
    customReasons: {
      heal: 'Las runas de sigilo anclan y detonan; requieren Alquimia o Luz para sanación avanzada.',
    },
  },
  arcano: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['runas', 'espacio', 'luz'],
    customReasons: {
      armor:
        'El maná arcano puro carece de densidad material para una Égida sólida (usá Escudo Mágico o desbloqueá un elemento sólido / Runas / Espacio).',
      prison:
        'La meta-magia pura canaliza energía, pero no materializa ataduras físicas sin Runas o un elemento de contención.',
      heal: 'El maná arcano puro no regenera tejido más allá de Curar Heridas Leves.',
    },
  },
  mente: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['arcano', 'sombra'],
    customReasons: {
      armor:
        'Las ilusiones y la energía psíquica no detienen físicamente un golpe con una coraza sólida.',
      heal: 'La magia mental actúa sobre la psique, no sutura heridas físicas.',
    },
  },
  alquimia: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: true,
    canFormAreaStorm: true,
    canFormDisarmingShock: true,
    canHealVitality: true,
    suggestedEvolutions: ['metal', 'veneno'],
  },
  veneno: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: false,
    suggestedEvolutions: ['flora', 'alquimia'],
    customReasons: {
      armor: 'El ácido y las toxinas corroen la materia; no forman una armadura física protectora.',
      prison: 'El veneno debilita y disuelve, pero no crea ataduras sólidas para Inmovilizar.',
      disarm:
        'Las toxinas actúan por corrosión o espasmo, sin producir una detonación acústica que Ensordezca.',
      heal: 'El veneno marchita y daña; no restaura PV.',
    },
  },
  sangre: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: true,
    suggestedEvolutions: ['drenaje', 'alquimia'],
    customReasons: {
      armor:
        'La sangre es un fluido vital; no conforma una coraza rígida sólida capaz de frenar 5 de daño físico.',
      prison: 'La sangre líquida no sostiene una prisión sólida rígida durante varios turnos.',
      disarm: 'La hemomancia no produce onda acústica para Ensordecer.',
    },
  },
  drenaje: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: true,
    canFormDisarmingShock: false,
    canHealVitality: false,
    suggestedEvolutions: ['sangre', 'sombra'],
    customReasons: {
      armor: 'El drenaje absorbe energía pero no materializa corazas físicas sólidas.',
      prison: 'Las maldiciones debilitan al objetivo, pero no construyen una prisión física sólida.',
      disarm: 'El drenaje debilita en silencio; no genera estruendo para Ensordecer.',
      heal: 'El drenaje roba vitalidad al atacar, pero no canaliza curación regenerativa directa.',
    },
  },
  transformacion_garras: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: false,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['cuerpo_reforzado', 'transformacion_mordida'],
    customReasons: {
      armor:
        'La forma bestial de garras prioriza agilidad ofensiva, no proyecta una armadura elemental detonable.',
      prison: 'La magia bestial física no proyecta prisiones elementales a distancia.',
      storm: 'Un estilo bestial cuerpo a cuerpo no invoca tormentas elementales de 20 pies.',
      heal: 'La variante de garras no incluye regeneración vital de tejido.',
    },
  },
  transformacion_mordida: {
    canFormSolidArmor: false,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: false,
    canFormDisarmingShock: true,
    canHealVitality: true,
    suggestedEvolutions: ['cuerpo_reforzado', 'sangre'],
    customReasons: {
      armor:
        'La transformación depredadora no materializa una armadura elemental sólida detonable.',
      prison: 'No proyecta prisiones elementales a distancia.',
      storm: 'Un estilo depredador físico no invoca tormentas elementales de 20 pies.',
    },
  },
  cuerpo_reforzado: {
    canFormSolidArmor: true,
    canFormMantle: true,
    canFormPiercingLance: true,
    canFormKnockoutJudgment: true,
    canFormPhysicalPrison: false,
    canFormAreaStorm: false,
    canFormDisarmingShock: true,
    canHealVitality: false,
    suggestedEvolutions: ['tierra', 'metal'],
    customReasons: {
      prison: 'El refuerzo corporal actúa sobre tu propio cuerpo y no crea prisiones a distancia.',
      storm: 'El combate marcial reforzado no conjura tormentas elementales de 20 pies.',
      heal: 'Endurecer la piel mitiga impactos, pero no regenera PV.',
    },
  },
};

export function getNatureShortName(natureId: string): string {
  return (
    NATURE_SHORT_ELEMENT_MAP[natureId] ||
    MAGE_NATURES.find((n) => n.id === natureId)?.label.split('/')[0].trim() ||
    natureId
  );
}

export function getSuggestedNatureEvolutions(natureId: string): string[] {
  return NATURE_ELEMENTAL_CAPABILITIES[natureId]?.suggestedEvolutions || [];
}

export function getCharacterOwnedNatureIds(
  character?: Pick<Character, 'nature' | 'unlockedNatures'>
): string[] {
  const primary = resolveNaturePresetForCharacter(character).preset.id;
  const extras = Array.isArray(character?.unlockedNatures) ? character.unlockedNatures : [];
  return Array.from(new Set([primary, ...extras]));
}

export interface SpellElementalCompatibility {
  compatible: boolean;
  reason?: string;
  suggestedNatureIds?: string[];
  tacticalNote?: string;
}

export function evaluateCatalogSpellCompatibility(
  template: Spell,
  natureId: string,
  elementName: string
): SpellElementalCompatibility {
  // Foco Arcano triad uses pure universal mana (compatible with any nature, still locked under key)
  if (
    template.id === 'basic_foco_arcano' ||
    template.id === 'basic_descarga_focalizada' ||
    template.id === 'basic_estallido_conmocionante'
  ) {
    return {
      compatible: true,
      tacticalNote: 'Técnica universal de maná puro (compatible con cualquier naturaleza).',
    };
  }

  const caps =
    NATURE_ELEMENTAL_CAPABILITIES[natureId] || NATURE_ELEMENTAL_CAPABILITIES.arcano;

  const filterCompatibleSuggestions = (
    checker: (c: NatureElementalCapabilities) => boolean,
    fallback: string[]
  ): string[] => {
    const preferred = (caps.suggestedEvolutions || []).filter((id) => {
      const targetCaps = NATURE_ELEMENTAL_CAPABILITIES[id];
      return targetCaps ? checker(targetCaps) : false;
    });
    return preferred.length > 0 ? preferred : fallback;
  };

  switch (template.id) {
    case 'cat_egida_elemental':
      if (!caps.canFormSolidArmor) {
        return {
          compatible: false,
          reason:
            caps.customReasons?.armor ||
            `${elementName} no tiene solidez física suficiente para sostener una Égida que mitigue golpes directos.`,
          suggestedNatureIds: filterCompatibleSuggestions(
            (c) => c.canFormSolidArmor,
            ['magma', 'tierra', 'hielo', 'metal']
          ),
        };
      }
      return { compatible: true };

    case 'cat_ruptura_egida':
      if (!caps.canFormSolidArmor) {
        return {
          compatible: false,
          reason: `Depende de Égida de ${elementName}: sin poder formar una armadura sólida previa, no hay coraza que detonar en área.`,
          suggestedNatureIds: filterCompatibleSuggestions(
            (c) => c.canFormSolidArmor,
            ['magma', 'tierra', 'hielo', 'metal']
          ),
        };
      }
      return { compatible: true };

    case 'cat_manto_elemental':
      return caps.canFormMantle
        ? { compatible: true }
        : {
            compatible: false,
            reason: `${elementName} no puede proyectar un manto envolvente.`,
          };

    case 'cat_lanza_perforante':
      return caps.canFormPiercingLance
        ? { compatible: true }
        : {
            compatible: false,
            reason: `${elementName} no puede concentrarse en un impacto perforante.`,
          };

    case 'cat_juicio_elemental':
      return caps.canFormKnockoutJudgment
        ? { compatible: true }
        : {
            compatible: false,
            reason: `${elementName} no puede descargar un impacto abrumador capaz de Noquear.`,
          };

    case 'cat_prision_elemental':
      if (!caps.canFormPhysicalPrison) {
        return {
          compatible: false,
          reason:
            caps.customReasons?.prison ||
            `${elementName} no puede apresar o fijar físicamente al rival para Inmovilizarlo durante 2 turnos.`,
          suggestedNatureIds: filterCompatibleSuggestions(
            (c) => c.canFormPhysicalPrison,
            ['tierra', 'hielo', 'flora', 'magma']
          ),
        };
      }
      return { compatible: true };

    case 'cat_sentencia_atrapado':
      if (!caps.canFormPiercingLance) {
        return {
          compatible: false,
          reason: `${elementName} no puede ejecutar este remate concentrado.`,
        };
      }
      return {
        compatible: true,
        tacticalNote: !caps.canFormPhysicalPrison
          ? `Sinergia de equipo: ${elementName} no puede lanzar Prisión, pero sí ejecutar este remate sobre un objetivo inmovilizado por un aliado.`
          : undefined,
      };

    case 'cat_tormenta_elemental':
      if (!caps.canFormAreaStorm) {
        return {
          compatible: false,
          reason:
            caps.customReasons?.storm ||
            `${elementName} no puede desatar una tormenta elemental en un radio de 20 pies.`,
          suggestedNatureIds: filterCompatibleSuggestions(
            (c) => c.canFormAreaStorm,
            ['fuego', 'rayo', 'tormenta', 'tierra']
          ),
        };
      }
      return { compatible: true };

    case 'cat_choque_desarmador':
      if (!caps.canFormDisarmingShock) {
        return {
          compatible: false,
          reason:
            caps.customReasons?.disarm ||
            `${elementName} no genera el estallido táctico y sonoro necesario para Desarmar y Ensordecer.`,
          suggestedNatureIds: filterCompatibleSuggestions(
            (c) => c.canFormDisarmingShock,
            ['sonico', 'rayo', 'aire', 'tierra']
          ),
        };
      }
      return { compatible: true };

    case 'cat_pulso_regenerador':
      if (!caps.canHealVitality) {
        return {
          compatible: false,
          reason:
            caps.customReasons?.heal ||
            `${elementName} no posee afinidad vital o restauradora para curar PV.`,
          suggestedNatureIds: filterCompatibleSuggestions(
            (c) => c.canHealVitality,
            ['agua', 'flora', 'luz', 'alquimia']
          ),
        };
      }
      return { compatible: true };

    default:
      return { compatible: true };
  }
}
export const STARTER_BEAST_PROFILES: BeastProfile[] = [
  {
    id: 'beast_frost_wolf',
    name: 'Lobo de Escarcha',
    species: 'Cánido salvaje',
    role: 'Acechador de manada',
    hpMax: 16,
    manaMax: 6,
    stats: { fisico: 2, manipulacion: 2, influencia: 1 },
    statPoints: { fisico: 2, manipulacion: 2, influencia: 1 },
    attackName: 'Mordisco de Escarcha',
    attackStat: 'fisico',
    attackDice: [{ type: 'd6', count: 1 }],
    attackBonus: 1,
    attackDamageKind: 'fisico',
    notes: 'Rápido y coordinado; ideal para flanquear al objetivo cuando está Vinculado.',
    resistances: 'Frío ÷2',
    musicSynergyNote: 'Responde a cantos o compases de caza de Músico / Bardo.',
    isPreset: true,
  },
  {
    id: 'beast_iron_bear',
    name: 'Oso de Montaña',
    species: 'Úrsido pesado',
    role: 'Vanguardia / Impacto',
    hpMax: 26,
    manaMax: 4,
    stats: { fisico: 3, manipulacion: 1, influencia: 1 },
    statPoints: { fisico: 3, manipulacion: 1, influencia: 1 },
    attackName: 'Zarpazo Devastador',
    attackStat: 'fisico',
    attackDice: [{ type: 'd8', count: 1 }],
    attackBonus: 2,
    attackDamageKind: 'fisico',
    notes: 'Alta resistencia física y contundencia; excelente para retener enemigos en primera línea.',
    resistances: 'Físico -1',
    musicSynergyNote: 'Los tambores o cantos graves refuerzan su presencia en combate.',
    isPreset: true,
  },
  {
    id: 'beast_storm_hawk',
    name: 'Rapaz de Tormenta',
    species: 'Ave de presa',
    role: 'Hostigador / Explorador',
    hpMax: 12,
    manaMax: 8,
    stats: { fisico: 1, manipulacion: 3, influencia: 1 },
    statPoints: { fisico: 1, manipulacion: 3, influencia: 1 },
    attackName: 'Picada Fulminante',
    attackStat: 'manipulacion',
    attackDice: [{ type: 'd6', count: 1 }],
    attackBonus: 0,
    attackDamageKind: 'magico',
    notes: 'Ataca desde altura con precisión y hostiga sin quedarse expuesto.',
    resistances: 'Rayo ÷2',
    musicSynergyNote: 'Coordina picadas al ritmo de flauta, ocarina o voz.',
    isPreset: true,
  },
  {
    id: 'beast_bristle_boar',
    name: 'Jabalí de Colmillos',
    species: 'Bestia terrestre',
    role: 'Embestida / Resistencia',
    hpMax: 18,
    manaMax: 5,
    stats: { fisico: 2, manipulacion: 1, influencia: 2 },
    statPoints: { fisico: 2, manipulacion: 1, influencia: 2 },
    attackName: 'Embestida Brutal',
    attackStat: 'fisico',
    attackDice: [{ type: 'd6', count: 1 }],
    attackBonus: 2,
    attackDamageKind: 'fisico',
    notes: 'Embestida firme y terca; buena base para pruebas de doma o control instintivo.',
    resistances: 'Aturdir resistente',
    musicSynergyNote: 'Puede calmarse o encauzarse con melodías suaves si ya está Vinculado.',
    isPreset: true,
  },
];

export function createCharacterFromBeastProfile(
  
  profile: BeastProfile,
  options?: {
    customName?: string;
    masterId?: string;
    setLinkedStatus?: boolean;
    formula?: FormulaConfig;
  }
): Character {
  
  const charId = generateId('beast_char_');
  const displayName = options?.customName?.trim() || profile.name;
  const stats = {
    fisico: Math.max(1, profile.stats?.fisico ?? 1),
    manipulacion: Math.max(1, profile.stats?.manipulacion ?? 1),
    influencia: Math.max(1, profile.stats?.influencia ?? 1),
  };
  const statPoints = {
    fisico: getPointsForDesiredStatLevel(stats.fisico, options?.formula),
    manipulacion: getPointsForDesiredStatLevel(stats.manipulacion, options?.formula),
    influencia: getPointsForDesiredStatLevel(stats.influencia, options?.formula),
  };
  const hpMax = Math.max(1, profile.hpMax || 15);
  const manaMax = Math.max(0, profile.manaMax || 5);
 

  const baseAttackName = profile.attackName || 'Ataque bestial';
  const weaponName =
    profile.attackBonus && profile.attackBonus !== 0
      ? `${baseAttackName} (${profile.attackBonus > 0 ? `+${profile.attackBonus}` : profile.attackBonus})`
      : baseAttackName;

  const attackStat = profile.attackStat || 'fisico';
  const attackBonus = profile.attackBonus || 0;
  const naturalWeapon: CharacterWeapon = {
    id: generateId('wp_beast_'),
    presetId: `beast_natural:${attackBonus}:${attackStat}`,
    name: weaponName,
    category: 'natural',
    dice:
      profile.attackDice && profile.attackDice.length > 0
        ? profile.attackDice.map((d) => ({ ...d }))
        : [{ type: 'd6', count: 1 }],
    isNatural: true,
    isMagicalCatalyst: profile.attackDamageKind === 'magico',
  };
  
  const defaultKnownSpells = [
    'basic_esquiva_fisica',
    ...(manaMax > 0 ? ['basic_proteccion'] : []),
  ];

  return {
    id: charId,
    name: displayName,
    kind: 'npc',
    isBeastProfile: true,
    beastBondMasterId: options?.masterId,
    stats,
    statPoints,
    hp: { current: hpMax, max: hpMax },
    mana: { current: manaMax, max: manaMax },
    knownSpells: defaultKnownSpells,
    spellMastery: {},
    weapons: [naturalWeapon],
    condition: 'active',
    notes: `${profile.species} · ${profile.role}. Ataque: ${baseAttackName} (${profile.attackDice
      .map((d: DamageDie) => `${d.count}${d.type}`)
      .join(' + ')}${profile.attackBonus ? ` + ${profile.attackBonus}` : ''}). ${profile.notes}${
      options?.setLinkedStatus ? ' [Estado inicial: Vinculado]' : ''
    }`,
    resistances: profile.resistances || '',
    characterLevel: 1,
    progressionHistory: [],
  };
}

export function buildBeastTamerSpells(params: {
  charId: string;
  includeMusicBridge?: boolean;
}): Spell[] {
  const { charId, includeMusicBridge = true } = params;
  const baseSpells: Spell[] = [
    {
      id: generateId('sp_doma_link_'),
      name: 'Canalizar Vínculo',
      manaCost: 2,
      orders: ['Domar', 'Vínculo', 'Instinto'],
      statuses: ['Vinculado'],
      castRequirement: 'none',
      castStat: 'influencia',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: ['influencia'],
      damageMode: 'auto',
      effectType: 'effect',
      effectSubType: 'general',
      damage: { dice: [], bonus: 0, notes: '' },
      effectDescription:
        'Hechizo canalizado o de efecto (sin requerir música): establece el estado «Vinculado» sobre una bestia u objetivo mediante tirada de Influencia. Permanece activo hasta que se disipe o cancele.',
      duration: 'Hasta ser disipado',
      isBasic: false,
      ownerCharacterId: charId,
    },
    {
      id: generateId('sp_doma_tame_'),
      name: 'Domar Bestia Salvaje',
      manaCost: 3,
      orders: ['Domar', 'Vínculo', 'Instinto'],
      statuses: ['Vinculado'],
      castRequirement: 'none',
      castStat: 'influencia',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: ['influencia'],
      damageMode: 'auto',
      effectType: 'effect',
      effectSubType: 'general',
      damage: { dice: [], bonus: 0, notes: '' },
      effectDescription:
        'Intenta someter y vincular a una bestia salvaje mediante tirada de Influencia. Si tiene éxito, la bestia queda Vinculada hasta que el efecto sea disipado.',
      duration: 'Hasta ser disipado',
      isBasic: false,
      ownerCharacterId: charId,
    },
    {
      id: generateId('sp_doma_pack_'),
      name: 'Llamado de Manada',
      manaCost: 2,
      orders: ['Manada', 'Vínculo', 'Domar'],
      statuses: [],
      castRequirement: 'none',
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: [],
      damageMode: 'auto',
      effectType: 'effect',
      effectSubType: 'buff',
      damage: { dice: [], bonus: 0, notes: '' },
      effectDescription:
        'Coordina a una bestia o aliado Vinculado para actuar o sostener el vínculo instintivo durante este turno.',
      duration: '1 turno',
      durationTurns: 1,
      isBasic: false,
      ownerCharacterId: charId,
    },
  ];

  if (includeMusicBridge) {
    baseSpells.push({
      id: generateId('sp_doma_canto_'),
      name: 'Compás de Doma (Canto / Música)',
      manaCost: 2,
      orders: ['Canto', 'Vínculo', 'Manada'],
      statuses: [],
      castRequirement: 'none',
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: [],
      damageMode: 'auto',
      effectType: 'effect',
      effectSubType: 'buff',
      damage: { dice: [], bonus: 0, notes: '' },
      effectDescription:
        'Integración opcional con Músico / Bardo: refuerza la armonía con un objetivo ya Vinculado mediante ritmo o canto (no reemplaza la canalización ni el efecto de vínculo).',
      duration: '2 turnos',
      durationTurns: 2,
      isBasic: false,
      ownerCharacterId: charId,
    });
  }

  return baseSpells;
}