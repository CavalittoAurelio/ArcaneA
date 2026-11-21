import type {
  Character,
  KnowledgeDisciplineRequirement,
  KnowledgeTreeSettings,
  Spell,
} from '../types/rpg';
import { getCharacterOwnedNatureIds } from './dice';

export interface KnowledgeBranch {
  id: string;
  label: string;
  spellIds: string[];
}

export interface KnowledgeDiscipline {
  id: string;
  label: string;
  kind: 'nature' | 'specialization' | 'combined';
  natureId: string;
  capstoneSpellId?: string;
  requiredNatureIds?: string[];
  description: string;
  defaultRequirements: KnowledgeDisciplineRequirement[];
  branches: KnowledgeBranch[];
}

export interface KnowledgeSpellMetadata {
  spellId: string;
  disciplineId: string;
  branchId: string;
  minimumMastery: number;
}

const defineSpell = (
  spell: Pick<
    Spell,
    'id' | 'name' | 'manaCost' | 'orders' | 'effectType' | 'effectDescription'
  > &
    Partial<Pick<Spell, 'damage' | 'duration'>> &
    Partial<Omit<Spell, 'id' | 'name' | 'manaCost' | 'orders' | 'effectType' | 'damage' | 'effectDescription' | 'duration'>>
): Spell => ({
  statuses: [],
  castRequirement: 'none',
  castStat: 'none',
  manualCastDice: 0,
  assuredSuccess: 0,
  combatStats: spell.effectType === 'damage' ? ['manipulacion'] : [],
  damageMode: 'auto',
  damageKind: spell.effectType === 'damage' ? 'magico' : undefined,
  ...spell,
  damage: spell.damage || { dice: [], bonus: 0, notes: '' },
  duration: spell.duration || 'Instantáneo',
  isBasic: true,
  unlearnedByDefault: true,
});

export const KNOWLEDGE_TREE_SPELLS: Spell[] = [
  defineSpell({
    id: 'knowledge_fire_ember_thread',
    name: 'Hilo de Ascua',
    manaCost: 2,
    orders: ['Controlar llamas', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'hilo ígneo concentrado' },
    elementalStatus: {
      kind: 'burn',
      trigger: 'max_die',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    effectDescription:
      'Proyecta una hebra estrecha de llama a un objetivo. Un dado máximo aplica una carga de Quemadura; usa el daño y la duración configurados en el estado.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_fire_recoil_lash',
    name: 'Latigazo de Reflujo',
    manaCost: 2,
    orders: ['Controlar llamas', 'Impulsar / Empujar'],
    effectType: 'damage',
    damageKind: 'magico',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'latigazo de fuego' },
    statuses: ['Empujar'],
    effectDescription:
      'Una llamarada curva golpea y desplaza al objetivo. Aplica Empujar según la resolución de estados de combate.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_fire_thermal_fold',
    name: 'Pliegue de Reverbero',
    manaCost: 2,
    orders: ['Controlar llamas', 'Proteger'],
    effectType: 'defense',
    combatStats: ['manipulacion'],
    assuredSuccess: 1,
    effectDescription:
      'Desvía un impacto con una corriente térmica lateral. Añade 1 éxito asegurado a esta defensa; no crea una armadura persistente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_fire_ash_bloom',
    name: 'Flor de Ceniza',
    manaCost: 3,
    orders: ['Generar fuego', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'ráfaga de ceniza caliente' },
    statuses: ['Cegar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 2,
      shapeNote: 'abanico corto de ceniza',
    },
    effectDescription:
      'Abre un abanico de ceniza caliente contra hasta dos objetivos seleccionados. Puede aplicar Cegar mediante la resolución de estados existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_fire_combustion_ring',
    name: 'Anillo de Combustión',
    manaCost: 5,
    orders: ['Generar fuego', 'Expandir'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 2 }], bonus: 0, notes: 'combustión ígnea en área' },
    elementalStatus: {
      kind: 'burn',
      trigger: 'always',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      shapeNote: 'estallido circular alrededor del punto elegido',
    },
    effectDescription:
      'Enciende de golpe una zona elegida: inflige 2d6 de daño mágico y, si causa daño, aplica una carga de Quemadura. Resuelve alcance y selección con las reglas de área actuales.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_earth_scree_surge',
    name: 'Laja de Impulso',
    manaCost: 2,
    orders: ['Levantar tierra', 'Proyectar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'impacto de una laja' },
    statuses: ['Empujar'],
    effectDescription:
      'Desprende una laja y la impulsa contra un objetivo; el golpe puede Empujar según la resolución existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_earth_fault_pulse',
    name: 'Pulso de Falla',
    manaCost: 3,
    orders: ['Temblor / Fisura', 'Expandir'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'onda sísmica superficial' },
    statuses: ['Derribar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 3,
      shapeNote: 'onda corta a ras del suelo',
    },
    effectDescription:
      'Transmite una vibración por el suelo hasta tres objetivos seleccionados. El impacto puede Derribar; no altera terreno de forma persistente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_earth_marl_prison',
    name: 'Prisión de Marga',
    manaCost: 3,
    orders: ['Levantar tierra', 'Contener', 'Inmovilizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Inmovilizar'],
    durationTurns: 1,
    effectDescription:
      'Cierra una abrazadera de tierra alrededor de un objetivo e intenta Inmovilizarlo durante 1 turno mediante el chequeo de estado existente.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_earth_layered_guard',
    name: 'Guardia Estratificada',
    manaCost: 3,
    orders: ['Moldear roca', 'Proteger', 'Escudo'],
    effectType: 'effect',
    effectSubType: 'buff',
    armorConfig: {
      isArmor: true,
      element: 'Tierra',
      damageReduction: 3,
      damageDivisor: 1,
      maxHits: 3,
    },
    maxHits: 3,
    durationTurns: 2,
    effectDescription:
      'Forma placas superpuestas de Tierra: reduce 3 de daño por impacto y soporta hasta 3 golpes durante 2 turnos, según el sistema de armaduras.',
    duration: '2 turnos',
  }),
  defineSpell({
    id: 'knowledge_earth_quarry_spike',
    name: 'Estaca de Cantera',
    manaCost: 3,
    orders: ['Moldear roca', 'Proyectar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd8', count: 1 }], bonus: 0, notes: 'punta rocosa compacta' },
    effectDescription:
      'Comprime material del suelo en una punta de trayectoria directa. Concentra el daño en un único impacto físico.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_rock_flint_pin',
    name: 'Clavo de Pedernal',
    manaCost: 3,
    orders: ['Moldear roca', 'Fragmentar', 'Proyectar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd8', count: 1 }], bonus: 0, notes: 'astilla de pedernal afilada' },
    effectDescription:
      'Acelera una astilla de pedernal con una punta estrecha. Es un impacto preciso, no un proyectil de área.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_rock_basalt_aegis',
    name: 'Cota de Basalto',
    manaCost: 4,
    orders: ['Moldear roca', 'Proteger', 'Escudo'],
    effectType: 'effect',
    effectSubType: 'buff',
    armorConfig: {
      isArmor: true,
      element: 'Roca',
      damageReduction: 4,
      damageDivisor: 1,
      maxHits: 2,
    },
    maxHits: 2,
    durationTurns: 2,
    effectDescription:
      'Ajusta una cota rígida de basalto al cuerpo: reduce 4 de daño por impacto hasta recibir 2 golpes o terminar los 2 turnos.',
    duration: '2 turnos',
  }),
  defineSpell({
    id: 'knowledge_rock_strata_split',
    name: 'Quiebre de Estratos',
    manaCost: 4,
    orders: ['Temblor / Fisura', 'Fragmentar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd4', count: 2 }], bonus: 0, notes: 'fractura súbita de roca' },
    statuses: ['Derribar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 2,
      shapeNote: 'fractura lineal breve',
    },
    effectDescription:
      'Abre una fractura angosta bajo hasta dos objetivos seleccionados. Inflige daño físico y puede Derribar; no crea ni desplaza terreno permanente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_rock_resonant_plate',
    name: 'Placa Resonante',
    manaCost: 3,
    orders: ['Vibración de ondas', 'Moldear roca', 'Proteger'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Ensordecer'],
    durationTurns: 1,
    effectDescription:
      'Hace vibrar una placa pétrea junto al objetivo. Un chequeo de Influencia puede Ensordecerlo durante 1 turno; solo aplica la penalización de defensa existente.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_magma_slag_arc',
    name: 'Arco de Escoria Fundida',
    manaCost: 4,
    orders: ['Magma / Fundir', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd8', count: 1 }], bonus: 0, notes: 'escoria magmática proyectada' },
    elementalStatus: {
      kind: 'burn',
      trigger: 'max_die',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    effectDescription:
      'Lanza un arco compacto de escoria fundida a un objetivo. Un dado máximo aplica una carga de Quemadura con la configuración indicada.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_magma_vitrified_trap',
    name: 'Costura Vitrificada',
    manaCost: 4,
    orders: ['Magma / Fundir', 'Contener', 'Inmovilizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Inmovilizar'],
    durationTurns: 1,
    effectDescription:
      'Enfría de golpe un flujo fino alrededor de un objetivo y trata de Inmovilizarlo durante 1 turno mediante el chequeo existente.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_magma_scoria_shell',
    name: 'Coraza de Escoria',
    manaCost: 4,
    orders: ['Magma / Fundir', 'Proteger', 'Escudo'],
    effectType: 'effect',
    effectSubType: 'buff',
    armorConfig: {
      isArmor: true,
      element: 'Magma',
      damageReduction: 3,
      damageDivisor: 1,
      maxHits: 3,
    },
    maxHits: 3,
    durationTurns: 2,
    effectDescription:
      'Solidifica una costra volcánica protectora: reduce 3 de daño por impacto hasta recibir 3 golpes o terminar los 2 turnos.',
    duration: '2 turnos',
  }),
  defineSpell({
    id: 'knowledge_magma_caldera_spill',
    name: 'Desborde de Caldero',
    manaCost: 6,
    orders: ['Magma / Fundir', 'Expandir'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 2 }], bonus: 0, notes: 'desborde magmático en área' },
    elementalStatus: {
      kind: 'burn',
      trigger: 'always',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      shapeNote: 'derrame concentrado en la zona elegida',
    },
    effectDescription:
      'Desborda un cauce de magma sobre la zona seleccionada: inflige 2d6 de daño mágico y, si causa daño, añade una carga de Quemadura.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_water_current_needle',
    name: 'Aguja de Corriente',
    manaCost: 2,
    orders: ['Controlar agua', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'chorro de agua concentrado' },
    effectDescription:
      'Concentra agua en un chorro estrecho que golpea a un único objetivo. Es un impacto preciso, sin daño de área ni desplazamiento adicional.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_water_backwash',
    name: 'Golpe de Resaca',
    manaCost: 3,
    orders: ['Controlar agua', 'Expandir', 'Impulsar / Empujar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'embate de una ola de retorno' },
    statuses: ['Empujar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 2,
      shapeNote: 'ola baja que barre dos objetivos cercanos',
    },
    effectDescription:
      'Una ola baja vuelve sobre su cauce y embiste hasta dos objetivos seleccionados. Inflige 1d6 mágico y puede Empujar mediante la resolución de estados existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_water_mist_veil',
    name: 'Velo de Bruma',
    manaCost: 2,
    orders: ['Invocar niebla', 'Proteger'],
    effectType: 'defense',
    combatStats: ['manipulacion'],
    assuredSuccess: 1,
    effectDescription:
      'Desvía el ataque con una cortina de bruma y corrientes cruzadas. Añade 1 éxito asegurado a esta defensa; no deja una protección persistente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_water_countercurrent_bind',
    name: 'Lazo de Contracorriente',
    manaCost: 3,
    orders: ['Controlar agua', 'Contener', 'Inmovilizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Inmovilizar'],
    durationTurns: 1,
    effectDescription:
      'Una corriente se cierra alrededor del objetivo y trata de Inmovilizarlo durante 1 turno mediante el chequeo de estado existente.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_water_cleansing_tide',
    name: 'Marea Clarificadora',
    manaCost: 3,
    orders: ['Controlar agua', 'Canalizar'],
    effectType: 'effect',
    effectSubType: 'buff',
    dispelConfig: {
      enabled: true,
      scope: 'debuffs',
      maxEffects: 1,
      requiresInfluenceCheck: false,
    },
    effectDescription:
      'Una corriente limpia disuelve como máximo un efecto activo clasificado como estado perjudicial de un objetivo. No restaura PV ni cura heridas.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_ice_frost_lance',
    name: 'Lanza de Escarcha',
    manaCost: 3,
    orders: ['Congelar / Hielo', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'punta de hielo a presión' },
    elementalStatus: {
      kind: 'frozen',
      trigger: 'upper_half',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    effectDescription:
      'Dispara una punta compacta de hielo a un objetivo. Si causa daño y el dado queda en su mitad superior, aplica una carga de Congelado durante 2 turnos con el daño periódico configurado.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_ice_sleet_fan',
    name: 'Abanico de Aguanieve',
    manaCost: 4,
    orders: ['Congelar / Hielo', 'Expandir', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'ráfaga de esquirlas de hielo' },
    elementalStatus: {
      kind: 'frozen',
      trigger: 'upper_half',
      stacks: 1,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 3,
      shapeNote: 'abanico corto de aguanieve',
    },
    effectDescription:
      'Lanza una ráfaga de esquirlas contra hasta tres objetivos seleccionados. Si causa daño y el dado queda en su mitad superior, aplica una carga de Congelado.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_ice_rime_cage',
    name: 'Prisión de Escarcha',
    manaCost: 3,
    orders: ['Congelar / Hielo', 'Contener', 'Inmovilizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Inmovilizar'],
    durationTurns: 1,
    effectDescription:
      'Una costra de escarcha se cierra alrededor del objetivo e intenta Inmovilizarlo durante 1 turno mediante el chequeo de estado existente.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_ice_glacial_aegis',
    name: 'Égida Glacial',
    manaCost: 4,
    orders: ['Congelar / Hielo', 'Proteger', 'Escudo'],
    effectType: 'effect',
    effectSubType: 'buff',
    armorConfig: {
      isArmor: true,
      element: 'Hielo',
      damageReduction: 4,
      damageDivisor: 1,
      maxHits: 2,
    },
    maxHits: 2,
    durationTurns: 2,
    effectDescription:
      'Forma una coraza rígida de hielo: reduce 4 de daño por impacto hasta recibir 2 golpes o terminar los 2 turnos, según el sistema de armaduras.',
    duration: '2 turnos',
  }),
  defineSpell({
    id: 'knowledge_ice_shard_impact',
    name: 'Impacto de Esquirla',
    manaCost: 5,
    orders: ['Fragmentar', 'Proyectar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'impacto físico de ruptura' },
    synergyReaction: 'shatter_frozen',
    synergyConsumeStacks: 'all',
    effectDescription:
      'Golpea con una esquirla pesada. Si el objetivo ya tiene cargas de Congelado, consume todas y activa la Fractura Glacial existente (1d8 físico por carga); sin cargas, solo inflige el daño base.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_air_pressure_edge',
    name: 'Filo de Presión',
    manaCost: 2,
    orders: ['Corriente de aire', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'lámina de aire comprimido' },
    effectDescription:
      'Comprime una corriente en una lámina estrecha y la proyecta contra un objetivo. Es un impacto preciso, sin área ni desplazamiento adicional.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_air_crosswind_lash',
    name: 'Latigazo de Contraviento',
    manaCost: 3,
    orders: ['Corriente de aire', 'Impulsar / Empujar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'latigazo de presión de aire' },
    statuses: ['Empujar'],
    effectDescription:
      'Una corriente curva golpea a un objetivo desde un ángulo y puede Empujarlo mediante la resolución de estados existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_air_ground_sweep',
    name: 'Barrido de Borrasca',
    manaCost: 4,
    orders: ['Corriente de aire', 'Expandir', 'Impulsar / Empujar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd4', count: 1 }], bonus: 0, notes: 'barrido de viento rasante' },
    statuses: ['Empujar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 2,
      shapeNote: 'ráfaga rasante contra dos objetivos',
    },
    effectDescription:
      'Una ráfaga baja barre hasta dos objetivos seleccionados. Inflige 1d4 mágico y puede Empujar mediante la resolución de estados existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_air_slipstream_guard',
    name: 'Desvío de Rebufo',
    manaCost: 2,
    orders: ['Corriente de aire', 'Proteger', 'Desviar'],
    effectType: 'defense',
    combatStats: ['manipulacion'],
    assuredSuccess: 1,
    effectDescription:
      'Dobla el flujo de aire alrededor de un golpe para desviarlo. Añade 1 éxito asegurado a esta defensa; no crea una armadura persistente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_air_disarming_vortex',
    name: 'Vórtice Desarmador',
    manaCost: 3,
    orders: ['Corriente de aire', 'Desarmar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Desarmar'],
    effectDescription:
      'Un vórtice golpea el arma o el escudo del objetivo e intenta Desarmarlo mediante el chequeo de estado existente. Recuperar el objeto requiere la acción normal.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_lightning_thunder_needle',
    name: 'Aguja de Trueno',
    manaCost: 2,
    orders: ['Descarga eléctrica', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'descarga eléctrica concentrada' },
    elementalStatus: {
      kind: 'electrified',
      trigger: 'always',
      stacks: 1,
      durationTurns: 3,
    },
    effectDescription:
      'Concentra la descarga en un objetivo. Si causa daño, aplica una carga de Electrificado según la resolución elemental existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_lightning_forked_arc',
    name: 'Arco de Derivación',
    manaCost: 4,
    orders: ['Relámpago encadenado', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'arco entre conductores electrificados' },
    elementalStatus: {
      kind: 'electrified',
      trigger: 'always',
      stacks: 1,
      durationTurns: 3,
    },
    areaConfig: {
      enabled: true,
      mode: 'all_electrified',
      shapeNote: 'salto de descarga entre objetivos ya Electrificados',
    },
    effectDescription:
      'La descarga salta entre todos los objetivos con Electrificado. Cada impacto que cause daño aplica una carga adicional; requiere al menos un objetivo ya cargado.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_lightning_circuit_overload',
    name: 'Reacción de Sobrecarga',
    manaCost: 5,
    orders: ['Sobrecargar', 'Canalizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    synergyReaction: 'overload_electrified',
    synergyConsumeStacks: 1,
    effectDescription:
      'Realiza un chequeo de Influencia para desencadenar la Sobrecarga de Antena existente: consume una carga de Electrificado de cada combatiente cargado y causa 1d6 mágico a cada uno. Sin cargas disponibles, no hay reacción.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_lightning_neuromuscular_pulse',
    name: 'Pulso Neuromuscular',
    manaCost: 4,
    orders: ['Descarga eléctrica', 'Aturdir'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Aturdir'],
    statusParams: {
      Aturdir: { untilHit: true },
    },
    durationTurns: 1,
    effectDescription:
      'Una descarga breve interrumpe el movimiento del objetivo e intenta Aturdirlo mediante Influencia hasta que reciba un golpe.',
    duration: 'Hasta recibir 1 golpe',
  }),
  defineSpell({
    id: 'knowledge_lightning_return_arc',
    name: 'Descarga de Retorno',
    manaCost: 4,
    orders: ['Descarga eléctrica', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd8', count: 1 }], bonus: 0, notes: 'arco sobre un conductor activo' },
    dependency: {
      enabled: true,
      scope: 'target_status',
      requiredName: 'Electrificado',
      consumeOnUse: false,
    },
    effectDescription:
      'Canaliza una descarga más intensa sobre un objetivo que ya esté Electrificado. El requisito no consume la carga; si causa daño, aplica otra carga mediante la resolución eléctrica existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_storm_cumulonimbus',
    name: 'Nube de Cúmulo',
    manaCost: 5,
    orders: ['Relámpago encadenado', 'Expandir', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd4', count: 2 }], bonus: 0, notes: 'descarga de tormenta en área' },
    elementalStatus: {
      kind: 'electrified',
      trigger: 'always',
      stacks: 1,
      durationTurns: 3,
    },
    areaConfig: {
      enabled: true,
      mode: 'all_enemies',
      shapeNote: 'descarga sobre todos los enemigos elegibles en combate',
    },
    effectDescription:
      'Descarga una nube de tormenta sobre todos los enemigos elegibles. Cada impacto que cause daño aplica una carga de Electrificado.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_storm_windward_front',
    name: 'Frente de Barlovento',
    manaCost: 4,
    orders: ['Corriente de aire', 'Expandir', 'Impulsar / Empujar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd6', count: 1 }], bonus: 0, notes: 'embate de un frente tempestuoso' },
    statuses: ['Empujar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 2,
      shapeNote: 'frente de viento y lluvia contra dos objetivos',
    },
    effectDescription:
      'Un frente de viento y lluvia golpea hasta dos objetivos seleccionados. Inflige 1d6 mágico y puede Empujar mediante la resolución de estados existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_storm_thunder_bell',
    name: 'Campana del Trueno',
    manaCost: 3,
    orders: ['Expandir', 'Ensordecer'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Ensordecer'],
    statusParams: {
      Ensordecer: { autoFails: 1 },
    },
    durationTurns: 1,
    effectDescription:
      'Una resonancia de trueno desorienta al objetivo e intenta Ensordecerlo durante 1 turno mediante el chequeo de estado existente.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_storm_eye_guard',
    name: 'Ojo del Temporal',
    manaCost: 3,
    orders: ['Corriente de aire', 'Proteger', 'Desviar'],
    effectType: 'defense',
    combatStats: ['manipulacion'],
    assuredSuccess: 1,
    effectDescription:
      'Dentro del ojo de la tormenta, una corriente calma desvía un impacto. Añade 1 éxito asegurado a esta defensa; no crea una armadura persistente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_storm_barometric_weight',
    name: 'Peso Barométrico',
    manaCost: 4,
    orders: ['Expandir', 'Contener', 'Ralentizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Ralentizar'],
    statusParams: {
      Ralentizar: { autoFails: 1 },
    },
    durationTurns: 1,
    effectDescription:
      'Una caída súbita de presión descompasa al objetivo e intenta aplicarle Ralentizar durante 1 turno mediante Influencia.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_air_tempest_crown',
    name: 'Corona del Vendaval',
    manaCost: 6,
    orders: ['Corriente de aire', 'Expandir', 'Impulsar / Empujar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd8', count: 2 }], bonus: 0, notes: 'frente de viento expansivo' },
    statuses: ['Empujar'],
    areaConfig: {
      enabled: true,
      mode: 'all_enemies',
      shapeNote: 'golpe de viento contra todos los enemigos elegibles',
    },
    effectDescription:
      'Al culminar la disciplina, libera una corona de viento que golpea a todos los enemigos elegibles. Inflige 2d8 mágico y puede Empujar mediante la resolución de estados existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_lightning_sky_lance',
    name: 'Lanza del Cielo Eléctrico',
    manaCost: 6,
    orders: ['Descarga eléctrica', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd8', count: 3 }], bonus: 0, notes: 'descarga concentrada sobre un conductor' },
    dependency: {
      enabled: true,
      scope: 'target_status',
      requiredName: 'Electrificado',
      consumeOnUse: false,
    },
    elementalStatus: {
      kind: 'electrified',
      trigger: 'always',
      stacks: 1,
      durationTurns: 3,
    },
    effectDescription:
      'Culmina la disciplina con una descarga de precisión sobre un objetivo ya Electrificado. No consume la carga requerida y, si causa daño, aplica otra carga según la resolución eléctrica existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_storm_supercell',
    name: 'Supercélula Desatada',
    manaCost: 7,
    orders: ['Relámpago encadenado', 'Expandir', 'Proyectar'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd8', count: 3 }], bonus: 0, notes: 'descarga de tormenta de gran escala' },
    elementalStatus: {
      kind: 'electrified',
      trigger: 'always',
      stacks: 2,
      durationTurns: 3,
    },
    areaConfig: {
      enabled: true,
      mode: 'all_enemies',
      shapeNote: 'descarga de supercélula sobre todos los enemigos elegibles',
    },
    effectDescription:
      'Al dominar Aire y Rayo, desata una supercélula sobre todos los enemigos elegibles. Cada impacto que cause daño aplica dos cargas de Electrificado mediante el estado existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_fire_pyroclastic_tide',
    name: 'Marea Piroclástica',
    manaCost: 7,
    orders: ['Generar fuego', 'Expandir'],
    effectType: 'damage',
    damage: { dice: [{ type: 'd8', count: 3 }], bonus: 0, notes: 'oleada de combustión envolvente' },
    elementalStatus: {
      kind: 'burn',
      trigger: 'always',
      stacks: 2,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    areaConfig: {
      enabled: true,
      mode: 'all_enemies',
      shapeNote: 'oleada de fuego sobre todos los enemigos elegibles',
    },
    effectDescription:
      'La culminación de Fuego despliega una oleada ardiente sobre todos los enemigos elegibles. Cada impacto que cause daño inflige 3d8 mágico y aplica dos cargas de Quemadura con la configuración existente.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_earth_titan_fault',
    name: 'Falla del Titán',
    manaCost: 7,
    orders: ['Temblor / Fisura', 'Expandir', 'Derribar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd8', count: 3 }], bonus: 0, notes: 'onda sísmica profunda' },
    statuses: ['Derribar'],
    areaConfig: {
      enabled: true,
      mode: 'area_selected',
      maxTargets: 3,
      shapeNote: 'fractura profunda bajo hasta tres objetivos seleccionados',
    },
    effectDescription:
      'Una falla atraviesa el suelo bajo hasta tres objetivos seleccionados. Inflige 3d8 físico y puede Derribarlos; no deja terreno ni obstáculos persistentes.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_rock_resonant_break',
    name: 'Resonancia de Quiebre',
    manaCost: 6,
    orders: ['Vibración de ondas', 'Moldear roca', 'Desarmar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Derribar', 'Desarmar'],
    durationTurns: 1,
    effectDescription:
      'Una vibración atraviesa la roca y desestabiliza el equipo del objetivo. Un chequeo de Influencia puede Derribarlo y Desarmarlo durante 1 turno mediante los estados existentes.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_magma_crucible_seal',
    name: 'Sello del Crisol',
    manaCost: 6,
    orders: ['Magma / Fundir', 'Contener', 'Inmovilizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    castStat: 'influencia',
    statuses: ['Inmovilizar'],
    elementalStatus: {
      kind: 'burn',
      trigger: 'always',
      stacks: 2,
      durationTurns: 2,
      tickDie: 'd4',
      damageKind: 'magico',
    },
    durationTurns: 1,
    effectDescription:
      'Sella a un objetivo en una costra fundida que se enfría alrededor del cuerpo. Si el chequeo de Influencia tiene éxito, lo Inmoviliza durante 1 turno y aplica dos cargas de Quemadura mediante las reglas existentes.',
    duration: '1 turno',
  }),
  defineSpell({
    id: 'knowledge_water_purifying_deluge',
    name: 'Diluvio Purificador',
    manaCost: 6,
    orders: ['Controlar agua', 'Expandir', 'Canalizar'],
    effectType: 'effect',
    effectSubType: 'debuff',
    dispelConfig: {
      enabled: true,
      scope: 'debuffs',
      maxEffects: 0,
      requiresInfluenceCheck: false,
    },
    effectDescription:
      'Una corriente envolvente limpia de un objetivo todos los efectos activos clasificados como estados perjudiciales. No restaura PV ni cura heridas.',
    duration: 'Instantáneo',
  }),
  defineSpell({
    id: 'knowledge_ice_glacier_break',
    name: 'Ruptura del Glaciar',
    manaCost: 7,
    orders: ['Fragmentar', 'Proyectar'],
    effectType: 'damage',
    damageKind: 'fisico',
    damage: { dice: [{ type: 'd8', count: 2 }], bonus: 0, notes: 'impacto de fractura glacial' },
    synergyReaction: 'shatter_frozen',
    synergyConsumeStacks: 'all',
    effectDescription:
      'Concentra toda la disciplina en un golpe contra un objetivo. Inflige 2d8 físico y, si tiene cargas de Congelado, las consume para activar la Fractura Glacial existente (1d8 físico por carga).',
    duration: 'Instantáneo',
  }),
];

export const KNOWLEDGE_DISCIPLINES: KnowledgeDiscipline[] = [
  {
    id: 'fuego',
    label: 'Fuego',
    kind: 'nature',
    natureId: 'fuego',
    capstoneSpellId: 'knowledge_fire_pyroclastic_tide',
    description:
      'Control de llama, concentración térmica, desvío de impactos y combustión. No crea armaduras sólidas ni movimiento adicional, capacidades que el combate actual no modela.',
    defaultRequirements: [],
    branches: [
      { id: 'flame-shaping', label: 'Trazado y desvío de llama', spellIds: ['knowledge_fire_ember_thread', 'knowledge_fire_recoil_lash', 'knowledge_fire_thermal_fold'] },
      { id: 'combustion', label: 'Combustión y control de zona', spellIds: ['knowledge_fire_ash_bloom', 'knowledge_fire_combustion_ring'] },
    ],
  },
  {
    id: 'tierra',
    label: 'Tierra',
    kind: 'nature',
    natureId: 'tierra',
    capstoneSpellId: 'knowledge_earth_titan_fault',
    description:
      'Impulso de material, vibración del suelo, contención y defensa estratificada.',
    defaultRequirements: [],
    branches: [
      { id: 'surface', label: 'Manipulación y proyección', spellIds: ['knowledge_earth_scree_surge', 'knowledge_earth_quarry_spike'] },
      { id: 'tectonics', label: 'Ondas y contención', spellIds: ['knowledge_earth_fault_pulse', 'knowledge_earth_marl_prison'] },
      { id: 'fortification', label: 'Defensa y fortificación', spellIds: ['knowledge_earth_layered_guard'] },
    ],
  },
  {
    id: 'roca',
    label: 'Roca',
    kind: 'specialization',
    natureId: 'tierra',
    capstoneSpellId: 'knowledge_rock_resonant_break',
    description:
      'Especialización de Tierra centrada en mineral compacto: puntas precisas, placas resistentes y fracturas controladas. No es una naturaleza independiente.',
    defaultRequirements: [{ disciplineId: 'tierra', minimumMastery: 3 }],
    branches: [
      { id: 'mineral', label: 'Roca compacta y fragmentación', spellIds: ['knowledge_rock_flint_pin', 'knowledge_rock_strata_split'] },
      { id: 'stone-defense', label: 'Placas y resonancia', spellIds: ['knowledge_rock_basalt_aegis', 'knowledge_rock_resonant_plate'] },
    ],
  },
  {
    id: 'magma',
    label: 'Magma',
    kind: 'combined',
    natureId: 'magma',
    capstoneSpellId: 'knowledge_magma_crucible_seal',
    requiredNatureIds: ['fuego', 'tierra'],
    description:
      'Disciplina combinada de Fuego y Roca que alterna flujo fundido y costra solidificada. Reutiliza la naturaleza Magma ya existente en Arcane.',
    defaultRequirements: [
      { disciplineId: 'fuego', minimumMastery: 2 },
      { disciplineId: 'roca', minimumMastery: 3 },
    ],
    branches: [
      { id: 'molten-flow', label: 'Flujo y proyección fundida', spellIds: ['knowledge_magma_slag_arc', 'knowledge_magma_caldera_spill'] },
      { id: 'cooling-crust', label: 'Enfriamiento y costra', spellIds: ['knowledge_magma_vitrified_trap', 'knowledge_magma_scoria_shell'] },
    ],
  },
  {
    id: 'agua',
    label: 'Agua',
    kind: 'nature',
    natureId: 'agua',
    capstoneSpellId: 'knowledge_water_purifying_deluge',
    description:
      'Control de corrientes, golpes de presión, bruma defensiva, ataduras líquidas y limpieza de efectos perjudiciales.',
    defaultRequirements: [],
    branches: [
      { id: 'currents', label: 'Corriente y oleaje', spellIds: ['knowledge_water_current_needle', 'knowledge_water_backwash'] },
      { id: 'mist-control', label: 'Bruma, control y purificación', spellIds: ['knowledge_water_mist_veil', 'knowledge_water_countercurrent_bind', 'knowledge_water_cleansing_tide'] },
    ],
  },
  {
    id: 'hielo',
    label: 'Hielo',
    kind: 'nature',
    natureId: 'hielo',
    capstoneSpellId: 'knowledge_ice_glacier_break',
    description:
      'Disciplina de Escarcha que profundiza la afinidad de Agua: proyecta hielo, inmoviliza, forma corazas rígidas y quiebra cargas de Congelado.',
    defaultRequirements: [{ disciplineId: 'agua', minimumMastery: 3 }],
    branches: [
      { id: 'frost-control', label: 'Escarcha y contención', spellIds: ['knowledge_ice_frost_lance', 'knowledge_ice_sleet_fan', 'knowledge_ice_rime_cage'] },
      { id: 'glacial-forms', label: 'Coraza y fractura', spellIds: ['knowledge_ice_glacial_aegis', 'knowledge_ice_shard_impact'] },
    ],
  },
  {
    id: 'aire',
    label: 'Aire',
    kind: 'nature',
    natureId: 'aire',
    capstoneSpellId: 'knowledge_air_tempest_crown',
    description:
      'Corrientes precisas, ráfagas de empuje, desvíos defensivos y vórtices que desarman. No crea armaduras sólidas ni movimiento adicional.',
    defaultRequirements: [],
    branches: [
      { id: 'currents', label: 'Corte y empuje', spellIds: ['knowledge_air_pressure_edge', 'knowledge_air_crosswind_lash', 'knowledge_air_ground_sweep'] },
      { id: 'eddies', label: 'Rebufos y vórtices', spellIds: ['knowledge_air_slipstream_guard', 'knowledge_air_disarming_vortex'] },
    ],
  },
  {
    id: 'rayo',
    label: 'Rayo',
    kind: 'nature',
    natureId: 'rayo',
    capstoneSpellId: 'knowledge_lightning_sky_lance',
    description:
      'Descargas de precisión, conducción entre objetivos Electrificados y pulsos que interrumpen la acción.',
    defaultRequirements: [{ disciplineId: 'aire', minimumMastery: 2 }],
    branches: [
      { id: 'conduction', label: 'Descarga y conducción', spellIds: ['knowledge_lightning_thunder_needle', 'knowledge_lightning_forked_arc', 'knowledge_lightning_return_arc'] },
      { id: 'overload', label: 'Sobrecarga y pulso', spellIds: ['knowledge_lightning_circuit_overload', 'knowledge_lightning_neuromuscular_pulse'] },
    ],
  },
  {
    id: 'tormenta',
    label: 'Tormenta',
    kind: 'combined',
    natureId: 'tormenta',
    capstoneSpellId: 'knowledge_storm_supercell',
    requiredNatureIds: ['aire', 'rayo'],
    description:
      'Disciplina combinada de Aire y Rayo: descarga en área, frentes de viento y lluvia, presión y resonancia de trueno.',
    defaultRequirements: [
      { disciplineId: 'aire', minimumMastery: 2 },
      { disciplineId: 'rayo', minimumMastery: 3 },
    ],
    branches: [
      { id: 'storm-fronts', label: 'Frentes y descargas', spellIds: ['knowledge_storm_cumulonimbus', 'knowledge_storm_windward_front'] },
      { id: 'thunder-pressure', label: 'Trueno y presión', spellIds: ['knowledge_storm_thunder_bell', 'knowledge_storm_eye_guard', 'knowledge_storm_barometric_weight'] },
    ],
  },
];

export const KNOWLEDGE_SPELL_METADATA: KnowledgeSpellMetadata[] = [
  { spellId: 'knowledge_fire_ember_thread', disciplineId: 'fuego', branchId: 'flame-shaping', minimumMastery: 0 },
  { spellId: 'knowledge_fire_recoil_lash', disciplineId: 'fuego', branchId: 'flame-shaping', minimumMastery: 0 },
  { spellId: 'knowledge_fire_thermal_fold', disciplineId: 'fuego', branchId: 'flame-shaping', minimumMastery: 1 },
  { spellId: 'knowledge_fire_ash_bloom', disciplineId: 'fuego', branchId: 'combustion', minimumMastery: 1 },
  { spellId: 'knowledge_fire_combustion_ring', disciplineId: 'fuego', branchId: 'combustion', minimumMastery: 2 },
  { spellId: 'knowledge_earth_scree_surge', disciplineId: 'tierra', branchId: 'surface', minimumMastery: 0 },
  { spellId: 'knowledge_earth_quarry_spike', disciplineId: 'tierra', branchId: 'surface', minimumMastery: 1 },
  { spellId: 'knowledge_earth_fault_pulse', disciplineId: 'tierra', branchId: 'tectonics', minimumMastery: 1 },
  { spellId: 'knowledge_earth_marl_prison', disciplineId: 'tierra', branchId: 'tectonics', minimumMastery: 2 },
  { spellId: 'knowledge_earth_layered_guard', disciplineId: 'tierra', branchId: 'fortification', minimumMastery: 1 },
  { spellId: 'knowledge_rock_flint_pin', disciplineId: 'roca', branchId: 'mineral', minimumMastery: 0 },
  { spellId: 'knowledge_rock_strata_split', disciplineId: 'roca', branchId: 'mineral', minimumMastery: 1 },
  { spellId: 'knowledge_rock_basalt_aegis', disciplineId: 'roca', branchId: 'stone-defense', minimumMastery: 1 },
  { spellId: 'knowledge_rock_resonant_plate', disciplineId: 'roca', branchId: 'stone-defense', minimumMastery: 2 },
  { spellId: 'knowledge_magma_slag_arc', disciplineId: 'magma', branchId: 'molten-flow', minimumMastery: 0 },
  { spellId: 'knowledge_magma_caldera_spill', disciplineId: 'magma', branchId: 'molten-flow', minimumMastery: 2 },
  { spellId: 'knowledge_magma_vitrified_trap', disciplineId: 'magma', branchId: 'cooling-crust', minimumMastery: 1 },
  { spellId: 'knowledge_magma_scoria_shell', disciplineId: 'magma', branchId: 'cooling-crust', minimumMastery: 1 },
  { spellId: 'knowledge_water_current_needle', disciplineId: 'agua', branchId: 'currents', minimumMastery: 0 },
  { spellId: 'knowledge_water_backwash', disciplineId: 'agua', branchId: 'currents', minimumMastery: 1 },
  { spellId: 'knowledge_water_mist_veil', disciplineId: 'agua', branchId: 'mist-control', minimumMastery: 1 },
  { spellId: 'knowledge_water_countercurrent_bind', disciplineId: 'agua', branchId: 'mist-control', minimumMastery: 1 },
  { spellId: 'knowledge_water_cleansing_tide', disciplineId: 'agua', branchId: 'mist-control', minimumMastery: 2 },
  { spellId: 'knowledge_ice_frost_lance', disciplineId: 'hielo', branchId: 'frost-control', minimumMastery: 0 },
  { spellId: 'knowledge_ice_sleet_fan', disciplineId: 'hielo', branchId: 'frost-control', minimumMastery: 1 },
  { spellId: 'knowledge_ice_rime_cage', disciplineId: 'hielo', branchId: 'frost-control', minimumMastery: 1 },
  { spellId: 'knowledge_ice_glacial_aegis', disciplineId: 'hielo', branchId: 'glacial-forms', minimumMastery: 1 },
  { spellId: 'knowledge_ice_shard_impact', disciplineId: 'hielo', branchId: 'glacial-forms', minimumMastery: 2 },
  { spellId: 'knowledge_air_pressure_edge', disciplineId: 'aire', branchId: 'currents', minimumMastery: 0 },
  { spellId: 'knowledge_air_crosswind_lash', disciplineId: 'aire', branchId: 'currents', minimumMastery: 0 },
  { spellId: 'knowledge_air_ground_sweep', disciplineId: 'aire', branchId: 'currents', minimumMastery: 1 },
  { spellId: 'knowledge_air_slipstream_guard', disciplineId: 'aire', branchId: 'eddies', minimumMastery: 1 },
  { spellId: 'knowledge_air_disarming_vortex', disciplineId: 'aire', branchId: 'eddies', minimumMastery: 2 },
  { spellId: 'knowledge_lightning_thunder_needle', disciplineId: 'rayo', branchId: 'conduction', minimumMastery: 0 },
  { spellId: 'knowledge_lightning_forked_arc', disciplineId: 'rayo', branchId: 'conduction', minimumMastery: 1 },
  { spellId: 'knowledge_lightning_return_arc', disciplineId: 'rayo', branchId: 'conduction', minimumMastery: 1 },
  { spellId: 'knowledge_lightning_circuit_overload', disciplineId: 'rayo', branchId: 'overload', minimumMastery: 2 },
  { spellId: 'knowledge_lightning_neuromuscular_pulse', disciplineId: 'rayo', branchId: 'overload', minimumMastery: 2 },
  { spellId: 'knowledge_storm_cumulonimbus', disciplineId: 'tormenta', branchId: 'storm-fronts', minimumMastery: 0 },
  { spellId: 'knowledge_storm_windward_front', disciplineId: 'tormenta', branchId: 'storm-fronts', minimumMastery: 1 },
  { spellId: 'knowledge_storm_thunder_bell', disciplineId: 'tormenta', branchId: 'thunder-pressure', minimumMastery: 1 },
  { spellId: 'knowledge_storm_eye_guard', disciplineId: 'tormenta', branchId: 'thunder-pressure', minimumMastery: 1 },
  { spellId: 'knowledge_storm_barometric_weight', disciplineId: 'tormenta', branchId: 'thunder-pressure', minimumMastery: 2 },
  { spellId: 'knowledge_air_tempest_crown', disciplineId: 'aire', branchId: 'currents', minimumMastery: 3 },
  { spellId: 'knowledge_lightning_sky_lance', disciplineId: 'rayo', branchId: 'conduction', minimumMastery: 3 },
  { spellId: 'knowledge_storm_supercell', disciplineId: 'tormenta', branchId: 'storm-fronts', minimumMastery: 3 },
  { spellId: 'knowledge_fire_pyroclastic_tide', disciplineId: 'fuego', branchId: 'combustion', minimumMastery: 3 },
  { spellId: 'knowledge_earth_titan_fault', disciplineId: 'tierra', branchId: 'tectonics', minimumMastery: 3 },
  { spellId: 'knowledge_rock_resonant_break', disciplineId: 'roca', branchId: 'stone-defense', minimumMastery: 3 },
  { spellId: 'knowledge_magma_crucible_seal', disciplineId: 'magma', branchId: 'cooling-crust', minimumMastery: 3 },
  { spellId: 'knowledge_water_purifying_deluge', disciplineId: 'agua', branchId: 'mist-control', minimumMastery: 3 },
  { spellId: 'knowledge_ice_glacier_break', disciplineId: 'hielo', branchId: 'glacial-forms', minimumMastery: 3 },
];

export const KNOWLEDGE_SPELL_IDS = new Set(
  KNOWLEDGE_SPELL_METADATA.map((metadata) => metadata.spellId)
);

export const DEFAULT_KNOWLEDGE_TREE_SETTINGS: KnowledgeTreeSettings = {
  disabledDisciplineIds: [],
  disabledSpellIds: [],
  accessRequirementsByDiscipline: {},
  masteryRequirementsBySpell: {},
  branchOrderByDiscipline: {},
};

export function normalizeKnowledgeTreeSettings(
  value?: Partial<KnowledgeTreeSettings> | null
): KnowledgeTreeSettings {
  const validDisciplineIds = new Set(KNOWLEDGE_DISCIPLINES.map(({ id }) => id));
  const validSpellIds = KNOWLEDGE_SPELL_IDS;
  const accessRequirements = Object.fromEntries(
    Object.entries(value?.accessRequirementsByDiscipline || {})
      .filter(([id, requirements]) => validDisciplineIds.has(id) && Array.isArray(requirements))
      .map(([id, requirements]) => [
        id,
        requirements
          .filter(
            (requirement) =>
              validDisciplineIds.has(requirement.disciplineId) &&
              requirement.disciplineId !== id &&
              Number.isFinite(requirement.minimumMastery)
          )
          .map((requirement) => ({
            disciplineId: requirement.disciplineId,
            minimumMastery: Math.max(0, Math.min(3, Math.floor(requirement.minimumMastery))),
          })),
      ])
  );
  const masteryRequirements = Object.fromEntries(
    Object.entries(value?.masteryRequirementsBySpell || {})
      .filter(([id, level]) => validSpellIds.has(id) && Number.isFinite(level))
      .map(([id, level]) => [id, Math.max(0, Math.min(3, Math.floor(level)))])
  );
  const branchOrder = Object.fromEntries(
    Object.entries(value?.branchOrderByDiscipline || {})
      .filter(([id, order]) => validDisciplineIds.has(id) && Array.isArray(order))
      .map(([id, order]) => {
        const validBranches = new Set(
          KNOWLEDGE_DISCIPLINES.find((discipline) => discipline.id === id)?.branches.map(
            (branch) => branch.id
          ) || []
        );
        return [id, [...new Set(order.filter((branchId) => validBranches.has(branchId)))]];
      })
  );

  return {
    disabledDisciplineIds: Array.isArray(value?.disabledDisciplineIds)
      ? [...new Set(value.disabledDisciplineIds.filter((id) => validDisciplineIds.has(id)))]
      : [],
    disabledSpellIds: Array.isArray(value?.disabledSpellIds)
      ? [...new Set(value.disabledSpellIds.filter((id) => validSpellIds.has(id)))]
      : [],
    accessRequirementsByDiscipline: accessRequirements,
    masteryRequirementsBySpell: masteryRequirements,
    branchOrderByDiscipline: branchOrder,
  };
}

export function getKnowledgeRequirements(
  discipline: KnowledgeDiscipline,
  settings: KnowledgeTreeSettings
): KnowledgeDisciplineRequirement[] {
  return settings.accessRequirementsByDiscipline[discipline.id] ?? discipline.defaultRequirements;
}

export function getKnowledgeBranches(
  discipline: KnowledgeDiscipline,
  settings: KnowledgeTreeSettings
): KnowledgeBranch[] {
  const branchMap = new Map(discipline.branches.map((branch) => [branch.id, branch]));
  const configuredOrder = settings.branchOrderByDiscipline[discipline.id] || [];
  const ordered = configuredOrder
    .map((id) => branchMap.get(id))
    .filter((branch): branch is KnowledgeBranch => Boolean(branch));
  const seen = new Set(ordered.map((branch) => branch.id));
  return [
    ...ordered,
    ...discipline.branches.filter((branch) => !seen.has(branch.id)),
  ];
}

export function getKnowledgeDisciplineAccess(
  discipline: KnowledgeDiscipline,
  character: Character | undefined,
  settings: KnowledgeTreeSettings
): { accessible: boolean; reason: string } {
  if (settings.disabledDisciplineIds.includes(discipline.id)) {
    return { accessible: false, reason: 'Esta disciplina está deshabilitada por el DJ.' };
  }
  if (!character) return { accessible: false, reason: 'Seleccioná un personaje.' };
  if (character.discoveredKnowledgeDisciplines?.includes(discipline.id)) {
    return { accessible: true, reason: 'Habilitada por decisión del DJ.' };
  }
  const ownedNatures = new Set(getCharacterOwnedNatureIds(character));
  const requiredNatures =
    discipline.kind === 'combined'
      ? discipline.requiredNatureIds || []
      : [discipline.natureId];
  const missingNatures = requiredNatures.filter((natureId) => !ownedNatures.has(natureId));
  if (missingNatures.length > 0) {
    const labels = missingNatures
      .map(
        (id) =>
          KNOWLEDGE_DISCIPLINES.find((item) => item.natureId === id)?.label || id
      )
      .join(' y ');
    return { accessible: false, reason: `Requiere afinidad: ${labels}.` };
  }

  const requirements = getKnowledgeRequirements(discipline, settings);
  const unmet = requirements.filter(
    ({ disciplineId, minimumMastery }) =>
      (character.knowledgeMastery?.[disciplineId] || 0) < minimumMastery
  );
  if (unmet.length === 0) return { accessible: true, reason: 'Disponible.' };

  const reason = unmet
    .map(({ disciplineId, minimumMastery }) => {
      const source = KNOWLEDGE_DISCIPLINES.find((item) => item.id === disciplineId);
      return `${source?.label || disciplineId} Nv. ${minimumMastery}`;
    })
    .join(' y ');
  return { accessible: false, reason: `Requiere maestría: ${reason}.` };
}

export function getKnowledgeSpellAccess(
  metadata: KnowledgeSpellMetadata,
  character: Character | undefined,
  settings: KnowledgeTreeSettings
): { accessible: boolean; reason: string; requiredMastery: number } {
  const discipline = KNOWLEDGE_DISCIPLINES.find(
    (item) => item.id === metadata.disciplineId
  );
  if (!discipline) {
    return { accessible: false, reason: 'Disciplina no encontrada.', requiredMastery: 0 };
  }

  const requiredMastery =
    settings.masteryRequirementsBySpell[metadata.spellId] ?? metadata.minimumMastery;
  if (settings.disabledSpellIds.includes(metadata.spellId)) {
    return { accessible: false, reason: 'Este hechizo está deshabilitado por el DJ.', requiredMastery };
  }

  const disciplineAccess = getKnowledgeDisciplineAccess(discipline, character, settings);
  if (!disciplineAccess.accessible) {
    return { accessible: false, reason: disciplineAccess.reason, requiredMastery };
  }

  const mastery = character?.knowledgeMastery?.[discipline.id] || 0;
  if (mastery < requiredMastery) {
    return {
      accessible: false,
      reason: `Requiere maestría de ${discipline.label} Nv. ${requiredMastery}.`,
      requiredMastery,
    };
  }
  return { accessible: true, reason: 'Disponible para aprender.', requiredMastery };
}