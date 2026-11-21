import type { CombatStatusKey, ElementalStatusKind, SynergyReactionType } from '../types/rpg';
import {
  COMBAT_STATUS_MECHANICS,
  ELEMENTAL_STATUS_META,
} from './dice';

export type CombatMechanicCategory = 'elemental' | 'synergy' | 'control' | 'special';
export type CombatMechanicId =
  | `elemental:${ElementalStatusKind}`
  | `synergy:${Exclude<SynergyReactionType, 'none'>}`
  | `control:${CombatStatusKey}`
  | 'special:electrical-chain';

export interface CombatMechanicRecord {
  id: CombatMechanicId;
  category: CombatMechanicCategory;
  name: string;
  icon: string;
  element?: string;
  quick: string;
  rules: Array<{ title: string; text: string }>;
  example?: string;
  related: CombatMechanicId[];
  historyTerms: string[];
}

const ELEMENTAL_DETAILS: Record<
  ElementalStatusKind,
  Omit<CombatMechanicRecord, 'id' | 'category' | 'name'>
> = {
  burn: {
    icon: 'flame',
    element: 'Fuego',
    quick: 'El objetivo conserva cargas de Quemadura. Cada carga causa daño al inicio de su turno hasta expirar o ser consumida.',
    example: 'Con 2 cargas activas y el dado predeterminado, el próximo inicio de turno tira 2d4 mágico, salvo que alguna carga expire o se consuma antes.',
    rules: [
      {
        title: 'Aplicación',
        text: 'El reconocimiento automático usa el nombre, las órdenes y la nota de daño del hechizo. Si es un ataque de fuego, causa daño y al menos un dado muestra su valor máximo, aplica una carga por cada dado máximo. Una configuración elemental explícita puede cambiar el disparador y la cantidad; en el ataque normal sigue necesitando daño final positivo.',
      },
      {
        title: 'Daño y duración',
        text: `La aplicación automática base usa ${ELEMENTAL_STATUS_META.burn.defaultTickDie} mágico por carga al inicio del turno y dura ${ELEMENTAL_STATUS_META.burn.defaultDuration} turnos. Las cargas tienen contadores independientes; se muestra la cantidad y el tiempo de cada una.`,
      },
      {
        title: 'Acumulación y final',
        text: 'Se acumula hasta 10 cargas. Si ya está al máximo, una nueva carga solo reemplaza la que vence antes cuando su duración nueva es mayor. Las cargas expiran por separado; Detonar Quemadura consume primero las de menor duración restante.',
      },
      {
        title: 'Interacción',
        text: 'Detonar Quemadura inflige 1d6 mágico por cada carga consumida. También puede existir una reacción configurada en un hechizo.',
      },
    ],
    related: ['synergy:detonate_burn'],
    historyTerms: ['quemadura', 'quemaduras', 'fuego', 'detonación de', 'detonar quemadura'],
  },
  poison: {
    icon: 'flask',
    element: 'Veneno / toxinas',
    quick: 'El veneno deja cargas que dañan al objetivo al inicio de sus turnos. El número de cargas también determina el daño continuo.',
    example: 'Si el objetivo conserva 3 cargas, el próximo inicio de turno tira 3d4 mágico con la configuración predeterminada.',
    rules: [
      {
        title: 'Aplicación',
        text: 'La detección automática reconoce términos de veneno, toxina, ácido, corrosión o esporas en el nombre, las órdenes o la nota del daño. Con daño positivo, cada dado en la mitad superior puede aplicar una carga. Una configuración explícita puede cambiar el disparador y la cantidad.',
      },
      {
        title: 'Daño y duración',
        text: `El valor automático base es ${ELEMENTAL_STATUS_META.poison.defaultTickDie} mágico por carga al inicio del turno durante ${ELEMENTAL_STATUS_META.poison.defaultDuration} turnos. Cada carga conserva su duración restante.`,
      },
      {
        title: 'Acumulación y final',
        text: 'Se acumula hasta 10 cargas. Las cargas expiran por separado y las reacciones consumen primero las que vencen antes. Sifón Tóxico consume las cargas indicadas por el hechizo o una por defecto.',
      },
      {
        title: 'Interacción',
        text: 'Sifón Tóxico inflige 1d4 mágico por carga consumida y puede devolver PV y Maná al lanzador; la recuperación no ocurre si el lanzador también es el objetivo.',
      },
    ],
    related: ['synergy:siphon_poison'],
    historyTerms: ['envenenado', 'veneno', 'tóxico', 'toxina', 'sifón', 'sifonar'],
  },
  frozen: {
    icon: 'snowflake',
    element: 'Hielo / frío',
    quick: 'El frío puede dejar Congelado al objetivo. Cada carga causa daño periódico y puede consumirse para quebrarlo.',
    example: 'Una carga predeterminada de Congelado causa 1d4 mágico al inicio de turno; Quebrar puede consumirla antes y causar 1d8 físico.',
    rules: [
      {
        title: 'Aplicación',
        text: 'La detección automática reconoce hielo o frío en el nombre, las órdenes o la nota del daño. Con daño positivo, al menos un dado en la mitad superior aplica una carga.',
      },
      {
        title: 'Daño y duración',
        text: `La aplicación automática dura ${ELEMENTAL_STATUS_META.frozen.defaultDuration} turnos. Aunque esa ruta pasa el dado como indefinido, el helper asigna el dado predeterminado (${ELEMENTAL_STATUS_META.frozen.defaultTickDie}) y el tipo de daño predeterminado (${ELEMENTAL_STATUS_META.frozen.defaultDamageKind}); por eso causa 1d4 mágico por carga al inicio del turno.`,
      },
      {
        title: 'Acumulación y final',
        text: 'Admite hasta 10 cargas con duraciones independientes. Una nueva carga no extiende las demás; al alcanzar el máximo solo reemplaza una carga de menor duración si la nueva dura más. Quebrar Congelado consume primero las cargas próximas a expirar.',
      },
      {
        title: 'Interacción',
        text: 'Fractura Glacial inflige 1d8 físico por carga consumida.',
      },
    ],
    related: ['synergy:shatter_frozen'],
    historyTerms: ['congelado', 'hielo', 'frío', 'escarcha', 'fractura glacial', 'quebrar congelado'],
  },
  electrified: {
    icon: 'zap',
    element: 'Electricidad / rayo',
    quick: 'Electrificado marca un objetivo como conductor; no causa daño periódico por defecto, pero puede conectar con otros objetivos electrificados.',
    example: 'Un objetivo con 2 cargas Electrificado no recibe tick por defecto; un impacto de rayo puede descargar 2d4 mágico sobre él si no es atacante ni blanco del impacto.',
    rules: [
      {
        title: 'Aplicación',
        text: `La detección automática reconoce electricidad o rayo. Con un impacto que cause daño, aplica una carga durante ${ELEMENTAL_STATUS_META.electrified.defaultDuration} turnos.`,
      },
      {
        title: 'Daño y duración',
        text: 'La aplicación automática no configura dado periódico: Electrificado no causa daño al inicio del turno por defecto. El contador de cada carga sigue avanzando y el estado desaparece al expirar la última.',
      },
      {
        title: 'Acumulación y final',
        text: 'Se acumula hasta 10 cargas con duración independiente. La expansión automática y la Sobrecarga son efectos diferentes; la segunda consume cargas.',
      },
      {
        title: 'Interacción',
        text: 'Al impactar con electricidad, otros combatientes vivos Electrificados (excepto atacante y objetivo del impacto) reciben 1d4 mágico por carga, sin consumirla. Sobrecarga de Antena inflige 1d6 mágico por carga consumida a todos los Electrificados.',
      },
    ],
    related: ['special:electrical-chain', 'synergy:overload_electrified'],
    historyTerms: ['electrificado', 'electricidad', 'rayo', 'antena', 'sobrecarga'],
  },
  bleeding: {
    icon: 'droplet',
    element: 'Corte / hemorragia',
    quick: 'Sangrando deja cargas que causan daño físico al inicio de cada turno hasta expirar o ser consumidas.',
    example: 'Dos cargas activas de Sangrando causan 2d4 físico al inicio del turno con la configuración predeterminada.',
    rules: [
      {
        title: 'Aplicación',
        text: 'La detección automática reconoce cortes, filos y términos asociados en el nombre, las órdenes o la nota del daño. Con daño positivo aplica una carga.',
      },
      {
        title: 'Daño y duración',
        text: `La carga automática dura ${ELEMENTAL_STATUS_META.bleeding.defaultDuration} turnos y causa ${ELEMENTAL_STATUS_META.bleeding.defaultTickDie} físico al inicio del turno.`,
      },
      {
        title: 'Acumulación y final',
        text: 'Se acumula hasta 10 cargas con duraciones independientes. Hemorragia consume primero las cargas de menor duración restante.',
      },
      {
        title: 'Interacción',
        text: 'Hemorragia inflige 1d6 físico por cada carga consumida.',
      },
    ],
    related: ['synergy:hemorrhage_bleed'],
    historyTerms: ['sangrando', 'sangrado', 'hemorragia', 'desgarrar'],
  },
};

const ELEMENTAL_NAMES: Record<ElementalStatusKind, string> = {
  burn: ELEMENTAL_STATUS_META.burn.name,
  poison: ELEMENTAL_STATUS_META.poison.name,
  frozen: ELEMENTAL_STATUS_META.frozen.name,
  electrified: ELEMENTAL_STATUS_META.electrified.name,
  bleeding: ELEMENTAL_STATUS_META.bleeding.name,
};

const ELEMENTAL_ORDER: ElementalStatusKind[] = [
  'burn',
  'poison',
  'frozen',
  'electrified',
  'bleeding',
];

const ELEMENTAL_RECORDS: CombatMechanicRecord[] = ELEMENTAL_ORDER.map((kind) => ({
  id: `elemental:${kind}`,
  category: 'elemental',
  name: ELEMENTAL_NAMES[kind],
  ...ELEMENTAL_DETAILS[kind],
}));

const SYNERGY_DETAILS: Array<{
  id: Exclude<SynergyReactionType, 'none'>;
  name: string;
  icon: string;
  quick: string;
  example: string;
  requirement: string;
  effect: string;
  related: CombatMechanicId[];
  terms: string[];
}> = [
  {
    id: 'detonate_burn',
    name: 'Detonar Quemadura',
    icon: 'flame',
    quick: 'Consume cargas de Quemadura para infligir daño mágico explosivo.',
    example: 'Con 2 cargas y el consumo predeterminado, detonar consume 1 y tira 1d6 mágico; queda 1 carga si no expira.',
    requirement: 'El objetivo debe tener al menos una carga de Quemadura.',
    effect: 'Consume N cargas (una por defecto) y causa Nd6 de daño mágico al objetivo. Consume primero las cargas con menos turnos restantes. El número puede configurarse en el hechizo.',
    related: ['elemental:burn'],
    terms: ['detonar quemadura', 'detonación de quemadura', 'sinergia: detonar'],
  },
  {
    id: 'siphon_poison',
    name: 'Sifón de Envenenado',
    icon: 'flask',
    quick: 'Consume cargas de Envenenado para dañar al objetivo y, si es otra persona, recuperar recursos.',
    example: 'Con 1 carga y un resultado 3 en el d4 del sifón, el objetivo recibe 3 de daño adicional; otro lanzador recupera 2 PV y 1 Maná.',
    requirement: 'El objetivo debe tener al menos una carga de Envenenado.',
    effect: 'Consume N cargas (una por defecto) e inflige Nd4 mágico. Si lanzador y objetivo son distintos, el lanzador recupera max(1, ceil(daño de sifón / 2)) PV y N Maná. Si son la misma persona, no recupera PV ni Maná. Consume primero las cargas con menos turnos restantes.',
    related: ['elemental:poison'],
    terms: ['sifón tóxico', 'sifón de envenenado', 'sifonar envenenado'],
  },
  {
    id: 'shatter_frozen',
    name: 'Fractura Glacial',
    icon: 'snowflake',
    quick: 'Quiebra cargas de Congelado e inflige daño físico.',
    example: 'Con una carga de Congelado, el consumo predeterminado la retira y causa 1d8 físico al objetivo.',
    requirement: 'El objetivo debe tener al menos una carga de Congelado.',
    effect: 'Consume N cargas (una por defecto) e inflige Nd8 físico al objetivo. Consume primero las cargas con menos turnos restantes.',
    related: ['elemental:frozen'],
    terms: ['fractura glacial', 'fractura de congelado', 'quebrar congelado'],
  },
  {
    id: 'overload_electrified',
    name: 'Sobrecarga de Antena Eléctrica',
    icon: 'zap',
    quick: 'Descarga las cargas de todos los combatientes Electrificados e inflige daño mágico.',
    example: 'Si dos combatientes tienen una carga cada uno, la Sobrecarga tira 1d6 mágico para cada uno y consume ambas cargas.',
    requirement: 'Debe haber al menos un combatiente con cargas de Electrificado.',
    effect: 'Para cada combatiente Electrificado, consume N cargas (una por defecto) e inflige Nd6 mágico. La acción se inicia desde un objetivo, pero la ejecución incluye todos los combatientes Electrificados.',
    related: ['elemental:electrified', 'special:electrical-chain'],
    terms: ['sobrecarga de antena eléctrica', 'sobrecarga electrificada', 'descarga sobre electrificados'],
  },
  {
    id: 'hemorrhage_bleed',
    name: 'Hemorragia',
    icon: 'droplet',
    quick: 'Desgarra cargas de Sangrando para infligir daño físico.',
    example: 'Con una carga de Sangrando, el consumo predeterminado la retira y causa 1d6 físico al objetivo.',
    requirement: 'El objetivo debe tener al menos una carga de Sangrando.',
    effect: 'Consume N cargas (una por defecto) e inflige Nd6 físico al objetivo. Consume primero las cargas con menos turnos restantes.',
    related: ['elemental:bleeding'],
    terms: ['hemorragia', 'desgarrar sangrado', 'sinergia: hemorragia'],
  },
];

const SYNERGY_RECORDS: CombatMechanicRecord[] = SYNERGY_DETAILS.map((item) => ({
  id: `synergy:${item.id}`,
  category: 'synergy',
  name: item.name,
  icon: item.icon,
  quick: item.quick,
  example: item.example,
  rules: [
    { title: 'Requisito', text: item.requirement },
    {
      title: 'Activación y consumo',
      text: `${item.effect} Puede ejecutarse desde el botón de reacción manual o automáticamente tras un impacto/chequeo de estado cuando el hechizo tenga esta reacción configurada. La ejecución manual no descuenta acciones ni Maná en el ejecutor.`,
    },
    {
      title: 'Si no se cumple',
      text: 'Si no hay estado/cargas disponibles o no existe un objetivo de combate válido, la reacción no se ejecuta. Un hechizo de daño que la acompañe conserva su resolución directa.',
    },
  ],
  related: item.related,
  historyTerms: item.terms,
}));

const CONTROL_RELATIONS: Partial<Record<CombatStatusKey, CombatMechanicId[]>> = {
  aturdir: [],
  cegar: [],
  derribar: [],
  desarmar: [],
  empujar: ['control:derribar'],
  ensordecer: [],
  inmovilizar: [],
  noquear: ['control:aturdir'],
  ralentizar: [],
  silenciar: [],
  intimidar: [],
};

const CONTROL_ICONS: Record<CombatStatusKey, string> = {
  aturdir: 'dizzy',
  cegar: 'eye-off',
  derribar: 'person-standing',
  desarmar: 'swords',
  empujar: 'move',
  ensordecer: 'ear-off',
  inmovilizar: 'anchor',
  noquear: 'moon',
  ralentizar: 'snail',
  silenciar: 'volume-x',
  intimidar: 'shield-alert',
};

const CONTROL_ORDER: CombatStatusKey[] = [
  'aturdir',
  'cegar',
  'derribar',
  'desarmar',
  'empujar',
  'ensordecer',
  'inmovilizar',
  'noquear',
  'ralentizar',
  'silenciar',
  'intimidar',
];

const CONTROL_EXAMPLES: Record<CombatStatusKey, string> = {
  aturdir: 'Un objetivo Aturdido no puede actuar y los golpes que recibe son críticos automáticos; por defecto, el primer golpe recibido termina el estado.',
  cegar: 'Con 2 fallos automáticos configurados, un personaje cegado suma esos fallos a ataque y defensa, salvo que tenga inmunidad a Cegar.',
  derribar: 'Un personaje Derribado tiene fallos automáticos en ataque y defensa; puede usar «Levantarse», y el agregador no pone su movilidad en cero.',
  desarmar: 'Un personaje Desarmado usa una acción de su turno para recuperar el arma o escudo soltado.',
  empujar: 'Al impactar, Empujar quita la defensa y normalmente aplica Derribar; el estado de Empujar termina al siguiente golpe recibido.',
  ensordecer: 'Un personaje Ensordecido suma sus fallos automáticos a las pruebas de defensa, no a las de ataque.',
  inmovilizar: 'Un objetivo Inmovilizado no puede moverse, atacar ni defenderse; el estado no impide por sí solo todas sus acciones o reacciones.',
  noquear: 'Un objetivo Noqueado no actúa, reacciona, ataca, defiende ni lanza magia; los golpes que recibe son críticos automáticos.',
  ralentizar: 'Con Ralentizar, la movilidad se reduce a la mitad, se limita a una acción por turno y se agregan fallos automáticos a defensa.',
  silenciar: 'Un personaje Silenciado no puede lanzar o preparar magia ni usar reacciones mágicas.',
  intimidar: 'Un personaje Intimidado suma los fallos automáticos configurados a ataques y pruebas de Influencia.',
};

const CONTROL_RECORDS: CombatMechanicRecord[] = CONTROL_ORDER.map((key) => {
  const meta = COMBAT_STATUS_MECHANICS[key];
  const extra =
    key === 'cegar'
      ? 'Excepción: el agregador ignora sus fallos si el personaje tiene inmunidad a Cegar.'
      : key === 'empujar'
        ? 'En la aplicación normal, Empujar crea además un estado Derribar, salvo que Derribar ya se haya aplicado. La aplicación manual permite elegir si lo agrega.'
        : key === 'derribar'
          ? 'El agregador registra el estado derribado y sus fallos, pero no fija movilidad en cero. El objetivo puede usar «Levantarse».'
          : key === 'desarmar'
            ? 'No tiene contador de turnos; la interfaz ofrece recuperar el arma o escudo gastando una acción.'
            : key === 'aturdir'
              ? 'Por defecto se configura para terminar al recibir un golpe; se puede cambiar a duración por turnos.'
              : 'Su duración se toma del efecto que lo aplica; el estado puede quitarse manualmente.';
  return {
    id: `control:${key}`,
    category: 'control',
    name: meta.canonicalName,
    icon: CONTROL_ICONS[key],
    quick: meta.shortRule,
    example: CONTROL_EXAMPLES[key],
    rules: [
      { title: 'Qué hace', text: meta.detailedRule },
      {
        title: 'Duración y fin',
        text:
          key === 'aturdir'
            ? 'Por defecto termina al recibir un golpe; también puede configurarse por turnos.'
            : key === 'desarmar'
              ? 'Permanece hasta recuperar el arma o escudo con una acción.'
              : key === 'empujar'
                ? 'El efecto de retroceso termina al siguiente golpe; el Derribar asociado sigue la duración configurada o puede terminar cuando el objetivo se levanta.'
                : 'La duración proviene del hechizo o de la aplicación manual; puede quitarse desde la gestión de estados.',
      },
      { title: 'Excepciones y aplicación', text: extra },
    ],
    related: CONTROL_RELATIONS[key] || [],
    historyTerms: [meta.canonicalName, key],
  };
});

const SPECIAL_RECORDS: CombatMechanicRecord[] = [
  {
    id: 'special:electrical-chain',
    category: 'special',
    name: 'Expansión eléctrica de Antena',
    icon: 'zap',
    element: 'Electricidad / rayo',
    quick: 'Un impacto de rayo puede descargar a otros combatientes que ya estén Electrificados.',
    example: 'Si atacás con rayo a B y A tiene 2 cargas Electrificado, A recibe 2d4 mágico; B y el atacante quedan excluidos de esa expansión.',
    rules: [
      {
        title: 'Condición',
        text: 'Se activa al resolver un impacto eléctrico/rayo con daño total positivo. La identificación del elemento se basa en los términos del hechizo, sus órdenes/notas o su estado elemental explícito.',
      },
      {
        title: 'Efecto',
        text: 'Afecta a los demás combatientes vivos con cargas Electrificado; excluye al atacante y al objetivo del impacto. Cada afectado recibe Nd4 mágico, donde N es su cantidad de cargas.',
      },
      {
        title: 'Cargas y diferencias',
        text: 'No consume ni reduce las cargas. Es distinta de Sobrecarga de Antena, que se ejecuta como reacción, consume cargas y causa Nd6 mágico.',
      },
    ],
    related: ['elemental:electrified', 'synergy:overload_electrified'],
    historyTerms: ['expansión eléctrica', 'antena eléctrica', 'salta a los objetivos electrificados'],
  },
];

export const COMBAT_MECHANIC_CATALOG: CombatMechanicRecord[] = [
  ...ELEMENTAL_RECORDS,
  ...SYNERGY_RECORDS,
  ...SPECIAL_RECORDS,
  ...CONTROL_RECORDS,
];

export function getCombatMechanic(
  id: string | undefined
): CombatMechanicRecord | undefined {
  return COMBAT_MECHANIC_CATALOG.find((item) => item.id === id);
}

export function getMechanicsMentionedInLog(text: string): CombatMechanicId[] {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return COMBAT_MECHANIC_CATALOG.filter((item) =>
    item.historyTerms.some((term) =>
      normalized.includes(
        term
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
      )
    )
  )
    .slice(0, 4)
    .map((item) => item.id);
}

export function getElementalMechanicId(
  kind: ElementalStatusKind
): CombatMechanicId {
  return `elemental:${kind}`;
}

export function getControlMechanicId(
  key: CombatStatusKey
): CombatMechanicId {
  return `control:${key}`;
}

export function getSynergyMechanicId(
  reaction: Exclude<SynergyReactionType, 'none'>
): CombatMechanicId {
  return `synergy:${reaction}`;
}