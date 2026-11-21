/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BookOpen,
  Dice1 as Dice,
  GripVertical,
  LayoutGrid,
  Palette,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  ActiveStatus,
  ArenaBoxId,
  ArenaLayoutConfig,
  BotDifficulty,
  Character,
  CharacterWeapon,
  Combatant,
  DamageDie,
  DamageDivisor,
  DamageKind,
  DamageRollSummary,
  DieType,
  ElementalStatusKind,
  FormulaConfig,
  GrimorioThemeConfig,
  KnowledgeTreeSettings,
  LogEntry,
  ManaDiscountMode,
  ManualStatusPayload,
  PendingAttack,
  PendingCounterspell,
  PendingStatusCheck,
  PreparedSpell,
  Spell,
  SpellDispelConfig,
  StatKey,
  SynergyReactionType,
} from './types/rpg';
import {
  ADAPTABLE_CATALOG_SPELLS,
  ALL_ARCHIVE_LOCKED_IDS,
  BASIC_SPELLS,
  BASIC_SPELL_IDS,
  BURN_DURATION_TURNS,
  COMBAT_STATUS_MECHANICS,
  DEFAULT_FORMULA,
  DISPEL_SCOPE_LABELS,
  ELEMENTAL_STATUS_META,
  INITIAL_CHARACTERS,
  MAX_BURN_STACKS,
  MAX_ELEMENTAL_STACKS,
  PRESET_ORDERS,
  PRESET_STATUSES,
  STARTER_MAGE_SPELL_IDS,
  STARTER_NPC_SPELL_IDS,
  STAT_NAMES,
  SYNERGY_LABELS,
  UNLEARNED_BASIC_SPELL_IDS,
  adaptCatalogSpellForCharacter,
  buildMageSignatureSpells,
  calcDirectProtectionSummary,
  calcStatLevelFromPoints,
  characterHasNatureCanalizado,
  conditionLabel,
  consumeElementalStacks,
  countRawD6Successes,
  createWeaponFromPreset,
  deriveCondition,
  detectSpellSynergy,
  evaluateCatalogSpellCompatibility,
  evaluateSpellDependency,
  formatCollateralValue,
  formatFormulaText,
  formatTurnDuration,
  generateId,
  type SpellDependencyMatch,
  getCatalogPrerequisiteTemplateId,
  getCharacterOwnedNatureIds,
  getCharacterStatDice,
  getCharacterStatPoints,
  getCombatantStatusEffects,
  getCombatantTurnActionStatus,
  getEffectiveDefenseManaCost,
  getEffectiveEffectSubType,
  getEffectiveSpellDamageDice,
  getEffectiveSpellDamageKind,
  getMageStarterBasicIds,
  getMaxAffordableProtectionStacks,
  getSpellMasteryStatus,
  getSpellStatusParam,
  getStatMilestones,
  getStatusElementalKind,
  getStatusStackTurns,
  getSynergyConsumeCount,
  getWeaponDamageFormula,
  isBleedingDamageSpell,
  isElectricDamageSpell,
  isFireDamageSpell,
  isIceDamageSpell,
  isPoisonDamageSpell,
  isSignatureCanalizadoSpell,
  isSignaturePhysicalSpell,
  isSpellMagical,
  matchesDispelScope,
  mergeBurnStacks,
  mergeElementalStacks,
  normalizeCombatStatusKey,
  normalizeFormula,
  parseDurationTurns,
  resolveNaturePresetForCharacter,
  resolveSpellAreaTargets,
  rollCombinedStats,
  rollCriticalDamageDice,
  rollD6Pool,
  rollDamageDice,
  sanitizeSignatureSpellsState,
  sortCombatantsByInitiative,
  spellConsumesTurnAction,
  spellSupportsMastery,
} from './utils/dice';
import {
  DEFAULT_KNOWLEDGE_TREE_SETTINGS,
  KNOWLEDGE_DISCIPLINES,
  KNOWLEDGE_SPELL_METADATA,
  KNOWLEDGE_TREE_SPELLS,
  getKnowledgeSpellAccess,
  normalizeKnowledgeTreeSettings,
} from './utils/knowledgeTrees';
import { GrimorioEditor } from './components/GrimorioEditor';
import { SpellBookList } from './components/SpellBookList';
import { ArcaneArchivePanel } from './components/ArcaneArchivePanel';
import { QuickCastPanel } from './components/QuickCastPanel';
import { WeaponArsenal } from './components/WeaponArsenal';
import { CharacterRoster, type CreateCharacterOptions } from './components/CharacterRoster';
import { CombatPanel } from './components/CombatPanel';
import { LogPanel } from './components/LogPanel';
import { CombatMechanicReader, type CombatMechanicContext } from './components/CombatMechanicReader';
import { CombatMechanicsCompendium } from './components/CombatMechanicsCompendium';
import { FormulaAndBackup } from './components/FormulaAndBackup';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { CustomDiceRoller } from './components/CustomDiceRoller';
import type { CombatMechanicId } from './utils/combatMechanics';

const ARCANE_VERSION = 'v1.8.0';
const BUILTIN_SPELLS = [...BASIC_SPELLS, ...KNOWLEDGE_TREE_SPELLS];
import {
  BOT_ENEMY_PRESETS,
  chooseBotDefenseChoice,
  chooseBotProtectionStacks,
  chooseBotTurnAction,
  createBotCharacterFromPreset,
  getBotArmorModifiers,
} from './utils/botAi';
import {
  DEFAULT_ARENA_LAYOUT,
  DEFAULT_THEME_CONFIG,
  buildThemeCssVars,
  normalizeThemeConfig,
} from './utils/themes';

type ActiveTab = 'arena' | 'archive' | 'quickcast' | 'characters' | 'settings';
type MobileArenaSection = 'all' | 'grimorio' | 'weapons' | 'combat' | 'log';

const ALL_ARENA_BOX_IDS: ArenaBoxId[] = ['grimorio', 'weapons', 'combat', 'log'];

const ARENA_BOX_META: Record<ArenaBoxId, { title: string; subtitle: string }> = {
  grimorio: { title: 'Casteo rápido', subtitle: 'Hechizos lanzables, objetivo y golpe' },
  weapons: { title: 'Armas y Escudos', subtitle: 'Equipo e imbuir poder' },
  combat: { title: 'Mesa de Combate', subtitle: 'Turnos, vida, maná y daño' },
  log: { title: 'Registro de Tiradas', subtitle: 'Historial y dados rápidos' },
};

function normalizeArenaLayout(raw: unknown): ArenaLayoutConfig {
  const validSet = new Set<ArenaBoxId>(ALL_ARENA_BOX_IDS);
  const seen = new Set<ArenaBoxId>();
  const left: ArenaBoxId[] = [];
  const right: ArenaBoxId[] = [];

  if (raw && typeof raw === 'object') {
    const obj = raw as { left?: unknown; right?: unknown };
    if (Array.isArray(obj.left)) {
      for (const item of obj.left) {
        if (typeof item === 'string' && validSet.has(item as ArenaBoxId) && !seen.has(item as ArenaBoxId)) {
          seen.add(item as ArenaBoxId);
          left.push(item as ArenaBoxId);
        }
      }
    }
    if (Array.isArray(obj.right)) {
      for (const item of obj.right) {
        if (typeof item === 'string' && validSet.has(item as ArenaBoxId) && !seen.has(item as ArenaBoxId)) {
          seen.add(item as ArenaBoxId);
          right.push(item as ArenaBoxId);
        }
      }
    }
  }

  for (const id of DEFAULT_ARENA_LAYOUT.left) {
    if (!seen.has(id)) {
      seen.add(id);
      left.push(id);
    }
  }
  for (const id of DEFAULT_ARENA_LAYOUT.right) {
    if (!seen.has(id)) {
      seen.add(id);
      right.push(id);
    }
  }

  return { left, right };
}

interface PersistedState {
  characters: Character[];
  activeCharacterId: string;
  spells: Spell[];
  customOrders: string[];
  customStatuses: string[];
  formula: FormulaConfig;
  manaMode: ManaDiscountMode;
  round: number;
  combatants: Combatant[];
  currentTurnCombatantId?: string;
  autoPassTurn?: boolean;
  arenaLayout?: ArenaLayoutConfig;
  theme?: GrimorioThemeConfig;
  globalSpellOrder?: string[];
  knowledgeTreeSettings?: KnowledgeTreeSettings;
}

const STORAGE_KEY = 'arcane_rpg_v8';
const LEGACY_STORAGE_KEY_V7 = 'arcane_rpg_v7';
const UNDO_STORAGE_KEY = 'arcane_rpg_undo_v8';

function buildDefaultState(): PersistedState {
  return {
    characters: JSON.parse(JSON.stringify(INITIAL_CHARACTERS)),
    activeCharacterId: INITIAL_CHARACTERS[0].id,
    spells: JSON.parse(JSON.stringify(BUILTIN_SPELLS)),
    customOrders: [],
    customStatuses: [],
    formula: { ...DEFAULT_FORMULA, masteryCustomMilestones: [...DEFAULT_FORMULA.masteryCustomMilestones] },
    manaMode: 'auto',
    round: 1,
    combatants: [
      {
        id: 'cb_init_1',
        characterId: INITIAL_CHARACTERS[0].id,
        initiative: 5,
        preparedSpells: [],
        activeStatuses: [],
      },
      {
        id: 'cb_init_2',
        characterId: INITIAL_CHARACTERS[1].id,
        initiative: 3,
        preparedSpells: [],
        activeStatuses: [],
        attacksUsedThisTurn: 0,
        actedThisRound: false,
      },
    ],
    currentTurnCombatantId: 'cb_init_1',
    autoPassTurn: true,
    arenaLayout: {
      left: [...DEFAULT_ARENA_LAYOUT.left],
      right: [...DEFAULT_ARENA_LAYOUT.right],
    },
    theme: {
      presetId: DEFAULT_THEME_CONFIG.presetId,
      colors: { ...DEFAULT_THEME_CONFIG.colors },
      savedCustomThemes: [],
    },
    globalSpellOrder: [],
    knowledgeTreeSettings: { ...DEFAULT_KNOWLEDGE_TREE_SETTINGS },
  };
}

function loadUndoSnapshot(): PersistedState | null {
  try {
    const raw = localStorage.getItem(UNDO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (Array.isArray(parsed?.characters) && parsed.characters.length > 0) {
      return {
        ...parsed,
        formula: normalizeFormula(parsed.formula),
        arenaLayout: normalizeArenaLayout(parsed.arenaLayout),
        theme: normalizeThemeConfig(parsed.theme),
        globalSpellOrder: Array.isArray(parsed.globalSpellOrder) ? parsed.globalSpellOrder : [],
        knowledgeTreeSettings: normalizeKnowledgeTreeSettings(parsed.knowledgeTreeSettings),
      };
    }
  } catch {
    // ignore malformed undo snapshot
  }
  return null;
}

function loadInitialState(): PersistedState {
  try {
    const rawV8 = localStorage.getItem(STORAGE_KEY);
    const rawLegacy = !rawV8 ? localStorage.getItem(LEGACY_STORAGE_KEY_V7) : null;
    const raw = rawV8 || rawLegacy;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const rawCharacters =
        Array.isArray(parsed.characters) && parsed.characters.length > 0
          ? parsed.characters
          : INITIAL_CHARACTERS;
      const rawSpells =
        Array.isArray(parsed.spells) && parsed.spells.length > 0
          ? parsed.spells
          : BUILTIN_SPELLS;
      const normalizedSpells: Spell[] = rawSpells.map((sp) => {
        const isCanalizadoBasic = sp.id === 'basic_ataque_canalizado';
        const isCanalizadoSignature =
          sp.name.startsWith('Impacto Canalizado (') &&
          (sp.effectDescription || '').includes('Casteo automático');
        const nextDescription = isCanalizadoBasic
          ? (sp.effectDescription || '').includes('Casteo automático')
            ? 'Ataque mágico base a distancia de todos los magos (1d4 mágico). Se lanza directo sin casteo previo.'
            : sp.effectDescription
          : isCanalizadoSignature
            ? (sp.effectDescription || '').replace(
                /Hace daño mágico\.\s*Casteo automático \(1 acción\); lanzar el ataque es una acción aparte\./i,
                'Se lanza directo sin casteo previo.'
              )
            : sp.effectDescription;
        const withStatuses: Spell = {
          ...sp,
          statuses: Array.isArray(sp.statuses) ? sp.statuses : [],
          damageKind:
            sp.id === 'basic_golpe_fisico'
              ? 'fisico'
              : sp.damageKind || (sp.effectType === 'damage' ? 'magico' : undefined),
          castRequirement:
            isCanalizadoBasic || isCanalizadoSignature
              ? 'none'
              : sp.castRequirement ||
                (sp.id === 'basic_golpe_fisico' ||
                sp.id === 'basic_luz_mago' ||
                sp.id === 'basic_escudo_magico' ||
                sp.id === 'basic_curar_heridas' ||
                sp.id === 'basic_destello_cegador' ||
                sp.id === 'basic_choque_noqueador'
                  ? 'none'
                  : undefined),
          duration:
            (isCanalizadoBasic || isCanalizadoSignature) && sp.duration === '1 golpe'
              ? 'Instantáneo'
              : sp.duration,
          effectDescription: nextDescription,
        };
        if (
          withStatuses.id === 'basic_luz_mago' ||
          withStatuses.id === 'basic_curar_heridas' ||
          withStatuses.id === 'basic_puno_tierra'
        ) {
          return {
            ...withStatuses,
            castStat: 'none' as const,
            ...(withStatuses.id === 'basic_curar_heridas' ? { noMastery: true } : {}),
          };
        }
        if (
          withStatuses.id === 'basic_foco_arcano' ||
          withStatuses.id === 'basic_descarga_focalizada' ||
          withStatuses.id === 'basic_estallido_conmocionante'
        ) {
          return {
            ...withStatuses,
            unlearnedByDefault: true,
            catalogChainGroup: withStatuses.catalogChainGroup || 'Foco Arcano',
            noMastery:
              typeof withStatuses.noMastery === 'boolean'
                ? withStatuses.noMastery
                : withStatuses.id !== 'basic_descarga_focalizada',
          };
        }
        return withStatuses;
      });

      const existingIds = new Set(normalizedSpells.map((s) => s.id));
      const missingNewBasics = BUILTIN_SPELLS.filter((b) => !existingIds.has(b.id));
      const mergedSpells = [...normalizedSpells, ...missingNewBasics];

      const newBasicIds = missingNewBasics
        .filter((b) => !b.unlearnedByDefault)
        .map((b) => b.id);
      const missingStarterMageIds = newBasicIds.filter((id) =>
        STARTER_MAGE_SPELL_IDS.includes(id)
      );
      const migratedCharacters = rawCharacters.map((ch) => {
        const currentKnown = Array.isArray(ch.knownSpells) ? ch.knownSpells : [];
        const idsToAdd =
          ch.id === 'char_mago'
            ? newBasicIds
            : ch.kind === 'mage'
              ? missingStarterMageIds
              : [];
        return {
          ...ch,
          resistances: typeof ch.resistances === 'string' ? ch.resistances : '',
          spellMastery:
            ch.spellMastery && typeof ch.spellMastery === 'object' ? ch.spellMastery : {},
          weapons: Array.isArray(ch.weapons) ? ch.weapons : [],
          knownSpells:
            idsToAdd.length > 0
              ? [...new Set([...currentKnown, ...idsToAdd])]
              : currentKnown,
          unlockedArchiveSpellIds: Array.isArray(ch.unlockedArchiveSpellIds)
            ? ch.unlockedArchiveSpellIds
            : [],
          archiveGoalIds: Array.isArray(ch.archiveGoalIds)
            ? [...new Set(ch.archiveGoalIds.filter((id: unknown): id is string => typeof id === 'string'))]
            : [],
          favoriteSpellIds: Array.isArray(ch.favoriteSpellIds)
            ? [...new Set(ch.favoriteSpellIds.filter((id: unknown): id is string => typeof id === 'string'))]
            : [],
          personalSpellTags:
            ch.personalSpellTags && typeof ch.personalSpellTags === 'object'
              ? ch.personalSpellTags
              : {},
          personalSpellTagNames: Array.isArray(ch.personalSpellTagNames)
            ? [...new Set(ch.personalSpellTagNames.filter((tag: unknown): tag is string => typeof tag === 'string'))]
            : [],
          spellSortMode: ['custom', 'name', 'category', 'mana', 'nature', 'favorites'].includes(ch.spellSortMode || '')
            ? ch.spellSortMode
            : 'custom',
          unlockedNatures: Array.isArray(ch.unlockedNatures) ? ch.unlockedNatures : [],
          knowledgeMastery:
            ch.knowledgeMastery && typeof ch.knowledgeMastery === 'object'
              ? Object.fromEntries(
                  Object.entries(ch.knowledgeMastery)
                    .filter(([, level]) => typeof level === 'number' && Number.isFinite(level))
                    .map(([id, level]) => [id, Math.max(0, Math.min(3, Math.floor(level)))])
                )
              : {},
          discoveredKnowledgeDisciplines: Array.isArray(ch.discoveredKnowledgeDisciplines)
            ? [...new Set(ch.discoveredKnowledgeDisciplines.filter((id: unknown): id is string => typeof id === 'string'))]
            : [],
          condition: deriveCondition(
            ch.hp?.current ?? 1,
            ch.mana?.current ?? 0,
            ch.condition || 'active',
            false,
            ch.mana?.max ?? 0,
            Boolean(ch.ignoreManaUnconsciousness)
          ),
          ignoreManaUnconsciousness: Boolean(ch.ignoreManaUnconsciousness),
          immuneToBlind: Boolean(ch.immuneToBlind),
          characterLevel:
            typeof ch.characterLevel === 'number' && ch.characterLevel >= 1
              ? Math.floor(ch.characterLevel)
              : 1,
          progressionHistory: Array.isArray(ch.progressionHistory) ? ch.progressionHistory : [],
        };
      });

      const sanitizedInitial = sanitizeSignatureSpellsState(mergedSpells, migratedCharacters);
      const spells = sanitizedInitial.spells;
      const characters = sanitizedInitial.characters;

      const combatants: Combatant[] = Array.isArray(parsed.combatants)
        ? parsed.combatants.map((cb) => ({
            ...cb,
            preparedSpells: Array.isArray(cb.preparedSpells) ? cb.preparedSpells : [],
            activeStatuses: Array.isArray(cb.activeStatuses) ? cb.activeStatuses : [],
            attacksUsedThisTurn:
              typeof cb.attacksUsedThisTurn === 'number' && cb.attacksUsedThisTurn >= 0
                ? Math.floor(cb.attacksUsedThisTurn)
                : 0,
            actedThisRound: Boolean(cb.actedThisRound),
            isBotControlled: Boolean(cb.isBotControlled),
            botDifficulty: cb.botDifficulty === 'tactical' ? 'tactical' : 'normal',
          }))
        : [
            {
              id: 'cb_init_1',
              characterId: characters[0].id,
              initiative: 5,
              preparedSpells: [],
              activeStatuses: [],
            },
            ...(characters[1]
              ? [
                  {
                    id: 'cb_init_2',
                    characterId: characters[1].id,
                    initiative: 3,
                    preparedSpells: [],
                    activeStatuses: [],
                  },
                ]
              : []),
          ];

      const migratedFormula = normalizeFormula(parsed.formula);
      if (rawLegacy && parsed.formula?.masteryGrowth === 'double') {
        migratedFormula.masteryGrowth = 'linear';
      }

      const validHydratedSpellIds = new Set(spells.map((spell) => spell.id));
      const hydratedCharacters = characters.map((ch) => {
        const pts = ch.statPoints || {
          fisico: getCharacterStatPoints(ch, 'fisico', migratedFormula),
          manipulacion: getCharacterStatPoints(ch, 'manipulacion', migratedFormula),
          influencia: getCharacterStatPoints(ch, 'influencia', migratedFormula),
        };
        return {
          ...ch,
          favoriteSpellIds: (ch.favoriteSpellIds || []).filter((id) => validHydratedSpellIds.has(id)),
          personalSpellTags: Object.fromEntries(
            Object.entries(ch.personalSpellTags || {}).filter(([id]) => validHydratedSpellIds.has(id))
          ),
          statPoints: pts,
          stats: {
            fisico: calcStatLevelFromPoints(pts.fisico, migratedFormula),
            manipulacion: calcStatLevelFromPoints(pts.manipulacion, migratedFormula),
            influencia: calcStatLevelFromPoints(pts.influencia, migratedFormula),
          },
        };
      });

      return {
        characters: hydratedCharacters,
        activeCharacterId: parsed.activeCharacterId || hydratedCharacters[0].id,
        spells,
        customOrders: Array.isArray(parsed.customOrders) ? parsed.customOrders : [],
        customStatuses: Array.isArray(parsed.customStatuses) ? parsed.customStatuses : [],
        formula: migratedFormula,
        manaMode: parsed.manaMode === 'manual' ? 'manual' : 'auto',
        round: typeof parsed.round === 'number' && parsed.round >= 1 ? parsed.round : 1,
        combatants,
        currentTurnCombatantId:
          typeof parsed.currentTurnCombatantId === 'string'
            ? parsed.currentTurnCombatantId
            : undefined,
        autoPassTurn: typeof parsed.autoPassTurn === 'boolean' ? parsed.autoPassTurn : true,
        arenaLayout: normalizeArenaLayout(parsed.arenaLayout),
        theme: normalizeThemeConfig(parsed.theme),
        globalSpellOrder: Array.isArray(parsed.globalSpellOrder) ? parsed.globalSpellOrder : [],
        knowledgeTreeSettings: normalizeKnowledgeTreeSettings(parsed.knowledgeTreeSettings),
      };
    }
  } catch (err) {
    console.warn('Error loading saved Arcane state:', err);
  }

  return buildDefaultState();
}

function nowTime(): string {
  return new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function applyDamageModifiers(
  summary: DamageRollSummary,
  reduction = 0,
  divisor: DamageDivisor = 1
): DamageRollSummary {
  const safeRed = Math.max(0, reduction);
  if (divisor === 0) {
    return {
      ...summary,
      rawTotal: summary.total,
      damageReduction: safeRed,
      damageDivisor: 0,
      total: 0,
    };
  }
  if (safeRed === 0 && divisor === 1) return summary;
  const afterReduction = Math.max(0, summary.total - safeRed);
  const finalTotal = divisor > 1 ? Math.floor(afterReduction / divisor) : afterReduction;
  return {
    ...summary,
    rawTotal: summary.total,
    damageReduction: safeRed,
    damageDivisor: divisor,
    total: finalTotal,
  };
}

export default function App() {
  const [initial] = useState<PersistedState>(() => loadInitialState());

  const [activeTab, setActiveTab] = useState<ActiveTab>('arena');
  const [mobileArenaSection, setMobileArenaSection] = useState<MobileArenaSection>('all');
  const [showQuickFormula, setShowQuickFormula] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<PersistedState | null>(() => loadUndoSnapshot());
  const [showRevertBanner, setShowRevertBanner] = useState(false);
  const [lastMasteryReset, setLastMasteryReset] = useState<{
    characterId: string;
    characterName: string;
    spellId: string;
    spellName: string;
    previousSuccesses: number;
    previousLevel: number;
  } | null>(null);

  const [characters, setCharacters] = useState<Character[]>(initial.characters);
  const [activeCharacterId, setActiveCharacterId] = useState<string>(initial.activeCharacterId);
  const [spells, setSpells] = useState<Spell[]>(initial.spells);
  const [customOrders, setCustomOrders] = useState<string[]>(initial.customOrders);
  const [customStatuses, setCustomStatuses] = useState<string[]>(initial.customStatuses);
  const [formula, setFormula] = useState<FormulaConfig>(initial.formula);
  const [manaMode, setManaMode] = useState<ManaDiscountMode>(initial.manaMode);
  const [round, setRound] = useState<number>(initial.round);
  const [combatants, setCombatants] = useState<Combatant[]>(initial.combatants);
  const [currentTurnCombatantId, setCurrentTurnCombatantId] = useState<string>(
    initial.currentTurnCombatantId || ''
  );
  const [autoPassTurn, setAutoPassTurn] = useState<boolean>(
    typeof initial.autoPassTurn === 'boolean' ? initial.autoPassTurn : true
  );
  const [autoPassPaused, setAutoPassPaused] = useState<boolean>(false);
  const [autoPassSecondsLeft, setAutoPassSecondsLeft] = useState<number | null>(null);
  const [arenaLayout, setArenaLayout] = useState<ArenaLayoutConfig>(
    normalizeArenaLayout(initial.arenaLayout)
  );
  const [theme, setTheme] = useState<GrimorioThemeConfig>(normalizeThemeConfig(initial.theme));
  const [globalSpellOrder, setGlobalSpellOrder] = useState<string[]>(
    Array.isArray(initial.globalSpellOrder) ? initial.globalSpellOrder : []
  );
  const [knowledgeTreeSettings, setKnowledgeTreeSettings] = useState<KnowledgeTreeSettings>(
    () => normalizeKnowledgeTreeSettings(initial.knowledgeTreeSettings)
  );

  // Modo "Combate IRL": solo el jugador, sin enemigos, sin selección de objetivo obligatoria
  const [irlCombatMode, setIrlCombatMode] = useState<boolean>(false);

  // Lanzador de dados personalizado (ventana flotante toggleable)
  const [showCustomDice, setShowCustomDice] = useState<boolean>(false);
  const [customDiceCount, setCustomDiceCount] = useState<number>(2);
  const [customDiceType, setCustomDiceType] = useState<DieType>('d6');
  const [customDiceKind, setCustomDiceKind] = useState<DamageKind>('fisico');

  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);
  const [customizeLayoutMode, setCustomizeLayoutMode] = useState<boolean>(false);
  const [draggedBoxId, setDraggedBoxId] = useState<ArenaBoxId | null>(null);
  const [dropSlot, setDropSlot] = useState<{ column: 'left' | 'right'; index: number } | null>(null);

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [isAttackLethal, setIsAttackLethal] = useState<boolean>(false);
  const [pendingAttack, setPendingAttack] = useState<PendingAttack | null>(null);
  const [pendingCounterspell, setPendingCounterspell] = useState<PendingCounterspell | null>(null);
  const [pendingStatusCheck, setPendingStatusCheck] = useState<PendingStatusCheck | null>(null);
  const [pendingHeal, setPendingHeal] = useState<{
    id: string;
    healerName: string;
    spellName: string;
    amount: number;
    isManual: boolean;
    formulaText: string;
  } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [combatMechanicReader, setCombatMechanicReader] = useState<{
    mechanicId: CombatMechanicId;
    context: CombatMechanicContext;
  } | null>(null);
  const [showCombatMechanicsCompendium, setShowCombatMechanicsCompendium] = useState(false);
  const [compendiumFocusId, setCompendiumFocusId] = useState<CombatMechanicId | undefined>();

  useEffect(() => {
    const vars = buildThemeCssVars(theme.colors);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  }, [theme]);

  useEffect(() => {
    const payload: PersistedState = {
      characters,
      activeCharacterId,
      spells,
      customOrders,
      customStatuses,
      formula,
      manaMode,
      round,
      combatants,
      currentTurnCombatantId,
      autoPassTurn,
      arenaLayout,
      theme,
      globalSpellOrder,
      knowledgeTreeSettings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    characters,
    activeCharacterId,
    spells,
    customOrders,
    customStatuses,
    formula,
    manaMode,
    round,
    combatants,
    currentTurnCombatantId,
    autoPassTurn,
    arenaLayout,
    theme,
    globalSpellOrder,
    knowledgeTreeSettings,
  ]);

  const sortedCombatants = useMemo(
    () => sortCombatantsByInitiative(combatants),
    [combatants]
  );

  const resolvedCurrentTurnCombatantId = useMemo(() => {
    if (
      currentTurnCombatantId &&
      combatants.some((cb) => cb.id === currentTurnCombatantId)
    ) {
      return currentTurnCombatantId;
    }
    const firstActive = sortedCombatants.find((cb) => {
      const ch = characters.find((c) => c.id === cb.characterId);
      return ch && ch.condition === 'active';
    });
    return firstActive?.id || sortedCombatants[0]?.id || '';
  }, [currentTurnCombatantId, combatants, sortedCombatants, characters]);

  const activeCharacter =
    characters.find((c) => c.id === activeCharacterId) || characters[0];

  // Mantener objetivo válido distinto del actor actual
  useEffect(() => {
    const candidates = combatants.filter((cb) => cb.characterId !== activeCharacter?.id);
    if (candidates.length === 0) {
      if (selectedTargetId !== '') setSelectedTargetId('');
      return;
    }
    if (!candidates.some((cb) => cb.id === selectedTargetId)) {
      setSelectedTargetId(candidates[0].id);
    }
  }, [combatants, activeCharacter?.id, selectedTargetId]);

  const allOrders = [...new Set([...PRESET_ORDERS, ...customOrders])].sort();
  const allStatuses = [...new Set([...PRESET_STATUSES, ...customStatuses])].sort();
  const combatCharacterIds = new Set(combatants.map((c) => c.characterId));

  const handleChangeFormula = (nextRaw: FormulaConfig) => {
    const nextFormula = normalizeFormula(nextRaw);
    setFormula(nextFormula);
    setCharacters((prev) =>
      prev.map((c) => {
        if (!c.statPoints) return c;
        return {
          ...c,
          stats: {
            fisico: calcStatLevelFromPoints(c.statPoints.fisico, nextFormula),
            manipulacion: calcStatLevelFromPoints(c.statPoints.manipulacion, nextFormula),
            influencia: calcStatLevelFromPoints(c.statPoints.influencia, nextFormula),
          },
        };
      })
    );
  };

  const pushLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prev) => [
      { ...entry, id: generateId('log_'), timestamp: nowTime() },
      ...prev,
    ]);
  };

  const applyManaCost = (
    charId: string,
    cost: number
  ): { ok: boolean; note: string } => {
    if (cost <= 0) return { ok: true, note: '' };
    if (manaMode === 'manual') {
      return {
        ok: true,
        note: `Modo manual: recordá descontar ${cost} de maná si corresponde.`,
      };
    }

    const target = characters.find((c) => c.id === charId);
    if (!target) return { ok: false, note: 'Personaje no encontrado.' };
    if (target.mana.current < cost) {
      return {
        ok: false,
        note: `${target.name} no tiene maná suficiente (${target.mana.current}/${cost} necesarios).`,
      };
    }

    const nextMana = Math.max(0, target.mana.current - cost);
    const nextCond = deriveCondition(
      target.hp.current,
      nextMana,
      target.condition,
      false,
      target.mana.max,
      Boolean(target.ignoreManaUnconsciousness)
    );

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === charId
          ? {
              ...c,
              mana: { ...c.mana, current: nextMana },
              condition: nextCond,
            }
          : c
      )
    );

    if (target.mana.max > 0 && nextMana === 0) {
      if (target.ignoreManaUnconsciousness) {
        return {
          ok: true,
          note: `Maná descontado (-${cost} -> 0). Reino de Lostbell: ${target.name} sigue activo con 0 de maná.`,
        };
      }
      return {
        ok: true,
        note: `Maná descontado (-${cost} -> 0). ${target.name} llegó a 0 de maná y quedó Inconsciente.`,
      };
    }

    return {
      ok: true,
      note: `Maná descontado automáticamente: -${cost} (queda ${nextMana}/${target.mana.max}).`,
    };
  };

  const adjustHp = (charId: string, delta: number, lethal = false) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const nextHp = Math.max(0, Math.min(c.hp.max, c.hp.current + delta));
        const nextCond = deriveCondition(
          nextHp,
          c.mana.current,
          c.condition,
          lethal,
          c.mana.max,
          Boolean(c.ignoreManaUnconsciousness)
        );
        return {
          ...c,
          hp: { ...c.hp, current: nextHp },
          condition: nextCond,
        };
      })
    );
  };

  const adjustMana = (charId: string, delta: number) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const nextMana = Math.max(0, Math.min(c.mana.max, c.mana.current + delta));
        const nextCond = deriveCondition(
          c.hp.current,
          nextMana,
          c.condition,
          false,
          c.mana.max,
          Boolean(c.ignoreManaUnconsciousness)
        );
        return {
          ...c,
          mana: { ...c.mana, current: nextMana },
          condition: nextCond,
        };
      })
    );
  };

  const resetResources = (charId: string, resource: 'hp' | 'mana') => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const nextHp = resource === 'hp' ? c.hp.max : c.hp.current;
        const nextMana = resource === 'mana' ? c.mana.max : c.mana.current;
        const nextCond = deriveCondition(
          nextHp,
          nextMana,
          'active',
          false,
          c.mana.max,
          Boolean(c.ignoreManaUnconsciousness)
        );
        return {
          ...c,
          hp: { ...c.hp, current: nextHp },
          mana: { ...c.mana, current: nextMana },
          condition: nextCond,
        };
      })
    );
  };

  const handleUpdateCharacter = (updated: Character) => {
    const fixedCond = deriveCondition(
      updated.hp.current,
      updated.mana.current,
      updated.condition,
      false,
      updated.mana.max,
      Boolean(updated.ignoreManaUnconsciousness)
    );
    setCharacters((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...updated, condition: fixedCond } : c))
    );
  };

  const handleCreateCharacter = (options: CreateCharacterOptions) => {
    const newCharId = generateId('char_');

    if (options.kind === 'mage') {
      const sig = buildMageSignatureSpells({
        charId: newCharId,
        natureId: options.natureId,
        customNatureLabel: options.customNature,
        physicalVariant: options.physicalVariant,
        customPhysicalName: options.customPhysicalName,
      });

      const baseIds = STARTER_MAGE_SPELL_IDS.filter(
        (id) =>
          id !== 'basic_ataque_canalizado' &&
          (!sig.replaceBasicPhysicalId || id !== 'basic_golpe_fisico') &&
          spells.some((s) => s.id === id)
      );

      const knownSpells = [...new Set([...sig.createdSpells.map((s) => s.id), ...baseIds])];

      const startLvl = calcStatLevelFromPoints(0, formula);
      const created: Character = {
        id: newCharId,
        name: options.name || 'Mago',
        kind: 'mage',
        nature: sig.natureLabel,
        physicalVariant: options.physicalVariant,
        stats: { fisico: startLvl, manipulacion: startLvl, influencia: startLvl },
        statPoints: { fisico: 0, manipulacion: 0, influencia: 0 },
        hp: { current: 20, max: 20 },
        mana: { current: 15, max: 15 },
        knownSpells,
        spellMastery: {},
        weapons: [],
        condition: 'active',
        notes: `Naturaleza: ${sig.natureLabel}`,
        resistances: '',
        characterLevel: 1,
        progressionHistory: [],
      };

      setSpells((prev) => [...prev, ...sig.createdSpells]);
      setCharacters((prev) => [...prev, created]);
      setActiveCharacterId(created.id);
      return;
    }

    const npcStartLvl = calcStatLevelFromPoints(0, formula);
    const created: Character = {
      id: newCharId,
      name: options.name || 'PNJ',
      kind: 'npc',
      stats: { fisico: npcStartLvl, manipulacion: npcStartLvl, influencia: npcStartLvl },
      statPoints: { fisico: 0, manipulacion: 0, influencia: 0 },
      hp: { current: 15, max: 15 },
      mana: { current: 10, max: 10 },
      knownSpells: STARTER_NPC_SPELL_IDS.filter((id) => spells.some((s) => s.id === id)),
      spellMastery: {},
      weapons: [],
      condition: 'active',
      notes: '',
      resistances: '',
      characterLevel: 1,
      progressionHistory: [],
    };
    setCharacters((prev) => [...prev, created]);
    setActiveCharacterId(created.id);
  };

  const handleApplyNatureToCharacter = (
    charId: string,
    options: Omit<CreateCharacterOptions, 'name' | 'kind'> & {
      keepPreviousCanalizado?: boolean;
    }
  ) => {
    const target = characters.find((c) => c.id === charId);
    if (!target) return;

    const sig = buildMageSignatureSpells({
      charId,
      natureId: options.natureId,
      customNatureLabel: options.customNature,
      physicalVariant: options.physicalVariant,
      customPhysicalName: options.customPhysicalName,
    });

    const newCanalizado = sig.createdSpells.find(isSignatureCanalizadoSpell);
    const newPhysical = sig.createdSpells.find(isSignaturePhysicalSpell);

    const prevOwnedCanalizados = spells.filter(
      (s) => s.ownerCharacterId === charId && isSignatureCanalizadoSpell(s)
    );
    const prevOwnedPhysicals = spells.filter(
      (s) => s.ownerCharacterId === charId && isSignaturePhysicalSpell(s)
    );

    const removeIds = new Set<string>();
    const replacements = new Map<string, Spell>();
    const toAppend: Spell[] = [];
    const activeSignatureIds: string[] = [];

    if (newCanalizado) {
      const sameNameMatch = prevOwnedCanalizados.find(
        (s) => s.name.trim().toLowerCase() === newCanalizado.name.trim().toLowerCase()
      );
      if (options.keepPreviousCanalizado) {
        if (sameNameMatch) {
          replacements.set(sameNameMatch.id, { ...newCanalizado, id: sameNameMatch.id });
          activeSignatureIds.push(sameNameMatch.id);
          prevOwnedCanalizados.forEach((s) => {
            if (
              s.id !== sameNameMatch.id &&
              s.name.trim().toLowerCase() === newCanalizado.name.trim().toLowerCase()
            ) {
              removeIds.add(s.id);
            }
          });
        } else {
          toAppend.push(newCanalizado);
          activeSignatureIds.push(newCanalizado.id);
        }
      } else {
        const reusable =
          sameNameMatch ||
          prevOwnedCanalizados.find((s) => target.knownSpells.includes(s.id)) ||
          prevOwnedCanalizados[0];
        if (reusable) {
          replacements.set(reusable.id, { ...newCanalizado, id: reusable.id });
          activeSignatureIds.push(reusable.id);
          prevOwnedCanalizados.forEach((s) => {
            if (s.id !== reusable.id) removeIds.add(s.id);
          });
        } else {
          toAppend.push(newCanalizado);
          activeSignatureIds.push(newCanalizado.id);
        }
      }
    }

    if (newPhysical) {
      const reusablePhys =
        prevOwnedPhysicals.find((s) => target.knownSpells.includes(s.id)) ||
        prevOwnedPhysicals[0];
      if (reusablePhys) {
        replacements.set(reusablePhys.id, { ...newPhysical, id: reusablePhys.id });
        activeSignatureIds.push(reusablePhys.id);
        prevOwnedPhysicals.forEach((s) => {
          if (s.id !== reusablePhys.id) removeIds.add(s.id);
        });
      } else {
        toAppend.push(newPhysical);
        activeSignatureIds.push(newPhysical.id);
      }
    } else {
      // Volvió a Golpe Físico estándar: limpiar variantes físicas automáticas anteriores
      prevOwnedPhysicals.forEach((s) => removeIds.add(s.id));
    }

    setSpells((prev) => [
      ...prev
        .filter((s) => !removeIds.has(s.id))
        .map((s) => replacements.get(s.id) || s),
      ...toAppend,
    ]);

    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        let nextKnown = c.knownSpells.filter(
          (id) => id !== 'basic_ataque_canalizado' && !removeIds.has(id)
        );
        if (sig.replaceBasicPhysicalId) {
          nextKnown = nextKnown.filter((id) => id !== 'basic_golpe_fisico');
        } else if (
          prevOwnedPhysicals.length > 0 &&
          spells.some((s) => s.id === 'basic_golpe_fisico') &&
          !nextKnown.includes('basic_golpe_fisico')
        ) {
          nextKnown = [...nextKnown, 'basic_golpe_fisico'];
        }
        nextKnown = [...new Set([...activeSignatureIds, ...nextKnown])];
        const remapOrganizationIds = (ids: string[]) =>
          [...new Set(ids.map((spellId) => replacements.get(spellId)?.id || spellId))]
            .filter((spellId) => !removeIds.has(spellId));
        const remappedPersonalTags = Object.entries(c.personalSpellTags || {}).reduce<
          Record<string, string[]>
        >((nextTags, [spellId, tags]) => {
          const remappedId = replacements.get(spellId)?.id || spellId;
          if (!removeIds.has(remappedId)) {
            nextTags[remappedId] = [...new Set([...(nextTags[remappedId] || []), ...tags])];
          }
          return nextTags;
        }, {});
        return {
          ...c,
          nature: sig.natureLabel,
          physicalVariant: options.physicalVariant,
          knownSpells: nextKnown,
          archiveGoalIds: remapOrganizationIds(c.archiveGoalIds || []),
          favoriteSpellIds: remapOrganizationIds(c.favoriteSpellIds || []),
          personalSpellTags: remappedPersonalTags,
          spellOrder: remapOrganizationIds(c.spellOrder || []),
        };
      })
    );
  };

  const handleDuplicateCharacter = (id: string) => {
    const source = characters.find((c) => c.id === id);
    if (!source) return;
    const newCharId = generateId('char_');
    const idMap = new Map<string, string>();
    const clonedSpells: Spell[] = [];

    spells.forEach((sp) => {
      if (sp.ownerCharacterId === source.id) {
        const clonedId = generateId('sp_');
        idMap.set(sp.id, clonedId);
        const cloned = {
          ...JSON.parse(JSON.stringify(sp)),
          id: clonedId,
          ownerCharacterId: newCharId,
        } as Spell;
        if (cloned.dependency?.requiredSpellId && idMap.has(cloned.dependency.requiredSpellId)) {
          cloned.dependency = {
            ...cloned.dependency,
            requiredSpellId: idMap.get(cloned.dependency.requiredSpellId),
          };
        }
        clonedSpells.push(cloned);
      }
    });

    const copy: Character = {
      ...JSON.parse(JSON.stringify(source)),
      id: newCharId,
      name: `${source.name} (copia)`,
      knownSpells: source.knownSpells.map((spId) => idMap.get(spId) || spId),
      archiveGoalIds: (source.archiveGoalIds || []).map((goalId) => idMap.get(goalId) || goalId),
      favoriteSpellIds: (source.favoriteSpellIds || []).map((spellId) => idMap.get(spellId) || spellId),
      personalSpellTags: Object.fromEntries(
        Object.entries(source.personalSpellTags || {}).map(([spellId, tags]) => [
          idMap.get(spellId) || spellId,
          tags,
        ])
      ),
      spellOrder: (source.spellOrder || []).map((spellId) => idMap.get(spellId) || spellId),
    };

    if (clonedSpells.length > 0) {
      setSpells((prev) => [...prev, ...clonedSpells]);
    }
    setCharacters((prev) => [...prev, copy]);
    setActiveCharacterId(copy.id);
  };

  const handleDeleteCharacter = (id: string) => {
    if (characters.length <= 1) return;
    const remaining = characters.filter((c) => c.id !== id);
    const remainingKnown = new Set(remaining.flatMap((c) => c.knownSpells));
    const removedSpellIds = new Set(
      spells
        .filter((spell) => spell.ownerCharacterId === id && !remainingKnown.has(spell.id))
        .map((spell) => spell.id)
    );

    setCharacters(
      remaining.map((character) => ({
        ...character,
        archiveGoalIds: (character.archiveGoalIds || []).filter(
          (spellId) => !removedSpellIds.has(spellId)
        ),
        favoriteSpellIds: (character.favoriteSpellIds || []).filter(
          (spellId) => !removedSpellIds.has(spellId)
        ),
        personalSpellTags: Object.fromEntries(
          Object.entries(character.personalSpellTags || {}).filter(
            ([spellId]) => !removedSpellIds.has(spellId)
          )
        ),
        spellOrder: (character.spellOrder || []).filter(
          (spellId) => !removedSpellIds.has(spellId)
        ),
      }))
    );
    setSpells((prev) =>
      prev.filter((s) => s.ownerCharacterId !== id || remainingKnown.has(s.id))
    );
    setCombatants((prev) => prev.filter((cb) => cb.characterId !== id));
    if (activeCharacterId === id) {
      setActiveCharacterId(remaining[0].id);
    }
  };

  const handleAddToCombat = (charId: string, initiative = 0) => {
    if (combatants.some((c) => c.characterId === charId)) return;
    const newId = generateId('cb_');
    setCombatants((prev) => [
      ...prev,
      {
        id: newId,
        characterId: charId,
        initiative,
        preparedSpells: [],
        activeStatuses: [],
        attacksUsedThisTurn: 0,
        actedThisRound: false,
      },
    ]);
    if (combatants.length === 0) {
      setCurrentTurnCombatantId(newId);
      setActiveCharacterId(charId);
      setAutoPassPaused(false);
    }
  };

  const handleSaveSpell = (spell: Spell, learnForActive = true) => {
    setSpells((prev) => {
      const exists = prev.some((s) => s.id === spell.id);
      if (exists) return prev.map((s) => (s.id === spell.id ? spell : s));
      return [...prev, spell];
    });

    if (learnForActive && activeCharacter && !activeCharacter.knownSpells.includes(spell.id)) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === activeCharacter.id
            ? { ...c, knownSpells: [...c.knownSpells, spell.id] }
            : c
        )
      );
    }
    setEditingSpell(null);
    setShowEditor(false);
  };

  const handleDeleteSpell = (spellId: string) => {
    setSpells((prev) => prev.filter((s) => s.id !== spellId));
    setCharacters((prev) =>
      prev.map((c) => ({
        ...c,
        knownSpells: c.knownSpells.filter((id) => id !== spellId),
        archiveGoalIds: (c.archiveGoalIds || []).filter((id) => id !== spellId),
        favoriteSpellIds: (c.favoriteSpellIds || []).filter((id) => id !== spellId),
        personalSpellTags: Object.fromEntries(
          Object.entries(c.personalSpellTags || {}).filter(([id]) => id !== spellId)
        ),
        spellOrder: (c.spellOrder || []).filter((id) => id !== spellId),
      }))
    );
  };

  const handleRestoreBasics = () => {
    const basicMap = new Map(BUILTIN_SPELLS.map((b) => [b.id, b]));
    const nextSpells = [...BUILTIN_SPELLS, ...spells.filter((s) => !basicMap.has(s.id))];
    setSpells(nextSpells);
    if (activeCharacter) {
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== activeCharacter.id) return c;
          const hasNatureCanalizado = characterHasNatureCanalizado(c, nextSpells);
          const hasNaturePhysical =
            c.physicalVariant &&
            c.physicalVariant !== 'golpe_fisico' &&
            nextSpells.some(
              (s) =>
                isSignaturePhysicalSpell(s) &&
                (s.ownerCharacterId === c.id || c.knownSpells.includes(s.id))
            );
          const basicsToAdd =
            c.kind === 'mage'
              ? getMageStarterBasicIds(c, nextSpells)
              : BASIC_SPELL_IDS.filter(
                  (id) =>
                    !UNLEARNED_BASIC_SPELL_IDS.includes(id) &&
                    !(id === 'basic_ataque_canalizado' && hasNatureCanalizado) &&
                    !(id === 'basic_golpe_fisico' && hasNaturePhysical)
                );
          const merged = [
            ...new Set([
              ...c.knownSpells.filter(
                (id) =>
                  !(id === 'basic_ataque_canalizado' && hasNatureCanalizado) &&
                  !(id === 'basic_golpe_fisico' && hasNaturePhysical)
              ),
              ...basicsToAdd,
            ]),
          ];
          return { ...c, knownSpells: merged };
        })
      );
    }
  };

  const handleToggleArchiveKeyLock = (spellId: string, unlock?: boolean) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== activeCharacter.id) return c;
        const current = Array.isArray(c.unlockedArchiveSpellIds)
          ? c.unlockedArchiveSpellIds
          : [];
        const isUnlocked = current.includes(spellId);
        const shouldUnlock = typeof unlock === 'boolean' ? unlock : !isUnlocked;
        return {
          ...c,
          unlockedArchiveSpellIds: shouldUnlock
            ? [...new Set([...current, spellId])]
            : current.filter((id) => id !== spellId),
        };
      })
    );
  };

  const handleToggleArchiveGoal = (spellId: string) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((character) => {
        if (character.id !== activeCharacter.id) return character;
        const current = Array.isArray(character.archiveGoalIds)
          ? character.archiveGoalIds
          : [];
        const next = current.includes(spellId)
          ? current.filter((id) => id !== spellId)
          : [...new Set([...current, spellId])];
        return { ...character, archiveGoalIds: next };
      })
    );
  };

  const handleToggleFavoriteSpell = (spellId: string) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((character) => {
        if (character.id !== activeCharacter.id) return character;
        const current = character.favoriteSpellIds || [];
        return {
          ...character,
          favoriteSpellIds: current.includes(spellId)
            ? current.filter((id) => id !== spellId)
            : [...current, spellId],
        };
      })
    );
  };

  const handleSetArchiveKeyLocksBulk = (spellIds: string[], unlock: boolean) => {
    if (!activeCharacter) return;
    const idSet = new Set(spellIds);
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== activeCharacter.id) return c;
        const current = Array.isArray(c.unlockedArchiveSpellIds)
          ? c.unlockedArchiveSpellIds
          : [];
        return {
          ...c,
          unlockedArchiveSpellIds: unlock
            ? [...new Set([...current, ...spellIds])]
            : current.filter((id) => !idSet.has(id)),
        };
      })
    );
  };

  const handleToggleUnlockedNature = (natureId: string, unlock?: boolean) => {
    if (!activeCharacter || !natureId) return;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== activeCharacter.id) return c;
        const current = Array.isArray(c.unlockedNatures) ? c.unlockedNatures : [];
        const has = current.includes(natureId);
        const shouldUnlock = typeof unlock === 'boolean' ? unlock : !has;
        return {
          ...c,
          unlockedNatures: shouldUnlock
            ? [...new Set([...current, natureId])]
            : current.filter((id) => id !== natureId),
        };
      })
    );
  };

  const handleSetDisciplineMastery = (disciplineId: string, level: number) => {
    if (!activeCharacter || !KNOWLEDGE_DISCIPLINES.some((item) => item.id === disciplineId)) return;
    const safeLevel = Number.isFinite(level)
      ? Math.max(0, Math.min(3, Math.floor(level)))
      : 0;
    setCharacters((prev) =>
      prev.map((character) =>
        character.id === activeCharacter.id
          ? {
              ...character,
              knowledgeMastery: {
                ...(character.knowledgeMastery || {}),
                [disciplineId]: safeLevel,
              },
            }
          : character
      )
    );
  };

  const handleToggleDisciplineDiscovery = (disciplineId: string, unlock: boolean) => {
    if (
      !activeCharacter ||
      !KNOWLEDGE_DISCIPLINES.some((item) => item.id === disciplineId) ||
      knowledgeTreeSettings.disabledDisciplineIds.includes(disciplineId)
    ) {
      return;
    }
    setCharacters((prev) =>
      prev.map((character) => {
        if (character.id !== activeCharacter.id) return character;
        const discovered = character.discoveredKnowledgeDisciplines || [];
        return {
          ...character,
          discoveredKnowledgeDisciplines: unlock
            ? [...new Set([...discovered, disciplineId])]
            : discovered.filter((id) => id !== disciplineId),
        };
      })
    );
  };

  const handleUpdateKnowledgeTreeSettings = (settings: KnowledgeTreeSettings) => {
    setKnowledgeTreeSettings(normalizeKnowledgeTreeSettings(settings));
  };

  const handleLearnKnowledgeSpell = (spellId: string): string | null => {
    if (!activeCharacter) return 'Seleccioná un personaje antes de aprender un hechizo.';
    const metadata = KNOWLEDGE_SPELL_METADATA.find((item) => item.spellId === spellId);
    if (!metadata) return `No se encontró la técnica de conocimiento ${spellId}.`;
    const access = getKnowledgeSpellAccess(metadata, activeCharacter, knowledgeTreeSettings);
    if (!access.accessible) return access.reason;
    const spell = spells.find((item) => item.id === spellId);
    if (!spell) return `No se encontró el hechizo ${spellId} en el catálogo.`;
    if (activeCharacter.knownSpells.includes(spellId)) {
      return `${spell.name} ya forma parte del grimorio de ${activeCharacter.name}.`;
    }

    setCharacters((prev) =>
      prev.map((character) =>
        character.id === activeCharacter.id
          ? { ...character, knownSpells: [...new Set([...character.knownSpells, spellId])] }
          : character
      )
    );
    return `${spell.name} añadido al grimorio de ${activeCharacter.name}.`;
  };

  const handleLearnBasicFromArchive = (spellId: string, prereqSpellId?: string): string | null => {
    if (!activeCharacter) return null;
    const unlockedKeys = new Set(activeCharacter.unlockedArchiveSpellIds || []);
    if (ALL_ARCHIVE_LOCKED_IDS.includes(spellId) && !unlockedKeys.has(spellId)) {
      return 'Este hechizo está bajo llave. El DJ debe abrir la llave en Archivo Arcano.';
    }
    if (
      prereqSpellId &&
      ALL_ARCHIVE_LOCKED_IDS.includes(prereqSpellId) &&
      !unlockedKeys.has(prereqSpellId)
    ) {
      return 'El requisito también está bajo llave. El DJ debe abrir ambas llaves.';
    }

    const idsToAdd: string[] = [];
    const namesAdded: string[] = [];

    if (prereqSpellId && !activeCharacter.knownSpells.includes(prereqSpellId)) {
      idsToAdd.push(prereqSpellId);
      const prereqSp = spells.find((s) => s.id === prereqSpellId);
      if (prereqSp) namesAdded.push(prereqSp.name);
    }
    if (!activeCharacter.knownSpells.includes(spellId)) {
      idsToAdd.push(spellId);
      const mainSp = spells.find((s) => s.id === spellId);
      if (mainSp) namesAdded.push(mainSp.name);
    }

    if (idsToAdd.length === 0) return null;

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id
          ? { ...c, knownSpells: [...new Set([...c.knownSpells, ...idsToAdd])] }
          : c
      )
    );

    return `${namesAdded.join(' y ')} añadido${namesAdded.length > 1 ? 's' : ''} al grimorio de ${activeCharacter.name}.`;
  };

  const handleLearnAdaptedCatalogSpell = (
    template: Spell,
    overrideNatureId?: string,
    includePrerequisite = false
  ): string | null => {
    if (!activeCharacter) return null;

    const unlockedKeys = new Set(activeCharacter.unlockedArchiveSpellIds || []);
    if (ALL_ARCHIVE_LOCKED_IDS.includes(template.id) && !unlockedKeys.has(template.id)) {
      return 'Este hechizo está bajo llave. El DJ debe abrir la llave antes de aprenderlo.';
    }

    const resolved = resolveNaturePresetForCharacter(activeCharacter, overrideNatureId);
    const ownedNatureIds = getCharacterOwnedNatureIds(activeCharacter);
    if (!ownedNatureIds.includes(resolved.preset.id)) {
      return `${activeCharacter.name} aún no desbloqueó la afinidad ${resolved.elementName}.`;
    }

    const mainCompatibility = evaluateCatalogSpellCompatibility(
      template,
      resolved.preset.id,
      resolved.elementName
    );
    if (!mainCompatibility.compatible) {
      return mainCompatibility.reason || `No viable con ${resolved.elementName}.`;
    }

    const currentLearnedSpells = spells.filter((s) => activeCharacter.knownSpells.includes(s.id));
    const createdSpells: Spell[] = [];

    if (includePrerequisite) {
      const prereqTemplateId = getCatalogPrerequisiteTemplateId(template);
      const prereqTemplate = prereqTemplateId
        ? ADAPTABLE_CATALOG_SPELLS.find((s) => s.id === prereqTemplateId)
        : undefined;
      const alreadyHasPrereq = prereqTemplate
        ? currentLearnedSpells.some((s) => s.catalogTemplateId === prereqTemplate.id)
        : true;

      if (prereqTemplate && !alreadyHasPrereq) {
        const prereqUnlocked =
          !ALL_ARCHIVE_LOCKED_IDS.includes(prereqTemplate.id) ||
          unlockedKeys.has(prereqTemplate.id);
        const prereqCompat = evaluateCatalogSpellCompatibility(
          prereqTemplate,
          resolved.preset.id,
          resolved.elementName
        );
        if (prereqUnlocked && prereqCompat.compatible) {
          const adaptedPrereq = adaptCatalogSpellForCharacter(prereqTemplate, activeCharacter, {
            overrideNatureId,
            materialize: true,
            existingLearnedSpells: currentLearnedSpells,
          });
          createdSpells.push(adaptedPrereq);
        }
      }
    }

    const adaptedMain = adaptCatalogSpellForCharacter(template, activeCharacter, {
      overrideNatureId,
      materialize: true,
      existingLearnedSpells: [...currentLearnedSpells, ...createdSpells],
    });
    createdSpells.push(adaptedMain);

    const newIds = createdSpells.map((s) => s.id);
    setSpells((prev) => [...prev, ...createdSpells]);
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id
          ? { ...c, knownSpells: [...new Set([...c.knownSpells, ...newIds])] }
          : c
      )
    );

    const names = createdSpells.map((s) => s.name).join(' y ');
    return `${names} adaptado${createdSpells.length > 1 ? 's' : ''} y aprendido${createdSpells.length > 1 ? 's' : ''} por ${activeCharacter.name}.`;
  };

  const handleCustomizeCatalogSpell = (template: Spell, overrideNatureId?: string) => {
    const currentLearnedSpells = activeCharacter
      ? spells.filter((s) => activeCharacter.knownSpells.includes(s.id))
      : [];
    const adaptedDraft = adaptCatalogSpellForCharacter(template, activeCharacter, {
      overrideNatureId,
      materialize: true,
      existingLearnedSpells: currentLearnedSpells,
    });
    setEditingSpell(adaptedDraft);
    setShowEditor(true);
    setActiveTab('arena');
  };

  const handleToggleKnownForCharacter = (charId: string, spellId: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const has = c.knownSpells.includes(spellId);
        return {
          ...c,
          knownSpells: has
            ? c.knownSpells.filter((id) => id !== spellId)
            : [...c.knownSpells, spellId],
        };
      })
    );
  };

  const handleSetKnownSpells = (charId: string, spellIds: string[]) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === charId ? { ...c, knownSpells: [...new Set(spellIds)] } : c))
    );
  };

  const handleToggleKnown = (spellId: string) => {
    if (!activeCharacter) return;
    handleToggleKnownForCharacter(activeCharacter.id, spellId);
  };

  const getEffectiveSpellAssured = (char: Character | undefined, spell: Spell): number => {
    if (!spellSupportsMastery(spell)) {
      return spell.assuredSuccess || 0;
    }
    const mastery = getSpellMasteryStatus(char?.spellMastery?.[spell.id] || 0, formula);
    return (spell.assuredSuccess || 0) + mastery.bonusAssured;
  };

  const recordSpellMastery = (
    charId: string,
    spell: Spell,
    rolls: number[]
  ): string | undefined => {
    if (!spellSupportsMastery(spell)) return undefined;
    const gained = countRawD6Successes(rolls);
    if (gained <= 0) return undefined;
    const char = characters.find((c) => c.id === charId);
    const prevSuccesses = char?.spellMastery?.[spell.id] || 0;
    const nextSuccesses = prevSuccesses + gained;
    const prevStatus = getSpellMasteryStatus(prevSuccesses, formula);
    const nextStatus = getSpellMasteryStatus(nextSuccesses, formula);

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === charId
          ? {
              ...c,
              spellMastery: {
                ...(c.spellMastery || {}),
                [spell.id]: nextSuccesses,
              },
            }
          : c
      )
    );

    const dieUpgradeHint =
      nextStatus.dieUpgradeSteps > prevStatus.dieUpgradeSteps && spell.effectType === 'damage'
        ? ` ¡El dado de daño sube de categoría (+${nextStatus.dieUpgradeSteps})!`
        : '';

    if (nextStatus.level > prevStatus.level) {
      return `Maestría de ${spell.name}: +${gained} éxito(s) sin negativos (${nextSuccesses}) — ¡Subió a Nivel ${nextStatus.level}!${dieUpgradeHint}`;
    }
    return `Maestría de ${spell.name}: +${gained} éxito(s) (${
      nextStatus.isMaxLevel
        ? `${nextSuccesses} · Máx`
        : `${nextSuccesses}/${nextStatus.nextThreshold} · Nv. ${nextStatus.level}`
    })`;
  };

  const handleAdjustSpellMastery = (spellId: string, delta: number) => {
    if (!activeCharacter) return;
    const targetSpell = spells.find((s) => s.id === spellId);
    if (targetSpell && !spellSupportsMastery(targetSpell)) return;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== activeCharacter.id) return c;
        const current = c.spellMastery?.[spellId] || 0;
        const next = Math.max(0, current + delta);
        return {
          ...c,
          spellMastery: {
            ...(c.spellMastery || {}),
            [spellId]: next,
          },
        };
      })
    );
    if (
      lastMasteryReset &&
      lastMasteryReset.characterId === activeCharacter.id &&
      lastMasteryReset.spellId === spellId
    ) {
      setLastMasteryReset(null);
    }
  };

  const handleResetSpellMastery = (spellId: string) => {
    if (!activeCharacter) return;
    const targetSpell = spells.find((s) => s.id === spellId);
    if (targetSpell && !spellSupportsMastery(targetSpell)) return;
    const prevSuccesses = activeCharacter.spellMastery?.[spellId] || 0;
    if (prevSuccesses <= 0) return;

    const prevStatus = getSpellMasteryStatus(prevSuccesses, formula);
    const spellName = targetSpell?.name || 'Hechizo';

    setLastMasteryReset({
      characterId: activeCharacter.id,
      characterName: activeCharacter.name,
      spellId,
      spellName,
      previousSuccesses: prevSuccesses,
      previousLevel: prevStatus.level,
    });

    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== activeCharacter.id) return c;
        return {
          ...c,
          spellMastery: {
            ...(c.spellMastery || {}),
            [spellId]: 0,
          },
        };
      })
    );

    pushLog({
      kind: 'event',
      title: `Maestría reiniciada — ${spellName}`,
      actorName: activeCharacter.name,
      summaryText: `${activeCharacter.name} reinició la maestría de «${spellName}» a 0 éxitos (antes: Nv. ${prevStatus.level} · ${prevSuccesses} éxitos). Podés revertir este cambio desde el Grimorio.`,
    });
  };

  const handleRevertSpellMastery = () => {
    if (!lastMasteryReset) return;
    const { characterId, characterName, spellId, spellName, previousSuccesses, previousLevel } =
      lastMasteryReset;

    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== characterId) return c;
        return {
          ...c,
          spellMastery: {
            ...(c.spellMastery || {}),
            [spellId]: previousSuccesses,
          },
        };
      })
    );

    pushLog({
      kind: 'event',
      title: `Maestría revertida — ${spellName}`,
      actorName: characterName,
      summaryText: `Se restauró la maestría de «${spellName}» para ${characterName} a Nv. ${previousLevel} (${previousSuccesses} éxitos).`,
    });

    setLastMasteryReset(null);
  };

  const handleReorderSpells = (newOrder: string[]) => {
    if (activeCharacter) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === activeCharacter.id ? { ...c, spellOrder: newOrder } : c
        )
      );
    } else {
      setGlobalSpellOrder(newOrder);
    }
  };

  const handleResetSpellOrder = () => {
    if (activeCharacter) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === activeCharacter.id
            ? { ...c, spellOrder: [], spellSortMode: 'custom' }
            : c
        )
      );
    } else {
      setGlobalSpellOrder([]);
    }
  };

  const handleMoveBoxToSlot = (
    boxId: ArenaBoxId,
    targetColumn: 'left' | 'right',
    targetIndex: number
  ) => {
    setArenaLayout((prev) => {
      const sourceCol: 'left' | 'right' = prev.left.includes(boxId) ? 'left' : 'right';
      const sourceIdx = prev[sourceCol].indexOf(boxId);
      const nextLeft = prev.left.filter((id) => id !== boxId);
      const nextRight = prev.right.filter((id) => id !== boxId);
      const targetArr = targetColumn === 'left' ? nextLeft : nextRight;

      let adjustedIndex = targetIndex;
      if (sourceCol === targetColumn && sourceIdx !== -1 && sourceIdx < targetIndex) {
        adjustedIndex -= 1;
      }
      const clampedIndex = Math.max(0, Math.min(targetArr.length, adjustedIndex));
      targetArr.splice(clampedIndex, 0, boxId);

      return { left: nextLeft, right: nextRight };
    });
    setDraggedBoxId(null);
    setDropSlot(null);
  };

  const handleStepBox = (boxId: ArenaBoxId, delta: -1 | 1) => {
    setArenaLayout((prev) => {
      const col: 'left' | 'right' = prev.left.includes(boxId) ? 'left' : 'right';
      const arr = [...prev[col]];
      const idx = arr.indexOf(boxId);
      const nextIdx = idx + delta;
      if (idx === -1 || nextIdx < 0 || nextIdx >= arr.length) return prev;
      [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
      return col === 'left' ? { ...prev, left: arr } : { ...prev, right: arr };
    });
  };

  const handleSwapBoxColumn = (boxId: ArenaBoxId) => {
    setArenaLayout((prev) => {
      const inLeft = prev.left.includes(boxId);
      if (inLeft) {
        return {
          left: prev.left.filter((id) => id !== boxId),
          right: [...prev.right, boxId],
        };
      }
      return {
        left: [...prev.left, boxId],
        right: prev.right.filter((id) => id !== boxId),
      };
    });
  };

  const handleResetArenaLayout = () => {
    setArenaLayout({
      left: [...DEFAULT_ARENA_LAYOUT.left],
      right: [...DEFAULT_ARENA_LAYOUT.right],
    });
  };

  const handleAddWeapon = (presetId: string) => {
    if (!activeCharacter) return;
    const wpn = createWeaponFromPreset(presetId);
    if (!wpn) return;
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id ? { ...c, weapons: [...(c.weapons || []), wpn] } : c
      )
    );
  };

  const handleRemoveWeapon = (weaponId: string) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id
          ? { ...c, weapons: (c.weapons || []).filter((w) => w.id !== weaponId) }
          : c
      )
    );
  };

  const handleRestoreWeapon = (weaponId: string) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id
          ? {
              ...c,
              weapons: (c.weapons || []).map((w) =>
                w.id === weaponId
                  ? { ...w, destroyed: false, destroyedReason: undefined, imbued: null }
                  : w
              ),
            }
          : c
      )
    );
  };

  const handleImbueWeapon = (
    weaponId: string,
    element: string,
    manaCost: number,
    disintegratesAfterAttack: boolean
  ) => {
    if (!activeCharacter) return;
    if (activeCharacter.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${activeCharacter.name} no puede imbuir armas`,
        summaryText: `Estado actual: ${conditionLabel(activeCharacter.condition)}.`,
      });
      return;
    }
    const weapon = (activeCharacter.weapons || []).find((w) => w.id === weaponId);
    if (!weapon || weapon.destroyed) return;

    const manaRes = applyManaCost(activeCharacter.id, manaCost);
    if (!manaRes.ok) {
      pushLog({
        kind: 'event',
        title: `Sin maná para imbuir ${weapon.name}`,
        summaryText: manaRes.note,
      });
      return;
    }

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id
          ? {
              ...c,
              weapons: (c.weapons || []).map((w) =>
                w.id === weaponId
                  ? {
                      ...w,
                      imbued: {
                        element,
                        manaSpent: manaCost,
                        disintegratesAfterAttack,
                        roundImbued: round,
                      },
                    }
                  : w
              ),
            }
          : c
      )
    );

    pushLog({
      kind: 'cast',
      title: `${activeCharacter.name} imbuye ${weapon.name} con ${element}`,
      actorName: activeCharacter.name,
      isMagical: true,
      manaNote: manaRes.note || undefined,
      summaryText: `${weapon.name} pasa a hacer daño mágico (${element}) para 1 ataque${
        disintegratesAfterAttack ? ' y luego se desintegrará' : ''
      }.`,
    });
  };

  const handleClearImbuement = (weaponId: string) => {
    if (!activeCharacter) return;
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === activeCharacter.id
          ? {
              ...c,
              weapons: (c.weapons || []).map((w) =>
                w.id === weaponId ? { ...w, imbued: null } : w
              ),
            }
          : c
      )
    );
  };

  const handleExpandShield = (weapon: CharacterWeapon, manaToSpend: number) => {
    if (!activeCharacter) return;
    if (activeCharacter.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${activeCharacter.name} no puede expandir el escudo`,
        summaryText: `Estado actual: ${conditionLabel(activeCharacter.condition)}.`,
      });
      return;
    }
    const shieldCb = combatants.find((c) => c.characterId === activeCharacter.id);
    const shieldEffects = getCombatantStatusEffects(shieldCb, activeCharacter);
    if (shieldEffects.disarmed) {
      pushLog({
        kind: 'event',
        title: `Escudo soltado — ${activeCharacter.name}`,
        summaryText:
          'Estás Desarmado: no podés usar ni expandir tu escudo hasta gastar 1 acción en tu turno para recuperarlo.',
      });
      return;
    }
    if (shieldEffects.cannotAct || shieldEffects.cannotCastMagic) {
      pushLog({
        kind: 'event',
        title: `${activeCharacter.name} no puede expandir el escudo`,
        summaryText: `Bloqueado por estado activo (${[
          ...shieldEffects.cannotActReasons,
          ...shieldEffects.cannotCastMagicReasons,
        ].join(', ')}).`,
      });
      return;
    }
    const safeSpend = Math.max(1, manaToSpend);
    const manaRes = applyManaCost(activeCharacter.id, safeSpend);
    if (!manaRes.ok) {
      pushLog({
        kind: 'event',
        title: `Sin maná para expandir ${weapon.name}`,
        summaryText: manaRes.note,
      });
      return;
    }

    pushLog({
      kind: 'defense',
      title: `${activeCharacter.name} expande ${weapon.name} (${safeSpend} maná)`,
      actorName: activeCharacter.name,
      isMagical: true,
      manaNote: manaRes.note || undefined,
      summaryText: `La rodela mágica se expande consumiendo ${safeSpend} de maná (reduce en 1 el costo de hechizos de protección/defensa).`,
    });
  };

  const handleAttackWithWeapon = (
    weapon: CharacterWeapon,
    attackStat: StatKey,
    attackerCharacterId?: string,
    explicitTargetCombatantId?: string
  ) => {
    const attacker = attackerCharacterId
      ? characters.find((c) => c.id === attackerCharacterId)
      : activeCharacter;
    if (!attacker) return;
    if (attacker.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${attacker.name} no puede atacar`,
        summaryText: `Estado actual: ${conditionLabel(attacker.condition)}.`,
      });
      return;
    }
    if (weapon.destroyed) return;

    const attackerCombatant = combatants.find((c) => c.characterId === attacker.id);
    const attackerEffects = getCombatantStatusEffects(attackerCombatant, attacker);
    if (attackerEffects.cannotAttack) {
      pushLog({
        kind: 'event',
        title: `${attacker.name} no puede atacar`,
        summaryText: `Impedido por estado activo: ${attackerEffects.cannotAttackReasons.join(', ')}.`,
      });
      return;
    }
    if (attackerEffects.disarmed && !weapon.isNatural) {
      pushLog({
        kind: 'event',
        title: `${attacker.name} está Desarmado`,
        summaryText: `Soltaste ${weapon.name} y no podés usarlo hasta gastar 1 acción en tu turno para recuperarlo (armas naturales siguen disponibles).`,
      });
      return;
    }

    const turnActionBefore = attackerCombatant
      ? getCombatantTurnActionStatus(attackerCombatant)
      : null;
    if (turnActionBefore && turnActionBefore.remaining <= 0) {
      pushLog({
        kind: 'event',
        title: `Sin acciones restantes — ${attacker.name}`,
        summaryText: turnActionBefore.hasElevarLimite
          ? `Ya usaste las ${turnActionBefore.max}/${turnActionBefore.max} acciones de este turno. Pasá el turno para volver a actuar.`
          : turnActionBefore.hasHechizoVeloz
            ? `Ya usaste las ${turnActionBefore.max}/${turnActionBefore.max} acciones de Hechizo Veloz. Activá Elevar el Límite (-5 maná) o pasá el turno.`
            : `Ya usaste tu acción de este turno (${turnActionBefore.used}/${turnActionBefore.max}). Activá Hechizo Veloz (-3 maná) o pasá el turno.`,
      });
      return;
    }

    const dmgInfo = getWeaponDamageFormula(weapon, attacker);
    const wasImbued = weapon.imbued;
    const attackRoll = rollCombinedStats(
      attacker,
      [attackStat],
      formula,
      0,
      attackerEffects.autoFailsAttack,
      attackerEffects.autoFailsAttackNotes
    );

    const syntheticWeaponSpell: Spell = {
      id: `wpn_atk_${weapon.id}`,
      name: wasImbued ? `${weapon.name} [Imbuida: ${wasImbued.element}]` : weapon.name,
      manaCost: 0,
      orders: wasImbued ? ['Imbuir', wasImbued.element] : [],
      statuses: [],
      castStat: 'none',
      manualCastDice: 0,
      assuredSuccess: 0,
      combatStats: [attackStat],
      damageMode: 'auto',
      effectType: 'damage',
      damageKind: dmgInfo.damageKind,
      damage: {
        dice: dmgInfo.dice.map((d) => ({ ...d })),
        bonus: dmgInfo.bonus,
        notes: wasImbued
          ? `arma imbuida con ${wasImbued.element} (daño mágico)`
          : weapon.isMagicalCatalyst
            ? 'catalizador mágico'
            : 'arma física',
      },
      effectDescription: wasImbued
        ? `Ataque único con ${weapon.name} imbuida en ${wasImbued.element}.`
        : `Ataque físico con ${weapon.name}.`,
      duration: 'Instantáneo',
      isBasic: false,
    };

    // Si estaba imbuida, se consume tras 1 ataque y (si corresponde) se desintegra sin importar si acierta
    let disintegrationNote = '';
    if (wasImbued) {
      const willBreak = wasImbued.disintegratesAfterAttack;
      const reason = `se desintegró tras atacar con ${wasImbued.element}`;
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === attacker.id
            ? {
                ...c,
                weapons: (c.weapons || []).map((w) =>
                  w.id === weapon.id
                    ? {
                        ...w,
                        imbued: null,
                        destroyed: willBreak ? true : w.destroyed,
                        destroyedReason: willBreak ? reason : w.destroyedReason,
                      }
                    : w
                ),
              }
            : c
        )
      );
      disintegrationNote = willBreak
        ? ` ${weapon.name} se desintegró tras el ataque imbuido (${wasImbued.element}).`
        : ` La imbuición (${wasImbued.element}) de ${weapon.name} se consumió.`;
    }

    if (attackerCombatant) {
      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === attackerCombatant.id
            ? { ...cb, attacksUsedThisTurn: (cb.attacksUsedThisTurn || 0) + 1 }
            : cb
        )
      );
    }
    const noActionWarning = '';

    const desiredTargetId = explicitTargetCombatantId || selectedTargetId;
    const targetCb =
      combatants.find(
        (cb) => cb.id === desiredTargetId && cb.characterId !== attacker.id
      ) || combatants.find((cb) => cb.characterId !== attacker.id);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;

    if (attackerCombatant && combatants.length > 1) {
      setPendingAttack({
        id: generateId('atk_'),
        attackerCombatantId: attackerCombatant.id,
        attackerCharacterId: attacker.id,
        attackerName: attacker.name,
        spell: syntheticWeaponSpell,
        isLethal: isAttackLethal,
        targetCombatantId: targetCb?.id,
        attackRoll,
        resolved: false,
      });
    }

    const formattedNet = attackRoll.net > 0 ? `+${attackRoll.net}` : `${attackRoll.net}`;
    pushLog({
      kind: 'attack',
      title: `${attacker.name} ataca${targetChar ? ` a ${targetChar.name}` : ''} con ${
        syntheticWeaponSpell.name
      } (${isAttackLethal ? 'Letal' : 'No letal'})`,
      actorName: attacker.name,
      isMagical: dmgInfo.damageKind === 'magico',
      attackRoll,
      clash: {
        attackerName: attacker.name,
        attackerAction: syntheticWeaponSpell.name,
        defenderName: targetChar?.name,
        outcome: 'pending_defense',
        damageKind: dmgInfo.damageKind,
        isLethal: isAttackLethal,
      },
      summaryText: `${
        targetChar
          ? `Ataque (${dmgInfo.damageKind === 'magico' ? 'Mágico' : 'Físico'}) con neto ${formattedNet}. Pasa a defensa de ${targetChar.name}.`
          : `Ataque (${dmgInfo.damageKind === 'magico' ? 'Mágico' : 'Físico'}) con neto ${formattedNet}.`
      }${disintegrationNote}${noActionWarning}`,
    });
  };

  const consumeSpellDependency = (match: SpellDependencyMatch): string => {
    setCombatants((prev) =>
      prev.map((cb) => {
        if (cb.id !== match.combatantId) return cb;
        if (match.sourceType === 'status') {
          return {
            ...cb,
            activeStatuses: (cb.activeStatuses || []).filter((st) => st.id !== match.itemId),
          };
        }
        return {
          ...cb,
          preparedSpells: (cb.preparedSpells || []).filter((p) => p.id !== match.itemId),
        };
      })
    );
    return ` Requisito consumido: «${match.itemName}» (${match.characterName}).`;
  };

  const checkSpellDependencyGate = (
    spell: Spell,
    caster: Character,
    isTest: boolean,
    explicitTargetCombatantId?: string
  ) => {
    const dep = evaluateSpellDependency({
      spell,
      casterCharacterId: caster.id,
      combatants,
      characters,
      targetCombatantId: explicitTargetCombatantId || selectedTargetId,
    });
    if (!isTest && dep.hasDependency && !dep.met) {
      pushLog({
        kind: 'event',
        title: `🔒 ${spell.name} bloqueado — ${caster.name}`,
        summaryText: `${
          dep.missingReason || `Requiere: ${dep.requiredName}`
        } (no se descontó maná ni acción).`,
      });
      return { ok: false as const, dep };
    }
    return { ok: true as const, dep };
  };

  // Casteo: siempre funciona (es solo declararlo para denotar que se gasta 1 acción importante y maná)
  const handleCastSpell = (spell: Spell, isTest = false, casterCharacterId?: string) => {
    const caster = casterCharacterId
      ? characters.find((c) => c.id === casterCharacterId)
      : activeCharacter;
    if (!caster) return;
    if (
      spell.effectType === 'effect' &&
      getEffectiveEffectSubType(spell) === 'debuff' &&
      (spell.dispelConfig?.enabled ||
        Boolean(spell.elementalStatus) ||
        (spell.synergyReaction && spell.synergyReaction !== 'none'))
    ) {
      triggerStatusCheck(spell, caster, isTest, false);
      return;
    }
    if (!isTest && caster.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${caster.name} no puede actuar`,
        summaryText: `Estado actual: ${conditionLabel(caster.condition)}.`,
      });
      return;
    }

    const depGate = checkSpellDependencyGate(spell, caster, isTest);
    if (!depGate.ok) return;

    const combatantBeforeCast = combatants.find((c) => c.characterId === caster.id);
    const casterEffects = !isTest
      ? getCombatantStatusEffects(combatantBeforeCast, caster)
      : null;
    if (!isTest && casterEffects) {
      if (casterEffects.cannotAct) {
        pushLog({
          kind: 'event',
          title: `${caster.name} no puede actuar`,
          summaryText: `Bloqueado por estado activo: ${casterEffects.cannotActReasons.join(', ')} (no se descontó maná).`,
        });
        return;
      }
      if (casterEffects.cannotCastMagic && isSpellMagical(spell)) {
        pushLog({
          kind: 'event',
          title: `${caster.name} está Silenciado`,
          summaryText: `No puede lanzar hechizos mágicos mientras dure ${casterEffects.cannotCastMagicReasons.join(', ')} (no se descontó maná).`,
        });
        return;
      }
      if (
        spell.effectType === 'damage' &&
        casterEffects.cannotAttack
      ) {
        pushLog({
          kind: 'event',
          title: `${caster.name} no puede preparar ataques`,
          summaryText: `Impedido por estado activo: ${casterEffects.cannotAttackReasons.join(', ')} (no se descontó maná).`,
        });
        return;
      }
    }
    const consumesTurnAction =
      !isTest && Boolean(combatantBeforeCast) && spellConsumesTurnAction(spell);
    if (!isTest) {
      const turnStatus = getCombatantTurnActionStatus(combatantBeforeCast);
      if (
        turnStatus.isSlowed &&
        (spell.id === 'basic_hechizo_veloz' || spell.id === 'basic_elevar_limite')
      ) {
        pushLog({
          kind: 'event',
          title: `${spell.name} bloqueado por Ralentizar`,
          summaryText:
            'Mientras estás Ralentizado tenés máximo 1 acción por turno (no se descontó maná).',
        });
        return;
      }
      if (spell.id === 'basic_elevar_limite') {
        if (!turnStatus.hasHechizoVeloz) {
          pushLog({
            kind: 'event',
            title: `Elevar el Límite bloqueado — ${caster.name}`,
            summaryText:
              'Requiere tener Hechizo Veloz activo en este turno antes de poder activar Elevar el Límite (no se descontó maná).',
          });
          return;
        }
        if (turnStatus.hasElevarLimite) {
          pushLog({
            kind: 'event',
            title: `Elevar el Límite ya activo — ${caster.name}`,
            summaryText:
              'Elevar el Límite ya está activo en este turno (3 acciones disponibles). No se descontó maná.',
          });
          return;
        }
      }
      if (spell.id === 'basic_hechizo_veloz' && turnStatus.hasHechizoVeloz) {
        pushLog({
          kind: 'event',
          title: `Hechizo Veloz ya activo — ${caster.name}`,
          summaryText:
            'Hechizo Veloz ya está activo en este turno. Para una tercera acción usá Elevar el Límite (no se descontó maná).',
        });
        return;
      }
      if (consumesTurnAction && turnStatus.remaining <= 0) {
        pushLog({
          kind: 'event',
          title: `Sin acciones restantes — ${caster.name}`,
          summaryText: turnStatus.hasElevarLimite
            ? `Ya usaste las ${turnStatus.max}/${turnStatus.max} acciones de este turno (no se descontó maná). Pasá el turno para lanzar ${spell.name}.`
            : turnStatus.hasHechizoVeloz
              ? `Ya usaste las ${turnStatus.max}/${turnStatus.max} acciones de Hechizo Veloz (no se descontó maná). Activá Elevar el Límite (-5 maná) o pasá el turno.`
              : `Ya usaste tu acción de este turno (${turnStatus.used}/${turnStatus.max}, no se descontó maná). Activá Hechizo Veloz (-3 maná) o pasá el turno.`,
        });
        return;
      }
    }

    const defMana = getEffectiveDefenseManaCost(
      caster,
      spell,
      Boolean(casterEffects?.disarmed)
    );
    const manaResult = isTest
      ? { ok: true, note: 'Modo prueba (sin gasto de maná).' }
      : applyManaCost(caster.id, defMana.cost);

    if (!manaResult.ok) {
      pushLog({
        kind: 'event',
        title: `Sin maná para ${spell.name}`,
        summaryText: manaResult.note,
      });
      return;
    }

    let castSummary: ReturnType<typeof rollD6Pool> | undefined;
    let masteryNote: string | undefined;
    if (spell.castStat !== 'none') {
      const dice =
        spell.castStat === 'manual'
          ? spell.manualCastDice
          : getCharacterStatDice(caster, spell.castStat, formula);
      const assured =
        spell.effectType === 'effect' || spell.effectType === 'heal'
          ? getEffectiveSpellAssured(caster, spell)
          : 0;
      castSummary = rollD6Pool(
        dice,
        assured,
        spell.castStat === 'manual' ? undefined : [{ stat: spell.castStat, dice }]
      );
      if (!isTest) {
        masteryNote = recordSpellMastery(caster.id, spell, castSummary.rolls);
      }
    }

    const combatant = combatants.find((c) => c.characterId === caster.id);
    const parsedTurns = parseDurationTurns(spell);

    // Manejo especial: Interrumpir Círculo (tirada enfrentada Influencia + Manipulación de maná)
    if (spell.id === 'basic_interrumpir_circulo') {
      const interruptRoll = rollCombinedStats(
        caster,
        ['influencia', 'manipulacion'],
        formula,
        getEffectiveSpellAssured(caster, spell)
      );
      const hasOpenTargetAttack =
        !isTest && pendingAttack && pendingAttack.attackerCharacterId !== caster.id;

      if (!isTest && combatants.length > 1) {
        setPendingCounterspell({
          id: generateId('cnt_'),
          interruptorCharacterId: caster.id,
          interruptorName: caster.name,
          targetCharacterId: hasOpenTargetAttack ? pendingAttack.attackerCharacterId : undefined,
          targetName: hasOpenTargetAttack ? pendingAttack.attackerName : undefined,
          spellName: hasOpenTargetAttack ? pendingAttack.spell.name : undefined,
          interruptRoll,
        });
      }

      const fmtNet = interruptRoll.net > 0 ? `+${interruptRoll.net}` : `${interruptRoll.net}`;
      pushLog({
        kind: 'cast',
        title: `🌀 ${caster.name} lanza Interrumpir Círculo (Inf + Man)`,
        actorName: caster.name,
        isMagical: true,
        castRoll: interruptRoll,
        manaNote: manaResult.note,
        summaryText: hasOpenTargetAttack
          ? `Tirada enfrentada con neto ${fmtNet} para anular «${pendingAttack.spell.name}» de ${pendingAttack.attackerName}. Resolvé la tirada enfrentada rival en la mesa de combate.`
          : `Tirada enfrentada con neto ${fmtNet} (Influencia + Manipulación de maná) para intentar anular un hechizo.`,
      });
      return;
    }

    // El casteo siempre funciona al declararlo -> si es hechizo de ataque queda preparado; si es Buff/Armadura/Efecto con turnos se aplica al combatiente; si consume acción de turno, descuenta 1 acción
    const effectSub = spell.effectType === 'effect' ? getEffectiveEffectSubType(spell) : null;
    const preparedToAdd: PreparedSpell | null =
      !isTest && combatant && spell.effectType === 'damage'
        ? {
            id: generateId('prep_'),
            spellId: spell.id,
            spellName: spell.name,
            castSuccesses: castSummary?.successes || 0,
            castFails: castSummary?.fails || 0,
            duration: spell.duration || (parsedTurns ? formatTurnDuration(parsedTurns) : '1 golpe'),
            durationTurns: parsedTurns,
            remainingTurns: parsedTurns,
            roundCast: round,
          }
        : null;

    const parsedHits = Math.max(
      0,
      Math.floor(spell.armorConfig?.maxHits ?? spell.maxHits ?? 0)
    );

    const statusToAdd: ActiveStatus | null =
      !isTest &&
      combatant &&
      ((spell.effectType === 'effect' &&
        (effectSub === 'buff' ||
          Boolean(parsedTurns) ||
          Boolean(spell.armorConfig?.isArmor) ||
          parsedHits > 0)) ||
        (spell.effectType === 'defense' && parsedHits > 0))
        ? {
            id: generateId('st_'),
            name: spell.name,
            kind: spell.effectType === 'defense' ? 'buff' : effectSub || 'general',
            sourceName: caster.name,
            sourceSpellId: spell.id,
            roundApplied: round,
            duration: spell.duration || (parsedTurns ? formatTurnDuration(parsedTurns) : 'Activo'),
            durationTurns: parsedTurns,
            remainingTurns: parsedTurns,
            armorReduction: spell.armorConfig?.isArmor
              ? spell.armorConfig.damageReduction ?? 0
              : undefined,
            armorDivisor: spell.armorConfig?.isArmor
              ? spell.armorConfig.damageDivisor ?? 1
              : undefined,
            armorElement: spell.armorConfig?.isArmor ? spell.armorConfig.element : undefined,
            maxHits: parsedHits > 0 ? parsedHits : undefined,
            remainingHits: parsedHits > 0 ? parsedHits : undefined,
            effectDescription: spell.effectDescription || undefined,
            isMagical: isSpellMagical(spell),
            isReinforceBuff: spell.id === 'basic_reforzar_hechizo' ? true : undefined,
          }
        : null;

    if (combatant && (preparedToAdd || statusToAdd || consumesTurnAction)) {
      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === combatant.id
            ? {
                ...cb,
                attacksUsedThisTurn: consumesTurnAction
                  ? (cb.attacksUsedThisTurn || 0) + 1
                  : cb.attacksUsedThisTurn,
                preparedSpells: preparedToAdd
                  ? [...cb.preparedSpells, preparedToAdd]
                  : cb.preparedSpells,
                activeStatuses: statusToAdd
                  ? [...(cb.activeStatuses || []), statusToAdd]
                  : cb.activeStatuses,
              }
            : cb
        )
      );
    }
    if (spell.id === 'basic_hechizo_veloz' || spell.id === 'basic_elevar_limite') {
      setAutoPassPaused(false);
    }

    const armorSummary = spell.armorConfig?.isArmor
      ? ` Armadura de ${spell.armorConfig.element || 'Arcano'} (reducción +${
          spell.armorConfig.damageReduction ?? 0
        }${parsedTurns ? ` · ${formatTurnDuration(parsedTurns)}` : ''}${
          parsedHits > 0 ? ` · resiste ${parsedHits} ${parsedHits === 1 ? 'golpe' : 'golpes'}` : ''
        }).`
      : parsedHits > 0
        ? ` Escudo/Buff activo: resiste ${parsedHits} ${parsedHits === 1 ? 'golpe' : 'golpes'}${
            parsedTurns ? ` (${formatTurnDuration(parsedTurns)})` : ''
          }.`
        : '';

    let specialSummary = '';
    if (spell.id === 'basic_presentir_mana') {
      const foci = combatants
        .filter((cb) => cb.characterId !== caster.id)
        .map((cb) => {
          const ch = characters.find((c) => c.id === cb.characterId);
          if (!ch || ch.mana.current <= 0) return null;
          const extras: string[] = [];
          if (cb.preparedSpells.length > 0) {
            extras.push(`${cb.preparedSpells.length} hechizo(s) preparado(s)`);
          }
          const magicStatuses = (cb.activeStatuses || []).filter((st) => st.isMagical).length;
          if (magicStatuses > 0) {
            extras.push(`${magicStatuses} aura(s) mágica(s)`);
          }
          const imbuedWeapons = (ch.weapons || []).filter((w) => w.imbued && !w.destroyed).length;
          if (imbuedWeapons > 0) {
            extras.push(`arma imbuida`);
          }
          return `${ch.name} (${ch.mana.current}/${ch.mana.max} maná${
            extras.length > 0 ? ` · ${extras.join(', ')}` : ''
          })`;
        })
        .filter(Boolean);
      specialSummary =
        foci.length > 0
          ? ` Área de 30 pies — focos de maná perceptibles en combate (si no se ocultan): ${foci.join('; ')}.`
          : ` Área de 30 pies — se percibe todo foco de maná no oculto en el entorno.`;
    } else if (spell.id === 'basic_proteccion') {
      specialSummary =
        defMana.discount > 0
          ? ` (-${defMana.discount} maná por ${defMana.shieldName}). Reduce el daño a tu vida en 3 (mágico) o 5 (físico); acumulable múltiples veces en el mismo ataque.`
          : ` Reduce el daño a tu vida en 3 (mágico) o 5 (físico); podés volver a activarlo múltiples veces sobre el mismo ataque en la mesa de combate.`;
    } else if (spell.id === 'basic_reforzar_hechizo') {
      specialSummary = ` Tu próximo hechizo de ataque con dados tirará el daño dos veces y aplicará el resultado más alto.`;
    } else if (spell.id === 'basic_hechizo_veloz') {
      specialSummary = ` Queda activo este turno: habilita realizar un segundo hechizo de ataque en tu turno.`;
    } else if (spell.id === 'basic_elevar_limite') {
      const hasVeloz = Boolean(
        combatant?.activeStatuses?.some((st) => st.name === 'Hechizo Veloz')
      );
      specialSummary = hasVeloz
        ? ` Hechizo Veloz detectado activo: habilita realizar un tercer ataque en tu turno.`
        : ` Habilita un tercer ataque en tu turno (requiere haber usado Hechizo Veloz previamente).`;
    }

    // Damage spells are only prepared here; their requirement is consumed when the attack executes.
    const depConsumeNote =
      !preparedToAdd &&
      !isTest &&
      depGate.dep.hasDependency &&
      depGate.dep.consumeOnUse &&
      depGate.dep.match
        ? consumeSpellDependency(depGate.dep.match)
        : isTest && depGate.dep.hasDependency
          ? ` (Modo prueba: en combate requiere «${depGate.dep.requiredName}».)`
          : '';

    pushLog({
      kind: 'cast',
      title: `${caster.name} ${
        effectSub === 'buff' ? 'activa' : 'declara'
      } ${spell.name} (1 acción importante)`,
      actorName: caster.name,
      isMagical: isSpellMagical(spell),
      castRoll: castSummary,
      manaNote: manaResult.note,
      masteryNote,
      summaryText:
        spell.effectType === 'damage'
          ? `Casteo declarado y efectivo (1 acción gastada). ${spell.name} queda preparado para atacar cuando convenga.${depConsumeNote}`
          : `${
              spell.effectDescription || `${spell.name} se efectúa automáticamente (1 acción gastada).`
            }${armorSummary}${specialSummary}${depConsumeNote}`,
    });

    // En móvil, saltar automáticamente a la mesa de combate / registro tras castear
    setMobileArenaSection('combat');

    // Modo IRL: si es hechizo de daño y no hay objetivo enemigo, queda listo para ejecutarse sin target obligatorio
    if (irlCombatMode && spell.effectType === 'damage' && !combatants.some((cb) => cb.characterId !== caster.id)) {
      // No se crea pendingAttack con target; el ataque se prepara y se resuelve desde la mesa de combate sin PNJ
    }
  };

  // Atacar: pasa siempre a fase de defensa del objetivo seleccionado, incluso con neto negativo (ej. -1)
  const executeAttack = (
    spell: Spell,
    attacker: Character,
    preparedSpellId?: string,
    isTest = false,
    explicitTargetCombatantId?: string
  ) => {
    if (!isTest && attacker.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${attacker.name} no puede atacar`,
        summaryText: `Estado actual: ${conditionLabel(attacker.condition)}.`,
      });
      return;
    }

    const depGate = checkSpellDependencyGate(spell, attacker, isTest, explicitTargetCombatantId);
    if (!depGate.ok) return;

    const attackerCombatant = combatants.find((c) => c.characterId === attacker.id);
    const attackerEffects = !isTest
      ? getCombatantStatusEffects(attackerCombatant, attacker)
      : null;
    if (!isTest && attackerEffects) {
      if (attackerEffects.cannotAttack) {
        pushLog({
          kind: 'event',
          title: `${attacker.name} no puede atacar`,
          summaryText: `Impedido por estado activo: ${attackerEffects.cannotAttackReasons.join(', ')} (no se descontó maná).`,
        });
        return;
      }
      if (attackerEffects.cannotCastMagic && isSpellMagical(spell)) {
        pushLog({
          kind: 'event',
          title: `${attacker.name} está Silenciado`,
          summaryText: `No puede lanzar hechizos mágicos mientras dure ${attackerEffects.cannotCastMagicReasons.join(', ')} (no se descontó maná).`,
        });
        return;
      }
    }

    const turnActionBefore =
      !isTest && attackerCombatant ? getCombatantTurnActionStatus(attackerCombatant) : null;

    if (!isTest && turnActionBefore && turnActionBefore.remaining <= 0) {
      pushLog({
        kind: 'event',
        title: `Sin acciones restantes — ${attacker.name}`,
        summaryText: turnActionBefore.hasElevarLimite
          ? `Ya usaste las ${turnActionBefore.max}/${turnActionBefore.max} acciones permitidas con Elevar el Límite este turno (no se descontó maná). Pasá el turno para volver a actuar.`
          : turnActionBefore.hasHechizoVeloz
            ? `Ya usaste las ${turnActionBefore.max}/${turnActionBefore.max} acciones de Hechizo Veloz este turno (no se descontó maná). Activá Elevar el Límite (-5 maná) o pasá el turno.`
            : `Ya usaste tu acción de este turno (${turnActionBefore.used}/${turnActionBefore.max}, no se descontó maná). Activá Hechizo Veloz (-3 maná) o pasá el turno.`,
      });
      return;
    }

    let attackManaNote: string | undefined;
    if (!isTest && !preparedSpellId && spell.manaCost > 0) {
      const manaResult = applyManaCost(attacker.id, spell.manaCost);
      if (!manaResult.ok) {
        pushLog({
          kind: 'event',
          title: `Sin maná para ${spell.name}`,
          summaryText: manaResult.note,
        });
        return;
      }
      attackManaNote = manaResult.note || undefined;
    }

    const statsToRoll = spell.combatStats.length > 0 ? spell.combatStats : (['fisico'] as StatKey[]);
    const effectiveAssured = getEffectiveSpellAssured(attacker, spell);
    const attackRoll = rollCombinedStats(
      attacker,
      statsToRoll,
      formula,
      effectiveAssured,
      attackerEffects?.autoFailsAttack || 0,
      attackerEffects?.autoFailsAttackNotes
    );
    const masteryNote = !isTest ? recordSpellMastery(attacker.id, spell, attackRoll.rolls) : undefined;

    const reinforceStatus = !isTest
      ? attackerCombatant?.activeStatuses?.find((st) => st.isReinforceBuff)
      : undefined;
    const isReinforcedAttack = Boolean(
      reinforceStatus &&
        isSpellMagical(spell) &&
        spell.damageMode === 'auto' &&
        spell.damage.dice.length > 0
    );

    if (attackerCombatant && (!isTest || preparedSpellId || isReinforcedAttack)) {
      const isSingleHit = !spell.duration || spell.duration.toLowerCase().includes('1 golpe');
      setCombatants((prev) =>
        prev.map((cb) => {
          if (cb.id !== attackerCombatant.id) return cb;
          return {
            ...cb,
            attacksUsedThisTurn: !isTest
              ? (cb.attacksUsedThisTurn || 0) + 1
              : cb.attacksUsedThisTurn,
            preparedSpells:
              preparedSpellId && isSingleHit
                ? cb.preparedSpells.filter((p) => p.id !== preparedSpellId)
                : cb.preparedSpells,
            activeStatuses:
              isReinforcedAttack && reinforceStatus
                ? (cb.activeStatuses || []).filter((st) => st.id !== reinforceStatus.id)
                : cb.activeStatuses,
          };
        })
      );
    }

    const desiredTargetId = explicitTargetCombatantId || selectedTargetId;
    const fallbackTargetCb =
      combatants.find((cb) => cb.id === desiredTargetId && cb.characterId !== attacker.id) ||
      combatants.find((cb) => cb.characterId !== attacker.id);

    const currentMastery = getSpellMasteryStatus(attacker.spellMastery?.[spell.id] || 0, formula);
    const upgradedDice = getEffectiveSpellDamageDice(spell, currentMastery);
    const effectiveSpellForAttack: Spell = {
      ...spell,
      damageKind: getEffectiveSpellDamageKind(spell),
      damage: {
        ...spell.damage,
        dice: upgradedDice.map((d) => ({ ...d })),
      },
    };

    const isAreaSpell = Boolean(effectiveSpellForAttack.areaConfig?.enabled);
    const areaRes = resolveSpellAreaTargets({
      spell: effectiveSpellForAttack,
      attackerCharacterId: attacker.id,
      combatants,
      characters,
      primaryTargetId: desiredTargetId,
    });

    const finalAreaTargetIds =
      isAreaSpell && areaRes.targetIds.length > 0
        ? areaRes.targetIds
        : fallbackTargetCb
          ? [fallbackTargetCb.id]
          : [];

    const firstTargetId = finalAreaTargetIds[0];
    const remainingAreaIds = isAreaSpell ? finalAreaTargetIds.slice(1) : [];
    const targetCb = firstTargetId
      ? combatants.find((cb) => cb.id === firstTargetId)
      : fallbackTargetCb;

    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;

    const areaTargetNames = finalAreaTargetIds
      .map((id) => {
        const cb = combatants.find((c) => c.id === id);
        const ch = cb ? characters.find((x) => x.id === cb.characterId) : undefined;
        return ch?.name;
      })
      .filter((n): n is string => Boolean(n));

    const pending: PendingAttack = {
      id: generateId('atk_'),
      attackerCombatantId: attackerCombatant?.id || '',
      attackerCharacterId: attacker.id,
      attackerName: attacker.name,
      spell: effectiveSpellForAttack,
      isLethal: isAttackLethal,
      preparedSpellId,
      targetCombatantId: targetCb?.id,
      attackRoll,
      isReinforced: isReinforcedAttack || undefined,
      protectionStacks: 0,
      areaTargetIds: remainingAreaIds.length > 0 ? remainingAreaIds : undefined,
      areaResolvedTargets: isAreaSpell ? [] : undefined,
      areaLabel: isAreaSpell ? areaRes.label : undefined,
      resolved: false,
    };

    if (!isTest && attackerCombatant) {
      if (irlCombatMode || combatants.length > 1) {
        setPendingAttack(pending);
        if (targetCb?.id) setSelectedTargetId(targetCb.id);
      }
    }

    // En móvil, saltar automáticamente a la mesa de combate / registro tras atacar
    setMobileArenaSection('combat');

    const formattedNet = attackRoll.net > 0 ? `+${attackRoll.net}` : `${attackRoll.net}`;
    const dmgKindLabel = getEffectiveSpellDamageKind(effectiveSpellForAttack) === 'magico' ? 'Mágico' : 'Físico';
    const reinforceAttackNote = isReinforcedAttack
      ? ' ⚡ Reforzar Hechizo activo (tirará daño ×2 y aplicará el mayor).'
      : '';
    const noActionWarning =
      turnActionBefore && turnActionBefore.remaining === 0
        ? ` ⚠️ Aviso: ataque adicional sin acciones ofensivas restantes (${turnActionBefore.used + 1}/${turnActionBefore.max}). Activá Hechizo Veloz o Elevar el Límite si corresponde.`
        : '';
    const depConsumeNote =
      !isTest && depGate.dep.hasDependency && depGate.dep.consumeOnUse && depGate.dep.match
        ? consumeSpellDependency(depGate.dep.match)
        : isTest && depGate.dep.hasDependency
          ? ` (Modo prueba: en combate requiere «${depGate.dep.requiredName}».)`
          : '';
    const areaNote = isAreaSpell
      ? areaRes.emptyConditionReason
        ? ` 🌐 ${areaRes.emptyConditionReason} Se inició con ${targetChar?.name || 'objetivo'} (podés ajustar blancos en la barra de Área).`
        : areaTargetNames.length > 1
          ? ` 🌐 Daño en área (${areaTargetNames.length} objetivos: ${areaTargetNames.join(', ')}).`
          : ` 🌐 Hechizo de área (podés sumar más blancos en la barra de Área).`
      : '';

    const attackDmgKind = getEffectiveSpellDamageKind(effectiveSpellForAttack);
    pushLog({
      kind: 'attack',
      title: isAreaSpell && areaTargetNames.length > 1
        ? `${attacker.name} lanza ${spell.name} en área sobre ${areaTargetNames.length} objetivos (${
            isAttackLethal ? 'Letal' : 'No letal'
          })`
        : `${attacker.name} ataca${targetChar ? ` a ${targetChar.name}` : ''} con ${spell.name} (${
            isAttackLethal ? 'Letal' : 'No letal'
          })`,
      actorName: attacker.name,
      isMagical: isSpellMagical(effectiveSpellForAttack),
      attackRoll,
      manaNote: attackManaNote,
      masteryNote,
      clash: {
        attackerName: attacker.name,
        attackerAction: spell.name,
        defenderName:
          isAreaSpell && areaTargetNames.length > 1
            ? `${areaTargetNames.length} objetivos (${areaTargetNames[0]}...)`
            : targetChar?.name,
        outcome: 'pending_defense',
        damageKind: attackDmgKind,
        isLethal: isAttackLethal,
      },
      summaryText: targetChar
        ? `Ataque (${dmgKindLabel}) con neto ${formattedNet}. Pasa a defensa de ${targetChar.name} (debe superar ${formattedNet} para evitar el daño).${areaNote}${reinforceAttackNote}${noActionWarning}${depConsumeNote}`
        : `Ataque (${dmgKindLabel}) con neto ${formattedNet}.${areaNote}${reinforceAttackNote}${noActionWarning}${depConsumeNote}`,
    });
  };

  const handleAttackFromSpell = (
    spell: Spell,
    casterCharacterId?: string,
    explicitTargetCombatantId?: string
  ) => {
    const attacker = casterCharacterId
      ? characters.find((c) => c.id === casterCharacterId)
      : activeCharacter;
    if (!attacker) return;
    const combatant = combatants.find((c) => c.characterId === attacker.id);
    const matchingPrep = combatant?.preparedSpells.find((p) => p.spellId === spell.id);
    executeAttack(spell, attacker, matchingPrep?.id, false, explicitTargetCombatantId);
  };

  const handleAttackWithPrepared = (
    combatantId: string,
    prepared: PreparedSpell,
    explicitTargetCombatantId?: string
  ) => {
    const cb = combatants.find((c) => c.id === combatantId);
    const char = cb ? characters.find((c) => c.id === cb.characterId) : undefined;
    const spell = spells.find((s) => s.id === prepared.spellId);
    if (!char || !spell) return;
    executeAttack(spell, char, prepared.id, false, explicitTargetCombatantId);
  };

  const applyDispelToCombatant = (
    targetCombatantId: string,
    dispelConfig: SpellDispelConfig,
    sourceSpellName: string
  ): { dispelledNames: string[]; note: string } => {
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb) return { dispelledNames: [], note: '' };

    const matching = (targetCb.activeStatuses || []).filter((st) =>
      matchesDispelScope(st, dispelConfig.scope)
    );
    if (matching.length === 0) {
      return {
        dispelledNames: [],
        note: ` ${targetChar?.name || 'Objetivo'} no tenía efectos activos de tipo "${DISPEL_SCOPE_LABELS[dispelConfig.scope]}" para disipar.`,
      };
    }

    // Priorizar armaduras primero si el alcance incluye armaduras
    const prioritized = [...matching].sort((a, b) => {
      const aArmor = (a.armorReduction || 0) > 0 || Boolean(a.armorElement) ? 1 : 0;
      const bArmor = (b.armorReduction || 0) > 0 || Boolean(b.armorElement) ? 1 : 0;
      return bArmor - aArmor;
    });

    const maxCount = Math.max(0, Math.floor(dispelConfig.maxEffects || 0));
    const toRemove = maxCount > 0 ? prioritized.slice(0, maxCount) : prioritized;
    const removeIds = new Set(toRemove.map((s) => s.id));
    const dispelledNames = toRemove.map((s) => s.name);

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === targetCombatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).filter((st) => !removeIds.has(st.id)),
            }
          : cb
      )
    );

    return {
      dispelledNames,
      note: ` 🚫 ${sourceSpellName} disipó [${dispelledNames.join(', ')}] de ${targetChar?.name || 'objetivo'}.`,
    };
  };

  const applyElementalStatusStacks = (
    targetCombatantId: string,
    kind: ElementalStatusKind,
    stacksToAdd: number,
    durationTurns: number,
    tickDie: DieType | undefined,
    damageKind: DamageKind,
    sourceName: string
  ): { totalStacks: number; addedNew: number; maxRem: number } => {
    const meta = ELEMENTAL_STATUS_META[kind];
    const safeDuration = Math.max(1, Math.floor(durationTurns || meta.defaultDuration));
    const safeAdd = Math.max(1, Math.floor(stacksToAdd || 1));
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const existing = targetCb?.activeStatuses?.find(
      (st) => getStatusElementalKind(st) === kind
    );
    const prevStacks = existing ? getStatusStackTurns(existing) : [];
    const nextStacks =
      kind === 'burn' && safeDuration === BURN_DURATION_TURNS
        ? mergeBurnStacks(prevStacks, safeAdd)
        : mergeElementalStacks(prevStacks, safeAdd, safeDuration, MAX_ELEMENTAL_STACKS);
    const maxRem = nextStacks.length > 0 ? Math.max(...nextStacks) : safeDuration;

    setCombatants((prev) =>
      prev.map((cb) => {
        if (cb.id !== targetCombatantId) return cb;
        const statuses = cb.activeStatuses || [];
        const idx = statuses.findIndex((st) => getStatusElementalKind(st) === kind);
        const current = idx >= 0 ? getStatusStackTurns(statuses[idx]) : [];
        const updatedStacks =
          kind === 'burn' && safeDuration === BURN_DURATION_TURNS
            ? mergeBurnStacks(current, safeAdd)
            : mergeElementalStacks(current, safeAdd, safeDuration, MAX_ELEMENTAL_STACKS);
        const updatedMaxRem =
          updatedStacks.length > 0 ? Math.max(...updatedStacks) : safeDuration;
        const effectiveTickDie =
          tickDie !== undefined
            ? tickDie
            : idx >= 0 && statuses[idx].tickDie
              ? statuses[idx].tickDie
              : meta.defaultTickDie;

        const nextStatus: ActiveStatus = {
          id: idx >= 0 ? statuses[idx].id : generateId('st_'),
          name: meta.name,
          kind: 'debuff',
          sourceName,
          roundApplied: round,
          duration: effectiveTickDie
            ? `${updatedStacks.length}${effectiveTickDie} · ${updatedMaxRem}t`
            : `${updatedStacks.length}c · ${updatedMaxRem}t`,
          durationTurns: safeDuration,
          remainingTurns: updatedMaxRem,
          effectDescription: effectiveTickDie
            ? `${meta.name}: ${updatedStacks.length}/${MAX_ELEMENTAL_STACKS} cargas (${updatedStacks.length}${effectiveTickDie} ${damageKind === 'fisico' ? 'físico' : 'mágico'} al inicio del turno).`
            : `${meta.name}: ${updatedStacks.length}/${MAX_ELEMENTAL_STACKS} carga(s) activas (${updatedMaxRem}t). ${meta.description}`,
          isMagical: damageKind === 'magico',
          elementalKind: kind,
          stackTurns: updatedStacks,
          burnStackTurns: kind === 'burn' ? updatedStacks : undefined,
          tickDie: effectiveTickDie,
          tickDamageKind: damageKind,
        };

        if (idx >= 0) {
          const copy = [...statuses];
          copy[idx] = nextStatus;
          return { ...cb, activeStatuses: copy };
        }
        return { ...cb, activeStatuses: [...statuses, nextStatus] };
      })
    );

    return {
      totalStacks: nextStacks.length,
      addedNew: Math.max(0, nextStacks.length - prevStacks.length),
      maxRem,
    };
  };

  const executeSynergyReaction = (
    targetCombatantId: string,
    reaction: SynergyReactionType,
    casterCharId?: string,
    sourceSpellName?: string,
    consumeStacks?: number | 'all'
  ): { triggered: boolean; note: string } => {
    if (reaction === 'none') return { triggered: false, note: '' };

    const caster =
      (casterCharId ? characters.find((c) => c.id === casterCharId) : activeCharacter) ||
      activeCharacter;
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return { triggered: false, note: '' };

    const labelPrefix = sourceSpellName ? `${sourceSpellName} — ` : '';

    const updateOrRemoveElementalStacks = (
      cbId: string,
      statusId: string,
      remainingStacks: number[],
      isBurn: boolean
    ) => {
      setCombatants((prev) =>
        prev.map((cb) => {
          if (cb.id !== cbId) return cb;
          if (remainingStacks.length === 0) {
            return {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).filter((s) => s.id !== statusId),
            };
          }
          const maxRem = Math.max(...remainingStacks);
          return {
            ...cb,
            activeStatuses: (cb.activeStatuses || []).map((s) =>
              s.id === statusId
                ? {
                    ...s,
                    stackTurns: remainingStacks,
                    ...(isBurn ? { burnStackTurns: remainingStacks } : {}),
                    remainingTurns: maxRem,
                    duration: formatTurnDuration(maxRem),
                  }
                : s
            ),
          };
        })
      );
    };

    if (reaction === 'detonate_burn') {
      const burnSt = (targetCb.activeStatuses || []).find(
        (st) => getStatusElementalKind(st) === 'burn'
      );
      const currentStacks = burnSt ? getStatusStackTurns(burnSt) : [];
      const usedStacks = getSynergyConsumeCount(currentStacks.length, consumeStacks);
      if (!burnSt || usedStacks <= 0) return { triggered: false, note: '' };

      const remaining = consumeElementalStacks(currentStacks, usedStacks);
      const roll = rollDamageDice(
        [{ type: 'd6', count: usedStacks }],
        0,
        `detonación de ${usedStacks} carga(s) de Quemadura`,
        'magico'
      );
      if (targetChar.hp.current > 0 && roll.total > 0) {
        adjustHp(targetChar.id, -roll.total, isAttackLethal);
      }
      updateOrRemoveElementalStacks(targetCombatantId, burnSt.id, remaining, true);
      const remNote = remaining.length > 0 ? ` (quedan ${remaining.length})` : ' (sin cargas restantes)';
      const note = ` 💥 ¡Sinergia: Detonar Quemadura! Se consume(n) ${usedStacks} carga(s)${remNote} en ${targetChar.name} → ${roll.total} de daño mágico explosivo (${usedStacks}d6).`;
      pushLog({
        kind: 'attack',
        title: `💥 ${labelPrefix}Detonar Quemadura (${usedStacks}d6) → ${targetChar.name}`,
        actorName: caster?.name,
        isMagical: true,
        damageRoll: { ...roll, isFireDamage: true },
        summaryText: note.trim(),
      });
      return { triggered: true, note };
    }

    if (reaction === 'siphon_poison') {
      const poisonSt = (targetCb.activeStatuses || []).find(
        (st) => getStatusElementalKind(st) === 'poison'
      );
      const currentStacks = poisonSt ? getStatusStackTurns(poisonSt) : [];
      const usedStacks = getSynergyConsumeCount(currentStacks.length, consumeStacks);
      if (!poisonSt || usedStacks <= 0) return { triggered: false, note: '' };

      const remaining = consumeElementalStacks(currentStacks, usedStacks);
      const roll = rollDamageDice(
        [{ type: 'd4', count: usedStacks }],
        0,
        `sifón de ${usedStacks} carga(s) de Envenenado`,
        'magico'
      );
      const healHp = Math.max(1, Math.ceil(roll.total / 2));
      const healMana = usedStacks;
      if (targetChar.hp.current > 0 && roll.total > 0) {
        adjustHp(targetChar.id, -roll.total, isAttackLethal);
      }
      if (caster && caster.id !== targetChar.id) {
        adjustHp(caster.id, healHp, false);
        adjustMana(caster.id, healMana);
      }
      updateOrRemoveElementalStacks(targetCombatantId, poisonSt.id, remaining, false);
      const remNote = remaining.length > 0 ? ` (quedan ${remaining.length})` : ' (sin cargas restantes)';
      const drainTargetNote =
        caster && caster.id !== targetChar.id
          ? ` ${caster.name} drena +${healHp} PV y +${healMana} Maná.`
          : '';
      const note = ` 🧪 ¡Sinergia: Sifón Tóxico! Se drena(n) ${usedStacks} carga(s)${remNote} de Envenenado en ${targetChar.name} → ${roll.total} de daño mágico (${usedStacks}d4).${drainTargetNote}`;
      pushLog({
        kind: 'attack',
        title: `🧪 ${labelPrefix}Sifón de Envenenado (${usedStacks}d4) → ${targetChar.name}`,
        actorName: caster?.name,
        isMagical: true,
        damageRoll: roll,
        summaryText: note.trim(),
      });
      return { triggered: true, note };
    }

    if (reaction === 'shatter_frozen') {
      const frozenSt = (targetCb.activeStatuses || []).find(
        (st) => getStatusElementalKind(st) === 'frozen'
      );
      const currentStacks = frozenSt ? getStatusStackTurns(frozenSt) : [];
      const usedStacks = getSynergyConsumeCount(currentStacks.length, consumeStacks);
      if (!frozenSt || usedStacks <= 0) return { triggered: false, note: '' };

      const remaining = consumeElementalStacks(currentStacks, usedStacks);
      const roll = rollDamageDice(
        [{ type: 'd8', count: usedStacks }],
        0,
        `fractura de ${usedStacks} carga(s) de Congelado`,
        'fisico'
      );
      if (targetChar.hp.current > 0 && roll.total > 0) {
        adjustHp(targetChar.id, -roll.total, isAttackLethal);
      }
      updateOrRemoveElementalStacks(targetCombatantId, frozenSt.id, remaining, false);
      const remNote = remaining.length > 0 ? ` (quedan ${remaining.length})` : ' (sin cargas restantes)';
      const note = ` ❄️ ¡Sinergia: Fractura Glacial! Se consume(n) ${usedStacks} carga(s)${remNote} de Congelado en ${targetChar.name} → ${roll.total} de daño (${usedStacks}d8).`;
      pushLog({
        kind: 'attack',
        title: `❄️ ${labelPrefix}Fractura de Congelado (${usedStacks}d8) → ${targetChar.name}`,
        actorName: caster?.name,
        isMagical: false,
        damageRoll: roll,
        summaryText: note.trim(),
      });
      return { triggered: true, note };
    }

    if (reaction === 'overload_electrified') {
      const electrifiedCbs = combatants.filter((cb) =>
        (cb.activeStatuses || []).some((st) => getStatusElementalKind(st) === 'electrified')
      );
      if (electrifiedCbs.length === 0) return { triggered: false, note: '' };

      const hitsNotes: string[] = [];
      const updatesByCb = new Map<string, { statusId: string; remaining: number[] }>();
      for (const cb of electrifiedCbs) {
        const ch = characters.find((c) => c.id === cb.characterId);
        const elecSt = (cb.activeStatuses || []).find(
          (st) => getStatusElementalKind(st) === 'electrified'
        );
        const currentStacks = elecSt ? getStatusStackTurns(elecSt) : [];
        const usedStacks = getSynergyConsumeCount(currentStacks.length, consumeStacks);
        if (!ch || !elecSt || usedStacks <= 0) continue;
        const remaining = consumeElementalStacks(currentStacks, usedStacks);
        const roll = rollDamageDice(
          [{ type: 'd6', count: usedStacks }],
          0,
          `sobrecarga antena eléctrica (${usedStacks} carga(s))`,
          'magico'
        );
        if (ch.hp.current > 0 && roll.total > 0) {
          adjustHp(ch.id, -roll.total, isAttackLethal);
        }
        updatesByCb.set(cb.id, { statusId: elecSt.id, remaining });
        hitsNotes.push(
          `${ch.name}: ${roll.total} (${usedStacks}d6${remaining.length > 0 ? `, quedan ${remaining.length}` : ''})`
        );
      }

      if (updatesByCb.size === 0) return { triggered: false, note: '' };
      setCombatants((prev) =>
        prev.map((cb) => {
          const upd = updatesByCb.get(cb.id);
          if (!upd) return cb;
          if (upd.remaining.length === 0) {
            return {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).filter((s) => s.id !== upd.statusId),
            };
          }
          const maxRem = Math.max(...upd.remaining);
          return {
            ...cb,
            activeStatuses: (cb.activeStatuses || []).map((s) =>
              s.id === upd.statusId
                ? {
                    ...s,
                    stackTurns: upd.remaining,
                    remainingTurns: maxRem,
                    duration: formatTurnDuration(maxRem),
                  }
                : s
            ),
          };
        })
      );
      const note = ` ⚡ ¡Sinergia: Sobrecarga de Antena Eléctrica! Descarga sobre Electrificados: ${hitsNotes.join(' · ')}.`;
      pushLog({
        kind: 'attack',
        title: `⚡ ${labelPrefix}Sobrecarga de Antena Eléctrica`,
        actorName: caster?.name,
        isMagical: true,
        summaryText: note.trim(),
      });
      return { triggered: true, note };
    }

    if (reaction === 'hemorrhage_bleed') {
      const bleedSt = (targetCb.activeStatuses || []).find(
        (st) => getStatusElementalKind(st) === 'bleeding'
      );
      const currentStacks = bleedSt ? getStatusStackTurns(bleedSt) : [];
      const usedStacks = getSynergyConsumeCount(currentStacks.length, consumeStacks);
      if (!bleedSt || usedStacks <= 0) return { triggered: false, note: '' };

      const remaining = consumeElementalStacks(currentStacks, usedStacks);
      const roll = rollDamageDice(
        [{ type: 'd6', count: usedStacks }],
        0,
        `hemorragia de ${usedStacks} carga(s) de Sangrando`,
        'fisico'
      );
      if (targetChar.hp.current > 0 && roll.total > 0) {
        adjustHp(targetChar.id, -roll.total, isAttackLethal);
      }
      updateOrRemoveElementalStacks(targetCombatantId, bleedSt.id, remaining, false);
      const remNote = remaining.length > 0 ? ` (quedan ${remaining.length})` : ' (sin cargas restantes)';
      const note = ` 🩸 ¡Sinergia: Hemorragia! Se consume(n) ${usedStacks} carga(s)${remNote} de Sangrando en ${targetChar.name} → ${roll.total} de daño físico (${usedStacks}d6).`;
      pushLog({
        kind: 'attack',
        title: `🩸 ${labelPrefix}Hemorragia (${usedStacks}d6) → ${targetChar.name}`,
        actorName: caster?.name,
        isMagical: false,
        damageRoll: roll,
        summaryText: note.trim(),
      });
      return { triggered: true, note };
    }

    return { triggered: false, note: '' };
  };

  const handleTriggerSynergyReaction = (
    targetCombatantId: string,
    reaction: SynergyReactionType
  ) => {
    executeSynergyReaction(targetCombatantId, reaction, activeCharacter?.id, undefined, 1);
  };

  const handleCancelCombatantBuffs = (combatantId: string) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb) return;

    const toCancel = (targetCb.activeStatuses || []).filter(
      (st) =>
        st.kind === 'buff' ||
        st.kind === 'general' ||
        (st.armorReduction || 0) > 0 ||
        Boolean(st.armorElement) ||
        (st.kind !== 'debuff' && typeof st.remainingTurns === 'number')
    );
    if (toCancel.length === 0) return;

    const removeIds = new Set(toCancel.map((s) => s.id));
    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).filter((st) => !removeIds.has(st.id)),
            }
          : cb
      )
    );

    pushLog({
      kind: 'event',
      title: `Hechizos por turno cancelados — ${targetChar?.name || 'Combatiente'}`,
      actorName: targetChar?.name,
      summaryText: `Se cancelaron ${toCancel.length} efecto(s)/buff(s) por turno: ${toCancel.map((s) => s.name).join(', ')}.`,
    });
  };

  const applyElementalStatusesAndSynergies = (
    spell: Spell,
    dmgSummary: DamageRollSummary,
    targetCombatantId: string,
    targetName: string,
    attackerName: string,
    attackerCharacterId?: string,
    skipSynergyReaction = false
  ): {
    appliedBurnStacks: number;
    isFire: boolean;
    appliedStatuses: { kind: ElementalStatusKind; stacks: number }[];
    notes: string;
  } => {
    const appliedStatuses: { kind: ElementalStatusKind; stacks: number }[] = [];
    const appliedKinds = new Set<ElementalStatusKind>();
    const notesParts: string[] = [];
    let appliedBurnStacks = 0;

    const isFire = isFireDamageSpell(spell) || spell.elementalStatus?.kind === 'burn';
    const isElectric = isElectricDamageSpell(spell) || spell.elementalStatus?.kind === 'electrified';
    const maxDice = dmgSummary.maxDieCount || 0;
    const upperHalfDice = dmgSummary.upperHalfDieCount || 0;

    // 1. Configuración explícita de estado elemental en el hechizo
    if (spell.elementalStatus && dmgSummary.total > 0) {
      const cfg = spell.elementalStatus;
      const meta = ELEMENTAL_STATUS_META[cfg.kind];
      const effectiveTrigger = cfg.trigger === 'auto' ? meta.defaultTrigger : cfg.trigger;
      const triggered =
        effectiveTrigger === 'always' ||
        (effectiveTrigger === 'upper_half' && upperHalfDice > 0) ||
        (effectiveTrigger === 'max_die' && maxDice > 0);
      if (triggered) {
        const stacks = Math.max(1, cfg.stacks || 1);
        const res = applyElementalStatusStacks(
          targetCombatantId,
          cfg.kind,
          stacks,
          cfg.durationTurns,
          cfg.tickDie,
          cfg.damageKind || meta.defaultDamageKind,
          attackerName
        );
        appliedKinds.add(cfg.kind);
        appliedStatuses.push({ kind: cfg.kind, stacks });
        if (cfg.kind === 'burn') appliedBurnStacks = stacks;
        const triggerReason =
          effectiveTrigger === 'upper_half'
            ? ' (50% mitad positiva del dado)'
            : effectiveTrigger === 'max_die'
              ? ` (dado máximo ×${maxDice})`
              : ' (100%)';
        notesParts.push(
          ` ${meta.name}${triggerReason}: ${targetName} recibe +${stacks} carga(s) (${res.totalStacks}/${MAX_ELEMENTAL_STACKS} · ${res.maxRem}t).`
        );
      }
    }

    // 2. Reglas elementales automáticas por tipo de ataque (cuando no se aplicó ya ese estado explícito)
    if (dmgSummary.total > 0) {
      // Fuego -> Quemadura por dado máximo
      if (!appliedKinds.has('burn') && isFireDamageSpell(spell) && maxDice > 0) {
        const res = applyElementalStatusStacks(
          targetCombatantId,
          'burn',
          maxDice,
          BURN_DURATION_TURNS,
          'd4',
          'magico',
          attackerName
        );
        appliedKinds.add('burn');
        appliedBurnStacks = maxDice;
        appliedStatuses.push({ kind: 'burn', stacks: maxDice });
        notesParts.push(
          res.addedNew > 0
            ? ` 🔥 ¡Dado máximo de fuego (×${maxDice})! ${targetName} recibe +${res.addedNew} carga(s) de Quemadura (1d4 × ${BURN_DURATION_TURNS}t). Total: ${res.totalStacks}/${MAX_BURN_STACKS} cargas (${res.totalStacks}d4 al inicio de su turno).`
            : ` 🔥 ¡Dado máximo de fuego (×${maxDice})! Quemadura en ${targetName} se mantiene al máximo (${MAX_BURN_STACKS}/${MAX_BURN_STACKS} cargas) con duración renovada.`
        );
      }

      // Veneno -> Envenenado (50% mitad positiva del dado)
      if (!appliedKinds.has('poison') && isPoisonDamageSpell(spell) && upperHalfDice > 0) {
        const res = applyElementalStatusStacks(
          targetCombatantId,
          'poison',
          upperHalfDice,
          ELEMENTAL_STATUS_META.poison.defaultDuration,
          'd4',
          'magico',
          attackerName
        );
        appliedKinds.add('poison');
        appliedStatuses.push({ kind: 'poison', stacks: upperHalfDice });
        notesParts.push(
          ` ☠️ ¡Veneno activado (mitad positiva del dado ×${upperHalfDice})! ${targetName} queda Envenenado (${res.totalStacks}/${MAX_ELEMENTAL_STACKS} cargas · ${res.totalStacks}d4/turno).`
        );
      }

      // Hielo / Frío -> Congelado (50% mitad positiva del dado)
      if (!appliedKinds.has('frozen') && isIceDamageSpell(spell) && upperHalfDice > 0) {
        const res = applyElementalStatusStacks(
          targetCombatantId,
          'frozen',
          1,
          ELEMENTAL_STATUS_META.frozen.defaultDuration,
          undefined,
          'magico',
          attackerName
        );
        appliedKinds.add('frozen');
        appliedStatuses.push({ kind: 'frozen', stacks: 1 });
        notesParts.push(
          ` ❄️ ¡Frío activado (50% mitad positiva)! ${targetName} queda Congelado (${res.totalStacks} carga(s) · ${res.maxRem}t).`
        );
      }

      // Electricidad / Rayo -> Electrificado 100%
      if (!appliedKinds.has('electrified') && isElectricDamageSpell(spell)) {
        const res = applyElementalStatusStacks(
          targetCombatantId,
          'electrified',
          1,
          ELEMENTAL_STATUS_META.electrified.defaultDuration,
          undefined,
          'magico',
          attackerName
        );
        appliedKinds.add('electrified');
        appliedStatuses.push({ kind: 'electrified', stacks: 1 });
        notesParts.push(
          ` ⚡ ¡Electrificado (100%)! ${targetName} queda cargado como antena (${res.totalStacks} carga(s) · ${res.maxRem}t).`
        );
      }

      // Corte / Sangrado -> Sangrando 100%
      if (!appliedKinds.has('bleeding') && isBleedingDamageSpell(spell)) {
        const res = applyElementalStatusStacks(
          targetCombatantId,
          'bleeding',
          1,
          ELEMENTAL_STATUS_META.bleeding.defaultDuration,
          'd4',
          'fisico',
          attackerName
        );
        appliedKinds.add('bleeding');
        appliedStatuses.push({ kind: 'bleeding', stacks: 1 });
        notesParts.push(
          ` 🩸 ¡Corte sangrante (100%)! ${targetName} queda Sangrando (${res.totalStacks}/${MAX_ELEMENTAL_STACKS} cargas · ${res.totalStacks}d4 físico/turno).`
        );
      }
    }

    // 3. Expansión de Antena Eléctrica: si atacás con electricidad/rayo a un objetivo,
    // los DEMÁS combatientes ya Electrificados reciben daño de rayo en cadena.
    if (isElectric && dmgSummary.total > 0) {
      const otherElectrified = combatants.filter(
        (cb) =>
          cb.id !== targetCombatantId &&
          cb.characterId !== attackerCharacterId &&
          (cb.activeStatuses || []).some((st) => getStatusElementalKind(st) === 'electrified')
      );
      if (otherElectrified.length > 0) {
        const chainParts: string[] = [];
        for (const cb of otherElectrified) {
          const ch = characters.find((c) => c.id === cb.characterId);
          const elecSt = (cb.activeStatuses || []).find(
            (st) => getStatusElementalKind(st) === 'electrified'
          );
          const stacks = elecSt ? getStatusStackTurns(elecSt).length : 0;
          if (!ch || ch.hp.current <= 0 || stacks <= 0) continue;
          const chainRoll = rollDamageDice(
            [{ type: 'd4', count: stacks }],
            0,
            `expansión antena eléctrica (${stacks} carga(s))`,
            'magico'
          );
          if (chainRoll.total > 0) {
            adjustHp(ch.id, -chainRoll.total, isAttackLethal);
          }
          chainParts.push(`${ch.name} −${chainRoll.total} PV (${stacks}d4)`);
        }
        if (chainParts.length > 0) {
          const antennaNote = ` ⚡ ¡Expansión eléctrica (Antena)! El rayo salta a los objetivos Electrificados: ${chainParts.join(', ')}.`;
          notesParts.push(antennaNote);
          pushLog({
            kind: 'attack',
            title: `⚡ Expansión eléctrica (Antena) — ${spell.name}`,
            actorName: attackerName,
            isMagical: true,
            summaryText: antennaNote.trim(),
          });
        }
      }
    }

    // 4. Reacción de Sinergia automática (consume 1 carga por defecto salvo que el hechizo indique otra cantidad)
    const detectedSynergy = detectSpellSynergy(spell);
    if (!skipSynergyReaction && detectedSynergy !== 'none') {
      const synRes = executeSynergyReaction(
        targetCombatantId,
        detectedSynergy,
        attackerCharacterId,
        spell.name,
        spell.synergyConsumeStacks
      );
      if (synRes.triggered) {
        notesParts.push(synRes.note);
      }
    }

    return {
      appliedBurnStacks,
      isFire,
      appliedStatuses,
      notes: notesParts.join(''),
    };
  };

  const rollSpellDamage = (
    spell: Spell,
    dmgKind: DamageKind,
    isReinforced?: boolean,
    isAutoCrit?: boolean,
    criticalReason?: string
  ): { summary: DamageRollSummary; reinforceNote: string } => {
    if (isAutoCrit && spell.damage.dice.length > 0) {
      const critRoll = rollCriticalDamageDice(
        spell.damage.dice,
        spell.damage.bonus,
        spell.damage.notes,
        dmgKind,
        criticalReason || 'Aturdido'
      );
      return {
        summary: critRoll,
        reinforceNote: ` ⚡ ¡Crítico automático (${criticalReason || 'Aturdido'})! Todos los dados aplican su valor máximo (${critRoll.total}).`,
      };
    }

    const roll1 = rollDamageDice(
      spell.damage.dice,
      spell.damage.bonus,
      spell.damage.notes,
      dmgKind
    );
    if (!isReinforced || spell.damage.dice.length === 0) {
      return { summary: roll1, reinforceNote: '' };
    }
    const roll2 = rollDamageDice(
      spell.damage.dice,
      spell.damage.bonus,
      spell.damage.notes,
      dmgKind
    );
    const chosen = roll2.total > roll1.total ? roll2 : roll1;
    const reinforceNote = ` ⚡ Reforzar Hechizo: Tirada 1 (${roll1.total}: ${roll1.parts.join(' + ')}) vs Tirada 2 (${roll2.total}: ${roll2.parts.join(' + ')}) → aplica el mayor (${chosen.total}).`;
    return {
      summary: {
        ...chosen,
        notes: chosen.notes
          ? `${chosen.notes} · Reforzado (mayor de ${roll1.total} y ${roll2.total})`
          : `Reforzado (mayor de ${roll1.total} y ${roll2.total})`,
      },
      reinforceNote,
    };
  };

  const handleUseAttackProtection = (
    targetCombatantId: string
  ): { ok: boolean; reductionAdded: number } => {
    if (!pendingAttack) return { ok: false, reductionAdded: 0 };
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const defender = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!defender) return { ok: false, reductionAdded: 0 };

    if (defender.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${defender.name} no puede usar Protección`,
        summaryText: `Estado actual: ${conditionLabel(defender.condition)}.`,
      });
      return { ok: false, reductionAdded: 0 };
    }

    const defEffects = getCombatantStatusEffects(targetCb, defender);
    if (defEffects.cannotReact || defEffects.cannotCastMagic) {
      pushLog({
        kind: 'event',
        title: `${defender.name} no puede usar Protección`,
        summaryText: defEffects.cannotReact
          ? `Capacidad de reaccionar = 0 (${defEffects.cannotReactReasons.join(', ')}).`
          : `Silenciado (${defEffects.cannotCastMagicReasons.join(', ')}).`,
      });
      return { ok: false, reductionAdded: 0 };
    }

    const protSpell = spells.find((s) => s.id === 'basic_proteccion');
    const stacks = pendingAttack.protectionStacks || 0;
    const manaInfo =
      stacks === 0 && protSpell
        ? getEffectiveDefenseManaCost(defender, protSpell, defEffects.disarmed)
        : { cost: 1, discount: 0, shieldName: '' };

    const manaRes = applyManaCost(defender.id, manaInfo.cost);
    if (!manaRes.ok) {
      pushLog({
        kind: 'event',
        title: `${defender.name} sin maná para Protección`,
        summaryText: manaRes.note,
      });
      return { ok: false, reductionAdded: 0 };
    }

    const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
    const reductionAdded = dmgKind === 'magico' ? 3 : 5;
    const nextStacks = stacks + 1;

    setPendingAttack((prev) =>
      prev ? { ...prev, protectionStacks: (prev.protectionStacks || 0) + 1 } : prev
    );

    pushLog({
      kind: 'defense',
      title: `${defender.name} usa Protección (#${nextStacks}) vs ${pendingAttack.spell.name}`,
      actorName: defender.name,
      isMagical: true,
      clash: {
        attackerName: pendingAttack.attackerName,
        attackerAction: pendingAttack.spell.name,
        defenderName: defender.name,
        defenderAction: `Protección #${nextStacks}`,
        outcome: 'protection',
        damageKind: dmgKind,
      },
      manaNote:
        manaInfo.discount > 0
          ? `${manaRes.note} (-${manaInfo.discount} por ${manaInfo.shieldName})`
          : manaRes.note,
      summaryText: `Reduce el daño a la vida en ${reductionAdded} (${
        dmgKind === 'magico' ? 'daño mágico' : 'daño físico'
      }). Reducción acumulada por Protección en este ataque: +${
        nextStacks * reductionAdded
      }.`,
    });

    return { ok: true, reductionAdded };
  };

  const handleReinforcePendingAttack = () => {
    if (!pendingAttack || pendingAttack.isReinforced) return;
    const attacker = characters.find((c) => c.id === pendingAttack.attackerCharacterId);
    if (!attacker) return;

    if (attacker.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${attacker.name} no puede reforzar el hechizo`,
        summaryText: `Estado actual: ${conditionLabel(attacker.condition)}.`,
      });
      return;
    }

    const manaRes = applyManaCost(attacker.id, 1);
    if (!manaRes.ok) {
      pushLog({
        kind: 'event',
        title: `${attacker.name} sin maná para Reforzar Hechizo`,
        summaryText: manaRes.note,
      });
      return;
    }

    setPendingAttack((prev) => (prev ? { ...prev, isReinforced: true } : prev));
    pushLog({
      kind: 'cast',
      title: `⚡ ${attacker.name} activa Reforzar Hechizo sobre ${pendingAttack.spell.name}`,
      actorName: attacker.name,
      isMagical: true,
      manaNote: manaRes.note,
      summaryText: `Se tirarán dos veces los dados de daño de ${pendingAttack.spell.name} y se aplicará el resultado más alto.`,
    });
  };

  const handleTriggerCounterspellFromAttack = (interruptorCombatantId: string) => {
    const cb = combatants.find((c) => c.id === interruptorCombatantId);
    const interruptor = cb ? characters.find((c) => c.id === cb.characterId) : undefined;
    if (!interruptor) return;

    if (interruptor.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${interruptor.name} no puede interrumpir`,
        summaryText: `Estado actual: ${conditionLabel(interruptor.condition)}.`,
      });
      return;
    }

    const intEffects = getCombatantStatusEffects(cb, interruptor);
    if (intEffects.cannotReact || intEffects.cannotCastMagic) {
      pushLog({
        kind: 'event',
        title: `${interruptor.name} no puede interrumpir`,
        summaryText: intEffects.cannotReact
          ? `Capacidad de reaccionar = 0 (${intEffects.cannotReactReasons.join(', ')}).`
          : `Silenciado (${intEffects.cannotCastMagicReasons.join(', ')}).`,
      });
      return;
    }

    const counterSpell = spells.find((s) => s.id === 'basic_interrumpir_circulo');
    const manaCost = counterSpell?.manaCost ?? 7;
    const manaRes = applyManaCost(interruptor.id, manaCost);
    if (!manaRes.ok) {
      pushLog({
        kind: 'event',
        title: `${interruptor.name} sin maná para Interrumpir Círculo`,
        summaryText: manaRes.note,
      });
      return;
    }

    const interruptRoll = rollCombinedStats(
      interruptor,
      ['influencia', 'manipulacion'],
      formula,
      counterSpell ? getEffectiveSpellAssured(interruptor, counterSpell) : 0
    );

    setPendingCounterspell({
      id: generateId('cnt_'),
      interruptorCharacterId: interruptor.id,
      interruptorName: interruptor.name,
      targetCharacterId: pendingAttack?.attackerCharacterId,
      targetName: pendingAttack?.attackerName,
      spellName: pendingAttack?.spell.name,
      interruptRoll,
    });

    const fmtNet = interruptRoll.net > 0 ? `+${interruptRoll.net}` : `${interruptRoll.net}`;
    pushLog({
      kind: 'cast',
      title: `🌀 ${interruptor.name} intenta Interrumpir Círculo${
        pendingAttack ? ` (${pendingAttack.spell.name})` : ''
      }`,
      actorName: interruptor.name,
      isMagical: true,
      castRoll: interruptRoll,
      manaNote: manaRes.note,
      summaryText: `Tirada enfrentada (Influencia + Manipulación) con neto ${fmtNet}. Resolvé la tirada rival en la mesa de combate.`,
    });
  };

  const handleResolveCounterspell = (
    casterCombatantId: string | 'manual',
    manualDiceCount = 2
  ) => {
    if (!pendingCounterspell) return;

    let casterName = 'Hechicero rival';
    let casterRoll: ReturnType<typeof rollD6Pool>;

    if (casterCombatantId === 'manual') {
      casterRoll = rollD6Pool(manualDiceCount, 0);
      casterName = pendingCounterspell.targetName || `Rival (manual ${manualDiceCount}d6)`;
    } else {
      const targetCb = combatants.find((c) => c.id === casterCombatantId);
      const targetChar = targetCb
        ? characters.find((c) => c.id === targetCb.characterId)
        : undefined;
      if (!targetChar) return;
      casterName = targetChar.name;
      casterRoll = rollCombinedStats(targetChar, ['influencia', 'manipulacion'], formula, 0);
    }

    const intNet = pendingCounterspell.interruptRoll.net;
    const casNet = casterRoll.net;
    const cancelled = intNet > casNet;

    const cancelledAttackMatches = Boolean(
      cancelled &&
        pendingAttack &&
        (!pendingCounterspell.targetCharacterId ||
          pendingAttack.attackerCharacterId === pendingCounterspell.targetCharacterId)
    );

    if (cancelledAttackMatches) {
      setPendingAttack(null);
    }

    pushLog({
      kind: 'defense',
      title: cancelled
        ? `¡Hechizo anulado! ${pendingCounterspell.interruptorName} vence a ${casterName}`
        : `${casterName} sostiene su hechizo ante Interrumpir Círculo`,
      attackRoll: casterRoll,
      defenseRoll: pendingCounterspell.interruptRoll,
      isMagical: true,
      clash: {
        attackerName: casterName,
        attackerAction: pendingCounterspell.spellName || 'Hechizo sostenido (Inf + Man)',
        defenderName: pendingCounterspell.interruptorName,
        defenderAction: 'Interrumpir Círculo (Inf + Man)',
        outcome: cancelled ? 'counterspell_success' : 'counterspell_fail',
        damageKind: 'magico',
      },
      summaryText: cancelled
        ? `Tirada enfrentada (Inf+Man): ${pendingCounterspell.interruptorName} (${intNet}) > ${casterName} (${casNet}).${
            cancelledAttackMatches
              ? ` El hechizo «${pendingAttack?.spell.name}» queda anulado.`
              : ` El hechizo objetivo queda anulado.`
          }`
        : `Tirada enfrentada (Inf+Man): ${casterName} (${casNet}) ≥ ${pendingCounterspell.interruptorName} (${intNet}). El hechizo no fue interrumpido y continúa.`,
    });

    setPendingCounterspell(null);
  };

  const advanceOrClearPendingAttack = (
    currentPending: PendingAttack,
    resolvedEntry: {
      combatantId: string;
      name: string;
      outcome: 'blocked' | 'hit';
      damage: number;
    }
  ) => {
    const remaining = (currentPending.areaTargetIds || []).filter(
      (id) => id !== resolvedEntry.combatantId
    );
    if (remaining.length > 0) {
      const nextId = remaining[0];
      const rest = remaining.slice(1);
      setPendingAttack({
        ...currentPending,
        targetCombatantId: nextId,
        areaTargetIds: rest,
        areaResolvedTargets: [
          ...(currentPending.areaResolvedTargets || []),
          resolvedEntry,
        ],
        defenseRoll: undefined,
        pendingDamage: undefined,
        damageRoll: undefined,
        protectionStacks: 0,
        resolved: false,
      });
      setSelectedTargetId(nextId);
      return;
    }
    setPendingAttack(null);
  };

  const handleToggleAreaTarget = (combatantId: string) => {
    setPendingAttack((prev) => {
      if (!prev || prev.resolved) return prev;
      if (combatantId === prev.attackerCombatantId) return prev;
      if ((prev.areaResolvedTargets || []).some((r) => r.combatantId === combatantId)) {
        return prev;
      }

      const queued = prev.areaTargetIds || [];
      if (prev.targetCombatantId === combatantId) {
        if (queued.length === 0 || prev.defenseRoll || prev.pendingDamage) return prev;
        const [nextCurrent, ...rest] = queued;
        setSelectedTargetId(nextCurrent);
        return {
          ...prev,
          targetCombatantId: nextCurrent,
          areaTargetIds: rest,
        };
      }

      if (queued.includes(combatantId)) {
        return {
          ...prev,
          areaTargetIds: queued.filter((id) => id !== combatantId),
        };
      }

      return {
        ...prev,
        areaTargetIds: [...queued, combatantId],
      };
    });
  };

  const handleResolveAllAreaDirect = () => {
    if (!pendingAttack || pendingAttack.resolved) return;
    const allIds = [
      ...(pendingAttack.targetCombatantId ? [pendingAttack.targetCombatantId] : []),
      ...(pendingAttack.areaTargetIds || []),
    ].filter((id, idx, arr) => Boolean(id) && arr.indexOf(id) === idx);
    if (allIds.length === 0) {
      setPendingAttack(null);
      return;
    }

    const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
    const hitSummaries: string[] = [];
    const isGlobalOverload =
      detectSpellSynergy(pendingAttack.spell) === 'overload_electrified';
    let overloadReactionAttempted = false;

    for (const cbId of allIds) {
      const targetCb = combatants.find((c) => c.id === cbId);
      const defender = targetCb
        ? characters.find((c) => c.id === targetCb.characterId)
        : undefined;
      if (!targetCb || !defender) continue;

      const defEffects = getCombatantStatusEffects(targetCb, defender);
      const { summary: rawSummary } = rollSpellDamage(
        pendingAttack.spell,
        dmgKind,
        pendingAttack.isReinforced,
        defEffects.incomingAutoCrit,
        defEffects.incomingAutoCritReasons.join(', ')
      );
      const appliedDmg = Math.max(0, rawSummary.total);

      if (appliedDmg > 0) {
        adjustHp(defender.id, -appliedDmg, pendingAttack.isLethal);
      }

      const hitEndedIds = (targetCb.activeStatuses || [])
        .filter((st) => st.endsOnHit)
        .map((st) => st.id);
      if (hitEndedIds.length > 0) {
        const endIds = new Set(hitEndedIds);
        setCombatants((prev) =>
          prev.map((cb) =>
            cb.id === targetCb.id
              ? {
                  ...cb,
                  activeStatuses: (cb.activeStatuses || []).filter((st) => !endIds.has(st.id)),
                }
              : cb
          )
        );
      }

      const elemRes = applyElementalStatusesAndSynergies(
        pendingAttack.spell,
        rawSummary,
        targetCb.id,
        defender.name,
        pendingAttack.attackerName,
        pendingAttack.attackerCharacterId,
        isGlobalOverload && overloadReactionAttempted
      );
      if (isGlobalOverload) overloadReactionAttempted = true;
      const critTag = defEffects.incomingAutoCrit ? ' [CRÍTICO]' : '';
      const statusTag =
        elemRes.appliedStatuses.length > 0
          ? ` (+${elemRes.appliedStatuses
              .map((s) => `${ELEMENTAL_STATUS_META[s.kind].name} ×${s.stacks}`)
              .join(', ')})`
          : '';
      hitSummaries.push(`${defender.name}: -${appliedDmg} PV${critTag}${statusTag}`);
    }

    pushLog({
      kind: 'attack',
      title: `🌐 Impacto en área directo: ${pendingAttack.spell.name} (${allIds.length} objetivos)`,
      actorName: pendingAttack.attackerName,
      isMagical: dmgKind === 'magico',
      attackRoll: pendingAttack.attackRoll,
      summaryText: `Daño directo en área aplicado sobre ${hitSummaries.join(' · ')}.`,
    });

    const attackerChar = characters.find((c) => c.id === pendingAttack.attackerCharacterId);
    const pendingSpell = pendingAttack.spell;
    setPendingAttack(null);

    if (pendingSpell.statuses && pendingSpell.statuses.length > 0 && attackerChar) {
      triggerStatusCheck(pendingSpell, attackerChar, false, true);
    }
  };

  // Paso intermedio: decide/tira el daño directo y pasa a decisión de Protección antes de descontar PV
  const handleResolveDirectDamage = (
    targetCombatantId: string,
    manualTotal?: number,
    _damageReduction = 0,
    _damageDivisor: DamageDivisor = 1
  ) => {
    if (!pendingAttack) return;
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetChar) return;

    const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
    const targetEffects = getCombatantStatusEffects(targetCb, targetChar);
    const isAutoCrit = targetEffects.incomingAutoCrit;
    const critReason = targetEffects.incomingAutoCritReasons.join(', ');
    const autoRollRes =
      typeof manualTotal === 'number'
        ? null
        : rollSpellDamage(
            pendingAttack.spell,
            dmgKind,
            pendingAttack.isReinforced,
            isAutoCrit,
            critReason
          );
    const rawSummary: DamageRollSummary =
      typeof manualTotal === 'number'
        ? {
            parts: [],
            bonus: 0,
            total: Math.max(0, manualTotal),
            damageKind: dmgKind,
            isCriticalHit: isAutoCrit || undefined,
            criticalReason: isAutoCrit ? critReason : undefined,
            notes: pendingAttack.spell.damage.notes,
            isManual: true,
          }
        : autoRollRes!.summary;
    const reinforceNote = autoRollRes?.reinforceNote || '';

    setPendingAttack({
      ...pendingAttack,
      targetCombatantId,
      pendingDamage: {
        rawSummary,
        reinforceNote,
        source: 'direct_hit',
      },
    });
  };

  const handleRollDefense = (
    targetCombatantId: string,
    defenseChoice: string,
    manualDiceCount = 2,
    _damageReduction = 0,
    _damageDivisor: DamageDivisor = 1
  ) => {
    if (!pendingAttack) return;
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const defender = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!defender) return;

    const defenderEffects = getCombatantStatusEffects(targetCb, defender);
    if (defenderEffects.cannotDefend) {
      pushLog({
        kind: 'event',
        title: `${defender.name} no puede defenderse`,
        summaryText: `Impedido por estado activo: ${defenderEffects.cannotDefendReasons.join(', ')}. Usá impacto directo.`,
      });
      return;
    }

    let defenseRoll: ReturnType<typeof rollD6Pool>;
    let defenseLabel = '';
    let manaCost = 0;
    let defenseMasteryNote: string | undefined;

    let usedDefSpell: Spell | undefined;
    if (defenseChoice.startsWith('spell:')) {
      const spellId = defenseChoice.replace('spell:', '');
      const defSpell = spells.find((s) => s.id === spellId);
      if (!defSpell) return;
      if (defenderEffects.cannotCastMagic && isSpellMagical(defSpell)) {
        pushLog({
          kind: 'event',
          title: `${defender.name} está Silenciado`,
          summaryText: `No puede defender con hechizos mágicos (${defenderEffects.cannotCastMagicReasons.join(', ')}). Elegí una esquiva física.`,
        });
        return;
      }
      usedDefSpell = defSpell;
      const manaInfo = getEffectiveDefenseManaCost(
        defender,
        defSpell,
        defenderEffects.disarmed
      );
      manaCost = manaInfo.cost;
      const manaRes = applyManaCost(defender.id, manaCost);
      if (!manaRes.ok) {
        pushLog({
          kind: 'event',
          title: `${defender.name} sin maná para ${defSpell.name}`,
          summaryText: manaRes.note,
        });
        return;
      }
      const statsToRoll =
        defSpell.combatStats.length > 0 ? defSpell.combatStats : (['fisico'] as StatKey[]);
      const effectiveDefAssured = getEffectiveSpellAssured(defender, defSpell);
      defenseRoll = rollCombinedStats(
        defender,
        statsToRoll,
        formula,
        effectiveDefAssured,
        defenderEffects.autoFailsDefense,
        defenderEffects.autoFailsDefenseNotes
      );
      defenseMasteryNote = recordSpellMastery(defender.id, defSpell, defenseRoll.rolls);
      defenseLabel =
        manaInfo.discount > 0
          ? `${defSpell.name} (-${manaInfo.discount} maná ${manaInfo.shieldName})`
          : defSpell.name;
    } else if (defenseChoice.startsWith('stat:')) {
      const stat = defenseChoice.replace('stat:', '') as StatKey;
      const dice = getCharacterStatDice(defender, stat, formula);
      defenseRoll = rollD6Pool(
        dice,
        0,
        [{ stat, dice }],
        defenderEffects.autoFailsDefense,
        defenderEffects.autoFailsDefenseNotes
      );
      defenseLabel = `Defensa con ${STAT_NAMES[stat]}`;
    } else {
      defenseRoll = rollD6Pool(
        manualDiceCount,
        0,
        undefined,
        defenderEffects.autoFailsDefense,
        defenderEffects.autoFailsDefenseNotes
      );
      defenseLabel = `Defensa manual (${manualDiceCount}d6)`;
    }

    const atkNet = pendingAttack.attackRoll.net;
    const defNet = defenseRoll.net;
    const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);

    if (atkNet > defNet) {
      // Atacante supera al defensor -> tira el daño (si es automático) y espera decisión de Protección antes de descontar PV
      if (pendingAttack.spell.damageMode === 'auto') {
        const { summary: rawDmg, reinforceNote } = rollSpellDamage(
          pendingAttack.spell,
          dmgKind,
          pendingAttack.isReinforced,
          defenderEffects.incomingAutoCrit,
          defenderEffects.incomingAutoCritReasons.join(', ')
        );
        setPendingAttack({
          ...pendingAttack,
          targetCombatantId,
          defenseRoll: {
            defenderName: defender.name,
            defenseLabel,
            roll: defenseRoll,
            manaSpent: manaCost,
            outcome: 'attacker_wins',
          },
          pendingDamage: {
            rawSummary: rawDmg,
            reinforceNote,
            source: 'defense_fail',
            defenseLabel,
            defenseMasteryNote,
          },
        });
      } else {
        setPendingAttack({
          ...pendingAttack,
          targetCombatantId,
          defenseRoll: {
            defenderName: defender.name,
            defenseLabel,
            roll: defenseRoll,
            manaSpent: manaCost,
            outcome: 'attacker_wins',
          },
        });
      }
    } else if (atkNet === defNet) {
      // Empate (ataque == defensa): el ataque tiene éxito y habilita la tirada de verificación de daños
      setPendingAttack({
        ...pendingAttack,
        targetCombatantId,
        defenseRoll: {
          defenderName: defender.name,
          defenseLabel,
          roll: defenseRoll,
          manaSpent: manaCost,
          outcome: 'tie_verify_damage',
        },
      });
    } else {
      // Defensa supera al ataque -> daño no se efectúa
      let shieldHitsNote = '';
      if (targetCb && usedDefSpell && (usedDefSpell.maxHits ?? 0) > 0) {
        const existingShield = (targetCb.activeStatuses || []).find(
          (st) => st.name === usedDefSpell!.name && typeof st.remainingHits === 'number'
        );
        if (existingShield) {
          shieldHitsNote = consumeDefenderHitCharges(targetCb.id, existingShield.id);
        } else if ((usedDefSpell.maxHits || 0) > 1) {
          const parsedTurns = parseDurationTurns(usedDefSpell);
          const remHits = (usedDefSpell.maxHits || 1) - 1;
          const newShieldStatus: ActiveStatus = {
            id: generateId('st_'),
            name: usedDefSpell.name,
            kind: 'buff',
            sourceName: defender.name,
            roundApplied: round,
            duration:
              usedDefSpell.duration || (parsedTurns ? formatTurnDuration(parsedTurns) : 'Activo'),
            durationTurns: parsedTurns,
            remainingTurns: parsedTurns,
            maxHits: usedDefSpell.maxHits,
            remainingHits: remHits,
            effectDescription: usedDefSpell.effectDescription || undefined,
            isMagical: isSpellMagical(usedDefSpell),
          };
          setCombatants((prev) =>
            prev.map((cb) =>
              cb.id === targetCb.id
                ? { ...cb, activeStatuses: [...(cb.activeStatuses || []), newShieldStatus] }
                : cb
            )
          );
          shieldHitsNote = ` 🛡️ ${usedDefSpell.name} activo (${remHits}/${usedDefSpell.maxHits} golpes restantes).`;
        }
      }
      pushLog({
        kind: 'defense',
        title: `${defender.name} bloquea/esquiva con ${defenseLabel}`,
        isMagical: dmgKind === 'magico',
        attackRoll: pendingAttack.attackRoll,
        defenseRoll,
        masteryNote: defenseMasteryNote,
        clash: {
          attackerName: pendingAttack.attackerName,
          attackerAction: pendingAttack.spell.name,
          defenderName: defender.name,
          defenderAction: defenseLabel,
          outcome: 'defender_wins',
          damageKind: dmgKind,
          isLethal: pendingAttack.isLethal,
        },
        summaryText: `Defensa (${defNet}) supera a Ataque (${atkNet}). El daño no se efectúa.${shieldHitsNote}`,
      });
      advanceOrClearPendingAttack(pendingAttack, {
        combatantId: targetCb?.id || targetCombatantId,
        name: defender.name,
        outcome: 'blocked',
        damage: 0,
      });
    }
  };

  // Tira o registra el daño de verificación (empate o daño manual) y pasa a decisión de Protección
  const handleVerifyTieDamage = (
    manualTotal?: number,
    _damageReduction = 0,
    _damageDivisor: DamageDivisor = 1
  ) => {
    if (!pendingAttack || !pendingAttack.targetCombatantId) return;
    const targetCb = combatants.find((c) => c.id === pendingAttack.targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;

    const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
    const targetEffects = getCombatantStatusEffects(targetCb, targetChar);
    const autoRollRes =
      typeof manualTotal === 'number'
        ? null
        : rollSpellDamage(
            pendingAttack.spell,
            dmgKind,
            pendingAttack.isReinforced,
            targetEffects.incomingAutoCrit,
            targetEffects.incomingAutoCritReasons.join(', ')
          );
    const rawDmg: DamageRollSummary =
      typeof manualTotal === 'number'
        ? {
            parts: [],
            bonus: 0,
            total: Math.max(0, manualTotal),
            damageKind: dmgKind,
            isCriticalHit: targetEffects.incomingAutoCrit || undefined,
            criticalReason: targetEffects.incomingAutoCrit
              ? targetEffects.incomingAutoCritReasons.join(', ')
              : undefined,
            notes: pendingAttack.spell.damage.notes,
            isManual: true,
          }
        : autoRollRes!.summary;
    const reinforceNote = autoRollRes?.reinforceNote || '';

    setPendingAttack({
      ...pendingAttack,
      pendingDamage: {
        rawSummary: rawDmg,
        reinforceNote,
        source:
          pendingAttack.defenseRoll?.outcome === 'tie_verify_damage'
            ? 'tie_verify'
            : 'defense_fail',
        defenseLabel: pendingAttack.defenseRoll?.defenseLabel,
      },
    });
  };

  // Confirmación final del daño tras revisar el resultado tirado y decidir cuánta Protección usar
  const handleConfirmPendingDamage = (
    damageReduction = 0,
    damageDivisor: DamageDivisor = 1,
    protectionStacks = 0
  ) => {
    if (!pendingAttack || !pendingAttack.pendingDamage || !pendingAttack.targetCombatantId) return;
    const targetCb = combatants.find((c) => c.id === pendingAttack.targetCombatantId);
    const defender = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !defender) return;

    const { rawSummary, reinforceNote = '', source, defenseMasteryNote } =
      pendingAttack.pendingDamage;
    const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
    const defenderEffects = getCombatantStatusEffects(targetCb, defender);
    const safeStacks = Math.max(0, Math.floor(protectionStacks));
    if (safeStacks > 0 && (defenderEffects.cannotReact || defenderEffects.cannotCastMagic)) {
      pushLog({
        kind: 'event',
        title: `${defender.name} no puede usar Protección`,
        summaryText: defenderEffects.cannotReact
          ? `Capacidad de reaccionar = 0 (${defenderEffects.cannotReactReasons.join(', ')}).`
          : `Silenciado (${defenderEffects.cannotCastMagicReasons.join(', ')}).`,
      });
      return;
    }
    const protSummary = calcDirectProtectionSummary(
      defender,
      spells,
      dmgKind,
      safeStacks,
      defenderEffects.disarmed
    );

    let protManaNote: string | undefined;
    if (safeStacks > 0) {
      if (defender.condition !== 'active') {
        pushLog({
          kind: 'event',
          title: `${defender.name} no puede usar Protección`,
          summaryText: `Estado actual: ${conditionLabel(defender.condition)}.`,
        });
        return;
      }
      if (protSummary.manaCost > 0) {
        const manaRes = applyManaCost(defender.id, protSummary.manaCost);
        if (!manaRes.ok) {
          pushLog({
            kind: 'event',
            title: `${defender.name} sin maná para Protección ×${safeStacks}`,
            summaryText: manaRes.note,
          });
          return;
        }
        protManaNote =
          protSummary.firstStackDiscount > 0
            ? `${manaRes.note} (Protección ×${safeStacks}, -${protSummary.firstStackDiscount} por ${protSummary.shieldName})`
            : `${manaRes.note} (Protección ×${safeStacks})`;
      } else if (protSummary.firstStackDiscount > 0) {
        protManaNote = `Protección ×${safeStacks} (0 maná por ${protSummary.shieldName}).`;
      }
    }

    const totalReduction = Math.max(0, damageReduction) + protSummary.reduction;
    const dmg = applyDamageModifiers(rawSummary, totalReduction, damageDivisor);
    const elemRes = applyElementalStatusesAndSynergies(
      pendingAttack.spell,
      dmg,
      targetCb.id,
      defender.name,
      pendingAttack.attackerName,
      pendingAttack.attackerCharacterId,
      detectSpellSynergy(pendingAttack.spell) === 'overload_electrified' &&
        (pendingAttack.areaResolvedTargets || []).some(
          (resolved) => resolved.outcome === 'hit'
        )
    );
    const finalDmg: DamageRollSummary = {
      ...dmg,
      isFireDamage: elemRes.isFire,
      burnStacksApplied: elemRes.appliedBurnStacks > 0 ? elemRes.appliedBurnStacks : undefined,
      elementalStatusesApplied:
        elemRes.appliedStatuses.length > 0
          ? elemRes.appliedStatuses.map(
              (s) => `${ELEMENTAL_STATUS_META[s.kind].name} ×${s.stacks}`
            )
          : undefined,
    };

    if (finalDmg.total > 0) {
      adjustHp(defender.id, -finalDmg.total, pendingAttack.isLethal);
    }

    // Descuenta 1 golpe en armaduras/escudos/buffs con resistencia por golpes del defensor
    const armorHitsNote = consumeDefenderHitCharges(targetCb.id);

    // Retira automáticamente estados que duran "hasta recibir un golpe" (ej. Aturdir por defecto, retroceso de Empujar)
    const hitEndedStatuses = (targetCb.activeStatuses || []).filter((st) => st.endsOnHit);
    let hitEndedNote = '';
    if (hitEndedStatuses.length > 0) {
      const endedIds = new Set(hitEndedStatuses.map((st) => st.id));
      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === targetCb.id
            ? {
                ...cb,
                activeStatuses: (cb.activeStatuses || []).filter((st) => !endedIds.has(st.id)),
              }
            : cb
        )
      );
      hitEndedNote = ` 💫 Finaliza tras el golpe: ${hitEndedStatuses.map((s) => s.name).join(', ')}.`;
    }

    const resultingHp = Math.max(0, defender.hp.current - finalDmg.total);
    const zeroNote =
      finalDmg.total > 0 && resultingHp === 0
        ? pendingAttack.isLethal
          ? ` ${defender.name} queda Muerto (golpe letal).`
          : ` ${defender.name} queda Inconsciente a 0 PV (golpe no letal).`
        : '';

    const divNote =
      damageDivisor === 2
        ? ' (resistencia ÷2)'
        : damageDivisor === 4
          ? ' (resistencia ÷4)'
          : '';

    const protNote =
      safeStacks > 0
        ? ` 🛡️ Protección ×${safeStacks} (−${protSummary.reduction} daño ${
            dmgKind === 'magico' ? 'mágico' : 'físico'
          }).`
        : '';

    const atkNet = pendingAttack.attackRoll.net;
    const defRoll = pendingAttack.defenseRoll;

    if (defRoll) {
      const defNet = defRoll.roll.net;
      const isTie = source === 'tie_verify' && atkNet === defNet;
      pushLog({
        kind: 'defense',
        title: isTie
          ? `Empate (${atkNet} == ${defNet}): ${defender.name} (${defRoll.defenseLabel}) vs ${pendingAttack.spell.name}`
          : `${defender.name} defiende con ${defRoll.defenseLabel} vs ${pendingAttack.spell.name}`,
        isMagical: dmgKind === 'magico',
        attackRoll: pendingAttack.attackRoll,
        defenseRoll: defRoll.roll,
        damageRoll: finalDmg,
        manaNote: protManaNote,
        masteryNote: defenseMasteryNote,
        clash: {
          attackerName: pendingAttack.attackerName,
          attackerAction: pendingAttack.spell.name,
          defenderName: defender.name,
          defenderAction: defRoll.defenseLabel,
          outcome: 'attacker_wins',
          damageKind: dmgKind,
          isLethal: pendingAttack.isLethal,
        },
        summaryText:
          damageDivisor === 0 || (finalDmg.total === 0 && totalReduction > 0)
            ? `${
                isTie
                  ? `Empate (${atkNet} == ${defNet})`
                  : `Ataque (${atkNet}) supera a Defensa (${defNet})`
              }, pero el daño sobre ${defender.name} fue anulado/reducido a 0.${protNote}${armorHitsNote}${hitEndedNote}${elemRes.notes}${reinforceNote}`
            : `${
                isTie
                  ? `Empate (${atkNet} == ${defNet}): el ataque impacta.`
                  : `Ataque (${atkNet}) supera a Defensa (${defNet}).`
              } ${defender.name} recibe ${finalDmg.total} de daño${divNote}.${protNote}${armorHitsNote}${hitEndedNote}${zeroNote}${elemRes.notes}${reinforceNote}`,
      });
    } else {
      pushLog({
        kind: 'attack',
        title: `Impacto directo sobre ${defender.name}`,
        actorName: pendingAttack.attackerName,
        isMagical: dmgKind === 'magico',
        attackRoll: pendingAttack.attackRoll,
        damageRoll: finalDmg,
        manaNote: protManaNote,
        clash: {
          attackerName: pendingAttack.attackerName,
          attackerAction: pendingAttack.spell.name,
          defenderName: defender.name,
          defenderAction: 'Sin defensa',
          outcome: 'direct_hit',
          damageKind: dmgKind,
          isLethal: pendingAttack.isLethal,
        },
        summaryText:
          damageDivisor === 0 || (finalDmg.total === 0 && totalReduction > 0)
            ? `El daño sobre ${defender.name} fue anulado/reducido a 0 por resistencia o Protección.${protNote}${armorHitsNote}${hitEndedNote}${elemRes.notes}${reinforceNote}`
            : `${pendingAttack.attackerName} inflige ${finalDmg.total} de daño ${
                dmgKind === 'magico' ? 'mágico' : 'físico'
              }${divNote} a ${defender.name}.${protNote}${armorHitsNote}${hitEndedNote}${zeroNote}${elemRes.notes}${reinforceNote}`,
      });
    }

    const attackerChar = characters.find((c) => c.id === pendingAttack.attackerCharacterId);
    const pendingSpell = pendingAttack.spell;
    const hasMoreAreaTargets = Boolean(
      pendingAttack.areaTargetIds &&
        pendingAttack.areaTargetIds.some((id) => id !== targetCb.id)
    );

    advanceOrClearPendingAttack(pendingAttack, {
      combatantId: targetCb.id,
      name: defender.name,
      outcome: 'hit',
      damage: finalDmg.total,
    });

    if (
      !hasMoreAreaTargets &&
      pendingSpell.statuses &&
      pendingSpell.statuses.length > 0 &&
      attackerChar
    ) {
      triggerStatusCheck(pendingSpell, attackerChar, false, true);
    }
  };

  // Curación: no requiere tirada de casteo (solo tira los dados de curación si tiene)
  const handleHealSpell = (
    spell: Spell,
    isTest = false,
    casterCharacterId?: string,
    autoApplyTargetCharId?: string
  ) => {
    const healer = casterCharacterId
      ? characters.find((c) => c.id === casterCharacterId)
      : activeCharacter;
    if (!healer) return;
    if (!isTest && healer.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${healer.name} no puede curar`,
        summaryText: `Estado actual: ${conditionLabel(healer.condition)}.`,
      });
      return;
    }

    const depGate = checkSpellDependencyGate(spell, healer, isTest);
    if (!depGate.ok) return;

    const healerCombatant = combatants.find((c) => c.characterId === healer.id);
    if (!isTest && healerCombatant) {
      const healerEffects = getCombatantStatusEffects(healerCombatant, healer);
      if (healerEffects.cannotAct) {
        pushLog({
          kind: 'event',
          title: `${healer.name} no puede curar`,
          summaryText: `Impedido por estado activo: ${healerEffects.cannotActReasons.join(', ')}.`,
        });
        return;
      }
      if (healerEffects.cannotCastMagic && isSpellMagical(spell)) {
        pushLog({
          kind: 'event',
          title: `${healer.name} está Silenciado`,
          summaryText: `No puede lanzar curaciones mágicas mientras dure ${healerEffects.cannotCastMagicReasons.join(', ')}.`,
        });
        return;
      }
      const turnStatus = getCombatantTurnActionStatus(healerCombatant);
      if (turnStatus.remaining <= 0) {
        pushLog({
          kind: 'event',
          title: `Sin acciones restantes — ${healer.name}`,
          summaryText: `Ya usaste tus acciones este turno (${turnStatus.used}/${turnStatus.max}, no se descontó maná). Activá Hechizo Veloz o pasá el turno.`,
        });
        return;
      }
    }

    const manaRes = isTest
      ? { ok: true, note: 'Modo prueba (sin gasto de maná).' }
      : applyManaCost(healer.id, spell.manaCost);
    if (!manaRes.ok) {
      pushLog({ kind: 'event', title: 'Sin maná', summaryText: manaRes.note });
      return;
    }

    if (!isTest && healerCombatant) {
      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === healerCombatant.id
            ? { ...cb, attacksUsedThisTurn: (cb.attacksUsedThisTurn || 0) + 1 }
            : cb
        )
      );
    }

    let castRoll: ReturnType<typeof rollD6Pool> | undefined;
    let healMasteryNote: string | undefined;
    if (spell.castStat !== 'none') {
      const dice =
        spell.castStat === 'manual'
          ? spell.manualCastDice
          : getCharacterStatDice(healer, spell.castStat, formula);
      castRoll = rollD6Pool(dice, getEffectiveSpellAssured(healer, spell));
      if (!isTest) {
        healMasteryNote = recordSpellMastery(healer.id, spell, castRoll.rolls);
      }
    }

    const formulaText =
      spell.damage.dice.map((d) => `${d.count}${d.type}`).join(' + ') +
      (spell.damage.bonus ? ` + ${spell.damage.bonus}` : '');

    const depConsumeNote =
      !isTest && depGate.dep.hasDependency && depGate.dep.consumeOnUse && depGate.dep.match
        ? consumeSpellDependency(depGate.dep.match)
        : isTest && depGate.dep.hasDependency
          ? ` (Modo prueba: en combate requiere «${depGate.dep.requiredName}».)`
          : '';

    if (spell.damageMode === 'manual' && !autoApplyTargetCharId) {
      setPendingHeal({
        id: generateId('heal_'),
        healerName: healer.name,
        spellName: spell.name,
        amount: 0,
        isManual: true,
        formulaText: formulaText || 'curación manual',
      });
      pushLog({
        kind: 'heal',
        title: `${healer.name} lanza ${spell.name}`,
        isMagical: isSpellMagical(spell),
        castRoll,
        manaNote: manaRes.note,
        masteryNote: healMasteryNote,
        summaryText: `Resolución manual: tirá ${formulaText} y aplicá la curación en la mesa de combate.${depConsumeNote}`,
      });
      return;
    }

    const healRoll = rollDamageDice(
      spell.damage.dice.length > 0 ? spell.damage.dice : [{ type: 'd4', count: 1 }],
      spell.damage.bonus,
      spell.damage.notes
    );

    if (!isTest && autoApplyTargetCharId) {
      const healTarget = characters.find((c) => c.id === autoApplyTargetCharId);
      adjustHp(autoApplyTargetCharId, Math.max(0, healRoll.total), false);
      pushLog({
        kind: 'heal',
        title: `🤖 ${healer.name} lanza ${spell.name}`,
        isMagical: isSpellMagical(spell),
        castRoll,
        damageRoll: healRoll,
        manaNote: manaRes.note,
        masteryNote: healMasteryNote,
        summaryText: `${healTarget?.name || healer.name} recupera +${healRoll.total} PV automáticamente.${depConsumeNote}`,
      });
      return;
    }

    if (!isTest && combatants.length > 0) {
      setPendingHeal({
        id: generateId('heal_'),
        healerName: healer.name,
        spellName: spell.name,
        amount: healRoll.total,
        isManual: false,
        formulaText,
      });
    }

    pushLog({
      kind: 'heal',
      title: `${healer.name} lanza ${spell.name}`,
      isMagical: isSpellMagical(spell),
      castRoll,
      damageRoll: healRoll,
      manaNote: manaRes.note,
      masteryNote: healMasteryNote,
      summaryText: `Curación generada: +${healRoll.total} PV. Elegí el objetivo en combate para aplicarla.${depConsumeNote}`,
    });
  };

  const handleApplyHeal = (targetCharId: string, manualAmount?: number) => {
    if (!pendingHeal) return;
    const amount = typeof manualAmount === 'number' ? manualAmount : pendingHeal.amount;
    const target = characters.find((c) => c.id === targetCharId);
    if (!target) return;
    adjustHp(targetCharId, Math.max(0, amount), false);
    pushLog({
      kind: 'heal',
      title: `Curación aplicada a ${target.name}`,
      summaryText: `${target.name} recupera +${amount} PV.`,
    });
    setPendingHeal(null);
  };

  const handleDefendTestSpell = (spell: Spell, casterCharacterId?: string) => {
    const defender = casterCharacterId
      ? characters.find((c) => c.id === casterCharacterId)
      : activeCharacter;
    if (!defender) return;
    const statsToRoll =
      spell.combatStats.length > 0 ? spell.combatStats : (['fisico'] as StatKey[]);
    const defRoll = rollCombinedStats(
      defender,
      statsToRoll,
      formula,
      getEffectiveSpellAssured(defender, spell)
    );
    pushLog({
      kind: 'defense',
      title: `${defender.name} prueba defensa: ${spell.name}`,
      actorName: defender.name,
      isMagical: isSpellMagical(spell),
      defenseRoll: defRoll,
      clash: {
        defenderName: defender.name,
        defenderAction: spell.name,
        outcome: 'defense_test',
        damageKind: isSpellMagical(spell) ? 'magico' : 'fisico',
      },
      summaryText: `Resultado de defensa: neto ${defRoll.net > 0 ? `+${defRoll.net}` : defRoll.net}.`,
    });
  };

  // Estados alterados y Debuffs: SIEMPRE van por Influencia (Influencia del lanzador vs Influencia del objetivo)
  const triggerStatusCheck = (
    spell: Spell,
    caster: Character,
    isTest = false,
    skipMana = false,
    explicitTargetCombatantId?: string
  ) => {
    const effectSub = spell.effectType === 'effect' ? getEffectiveEffectSubType(spell) : 'status';
    const hasDispel = Boolean(spell.dispelConfig?.enabled);
    const hasElemental = Boolean(spell.elementalStatus);
    const hasSynergy = Boolean(spell.synergyReaction && spell.synergyReaction !== 'none');
    const statusLabels =
      spell.statuses && spell.statuses.length > 0
        ? spell.statuses
        : hasDispel
          ? [`Disipar (${DISPEL_SCOPE_LABELS[spell.dispelConfig!.scope]})`]
          : hasElemental
            ? [ELEMENTAL_STATUS_META[spell.elementalStatus!.kind].name]
            : hasSynergy
              ? [SYNERGY_LABELS[spell.synergyReaction!]]
              : effectSub === 'debuff'
                ? [spell.name]
                : [];
    if (statusLabels.length === 0) return;

    if (!isTest && !skipMana && caster.condition !== 'active') {
      pushLog({
        kind: 'event',
        title: `${caster.name} no puede actuar`,
        summaryText: `Estado actual: ${conditionLabel(caster.condition)}.`,
      });
      return;
    }

    const depGate = !skipMana
      ? checkSpellDependencyGate(spell, caster, isTest, explicitTargetCombatantId)
      : null;
    if (depGate && !depGate.ok) return;

    const casterCombatant = combatants.find((c) => c.characterId === caster.id);
    const casterEffectsForStatus = !isTest
      ? getCombatantStatusEffects(casterCombatant, caster)
      : null;
    if (!isTest && !skipMana && casterEffectsForStatus) {
      if (casterEffectsForStatus.cannotAct) {
        pushLog({
          kind: 'event',
          title: `${caster.name} no puede aplicar estados`,
          summaryText: `Impedido por estado activo: ${casterEffectsForStatus.cannotActReasons.join(', ')}.`,
        });
        return;
      }
      if (casterEffectsForStatus.cannotCastMagic && isSpellMagical(spell)) {
        pushLog({
          kind: 'event',
          title: `${caster.name} está Silenciado`,
          summaryText: `No puede lanzar hechizos mágicos mientras dure ${casterEffectsForStatus.cannotCastMagicReasons.join(', ')}.`,
        });
        return;
      }
    }
    const consumesStatusAction = !isTest && !skipMana && Boolean(casterCombatant);
    if (consumesStatusAction && casterCombatant) {
      const turnStatus = getCombatantTurnActionStatus(casterCombatant);
      if (turnStatus.remaining <= 0) {
        pushLog({
          kind: 'event',
          title: `Sin acciones restantes — ${caster.name}`,
          summaryText: `Ya usaste tus acciones este turno (${turnStatus.used}/${turnStatus.max}, no se descontó maná). Activá Hechizo Veloz o pasá el turno.`,
        });
        return;
      }
    }

    const manaRes =
      isTest || skipMana
        ? { ok: true, note: isTest ? 'Modo prueba (sin gasto de maná).' : '' }
        : applyManaCost(caster.id, spell.manaCost);

    if (!manaRes.ok) {
      pushLog({
        kind: 'event',
        title: `Sin maná para ${spell.name}`,
        summaryText: manaRes.note,
      });
      return;
    }

    if (consumesStatusAction && casterCombatant) {
      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === casterCombatant.id
            ? { ...cb, attacksUsedThisTurn: (cb.attacksUsedThisTurn || 0) + 1 }
            : cb
        )
      );
    }

    const desiredTargetId = explicitTargetCombatantId || selectedTargetId;
    const targetCb =
      combatants.find((cb) => cb.id === desiredTargetId && cb.characterId !== caster.id) ||
      combatants.find((cb) => cb.characterId !== caster.id);

    const depConsumeNote =
      !isTest &&
      !skipMana &&
      depGate?.dep.hasDependency &&
      depGate.dep.consumeOnUse &&
      depGate.dep.match
        ? consumeSpellDependency(depGate.dep.match)
        : isTest && depGate?.dep.hasDependency
          ? ` (Modo prueba: en combate requiere «${depGate.dep.requiredName}».)`
          : '';

    // Si es un hechizo de Disipación SIN chequeo de Influencia, se aplica directo sobre el objetivo
    if (
      !isTest &&
      targetCb &&
      hasDispel &&
      spell.dispelConfig &&
      spell.dispelConfig.requiresInfluenceCheck === false
    ) {
      const dispelRes = applyDispelToCombatant(targetCb.id, spell.dispelConfig, spell.name);
      pushLog({
        kind: 'cast',
        title: `🚫 ${caster.name} lanza ${spell.name} (Disipación directa)`,
        actorName: caster.name,
        isMagical: isSpellMagical(spell),
        manaNote: manaRes.note || undefined,
        summaryText: `${
          dispelRes.note.trim() || `${spell.name} aplicado sin resistencia.`
        }${depConsumeNote}`,
      });
      return;
    }

    const assuredForStatus =
      spell.effectType === 'effect' ? getEffectiveSpellAssured(caster, spell) : 0;
    const casterRoll = rollCombinedStats(
      caster,
      ['influencia'],
      formula,
      assuredForStatus,
      casterEffectsForStatus?.autoFailsInfluence || 0,
      casterEffectsForStatus?.autoFailsInfluenceNotes
    );
    const statusMasteryNote = !isTest
      ? recordSpellMastery(caster.id, spell, casterRoll.rolls)
      : undefined;

    const parsedTurns = parseDurationTurns(spell);

    if (!isTest && targetCb) {
      setPendingStatusCheck({
        id: generateId('stchk_'),
        casterCharacterId: caster.id,
        casterName: caster.name,
        targetCombatantId: targetCb.id,
        spellId: spell.id,
        spellName: spell.name,
        statuses: statusLabels,
        statusParams: spell.statusParams,
        kind: effectSub === 'debuff' ? 'debuff' : 'status',
        duration: spell.duration || (parsedTurns ? formatTurnDuration(parsedTurns) : '1 turno'),
        durationTurns: parsedTurns,
        effectDescription: spell.effectDescription || undefined,
        isMagical: isSpellMagical(spell),
        casterRoll,
        dispelConfig: spell.dispelConfig,
        elementalStatus: spell.elementalStatus,
        synergyReaction: spell.synergyReaction,
        synergyConsumeStacks: spell.synergyConsumeStacks,
      });
    }

    const formattedNet = casterRoll.net > 0 ? `+${casterRoll.net}` : `${casterRoll.net}`;
    pushLog({
      kind: 'cast',
      title: `${caster.name} intenta aplicar [${statusLabels.join(', ')}] con ${spell.name} (Influencia)`,
      actorName: caster.name,
      isMagical: isSpellMagical(spell),
      castRoll: casterRoll,
      manaNote: manaRes.note || undefined,
      masteryNote: statusMasteryNote,
      summaryText:
        !isTest && targetCb
          ? `Tirada de Influencia con neto ${formattedNet}. Elegí en la mesa de combate qué objetivo resiste con Influencia.${depConsumeNote}`
          : `Tirada de Influencia con neto ${formattedNet}.${depConsumeNote}`,
    });
  };

  const applyPendingStatusEffectsToTarget = (
    targetCombatantId: string,
    check: PendingStatusCheck
  ): string => {
    const notes: string[] = [];

    if (check.dispelConfig?.enabled) {
      const dispelRes = applyDispelToCombatant(
        targetCombatantId,
        check.dispelConfig,
        check.spellName
      );
      if (dispelRes.note) notes.push(dispelRes.note.trim());
    }

    if (check.elementalStatus) {
      const cfg = check.elementalStatus;
      const res = applyElementalStatusStacks(
        targetCombatantId,
        cfg.kind,
        cfg.stacks,
        cfg.durationTurns,
        cfg.tickDie,
        cfg.damageKind || ELEMENTAL_STATUS_META[cfg.kind].defaultDamageKind,
        check.casterName
      );
      notes.push(
        `${ELEMENTAL_STATUS_META[cfg.kind].name} (+${cfg.stacks} carga(s), total ${res.totalStacks}/${MAX_ELEMENTAL_STACKS} · ${res.maxRem}t).`
      );
    }

    if (check.synergyReaction && check.synergyReaction !== 'none') {
      const synRes = executeSynergyReaction(
        targetCombatantId,
        check.synergyReaction,
        check.casterCharacterId,
        check.spellName,
        check.synergyConsumeStacks
      );
      if (synRes.note) notes.push(synRes.note.trim());
    }

    // Agregar estados regulares si no es exclusivamente un disipador o estado elemental ya creado
    const regularLabels = check.statuses.filter((lbl) => {
      const lower = lbl.trim().toLowerCase();
      if (check.dispelConfig?.enabled && lower.startsWith('disipar')) return false;
      if (
        check.elementalStatus &&
        lower === ELEMENTAL_STATUS_META[check.elementalStatus.kind].name.toLowerCase()
      ) {
        return false;
      }
      return true;
    });

    if (regularLabels.length > 0 && !check.dispelConfig?.enabled) {
      const targetCbForMeta = combatants.find((c) => c.id === targetCombatantId);
      const targetCharForMeta = targetCbForMeta
        ? characters.find((c) => c.id === targetCbForMeta.characterId)
        : undefined;
      const newStatuses: ActiveStatus[] = [];
      const hasExplicitDerribar = regularLabels.some(
        (lbl) => normalizeCombatStatusKey(lbl) === 'derribar'
      );

      for (const stName of regularLabels) {
        const controlKey = normalizeCombatStatusKey(stName);
        const param = getSpellStatusParam({ statusParams: check.statusParams }, stName);
        const meta = controlKey ? COMBAT_STATUS_MECHANICS[controlKey] : undefined;

        if (controlKey === 'aturdir') {
          const untilHit = param?.untilHit ?? meta?.defaultUntilHit ?? true;
          newStatuses.push({
            id: generateId('st_'),
            name: stName,
            kind: check.kind || 'debuff',
            sourceName: check.spellName,
            sourceSpellId: check.spellId,
            roundApplied: round,
            duration: untilHit
              ? 'Hasta recibir 1 golpe'
              : check.duration || '1 turno',
            durationTurns: untilHit ? undefined : check.durationTurns,
            remainingTurns: untilHit ? undefined : check.durationTurns,
            endsOnHit: untilHit,
            effectDescription: check.effectDescription || meta?.shortRule,
            isMagical: check.isMagical,
          });
          notes.push(
            `Aturdir aplicado (Movilidad 0, Reacción 0, crítico automático entrante · ${
              untilHit ? 'hasta recibir 1 golpe' : check.duration || 'duración del hechizo'
            }).`
          );
        } else if (controlKey === 'empujar') {
          const proneFails = Math.max(1, Math.floor(param?.autoFails ?? 1));
          newStatuses.push({
            id: generateId('st_'),
            name: stName,
            kind: check.kind || 'debuff',
            sourceName: check.spellName,
            sourceSpellId: check.spellId,
            roundApplied: round,
            duration: 'Al impacto (sin defensa)',
            endsOnHit: true,
            effectDescription: 'Retrocede y pierde su defensa en el momento del impacto.',
            isMagical: check.isMagical,
          });
          if (!hasExplicitDerribar) {
            newStatuses.push({
              id: generateId('st_'),
              name: 'Derribar',
              kind: 'debuff',
              sourceName: `${check.spellName} (Empujar)`,
              sourceSpellId: check.spellId,
              roundApplied: round,
              duration: check.duration || 'Hasta levantarse',
              durationTurns: check.durationTurns,
              remainingTurns: check.durationTurns,
              autoFails: proneFails,
              effectDescription: COMBAT_STATUS_MECHANICS.derribar.shortRule,
              isMagical: check.isMagical,
            });
          }
          notes.push(
            `Empujar aplicado: retrocede (pierde su defensa al impacto) y cae Derribado (+${proneFails} fallo${
              proneFails > 1 ? 's' : ''
            } en ataque y defensa).`
          );
        } else if (controlKey && meta) {
          const fails = meta.supportsAutoFails
            ? Math.max(1, Math.floor(param?.autoFails ?? meta.defaultAutoFails ?? 1))
            : undefined;
          newStatuses.push({
            id: generateId('st_'),
            name: stName,
            kind: check.kind || 'debuff',
            sourceName: check.spellName,
            sourceSpellId: check.spellId,
            roundApplied: round,
            duration:
              controlKey === 'desarmar'
                ? 'Hasta recuperar (1 acción)'
                : check.duration || '1 turno',
            durationTurns: controlKey === 'desarmar' ? undefined : check.durationTurns,
            remainingTurns: controlKey === 'desarmar' ? undefined : check.durationTurns,
            autoFails: fails,
            effectDescription: check.effectDescription || meta.shortRule,
            isMagical: check.isMagical,
          });
          if (controlKey === 'cegar' && targetCharForMeta?.immuneToBlind) {
            notes.push(
              `Cegar aplicado, pero ${targetCharForMeta.name} es ciego / percibe por otros sentidos (inmune a los fallos automáticos).`
            );
          } else {
            notes.push(
              `${stName} aplicado (${meta.shortRule}${
                fails ? ` · +${fails} fallo${fails > 1 ? 's' : ''}` : ''
              }).`
            );
          }
        } else {
          newStatuses.push({
            id: generateId('st_'),
            name: stName,
            kind: check.kind || 'debuff',
            sourceName: check.spellName,
            sourceSpellId: check.spellId,
            roundApplied: round,
            duration: check.duration || '1 turno',
            durationTurns: check.durationTurns,
            remainingTurns: check.durationTurns,
            effectDescription: check.effectDescription,
            isMagical: check.isMagical,
          });
        }
      }

      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === targetCombatantId
            ? {
                ...cb,
                activeStatuses: [...(cb.activeStatuses || []), ...newStatuses],
              }
            : cb
        )
      );
    }

    return notes.join(' ');
  };

  const handleRollStatusResistance = (targetCombatantId: string) => {
    if (!pendingStatusCheck) return;
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetChar) return;

    const targetEffects = getCombatantStatusEffects(targetCb, targetChar);
    const targetRoll = rollCombinedStats(
      targetChar,
      ['influencia'],
      formula,
      0,
      targetEffects.autoFailsInfluence,
      targetEffects.autoFailsInfluenceNotes
    );
    const casterNet = pendingStatusCheck.casterRoll.net;
    const targetNet = targetRoll.net;
    const applied = casterNet >= targetNet;

    let extraNote = '';
    if (applied) {
      extraNote = applyPendingStatusEffectsToTarget(targetCombatantId, pendingStatusCheck);
    }

    pushLog({
      kind: 'defense',
      title: `${targetChar.name} resiste ${pendingStatusCheck.statuses.join(' / ')} con Influencia`,
      attackRoll: pendingStatusCheck.casterRoll,
      defenseRoll: targetRoll,
      summaryText: applied
        ? `Influencia del lanzador (${casterNet}) ≥ Influencia de ${targetChar.name} (${targetNet}). ${
            extraNote || `Se aplica: ${pendingStatusCheck.statuses.join(', ')}.`
          }`
        : `Influencia de ${targetChar.name} (${targetNet}) > Influencia del lanzador (${casterNet}). Efecto resistido.`,
    });

    setPendingStatusCheck(null);
  };

  const handleApplyStatusDirect = (targetCombatantId: string) => {
    if (!pendingStatusCheck) return;
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetChar) return;

    const extraNote = applyPendingStatusEffectsToTarget(targetCombatantId, pendingStatusCheck);

    pushLog({
      kind: 'event',
      title: `Efecto aplicado a ${targetChar.name}`,
      summaryText:
        extraNote ||
        `Se aplicó directamente [${pendingStatusCheck.statuses.join(', ')}] por ${pendingStatusCheck.spellName}.`,
    });

    setPendingStatusCheck(null);
  };

  const handleRemoveCombatantStatus = (combatantId: string, statusId: string) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    const removed = targetCb?.activeStatuses?.find((st) => st.id === statusId);

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).filter((st) => st.id !== statusId),
            }
          : cb
      )
    );

    if (removed) {
      pushLog({
        kind: 'event',
        title: `Cancelado / disipado: ${removed.name}${targetChar ? ` — ${targetChar.name}` : ''}`,
        actorName: targetChar?.name,
        isMagical: removed.isMagical,
        summaryText: `Se canceló manualmente «${removed.name}»${targetChar ? ` en ${targetChar.name}` : ''}.`,
      });
    }
  };

  const handleRecoverDisarmedWeapon = (combatantId: string) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;

    const effects = getCombatantStatusEffects(targetCb, targetChar);
    if (!effects.disarmed) return;

    if (effects.cannotAct) {
      pushLog({
        kind: 'event',
        title: `Acción bloqueada — ${targetChar.name}`,
        actorName: targetChar.name,
        summaryText: `${targetChar.name} no puede recuperar su arma o escudo (${effects.cannotActReasons.join(', ')}).`,
      });
      return;
    }

    const actionStatus = getCombatantTurnActionStatus(targetCb);
    if (actionStatus.remaining <= 0) {
      pushLog({
        kind: 'event',
        title: `Sin acciones disponibles — ${targetChar.name}`,
        actorName: targetChar.name,
        summaryText: `${targetChar.name} necesita gastar 1 acción en su turno para recuperar su arma o escudo (0/${actionStatus.max} acciones restantes).`,
      });
      return;
    }

    const disarmedIds = new Set(effects.disarmedStatusIds);
    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              attacksUsedThisTurn: (cb.attacksUsedThisTurn || 0) + 1,
              activeStatuses: (cb.activeStatuses || []).filter((st) => !disarmedIds.has(st.id)),
            }
          : cb
      )
    );

    pushLog({
      kind: 'event',
      title: `Recupera arma / escudo — ${targetChar.name}`,
      actorName: targetChar.name,
      summaryText: `${targetChar.name} gasta 1 acción de su turno para recuperar su arma o escudo. El estado Desarmar finaliza.`,
    });
  };

  const handleStandUpFromProne = (combatantId: string, statusId: string) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;

    const effects = getCombatantStatusEffects(targetCb, targetChar);
    if (effects.cannotAct || effects.mobility === 'zero') {
      pushLog({
        kind: 'event',
        title: `No puede levantarse — ${targetChar.name}`,
        actorName: targetChar.name,
        summaryText: `${targetChar.name} no puede incorporarse de Derribar mientras tiene movilidad 0 o está incapacitado.`,
      });
      return;
    }

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).filter((st) => st.id !== statusId),
            }
          : cb
      )
    );

    pushLog({
      kind: 'event',
      title: `Se levanta — ${targetChar.name}`,
      actorName: targetChar.name,
      summaryText: `${targetChar.name} se incorpora del suelo y finaliza el estado Derribar.`,
    });
  };

  const handleApplyManualStatus = (payload: ManualStatusPayload) => {
    const targetCb = combatants.find((c) => c.id === payload.targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;

    if (payload.mode === 'elemental' && payload.elementalKind) {
      const meta = ELEMENTAL_STATUS_META[payload.elementalKind];
      const stacks = Math.max(1, Math.min(MAX_ELEMENTAL_STACKS, payload.stacks || 1));
      const durationTurns = Math.max(1, payload.durationTurns || meta.defaultDuration);
      const tickDie = payload.tickDie === 'none' ? undefined : payload.tickDie ?? meta.defaultTickDie;
      const dmgKind = payload.damageKind || meta.defaultDamageKind;
      const res = applyElementalStatusStacks(
        targetCb.id,
        payload.elementalKind,
        stacks,
        durationTurns,
        tickDie,
        dmgKind,
        'Manual'
      );
      pushLog({
        kind: 'event',
        title: `Estado aplicado: ${meta.name} → ${targetChar.name}`,
        actorName: targetChar.name,
        isMagical: dmgKind === 'magico',
        summaryText: `Se aplicó manualmente ${meta.name} (+${stacks} carga(s), total ${res.totalStacks}/${MAX_ELEMENTAL_STACKS} · ${res.maxRem}t) en ${targetChar.name}.`,
      });
      return;
    }

    const toAdd: ActiveStatus[] = [];
    if (payload.mode === 'control' && payload.controlKey) {
      const cKey = payload.controlKey;
      const meta = COMBAT_STATUS_MECHANICS[cKey];
      if (cKey === 'aturdir') {
        const untilHit = payload.untilHit ?? true;
        const turns = untilHit ? undefined : Math.max(1, payload.durationTurns || 1);
        toAdd.push({
          id: generateId('st_'),
          name: meta.canonicalName,
          kind: 'status',
          sourceName: 'Manual',
          roundApplied: round,
          duration: untilHit ? 'Hasta recibir 1 golpe' : formatTurnDuration(turns || 1),
          durationTurns: turns,
          remainingTurns: turns,
          endsOnHit: untilHit,
          effectDescription: meta.detailedRule,
          isMagical: false,
        });
      } else if (cKey === 'desarmar') {
        toAdd.push({
          id: generateId('st_'),
          name: meta.canonicalName,
          kind: 'status',
          sourceName: 'Manual',
          roundApplied: round,
          duration: 'Hasta recuperar (1 acc.)',
          effectDescription: meta.detailedRule,
          isMagical: false,
        });
      } else if (cKey === 'empujar') {
        toAdd.push({
          id: generateId('st_'),
          name: meta.canonicalName,
          kind: 'status',
          sourceName: 'Manual',
          roundApplied: round,
          duration: 'Al impacto',
          endsOnHit: true,
          effectDescription: meta.detailedRule,
          isMagical: false,
        });
        if (payload.includeProneOnPush !== false) {
          const proneFails = Math.max(1, Math.min(6, payload.autoFails || 1));
          toAdd.push({
            id: generateId('st_'),
            name: COMBAT_STATUS_MECHANICS.derribar.canonicalName,
            kind: 'status',
            sourceName: 'Empujar (Manual)',
            roundApplied: round,
            duration: 'Hasta levantarse',
            autoFails: proneFails,
            effectDescription: COMBAT_STATUS_MECHANICS.derribar.detailedRule,
            isMagical: false,
          });
        }
      } else {
        const turns =
          typeof payload.durationTurns === 'number' && payload.durationTurns > 0
            ? payload.durationTurns
            : undefined;
        toAdd.push({
          id: generateId('st_'),
          name: meta.canonicalName,
          kind: 'status',
          sourceName: 'Manual',
          roundApplied: round,
          duration: turns ? formatTurnDuration(turns) : 'Hasta ser disipado',
          durationTurns: turns,
          remainingTurns: turns,
          autoFails: meta.supportsAutoFails
            ? Math.max(1, Math.min(6, payload.autoFails ?? meta.defaultAutoFails ?? 1))
            : undefined,
          effectDescription:
            cKey === 'cegar' && targetChar.immuneToBlind
              ? 'Sin efecto (personaje ciego / ve por otros sentidos).'
              : meta.detailedRule,
          isMagical: false,
        });
      }
    } else {
      const turns =
        typeof payload.durationTurns === 'number' && payload.durationTurns > 0
          ? payload.durationTurns
          : undefined;
      toAdd.push({
        id: generateId('st_'),
        name: payload.statusName.trim(),
        kind: payload.kind || 'status',
        sourceName: 'Manual',
        roundApplied: round,
        duration: turns ? formatTurnDuration(turns) : 'Hasta ser disipado',
        durationTurns: turns,
        remainingTurns: turns,
        effectDescription: payload.effectDescription,
        isMagical: payload.isMagical ?? true,
      });
    }

    if (toAdd.length === 0) return;
    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === targetCb.id
          ? { ...cb, activeStatuses: [...(cb.activeStatuses || []), ...toAdd] }
          : cb
      )
    );

    pushLog({
      kind: 'event',
      title: `Estado aplicado: ${toAdd.map((s) => s.name).join(' + ')} → ${targetChar.name}`,
      actorName: targetChar.name,
      summaryText: `Se aplicó manualmente [${toAdd.map((s) => s.name).join(', ')}] en ${targetChar.name}.`,
    });
  };

  const handleUpdateCombatantStatus = (
    combatantId: string,
    statusId: string,
    updates: Partial<Pick<ActiveStatus, 'autoFails' | 'endsOnHit' | 'remainingTurns' | 'duration'>>
  ) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    const existing = targetCb?.activeStatuses?.find((s) => s.id === statusId);
    if (!existing) return;

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).map((st) =>
                st.id === statusId ? { ...st, ...updates } : st
              ),
            }
          : cb
      )
    );

    pushLog({
      kind: 'event',
      title: `Estado ajustado: ${existing.name}${targetChar ? ` — ${targetChar.name}` : ''}`,
      actorName: targetChar?.name,
      summaryText: `Se actualizaron los parámetros de «${existing.name}»${targetChar ? ` en ${targetChar.name}` : ''}.`,
    });
  };

  const handleAdjustStatusTurns = (combatantId: string, statusId: string, delta: number) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    const st = targetCb?.activeStatuses?.find((s) => s.id === statusId);
    if (!st) return;

    const elemKind = getStatusElementalKind(st);
    const existingStacks = getStatusStackTurns(st);
    if (elemKind && existingStacks.length > 0) {
      const meta = ELEMENTAL_STATUS_META[elemKind];
      const nextStacks = existingStacks.map((t) => t + delta).filter((t) => t > 0);
      if (nextStacks.length === 0) {
        handleRemoveCombatantStatus(combatantId, statusId);
        return;
      }
      const maxRem = Math.max(...nextStacks);
      const tickDie = st.tickDie ?? meta.defaultTickDie;
      setCombatants((prev) =>
        prev.map((cb) =>
          cb.id === combatantId
            ? {
                ...cb,
                activeStatuses: (cb.activeStatuses || []).map((item) =>
                  item.id === statusId
                    ? {
                        ...item,
                        stackTurns: nextStacks,
                        burnStackTurns: elemKind === 'burn' ? nextStacks : undefined,
                        remainingTurns: maxRem,
                        duration: tickDie
                          ? `${nextStacks.length}${tickDie} · ${maxRem}t`
                          : `${nextStacks.length}c · ${maxRem}t`,
                        effectDescription: tickDie
                          ? `${meta.name}: ${nextStacks.length}/${MAX_ELEMENTAL_STACKS} cargas (${nextStacks.length}${tickDie} al inicio del turno).`
                          : `${meta.name}: ${nextStacks.length}/${MAX_ELEMENTAL_STACKS} carga(s) activas (${maxRem}t).`,
                      }
                    : item
                ),
              }
            : cb
        )
      );
      return;
    }

    const currentRem = typeof st.remainingTurns === 'number' ? st.remainingTurns : 1;
    const nextRem = currentRem + delta;

    if (nextRem <= 0) {
      handleRemoveCombatantStatus(combatantId, statusId);
      return;
    }

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).map((item) =>
                item.id === statusId
                  ? {
                      ...item,
                      remainingTurns: nextRem,
                      durationTurns: Math.max(item.durationTurns || nextRem, nextRem),
                    }
                  : item
              ),
            }
          : cb
      )
    );
  };

  const consumeDefenderHitCharges = (
    targetCombatantId: string,
    onlyStatusId?: string
  ): string => {
    const targetCb = combatants.find((c) => c.id === targetCombatantId);
    if (!targetCb || !targetCb.activeStatuses || targetCb.activeStatuses.length === 0) return '';

    const affected = targetCb.activeStatuses.filter(
      (st) =>
        (!onlyStatusId || st.id === onlyStatusId) &&
        typeof st.remainingHits === 'number' &&
        st.remainingHits > 0
    );
    if (affected.length === 0) return '';

    const notes: string[] = [];
    const affectedIds = new Set(affected.map((s) => s.id));
    for (const st of affected) {
      const maxH = st.maxHits || st.remainingHits || 1;
      const nextH = (st.remainingHits || 1) - 1;
      if (nextH <= 0) {
        notes.push(`💥 ${st.name} se rompió (0/${maxH} golpes).`);
      } else {
        notes.push(`🛡️ ${st.name}: ${nextH}/${maxH} golpes restantes.`);
      }
    }

    setCombatants((prev) =>
      prev.map((cb) => {
        if (cb.id !== targetCombatantId) return cb;
        const nextStatuses: ActiveStatus[] = [];
        for (const st of cb.activeStatuses || []) {
          if (affectedIds.has(st.id) && typeof st.remainingHits === 'number') {
            const nextH = st.remainingHits - 1;
            if (nextH > 0) {
              nextStatuses.push({ ...st, remainingHits: nextH });
            }
          } else {
            nextStatuses.push(st);
          }
        }
        return { ...cb, activeStatuses: nextStatuses };
      })
    );

    return notes.length > 0 ? ` ${notes.join(' ')}` : '';
  };

  const handleAdjustStatusHits = (
    combatantId: string,
    statusId: string,
    delta: number
  ) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    const st = targetCb?.activeStatuses?.find((s) => s.id === statusId);
    if (!targetCb || !st) return;

    const currentHits = typeof st.remainingHits === 'number' ? st.remainingHits : 1;
    const nextHits = currentHits + delta;

    if (nextHits <= 0) {
      handleRemoveCombatantStatus(combatantId, statusId);
      pushLog({
        kind: 'event',
        title: `Se rompió ${st.name}${targetChar ? ` en ${targetChar.name}` : ''}`,
        isMagical: st.isMagical,
        summaryText: `${st.name} llegó a 0 golpes restantes y se rompió/disipó.`,
      });
      return;
    }

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              activeStatuses: (cb.activeStatuses || []).map((item) =>
                item.id === statusId
                  ? {
                      ...item,
                      remainingHits: nextHits,
                      maxHits: Math.max(item.maxHits || nextHits, nextHits),
                    }
                  : item
              ),
            }
          : cb
      )
    );
  };

  const handleResetTurnActions = (combatantId: string) => {
    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId ? { ...cb, attacksUsedThisTurn: 0 } : cb
      )
    );
  };

  const handleAdjustStatusProtection = (
    combatantId: string,
    statusId: string,
    delta: number
  ) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;
    const maxStacks = getMaxAffordableProtectionStacks(targetChar, spells, manaMode);

    setCombatants((prev) =>
      prev.map((cb) => {
        if (cb.id !== combatantId) return cb;
        return {
          ...cb,
          activeStatuses: (cb.activeStatuses || []).map((st) => {
            if (st.id !== statusId) return st;
            const current = Math.max(0, st.pendingProtectionStacks || 0);
            const next = Math.max(0, Math.min(maxStacks, current + delta));
            return { ...st, pendingProtectionStacks: next };
          }),
        };
      })
    );
  };

  const resolveDirectProtectionSpend = (
    targetChar: Character,
    rawTotal: number,
    damageKind: DamageKind,
    requestedStacks: number,
    availableManaOverride?: number
  ): {
    appliedStacks: number;
    reduction: number;
    netDamage: number;
    manaSpent: number;
    manaNote?: string;
    protectionNote: string;
  } => {
    const wanted = Math.max(0, Math.floor(requestedStacks || 0));
    if (wanted === 0) {
      return {
        appliedStacks: 0,
        reduction: 0,
        netDamage: Math.max(0, rawTotal),
        manaSpent: 0,
        protectionNote: '',
      };
    }

    const currentMana =
      typeof availableManaOverride === 'number'
        ? availableManaOverride
        : targetChar.mana.current;
    const maxAffordable = getMaxAffordableProtectionStacks(
      targetChar,
      spells,
      manaMode,
      currentMana
    );
    const appliedStacks = Math.min(wanted, maxAffordable);
    if (appliedStacks <= 0) {
      return {
        appliedStacks: 0,
        reduction: 0,
        netDamage: Math.max(0, rawTotal),
        manaSpent: 0,
        protectionNote: ` Protección sin efecto por falta de maná (${currentMana} disponible).`,
      };
    }

    const summary = calcDirectProtectionSummary(
      targetChar,
      spells,
      damageKind,
      appliedStacks
    );
    const netDamage = Math.max(0, rawTotal - summary.reduction);

    let manaNote: string | undefined;
    let manaSpent = 0;
    if (summary.manaCost > 0) {
      if (manaMode === 'manual') {
        manaNote = `Modo manual: recordá descontar ${summary.manaCost} de maná por Protección ×${appliedStacks}.`;
      } else {
        manaSpent = summary.manaCost;
        adjustMana(targetChar.id, -summary.manaCost);
        const nextMana = Math.max(0, currentMana - summary.manaCost);
        const shieldNote =
          summary.firstStackDiscount > 0 && summary.shieldName
            ? ` (-${summary.firstStackDiscount} por ${summary.shieldName})`
            : '';
        manaNote =
          nextMana === 0
            ? `Protección ×${appliedStacks}: maná descontado (-${summary.manaCost} -> 0)${shieldNote}. ${targetChar.name} quedó Inconsciente por 0 maná.`
            : `Protección ×${appliedStacks}: -${summary.manaCost} maná (queda ${nextMana}/${targetChar.mana.max})${shieldNote}.`;
      }
    } else if (summary.firstStackDiscount > 0 && summary.shieldName) {
      manaNote = `Protección ×1 sin costo de maná (-${summary.firstStackDiscount} por ${summary.shieldName}).`;
    }

    const clampedHint =
      appliedStacks < wanted ? ` (ajustado a ×${appliedStacks} por maná disponible)` : '';
    const protectionNote = ` 🛡️ Protección ×${appliedStacks}${clampedHint} mitiga -${summary.reduction} (${rawTotal} → ${netDamage}).`;

    return {
      appliedStacks,
      reduction: summary.reduction,
      netDamage,
      manaSpent,
      manaNote,
      protectionNote,
    };
  };

  const handleApplyDirectDamageWithProtection = (params: {
    combatantId: string;
    amount: number;
    damageKind: DamageKind;
    lethal: boolean;
    label?: string;
    protectionStacks: number;
  }) => {
    const targetCb = combatants.find((c) => c.id === params.combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;

    const rawAmount = Math.max(0, Math.floor(params.amount || 0));
    if (rawAmount <= 0) return;

    const prot = resolveDirectProtectionSpend(
      targetChar,
      rawAmount,
      params.damageKind,
      params.protectionStacks
    );

    if (targetChar.hp.current > 0 && prot.netDamage > 0) {
      adjustHp(targetChar.id, -prot.netDamage, params.lethal);
    }

    const armorHitsNote = consumeDefenderHitCharges(targetCb.id);

    const resultingHp = Math.max(0, targetChar.hp.current - prot.netDamage);
    const zeroNote =
      targetChar.hp.current > 0 && resultingHp === 0
        ? params.lethal
          ? ` ${targetChar.name} llega a 0 PV y muere.`
          : ` ${targetChar.name} llega a 0 PV y queda inconsciente.`
        : '';

    const reasonLabel = params.label?.trim() || 'Daño directo';
    const dmgSummary: DamageRollSummary = {
      parts: [],
      bonus: 0,
      rawTotal: rawAmount,
      damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
      total: prot.netDamage,
      damageKind: params.damageKind,
      notes: prot.appliedStacks > 0 ? `${reasonLabel} · Protección ×${prot.appliedStacks}` : reasonLabel,
      isManual: true,
    };

    pushLog({
      kind: 'attack',
      title: `${reasonLabel} → ${targetChar.name} (${
        params.damageKind === 'magico' ? 'Mágico' : 'Físico'
      })`,
      actorName: targetChar.name,
      isMagical: params.damageKind === 'magico',
      damageRoll: dmgSummary,
      manaNote: prot.manaNote,
      summaryText: `${targetChar.name} recibe ${prot.netDamage} de daño (${
        params.damageKind === 'magico' ? 'mágico' : 'físico'
      }${params.lethal ? ', letal' : ', no letal'}).${prot.protectionNote}${armorHitsNote}${zeroNote}`,
    });
  };

  const handleTriggerElementalTurn = (combatantId: string, statusId: string) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    const st = targetCb?.activeStatuses?.find((s) => s.id === statusId);
    if (!targetCb || !targetChar || !st) return;

    const elemKind = getStatusElementalKind(st);
    const stacksArr = getStatusStackTurns(st);
    if (!elemKind || stacksArr.length === 0) return;

    const meta = ELEMENTAL_STATUS_META[elemKind];
    const stackCount = Math.min(MAX_ELEMENTAL_STACKS, stacksArr.length);
    const tickDie = st.tickDie ?? meta.defaultTickDie;
    const dmgKind: DamageKind = st.tickDamageKind || meta.defaultDamageKind;
    const nextStacks = stacksArr.map((t) => t - 1).filter((t) => t > 0);

    setCombatants((prev) =>
      prev.map((cb) => {
        if (cb.id !== combatantId) return cb;
        const statuses = cb.activeStatuses || [];
        if (nextStacks.length === 0) {
          return { ...cb, activeStatuses: statuses.filter((item) => item.id !== statusId) };
        }
        const maxRem = Math.max(...nextStacks);
        return {
          ...cb,
          activeStatuses: statuses.map((item) =>
            item.id === statusId
              ? {
                  ...item,
                  stackTurns: nextStacks,
                  burnStackTurns: elemKind === 'burn' ? nextStacks : undefined,
                  remainingTurns: maxRem,
                  pendingProtectionStacks: 0,
                  duration: tickDie
                    ? `${nextStacks.length}${tickDie} · ${maxRem}t`
                    : `${nextStacks.length}c · ${maxRem}t`,
                  effectDescription: tickDie
                    ? `${meta.name}: ${nextStacks.length}/${MAX_ELEMENTAL_STACKS} cargas (${nextStacks.length}${tickDie} al inicio del turno).`
                    : `${meta.name}: ${nextStacks.length}/${MAX_ELEMENTAL_STACKS} carga(s) activas (${maxRem}t).`,
                }
              : item
          ),
        };
      })
    );

    if (!tickDie) {
      pushLog({
        kind: 'event',
        title: `${meta.name} avanza turno — ${targetChar.name}`,
        isMagical: dmgKind === 'magico',
        summaryText:
          nextStacks.length === 0
            ? `${meta.name} se disipa en ${targetChar.name}.`
            : `${meta.name} en ${targetChar.name}: quedan ${nextStacks.length} carga(s).`,
      });
      return;
    }

    const elemRoll = rollDamageDice(
      [{ type: tickDie, count: stackCount }],
      0,
      `${meta.name.toLowerCase()} (${stackCount} carga${stackCount === 1 ? '' : 's'})`,
      dmgKind
    );

    const prot = resolveDirectProtectionSpend(
      targetChar,
      elemRoll.total,
      dmgKind,
      st.pendingProtectionStacks || 0
    );

    if (targetChar.hp.current > 0 && prot.netDamage > 0) {
      adjustHp(targetChar.id, -prot.netDamage, true);
    }

    const resultingHp = Math.max(0, targetChar.hp.current - prot.netDamage);
    const zeroNote =
      targetChar.hp.current > 0 && resultingHp === 0
        ? ` ${targetChar.name} cae a 0 PV por ${meta.name}.`
        : '';
    const remainNote =
      nextStacks.length === 0
        ? ` ${meta.name} se disipa al finalizar su duración.`
        : ` Quedan ${nextStacks.length} carga(s) (${nextStacks.length}${tickDie}) activas.`;
    const emoji = elemKind === 'burn' ? '🔥' : elemKind === 'poison' ? '☠️' : '🩸';

    pushLog({
      kind: 'attack',
      title: `${emoji} ${meta.name} al inicio de turno — ${targetChar.name} (${stackCount}${tickDie})`,
      isMagical: dmgKind === 'magico',
      manaNote: prot.manaNote,
      damageRoll: {
        ...elemRoll,
        rawTotal: elemRoll.total,
        damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
        total: prot.netDamage,
        isFireDamage: elemKind === 'burn',
      },
      summaryText: `${targetChar.name} sufre ${prot.netDamage} de daño por ${meta.name} (${stackCount} carga(s)).${prot.protectionNote}${zeroNote}${remainNote}`,
    });
  };

  const handleTriggerBurnTurn = handleTriggerElementalTurn;

  const rollCollateralSummary = (
    cfg: {
      mode: 'fixed' | 'dice';
      fixedAmount?: number;
      dice?: DamageDie[];
      bonus?: number;
      damageKind: DamageKind;
    },
    label: string
  ): DamageRollSummary => {
    if (cfg.mode === 'fixed') {
      const val = Math.max(0, Math.floor(cfg.fixedAmount || 0));
      return {
        parts: [],
        bonus: 0,
        rawTotal: val,
        total: val,
        damageKind: cfg.damageKind,
        notes: label || 'daño colateral',
        isManual: true,
      };
    }
    const diceList =
      cfg.dice && cfg.dice.length > 0 ? cfg.dice : [{ type: 'd4' as const, count: 1 }];
    return rollDamageDice(diceList, cfg.bonus || 0, label || 'daño colateral', cfg.damageKind);
  };

  const handleApplyCollateralDamage = (params: {
    targetCombatantId: string;
    label: string;
    mode: 'fixed' | 'dice';
    fixedAmount: number;
    dice: DamageDie[];
    bonus: number;
    damageKind: DamageKind;
    durationType: 'instant' | 'turns';
    durationTurns: number;
    applyInitialHitNow?: boolean;
    lethal?: boolean;
    protectionStacks?: number;
  }) => {
    const targetCb = combatants.find((c) => c.id === params.targetCombatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (!targetCb || !targetChar) return;

    const cleanLabel = params.label.trim() || 'Daño colateral';
    const isLethal = Boolean(params.lethal);
    const requestedProtection = Math.max(0, Math.floor(params.protectionStacks || 0));

    if (params.durationType === 'instant') {
      const rawRoll = rollCollateralSummary(params, cleanLabel);
      const prot = resolveDirectProtectionSpend(
        targetChar,
        rawRoll.total,
        params.damageKind,
        requestedProtection
      );
      if (targetChar.hp.current > 0 && prot.netDamage > 0) {
        adjustHp(targetChar.id, -prot.netDamage, isLethal);
      }
      const resultingHp = Math.max(0, targetChar.hp.current - prot.netDamage);
      const zeroNote =
        targetChar.hp.current > 0 && resultingHp === 0
          ? isLethal
            ? ` ${targetChar.name} llega a 0 PV y muere.`
            : ` ${targetChar.name} llega a 0 PV y queda inconsciente.`
          : '';
      const finalRoll: DamageRollSummary = {
        ...rawRoll,
        rawTotal: rawRoll.total,
        damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
        total: prot.netDamage,
      };
      pushLog({
        kind: 'attack',
        title: `Daño colateral: ${cleanLabel} → ${targetChar.name}`,
        isMagical: params.damageKind === 'magico',
        manaNote: prot.manaNote,
        damageRoll: finalRoll,
        summaryText: `${targetChar.name} recibe ${prot.netDamage} de daño colateral (${
          params.damageKind === 'magico' ? 'mágico' : 'físico'
        }) instantáneo.${prot.protectionNote}${zeroNote}`,
      });
      return;
    }

    const turns = Math.max(1, Math.floor(params.durationTurns || 1));
    let initialRoll: DamageRollSummary | undefined;
    let initialManaNote: string | undefined;
    let initialProtectionNote = '';
    if (params.applyInitialHitNow) {
      const rawInitial = rollCollateralSummary(params, `${cleanLabel} (impacto inicial)`);
      const prot = resolveDirectProtectionSpend(
        targetChar,
        rawInitial.total,
        params.damageKind,
        requestedProtection
      );
      if (targetChar.hp.current > 0 && prot.netDamage > 0) {
        adjustHp(targetChar.id, -prot.netDamage, isLethal);
      }
      initialRoll = {
        ...rawInitial,
        rawTotal: rawInitial.total,
        damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
        total: prot.netDamage,
      };
      initialManaNote = prot.manaNote;
      initialProtectionNote = prot.protectionNote;
    }

    const colStatus: ActiveStatus = {
      id: generateId('st_'),
      name: cleanLabel,
      kind: 'debuff',
      sourceName: activeCharacter?.name || 'Daño colateral',
      roundApplied: round,
      duration: `${formatCollateralValue(params)}/t · ${formatTurnDuration(turns)}`,
      durationTurns: turns,
      remainingTurns: turns,
      pendingProtectionStacks: 0,
      effectDescription: `Daño colateral por turno: ${formatCollateralValue(params)} (${
        params.damageKind === 'magico' ? 'Mágico' : 'Físico'
      }).`,
      isMagical: params.damageKind === 'magico',
      collateralConfig: {
        mode: params.mode,
        fixedAmount: params.mode === 'fixed' ? Math.max(0, params.fixedAmount) : undefined,
        dice: params.mode === 'dice' ? params.dice.map((d) => ({ ...d })) : undefined,
        bonus: params.mode === 'dice' ? params.bonus : 0,
        damageKind: params.damageKind,
        lethal: isLethal,
      },
    };

    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === targetCb.id
          ? { ...cb, activeStatuses: [...(cb.activeStatuses || []), colStatus] }
          : cb
      )
    );

    pushLog({
      kind: 'attack',
      title: `Daño colateral (${formatTurnDuration(turns)}): ${cleanLabel} → ${targetChar.name}`,
      isMagical: params.damageKind === 'magico',
      manaNote: initialManaNote,
      damageRoll: initialRoll,
      summaryText: initialRoll
        ? `${targetChar.name} sufre ${initialRoll.total} de impacto inicial${initialProtectionNote} y recibe «${cleanLabel}» (${formatCollateralValue(
            params
          )} al inicio de cada turno durante ${formatTurnDuration(turns)}).`
        : `Se aplica «${cleanLabel}» sobre ${targetChar.name}: ${formatCollateralValue(
            params
          )} al inicio de cada turno durante ${formatTurnDuration(turns)}.`,
    });
  };

  const handleTriggerCollateralTurn = (combatantId: string, statusId: string) => {
    const targetCb = combatants.find((c) => c.id === combatantId);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    const st = targetCb?.activeStatuses?.find((s) => s.id === statusId);
    if (!targetCb || !targetChar || !st || !st.collateralConfig) return;

    const colRoll = rollCollateralSummary(st.collateralConfig, st.name);
    const isLethal = Boolean(st.collateralConfig.lethal);
    const prot = resolveDirectProtectionSpend(
      targetChar,
      colRoll.total,
      st.collateralConfig.damageKind,
      st.pendingProtectionStacks || 0
    );

    if (targetChar.hp.current > 0 && prot.netDamage > 0) {
      adjustHp(targetChar.id, -prot.netDamage, isLethal);
    }

    const currentRem = typeof st.remainingTurns === 'number' ? st.remainingTurns : 1;
    const nextRem = currentRem - 1;

    setCombatants((prev) =>
      prev.map((cb) => {
        if (cb.id !== combatantId) return cb;
        const statuses = cb.activeStatuses || [];
        if (nextRem <= 0) {
          return { ...cb, activeStatuses: statuses.filter((item) => item.id !== statusId) };
        }
        return {
          ...cb,
          activeStatuses: statuses.map((item) =>
            item.id === statusId
              ? { ...item, remainingTurns: nextRem, pendingProtectionStacks: 0 }
              : item
          ),
        };
      })
    );

    const remainNote =
      nextRem <= 0
        ? ` «${st.name}» finaliza su duración y se disipa.`
        : ` Quedan ${formatTurnDuration(nextRem)}.`;

    pushLog({
      kind: 'attack',
      title: `Daño colateral (Inicio de turno): ${st.name} — ${targetChar.name}`,
      isMagical: st.collateralConfig.damageKind === 'magico',
      manaNote: prot.manaNote,
      damageRoll: {
        ...colRoll,
        rawTotal: colRoll.total,
        damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
        total: prot.netDamage,
      },
      summaryText: `${targetChar.name} sufre ${prot.netDamage} de daño por «${st.name}».${prot.protectionNote}${remainNote}`,
    });
  };

  const advanceRoundInternal = (delta: number, sourceCombatants: Combatant[]) => {
    if (delta <= 0) {
      setRound((r) => Math.max(1, r + delta));
      return;
    }

    const nextRound = round + delta;
    const dispelledNotes: string[] = [];
    const runningResources = new Map(
      characters.map((c) => [c.id, { hp: c.hp.current, mana: c.mana.current }])
    );

    const nextCombatants = sourceCombatants.map((cb) => {
      const targetChar = characters.find((c) => c.id === cb.characterId);
      const charName = targetChar?.name || 'Combatiente';

      const nextStatuses: ActiveStatus[] = [];
      for (const st of cb.activeStatuses || []) {
        const elemKind = getStatusElementalKind(st);
        const elemStacks = getStatusStackTurns(st);
        if (elemKind && elemStacks.length > 0) {
          const meta = ELEMENTAL_STATUS_META[elemKind];
          const stackCount = Math.min(MAX_ELEMENTAL_STACKS, elemStacks.length);
          const tickDie = st.tickDie ?? meta.defaultTickDie;
          const dmgKind: DamageKind = st.tickDamageKind || meta.defaultDamageKind;
          const nextStacks = elemStacks.map((t) => t - delta).filter((t) => t > 0);

          if (tickDie) {
            const elemRoll = rollDamageDice(
              [{ type: tickDie, count: stackCount }],
              0,
              `${meta.name.toLowerCase()} inicio de turno (${stackCount} carga${stackCount === 1 ? '' : 's'})`,
              dmgKind
            );

            const res = targetChar ? runningResources.get(targetChar.id) : undefined;
            const prot =
              targetChar && res
                ? resolveDirectProtectionSpend(
                    targetChar,
                    elemRoll.total,
                    dmgKind,
                    st.pendingProtectionStacks || 0,
                    res.mana
                  )
                : {
                    appliedStacks: 0,
                    reduction: 0,
                    netDamage: elemRoll.total,
                    manaSpent: 0,
                    manaNote: undefined,
                    protectionNote: '',
                  };

            if (res && prot.manaSpent > 0) {
              res.mana = Math.max(0, res.mana - prot.manaSpent);
            }
            if (targetChar && res && res.hp > 0 && prot.netDamage > 0) {
              adjustHp(targetChar.id, -prot.netDamage, true);
              res.hp = Math.max(0, res.hp - prot.netDamage);
            }

            const remainingNote =
              nextStacks.length === 0
                ? ' Todas las cargas cumplieron su duración y se disiparon.'
                : ` Quedan ${nextStacks.length} carga(s) (${nextStacks.length}${tickDie}) activas.`;
            const emoji = elemKind === 'burn' ? '🔥' : elemKind === 'poison' ? '☠️' : '🩸';

            pushLog({
              kind: 'attack',
              title: `${emoji} ${meta.name} (Ronda ${nextRound}) — ${charName} (${stackCount}${tickDie})`,
              isMagical: dmgKind === 'magico',
              manaNote: prot.manaNote,
              damageRoll: {
                ...elemRoll,
                rawTotal: elemRoll.total,
                damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
                total: prot.netDamage,
                isFireDamage: elemKind === 'burn',
              },
              summaryText:
                targetChar && targetChar.hp.current > 0
                  ? `${charName} recibe ${prot.netDamage} de daño por ${meta.name} al inicio de ronda.${prot.protectionNote}${remainingNote}`
                  : `${meta.name} se consume sobre ${charName}.${remainingNote}`,
            });
          }

          if (nextStacks.length > 0) {
            const maxRem = Math.max(...nextStacks);
            nextStatuses.push({
              ...st,
              stackTurns: nextStacks,
              burnStackTurns: elemKind === 'burn' ? nextStacks : undefined,
              remainingTurns: maxRem,
              pendingProtectionStacks: 0,
              duration: tickDie
                ? `${nextStacks.length}${tickDie} · ${maxRem}t`
                : `${nextStacks.length}c · ${maxRem}t`,
              effectDescription: tickDie
                ? `${meta.name}: ${nextStacks.length}/${MAX_ELEMENTAL_STACKS} cargas (${nextStacks.length}${tickDie} al inicio del turno).`
                : `${meta.name}: ${nextStacks.length}/${MAX_ELEMENTAL_STACKS} carga(s) activas (${maxRem}t).`,
            });
          } else {
            dispelledNotes.push(`${meta.name} (${charName})`);
          }
          continue;
        }

        if (st.collateralConfig) {
          const colRoll = rollCollateralSummary(st.collateralConfig, st.name);
          const isLethal = Boolean(st.collateralConfig.lethal);
          const res = targetChar ? runningResources.get(targetChar.id) : undefined;
          const prot =
            targetChar && res
              ? resolveDirectProtectionSpend(
                  targetChar,
                  colRoll.total,
                  st.collateralConfig.damageKind,
                  st.pendingProtectionStacks || 0,
                  res.mana
                )
              : {
                  appliedStacks: 0,
                  reduction: 0,
                  netDamage: colRoll.total,
                  manaSpent: 0,
                  manaNote: undefined,
                  protectionNote: '',
                };

          if (res && prot.manaSpent > 0) {
            res.mana = Math.max(0, res.mana - prot.manaSpent);
          }
          if (targetChar && res && res.hp > 0 && prot.netDamage > 0) {
            adjustHp(targetChar.id, -prot.netDamage, isLethal);
            res.hp = Math.max(0, res.hp - prot.netDamage);
          }

          const currentRem = typeof st.remainingTurns === 'number' ? st.remainingTurns : 1;
          const rem = currentRem - delta;
          const remNote =
            rem <= 0 ? ' Cumplió su duración y se disipó.' : ` Quedan ${formatTurnDuration(rem)}.`;

          pushLog({
            kind: 'attack',
            title: `Daño colateral (Ronda ${nextRound}): ${st.name} — ${charName}`,
            isMagical: st.collateralConfig.damageKind === 'magico',
            manaNote: prot.manaNote,
            damageRoll: {
              ...colRoll,
              rawTotal: colRoll.total,
              damageReduction: prot.reduction > 0 ? prot.reduction : undefined,
              total: prot.netDamage,
            },
            summaryText:
              targetChar && targetChar.hp.current > 0
                ? `${charName} sufre ${prot.netDamage} de daño colateral por «${st.name}».${prot.protectionNote}${remNote}`
                : `«${st.name}» avanza sobre ${charName}.${remNote}`,
          });

          if (rem > 0) {
            nextStatuses.push({ ...st, remainingTurns: rem, pendingProtectionStacks: 0 });
          } else {
            dispelledNotes.push(`${st.name} (${charName})`);
          }
          continue;
        }

        if (typeof st.remainingTurns === 'number') {
          const rem = st.remainingTurns - delta;
          if (rem <= 0) {
            dispelledNotes.push(`${st.name} (${charName})`);
          } else {
            nextStatuses.push({ ...st, remainingTurns: rem });
          }
        } else {
          nextStatuses.push(st);
        }
      }

      const nextPrepared: PreparedSpell[] = [];
      for (const prep of cb.preparedSpells || []) {
        if (typeof prep.remainingTurns === 'number') {
          const rem = prep.remainingTurns - delta;
          if (rem <= 0) {
            dispelledNotes.push(`${prep.spellName} preparado (${charName})`);
          } else {
            nextPrepared.push({ ...prep, remainingTurns: rem });
          }
        } else {
          nextPrepared.push(prep);
        }
      }

      return {
        ...cb,
        attacksUsedThisTurn: 0,
        actedThisRound: false,
        activeStatuses: nextStatuses,
        preparedSpells: nextPrepared,
      };
    });

    const sortedNext = sortCombatantsByInitiative(nextCombatants);
    const firstActive =
      sortedNext.find((cb) => {
        const ch = characters.find((c) => c.id === cb.characterId);
        return ch && ch.condition === 'active';
      }) || sortedNext[0];

    setRound(nextRound);
    setCombatants(nextCombatants);
    setAutoPassPaused(false);
    setAutoPassSecondsLeft(null);

    if (firstActive) {
      setCurrentTurnCombatantId(firstActive.id);
      setActiveCharacterId(firstActive.characterId);
      const firstChar = characters.find((c) => c.id === firstActive.characterId);
      pushLog({
        kind: 'event',
        title: `Ronda ${nextRound} · Turno de ${firstChar?.name || 'Combatiente'}`,
        summaryText:
          dispelledNotes.length > 0
            ? `Acciones reiniciadas y duraciones actualizadas. Se disiparon: ${dispelledNotes.join(', ')}.`
            : `Nueva ronda iniciada en orden de iniciativa (Ini ${firstActive.initiative}). Duraciones actualizadas y acciones listas.`,
      });
    } else if (dispelledNotes.length > 0) {
      pushLog({
        kind: 'event',
        title: `Ronda ${nextRound}: efectos disipados (${dispelledNotes.length})`,
        summaryText: `Cumplieron su duración y se disiparon: ${dispelledNotes.join(', ')}.`,
      });
    }
  };

  const handleChangeRound = (delta: number) => {
    advanceRoundInternal(delta, combatants);
  };

  const handleSelectTurnActor = (charId: string) => {
    setActiveCharacterId(charId);
    const matchingCb = combatants.find((cb) => cb.characterId === charId);
    if (matchingCb) {
      setCurrentTurnCombatantId(matchingCb.id);
      const status = getCombatantTurnActionStatus(matchingCb);
      // Si se selecciona manualmente a alguien sin acciones restantes, pausamos auto-pase para que no salte solo
      setAutoPassPaused(status.remaining <= 0);
      setAutoPassSecondsLeft(null);
    }
  };

  const handleAdvanceTurn = () => {
    if (sortedCombatants.length === 0) {
      advanceRoundInternal(1, combatants);
      return;
    }

    setAutoPassPaused(false);
    setAutoPassSecondsLeft(null);

    const currIdx = sortedCombatants.findIndex(
      (cb) => cb.id === resolvedCurrentTurnCombatantId
    );
    const currCb = currIdx >= 0 ? sortedCombatants[currIdx] : sortedCombatants[0];

    // Marcamos al actor saliente como que ya actuó en esta ronda y limpiamos sus potenciadores de 1 turno
    const markedCombatants = combatants.map((cb) => {
      if (!currCb || cb.id !== currCb.id) return cb;
      return {
        ...cb,
        actedThisRound: true,
        activeStatuses: (cb.activeStatuses || []).filter(
          (st) => st.name !== 'Hechizo Veloz' && st.name !== 'Elevar el Límite'
        ),
      };
    });

    const sortedMarked = sortCombatantsByInitiative(markedCombatants);
    const markedCurrIdx = currCb
      ? sortedMarked.findIndex((cb) => cb.id === currCb.id)
      : -1;

    // Buscamos el siguiente combatiente activo en la cola de iniciativa que aún no haya actuado en esta ronda
    let nextCb: Combatant | undefined;
    for (let offset = 1; offset <= sortedMarked.length; offset++) {
      const candidate = sortedMarked[(markedCurrIdx + offset) % sortedMarked.length];
      if (!candidate || candidate.id === currCb?.id) continue;
      if (candidate.actedThisRound) continue;
      const ch = characters.find((c) => c.id === candidate.characterId);
      if (ch && ch.condition === 'active') {
        nextCb = candidate;
        break;
      }
    }

    if (nextCb) {
      const nextChar = characters.find((c) => c.id === nextCb.characterId);
      setCombatants(markedCombatants);
      setCurrentTurnCombatantId(nextCb.id);
      setActiveCharacterId(nextCb.characterId);
      pushLog({
        kind: 'event',
        title: `Turno de ${nextChar?.name || 'Combatiente'} (Ronda ${round})`,
        summaryText: `Orden de iniciativa: Ini ${nextCb.initiative}. Acciones disponibles: ${
          getCombatantTurnActionStatus(nextCb).remaining
        }/${getCombatantTurnActionStatus(nextCb).max}.`,
      });
    } else {
      // Todos los combatientes activos ya actuaron en esta ronda -> avanza a Ronda + 1
      advanceRoundInternal(1, markedCombatants);
    }
  };

  const advanceTurnRef = useRef(handleAdvanceTurn);
  advanceTurnRef.current = handleAdvanceTurn;

  const hasPendingCombatResolution = Boolean(
    pendingAttack || pendingHeal || pendingStatusCheck || pendingCounterspell
  );
  const currentTurnCombatant = combatants.find(
    (cb) => cb.id === resolvedCurrentTurnCombatantId
  );
  const currentTurnChar = currentTurnCombatant
    ? characters.find((c) => c.id === currentTurnCombatant.characterId)
    : undefined;
  const currentTurnStatus = getCombatantTurnActionStatus(currentTurnCombatant);
  const currentTurnCanExtend = Boolean(
    currentTurnChar &&
      currentTurnChar.condition === 'active' &&
      currentTurnChar.mana.max > 0 &&
      ((!currentTurnStatus.hasHechizoVeloz &&
        (manaMode === 'manual' || currentTurnChar.mana.current >= 3)) ||
        (currentTurnStatus.canActivateElevarLimite &&
          (manaMode === 'manual' || currentTurnChar.mana.current >= 5)))
  );

  const botCombatantsInArena = combatants.filter((cb) => cb.isBotControlled);
  const playerCombatantsInArena = combatants.filter((cb) => !cb.isBotControlled);
  const hasBotModeActive = botCombatantsInArena.length > 0;
  const aliveBotsCount = botCombatantsInArena.filter((cb) => {
    const ch = characters.find((c) => c.id === cb.characterId);
    return Boolean(ch && ch.condition === 'active');
  }).length;
  const alivePlayersCount = playerCombatantsInArena.filter((cb) => {
    const ch = characters.find((c) => c.id === cb.characterId);
    return Boolean(ch && ch.condition === 'active');
  }).length;
  const botBattleOutcome: 'victory' | 'defeat' | null =
    hasBotModeActive && playerCombatantsInArena.length > 0
      ? aliveBotsCount === 0
        ? 'victory'
        : alivePlayersCount === 0
          ? 'defeat'
          : null
      : null;

  const shouldArmAutoPass = Boolean(
    (autoPassTurn || currentTurnCombatant?.isBotControlled) &&
      (!autoPassPaused || currentTurnCombatant?.isBotControlled) &&
      !botBattleOutcome &&
      combatants.length > 0 &&
      currentTurnCombatant &&
      currentTurnChar &&
      currentTurnChar.condition === 'active' &&
      currentTurnStatus.remaining === 0 &&
      !hasPendingCombatResolution
  );

  useEffect(() => {
    if (!shouldArmAutoPass) {
      setAutoPassSecondsLeft(null);
      return;
    }

    const totalSeconds = currentTurnCombatant?.isBotControlled
      ? 1
      : currentTurnCanExtend
        ? 4
        : 2;
    setAutoPassSecondsLeft(totalSeconds);

    let remaining = totalSeconds;
    const intervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(intervalId);
        setAutoPassSecondsLeft(null);
        advanceTurnRef.current();
      } else {
        setAutoPassSecondsLeft(remaining);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    shouldArmAutoPass,
    currentTurnCanExtend,
    currentTurnCombatant?.isBotControlled,
    resolvedCurrentTurnCombatantId,
    round,
    currentTurnStatus.used,
  ]);

  // --- Motor táctico de Combate contra la máquina (100% determinista, sin LLM) ---
  const handleStartBotPractice = (params: {
    playerCharId: string;
    presetCounts: Record<string, number>;
    existingEnemyCharIds: string[];
    difficulty: BotDifficulty;
    playerGoesFirst: boolean;
  }) => {
    const { playerCharId, presetCounts, existingEnemyCharIds, difficulty, playerGoesFirst } = params;
    const playerChar = characters.find((c) => c.id === playerCharId) || activeCharacter;
    if (!playerChar) return;

    const spawnedBots: Array<{ char: Character; baseInit: number }> = [];
    for (const preset of BOT_ENEMY_PRESETS) {
      const count = Math.max(0, Math.min(4, Math.floor(presetCounts[preset.id] || 0)));
      for (let i = 1; i <= count; i++) {
        spawnedBots.push({
          char: createBotCharacterFromPreset(preset, count > 1 ? i : 1),
          baseInit: preset.baseInitiative,
        });
      }
    }

    const existingEnemies = existingEnemyCharIds
      .filter((id) => id !== playerChar.id)
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is Character => Boolean(c));

    if (spawnedBots.length === 0 && existingEnemies.length === 0) return;

    // Limpia bots temporales previos y restaura al jugador/enemigos existentes si estaban caídos
    const cleanedExistingChars = characters
      .filter((c) => !c.isBotPreset)
      .map((c) => {
        if (
          (c.id === playerChar.id || existingEnemyCharIds.includes(c.id)) &&
          c.condition !== 'active'
        ) {
          return {
            ...c,
            hp: { ...c.hp, current: c.hp.max },
            mana: { ...c.mana, current: c.mana.max },
            condition: 'active' as const,
          };
        }
        return c;
      });

    const nextChars = [...cleanedExistingChars, ...spawnedBots.map((b) => b.char)];
    setCharacters(nextChars);

    const allBotEntries: Array<{ char: Character; baseInit: number }> = [
      ...spawnedBots,
      ...existingEnemies.map((ch) => ({ char: ch, baseInit: 3 })),
    ];

    const maxEnemyBaseInit = Math.max(...allBotEntries.map((e) => e.baseInit), 4);
    const playerInit = playerGoesFirst ? maxEnemyBaseInit + 2 : 5;

    const playerCb: Combatant = {
      id: generateId('cb_'),
      characterId: playerChar.id,
      initiative: playerInit,
      preparedSpells: [],
      activeStatuses: [],
      attacksUsedThisTurn: 0,
      actedThisRound: false,
      isBotControlled: false,
    };

    const botCbs: Combatant[] = allBotEntries.map((entry, idx) => ({
      id: generateId('cb_'),
      characterId: entry.char.id,
      initiative: playerGoesFirst
        ? Math.max(1, playerInit - 2 - idx)
        : entry.baseInit,
      preparedSpells: [],
      activeStatuses: [],
      attacksUsedThisTurn: 0,
      actedThisRound: false,
      isBotControlled: true,
      botDifficulty: difficulty,
    }));

    const nextCombatants = [playerCb, ...botCbs];
    const firstTurnCb = sortCombatantsByInitiative(nextCombatants)[0];

    setCombatants(nextCombatants);
    setRound(1);
    setAutoPassTurn(true);
    setAutoPassPaused(false);
    setAutoPassSecondsLeft(null);
    setPendingAttack(null);
    setPendingCounterspell(null);
    setPendingStatusCheck(null);
    setPendingHeal(null);
    setCurrentTurnCombatantId(firstTurnCb.id);
    setActiveCharacterId(firstTurnCb.characterId);
    setSelectedTargetId(botCbs[0].id);

    pushLog({
      kind: 'event',
      title: `🤖 Práctica vs Máquina iniciada (${botCbs.length} enemigo${botCbs.length === 1 ? '' : 's'})`,
      summaryText: `${playerChar.name} vs ${allBotEntries.map((e) => e.char.name).join(', ')} · Dificultad: ${
        difficulty === 'tactical' ? 'Táctica' : 'Normal'
      }. ${
        playerGoesFirst
          ? 'Tu personaje actúa primero y los enemigos responden automáticamente en su turno.'
          : 'Orden natural por iniciativa.'
      }`,
    });
  };

  const handleRematchBotPractice = () => {
    const combatantCharIds = new Set(combatants.map((cb) => cb.characterId));
    setCharacters((prev) =>
      prev.map((c) =>
        combatantCharIds.has(c.id)
          ? {
              ...c,
              hp: { ...c.hp, current: c.hp.max },
              mana: { ...c.mana, current: c.mana.max },
              condition: 'active',
            }
          : c
      )
    );
    const resetCombatants = combatants.map((cb) => ({
      ...cb,
      preparedSpells: [],
      activeStatuses: [],
      attacksUsedThisTurn: 0,
      actedThisRound: false,
    }));
    const firstTurn = sortCombatantsByInitiative(resetCombatants)[0];
    setCombatants(resetCombatants);
    setRound(1);
    setAutoPassPaused(false);
    setAutoPassSecondsLeft(null);
    setPendingAttack(null);
    setPendingCounterspell(null);
    setPendingStatusCheck(null);
    setPendingHeal(null);
    if (firstTurn) {
      setCurrentTurnCombatantId(firstTurn.id);
      setActiveCharacterId(firstTurn.characterId);
    }
    pushLog({
      kind: 'event',
      title: '🤖 Revancha de práctica iniciada',
      summaryText: 'PV, Maná, rondas y estados restaurados al máximo para volver a practicar.',
    });
  };

  const handleEndBotPractice = () => {
    const remainingChars = characters.filter((c) => !c.isBotPreset);
    const remainingIds = new Set(remainingChars.map((c) => c.id));
    const remainingCombatants = combatants
      .filter((cb) => !cb.isBotControlled && remainingIds.has(cb.characterId))
      .map((cb) => ({
        ...cb,
        attacksUsedThisTurn: 0,
        actedThisRound: false,
      }));
    setCharacters(remainingChars);
    setCombatants(remainingCombatants);
    setRound(1);
    setAutoPassPaused(false);
    setAutoPassSecondsLeft(null);
    setPendingAttack(null);
    setPendingCounterspell(null);
    setPendingStatusCheck(null);
    setPendingHeal(null);
    const nextActorId =
      remainingCombatants[0]?.characterId || remainingChars[0]?.id || '';
    if (nextActorId) setActiveCharacterId(nextActorId);
    setCurrentTurnCombatantId(remainingCombatants[0]?.id || '');
    pushLog({
      kind: 'event',
      title: 'Práctica vs Máquina finalizada',
      summaryText: 'Se retiraron los enemigos controlados por la máquina y se limpió la mesa.',
    });
  };

  const handleToggleCombatantBot = (combatantId: string) => {
    setCombatants((prev) =>
      prev.map((cb) =>
        cb.id === combatantId
          ? {
              ...cb,
              isBotControlled: !cb.isBotControlled,
              botDifficulty: cb.botDifficulty || 'normal',
            }
          : cb
      )
    );
  };

  const executeBotTurnStep = () => {
    if (!currentTurnCombatant || !currentTurnChar || !currentTurnCombatant.isBotControlled) return;
    if (currentTurnChar.condition !== 'active' || botBattleOutcome) return;

    const decision = chooseBotTurnAction({
      botCombatant: currentTurnCombatant,
      botChar: currentTurnChar,
      allCombatants: combatants,
      allCharacters: characters,
      spells,
      formula,
      manaMode,
      difficulty: currentTurnCombatant.botDifficulty || 'normal',
    });

    if (decision.type === 'heal') {
      handleHealSpell(decision.spell, false, currentTurnChar.id, decision.targetCharacterId);
    } else if (decision.type === 'recover_weapon') {
      handleRecoverDisarmedWeapon(currentTurnCombatant.id);
    } else if (decision.type === 'attack_prepared') {
      handleAttackWithPrepared(
        currentTurnCombatant.id,
        decision.prepared,
        decision.targetCombatantId
      );
    } else if (decision.type === 'cast_buff' || decision.type === 'cast_prepare') {
      handleCastSpell(decision.spell, false, currentTurnChar.id);
    } else if (decision.type === 'apply_status') {
      triggerStatusCheck(decision.spell, currentTurnChar, false, false, decision.targetCombatantId);
    } else if (decision.type === 'attack_spell') {
      handleAttackFromSpell(decision.spell, currentTurnChar.id, decision.targetCombatantId);
    } else if (decision.type === 'attack_weapon') {
      handleAttackWithWeapon(
        decision.weapon,
        decision.attackStat,
        currentTurnChar.id,
        decision.targetCombatantId
      );
    } else {
      handleAdvanceTurn();
    }
  };

  const executeBotTurnRef = useRef(executeBotTurnStep);
  executeBotTurnRef.current = executeBotTurnStep;

  const shouldBotActNow = Boolean(
    currentTurnCombatant?.isBotControlled &&
      currentTurnChar?.condition === 'active' &&
      currentTurnStatus.remaining > 0 &&
      !hasPendingCombatResolution &&
      !botBattleOutcome
  );

  useEffect(() => {
    if (!shouldBotActNow) return;
    const timer = window.setTimeout(() => {
      executeBotTurnRef.current();
    }, 850);
    return () => window.clearTimeout(timer);
  }, [
    shouldBotActNow,
    resolvedCurrentTurnCombatantId,
    round,
    currentTurnStatus.used,
  ]);

  const executeBotDefenseStep = () => {
    if (!pendingAttack || pendingAttack.resolved || !pendingAttack.targetCombatantId) return;
    const targetCb = combatants.find((cb) => cb.id === pendingAttack.targetCombatantId);
    if (!targetCb?.isBotControlled) return;
    const defenderChar = characters.find((c) => c.id === targetCb.characterId);
    if (!defenderChar) return;
    const difficulty: BotDifficulty = targetCb.botDifficulty || 'normal';
    const defenderEffects = getCombatantStatusEffects(targetCb, defenderChar);

    if (!pendingAttack.defenseRoll && !pendingAttack.pendingDamage) {
      if (defenderChar.condition !== 'active' || defenderEffects.cannotDefend) {
        handleResolveDirectDamage(targetCb.id);
        return;
      }
      const defChoice = chooseBotDefenseChoice({
        defenderChar,
        defenderCombatant: targetCb,
        spells,
        formula,
        manaMode,
        difficulty,
      });
      handleRollDefense(targetCb.id, defChoice);
      return;
    }

    if (
      pendingAttack.defenseRoll?.outcome === 'tie_verify_damage' &&
      !pendingAttack.pendingDamage
    ) {
      handleVerifyTieDamage();
      return;
    }

    if (pendingAttack.pendingDamage) {
      const armor = getBotArmorModifiers(targetCb);
      const dmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
      const protStacks = chooseBotProtectionStacks({
        defenderChar,
        defenderCombatant: targetCb,
        spells,
        rawDamage: pendingAttack.pendingDamage.rawSummary.total,
        armorReduction: armor.reduction,
        damageKind: dmgKind,
        manaMode,
        difficulty,
      });
      handleConfirmPendingDamage(armor.reduction, armor.divisor, protStacks);
    }
  };

  const executeBotDefenseRef = useRef(executeBotDefenseStep);
  executeBotDefenseRef.current = executeBotDefenseStep;

  const pendingAttackTargetCb = pendingAttack?.targetCombatantId
    ? combatants.find((cb) => cb.id === pendingAttack.targetCombatantId)
    : undefined;
  const shouldBotDefendNow = Boolean(
    pendingAttack && !pendingAttack.resolved && pendingAttackTargetCb?.isBotControlled
  );

  useEffect(() => {
    if (!shouldBotDefendNow) return;
    const timer = window.setTimeout(() => {
      executeBotDefenseRef.current();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    shouldBotDefendNow,
    pendingAttack?.id,
    pendingAttack?.defenseRoll?.outcome,
    Boolean(pendingAttack?.pendingDamage),
  ]);

  const executeBotStatusResistRef = useRef((targetId: string) => {
    handleRollStatusResistance(targetId);
  });
  executeBotStatusResistRef.current = (targetId: string) => {
    handleRollStatusResistance(targetId);
  };

  const pendingStatusTargetCb = pendingStatusCheck?.targetCombatantId
    ? combatants.find((cb) => cb.id === pendingStatusCheck.targetCombatantId)
    : undefined;
  const shouldBotResistStatusNow = Boolean(
    pendingStatusCheck && pendingStatusTargetCb?.isBotControlled
  );

  useEffect(() => {
    if (!shouldBotResistStatusNow || !pendingStatusCheck) return;
    const targetId = pendingStatusCheck.targetCombatantId;
    const timer = window.setTimeout(() => {
      executeBotStatusResistRef.current(targetId);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [shouldBotResistStatusNow, pendingStatusCheck?.id]);

  const handleTestSpell = (spell: Spell) => {
    if (!activeCharacter) return;
    if (spell.effectType === 'heal') handleHealSpell(spell, true);
    else if (spell.effectType === 'defense') handleDefendTestSpell(spell);
    else if (spell.effectType === 'damage') executeAttack(spell, activeCharacter, undefined, true);
    else if (
      (spell.statuses && spell.statuses.length > 0) ||
      getEffectiveEffectSubType(spell) === 'debuff'
    )
      triggerStatusCheck(spell, activeCharacter, true, true);
    else handleCastSpell(spell, true);
  };

  const handleRollCustomDice = () => {
    const dice: DamageDie[] = [{ type: customDiceType, count: customDiceCount }];
    const summary = rollDamageDice(dice, 0, 'Dados personalizados', customDiceKind);
    pushLog({
      kind: 'quick',
      title: `Dados personalizados (${customDiceCount}${customDiceType.toUpperCase()})`,
      castRoll: {
        rolls: summary.parts.map((p, i) => {
          const m = p.match(/(\d+)d(\d+)/);
          return m ? Number(m[1]) : 1;
        }),
        successes: summary.total > 0 ? customDiceCount : 0,
        fails: 0,
        assured: 0,
        net: summary.total,
        totalDice: customDiceCount,
      },
      damageRoll: {
        ...summary,
        damageKind: customDiceKind,
        isManual: true,
      },
      summaryText: `Tiraste ${customDiceCount}${customDiceType.toUpperCase()} → ${summary.total}. ${summary.notes}`,
    });
    setShowCustomDice(false);
  };

  const handleQuickRoll = (diceCount: number, assured: number) => {
    const roll = rollD6Pool(diceCount, assured);
    pushLog({
      kind: 'quick',
      title: `Tirada rápida (${diceCount}d6${assured > 0 ? ` +${assured} aseg.` : ''})`,
      castRoll: roll,
      summaryText: `Resultado: ${roll.successes} éxito(s), ${roll.fails} fallo(s), neto ${
        roll.net > 0 ? `+${roll.net}` : roll.net
      }.`,
    });
  };

  const encodeShareCode = (jsonText: string): string => {
    const bytes = new TextEncoder().encode(jsonText);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `ARCANE1:${btoa(binary)}`;
  };

  const decodeShareCode = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('ARCANE1:')) return trimmed;
    const base64 = trimmed.slice('ARCANE1:'.length).trim();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  };

  const buildCharacterSharePayload = (charId: string) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return null;
    const charSpells = spells.filter(
      (s) => !s.isBasic && (s.ownerCharacterId === char.id || char.knownSpells.includes(s.id))
    );
    const usedOrders = new Set(charSpells.flatMap((s) => s.orders || []));
    const usedStatuses = new Set(charSpells.flatMap((s) => s.statuses || []));
    return {
      app: 'Arcane Grimorio y Combate',
      format: 'arcane_character_v1',
      exportedAt: new Date().toISOString(),
      character: char,
      spells: charSpells,
      customOrders: customOrders.filter((o) => usedOrders.has(o)),
      customStatuses: customStatuses.filter((st) => usedStatuses.has(st)),
    };
  };

  const handleExportCharacter = (charId: string) => {
    const payload = buildCharacterSharePayload(charId);
    if (!payload) return;
    const slug =
      payload.character.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') || 'mago';
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcane-pj-${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCharacterCode = async (charId: string): Promise<boolean> => {
    const payload = buildCharacterSharePayload(charId);
    if (!payload) return false;
    try {
      const code = encodeShareCode(JSON.stringify(payload));
      await navigator.clipboard.writeText(code);
      return true;
    } catch {
      return false;
    }
  };

  const handleImportCharacter = (rawText: string): { ok: boolean; message: string } => {
    try {
      const jsonText = decodeShareCode(rawText);
      const parsed = JSON.parse(jsonText) as {
        format?: string;
        character?: Partial<Character>;
        spells?: Partial<Spell>[];
        customOrders?: string[];
        customStatuses?: string[];
      };

      if (!parsed || !parsed.character || typeof parsed.character.name !== 'string') {
        return {
          ok: false,
          message: 'El texto o archivo no contiene un personaje válido de Arcane.',
        };
      }

      const rawChar = parsed.character;
      const charName = parsed.character.name.trim() || 'Mago importado';
      const newCharId = generateId('char_');
      const idMap = new Map<string, string>();
      const existingBasicIds = new Set(BASIC_SPELL_IDS);
      const existingSpellIds = new Set(spells.map((s) => s.id));
      const newSpells: Spell[] = [];

      const rawSpells = Array.isArray(parsed.spells) ? parsed.spells : [];
      rawSpells.forEach((sp) => {
        if (!sp || typeof sp.name !== 'string') return;
        if (sp.id && existingBasicIds.has(sp.id)) {
          idMap.set(sp.id, sp.id);
          return;
        }
        const newSpellId = generateId('sp_');
        if (sp.id) idMap.set(sp.id, newSpellId);
        const isLegacyCanalizado =
          sp.name.startsWith('Impacto Canalizado (') &&
          String(sp.effectDescription || '').includes('Casteo automático');
        newSpells.push({
          id: newSpellId,
          name: sp.name,
          manaCost: Number(sp.manaCost || 0),
          orders: Array.isArray(sp.orders) ? sp.orders : [],
          statuses: Array.isArray(sp.statuses) ? sp.statuses : [],
          statusParams: sp.statusParams,
          castRequirement: isLegacyCanalizado ? 'none' : sp.castRequirement,
          castCondition: typeof sp.castCondition === 'string' ? sp.castCondition : undefined,
          castStat: sp.castStat || 'none',
          manualCastDice: Number(sp.manualCastDice || 0),
          assuredSuccess: Number(sp.assuredSuccess || 0),
          combatStats: Array.isArray(sp.combatStats) ? sp.combatStats : [],
          damageMode: sp.damageMode || 'auto',
          effectType: sp.effectType || 'effect',
          effectSubType: sp.effectSubType,
          armorConfig: sp.armorConfig,
          collateral: sp.collateral,
          damageKind: sp.damageKind,
          noMastery: Boolean(sp.noMastery),
          damage: sp.damage || { dice: [], bonus: 0, notes: '' },
          effectDescription: isLegacyCanalizado
            ? String(sp.effectDescription || '').replace(
                /Hace daño mágico\.\s*Casteo automático \(1 acción\); lanzar el ataque es una acción aparte\./i,
                'Se lanza directo sin casteo previo.'
              )
            : String(sp.effectDescription || ''),
          duration: isLegacyCanalizado && sp.duration === '1 golpe' ? 'Instantáneo' : String(sp.duration || ''),
          durationTurns:
            typeof sp.durationTurns === 'number' && sp.durationTurns > 0
              ? sp.durationTurns
              : undefined,
          maxHits:
            typeof sp.maxHits === 'number' && sp.maxHits > 0 ? sp.maxHits : undefined,
          dispelConfig: sp.dispelConfig,
          elementalStatus: sp.elementalStatus,
          synergyReaction: sp.synergyReaction,
          synergyConsumeStacks: sp.synergyConsumeStacks,
          dependency: sp.dependency,
          areaConfig: sp.areaConfig,
          isBasic: false,
          ownerCharacterId: newCharId,
        });
      });

      // Remapear requiredSpellId en dependencias que apunten a hechizos importados juntos
      newSpells.forEach((sp) => {
        if (sp.dependency?.requiredSpellId && idMap.has(sp.dependency.requiredSpellId)) {
          sp.dependency = {
            ...sp.dependency,
            requiredSpellId: idMap.get(sp.dependency.requiredSpellId),
          };
        }
      });

      const rawKnown = Array.isArray(rawChar.knownSpells) ? rawChar.knownSpells : [];
      const mappedKnown = rawKnown
        .map((id) => idMap.get(id) || (existingSpellIds.has(id) ? id : null))
        .filter((id): id is string => Boolean(id));
      const finalKnown = [...new Set([...mappedKnown, ...newSpells.map((s) => s.id)])];

      const maxHp = Math.max(1, Number(rawChar.hp?.max ?? 20));
      const curHp = Math.max(0, Math.min(maxHp, Number(rawChar.hp?.current ?? maxHp)));
      const maxMana = Math.max(0, Number(rawChar.mana?.max ?? 15));
      const curMana = Math.max(0, Math.min(maxMana, Number(rawChar.mana?.current ?? maxMana)));

      const importedMastery: Record<string, number> = {};
      if (rawChar.spellMastery && typeof rawChar.spellMastery === 'object') {
        Object.entries(rawChar.spellMastery).forEach(([spId, val]) => {
          const mappedId = idMap.get(spId) || (existingSpellIds.has(spId) ? spId : null);
          if (mappedId && typeof val === 'number' && val > 0) {
            importedMastery[mappedId] = val;
          }
        });
      }

      const rawGoalIds = Array.isArray(rawChar.archiveGoalIds) ? rawChar.archiveGoalIds : [];
      const importedGoalIds = [...new Set(
        rawGoalIds
          .map((id: unknown) =>
            typeof id === 'string'
              ? idMap.get(id) || (existingSpellIds.has(id) ? id : null)
              : null
          )
          .filter((id: string | null): id is string => Boolean(id))
      )];
      const mapImportedSpellIds = (ids: unknown): string[] =>
        Array.isArray(ids)
          ? [...new Set(
              ids
                .map((id) =>
                  typeof id === 'string'
                    ? idMap.get(id) || (existingSpellIds.has(id) ? id : null)
                    : null
                )
                .filter((id): id is string => typeof id === 'string')
            )]
          : [];
      const importedFavorites = mapImportedSpellIds(rawChar.favoriteSpellIds);
      const importedTags = Object.fromEntries(
        Object.entries(
          rawChar.personalSpellTags && typeof rawChar.personalSpellTags === 'object'
            ? rawChar.personalSpellTags
            : {}
        )
          .map(([oldId, tags]) => [
            idMap.get(oldId) || (existingSpellIds.has(oldId) ? oldId : null),
            Array.isArray(tags)
              ? [...new Set(tags.filter((tag): tag is string => typeof tag === 'string'))]
              : [],
          ])
          .filter((entry): entry is [string, string[]] => typeof entry[0] === 'string')
      );

      const milestones = getStatMilestones(formula);
      const rawStats = {
        fisico: Number(rawChar.stats?.fisico ?? 0),
        manipulacion: Number(rawChar.stats?.manipulacion ?? 0),
        influencia: Number(rawChar.stats?.influencia ?? 0),
      };
      const importedStatPoints = {
        fisico:
          typeof rawChar.statPoints?.fisico === 'number'
            ? Math.max(0, Math.floor(rawChar.statPoints.fisico))
            : milestones[Math.max(0, Math.min(milestones.length - 1, Math.floor(rawStats.fisico) - 1))] ?? 0,
        manipulacion:
          typeof rawChar.statPoints?.manipulacion === 'number'
            ? Math.max(0, Math.floor(rawChar.statPoints.manipulacion))
            : milestones[Math.max(0, Math.min(milestones.length - 1, Math.floor(rawStats.manipulacion) - 1))] ?? 0,
        influencia:
          typeof rawChar.statPoints?.influencia === 'number'
            ? Math.max(0, Math.floor(rawChar.statPoints.influencia))
            : milestones[Math.max(0, Math.min(milestones.length - 1, Math.floor(rawStats.influencia) - 1))] ?? 0,
      };

      const importedChar: Character = {
        id: newCharId,
        name: charName,
        kind: rawChar.kind === 'npc' ? 'npc' : 'mage',
        nature: typeof rawChar.nature === 'string' ? rawChar.nature : undefined,
        physicalVariant: rawChar.physicalVariant,
        statPoints: importedStatPoints,
        stats: {
          fisico: calcStatLevelFromPoints(importedStatPoints.fisico, formula),
          manipulacion: calcStatLevelFromPoints(importedStatPoints.manipulacion, formula),
          influencia: calcStatLevelFromPoints(importedStatPoints.influencia, formula),
        },
        hp: { current: curHp, max: maxHp },
        mana: { current: curMana, max: maxMana },
        knownSpells: finalKnown,
        archiveGoalIds: importedGoalIds,
        favoriteSpellIds: importedFavorites,
        personalSpellTags: importedTags,
        personalSpellTagNames: Array.isArray(rawChar.personalSpellTagNames)
          ? [...new Set(rawChar.personalSpellTagNames.filter((tag): tag is string => typeof tag === 'string'))]
          : [],
        spellOrder: mapImportedSpellIds(rawChar.spellOrder),
        spellSortMode: ['custom', 'name', 'category', 'mana', 'nature', 'favorites'].includes(
          rawChar.spellSortMode as string
        )
          ? (rawChar.spellSortMode as Character['spellSortMode'])
          : 'custom',
        spellMastery: importedMastery,
        knowledgeMastery:
          rawChar.knowledgeMastery && typeof rawChar.knowledgeMastery === 'object'
            ? Object.fromEntries(
                Object.entries(rawChar.knowledgeMastery).map(([id, level]) => [
                  id,
                  Math.max(0, Math.min(3, Math.floor(level || 0))),
                ])
              )
            : {},
        discoveredKnowledgeDisciplines: Array.isArray(rawChar.discoveredKnowledgeDisciplines)
          ? [...new Set(rawChar.discoveredKnowledgeDisciplines)]
          : [],
        weapons: Array.isArray(rawChar.weapons) ? rawChar.weapons : [],
        condition: deriveCondition(
          curHp,
          curMana,
          rawChar.condition || 'active',
          false,
          maxMana,
          Boolean(rawChar.ignoreManaUnconsciousness)
        ),
        ignoreManaUnconsciousness: Boolean(rawChar.ignoreManaUnconsciousness),
        immuneToBlind: Boolean(rawChar.immuneToBlind),
        characterLevel:
          typeof rawChar.characterLevel === 'number' && rawChar.characterLevel >= 1
            ? Math.floor(rawChar.characterLevel)
            : 1,
        progressionHistory: Array.isArray(rawChar.progressionHistory)
          ? rawChar.progressionHistory
          : [],
        notes: typeof rawChar.notes === 'string' ? rawChar.notes : '',
        resistances: typeof rawChar.resistances === 'string' ? rawChar.resistances : '',
      };

      if (Array.isArray(parsed.customOrders) && parsed.customOrders.length > 0) {
        setCustomOrders((prev) => [
          ...new Set([...prev, ...parsed.customOrders!.filter((o) => !PRESET_ORDERS.includes(o))]),
        ]);
      }
      if (Array.isArray(parsed.customStatuses) && parsed.customStatuses.length > 0) {
        setCustomStatuses((prev) => [
          ...new Set([
            ...prev,
            ...parsed.customStatuses!.filter((st) => !PRESET_STATUSES.includes(st)),
          ]),
        ]);
      }

      const sanitizedImport = sanitizeSignatureSpellsState(
        [...spells, ...newSpells],
        [...characters, importedChar]
      );
      const cleanedImportedChar =
        sanitizedImport.characters.find((c) => c.id === importedChar.id) || importedChar;
      const cleanedNewSpellsCount = sanitizedImport.spells.filter(
        (s) => s.ownerCharacterId === cleanedImportedChar.id
      ).length;

      setSpells(sanitizedImport.spells);
      setCharacters(sanitizedImport.characters);
      setActiveCharacterId(cleanedImportedChar.id);

      return {
        ok: true,
        message: `Jugador "${cleanedImportedChar.name}" importado con ${cleanedNewSpellsCount} hechizo(s) propio(s), sin mezclarse con otros PJs.`,
      };
    } catch {
      return {
        ok: false,
        message: 'No se pudo leer el código o archivo del jugador.',
      };
    }
  };

  const getPlayerCreatedSpells = (char: Character | undefined = activeCharacter): Spell[] => {
    if (!char) return spells.filter((s) => !s.isBasic);
    return spells.filter(
      (s) =>
        !s.isBasic &&
        (s.ownerCharacterId === char.id ||
          char.knownSpells.includes(s.id) ||
          !s.ownerCharacterId)
    );
  };

  const exportSpellsPack = (
    targetSpells: Spell[],
    mode: 'own' | 'selected'
  ): { ok: boolean; count: number; message: string } => {
    if (targetSpells.length === 0) {
      return {
        ok: false,
        count: 0,
        message:
          mode === 'selected'
            ? 'Seleccioná al menos un hechizo para compartir.'
            : 'Todavía no hay hechizos propios creados para exportar.',
      };
    }

    const usedOrders = new Set(targetSpells.flatMap((s) => s.orders || []));
    const usedStatuses = new Set(targetSpells.flatMap((s) => s.statuses || []));
    const charName = activeCharacter?.name || 'Jugador';
    const slug =
      charName
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') || 'jugador';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName =
      mode === 'selected'
        ? `arcane-hechizos-seleccion-${slug}-${dateStamp}.json`
        : `arcane-hechizos-${slug}-${dateStamp}.json`;

    const payload = {
      app: 'Arcane Grimorio y Combate',
      format: 'arcane_spells_pack_v1',
      selectionMode: mode,
      exportedAt: new Date().toISOString(),
      characterName: charName,
      spellCount: targetSpells.length,
      spells: targetSpells,
      customOrders: customOrders.filter((o) => usedOrders.has(o)),
      customStatuses: customStatuses.filter((st) => usedStatuses.has(st)),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);

    return {
      ok: true,
      count: targetSpells.length,
      message:
        mode === 'selected'
          ? `Se exportaron ${targetSpells.length} hechizo(s) seleccionado(s) (${fileName}).`
          : `Se exportaron ${targetSpells.length} hechizo(s) propio(s) de ${charName} (${fileName}).`,
    };
  };

  const handleExportPlayerSpells = (): { ok: boolean; count: number; message: string } => {
    const playerSpells = getPlayerCreatedSpells(activeCharacter);
    return exportSpellsPack(playerSpells, 'own');
  };

  const handleExportSelectedSpells = (
    spellIds: string[]
  ): { ok: boolean; count: number; message: string } => {
    const idSet = new Set(spellIds);
    const selectedSpells = spells.filter((s) => idSet.has(s.id));
    return exportSpellsPack(selectedSpells, 'selected');
  };

  const handleImportPlayerSpells = (rawText: string): { ok: boolean; message: string } => {
    try {
      const jsonText = decodeShareCode(rawText);
      const parsed = JSON.parse(jsonText) as
        | {
            format?: string;
            spells?: Partial<Spell>[];
            customOrders?: string[];
            customStatuses?: string[];
          }
        | Partial<Spell>[];

      const rawSpells: Partial<Spell>[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.spells)
          ? parsed.spells
          : [];

      if (rawSpells.length === 0) {
        return {
          ok: false,
          message: 'El archivo no contiene hechizos válidos para importar.',
        };
      }

      const existingKnownNames = new Set(
        spells
          .filter(
            (s) =>
              s.isBasic ||
              !activeCharacter ||
              s.ownerCharacterId === activeCharacter.id ||
              activeCharacter.knownSpells.includes(s.id) ||
              !s.ownerCharacterId
          )
          .map((s) => s.name.trim().toLowerCase())
      );

      const newSpells: Spell[] = [];
      let skippedDuplicates = 0;

      rawSpells.forEach((sp) => {
        if (!sp || typeof sp.name !== 'string' || !sp.name.trim()) return;
        const normalizedName = sp.name.trim().toLowerCase();
        if (existingKnownNames.has(normalizedName)) {
          skippedDuplicates += 1;
          return;
        }
        existingKnownNames.add(normalizedName);
        newSpells.push({
          id: generateId('sp_'),
          name: sp.name.trim(),
          manaCost: Number(sp.manaCost || 0),
          orders: Array.isArray(sp.orders) ? sp.orders : [],
          statuses: Array.isArray(sp.statuses) ? sp.statuses : [],
          statusParams: sp.statusParams,
          castRequirement: sp.castRequirement,
          castCondition: typeof sp.castCondition === 'string' ? sp.castCondition : undefined,
          castStat: sp.castStat || 'none',
          manualCastDice: Number(sp.manualCastDice || 0),
          assuredSuccess: Number(sp.assuredSuccess || 0),
          combatStats: Array.isArray(sp.combatStats) ? sp.combatStats : [],
          damageMode: sp.damageMode || 'auto',
          effectType: sp.effectType || 'effect',
          effectSubType: sp.effectSubType,
          armorConfig: sp.armorConfig,
          collateral: sp.collateral,
          damageKind: sp.damageKind,
          noMastery: Boolean(sp.noMastery),
          damage: sp.damage || { dice: [], bonus: 0, notes: '' },
          effectDescription: String(sp.effectDescription || ''),
          duration: String(sp.duration || ''),
          durationTurns:
            typeof sp.durationTurns === 'number' && sp.durationTurns > 0
              ? sp.durationTurns
              : undefined,
          maxHits:
            typeof sp.maxHits === 'number' && sp.maxHits > 0 ? sp.maxHits : undefined,
          dispelConfig: sp.dispelConfig,
          elementalStatus: sp.elementalStatus,
          synergyReaction: sp.synergyReaction,
          synergyConsumeStacks: sp.synergyConsumeStacks,
          dependency: sp.dependency,
          areaConfig: sp.areaConfig,
          isBasic: false,
          ownerCharacterId: activeCharacter?.id,
        });
      });

      if (!Array.isArray(parsed)) {
        if (Array.isArray(parsed.customOrders) && parsed.customOrders.length > 0) {
          setCustomOrders((prev) => [
            ...new Set([...prev, ...parsed.customOrders!.filter((o) => !PRESET_ORDERS.includes(o))]),
          ]);
        }
        if (Array.isArray(parsed.customStatuses) && parsed.customStatuses.length > 0) {
          setCustomStatuses((prev) => [
            ...new Set([
              ...prev,
              ...parsed.customStatuses!.filter((st) => !PRESET_STATUSES.includes(st)),
            ]),
          ]);
        }
      }

      if (newSpells.length === 0) {
        return {
          ok: false,
          message:
            skippedDuplicates > 0
              ? `No se agregaron hechizos nuevos (${skippedDuplicates} ya existían en este grimorio).`
              : 'No se encontraron hechizos propios válidos en el archivo.',
        };
      }

      setSpells((prev) => [...prev, ...newSpells]);
      if (activeCharacter) {
        const addedIds = newSpells.map((s) => s.id);
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === activeCharacter.id
              ? { ...c, knownSpells: [...new Set([...c.knownSpells, ...addedIds])] }
              : c
          )
        );
      }

      return {
        ok: true,
        message: `Se importaron ${newSpells.length} hechizo(s) propio(s) para ${activeCharacter?.name || 'el personaje activo'}${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicado(s) omitido(s))` : ''
        }.`,
      };
    } catch {
      return {
        ok: false,
        message: 'No se pudo leer el archivo JSON de hechizos.',
      };
    }
  };

  const handleResetAllData = () => {
    const snapshot: PersistedState = {
      characters: JSON.parse(JSON.stringify(characters)),
      activeCharacterId,
      spells: JSON.parse(JSON.stringify(spells)),
      customOrders: [...customOrders],
      customStatuses: [...customStatuses],
      formula: {
        ...formula,
        masteryCustomMilestones: [...formula.masteryCustomMilestones],
      },
      manaMode,
      round,
      combatants: JSON.parse(JSON.stringify(combatants)),
      arenaLayout: {
        left: [...arenaLayout.left],
        right: [...arenaLayout.right],
      },
      theme: {
        presetId: theme.presetId,
        colors: { ...theme.colors },
        savedCustomThemes: (theme.savedCustomThemes || []).map((t) => ({
          ...t,
          colors: { ...t.colors },
        })),
      },
      globalSpellOrder: [...globalSpellOrder],
      knowledgeTreeSettings: normalizeKnowledgeTreeSettings(knowledgeTreeSettings),
    };
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(snapshot));
    setUndoSnapshot(snapshot);
    setShowRevertBanner(true);

    const fresh = buildDefaultState();
    setCharacters(fresh.characters);
    setActiveCharacterId(fresh.activeCharacterId);
    setSpells(fresh.spells);
    setCustomOrders(fresh.customOrders);
    setCustomStatuses(fresh.customStatuses);
    setFormula(fresh.formula);
    setManaMode(fresh.manaMode);
    setRound(fresh.round);
    setCombatants(fresh.combatants);
    setArenaLayout(normalizeArenaLayout(fresh.arenaLayout));
    setTheme(normalizeThemeConfig(fresh.theme));
    setGlobalSpellOrder([]);
    setKnowledgeTreeSettings(normalizeKnowledgeTreeSettings(fresh.knowledgeTreeSettings));
    setPendingAttack(null);
    setPendingStatusCheck(null);
    setPendingHeal(null);
    setEditingSpell(null);
    setShowEditor(false);
    setLogs([]);
  };

  const handleRevertReset = () => {
    if (!undoSnapshot) return;
    setCharacters(undoSnapshot.characters);
    setActiveCharacterId(undoSnapshot.activeCharacterId);
    setSpells(undoSnapshot.spells);
    setCustomOrders(undoSnapshot.customOrders);
    setCustomStatuses(undoSnapshot.customStatuses);
    setFormula(normalizeFormula(undoSnapshot.formula));
    setManaMode(undoSnapshot.manaMode);
    setRound(undoSnapshot.round);
    setCombatants(undoSnapshot.combatants);
    if (undoSnapshot.arenaLayout) {
      setArenaLayout(normalizeArenaLayout(undoSnapshot.arenaLayout));
    }
    if (undoSnapshot.theme) {
      setTheme(normalizeThemeConfig(undoSnapshot.theme));
    }
    if (Array.isArray(undoSnapshot.globalSpellOrder)) {
      setGlobalSpellOrder(undoSnapshot.globalSpellOrder);
    }
    setKnowledgeTreeSettings(
      normalizeKnowledgeTreeSettings(undoSnapshot.knowledgeTreeSettings)
    );
    setPendingAttack(null);
    setPendingStatusCheck(null);
    setPendingHeal(null);
    localStorage.removeItem(UNDO_STORAGE_KEY);
    setUndoSnapshot(null);
    setShowRevertBanner(false);
  };

  const handleExportBackup = () =>
    JSON.stringify(
      {
        app: 'Arcane Grimorio y Combate',
        formatVersion: 2,
        exportedAt: new Date().toISOString(),
        data: {
          characters,
          activeCharacterId,
          spells,
          customOrders,
          customStatuses,
          formula,
          manaMode,
          round,
          combatants,
          currentTurnCombatantId: resolvedCurrentTurnCombatantId,
          autoPassTurn,
          arenaLayout,
          theme,
          globalSpellOrder,
          knowledgeTreeSettings,
        },
      },
      null,
      2
    );

  const handleImportBackup = (jsonText: string): { ok: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed?.format === 'arcane_character_v1' && parsed?.character) {
        return handleImportCharacter(jsonText);
      }
      if (parsed?.format === 'arcane_spells_pack_v1' && Array.isArray(parsed?.spells)) {
        return handleImportPlayerSpells(jsonText);
      }
      const data = parsed?.data || parsed;
      if (Array.isArray(data.characters) && data.characters.length > 0) {
        const importedFormula = data.formula ? normalizeFormula(data.formula) : formula;
        if (data.formula) setFormula(importedFormula);
        const importedCharacters: Character[] = data.characters.map((ch: Character) => {
          const pts = ch.statPoints || {
            fisico: getCharacterStatPoints(ch, 'fisico', importedFormula),
            manipulacion: getCharacterStatPoints(ch, 'manipulacion', importedFormula),
            influencia: getCharacterStatPoints(ch, 'influencia', importedFormula),
          };
          return {
            ...ch,
            statPoints: pts,
            stats: {
              fisico: calcStatLevelFromPoints(pts.fisico, importedFormula),
              manipulacion: calcStatLevelFromPoints(pts.manipulacion, importedFormula),
              influencia: calcStatLevelFromPoints(pts.influencia, importedFormula),
            },
            spellMastery:
              ch.spellMastery && typeof ch.spellMastery === 'object' ? ch.spellMastery : {},
            knowledgeMastery:
              ch.knowledgeMastery && typeof ch.knowledgeMastery === 'object'
                ? Object.fromEntries(
                    Object.entries(ch.knowledgeMastery).map(([id, level]) => [
                      id,
                      Math.max(0, Math.min(3, Math.floor(level || 0))),
                    ])
                  )
                : {},
            discoveredKnowledgeDisciplines: Array.isArray(ch.discoveredKnowledgeDisciplines)
              ? [...new Set(ch.discoveredKnowledgeDisciplines)]
              : [],
            weapons: Array.isArray(ch.weapons) ? ch.weapons : [],
            characterLevel:
              typeof ch.characterLevel === 'number' && ch.characterLevel >= 1
                ? Math.floor(ch.characterLevel)
                : 1,
            progressionHistory: Array.isArray(ch.progressionHistory) ? ch.progressionHistory : [],
          };
        });
        const importedSpellsFromBackup: Spell[] = Array.isArray(data.spells)
          ? data.spells.map((s: Spell) => ({
              ...s,
              statuses: Array.isArray(s.statuses) ? s.statuses : [],
            }))
          : spells;
        const importedSpellIds = new Set(importedSpellsFromBackup.map((spell) => spell.id));
        const importedSpells = [
          ...importedSpellsFromBackup,
          ...BUILTIN_SPELLS.filter((spell) => !importedSpellIds.has(spell.id)),
        ];
        const sanitizedBackup = sanitizeSignatureSpellsState(importedSpells, importedCharacters);
        const backupSpellIds = new Set(sanitizedBackup.spells.map((spell) => spell.id));
        const backupCharacters = sanitizedBackup.characters.map((character) => ({
          ...character,
          favoriteSpellIds: (character.favoriteSpellIds || []).filter((id) => backupSpellIds.has(id)),
          personalSpellTags: Object.fromEntries(
            Object.entries(character.personalSpellTags || {}).filter(([id]) => backupSpellIds.has(id))
          ),
          personalSpellTagNames: [...new Set(character.personalSpellTagNames || [])],
          spellSortMode: ['custom', 'name', 'category', 'mana', 'nature', 'favorites'].includes(
            character.spellSortMode || ''
          )
            ? character.spellSortMode
            : 'custom',
        }));
        setCharacters(backupCharacters);
        setActiveCharacterId(data.activeCharacterId || sanitizedBackup.characters[0].id);
        if (Array.isArray(data.spells)) {
          setSpells(sanitizedBackup.spells);
        }
        if (Array.isArray(data.customOrders)) setCustomOrders(data.customOrders);
        if (Array.isArray(data.customStatuses)) setCustomStatuses(data.customStatuses);
        if (data.manaMode) setManaMode(data.manaMode);
        if (typeof data.round === 'number') setRound(data.round);
        if (Array.isArray(data.combatants)) {
          setCombatants(
            data.combatants.map((cb: Combatant) => ({
              ...cb,
              preparedSpells: Array.isArray(cb.preparedSpells) ? cb.preparedSpells : [],
              activeStatuses: Array.isArray(cb.activeStatuses) ? cb.activeStatuses : [],
              actedThisRound: Boolean(cb.actedThisRound),
            }))
          );
        }
        if (typeof data.currentTurnCombatantId === 'string') {
          setCurrentTurnCombatantId(data.currentTurnCombatantId);
        }
        if (typeof data.autoPassTurn === 'boolean') {
          setAutoPassTurn(data.autoPassTurn);
        }
        if (data.arenaLayout) setArenaLayout(normalizeArenaLayout(data.arenaLayout));
        if (data.theme) setTheme(normalizeThemeConfig(data.theme));
        if (Array.isArray(data.globalSpellOrder)) setGlobalSpellOrder(data.globalSpellOrder);
        setKnowledgeTreeSettings(
          normalizeKnowledgeTreeSettings(data.knowledgeTreeSettings)
        );
        return { ok: true, message: 'Copia importada correctamente.' };
      }
      if (Array.isArray(data.arcane_spells_v3)) {
        const importedSpells: Spell[] = data.arcane_spells_v3.map(
          (old: Record<string, unknown>) => ({
            id: String(old.id || generateId('sp_')),
            name: String(old.name || 'Importado'),
            manaCost: Number(old.manaCost || 0),
            orders: Array.isArray(old.orders) ? (old.orders as string[]) : [],
            statuses: Array.isArray(old.statuses) ? (old.statuses as string[]) : [],
            castStat: (old.castStat as Spell['castStat']) || 'none',
            manualCastDice: Number(old.manualCastDice || 0),
            assuredSuccess: Number(old.assuredSuccess || 0),
            combatStats: Array.isArray(old.attackStats)
              ? (old.attackStats as StatKey[])
              : [],
            damageMode: (old.damageMode as Spell['damageMode']) || 'auto',
            effectType: (old.effectType as Spell['effectType']) || 'effect',
            damage: (old.damage as Spell['damage']) || { dice: [], bonus: 0, notes: '' },
            effectDescription: String(old.effectDescription || ''),
            duration: String(old.duration || ''),
            isBasic: Boolean(old.isBasic),
          })
        );
        setSpells((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          importedSpells.forEach((s) => map.set(s.id, s));
          return Array.from(map.values());
        });
        return {
          ok: true,
          message: `Se importaron ${importedSpells.length} hechizos desde copia clásica.`,
        };
      }
      return { ok: false, message: 'Formato JSON no reconocido.' };
    } catch {
      return { ok: false, message: 'No se pudo leer el archivo JSON.' };
    }
  };

  const activeIsPJ = activeCharacter?.kind === 'mage';
  const activeCombatantForVisual = combatants.find(
    (cb) => cb.characterId === activeCharacter?.id
  );
  const isActiveDown = Boolean(
    activeCharacter &&
      !activeCombatantForVisual?.isBotControlled &&
      (activeCharacter.hp.current <= 0 ||
        (!activeCharacter.ignoreManaUnconsciousness &&
          activeCharacter.mana.max > 0 &&
          activeCharacter.mana.current <= 0) ||
        activeCharacter.condition !== 'active')
  );

  const isDefaultLayout =
    JSON.stringify(arenaLayout) === JSON.stringify(DEFAULT_ARENA_LAYOUT);

  const activeSpellOrder = activeCharacter
    ? activeCharacter.spellOrder || []
    : globalSpellOrder;

  const isBoxVisibleOnMobile = (boxId: ArenaBoxId) =>
    mobileArenaSection === 'all' || mobileArenaSection === boxId;

  const handleDuplicateSpell = (spell: Spell) => {
    const clone: Spell = {
      ...spell,
      id: generateId('sp_'),
      name: `${spell.name} (Copia)`,
      orders: [...(spell.orders || [])],
      statuses: [...(spell.statuses || [])],
      combatStats: [...(spell.combatStats || [])],
      damage: {
        dice: (spell.damage?.dice || []).map((d) => ({ ...d })),
        bonus: spell.damage?.bonus || 0,
        notes: spell.damage?.notes || '',
      },
      armorConfig: spell.armorConfig ? { ...spell.armorConfig } : undefined,
      collateral: spell.collateral
        ? {
            ...spell.collateral,
            dice: spell.collateral.dice
              ? spell.collateral.dice.map((d) => ({ ...d }))
              : undefined,
          }
        : undefined,
      isBasic: false,
      ownerCharacterId: activeCharacter?.id,
    };
    setEditingSpell(clone);
    setShowEditor(true);
    setActiveTab('arena');
  };

  const renderArenaBoxContent = (boxId: ArenaBoxId) => {
    if (boxId === 'grimorio') {
      return (
        <QuickCastPanel
          spells={spells}
          activeCharacter={activeCharacter}
          combatants={combatants}
          characters={characters}
          selectedTargetId={selectedTargetId}
          onSelectTarget={setSelectedTargetId}
          formula={formula}
          spellOrder={activeSpellOrder}
          manaMode={manaMode}
          isAttackLethal={isAttackLethal}
          onToggleLethal={setIsAttackLethal}
          onCastSpell={(s) => handleCastSpell(s, false)}
          onAttackSpell={(s) => {
            handleAttackFromSpell(s);
            if (mobileArenaSection === 'grimorio') {
              setMobileArenaSection('combat');
            }
          }}
          onDefendTestSpell={handleDefendTestSpell}
          onHealSpell={(s) => handleHealSpell(s, false)}
          onApplyStatusSpell={(s) =>
            activeCharacter && triggerStatusCheck(s, activeCharacter, false, false)
          }
          onTestSpell={handleTestSpell}
          autoPassSecondsLeft={
            currentTurnCombatant?.characterId === activeCharacter?.id
              ? autoPassSecondsLeft
              : null
          }
          onAdvanceTurn={handleAdvanceTurn}
          onToggleFavoriteSpell={handleToggleFavoriteSpell}
        />
      );
    }

    if (boxId === 'weapons') {
      const activeWeaponCb = combatants.find((cb) => cb.characterId === activeCharacter?.id);
      const weaponActionsRemaining = activeWeaponCb
        ? getCombatantTurnActionStatus(activeWeaponCb).remaining
        : undefined;
      const activeWeaponEffects = activeWeaponCb
        ? getCombatantStatusEffects(activeWeaponCb, activeCharacter)
        : undefined;
      return (
        <WeaponArsenal
          activeCharacter={activeCharacter}
          formula={formula}
          isAttackLethal={isAttackLethal}
          actionsRemaining={weaponActionsRemaining}
          activeStatusEffects={activeWeaponEffects}
          onRecoverDisarmedWeapon={
            activeWeaponCb ? () => handleRecoverDisarmedWeapon(activeWeaponCb.id) : undefined
          }
          onAddWeapon={handleAddWeapon}
          onRemoveWeapon={handleRemoveWeapon}
          onRestoreWeapon={handleRestoreWeapon}
          onImbueWeapon={handleImbueWeapon}
          onClearImbuement={handleClearImbuement}
          onAttackWithWeapon={handleAttackWithWeapon}
          onExpandShield={handleExpandShield}
        />
      );
    }

    if (boxId === 'combat') {
      return (
        <CombatPanel
          round={round}
          manaMode={manaMode}
          combatants={combatants}
          characters={characters}
          spells={spells}
          activeCharacterId={activeCharacter?.id || ''}
          selectedTargetId={selectedTargetId}
          currentTurnCombatantId={resolvedCurrentTurnCombatantId}
          autoPassTurn={autoPassTurn}
          autoPassPaused={autoPassPaused}
          autoPassSecondsLeft={autoPassSecondsLeft}
          onToggleAutoPassTurn={(next) => {
            setAutoPassTurn(next);
            setAutoPassPaused(false);
          }}
          onPauseAutoPass={() => {
            setAutoPassPaused(true);
            setAutoPassSecondsLeft(null);
          }}
          onAdvanceTurn={handleAdvanceTurn}
          hasBotModeActive={hasBotModeActive}
          botBattleOutcome={botBattleOutcome}
          isBotActingNow={shouldBotActNow || shouldBotDefendNow || shouldBotResistStatusNow}
          onStartBotPractice={handleStartBotPractice}
          onRematchBotPractice={handleRematchBotPractice}
          onEndBotPractice={handleEndBotPractice}
          onToggleCombatantBot={handleToggleCombatantBot}
          formula={formula}
          pendingAttack={pendingAttack}
          pendingCounterspell={pendingCounterspell}
          pendingStatusCheck={pendingStatusCheck}
          pendingHeal={pendingHeal}
          onChangeRound={handleChangeRound}
          onResetCombat={() => {
            setCharacters((prev) => prev.filter((c) => !c.isBotPreset));
            setCombatants([]);
            setRound(1);
            setCurrentTurnCombatantId('');
            setAutoPassPaused(false);
            setAutoPassSecondsLeft(null);
            setPendingAttack(null);
            setPendingCounterspell(null);
            setPendingStatusCheck(null);
            setPendingHeal(null);
          }}
          onChangeManaMode={setManaMode}
          onAddToCombat={handleAddToCombat}
          onUpdateInitiative={(cbId, init) =>
            setCombatants((prev) =>
              prev.map((c) => (c.id === cbId ? { ...c, initiative: init } : c))
            )
          }
          onRemoveFromCombat={(cbId) => {
            setCombatants((prev) => prev.filter((c) => c.id !== cbId));
            if (currentTurnCombatantId === cbId) {
              setCurrentTurnCombatantId('');
            }
          }}
          onSelectActor={handleSelectTurnActor}
          onAttackWithPrepared={handleAttackWithPrepared}
          onRemovePrepared={(cbId, prepId) =>
            setCombatants((prev) =>
              prev.map((cb) =>
                cb.id === cbId
                  ? {
                      ...cb,
                      preparedSpells: cb.preparedSpells.filter((p) => p.id !== prepId),
                    }
                  : cb
              )
            )
          }
          onAdjustHp={adjustHp}
          onAdjustMana={adjustMana}
          onResolveDirectDamage={handleResolveDirectDamage}
          onRollDefense={handleRollDefense}
          onVerifyTieDamage={handleVerifyTieDamage}
          onConfirmPendingDamage={handleConfirmPendingDamage}
          onUseAttackProtection={handleUseAttackProtection}
          onReinforcePendingAttack={handleReinforcePendingAttack}
          onTriggerCounterspellFromAttack={handleTriggerCounterspellFromAttack}
          onResolveCounterspell={handleResolveCounterspell}
          onDismissPendingCounterspell={() => setPendingCounterspell(null)}
          onDismissPendingAttack={() => setPendingAttack(null)}
          onToggleAreaTarget={handleToggleAreaTarget}
          onResolveAllAreaDirect={handleResolveAllAreaDirect}
          onRollStatusResistance={handleRollStatusResistance}
          onApplyStatusDirect={handleApplyStatusDirect}
          onDismissPendingStatus={() => setPendingStatusCheck(null)}
          onApplyManualStatus={handleApplyManualStatus}
          onUpdateCombatantStatus={handleUpdateCombatantStatus}
          onRemoveCombatantStatus={handleRemoveCombatantStatus}
          onRecoverDisarmedWeapon={handleRecoverDisarmedWeapon}
          onStandUpFromProne={handleStandUpFromProne}
          onAdjustStatusTurns={handleAdjustStatusTurns}
          onAdjustStatusHits={handleAdjustStatusHits}
          onAdjustStatusProtection={handleAdjustStatusProtection}
          onResetTurnActions={(cbId) => {
            handleResetTurnActions(cbId);
            setAutoPassPaused(false);
          }}
          onQuickCastTurnBuff={(spell, casterId) => handleCastSpell(spell, false, casterId)}
          spellOrder={activeSpellOrder}
          isAttackLethal={isAttackLethal}
          onToggleLethal={setIsAttackLethal}
          onChainAttackSpell={(spell, casterId) => {
            const cb = combatants.find((c) => c.characterId === casterId);
            if (cb && getCombatantTurnActionStatus(cb).remaining <= 0) return;
            handleAttackFromSpell(spell, casterId);
          }}
          onChainDefendSpell={(spell, casterId) => {
            const cb = combatants.find((c) => c.characterId === casterId);
            if (cb && getCombatantTurnActionStatus(cb).remaining <= 0) return;
            handleDefendTestSpell(spell, casterId);
            if (cb) {
              setCombatants((prev) =>
                prev.map((item) =>
                  item.id === cb.id
                    ? { ...item, attacksUsedThisTurn: (item.attacksUsedThisTurn || 0) + 1 }
                    : item
                )
              );
            }
          }}
          onChainCastSpell={(spell, casterId) => {
            const cb = combatants.find((c) => c.characterId === casterId);
            if (cb && getCombatantTurnActionStatus(cb).remaining <= 0) return;
            handleCastSpell(spell, false, casterId);
          }}
          onChainHealSpell={(spell, casterId) => {
            const cb = combatants.find((c) => c.characterId === casterId);
            if (cb && getCombatantTurnActionStatus(cb).remaining <= 0) return;
            handleHealSpell(spell, false, casterId);
          }}
          onChainApplyStatusSpell={(spell, casterId) => {
            const cb = combatants.find((c) => c.characterId === casterId);
            if (cb && getCombatantTurnActionStatus(cb).remaining <= 0) return;
            const caster = characters.find((c) => c.id === casterId);
            if (!caster) return;
            triggerStatusCheck(spell, caster, false, false);
          }}
          onApplyDirectDamageWithProtection={handleApplyDirectDamageWithProtection}
          onTriggerBurnTurn={handleTriggerBurnTurn}
          onTriggerElementalTurn={handleTriggerElementalTurn}
          onTriggerSynergyReaction={handleTriggerSynergyReaction}
          onInspectMechanic={(mechanicId, context) =>
            setCombatMechanicReader({ mechanicId, context })
          }
          onCancelCombatantBuffs={handleCancelCombatantBuffs}
          onTriggerCollateralTurn={handleTriggerCollateralTurn}
          onApplyCollateralDamage={handleApplyCollateralDamage}
          onApplyHeal={handleApplyHeal}
          onDismissPendingHeal={() => setPendingHeal(null)}
        />
      );
    }

    return (
      <LogPanel
        logs={logs}
        onClearLogs={() => setLogs([])}
        onQuickRoll={handleQuickRoll}
        onInspectMechanic={(mechanicId, context) =>
          setCombatMechanicReader({ mechanicId, context })
        }
      />
    );
  };

  const renderDropSlot = (column: 'left' | 'right', index: number, isEmptyCol = false) => {
    if (!customizeLayoutMode) return null;
    const isActiveTarget =
      dropSlot?.column === column && dropSlot?.index === index;

    return (
      <div
        key={`slot-${column}-${index}`}
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          if (!draggedBoxId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropSlot({ column, index });
        }}
        onDragLeave={() => {
          setDropSlot((prev) =>
            prev?.column === column && prev?.index === index ? null : prev
          );
        }}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          if (!draggedBoxId) return;
          e.preventDefault();
          handleMoveBoxToSlot(draggedBoxId, column, index);
        }}
        className={`rounded-lg border-2 border-dashed transition-all flex items-center justify-center text-xs font-semibold ${
          isActiveTarget
            ? 'min-h-[52px] border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
            : isEmptyCol
              ? 'min-h-[84px] border-[var(--arc-border-strong)] bg-[var(--arc-surface-alt)] text-[var(--arc-muted)]'
              : draggedBoxId
                ? 'min-h-[34px] border-[var(--arc-border)] bg-[var(--arc-surface-alt)]/70 text-[var(--arc-muted)]'
                : 'min-h-[8px] border-transparent opacity-0 pointer-events-none'
        }`}
      >
        {(isActiveTarget || isEmptyCol || draggedBoxId) &&
          (isActiveTarget
            ? 'Soltar caja completa acá'
            : isEmptyCol
              ? `Columna ${column === 'left' ? 'izquierda' : 'derecha'} vacía — soltá una caja acá`
              : 'Zona para soltar caja')}
      </div>
    );
  };

  const renderArenaColumn = (column: 'left' | 'right') => {
    const boxIds = arenaLayout[column];
    const hasAnyVisibleMobile =
      customizeLayoutMode || boxIds.some((id) => isBoxVisibleOnMobile(id));

    return (
      <div
        className={`xl:col-span-6 space-y-5 ${
          hasAnyVisibleMobile ? 'block' : 'hidden md:block'
        }`}
      >
        {boxIds.length === 0 ? (
          renderDropSlot(column, 0, true)
        ) : (
          <>
            {renderDropSlot(column, 0)}
            {boxIds.map((boxId, index) => {
              const meta = ARENA_BOX_META[boxId];
              const isDragging = draggedBoxId === boxId;
              const visibleOnMobile =
                customizeLayoutMode || isBoxVisibleOnMobile(boxId);

              return (
                <div
                  key={boxId}
                  onDragOver={(e: DragEvent<HTMLDivElement>) => {
                    if (!customizeLayoutMode || !draggedBoxId || draggedBoxId === boxId) {
                      return;
                    }
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    setDropSlot({ column, index: after ? index + 1 : index });
                  }}
                  onDrop={(e: DragEvent<HTMLDivElement>) => {
                    if (!customizeLayoutMode || !draggedBoxId || draggedBoxId === boxId) {
                      return;
                    }
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    handleMoveBoxToSlot(draggedBoxId, column, after ? index + 1 : index);
                  }}
                  className={`${visibleOnMobile ? 'block' : 'hidden md:block'} ${
                    customizeLayoutMode
                      ? 'rounded-xl border-2 border-dashed border-[var(--arc-border-strong)] p-1.5 bg-[var(--arc-surface-alt)]/50'
                      : ''
                  } ${isDragging ? 'opacity-50' : ''} space-y-2 transition-opacity`}
                >
                  {customizeLayoutMode && (
                    <div
                      draggable
                      onDragStart={(e: DragEvent<HTMLDivElement>) => {
                        setDraggedBoxId(boxId);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('application/x-arcane-box', boxId);
                        const boxRoot = e.currentTarget.parentElement;
                        if (boxRoot) {
                          e.dataTransfer.setDragImage(boxRoot, 24, 24);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedBoxId(null);
                        setDropSlot(null);
                      }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--arc-raised)] px-3 py-2 cursor-grab active:cursor-grabbing select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-4 w-4 text-[var(--arc-accent)] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--arc-accent)] truncate">
                            {meta.title}
                          </div>
                          <div className="text-xs text-[var(--arc-muted)] truncate">
                            Arrastrá desde acá para mover toda la caja intacta ({meta.subtitle})
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStepBox(boxId, -1)}
                          disabled={index === 0}
                          aria-label={`Subir caja ${meta.title}`}
                          className="min-h-[30px] w-7 inline-flex items-center justify-center rounded-md text-[var(--arc-text)] hover:bg-[var(--arc-surface)] disabled:opacity-35 transition-colors"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepBox(boxId, 1)}
                          disabled={index === boxIds.length - 1}
                          aria-label={`Bajar caja ${meta.title}`}
                          className="min-h-[30px] w-7 inline-flex items-center justify-center rounded-md text-[var(--arc-text)] hover:bg-[var(--arc-surface)] disabled:opacity-35 transition-colors"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSwapBoxColumn(boxId)}
                          className="min-h-[30px] inline-flex items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-surface)] transition-colors"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          {column === 'left' ? 'Der →' : '← Izq'}
                        </button>
                      </div>
                    </div>
                  )}

                  {renderArenaBoxContent(boxId)}
                  {renderDropSlot(column, index + 1)}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  const hasPendingCombat = Boolean(
    pendingAttack || pendingStatusCheck || pendingCounterspell || pendingHeal
  );

  return (
    <div
      className={`min-h-screen bg-[var(--arc-canvas)] text-[var(--arc-text)] transition-[filter,background-color,color] duration-500 ${
        isActiveDown ? 'grayscale brightness-90 contrast-95' : ''
      }`}
    >
      <header className="border-b border-[var(--arc-border)] bg-[var(--arc-header)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="inline-flex items-baseline gap-2 whitespace-nowrap shrink-0">
            <BookOpen className="h-5 w-5 self-center text-[var(--arc-action)]" aria-hidden="true" />
            <span className="font-display text-lg sm:text-xl font-bold tracking-wide text-[var(--arc-accent)]">
              Arcane
            </span>
            <span
              title={`Versión publicada de Arcane (${ARCANE_VERSION})`}
              className="font-mono-num text-xs font-medium text-[var(--arc-muted)]"
            >
              {ARCANE_VERSION}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'arena') {
                setActiveTab('arena');
                setEditingSpell(null);
                setShowEditor(true);
              } else {
                setEditingSpell(null);
                setShowEditor((v) => !v);
              }
            }}
            className="md:order-3 min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 py-2 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {showEditor && activeTab === 'arena' ? 'Ocultar editor' : 'Nuevo hechizo'}
          </button>

          <nav className="w-full md:w-auto md:order-2 flex items-center justify-between sm:justify-start gap-2 sm:gap-5 md:gap-6 overflow-x-auto text-xs sm:text-sm font-medium border-t border-[var(--arc-border)] pt-2 md:border-t-0 md:pt-0">
            {[
              { id: 'arena' as const, label: 'Grimorio', short: 'Grimorio', dot: false },
              { id: 'archive' as const, label: 'Archivo Arcano', short: 'Archivo', dot: false },
              { id: 'quickcast' as const, label: 'Combate', short: 'Combate', dot: hasPendingCombat },
              { id: 'characters' as const, label: 'Personajes y PNJs', short: 'Personajes', dot: false },
              { id: 'settings' as const, label: 'Fórmula y Copia', short: 'Fórmula', dot: false },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap shrink-0 py-1.5 md:py-1 text-center inline-flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[var(--arc-accent)] text-[var(--arc-text)] font-semibold'
                    : 'border-transparent text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.dot && (
                  <span
                    aria-label="Acción pendiente en combate"
                    className="inline-block h-2 w-2 rounded-full bg-[var(--arc-accent)]"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Barra de personaje actuando con distinción PJ vs PNJ y ajuste rápido de fórmula */}
      <div
        className={`border-b ${
          activeIsPJ ? 'border-[#3a5736] bg-[#151e14]' : 'border-[#6b362b] bg-[#211412]'
        }`}
      >
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 sm:gap-4 px-4 sm:px-6 py-2.5 sm:py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
              className={`font-bold uppercase tracking-wide ${
                activeIsPJ ? 'text-[#9ad489]' : 'text-[#f09a82]'
              }`}
            >
              {activeIsPJ ? 'PJ' : 'PNJ'}
            </span>
            <label htmlFor="global-actor" className="hidden sm:inline font-semibold text-[#c7b9a1]">
              Actuando:
            </label>
            <select
              id="global-actor"
              value={activeCharacter?.id || ''}
              onChange={(e) => setActiveCharacterId(e.target.value)}
              className="min-h-[36px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs font-semibold text-[var(--arc-accent)]"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind === 'mage' ? 'PJ' : 'PNJ'})
                </option>
              ))}
            </select>
            {activeCharacter && (
              <span className="font-mono-num text-[#d6c9b3]">
                PV {activeCharacter.hp.current}/{activeCharacter.hp.max} · Maná{' '}
                {activeCharacter.mana.current}/{activeCharacter.mana.max} ·{' '}
                <strong
                  className={
                    activeCharacter.condition === 'active'
                      ? 'text-[#a4d67e]'
                      : 'text-[#e08060]'
                  }
                >
                  {conditionLabel(activeCharacter.condition)}
                </strong>
              </span>
            )}
            {activeCharacter && isActiveDown && (
              <div className="inline-flex items-center gap-1">
                {activeCharacter.hp.current <= 0 && (
                  <button
                    type="button"
                    onClick={() => adjustHp(activeCharacter.id, 1, false)}
                    className="min-h-[30px] rounded-md px-2.5 text-xs font-semibold text-[#a4d67e] hover:bg-[var(--arc-raised)] transition-colors"
                  >
                    +1 PV
                  </button>
                )}
                {!activeCharacter.ignoreManaUnconsciousness &&
                  activeCharacter.mana.max > 0 &&
                  activeCharacter.mana.current <= 0 && (
                  <button
                    type="button"
                    onClick={() => adjustMana(activeCharacter.id, 1)}
                    className="min-h-[30px] rounded-md px-2.5 text-xs font-semibold text-[var(--arc-magic-accent)] hover:bg-[var(--arc-raised)] transition-colors"
                  >
                    +1 Maná
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[#c7b9a1]">
            <span>
              Maná:{' '}
              <strong className="text-[#efe6d5]">
                {manaMode === 'auto' ? 'Auto' : 'Manual'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowQuickFormula((v) => !v)}
              className="min-h-[32px] inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Fórmula: {formatFormulaText(formula)}
            </button>
          </div>
        </div>

        {/* Barra rápida para modificar la fórmula d6 en medio de la partida */}
        {showQuickFormula && (
          <div className="border-t border-[var(--arc-border)] bg-[var(--arc-surface-alt)]">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2.5 px-4 sm:px-6 py-2.5 text-xs">
              <span className="font-semibold text-[var(--arc-accent)]">Fórmula rápida d6:</span>
              <label className="inline-flex items-center gap-1.5 text-[var(--arc-muted)]">
                Base
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={formula.base}
                  onChange={(e) =>
                    setFormula({
                      ...formula,
                      base: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="font-mono-num w-12 min-h-[32px] rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)]"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-[var(--arc-muted)]">
                × Nivel
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={formula.multiplier}
                  onChange={(e) =>
                    setFormula({
                      ...formula,
                      multiplier: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="font-mono-num w-12 min-h-[32px] rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)]"
                />
              </label>
              <button
                type="button"
                onClick={() => setFormula({ ...formula, base: 0, multiplier: 1 })}
                className="min-h-[32px] rounded-md px-2.5 text-xs text-[var(--arc-text)] hover:bg-[var(--arc-raised)] transition-colors"
              >
                Solo nivel
              </button>
              <button
                type="button"
                onClick={() => setFormula({ ...formula, base: 1, multiplier: 1 })}
                className="min-h-[32px] rounded-md px-2.5 text-xs text-[var(--arc-text)] hover:bg-[var(--arc-raised)] transition-colors"
              >
                1 + nivel
              </button>
              <button
                type="button"
                onClick={() => setShowQuickFormula(false)}
                className="ml-auto min-h-[32px] px-2 text-xs text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Aviso persistente para revertir borrado de información */}
      {showRevertBanner && undoSnapshot && (
        <div className="border-b border-[#8a6a20] bg-[#2b210e]">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 text-xs">
            <span className="text-[#f5db92]">
              Se borró toda la información anterior y se restauró la base limpia. ¿Querés recuperar los
              datos previos?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRevertReset}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#d4a843] px-3.5 font-semibold text-[#181209] hover:brightness-110"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revertir borrado
              </button>
              <button
                type="button"
                onClick={() => setShowRevertBanner(false)}
                className="min-h-[36px] px-2.5 text-[#cbb893] hover:text-[#efe6d5]"
              >
                Ocultar aviso
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        className={`mx-auto max-w-[1440px] px-3.5 pt-3.5 sm:px-6 sm:pt-6 ${
          activeTab === 'quickcast' ? 'pb-24 md:pb-6' : 'pb-6'
        }`}
      >
        {activeTab === 'arena' && (() => {
          const isEditorVisible = Boolean(showEditor || editingSpell);
          return (
            <div className="space-y-4">
              {/* Barra superior del taller de Grimorio */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-3">
                <div className="text-[13px] text-[var(--arc-muted)]">
                  Taller de grimorio: creá, duplicá y administrá hechizos y maestrías. Explorá hechizos no aprendidos en{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('archive')}
                    className="font-semibold text-[var(--arc-accent)] hover:underline"
                  >
                    Archivo Arcano
                  </button>{' '}
                  o pasá a{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('quickcast')}
                    className="font-semibold text-[var(--arc-accent)] hover:underline"
                  >
                    Combate
                  </button>
                  .
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCustomizer((v) => !v)}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      showCustomizer
                        ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                        : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                    }`}
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Temas y Hex
                  </button>
                </div>
              </div>

              {showCustomizer && (
                <ThemeCustomizer
                  theme={theme}
                  customizeLayoutMode={customizeLayoutMode}
                  isDefaultLayout={isDefaultLayout}
                  onChangeTheme={setTheme}
                  onToggleLayoutMode={() => {
                    setActiveTab('quickcast');
                    setCustomizeLayoutMode((v) => !v);
                  }}
                  onResetLayout={handleResetArenaLayout}
                  onClose={() => setShowCustomizer(false)}
                />
              )}

              {/* Vista de 2 columnas en escritorio cuando el editor está abierto; ancho completo con grilla de 2 columnas cuando está cerrado */}
              <div className="grid gap-5 xl:grid-cols-12 items-start">
                <div
                  className={
                    isEditorVisible ? 'order-2 xl:order-1 xl:col-span-5' : 'xl:col-span-12'
                  }
                >
                  <SpellBookList
                    spells={spells}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    formula={formula}
                    spellOrder={activeSpellOrder}
                    editorOpen={isEditorVisible}
                    onReorderSpells={handleReorderSpells}
                    onResetSpellOrder={handleResetSpellOrder}
                    onNewSpell={() => {
                      setEditingSpell(null);
                      setShowEditor(true);
                    }}
                    onEditSpell={(s) => {
                      setEditingSpell(s);
                      setShowEditor(true);
                    }}
                    onDuplicateSpell={handleDuplicateSpell}
                    onDeleteSpell={handleDeleteSpell}
                    onToggleKnown={handleToggleKnown}
                    onUpdateCharacter={handleUpdateCharacter}
                    onAdjustSpellMastery={handleAdjustSpellMastery}
                    onResetSpellMastery={handleResetSpellMastery}
                    lastMasteryReset={
                      lastMasteryReset &&
                      activeCharacter &&
                      lastMasteryReset.characterId === activeCharacter.id
                        ? {
                            spellId: lastMasteryReset.spellId,
                            spellName: lastMasteryReset.spellName,
                            previousSuccesses: lastMasteryReset.previousSuccesses,
                            previousLevel: lastMasteryReset.previousLevel,
                          }
                        : null
                    }
                    onRevertSpellMastery={handleRevertSpellMastery}
                    onDismissMasteryReset={() => setLastMasteryReset(null)}
                    customExportCount={getPlayerCreatedSpells(activeCharacter).length}
                    onExportCustomSpells={handleExportPlayerSpells}
                    onExportSelectedSpells={handleExportSelectedSpells}
                    onImportCustomSpells={handleImportPlayerSpells}
                    onRestoreBasics={handleRestoreBasics}
                    onOpenCharacterBuilder={() => setActiveTab('characters')}
                    onTestSpell={handleTestSpell}
                  />
                </div>

                {isEditorVisible && (
                  <div className="order-1 xl:order-2 xl:col-span-7 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1 xl:pb-2">
                    <GrimorioEditor
                      activeCharacter={activeCharacter}
                      spells={spells}
                      formula={formula}
                      allOrders={allOrders}
                      allStatuses={allStatuses}
                      editingSpell={editingSpell}
                      onSaveSpell={handleSaveSpell}
                      onCancelEdit={() => {
                        setEditingSpell(null);
                        setShowEditor(false);
                      }}
                      onCreateOrder={(order) =>
                        setCustomOrders((prev) =>
                          prev.includes(order) || PRESET_ORDERS.includes(order)
                            ? prev
                            : [...prev, order]
                        )
                      }
                      onCreateStatus={(status) =>
                        setCustomStatuses((prev) =>
                          prev.includes(status) || PRESET_STATUSES.includes(status)
                            ? prev
                            : [...prev, status]
                        )
                      }
                      onTestSpell={handleTestSpell}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'archive' && (
          <ArcaneArchivePanel
            spells={spells}
            activeCharacter={activeCharacter}
            characters={characters}
            formula={formula}
            onTestSpell={handleTestSpell}
            onLearnBasicSpell={handleLearnBasicFromArchive}
            onLearnAdaptedSpell={handleLearnAdaptedCatalogSpell}
            onCustomizeCatalogSpell={handleCustomizeCatalogSpell}
            onToggleArchiveKeyLock={handleToggleArchiveKeyLock}
            onSetArchiveKeyLocksBulk={handleSetArchiveKeyLocksBulk}
            onToggleUnlockedNature={handleToggleUnlockedNature}
            knowledgeTreeSettings={knowledgeTreeSettings}
            onLearnKnowledgeSpell={handleLearnKnowledgeSpell}
            onSetDisciplineMastery={handleSetDisciplineMastery}
            onToggleDisciplineDiscovery={handleToggleDisciplineDiscovery}
            onUpdateKnowledgeTreeSettings={handleUpdateKnowledgeTreeSettings}
            onToggleArchiveGoal={handleToggleArchiveGoal}
            onGoToGrimorio={() => setActiveTab('arena')}
            onGoToCombat={() => setActiveTab('quickcast')}
          />
        )}

        {activeTab === 'quickcast' && (
          <div className="space-y-4">
            {/* Barra de personalización del tablero de Combate */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-3">
              <div className="text-[13px] text-[var(--arc-muted)]">
                {customizeLayoutMode
                  ? 'Modo edición de cajas activo: arrastrá cada caja desde su barra superior para cambiarla de lado o altura.'
                  : 'Mesa de Combate completa: Casteo rápido, Armas y Catalizadores, enfrentamientos y registro.'}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCustomizer((v) => !v)}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    showCustomizer
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                      : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Temas y Hex
                </button>

                <button
                  type="button"
                  onClick={() => setCustomizeLayoutMode((v) => !v)}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    customizeLayoutMode
                      ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                      : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {customizeLayoutMode ? 'Fijar cajas' : 'Mover cajas'}
                </button>

                <button
                  type="button"
                  onClick={() => setIrlCombatMode((v) => !v)}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    irlCombatMode
                      ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                      : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  <Dice className="h-3.5 w-3.5" />
                  {irlCombatMode ? 'IRL: Activo' : 'Combate IRL'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCustomDice((v) => !v)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
                >
                  <Dice className="h-3.5 w-3.5" />
                  Dados
                </button>

                {!isDefaultLayout && (
                  <button
                    type="button"
                    onClick={handleResetArenaLayout}
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-transparent px-2.5 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar cajas
                  </button>
                )}
              </div>
            </div>

            {showCustomizer && (
              <ThemeCustomizer
                theme={theme}
                customizeLayoutMode={customizeLayoutMode}
                isDefaultLayout={isDefaultLayout}
                onChangeTheme={setTheme}
                onToggleLayoutMode={() => setCustomizeLayoutMode((v) => !v)}
                onResetLayout={handleResetArenaLayout}
                onClose={() => setShowCustomizer(false)}
              />
            )}

            <div className="grid gap-5 xl:grid-cols-12 items-start">
              {renderArenaColumn('left')}
              {renderArenaColumn('right')}
            </div>

            {/* Navegación inferior en celular para Combate */}
            <nav
              aria-label="Navegación rápida de combate"
              className="fixed bottom-0 inset-x-0 z-30 md:hidden border-t border-[var(--arc-border)] bg-[var(--arc-header)]/95 backdrop-blur px-2 py-1.5 shadow-lg"
            >
              <div className="grid grid-cols-5 gap-1">
                {(
                  [
                    { id: 'all', label: 'Todo' },
                    { id: 'grimorio', label: 'Casteo' },
                    { id: 'weapons', label: 'Armas' },
                    { id: 'combat', label: 'Combate', dot: hasPendingCombat },
                    { id: 'log', label: 'Registro' },
                  ] as const
                ).map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setMobileArenaSection(sec.id)}
                    className={`relative min-h-[40px] rounded-lg px-1 text-xs font-semibold transition-colors flex items-center justify-center ${
                      mobileArenaSection === sec.id
                        ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                        : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                    }`}
                  >
                    <span>{sec.label}</span>
                    {'dot' in sec && sec.dot && (
                      <span
                        aria-label="Acción pendiente en combate"
                        className="ml-1 inline-block h-2 w-2 rounded-full bg-[var(--arc-accent)]"
                      />
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        )}

        {activeTab === 'characters' && (
          <CharacterRoster
            characters={characters}
            activeCharacterId={activeCharacter?.id || ''}
            spells={spells}
            formula={formula}
            combatCharacterIds={combatCharacterIds}
            onSelectCharacter={setActiveCharacterId}
            onUpdateCharacter={handleUpdateCharacter}
            onCreateCharacter={handleCreateCharacter}
            onApplyNatureToCharacter={handleApplyNatureToCharacter}
            onDuplicateCharacter={handleDuplicateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onExportCharacter={handleExportCharacter}
            onCopyCharacterCode={handleCopyCharacterCode}
            onImportCharacter={handleImportCharacter}
            onToggleKnownSpell={handleToggleKnownForCharacter}
            onSetKnownSpells={handleSetKnownSpells}
            onAdjustHp={adjustHp}
            onAdjustMana={adjustMana}
            onResetResources={resetResources}
            onAddToCombat={(id) => handleAddToCombat(id, 0)}
          />
        )}

        {activeTab === 'settings' && (
          <FormulaAndBackup
            formula={formula}
            onChangeFormula={handleChangeFormula}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            customSpellCount={getPlayerCreatedSpells(activeCharacter).length}
            onExportCustomSpells={handleExportPlayerSpells}
            canRevertReset={undoSnapshot !== null}
            onResetAllData={handleResetAllData}
            onRevertReset={handleRevertReset}
          />
        )}
      </main>
      {showCombatMechanicsCompendium && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCombatMechanicsCompendium(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="combat-compendium-title"
            className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-[var(--arc-border)] bg-[var(--arc-surface)] shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--arc-border)] px-4 py-3.5 sm:px-5">
              <h2
                id="combat-compendium-title"
                className="font-display text-lg font-bold text-[var(--arc-accent)]"
              >
                Compendio de Combate
              </h2>
              <button
                type="button"
                onClick={() => setShowCombatMechanicsCompendium(false)}
                aria-label="Cerrar Compendio de Combate"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="overflow-y-auto p-4 sm:p-5">
              <CombatMechanicsCompendium
                key={compendiumFocusId || 'all'}
                initialMechanicId={compendiumFocusId}
                onInspect={(mechanicId) =>
                  setCombatMechanicReader({
                    mechanicId,
                    context: { source: 'compendium' },
                  })
                }
              />
            </div>
          </section>
        </div>
      )}
      {combatMechanicReader && (
        <CombatMechanicReader
          mechanicId={combatMechanicReader.mechanicId}
          context={combatMechanicReader.context}
          combatants={combatants}
          characters={characters}
          spells={spells}
          logs={logs}
          onClose={() => setCombatMechanicReader(null)}
          onOpenCompendium={(mechanicId) => {
            setCombatMechanicReader(null);
            setCompendiumFocusId(mechanicId);
            setShowCombatMechanicsCompendium(true);
          }}
          onInspectRelated={(mechanicId) =>
            setCombatMechanicReader({ mechanicId, context: { source: 'compendium' } })
          }
        />
      )}

      <CustomDiceRoller
        open={showCustomDice}
        onClose={() => setShowCustomDice(false)}
        onRoll={handleRollCustomDice}
      />
    </div>
  );
}