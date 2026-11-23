export type StatKey = 'fisico' | 'manipulacion' | 'influencia';

export type CastStatOption = StatKey | 'manual' | 'none';

export type SpellEffectType = 'damage' | 'defense' | 'heal' | 'effect';

export type DamageKind = 'fisico' | 'magico';

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12';

export type DamageResolutionMode = 'auto' | 'manual';

export type ManaDiscountMode = 'auto' | 'manual';

export type CharacterKind = 'mage' | 'npc';

export type CharacterCondition = 'active' | 'unconscious_mana' | 'unconscious_hp' | 'dead';

export type MusicianInstrumentId =
  | 'ocarina'
  | 'guitarra'
  | 'voz'
  | 'banjo'
  | 'flauta'
  | 'laud'
  | 'arpa'
  | 'tambor'
  | 'trompeta'
  | 'pandereta';

export interface DamageDie {
  type: DieType;
  count: number;
}

export interface SpellDamageConfig {
  dice: DamageDie[];
  bonus: number;
  notes: string;
}

export type SpellCastRequirement = 'none' | 'prepare' | 'conditional';

export type EffectSubType = 'general' | 'buff' | 'debuff';

export interface SpellArmorConfig {
  isArmor: boolean;
  element?: string;
  damageReduction?: number;
  damageDivisor?: DamageDivisor;
  /** Cantidad de golpes recibidos/mitigados antes de romperse (0/undefined = solo por turnos) */
  maxHits?: number;
}

export interface CollateralDamageConfig {
  enabled: boolean;
  label?: string;
  mode: 'fixed' | 'dice';
  fixedAmount?: number;
  dice?: DamageDie[];
  bonus?: number;
  damageKind: DamageKind;
  durationType: 'instant' | 'turns';
  durationTurns?: number;
}

export type DispelTargetScope = 'armor' | 'buffs' | 'debuffs' | 'all_magical' | 'any';

export interface SpellDispelConfig {
  enabled: boolean;
  scope: DispelTargetScope;
  /** 0 = todos los coincidentes; >= 1 = cantidad máxima de efectos a disipar */
  maxEffects?: number;
  /** true = chequeo de Influencia; false = disipación directa */
  requiresInfluenceCheck?: boolean;
}

export type ElementalStatusKind = 'burn' | 'poison' | 'frozen' | 'electrified' | 'bleeding';

export type ElementalTriggerRule = 'auto' | 'always' | 'upper_half' | 'max_die';

export interface SpellElementalStatusConfig {
  kind: ElementalStatusKind;
  trigger: ElementalTriggerRule;
  stacks: number;
  durationTurns: number;
  tickDie?: DieType;
  damageKind?: DamageKind;
}

export type SynergyReactionType =
  | 'none'
  | 'detonate_burn'
  | 'siphon_poison'
  | 'shatter_frozen'
  | 'overload_electrified'
  | 'hemorrhage_bleed';

export type SpellDependencyScope = 'self_active' | 'ally_active' | 'target_status';

/** Requisito de activación que debe cumplirse para ejecutar el hechizo. */
export interface SpellDependencyConfig {
  enabled: boolean;
  /** Propio (buff/preparado del lanzador), buff propio o aliado, o estado activo en el objetivo */
  scope: SpellDependencyScope;
  /** ID opcional del hechizo vinculado desde el grimorio */
  requiredSpellId?: string;
  /** Nombre visible y clave de coincidencia del hechizo, buff o estado requerido */
  requiredName: string;
  /** true = consume/disipa el requisito al ejecutar; false = lo mantiene activo */
  consumeOnUse: boolean;
}

export type AreaTargetMode =
  | 'area_selected'
  | 'all_enemies'
  | 'all_electrified'
  | 'all_with_status';

export interface SpellAreaConfig {
  enabled: boolean;
  /** Cómo selecciona objetivos el daño en área */
  mode: AreaTargetMode;
  /** Máximo de objetivos afectados (0 o undefined = sin límite) */
  maxTargets?: number;
  /** Estado requerido cuando mode === 'all_with_status' (ej. Electrificado, Quemadura) */
  requiredStatusName?: string;
  /** Nota breve de forma/alcance (ej. 'Radio 20 pies', 'Cadena eléctrica') */
  shapeNote?: string;
}

export type CombatStatusKey =
  | 'aturdir'
  | 'cegar'
  | 'derribar'
  | 'desarmar'
  | 'empujar'
  | 'ensordecer'
  | 'inmovilizar'
  | 'noquear'
  | 'ralentizar'
  | 'silenciar'
  | 'intimidar';

export interface SpellStatusParamConfig {
  /** Cantidad de fallos automáticos aplicados por el estado (Cegar, Derribar, Ensordecer, Ralentizar, Intimidar) */
  autoFails?: number;
  /** Para Aturdir: true = dura hasta recibir 1 golpe (por defecto); false = según duración del hechizo */
  untilHit?: boolean;
}

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  orders: string[];
  /** Estados posibles aplicados por el hechizo (siempre resueltos por Influencia) */
  statuses: string[];
  /** Parámetros mecánicos por estado (ej. fallos automáticos de Cegar/Ensordecer o si Aturdir dura hasta 1 golpe) */
  statusParams?: Record<string, SpellStatusParamConfig>;
  /** Si está definido, el hechizo pertenece a la lista privada de ese personaje/jugador */
  ownerCharacterId?: string;
  /** Define si requiere acción previa de casteo, ejecución directa o solo en situaciones específicas */
  castRequirement?: SpellCastRequirement;
  /** Momento o situación en que es necesario castear (cuando es condicional) */
  castCondition?: string;
  castStat: CastStatOption;
  manualCastDice: number;
  assuredSuccess: number;
  /** Usado en hechizos de daño (ataque) y de defensa (esquiva/bloqueo) */
  combatStats: StatKey[];
  damageMode: DamageResolutionMode;
  effectType: SpellEffectType;
  /** Subcategoría cuando effectType === 'effect': buff, debuff o efecto general */
  effectSubType?: EffectSubType;
  /** Configuración opcional de armadura elemental/mágica para buffs */
  armorConfig?: SpellArmorConfig;
  /** Configuración opcional para quitar/cancelar/disipar buffs, armaduras o debuffs del objetivo */
  dispelConfig?: SpellDispelConfig;
  /** Configuración explícita de estado elemental/daño continuo (quemar, envenenar, congelar, electrificar, sangrar) */
  elementalStatus?: SpellElementalStatusConfig;
  /** Sinergia / reacción elemental al impactar o lanzarse sobre un objetivo con estado activo */
  synergyReaction?: SynergyReactionType;
  /** Cantidad de cargas consumidas por la reacción de sinergia (por defecto 1; puede ser un número o 'all') */
  synergyConsumeStacks?: number | 'all';
  /** Requisito de activación propio, de un aliado o del objetivo */
  dependency?: SpellDependencyConfig;
  /** Configuración opcional de daño en área / múltiples objetivos (ej. Bola de Fuego, Arco Voltaico) */
  areaConfig?: SpellAreaConfig;
  /** Configuración opcional de daño colateral (impacto cercano o secuela por turnos) */
  collateral?: CollateralDamageConfig;
  /** Todos los hechizos hacen daño mágico salvo acciones puramente físicas no mágicas */
  damageKind?: DamageKind;
  /** Si es true, este hechizo no acumula ni se mejora por maestría */
  noMastery?: boolean;
  damage: SpellDamageConfig;
  effectDescription: string;
  duration: string;
  /** Duración numérica en turnos para contador y disipación automática */
  durationTurns?: number;
  /** Cantidad de golpes recibidos/disminuidos antes de romperse/disiparse (armaduras, escudos, buffs) */
  maxHits?: number;
  isBasic: boolean;
  /** Si es true, este hechizo comienza como no aprendido y vive por defecto en el Archivo Arcano */
  unlearnedByDefault?: boolean;
  /** Si es true, es una plantilla adaptable al elemento/naturaleza del mago desde el Archivo Arcano */
  isAdaptableTemplate?: boolean;
  /** Rol principal usado por el motor de adaptación elemental */
  adaptableElementRole?: 'attack' | 'armor' | 'buff' | 'control' | 'heal';
  /** ID de la plantilla del Archivo Arcano desde la cual se generó este hechizo adaptado */
  catalogTemplateId?: string;
  /** Agrupación opcional de cadena de dependencias en el Archivo Arcano */
  catalogChainGroup?: string;
}
export type BardInstrumentSubArchetype =
  | 'voz_lirica'
  | 'cuerda_tensa'
  | 'percusion_guerra'
  | 'viento_arcano';
export interface KnowledgeDisciplineRequirement {
  disciplineId: string;
  minimumMastery: number;
}

export interface KnowledgeTreeSettings {
  disabledDisciplineIds: string[];
  disabledSpellIds: string[];
  accessRequirementsByDiscipline: Record<string, KnowledgeDisciplineRequirement[]>;
  masteryRequirementsBySpell: Record<string, number>;
  branchOrderByDiscipline: Record<string, string[]>;
}

export type WeaponCategory = 'melee' | 'ranged' | 'natural' | 'catalyst';

export type CatalystKind = 'one_hand' | 'bow' | 'great' | 'shield';

export interface WeaponPreset {
  id: string;
  name: string;
  category: WeaponCategory;
  dice: DamageDie[];
  isMagicalCatalyst?: boolean;
  catalystKind?: CatalystKind;
  addsManipulacionLevel?: boolean;
  addsInfluenciaLevel?: boolean;
  reducesDefenseManaBy?: number;
  canExpandWithMana?: boolean;
  isNatural?: boolean;
  description: string;
}

export interface WeaponImbuement {
  element: string;
  manaSpent: number;
  disintegratesAfterAttack: boolean;
  roundImbued: number;
}

export interface CharacterWeapon {
  id: string;
  presetId: string;
  name: string;
  category: WeaponCategory;
  dice: DamageDie[];
  isMagicalCatalyst: boolean;
  catalystKind?: CatalystKind;
  addsManipulacionLevel?: boolean;
  addsInfluenciaLevel?: boolean;
  reducesDefenseManaBy?: number;
  canExpandWithMana?: boolean;
  isNatural?: boolean;
  imbued?: WeaponImbuement | null;
  destroyed?: boolean;
  destroyedReason?: string;
}

export interface CharacterStats {
  fisico: number;
  manipulacion: number;
  influencia: number;
}

export interface ResourcePool {
  current: number;
  max: number;
}

export type MagePhysicalVariant =
  | 'golpe_fisico'
  | 'garras'
  | 'mordida'
  | 'embestida'
  | 'personalizado';

export type MasteryGrowthMode = 'double' | 'linear' | 'stepped' | 'custom';

export type ProgressionHistoryKind = 'level_up' | 'banquet' | 'stat_change';

export interface ProgressionHistoryEntry {
  id: string;
  timestamp: string;
  kind: ProgressionHistoryKind;
  characterLevelAfter: number;
  summary: string;
  manaMaxDelta?: number;
  hpMaxDelta?: number;
  hpDiceRolls?: number[];
  statDeltas?: Partial<CharacterStats>;
  fisicoLevelChange?: { from: number; to: number };
  note?: string;
}

export interface Character {
  id: string;
  name: string;
  kind: CharacterKind;
  /** Nivel del personaje (empieza en 1, solo sube mediante Subir de nivel; no modificable manualmente) */
  characterLevel?: number;
  /** Historial inmutable de subidas de nivel, tiradas de PV por Físico, banquetes y cambios de estadísticas */
  progressionHistory?: ProgressionHistoryEntry[];
  nature?: string;
  physicalVariant?: MagePhysicalVariant;
  musicianInstrument?: MusicianInstrumentId;
  stats: CharacterStats;
  /** Puntos acumulados por característica (ej. 11 o 14 mantiene el mismo nivel hasta el siguiente hito) */
  statPoints?: CharacterStats;
  hp: ResourcePool;
  mana: ResourcePool;
  knownSpells: string[];
  /** IDs de hechizos del Archivo Arcano que el personaje marcó como objetivos personales */
  archiveGoalIds?: string[];
  /** IDs de hechizos del catálogo del Archivo Arcano con la llave abierta para este personaje */
  unlockedArchiveSpellIds?: string[];
  /** Naturalezas / sub-elementos adicionales desbloqueados por este personaje (ej. Magma para un mago de Fuego) */
  unlockedNatures?: string[];
  /** Maestría de conocimiento por disciplina; separada de maestría por hechizo y de combate */
  knowledgeMastery?: Record<string, number>;
  /** Disciplinas descubiertas por decisión del DJ, incluso si su requisito normal no se cumplió */
  discoveredKnowledgeDisciplines?: string[];
  /** Orden personalizado de hechizos dentro del grimorio de este personaje */
  spellOrder?: string[];
  /** Favoritos y etiquetas personales; no afectan la disponibilidad del hechizo */
  favoriteSpellIds?: string[];
  personalSpellTags?: Record<string, string[]>;
  personalSpellTagNames?: string[];
  spellSortMode?: 'custom' | 'name' | 'category' | 'mana' | 'nature' | 'favorites';
  /** Éxitos acumulados sin negativos (5 = +1, 6 = +2) por ID de hechizo */
  spellMastery?: Record<string, number>;
  /** Armas físicas, naturales y catalizadores mágicos del personaje */
  weapons?: CharacterWeapon[];
  condition: CharacterCondition;
  notes: string;
  resistances?: string;
  /** Reino de Lostbell: puede llegar a 0 de maná sin quedar inconsciente */
  ignoreManaUnconsciousness?: boolean;
  /** Ciego / percibe por otros sentidos (ecolocalización, sentido arcano, etc.): inmune a penalizaciones de Cegar */
  immuneToBlind?: boolean;
  /** Enemigo temporal generado por el modo Combate contra la máquina */
  isBotPreset?: boolean;
}

export interface OrderCategory {
  id: string;
  name: string;
  description: string;
  orders: string[];
}

export interface PreparedSpell {
  id: string;
  spellId: string;
  spellName: string;
  castSuccesses: number;
  castFails: number;
  duration: string;
  durationTurns?: number;
  remainingTurns?: number;
  roundCast: number;
}

export interface ActiveStatus {
  id: string;
  name: string;
  kind?: EffectSubType | 'status';
  sourceName: string;
  /** ID del hechizo que originó este buff/estado (facilita relaciones de dependencia exactas) */
  sourceSpellId?: string;
  roundApplied: number;
  duration: string;
  durationTurns?: number;
  remainingTurns?: number;
  armorReduction?: number;
  armorDivisor?: DamageDivisor;
  armorElement?: string;
  /** Golpes máximos que soporta antes de romperse/disiparse */
  maxHits?: number;
  /** Golpes restantes antes de romperse/disiparse */
  remainingHits?: number;
  effectDescription?: string;
  isMagical?: boolean;
  /** Cargas acumuladas de quemadura (cada número = turnos restantes de 1 carga de 1d4, máx 10) */
  burnStackTurns?: number[];
  /** Tipo de estado elemental/daño continuo (quemadura, veneno, congelado, electrificado, sangrando) */
  elementalKind?: ElementalStatusKind;
  /** Cargas acumuladas para estados elementales (cada número = turnos restantes de 1 carga) */
  stackTurns?: number[];
  /** Dado de daño por carga al inicio de turno o descarga */
  tickDie?: DieType;
  /** Tipo de daño periódico (mágico o físico) */
  tickDamageKind?: DamageKind;
  /** Configuración de daño colateral periódico por turnos */
  collateralConfig?: {
    mode: 'fixed' | 'dice';
    fixedAmount?: number;
    dice?: DamageDie[];
    bonus?: number;
    damageKind: DamageKind;
    lethal?: boolean;
  };
  /** Buff de Reforzar Hechizo (tira daño x2 y toma el mayor en el próximo hechizo) */
  isReinforceBuff?: boolean;
  /** Cargas de Protección preparadas para mitigar el próximo tick de quemadura o daño colateral */
  pendingProtectionStacks?: number;
  /** Fallos automáticos configurados para este estado (Cegar, Derribar, Ensordecer, Ralentizar, Intimidar) */
  autoFails?: number;
  /** Si es true, este estado se retira automáticamente al recibir un golpe (ej. Aturdir por defecto o retroceso de Empujar) */
  endsOnHit?: boolean;
}

export type BotDifficulty = 'normal' | 'tactical';

export interface Combatant {
  id: string;
  characterId: string;
  initiative: number;
  preparedSpells: PreparedSpell[];
  activeStatuses: ActiveStatus[];
  /** Acciones principales usadas en el turno actual (se reinicia al iniciar nueva ronda) */
  attacksUsedThisTurn?: number;
  /** Indica si este combatiente ya completó su turno en la ronda actual */
  actedThisRound?: boolean;
  /** Si es true, la máquina juega automáticamente los turnos y defensas de este combatiente */
  isBotControlled?: boolean;
  botDifficulty?: BotDifficulty;
}

export interface FormulaConfig {
  base: number;
  multiplier: number;
  notes: string;
  masteryBaseMilestone: number;
  masteryGrowth: MasteryGrowthMode;
  masteryCustomMilestones: number[];
  masteryAssuredBonusPerLevel: number;
  masteryMaxDieUpgrades: number;
  /** Hitos de puntos para cada nivel de característica (Nv.0..Nv.5+) */
  statMilestones?: number[];
}

export interface SpellMasteryStatus {
  successes: number;
  level: number;
  currentThreshold: number;
  nextThreshold: number | null;
  progressPct: number;
  isMaxLevel: boolean;
  bonusAssured: number;
  dieUpgradeSteps: number;
}

export interface RollBreakdownItem {
  stat: StatKey;
  dice: number;
}

export interface D6RollSummary {
  rolls: number[];
  successes: number;
  fails: number;
  assured: number;
  net: number;
  totalDice: number;
  breakdown?: RollBreakdownItem[];
  /** Fallos automáticos sumados por estados activos (ej. Cegar, Derribar, Ensordecer) */
  statusAutoFails?: number;
  /** Detalle legible de los estados que aplicaron fallos automáticos */
  statusPenaltyNotes?: string[];
}

export type DamageDivisor = 0 | 1 | 2 | 4;

export interface DamageRollSummary {
  parts: string[];
  bonus: number;
  total: number;
  rawTotal?: number;
  damageReduction?: number;
  damageDivisor?: DamageDivisor;
  damageKind?: DamageKind;
  maxDieCount?: number;
  /** Cantidad de dados que salieron en la mitad superior positiva (r > caras/2, exacto 50%) */
  upperHalfDieCount?: number;
  burnStacksApplied?: number;
  isFireDamage?: boolean;
  elementalStatusesApplied?: string[];
  /** true si el impacto aplicó crítico automático (ej. objetivo Aturdido o Noqueado) */
  isCriticalHit?: boolean;
  criticalReason?: string;
  notes: string;
  isManual: boolean;
}

export type DefenseOutcome = 'attacker_wins' | 'tie_verify_damage' | 'defender_wins';

export interface PendingDamageDecision {
  rawSummary: DamageRollSummary;
  reinforceNote?: string;
  source: 'defense_fail' | 'tie_verify' | 'direct_hit';
  defenseLabel?: string;
  defenseMasteryNote?: string;
}

export interface PendingAttack {
  id: string;
  attackerCombatantId: string;
  attackerCharacterId: string;
  attackerName: string;
  spell: Spell;
  isLethal: boolean;
  preparedSpellId?: string;
  attackRoll: D6RollSummary;
  /** Cuando hay empate (ataque == defensa), se habilita tirada extra para verificar daños */
  targetCombatantId?: string;
  defenseRoll?: {
    defenderName: string;
    defenseLabel: string;
    roll: D6RollSummary;
    manaSpent: number;
    outcome: DefenseOutcome;
  };
  /** Daño ya tirado/decidido esperando confirmación final y posible uso de Protección */
  pendingDamage?: PendingDamageDecision;
  damageRoll?: DamageRollSummary;
  isReinforced?: boolean;
  protectionStacks?: number;
  /** Cola de objetivos adicionales cuando el hechizo es de daño en área / multi-objetivo */
  areaTargetIds?: string[];
  /** Historial compacto de objetivos ya resueltos en este ataque en área */
  areaResolvedTargets?: Array<{
    combatantId: string;
    name: string;
    outcome: 'blocked' | 'hit';
    damage: number;
  }>;
  /** Etiqueta descriptiva del área (ej. 'Área (3 objetivos)' o 'Arco Voltaico · Electrificados') */
  areaLabel?: string;
  resolved: boolean;
}

export interface PendingCounterspell {
  id: string;
  interruptorCharacterId: string;
  interruptorName: string;
  targetCharacterId?: string;
  targetName?: string;
  spellName?: string;
  interruptRoll: D6RollSummary;
}

export interface PendingStatusCheck {
  id: string;
  casterCharacterId: string;
  casterName: string;
  targetCombatantId: string;
  spellId?: string;
  spellName: string;
  statuses: string[];
  statusParams?: Record<string, SpellStatusParamConfig>;
  kind?: EffectSubType | 'status';
  duration: string;
  durationTurns?: number;
  effectDescription?: string;
  isMagical?: boolean;
  dispelConfig?: SpellDispelConfig;
  elementalStatus?: SpellElementalStatusConfig;
  synergyReaction?: SynergyReactionType;
  synergyConsumeStacks?: number | 'all';
  casterRoll: D6RollSummary;
}

export interface ManualStatusPayload {
  targetCombatantId: string;
  mode: 'control' | 'elemental' | 'custom';
  statusName: string;
  controlKey?: CombatStatusKey;
  elementalKind?: ElementalStatusKind;
  kind?: EffectSubType | 'status';
  durationTurns?: number;
  autoFails?: number;
  untilHit?: boolean;
  includeProneOnPush?: boolean;
  stacks?: number;
  tickDie?: DieType | 'none';
  damageKind?: DamageKind;
  effectDescription?: string;
  isMagical?: boolean;
}

export type LogClashOutcome =
  | 'pending_defense'
  | 'attacker_wins'
  | 'defender_wins'
  | 'tie_verify_damage'
  | 'direct_hit'
  | 'protection'
  | 'defense_test'
  | 'counterspell_success'
  | 'counterspell_fail';

export interface LogClashInfo {
  attackerName?: string;
  attackerAction?: string;
  defenderName?: string;
  defenderAction?: string;
  outcome: LogClashOutcome;
  damageKind?: DamageKind;
  isLethal?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  kind: 'cast' | 'attack' | 'defense' | 'heal' | 'event' | 'quick';
  title: string;
  actorName?: string;
  isMagical?: boolean;
  clash?: LogClashInfo;
  castRoll?: D6RollSummary;
  attackRoll?: D6RollSummary;
  defenseRoll?: D6RollSummary;
  damageRoll?: DamageRollSummary;
  manaNote?: string;
  masteryNote?: string;
  summaryText: string;
  pendingAttackId?: string;
}

export type ArenaBoxId = 'grimorio' | 'weapons' | 'combat' | 'log';

export interface ArenaLayoutConfig {
  left: ArenaBoxId[];
  right: ArenaBoxId[];
}

export interface ThemeColors {
  canvas: string;
  header: string;
  surface: string;
  surfaceAlt: string;
  raised: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  action: string;
  physicalBg: string;
  physicalAccent: string;
  magicBg: string;
  magicAccent: string;
}

export interface SavedCustomTheme {
  id: string;
  name: string;
  colors: ThemeColors;
  updatedAt: string;
}

export interface GrimorioThemeConfig {
  presetId: string;
  colors: ThemeColors;
  savedCustomThemes?: SavedCustomTheme[];
}