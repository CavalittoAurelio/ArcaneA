import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  Eye,
  Filter,
  Flame,
  GripVertical,
  LayoutGrid,
  LayoutList,
  Link2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Tag,
  Square,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Character, DieType, FormulaConfig, Spell, SpellEffectType } from '../types/rpg';
import {
  DIE_TYPES,
  ELEMENTAL_STATUS_META,
  STAT_NAMES,
  SYNERGY_LABELS,
  characterHasNatureCanalizado,
  detectSpellSynergy,
  formatCollateralValue,
  formatSpellDependencyLine,
  formatTurnDuration,
  getCharacterStatDice,
  getEffectiveDefenseManaCost,
  getEffectiveEffectSubType,
  getEffectiveSpellDamageDice,
  getEffectiveSpellDamageKind,
  getSpellCastRequirement,
  getSpellCategory,
  getSpellMasteryStatus,
  isFireDamageSpell,
  isSonicSpell,
  isSpellMagical,
  parseDurationTurns,
  spellSupportsMastery,
  type SpellCategory,
} from '../utils/dice';
import { KNOWLEDGE_TREE_SPELLS } from '../utils/knowledgeTrees';

const KNOWLEDGE_TREE_SPELL_IDS = new Set(KNOWLEDGE_TREE_SPELLS.map((s) => s.id));
import { SpellCategoryIcon } from './SpellCategoryIcon';
import { SpellInspector } from './SpellInspector';

interface SpellBookListProps {
  spells: Spell[];
  activeCharacter: Character | undefined;
  characters: Character[];
  formula: FormulaConfig;
  spellOrder: string[];
  editorOpen?: boolean;
  onReorderSpells: (newOrder: string[]) => void;
  onResetSpellOrder: () => void;
  onNewSpell?: () => void;
  onEditSpell: (spell: Spell) => void;
  onDuplicateSpell: (spell: Spell) => void;
  onDeleteSpell: (spellId: string) => void;
  onToggleKnown: (spellId: string) => void;
  onUpdateCharacter: (updated: Character) => void;
  onAdjustSpellMastery: (spellId: string, delta: number) => void;
  onResetSpellMastery?: (spellId: string) => void;
  lastMasteryReset?: {
    spellId: string;
    spellName: string;
    previousSuccesses: number;
    previousLevel: number;
  } | null;
  onRevertSpellMastery?: () => void;
  onDismissMasteryReset?: () => void;
  customExportCount?: number;
  onExportCustomSpells?: () => { ok: boolean; count: number; message: string };
  onExportSelectedSpells?: (spellIds: string[]) => { ok: boolean; count: number; message: string };
  onImportCustomSpells?: (jsonText: string) => { ok: boolean; message: string };
  onRestoreBasics: () => void;
  onOpenCharacterBuilder?: () => void;
  onTestSpell?: (spell: Spell) => void;
}

type SpellFilterValue = 'all' | SpellCategory;
type SpellOriginFilter = 'all' | 'base' | 'custom';
type NatureFilterValue = 'all' | 'magico' | 'fisico';
type DieFilterValue = 'all' | DieType;
type ViewDensity = 'detailed' | 'compact';

const FILTER_OPTIONS: Array<{ value: SpellFilterValue; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'damage', label: 'Ataque' },
  { value: 'defense', label: 'Defensa' },
  { value: 'heal', label: 'Curación' },
  { value: 'buff', label: 'Buffs' },
  { value: 'debuff', label: 'Debuffs' },
  { value: 'effect', label: 'Efectos' },
];

const CATEGORY_META: Record<
  SpellCategory,
  { label: string; shortLabel: string; bg: string; border: string; accent: string; text: string }
> = {
  damage: {
    label: 'Ataque',
    shortLabel: 'Ataque',
    bg: 'var(--arc-cat-damage-bg)',
    border: 'var(--arc-cat-damage-border)',
    accent: 'var(--arc-cat-damage-accent)',
    text: 'var(--arc-cat-damage-text)',
  },
  defense: {
    label: 'Defensa',
    shortLabel: 'Defensa',
    bg: 'var(--arc-cat-defense-bg)',
    border: 'var(--arc-cat-defense-border)',
    accent: 'var(--arc-cat-defense-accent)',
    text: 'var(--arc-cat-defense-text)',
  },
  heal: {
    label: 'Curación',
    shortLabel: 'Curación',
    bg: 'var(--arc-cat-heal-bg)',
    border: 'var(--arc-cat-heal-border)',
    accent: 'var(--arc-cat-heal-accent)',
    text: 'var(--arc-cat-heal-text)',
  },
  buff: {
    label: 'Buff',
    shortLabel: 'Buff',
    bg: 'var(--arc-cat-buff-bg)',
    border: 'var(--arc-cat-buff-border)',
    accent: 'var(--arc-cat-buff-accent)',
    text: 'var(--arc-cat-buff-text)',
  },
  debuff: {
    label: 'Debuff',
    shortLabel: 'Debuff',
    bg: 'var(--arc-cat-debuff-bg)',
    border: 'var(--arc-cat-debuff-border)',
    accent: 'var(--arc-cat-debuff-accent)',
    text: 'var(--arc-cat-debuff-text)',
  },
  effect: {
    label: 'Efecto',
    shortLabel: 'Efecto',
    bg: 'var(--arc-cat-effect-bg)',
    border: 'var(--arc-cat-effect-border)',
    accent: 'var(--arc-cat-effect-accent)',
    text: 'var(--arc-cat-effect-text)',
  },
};

const CATEGORY_ORDER: SpellCategory[] = [
  'damage',
  'defense',
  'heal',
  'buff',
  'debuff',
  'effect',
];

const TYPE_LABELS: Record<SpellEffectType, string> = {
  damage: 'Ataque / Daño',
  defense: 'Defensa',
  heal: 'Curación',
  effect: 'Efecto',
};

function normalizeFuzzyText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function boundedLevenshtein(a: string, b: string, maxDist: number): number {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let prev = Array.from({ length: lenB + 1 }, (_, i) => i);
  for (let i = 1; i <= lenA; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr.push(val);
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    prev = curr;
  }
  return prev[lenB];
}

function isOrderedSubsequence(needle: string, haystack: string): boolean {
  if (needle.length < 3) return false;
  let ni = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) {
      if (firstMatch === -1) firstMatch = hi;
      lastMatch = hi;
      ni++;
    }
  }
  if (ni < needle.length) return false;
  return lastMatch - firstMatch <= needle.length * 3;
}

/**
 * Puntúa coincidencia difusa (0 = no coincide; > 0 = mayor relevancia).
 * Soporta acentos omitidos, coincidencias parciales, subsecuencias y typos leves.
 */
function scoreFuzzySpellMatch(query: string, spellName: string, extraText: string): number {
  const normQ = normalizeFuzzyText(query);
  if (!normQ) return 1;

  const normName = normalizeFuzzyText(spellName);
  const normExtra = normalizeFuzzyText(extraText);
  const fullCorpus = `${normName} ${normExtra}`.trim();

  if (normName === normQ) return 120;
  if (normName.startsWith(normQ)) return 100;
  if (normName.includes(normQ)) return 85;
  if (normExtra.includes(normQ)) return 65;

  const queryTokens = normQ.split(' ').filter(Boolean);
  const corpusWords = fullCorpus.split(' ').filter(Boolean);
  const nameWords = normName.split(' ').filter(Boolean);

  let totalScore = 0;
  for (const token of queryTokens) {
    if (normName.includes(token)) {
      totalScore += 32;
      continue;
    }
    if (normExtra.includes(token)) {
      totalScore += 20;
      continue;
    }

    if (token.length >= 4) {
      const allowedDist = token.length >= 7 ? 2 : 1;
      let bestWordScore = 0;

      for (const w of nameWords) {
        if (w.length < 3) continue;
        const dist = boundedLevenshtein(token, w, allowedDist);
        if (dist <= allowedDist) {
          bestWordScore = Math.max(bestWordScore, 26 - dist * 7);
        }
      }

      if (bestWordScore === 0) {
        for (const w of corpusWords) {
          if (w.length < 3) continue;
          const dist = boundedLevenshtein(token, w, allowedDist);
          if (dist <= allowedDist) {
            bestWordScore = Math.max(bestWordScore, 16 - dist * 5);
          }
        }
      }

      if (bestWordScore > 0) {
        totalScore += bestWordScore;
        continue;
      }
    }

    if (isOrderedSubsequence(token, normName)) {
      totalScore += 14;
      continue;
    }

    return 0;
  }

  return totalScore;
}

function getSpellAppliedStatusLabels(spell: Spell): string[] {
  const labels = new Set<string>();
  for (const st of spell.statuses || []) {
    if (st.trim()) labels.add(st.trim());
  }
  if (spell.elementalStatus?.kind) {
    labels.add(ELEMENTAL_STATUS_META[spell.elementalStatus.kind].name);
  }
  if (isFireDamageSpell(spell)) {
    labels.add(ELEMENTAL_STATUS_META.burn.name);
  }
  const syn = detectSpellSynergy(spell);
  if (syn !== 'none') {
    labels.add(SYNERGY_LABELS[syn]);
  }
  return Array.from(labels);
}
interface ParsedImportSpellItem {
  raw: Record<string, unknown>;
  name: string;
  manaCost: number;
  orders: string[];
}

interface PendingSpellPackImport {
  fileName: string;
  items: ParsedImportSpellItem[];
  selectedIndices: number[];
  customOrders?: string[];
  customStatuses?: string[];
}

function parseSpellPackForPreview(rawText: string): Omit<PendingSpellPackImport, 'fileName'> | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  let jsonCandidate = trimmed;
  const arcaneMatch = trimmed.match(/ARCANE1:[A-Za-z0-9+/_=-]+/);
  if (arcaneMatch) {
    try {
      const encoded = arcaneMatch[0].slice('ARCANE1:'.length).trim();
      const standardBase64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = standardBase64.padEnd(
        standardBase64.length + ((4 - (standardBase64.length % 4)) % 4),
        '='
      );
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      jsonCandidate = new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  } else {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    } else {
      const firstBracket = trimmed.indexOf('[');
      const lastBracket = trimmed.lastIndexOf(']');
      if (firstBracket >= 0 && lastBracket > firstBracket) {
        jsonCandidate = trimmed.slice(firstBracket, lastBracket + 1);
      }
    }
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as
      | Array<Record<string, unknown>>
      | {
          spells?: Array<Record<string, unknown>>;
          customOrders?: string[];
          customStatuses?: string[];
        };

    const rawList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.spells)
        ? parsed.spells
        : [];

    const items: ParsedImportSpellItem[] = rawList
      .filter((sp) => sp && typeof sp.name === 'string' && sp.name.trim().length > 0)
      .map((sp) => ({
        raw: sp,
        name: String(sp.name).trim(),
        manaCost: Number(sp.manaCost || 0),
        orders: Array.isArray(sp.orders) ? sp.orders.map(String) : [],
      }));

    if (items.length === 0) return null;

    return {
      items,
      selectedIndices: items.map((_, idx) => idx),
      customOrders: !Array.isArray(parsed) && Array.isArray(parsed.customOrders) ? parsed.customOrders : undefined,
      customStatuses: !Array.isArray(parsed) && Array.isArray(parsed.customStatuses) ? parsed.customStatuses : undefined,
    };
  } catch {
    return null;
  }
}
export function SpellBookList({
  spells,
  activeCharacter,
  characters,
  formula,
  spellOrder,
  editorOpen = false,
  onReorderSpells,
  onResetSpellOrder,
  onNewSpell,
  onEditSpell,
  onDuplicateSpell,
  onDeleteSpell,
  onToggleKnown,
  onUpdateCharacter,
  onAdjustSpellMastery,
  onResetSpellMastery,
  lastMasteryReset,
  onRevertSpellMastery,
  onDismissMasteryReset,
  customExportCount = 0,
  onExportCustomSpells,
  onExportSelectedSpells,
  onImportCustomSpells,
  onRestoreBasics,
  onOpenCharacterBuilder,
  onTestSpell,
}: SpellBookListProps) {
  const importFileRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState<SpellOriginFilter>('all');
  const [filter, setFilter] = useState<SpellFilterValue>('all');
  const [manaMinInput, setManaMinInput] = useState('');
  const [manaMaxInput, setManaMaxInput] = useState('');
  const [dieFilter, setDieFilter] = useState<DieFilterValue>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [natureFilter, setNatureFilter] = useState<NatureFilterValue>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [showSummaryCategories, setShowSummaryCategories] = useState(false);
  const [viewDensity, setViewDensity] = useState<ViewDensity>('detailed');
  const [scope, setScope] = useState<'known' | 'library'>('known');
  const [showOtherOwners, setShowOtherOwners] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [selectExportMode, setSelectExportMode] = useState(false);
  const [selectedSpellIds, setSelectedSpellIds] = useState<string[]>([]);
  const [draggedSpellId, setDraggedSpellId] = useState<string | null>(null);
  const [dragOverSpellId, setDragOverSpellId] = useState<string | null>(null);
  const [confirmResetSpellId, setConfirmResetSpellId] = useState<string | null>(null);
  const [expandedCompactSpellIds, setExpandedCompactSpellIds] = useState<Set<string>>(new Set());
  const [openCompactMenuSpellId, setOpenCompactMenuSpellId] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedPersonalTag, setSelectedPersonalTag] = useState('');
  const [tagEditorSpellId, setTagEditorSpellId] = useState<string | null>(null);
  const [newPersonalTag, setNewPersonalTag] = useState('');
  const [renamingPersonalTag, setRenamingPersonalTag] = useState<string | null>(null);
  const [renamedPersonalTag, setRenamedPersonalTag] = useState('');
  const [transferNotice, setTransferNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [pendingSpellImport, setPendingSpellImport] = useState<PendingSpellPackImport | null>(null);
  const [expandImportPreview, setExpandImportPreview] = useState(false);
  const [inspectedSpell, setInspectedSpell] = useState<Spell | null>(null);

  const selectedSpellSet = useMemo(() => new Set(selectedSpellIds), [selectedSpellIds]);

  const toggleSelectSpell = (spellId: string) => {
    setSelectedSpellIds((prev) =>
      prev.includes(spellId) ? prev.filter((id) => id !== spellId) : [...prev, spellId]
    );
  };

  const knownIds = useMemo(
    () => new Set(activeCharacter?.knownSpells || []),
    [activeCharacter?.knownSpells]
  );

  const hasNatureCanalizado = useMemo(
    () => characterHasNatureCanalizado(activeCharacter, spells),
    [activeCharacter, spells]
  );

  const libraryForActive = useMemo(
    () =>
      spells.filter((s) => {
        if (s.isAdaptableTemplate || KNOWLEDGE_TREE_SPELL_IDS.has(s.id)) return false;
        if (
          !showOtherOwners &&
          s.id === 'basic_ataque_canalizado' &&
          hasNatureCanalizado &&
          !knownIds.has(s.id)
        ) {
          return false;
        }
        return (
          showOtherOwners ||
          s.isBasic ||
          !s.ownerCharacterId ||
          s.ownerCharacterId === activeCharacter?.id
        );
      }),
    [spells, showOtherOwners, activeCharacter?.id, hasNatureCanalizado, knownIds]
  );

  const orderIndexMap = useMemo(
    () => new Map(spellOrder.map((id, idx) => [id, idx])),
    [spellOrder]
  );
  const hasCustomOrder = spellOrder.length > 0;
  const favoriteIds = useMemo(
    () => new Set(activeCharacter?.favoriteSpellIds || []),
    [activeCharacter?.favoriteSpellIds]
  );
  const personalTagNames = activeCharacter?.personalSpellTagNames || [];
  const sortMode = activeCharacter?.spellSortMode || 'custom';

  const updateActiveCharacter = (update: (character: Character) => Character) => {
    if (activeCharacter) onUpdateCharacter(update(activeCharacter));
  };

  const scopeSpells = useMemo(() => {
    const compareDefault = (a: Spell, b: Spell) => {
      if (a.isBasic && !b.isBasic) return -1;
      if (!a.isBasic && b.isBasic) return 1;
      return a.name.localeCompare(b.name);
    };

    const compareWithCustom = (a: Spell, b: Spell) => {
      const idxA = orderIndexMap.get(a.id);
      const idxB = orderIndexMap.get(b.id);
      if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
      if (idxA !== undefined) return -1;
      if (idxB !== undefined) return 1;
      return compareDefault(a, b);
    };

    const result = spells.filter((s) => {
      if (scope === 'known') return knownIds.has(s.id);
      if (s.isAdaptableTemplate || KNOWLEDGE_TREE_SPELL_IDS.has(s.id)) return false;
      if (
        !showOtherOwners &&
        s.id === 'basic_ataque_canalizado' &&
        hasNatureCanalizado &&
        !knownIds.has(s.id)
      ) {
        return false;
      }
      return (
        showOtherOwners ||
        s.isBasic ||
        !s.ownerCharacterId ||
        s.ownerCharacterId === activeCharacter?.id
      );
    });

    return result.sort((a, b) => {
      if (sortMode === 'custom') return compareWithCustom(a, b);
      if (sortMode === 'favorites') {
        const favoriteDiff = Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id));
        return favoriteDiff || a.name.localeCompare(b.name);
      }
      if (sortMode === 'category') {
        const categoryDiff =
          CATEGORY_ORDER.indexOf(getSpellCategory(a)) - CATEGORY_ORDER.indexOf(getSpellCategory(b));
        return categoryDiff || a.name.localeCompare(b.name);
      }
      if (sortMode === 'mana') {
        const manaDiff =
          getEffectiveDefenseManaCost(activeCharacter, a).cost -
          getEffectiveDefenseManaCost(activeCharacter, b).cost;
        return manaDiff || a.name.localeCompare(b.name);
      }
      if (sortMode === 'nature') {
        const natureA =
          a.effectType === 'damage'
            ? getEffectiveSpellDamageKind(a)
            : isSpellMagical(a)
              ? 'magico'
              : 'fisico';
        const natureB =
          b.effectType === 'damage'
            ? getEffectiveSpellDamageKind(b)
            : isSpellMagical(b)
              ? 'magico'
              : 'fisico';
        return natureA.localeCompare(natureB) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    spells,
    scope,
    knownIds,
    showOtherOwners,
    activeCharacter,
    hasNatureCanalizado,
    orderIndexMap,
    sortMode,
    favoriteIds,
  ]);

  const availableStatusesInScope = useMemo(() => {
    const map = new Map<string, number>();
    for (const sp of scopeSpells) {
      for (const lbl of getSpellAppliedStatusLabels(sp)) {
        map.set(lbl, (map.get(lbl) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [scopeSpells]);

  const grimorioSummary = useMemo(() => {
    const knownList = spells.filter((s) => knownIds.has(s.id));
    const counts: Record<SpellCategory, number> = {
      damage: 0,
      defense: 0,
      heal: 0,
      buff: 0,
      debuff: 0,
      effect: 0,
    };
    let customKnown = 0;
    let masteryActive = 0;
    let masteryNearLevelUp = 0;

    for (const sp of knownList) {
      counts[getSpellCategory(sp)] += 1;
      if (!sp.isBasic) customKnown += 1;
      if (activeCharacter && spellSupportsMastery(sp)) {
        const raw = activeCharacter.spellMastery?.[sp.id] || 0;
        if (raw > 0) {
          masteryActive += 1;
          const st = getSpellMasteryStatus(raw, formula);
          if (!st.isMaxLevel && st.progressPct >= 70) {
            masteryNearLevelUp += 1;
          }
        }
      }
    }

    return {
      totalKnown: knownList.length,
      customKnown,
      masteryActive,
      masteryNearLevelUp,
      counts,
    };
  }, [spells, knownIds, activeCharacter, formula]);

  const baseCount = scopeSpells.filter((s) => s.isBasic).length;
  const customCount = scopeSpells.length - baseCount;

  const parsedManaMin =
    manaMinInput.trim() !== '' && !Number.isNaN(Number(manaMinInput))
      ? Math.max(0, Math.floor(Number(manaMinInput)))
      : null;
  const parsedManaMax =
    manaMaxInput.trim() !== '' && !Number.isNaN(Number(manaMaxInput))
      ? Math.max(0, Math.floor(Number(manaMaxInput)))
      : null;

  const visibleSpells = useMemo(() => {
    const scored: Array<{ spell: Spell; score: number }> = [];

    for (const s of scopeSpells) {
      if (originFilter === 'base' && !s.isBasic) continue;
      if (originFilter === 'custom' && s.isBasic) continue;

      if (filter !== 'all' && getSpellCategory(s) !== filter) continue;

      const effectiveCost = getEffectiveDefenseManaCost(activeCharacter, s).cost;
      if (parsedManaMin !== null && effectiveCost < parsedManaMin) continue;
      if (parsedManaMax !== null && effectiveCost > parsedManaMax) continue;

      if (dieFilter !== 'all') {
        const mastery = activeCharacter
          ? getSpellMasteryStatus(activeCharacter.spellMastery?.[s.id] || 0, formula)
          : undefined;
        const effectiveDice =
          s.effectType === 'damage' && mastery
            ? getEffectiveSpellDamageDice(s, mastery)
            : s.damage?.dice || [];
        const hasDamageDie = effectiveDice.some((d) => d.type === dieFilter && d.count > 0);
        const hasTickDie = s.elementalStatus?.tickDie === dieFilter;
        const hasCollateralDie = Boolean(
          s.collateral?.dice?.some((d) => d.type === dieFilter && d.count > 0)
        );
        if (!hasDamageDie && !hasTickDie && !hasCollateralDie) continue;
      }

      if (statusFilter !== 'all') {
        const appliedLabels = getSpellAppliedStatusLabels(s);
        if (!appliedLabels.includes(statusFilter)) continue;
      }

      if (natureFilter !== 'all') {
        const magical =
          s.effectType === 'damage'
            ? getEffectiveSpellDamageKind(s) === 'magico'
            : isSpellMagical(s);
        if (natureFilter === 'magico' && !magical) continue;
        if (natureFilter === 'fisico' && magical) continue;
      }

      if (favoritesOnly && !favoriteIds.has(s.id)) continue;
      if (
        selectedPersonalTag &&
        !(activeCharacter?.personalSpellTags?.[s.id] || []).includes(selectedPersonalTag)
      ) {
        continue;
      }

      if (searchQuery.trim()) {
        const extraCorpus = [
          s.effectDescription,
          s.damage?.notes || '',
          ...(s.orders || []),
          ...getSpellAppliedStatusLabels(s),
          s.armorConfig?.element || '',
          s.dependency?.enabled ? s.dependency.requiredName : '',
        ].join(' ');
        const matchScore = scoreFuzzySpellMatch(searchQuery, s.name, extraCorpus);
        if (matchScore <= 0) continue;
        scored.push({ spell: s, score: matchScore });
      } else {
        scored.push({ spell: s, score: 1 });
      }
    }

    if (searchQuery.trim()) {
      scored.sort((a, b) => b.score - a.score);
    }

    return scored.map((entry) => entry.spell);
  }, [
    scopeSpells,
    originFilter,
    filter,
    parsedManaMin,
    parsedManaMax,
    dieFilter,
    statusFilter,
    natureFilter,
    searchQuery,
    activeCharacter,
    formula,
    favoritesOnly,
    favoriteIds,
    selectedPersonalTag,
  ]);

  const activeAdvancedFilterCount =
    (originFilter !== 'all' ? 1 : 0) +
    (filter !== 'all' ? 1 : 0) +
    (parsedManaMin !== null || parsedManaMax !== null ? 1 : 0) +
    (dieFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (natureFilter !== 'all' ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (selectedPersonalTag !== '' ? 1 : 0);

  const hasActiveFilters = searchQuery.trim().length > 0 || activeAdvancedFilterCount > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setOriginFilter('all');
    setFilter('all');
    setManaMinInput('');
    setManaMaxInput('');
    setDieFilter('all');
    setStatusFilter('all');
    setNatureFilter('all');
    setFavoritesOnly(false);
    setSelectedPersonalTag('');
  };

  const toggleFavorite = (spellId: string) => {
    updateActiveCharacter((character) => {
      const current = character.favoriteSpellIds || [];
      return {
        ...character,
        favoriteSpellIds: current.includes(spellId)
          ? current.filter((id) => id !== spellId)
          : [...current, spellId],
      };
    });
  };

  const toggleSpellTag = (spellId: string, tag: string) => {
    updateActiveCharacter((character) => {
      const current = character.personalSpellTags || {};
      const spellTags = current[spellId] || [];
      const nextTags = spellTags.includes(tag)
        ? spellTags.filter((item) => item !== tag)
        : [...spellTags, tag];
      return {
        ...character,
        personalSpellTags: { ...current, [spellId]: nextTags },
      };
    });
  };

  const createPersonalTag = () => {
    const tag = newPersonalTag.trim();
    if (!tag || personalTagNames.some((name) => name.toLocaleLowerCase() === tag.toLocaleLowerCase()))
      return;
    updateActiveCharacter((character) => ({
      ...character,
      personalSpellTagNames: [...(character.personalSpellTagNames || []), tag],
    }));
    setNewPersonalTag('');
  };

  const renamePersonalTag = (previousName: string) => {
    const nextName = renamedPersonalTag.trim();
    if (
      !nextName ||
      personalTagNames.some(
        (name) => name !== previousName && name.toLocaleLowerCase() === nextName.toLocaleLowerCase()
      )
    )
      return;
    updateActiveCharacter((character) => ({
      ...character,
      personalSpellTagNames: (character.personalSpellTagNames || []).map((name) =>
        name === previousName ? nextName : name
      ),
      personalSpellTags: Object.fromEntries(
        Object.entries(character.personalSpellTags || {}).map(([spellId, tags]) => [
          spellId,
          tags.map((tag) => (tag === previousName ? nextName : tag)),
        ])
      ),
    }));
    if (selectedPersonalTag === previousName) setSelectedPersonalTag(nextName);
    setRenamingPersonalTag(null);
    setRenamedPersonalTag('');
  };

  const deletePersonalTag = (tagToDelete: string) => {
    updateActiveCharacter((character) => ({
      ...character,
      personalSpellTagNames: (character.personalSpellTagNames || []).filter(
        (tag) => tag !== tagToDelete
      ),
      personalSpellTags: Object.fromEntries(
        Object.entries(character.personalSpellTags || {}).map(([spellId, tags]) => [
          spellId,
          tags.filter((tag) => tag !== tagToDelete),
        ])
      ),
    }));
    if (selectedPersonalTag === tagToDelete) setSelectedPersonalTag('');
  };

  const renderSpellOrganizationControls = (spell: Spell) => {
    const assignedTags = activeCharacter?.personalSpellTags?.[spell.id] || [];
    const isFavorite = favoriteIds.has(spell.id);
    const editorOpenForSpell = tagEditorSpellId === spell.id;

    return (
      <div className="flex flex-wrap items-center gap-1">
        {assignedTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 py-0.5 text-[11px] text-[var(--arc-muted)]"
          >
            {tag}
          </span>
        ))}
        <div className="relative flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(spell.id);
            }}
            aria-label={
              isFavorite ? `Quitar ${spell.name} de favoritos` : `Marcar ${spell.name} como favorito`
            }
            aria-pressed={isFavorite}
            title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
            className={`inline-flex min-h-[34px] w-8 items-center justify-center rounded-md ${
              isFavorite
                ? 'text-[var(--arc-accent)]'
                : 'text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
            }`}
          >
            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setTagEditorSpellId(editorOpenForSpell ? null : spell.id);
            }}
            aria-label={`Organizar etiquetas de ${spell.name}`}
            aria-expanded={editorOpenForSpell}
            className={`inline-flex min-h-[34px] items-center justify-center gap-1 rounded-md px-2 text-xs ${
              assignedTags.length > 0
                ? 'text-[var(--arc-accent)]'
                : 'text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            {assignedTags.length > 0 && <span>{assignedTags.length}</span>}
          </button>
          {editorOpenForSpell && (
            <div
              onClick={(event) => event.stopPropagation()}
              className="absolute right-0 top-9 z-30 min-w-44 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-raised)] p-2 shadow-xl"
            >
              {personalTagNames.length === 0 ? (
                <p className="max-w-44 text-xs text-[var(--arc-muted)]">
                  Creá etiquetas en el panel de filtros.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {personalTagNames.map((tag) => (
                    <label
                      key={tag}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-xs text-[var(--arc-text)] hover:bg-[var(--arc-input)]"
                    >
                      <input
                        type="checkbox"
                        checked={assignedTags.includes(tag)}
                        onChange={() => toggleSpellTag(spell.id, tag)}
                        className="h-4 w-4 accent-[var(--arc-accent)]"
                      />
                      <span className="max-w-40 truncate">{tag}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const commitVisibleOrder = (nextVisibleIds: string[]) => {
    const visibleSet = new Set(nextVisibleIds);
    const baseScopeIds = scopeSpells.map((s) => s.id);
    let pointer = 0;
    const mergedScopeIds = baseScopeIds.map((id) =>
      visibleSet.has(id) ? nextVisibleIds[pointer++] : id
    );
    const scopeSet = new Set(mergedScopeIds);
    const remainingIds = [
      ...spellOrder.filter((id) => !scopeSet.has(id)),
      ...spells.map((s) => s.id).filter((id) => !scopeSet.has(id) && !spellOrder.includes(id)),
    ];
    onReorderSpells([...mergedScopeIds, ...remainingIds]);
  };

  const handleMoveSpellStep = (spellId: string, direction: -1 | 1) => {
    const ids = visibleSpells.map((s) => s.id);
    const currentIdx = ids.indexOf(spellId);
    const targetIdx = currentIdx + direction;
    if (currentIdx < 0 || targetIdx < 0 || targetIdx >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(currentIdx, 1);
    next.splice(targetIdx, 0, moved);
    commitVisibleOrder(next);
  };

  const handleDropSpellInsideGrimorio = (targetSpellId: string) => {
    if (!draggedSpellId || draggedSpellId === targetSpellId) {
      setDraggedSpellId(null);
      setDragOverSpellId(null);
      return;
    }
    const ids = visibleSpells.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedSpellId);
    const toIdx = ids.indexOf(targetSpellId);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggedSpellId(null);
      setDragOverSpellId(null);
      return;
    }
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    commitVisibleOrder(next);
    setDraggedSpellId(null);
    setDragOverSpellId(null);
  };

  const gridClass =
    viewDensity === 'compact'
      ? 'grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]'
      : editorOpen
        ? 'grid gap-3.5 grid-cols-1'
        : 'grid gap-3.5 grid-cols-1 md:grid-cols-2';

  const isManaPresetActive = (minVal: string, maxVal: string) =>
    manaMinInput === minVal && manaMaxInput === maxVal;

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
      {/* Cabecera del Grimorio */}
      <div className="flex flex-col gap-3 border-b border-[var(--arc-border)] pb-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)] truncate">
              Grimorio de {activeCharacter?.name || 'Personaje'}
            </h2>
            <p className="text-xs sm:text-[13px] text-[var(--arc-muted)] mt-0.5">
              {scope === 'known'
                ? `Mostrando ${visibleSpells.length} de ${knownIds.size} hechizo(s) aprendido(s)`
                : `Biblioteca (${visibleSpells.length} de ${libraryForActive.length} disponibles)`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex p-0.5 rounded-lg bg-[var(--arc-input)]">
              <button
                type="button"
                onClick={() => setScope('known')}
                className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  scope === 'known'
                    ? 'bg-[var(--arc-raised)] text-[var(--arc-text)]'
                    : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                Aprendidos <span className="font-mono-num">({knownIds.size})</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('library')}
                className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  scope === 'library'
                    ? 'bg-[var(--arc-raised)] text-[var(--arc-text)]'
                    : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                Biblioteca <span className="font-mono-num">({libraryForActive.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileTools((v) => !v)}
              aria-expanded={showMobileTools}
              className={`sm:hidden min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                showMobileTools
                  ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-text)]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Opciones
            </button>
          </div>
        </div>

        {/* Barra de herramientas */}
        <div
          className={`${
            showMobileTools ? 'flex' : 'hidden sm:flex'
          } flex-wrap items-center gap-1.5`}
        >
          <div
            className="flex p-0.5 rounded-lg bg-[var(--arc-input)]"
            role="group"
            aria-label="Densidad de tarjetas"
          >
            <button
              type="button"
              onClick={() => setViewDensity('detailed')}
              title="Vista detallada con toda la ficha y maestría"
              className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                viewDensity === 'detailed'
                  ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Detallado
            </button>
            <button
              type="button"
              onClick={() => setViewDensity('compact')}
              title="Vista compacta para explorar muchos hechizos"
              className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                viewDensity === 'compact'
                  ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Compacto
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !reorderMode;
              setReorderMode(next);
              if (next) {
                setSelectExportMode(false);
                updateActiveCharacter((character) => ({
                  ...character,
                  spellSortMode: 'custom',
                }));
              }
            }}
            className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              reorderMode
                ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                : 'bg-[var(--arc-input)] sm:bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {reorderMode ? 'Listo' : 'Ordenar'}
          </button>

          {hasCustomOrder && (
            <button
              type="button"
              onClick={onResetSpellOrder}
              title="Volver al orden alfabético base"
              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-transparent px-2 py-1.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              A-Z
            </button>
          )}

          {onExportCustomSpells && (
            <button
              type="button"
              disabled={customExportCount === 0}
              onClick={() => {
                const res = onExportCustomSpells();
                setTransferNotice({ ok: res.ok, message: res.message });
              }}
              title={
                customExportCount === 0
                  ? 'Creá al menos un hechizo propio para compartir'
                  : `Descargar ${customExportCount} hechizo(s) propio(s) en .txt`
              }
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--arc-accent)] hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Compartir propios <span className="font-mono-num">({customExportCount})</span>
            </button>
          )}

          {onExportSelectedSpells && (
            <button
              type="button"
              onClick={() => {
                setSelectExportMode((v) => {
                  const next = !v;
                  if (next) {
                    setReorderMode(false);
                  } else {
                    setSelectedSpellIds([]);
                  }
                  return next;
                });
              }}
              title="Elegir manualmente qué hechizos exportar en .txt"
              className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectExportMode
                  ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                  : 'bg-[var(--arc-input)] sm:bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              {selectExportMode ? 'Salir de selección' : 'Compartir seleccionados'}
            </button>
          )}
          
          {onImportCustomSpells && (
            <>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                title="Importar archivo .txt o .json de hechizos propios"
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-input)] sm:bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Importar
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".txt,.json,text/plain,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const raw = String(reader.result || '');
                    const preview = parseSpellPackForPreview(raw);
                    if (!preview) {
                      setTransferNotice({
                        ok: false,
                        message: 'El archivo seleccionado no contiene hechizos propios válidos.',
                      });
                      setPendingSpellImport(null);
                      return;
                    }
                    setTransferNotice(null);
                    setExpandImportPreview(false);
                    setPendingSpellImport({
                      fileName: file.name,
                      ...preview,
                    });
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </>
          )}

          <button
            type="button"
            onClick={onRestoreBasics}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-input)] sm:bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar básicos
          </button>
        </div>
      </div>

      {/* Panel resumen compacto del Grimorio */}
      {activeCharacter && (
        <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3 sm:px-3.5 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[var(--arc-muted)]">
                Aprendidos:{' '}
                <strong className="font-mono-num text-[var(--arc-text)]">
                  {grimorioSummary.totalKnown}
                </strong>
              </span>
              <span className="text-[var(--arc-border-strong)]" aria-hidden="true">
                ·
              </span>
              <span className="text-[var(--arc-muted)]">
                Propios:{' '}
                <strong className="font-mono-num text-[var(--arc-accent)]">
                  {grimorioSummary.customKnown}
                </strong>
              </span>
              <span className="text-[var(--arc-border-strong)]" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--arc-muted)]">
                <Award className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                Maestría:{' '}
                <strong className="font-mono-num text-[var(--arc-text)]">
                  {grimorioSummary.masteryActive}
                </strong>
                {grimorioSummary.masteryNearLevelUp > 0 && (
                  <span className="text-[var(--arc-cat-buff-accent)] font-semibold">
                    ({grimorioSummary.masteryNearLevelUp} cerca)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSummaryCategories((v) => !v)}
                aria-expanded={showSummaryCategories}
                className="min-h-[28px] inline-flex items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap transition-colors"
              >
                <span>Desglose</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showSummaryCategories ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {onNewSpell && !editorOpen && (
                <button
                  type="button"
                  onClick={onNewSpell}
                  className="min-h-[28px] inline-flex items-center gap-1 text-xs font-semibold text-[var(--arc-accent)] hover:underline whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear hechizo
                </button>
              )}
            </div>
          </div>

          {showSummaryCategories && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 border-t border-[var(--arc-border)]/60 pb-0.5 sm:flex-wrap sm:overflow-visible">
              {CATEGORY_ORDER.map((cat) => {
                const meta = CATEGORY_META[cat];
                const count = grimorioSummary.counts[cat];
                const isSelected = filter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilter((curr) => (curr === cat ? 'all' : cat))}
                    style={{
                      backgroundColor: isSelected ? meta.bg : 'transparent',
                      borderColor: isSelected ? meta.border : 'var(--arc-border)',
                      color: count > 0 || isSelected ? meta.accent : 'var(--arc-muted)',
                    }}
                    className="min-h-[30px] inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors hover:brightness-110"
                  >
                    <SpellCategoryIcon category={cat} className="h-3.5 w-3.5" />
                    <span>{meta.shortLabel}</span>
                    <span className="font-mono-num opacity-90">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {transferNotice && (
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
            transferNotice.ok
              ? 'border-[var(--arc-cat-heal-border)] bg-[var(--arc-cat-heal-bg)] text-[var(--arc-cat-heal-text)]'
              : 'border-[var(--arc-atk-border)] bg-[var(--arc-atk-bg)] text-[var(--arc-atk-text)]'
          }`}
        >
          <span>{transferNotice.message}</span>
          <button
            type="button"
            onClick={() => setTransferNotice(null)}
            className="min-h-[32px] rounded-md px-2 text-xs font-medium opacity-80 hover:bg-black/15 whitespace-nowrap shrink-0 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}
        {pendingSpellImport && onImportCustomSpells && (
  <div className="rounded-xl border border-[var(--arc-accent)]/60 bg-[var(--arc-surface)] p-3.5 space-y-3 text-xs shadow-md">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-semibold text-[var(--arc-accent)]">
          Elegí qué hechizos importar de{' '}
          <span className="font-mono-num">{pendingSpellImport.fileName}</span>
        </p>
        <p className="text-[var(--arc-muted)] mt-0.5">
          Seleccionados:{' '}
          <strong className="text-[var(--arc-text)] font-mono-num">
            {pendingSpellImport.selectedIndices.length}
          </strong>{' '}
          de <span className="font-mono-num">{pendingSpellImport.items.length}</span> · Se sumarán
          al final del orden actual.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setPendingSpellImport((prev) =>
              prev ? { ...prev, selectedIndices: prev.items.map((_, idx) => idx) } : null
            )
          }
          className="text-[11px] font-semibold text-[var(--arc-accent)] hover:underline"
        >
          Marcar todos
        </button>
        <span className="text-[var(--arc-muted)]">·</span>
        <button
          type="button"
          onClick={() =>
            setPendingSpellImport((prev) => (prev ? { ...prev, selectedIndices: [] } : null))
          }
          className="text-[11px] font-medium text-[var(--arc-muted)] hover:text-[var(--arc-text)] hover:underline"
        >
          Desmarcar todos
        </button>
      </div>
    </div>

    <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-2.5 space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {(pendingSpellImport.items.length > 6 && !expandImportPreview
          ? pendingSpellImport.items.map((item, idx) => ({ item, idx })).slice(0, 6)
          : pendingSpellImport.items.map((item, idx) => ({ item, idx }))
        ).map(({ item, idx }) => {
          const checked = pendingSpellImport.selectedIndices.includes(idx);
          return (
            <label
              key={`${item.name}-${idx}`}
              className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer transition-colors ${
                checked
                  ? 'border-[var(--arc-accent)]/50 bg-[var(--arc-raised)] text-[var(--arc-text)]'
                  : 'border-transparent bg-[var(--arc-surface)] text-[var(--arc-muted)] opacity-75'
              }`}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setPendingSpellImport((prev) => {
                      if (!prev) return null;
                      const exists = prev.selectedIndices.includes(idx);
                      return {
                        ...prev,
                        selectedIndices: exists
                          ? prev.selectedIndices.filter((i) => i !== idx)
                          : [...prev.selectedIndices, idx].sort((a, b) => a - b),
                      };
                    })
                  }
                  className="accent-[var(--arc-accent)]"
                />
                <span className="truncate font-medium">{item.name}</span>
              </span>
              <span className="font-mono-num text-[11px] text-[var(--arc-muted)] shrink-0">
                {item.manaCost} maná
              </span>
            </label>
          );
        })}
      </div>

      {pendingSpellImport.items.length > 6 && (
        <div className="flex items-center justify-between pt-1 border-t border-[var(--arc-border)]/60">
          <span className="text-[11px] text-[var(--arc-muted)]">
            {!expandImportPreview
              ? `Mostrando 6 de ${pendingSpellImport.items.length} hechizos`
              : `Mostrando los ${pendingSpellImport.items.length} hechizos`}
          </span>
          <button
            type="button"
            onClick={() => setExpandImportPreview((prev) => !prev)}
            className="text-[11px] font-semibold text-[var(--arc-accent)] hover:underline"
          >
            {expandImportPreview
              ? 'Plegar lista'
              : `Ver todos (${pendingSpellImport.items.length})`}
          </button>
        </div>
      )}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pendingSpellImport.selectedIndices.length === 0}
        onClick={() => {
          const chosenSpells = pendingSpellImport.selectedIndices
            .map((idx) => pendingSpellImport.items[idx]?.raw)
            .filter(Boolean);
          const payload = JSON.stringify({
            format: 'arcane_spells_pack_v1',
            spells: chosenSpells,
            customOrders: pendingSpellImport.customOrders,
            customStatuses: pendingSpellImport.customStatuses,
          });
          const res = onImportCustomSpells(payload);
          setTransferNotice(res);
          setPendingSpellImport(null);
          setExpandImportPreview(false);
        }}
        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
      >
        Importar seleccionados ({pendingSpellImport.selectedIndices.length})
      </button>
      <button
        type="button"
        onClick={() => {
          setPendingSpellImport(null);
          setExpandImportPreview(false);
        }}
        className="min-h-[36px] rounded-lg px-3 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
      >
        Cancelar
      </button>
    </div>
  </div>
)}
      {lastMasteryReset && onRevertSpellMastery && (
        <div className="rounded-lg border border-[var(--arc-cat-buff-border)] bg-[var(--arc-cat-buff-bg)] px-3.5 py-2.5 text-xs text-[var(--arc-cat-buff-text)] flex flex-wrap items-center justify-between gap-2.5">
          <span>
            Maestría de <strong>{lastMasteryReset.spellName}</strong> reiniciada a 0{' '}
            <span className="font-mono-num opacity-85">
              (antes: Nv. {lastMasteryReset.previousLevel} · {lastMasteryReset.previousSuccesses}{' '}
              éxitos)
            </span>
            .
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRevertSpellMastery}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-md bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Revertir maestría
            </button>
            {onDismissMasteryReset && (
              <button
                type="button"
                onClick={onDismissMasteryReset}
                className="min-h-[34px] rounded-md px-2 text-xs font-medium text-[var(--arc-cat-buff-text)] opacity-80 hover:bg-black/15 whitespace-nowrap shrink-0 transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {selectExportMode && onExportSelectedSpells && (
        <div className="rounded-lg border border-[var(--arc-accent)]/60 bg-[var(--arc-surface-alt)] px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--arc-accent)]">
              Elegí los hechizos a compartir:
            </span>
            <span className="font-mono-num text-[var(--arc-text)]">
              {selectedSpellIds.length} seleccionado(s)
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedSpellIds((prev) => [
                  ...new Set([...prev, ...visibleSpells.map((s) => s.id)]),
                ])
              }
              className="min-h-[32px] rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              Marcar visibles ({visibleSpells.length})
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedSpellIds(scopeSpells.filter((s) => !s.isBasic).map((s) => s.id))
              }
              className="min-h-[32px] rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              Solo propios ({customCount})
            </button>
            {selectedSpellIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSpellIds([])}
                className="min-h-[32px] rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={selectedSpellIds.length === 0}
              onClick={() => {
                const res = onExportSelectedSpells(selectedSpellIds);
                setTransferNotice({ ok: res.ok, message: res.message });
                if (res.ok) {
                  setSelectExportMode(false);
                  setSelectedSpellIds([]);
                }
              }}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Compartir seleccionados{' '}
              <span className="font-mono-num">({selectedSpellIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectExportMode(false);
                setSelectedSpellIds([]);
              }}
              className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {reorderMode && (
        <div className="border-b border-[var(--arc-accent)]/40 bg-[var(--arc-surface-alt)] rounded-lg px-3.5 py-2.5 text-xs text-[var(--arc-text)] flex flex-wrap items-center justify-between gap-2">
          <span>
            Modo reordenar activo: arrastrá cada hechizo o usá las flechas ↑ / ↓ para elegir su
            orden.
          </span>
          <button
            type="button"
            onClick={() => setReorderMode(false)}
            className="min-h-[30px] text-xs font-semibold text-[var(--arc-accent)] hover:underline whitespace-nowrap shrink-0"
          >
            Finalizar orden
          </button>
        </div>
      )}

      {scope === 'known' && favoriteIds.size > 0 && (
        <div className="rounded-lg border border-[var(--arc-accent)]/30 bg-[var(--arc-surface-alt)] px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--arc-accent)]">
            <Star className="h-3.5 w-3.5 fill-current" />
            Acceso rápido
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {scopeSpells
              .filter((spell) => favoriteIds.has(spell.id))
              .map((spell) => (
                <button
                  key={spell.id}
                  type="button"
                  onClick={() => {
                    setScope('known');
                    setFavoritesOnly(false);
                    setSelectedPersonalTag('');
                    setSearchQuery(spell.name);
                  }}
                  className="min-h-[30px] max-w-[200px] shrink-0 truncate rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2.5 py-1 text-xs font-medium text-[var(--arc-text)] hover:border-[var(--arc-accent)]"
                  title={`Mostrar ${spell.name}`}
                >
                  {spell.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Buscador difuso + barra compactable de Filtros Avanzados */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--arc-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Búsqueda difusa (nombre, orden, estado, efecto)..."
              aria-label="Buscar hechizo"
              className="w-full min-h-[38px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] pl-9 pr-9 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)] focus:outline-none focus:border-[var(--arc-accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            aria-expanded={filtersExpanded}
            className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              filtersExpanded || activeAdvancedFilterCount > 0
                ? 'border-[var(--arc-accent)]/70 bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="font-mono-num rounded-full bg-[var(--arc-accent)] px-1.5 py-0.2 text-[11px] font-bold text-[#15100b]">
                {activeAdvancedFilterCount}
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                filtersExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-[38px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* Resumen rápido de filtros activos cuando el panel está compactado */}
        {!filtersExpanded && activeAdvancedFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {originFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-[var(--arc-text)]">
                Origen: {originFilter === 'base' ? 'Base' : 'Propios'}
                <button
                  type="button"
                  onClick={() => setOriginFilter('all')}
                  aria-label="Quitar filtro de origen"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {filter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-[var(--arc-text)]">
                Categoría: {CATEGORY_META[filter].label}
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  aria-label="Quitar filtro de categoría"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {(parsedManaMin !== null || parsedManaMax !== null) && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 font-mono-num text-[var(--arc-text)]">
                Maná: {parsedManaMin ?? 0}–{parsedManaMax ?? '∞'}
                <button
                  type="button"
                  onClick={() => {
                    setManaMinInput('');
                    setManaMaxInput('');
                  }}
                  aria-label="Quitar filtro de maná"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {dieFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 font-mono-num text-[var(--arc-text)]">
                Dado: {dieFilter}
                <button
                  type="button"
                  onClick={() => setDieFilter('all')}
                  aria-label="Quitar filtro de dado"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-[var(--arc-text)]">
                Estado: {statusFilter}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  aria-label="Quitar filtro de estado"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {natureFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-[var(--arc-text)]">
                Tipo: {natureFilter === 'magico' ? 'Mágico' : 'Físico'}
                <button
                  type="button"
                  onClick={() => setNatureFilter('all')}
                  aria-label="Quitar filtro de naturaleza"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {favoritesOnly && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-[var(--arc-accent)]">
                Solo favoritos
                <button
                  type="button"
                  onClick={() => setFavoritesOnly(false)}
                  aria-label="Quitar filtro de favoritos"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {selectedPersonalTag && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-[var(--arc-text)]">
                Etiqueta: {selectedPersonalTag}
                <button
                  type="button"
                  onClick={() => setSelectedPersonalTag('')}
                  aria-label="Quitar filtro de etiqueta"
                  className="text-[var(--arc-muted)] hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        {/* Panel desplegable de Filtros Avanzados */}
        {filtersExpanded && (
          <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3 space-y-3">
            {/* Fila 1: Categoría + Origen */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--arc-input)] overflow-x-auto sm:flex-wrap sm:overflow-visible">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilter(opt.value)}
                    className={`min-h-[30px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                      filter === opt.value
                        ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)] font-semibold'
                        : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                    }`}
                  >
                    {opt.value !== 'all' && (
                      <SpellCategoryIcon category={opt.value} className="h-3.5 w-3.5" />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>

              <div
                className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--arc-input)]"
                role="group"
                aria-label="Filtrar hechizos por origen"
              >
                {(
                  [
                    { value: 'all', label: 'Todos', count: scopeSpells.length },
                    { value: 'base', label: 'Base', count: baseCount },
                    { value: 'custom', label: 'Propios', count: customCount },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOriginFilter(opt.value)}
                    className={`min-h-[30px] px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap text-center transition-colors ${
                      originFilter === opt.value
                        ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                        : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                    }`}
                  >
                    {opt.label}{' '}
                    <span className="font-mono-num opacity-80">({opt.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fila 2: Rango de Maná + Tipo de Dado + Efecto de Estado + Naturaleza */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Rango exacto de maná */}
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-muted)]">
                  Rango de maná
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={manaMinInput}
                    onChange={(e) => setManaMinInput(e.target.value)}
                    placeholder="Mín"
                    aria-label="Maná mínimo"
                    className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-center text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
                  />
                  <span className="text-xs text-[var(--arc-muted)]">—</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={manaMaxInput}
                    onChange={(e) => setManaMaxInput(e.target.value)}
                    placeholder="Máx"
                    aria-label="Maná máximo"
                    className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-center text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
                  />
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {(
                    [
                      { label: '0–1', min: '0', max: '1' },
                      { label: '2', min: '2', max: '2' },
                      { label: '3+', min: '3', max: '' },
                    ] as const
                  ).map((preset) => {
                    const active = isManaPresetActive(preset.min, preset.max);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setManaMinInput('');
                            setManaMaxInput('');
                          } else {
                            setManaMinInput(preset.min);
                            setManaMaxInput(preset.max);
                          }
                        }}
                        className={`flex-1 min-h-[24px] rounded font-mono-num text-[11px] font-semibold transition-colors ${
                          active
                            ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                            : 'bg-[var(--arc-input)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tipo de dado */}
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-muted)]">
                  Tipo de dado
                </span>
                <div className="grid grid-cols-6 gap-1 rounded-lg bg-[var(--arc-input)] p-1">
                  <button
                    type="button"
                    onClick={() => setDieFilter('all')}
                    className={`min-h-[28px] rounded text-[11px] font-semibold transition-colors ${
                      dieFilter === 'all'
                        ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                        : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                    }`}
                  >
                    Todos
                  </button>
                  {DIE_TYPES.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDieFilter((curr) => (curr === dt ? 'all' : dt))}
                      className={`min-h-[28px] rounded font-mono-num text-[11px] font-semibold transition-colors ${
                        dieFilter === dt
                          ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                          : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Efecto de estado / elemental / sinergia */}
              <div className="space-y-1">
                <label
                  htmlFor="grimorio-status-filter"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-muted)]"
                >
                  Estado / Reacción
                </label>
                <select
                  id="grimorio-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                >
                  <option value="all">
                    Todos los estados ({availableStatusesInScope.length})
                  </option>
                  {availableStatusesInScope.map(([lbl, count]) => (
                    <option key={lbl} value={lbl}>
                      {lbl} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Naturaleza Mágico vs Físico */}
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-muted)]">
                  Naturaleza
                </span>
                <div
                  className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[var(--arc-input)]"
                  role="group"
                  aria-label="Filtrar por tipo mágico o físico"
                >
                  {(
                    [
                      { value: 'all', label: 'Todo' },
                      { value: 'magico', label: 'Mágico' },
                      { value: 'fisico', label: 'Físico' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNatureFilter(opt.value)}
                      className={`min-h-[28px] px-2 text-xs rounded-md whitespace-nowrap transition-colors ${
                        natureFilter === opt.value
                          ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)] font-semibold'
                          : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Fila 3: Favoritos, Orden y Etiquetas personales */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--arc-border)]/70 pt-2.5">
              <button
                type="button"
                onClick={() => setFavoritesOnly((value) => !value)}
                className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${
                  favoritesOnly
                    ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                    : 'bg-[var(--arc-input)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
                Favoritos ({scopeSpells.filter((spell) => favoriteIds.has(spell.id)).length})
              </button>

              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--arc-muted)]">
                <span>Orden:</span>
                <select
                  aria-label="Ordenar hechizos del grimorio"
                  value={sortMode}
                  onChange={(event) =>
                    updateActiveCharacter((character) => ({
                      ...character,
                      spellSortMode: event.target.value as Character['spellSortMode'],
                    }))
                  }
                  className="min-h-[32px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                >
                  <option value="custom">Personalizado</option>
                  <option value="name">Alfabético</option>
                  <option value="category">Categoría</option>
                  <option value="mana">Costo de maná</option>
                  <option value="nature">Mágico / Físico</option>
                  <option value="favorites">Favoritos primero</option>
                </select>
              </label>

              {personalTagNames.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedPersonalTag(selectedPersonalTag === tag ? '' : tag)}
                  className={`min-h-[30px] inline-flex items-center gap-1 rounded-full border px-2.5 text-xs ${
                    selectedPersonalTag === tag
                      ? 'border-[var(--arc-accent)] bg-[var(--arc-accent)]/10 text-[var(--arc-accent)]'
                      : 'border-[var(--arc-border)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1">
                <input
                  value={newPersonalTag}
                  onChange={(event) => setNewPersonalTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') createPersonalTag();
                  }}
                  aria-label="Crear etiqueta personal"
                  placeholder="Nueva etiqueta..."
                  className="min-h-[32px] w-32 sm:w-36 rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
                />
                <button
                  type="button"
                  onClick={createPersonalTag}
                  disabled={!newPersonalTag.trim()}
                  aria-label="Agregar etiqueta"
                  className="min-h-[32px] w-8 rounded-md text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] disabled:opacity-40"
                >
                  <Plus className="mx-auto h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {personalTagNames.length > 0 && (
              <details className="text-xs text-[var(--arc-muted)]">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-[var(--arc-raised)]">
                  <Tag className="h-3 w-3" />
                  Administrar etiquetas
                </summary>
                <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] p-2">
                  {personalTagNames.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 rounded-full border border-[var(--arc-border)] px-2.5 py-1"
                    >
                      {renamingPersonalTag === tag ? (
                        <>
                          <input
                            autoFocus
                            value={renamedPersonalTag}
                            onChange={(event) => setRenamedPersonalTag(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') renamePersonalTag(tag);
                              if (event.key === 'Escape') setRenamingPersonalTag(null);
                            }}
                            className="w-24 bg-transparent text-xs text-[var(--arc-text)] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => renamePersonalTag(tag)}
                            className="text-[var(--arc-accent)]"
                          >
                            Guardar
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingPersonalTag(tag);
                              setRenamedPersonalTag(tag);
                            }}
                            aria-label={`Renombrar ${tag}`}
                            className="text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePersonalTag(tag)}
                            aria-label={`Eliminar ${tag}`}
                            className="text-[var(--arc-muted)] hover:text-[#e88a70]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {scope === 'library' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--arc-border)] pt-3 text-xs text-[var(--arc-muted)]">
          <span>
            Usá <strong className="text-[var(--arc-text)]">Aprender</strong> /{' '}
            <strong className="text-[var(--arc-text)]">En grimorio</strong> para asignar hechizos
            a <strong className="text-[var(--arc-text)]">{activeCharacter?.name}</strong>.
          </span>
          <label className="inline-flex items-center gap-2 text-[var(--arc-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showOtherOwners}
              onChange={(e) => setShowOtherOwners(e.target.checked)}
              className="h-4 w-4 accent-[var(--arc-action)]"
            />
            <span>Ver de otros jugadores</span>
          </label>
        </div>
      )}

      {/* Lista de hechizos */}
      {visibleSpells.length === 0 ? (
        <div className="rounded-lg bg-[var(--arc-surface-alt)] p-6 text-center space-y-3">
          <p className="text-sm text-[var(--arc-muted)]">
            {hasActiveFilters
              ? 'Ningún hechizo coincide con la búsqueda o los filtros seleccionados.'
              : scope === 'known'
                ? `${activeCharacter?.name || 'Este personaje'} no tiene hechizos aprendidos todavía.`
                : 'No hay hechizos en esta vista de la biblioteca.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="min-h-[38px] rounded-lg bg-[var(--arc-raised)] px-3.5 text-xs font-semibold text-[var(--arc-accent)] hover:brightness-110 transition-all"
              >
                Limpiar filtros
              </button>
            )}
            {scope === 'known' && !hasActiveFilters && (
              <>
                <button
                  type="button"
                  onClick={() => setScope('library')}
                  className="min-h-[38px] rounded-lg px-3.5 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] transition-colors"
                >
                  Abrir Biblioteca
                </button>
                {onOpenCharacterBuilder && (
                  <button
                    type="button"
                    onClick={onOpenCharacterBuilder}
                    className="min-h-[38px] rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] transition-colors"
                  >
                    Armar grimorio en Personajes
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={gridClass} data-grimorio-spell-list="true">
          {visibleSpells.map((spell, visibleIdx) => {
            const isKnown = knownIds.has(spell.id);
            const category = getSpellCategory(spell);
            const catMeta = CATEGORY_META[category];

            const castDice =
              spell.castStat === 'none'
                ? 0
                : spell.castStat === 'manual'
                  ? spell.manualCastDice
                  : getCharacterStatDice(activeCharacter, spell.castStat, formula);

            const combatDice = spell.combatStats.reduce(
              (sum, k) => sum + getCharacterStatDice(activeCharacter, k, formula),
              0
            );

            const supportsMastery = spellSupportsMastery(spell);
            const rawMastery = supportsMastery ? activeCharacter?.spellMastery?.[spell.id] || 0 : 0;
            const mastery = getSpellMasteryStatus(rawMastery, formula);

            const baseDiceText =
              spell.damage.dice.map((d) => `${d.count}${d.type}`).join(' + ') +
              (spell.damage.bonus ? ` + ${spell.damage.bonus}` : '');
            const effectiveDice = getEffectiveSpellDamageDice(spell, mastery);
            const effectiveDiceText =
              effectiveDice.map((d) => `${d.count}${d.type}`).join(' + ') +
              (spell.damage.bonus ? ` + ${spell.damage.bonus}` : '');
            const hasDieUpgrade =
              spell.effectType === 'damage' &&
              mastery.dieUpgradeSteps > 0 &&
              effectiveDiceText !== baseDiceText;

            const spellDmgKind = getEffectiveSpellDamageKind(spell);
            const isSonic = isSonicSpell(spell);
            const isMagical = isSpellMagical(spell);
            const defManaInfo = getEffectiveDefenseManaCost(activeCharacter, spell);

            const castRequirement = getSpellCastRequirement(spell);
            const effectSub = spell.effectType === 'effect' ? getEffectiveEffectSubType(spell) : null;
            const parsedTurns = parseDurationTurns(spell);

            const ownerChar = spell.ownerCharacterId
              ? characters.find((c) => c.id === spell.ownerCharacterId)
              : undefined;

            const isDraggingThis = draggedSpellId === spell.id;
            const isDropTargetThis =
              reorderMode &&
              draggedSpellId !== null &&
              dragOverSpellId === spell.id &&
              !isDraggingThis;

            const blockDividerClass = isMagical
              ? 'border-t border-[var(--arc-magic-border)]/60 pt-3'
              : 'border-t border-[var(--arc-phys-border)]/60 pt-3';

            const blockLabelClass = `text-xs font-semibold uppercase tracking-wide ${
              isMagical ? 'text-[var(--arc-magic-accent)]' : 'text-[var(--arc-phys-accent)]'
            }`;

            const rollSummaryLine = (() => {
              const parts: string[] = [];
              if (castRequirement === 'none' && spell.effectType === 'damage') {
                parts.push('Ataque directo');
              } else if (castRequirement === 'conditional') {
                parts.push(
                  `Casteo condicional (${spell.castCondition || 'según situación'}${
                    spell.castStat !== 'none'
                      ? ` · ${castDice}d6 ${
                          spell.castStat === 'manual' ? 'Manual' : STAT_NAMES[spell.castStat]
                        }`
                      : ''
                  })`
                );
              } else if (spell.castStat !== 'none') {
                parts.push(
                  `Casteo: ${castDice}d6 (${
                    spell.castStat === 'manual' ? 'Manual' : STAT_NAMES[spell.castStat]
                  })`
                );
              } else if (castRequirement === 'prepare') {
                parts.push('Casteo previo: Automático (1 acción)');
              } else if (spell.combatStats.length === 0) {
                parts.push('Ejecución: Automática (sin tirada)');
              }

              if (spell.combatStats.length > 0) {
                const roleLabel =
                  spell.effectType === 'defense'
                    ? 'Defensa'
                    : spell.effectType === 'effect'
                      ? 'Tirada enfrentada'
                      : 'Ataque';
                parts.push(
                  `${roleLabel}: ${combatDice}d6 (${spell.combatStats
                    .map((k) => STAT_NAMES[k])
                    .join(' + ')})`
                );
              }
              return parts.join(' · ');
            })();

            const diceDisplayText = effectiveDiceText || baseDiceText;

            const dragHandlers = {
              draggable: reorderMode,
              onDragStart: (e: React.DragEvent<HTMLElement>) => {
                if (!reorderMode) return;
                e.stopPropagation();
                setDraggedSpellId(spell.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/x-arcane-spell', spell.id);
              },
              onDragOver: (e: React.DragEvent<HTMLElement>) => {
                if (!reorderMode || !draggedSpellId) return;
                e.preventDefault();
                e.stopPropagation();
                if (dragOverSpellId !== spell.id) {
                  setDragOverSpellId(spell.id);
                }
              },
              onDrop: (e: React.DragEvent<HTMLElement>) => {
                if (!reorderMode || !draggedSpellId) return;
                e.preventDefault();
                e.stopPropagation();
                handleDropSpellInsideGrimorio(spell.id);
              },
              onDragEnd: (e: React.DragEvent<HTMLElement>) => {
                e.stopPropagation();
                setDraggedSpellId(null);
                setDragOverSpellId(null);
              },
            };

            const isSelectedForShare = selectExportMode && selectedSpellSet.has(spell.id);

            /* === VISTA COMPACTA === */
            if (viewDensity === 'compact') {
              const isCompactExpanded = expandedCompactSpellIds.has(spell.id);
              const isCompactMenuOpen = openCompactMenuSpellId === spell.id;

              return (
                <article
                  key={spell.id}
                  {...dragHandlers}
                  onClick={
                    selectExportMode
                      ? (e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          toggleSelectSpell(spell.id);
                        }
                      : undefined
                  }
                  className={`relative rounded-xl border p-3 space-y-2 flex flex-col transition-colors ${
                    isMagical
                      ? 'border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)]'
                      : 'border-[var(--arc-phys-border)] bg-[var(--arc-phys-bg)]'
                  } ${isDraggingThis ? 'opacity-50' : ''} ${
                    isDropTargetThis || isSelectedForShare ? 'ring-2 ring-[var(--arc-accent)]' : ''
                  } ${selectExportMode ? 'cursor-pointer' : ''}`}
                >
                  <div className="space-y-2">
                    {selectExportMode && (
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--arc-border)] text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${
                            isSelectedForShare
                              ? 'text-[var(--arc-accent)]'
                              : 'text-[var(--arc-muted)]'
                          }`}
                        >
                          {isSelectedForShare ? (
                            <CheckSquare className="h-4 w-4 text-[var(--arc-accent)]" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                          {isSelectedForShare ? 'Seleccionado para compartir' : 'Seleccionar'}
                        </span>
                      </div>
                    )}

                    {reorderMode && (
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--arc-border)] text-xs">
                        <span className="inline-flex items-center gap-1 text-[var(--arc-accent)] font-semibold cursor-grab select-none">
                          <GripVertical className="h-3.5 w-3.5" />#{visibleIdx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={visibleIdx === 0}
                            onClick={() => handleMoveSpellStep(spell.id, -1)}
                            aria-label={`Subir ${spell.name}`}
                            className="min-h-[32px] w-7 inline-flex items-center justify-center rounded text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={visibleIdx === visibleSpells.length - 1}
                            onClick={() => handleMoveSpellStep(spell.id, 1)}
                            aria-label={`Bajar ${spell.name}`}
                            className="min-h-[32px] w-7 inline-flex items-center justify-center rounded text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2 pr-8">
                      <h3
                        className={`min-w-0 flex-1 text-[15px] sm:text-base font-bold leading-tight break-words ${
                          isMagical
                            ? 'text-[var(--arc-magic-accent)]'
                            : 'text-[var(--arc-phys-accent)]'
                        }`}
                      >
                        {spell.name}
                      </h3>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setInspectedSpell(spell);
                        }}
                        aria-label={`Consultar ficha de ${spell.name}`}
                        title="Consultar ficha completa"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                    {renderSpellOrganizationControls(spell)}

                    {spell.dependency?.enabled && formatSpellDependencyLine(spell.dependency) && (
                      <p
                        title={formatSpellDependencyLine(spell.dependency) || undefined}
                        className="flex items-start gap-1.5 rounded-md border border-[#f3b562]/20 bg-[#f3b562]/[0.06] px-2 py-1.5 text-[11px] leading-snug text-[#f3c780]"
                      >
                        <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">
                          {formatSpellDependencyLine(spell.dependency)}
                        </span>
                      </p>
                    )}

                    <div className="relative flex items-start justify-between gap-2">
  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
      <span
        style={{ color: catMeta.accent }}
        className="inline-flex items-center gap-1 font-semibold"
      >
        <SpellCategoryIcon category={category} className="h-3.5 w-3.5" />
        {catMeta.label}
      </span>
      <span className="text-[var(--arc-muted)]" aria-hidden="true">·</span>
      <span
        className={
          isMagical
            ? 'text-[var(--arc-magic-accent)] font-semibold'
            : 'text-[var(--arc-phys-accent)] font-semibold'
        }
      >
        {spell.effectType === 'damage'
          ? spellDmgKind === 'magico' ? 'Mágico' : 'Físico'
          : isMagical ? 'Mágico' : 'Físico'}
      </span>
    </div>
    <div className="mt-1 font-mono-num text-xs text-[var(--arc-muted)]">
      {defManaInfo.cost} maná
    </div>
  </div>

  <div className="flex items-center gap-2 shrink-0">
    {(spell.effectType === 'damage' || spell.effectType === 'heal') &&
      diceDisplayText && (
        <div className="text-right">
          <div
            className={`font-mono-num text-lg sm:text-xl font-bold leading-none tracking-tight ${
              spell.effectType === 'heal'
                ? 'text-[#8fd2a1]'
                : isMagical
                  ? 'text-[var(--arc-magic-accent)]'
                  : 'text-[var(--arc-phys-accent)]'
            }`}
          >
            {diceDisplayText}
          </div>
          {hasDieUpgrade && (
            <div className="mt-0.5 font-mono-num text-[10px] text-[var(--arc-muted)] line-through">
              {baseDiceText}
            </div>
          )}
        </div>
      )}

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpenCompactMenuSpellId(isCompactMenuOpen ? null : spell.id);
      }}
      title="Opciones del hechizo"
      aria-label={`Opciones de ${spell.name}`}
      aria-expanded={isCompactMenuOpen}
      className="min-h-[32px] w-8 inline-flex items-center justify-center rounded-md text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>

    {isCompactMenuOpen && (
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-raised)] p-1 shadow-xl"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpenCompactMenuSpellId(null);
            onDuplicateSpell(spell);
          }}
          className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-[var(--arc-text)] hover:bg-[var(--arc-input)]"
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicar
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpenCompactMenuSpellId(null);
            onEditSpell(spell);
          }}
          className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-[var(--arc-text)] hover:bg-[var(--arc-input)]"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Editar
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpenCompactMenuSpellId(null);
            onDeleteSpell(spell.id);
          }}
          className="flex min-h-[34px] w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-[#e88a70] hover:bg-[#361912]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>
    )}
  </div>
</div>
                    {spell.effectDescription && (
                      <p className="text-xs text-[var(--arc-muted)] line-clamp-2 leading-snug">
                        {spell.effectDescription}
                      </p>
                    )}

                    {isCompactExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--arc-border)]/60 pt-2 text-xs">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                            Duración
                          </span>
                          <span className="text-[var(--arc-text)]">
                            {spell.duration ||
                              (parsedTurns
                                ? `${formatTurnDuration(parsedTurns)} (auto)`
                                : 'Instantáneo')}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                            Lanzamiento
                          </span>
                          <span className="text-[var(--arc-text)]">
                            {castRequirement === 'prepare'
                              ? 'Previo'
                              : castRequirement === 'conditional'
                                ? `Condicional${spell.castCondition ? `: ${spell.castCondition}` : ''}`
                                : 'Directo'}
                          </span>
                        </div>
                        {spell.castStat !== 'none' && (
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                              Dados de lanzamiento
                            </span>
                            <span className="font-mono-num text-[var(--arc-text)]">
                              {castDice}d6 ·{' '}
                              {spell.castStat === 'manual' ? 'Manual' : STAT_NAMES[spell.castStat]}
                            </span>
                          </div>
                        )}
                        {spell.combatStats.length > 0 && (
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                              Dados de combate
                            </span>
                            <span className="font-mono-num text-[var(--arc-text)]">
                              {combatDice}d6 ·{' '}
                              {spell.combatStats.map((k) => STAT_NAMES[k]).join(' + ')}
                            </span>
                          </div>
                        )}
                        {(spell.assuredSuccess > 0 || mastery.bonusAssured > 0) && (
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                              Éxitos asegurados
                            </span>
                            <span className="font-mono-num text-[var(--arc-text)]">
                              +{spell.assuredSuccess + mastery.bonusAssured}
                            </span>
                          </div>
                        )}
                        {spell.statuses.length > 0 && (
                          <div className="sm:col-span-2">
                            <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                              Estados / efectos
                            </span>
                            <span className="text-[var(--arc-text)]">
                              {spell.statuses.join(', ')}
                            </span>
                          </div>
                        )}
                        {rollSummaryLine && (
                          <div className="sm:col-span-2">
                            <span className="block text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">
                              Resolución
                            </span>
                            <span className="text-[var(--arc-text)]">{rollSummaryLine}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[var(--arc-border)]/60">
                    {activeCharacter && supportsMastery ? (
                      <div className="inline-flex items-center gap-1 text-xs font-mono-num">
                        <Award
                          className={`h-3.5 w-3.5 ${
                            isMagical
                              ? 'text-[var(--arc-magic-accent)]'
                              : 'text-[var(--arc-phys-accent)]'
                          }`}
                        />
                        <span className="font-semibold text-[var(--arc-text)]">
                          Nv.{mastery.level}
                        </span>
                        <span className="text-[var(--arc-muted)]">
                          (
                          {mastery.isMaxLevel
                            ? mastery.successes
                            : `${mastery.successes}/${mastery.nextThreshold}`}
                          )
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdjustSpellMastery(spell.id, -1);
                          }}
                          aria-label={`Restar 1 éxito de maestría a ${spell.name}`}
                          className="min-h-[30px] w-7 rounded text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)]"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdjustSpellMastery(spell.id, 1);
                          }}
                          aria-label={`Sumar 1 éxito de maestría a ${spell.name}`}
                          className="min-h-[30px] w-7 rounded text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)]"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--arc-muted)]">Sin maestría</span>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      {scope === 'library' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleKnown(spell.id);
                          }}
                          className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold whitespace-nowrap ${
                            isKnown
                              ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                              : 'bg-[var(--arc-raised)] text-[var(--arc-text)] hover:brightness-110'
                          }`}
                        >
                          {isKnown ? 'En grimorio' : 'Aprender'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCompactSpellIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(spell.id)) next.delete(spell.id);
                            else next.add(spell.id);
                            return next;
                          });
                          setOpenCompactMenuSpellId(null);
                        }}
                        aria-expanded={isCompactExpanded}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            isCompactExpanded ? 'rotate-180' : ''
                          }`}
                        />
                        {isCompactExpanded ? 'Cerrar' : 'Detalles'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            /* === VISTA DETALLADA === */
            return (
              <article
                key={spell.id}
                {...dragHandlers}
                onClick={
                  selectExportMode
                    ? (e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        toggleSelectSpell(spell.id);
                      }
                    : undefined
                }
                style={{ borderTopColor: catMeta.accent }}
                className={`rounded-xl border border-t-2 p-3.5 sm:p-5 space-y-3.5 flex flex-col justify-between transition-colors ${
                  isMagical
                    ? 'border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)]'
                    : 'border-[var(--arc-phys-border)] bg-[var(--arc-phys-bg)]'
                } ${isDraggingThis ? 'opacity-50' : ''} ${
                  isDropTargetThis || isSelectedForShare ? 'ring-2 ring-[var(--arc-accent)]' : ''
                } ${selectExportMode ? 'cursor-pointer' : ''}`}
              >
                <div className="space-y-3.5">
                  {selectExportMode && (
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          isSelectedForShare ? 'text-[var(--arc-accent)]' : 'text-[var(--arc-muted)]'
                        }`}
                      >
                        {isSelectedForShare ? (
                          <CheckSquare className="h-4 w-4 text-[var(--arc-accent)]" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {isSelectedForShare
                          ? 'Incluido en la exportación'
                          : 'Clic para incluir en seleccionados'}
                      </span>
                    </div>
                  )}

                  {reorderMode && (
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-[var(--arc-accent)] font-semibold cursor-grab select-none">
                        <GripVertical className="h-4 w-4" />
                        Posición #{visibleIdx + 1} · Arrastrar
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={visibleIdx === 0}
                          onClick={() => handleMoveSpellStep(spell.id, -1)}
                          aria-label={`Subir ${spell.name}`}
                          className="min-h-[34px] w-8 inline-flex items-center justify-center rounded-md text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={visibleIdx === visibleSpells.length - 1}
                          onClick={() => handleMoveSpellStep(spell.id, 1)}
                          aria-label={`Bajar ${spell.name}`}
                          className="min-h-[34px] w-8 inline-flex items-center justify-center rounded-md text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BLOQUE 1: IDENTIDAD Y EJECUCIÓN */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={{ color: catMeta.accent }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
                      >
                        <SpellCategoryIcon category={category} className="h-4 w-4" />
                        {spell.effectType === 'effect'
                          ? effectSub === 'buff'
                            ? 'Buff'
                            : effectSub === 'debuff'
                              ? 'Debuff'
                              : 'Efecto'
                          : TYPE_LABELS[spell.effectType]}
                      </span>

                      {scope === 'library' && (
                        <button
                          type="button"
                          onClick={() => onToggleKnown(spell.id)}
                          className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                            isKnown
                              ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                              : isMagical
                                ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)] hover:brightness-110'
                                : 'bg-[var(--arc-phys-raised)] text-[var(--arc-phys-text)] hover:brightness-110'
                          }`}
                        >
                          {isKnown ? 'En grimorio' : 'Aprender'}
                        </button>
                      )}
                    </div>

                    <div className="flex items-start gap-2">
                      <h3
                        className={`min-w-0 flex-1 text-base sm:text-lg font-bold break-words leading-snug ${
                          isMagical
                            ? 'text-[var(--arc-magic-accent)]'
                            : 'text-[var(--arc-phys-accent)]'
                        }`}
                      >
                        {spell.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setInspectedSpell(spell)}
                        aria-label={`Consultar ficha de ${spell.name}`}
                        title="Consultar ficha completa"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                    {renderSpellOrganizationControls(spell)}

                    <div
                      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] ${
                        isMagical
                          ? 'text-[var(--arc-magic-text)]/85'
                          : 'text-[var(--arc-phys-text)]/85'
                      }`}
                    >
                      <span className="font-mono-num">
                        {defManaInfo.discount > 0
                          ? `${defManaInfo.cost} maná (-${defManaInfo.discount} Escudo)`
                          : `${spell.manaCost} maná`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          (spell.effectType === 'damage' ? spellDmgKind === 'magico' : isMagical)
                            ? 'text-[var(--arc-magic-accent)] font-semibold'
                            : 'text-[var(--arc-phys-accent)] font-semibold'
                        }
                      >
                        {spell.effectType === 'damage'
                          ? `Daño ${spellDmgKind === 'magico' ? (isSonic ? 'Mágico (Sónico)' : 'Mágico') : 'Físico'}`
                          : isMagical
                            ? isSonic
                              ? 'Mágico (Sónico)'
                              : 'Mágico'
                            : 'Físico'}
                      </span>
                      {(spell.duration || parsedTurns) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            {parsedTurns && (
                              <Timer
                                className={`h-3.5 w-3.5 ${
                                  isMagical
                                    ? 'text-[var(--arc-magic-accent)]'
                                    : 'text-[var(--arc-phys-accent)]'
                                }`}
                              />
                            )}
                            {spell.duration || formatTurnDuration(parsedTurns)}
                            {parsedTurns ? ' (auto)' : ''}
                          </span>
                        </>
                      )}
                      {(spell.assuredSuccess > 0 || mastery.bonusAssured > 0) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              isMagical
                                ? 'text-[var(--arc-magic-accent)] font-medium'
                                : 'text-[var(--arc-phys-accent)] font-medium'
                            }
                          >
                            +{spell.assuredSuccess + mastery.bonusAssured} aseg.
                            {mastery.bonusAssured > 0
                              ? ` (+${mastery.bonusAssured} maestría)`
                              : ''}
                          </span>
                        </>
                      )}
                      {spell.isBasic && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#8fb56a]">Base</span>
                        </>
                      )}
                      {ownerChar && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#b6d796]">Solo de {ownerChar.name}</span>
                        </>
                      )}
                    </div>

                    {rollSummaryLine && (
                      <p
                        className={`text-[13px] font-mono-num ${
                          isMagical ? 'text-[var(--arc-magic-text)]' : 'text-[var(--arc-phys-text)]'
                        }`}
                      >
                        {rollSummaryLine}
                      </p>
                    )}
                  </div>

                  {/* BLOQUE 2: RESULTADO Y MAESTRÍA */}
                  <div className={`${blockDividerClass} space-y-2.5`}>
                    <span className={`block ${blockLabelClass}`}>Resultado y Maestría</span>

                    {(spell.effectType === 'damage' || spell.effectType === 'heal') &&
                      diceDisplayText && (
                        <div className="space-y-1">
                          <div
                            className={`text-xs font-semibold ${
                              isMagical
                                ? 'text-[var(--arc-magic-text)]/85'
                                : 'text-[var(--arc-phys-text)]/85'
                            }`}
                          >
                            {spell.effectType === 'heal' ? 'Curación' : 'Daño'}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-2.5">
                            {hasDieUpgrade ? (
                              <>
                                <span className="font-mono-num text-sm text-[var(--arc-muted)] line-through">
                                  {baseDiceText}
                                </span>
                                <span
                                  className={`font-mono-num text-2xl font-bold leading-none tracking-tight ${
                                    isMagical
                                      ? 'text-[var(--arc-magic-accent)]'
                                      : 'text-[var(--arc-phys-accent)]'
                                  }`}
                                >
                                  {effectiveDiceText}
                                </span>
                              </>
                            ) : (
                              <span
                                className={`font-mono-num text-2xl font-bold leading-none tracking-tight ${
                                  isMagical
                                    ? 'text-[var(--arc-magic-accent)]'
                                    : 'text-[var(--arc-phys-accent)]'
                                }`}
                              >
                                {diceDisplayText}
                              </span>
                            )}
                            {(spell.damage.notes || spell.damageMode === 'manual') && (
                              <span
                                className={`text-[13px] ${
                                  isMagical
                                    ? 'text-[var(--arc-magic-text)]/80'
                                    : 'text-[var(--arc-phys-text)]/80'
                                }`}
                              >
                                {spell.damage.notes ? spell.damage.notes : ''}
                                {spell.damage.notes && spell.damageMode === 'manual' ? ' · ' : ''}
                                {spell.damageMode === 'manual' ? 'tirada manual' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                    {spell.armorConfig?.isArmor && (
                      <p className="text-[13px] text-[#8ee0a4] font-semibold">
                        Armadura de {spell.armorConfig.element || 'Arcano'}: reducción +
                        {spell.armorConfig.damageReduction ?? 0}
                        {spell.armorConfig.damageDivisor === 2
                          ? ' · divide daño ÷2'
                          : spell.armorConfig.damageDivisor === 4
                            ? ' · divide daño ÷4'
                            : spell.armorConfig.damageDivisor === 0
                              ? ' · anula daño'
                              : ''}
                        {(spell.armorConfig.maxHits ?? spell.maxHits ?? 0) > 0
                          ? ` · resiste ${spell.armorConfig.maxHits ?? spell.maxHits} ${
                              (spell.armorConfig.maxHits ?? spell.maxHits) === 1
                                ? 'golpe'
                                : 'golpes'
                            }`
                          : ''}
                      </p>
                    )}

                    {!spell.armorConfig?.isArmor && (spell.maxHits ?? 0) > 0 && (
                      <p className="text-[13px] text-[#9fd2ff] font-semibold">
                        Resistencia: se rompe tras {spell.maxHits}{' '}
                        {spell.maxHits === 1 ? 'golpe' : 'golpes'}
                      </p>
                    )}

                    {isFireDamageSpell(spell) && (
                      <p className="inline-flex items-center gap-1.5 text-xs text-[#ff935c] font-semibold">
                        <Flame className="h-3.5 w-3.5 shrink-0" />
                        Dado máx. = +1 Quemadura (1d4 × 2t, máx. 10)
                      </p>
                    )}

                    {spell.dependency?.enabled && formatSpellDependencyLine(spell.dependency) && (
                      <p className="inline-flex items-center gap-1.5 text-xs text-[#f3b562] font-semibold">
                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                        {formatSpellDependencyLine(spell.dependency)}
                      </p>
                    )}

                    {spell.collateral?.enabled && (
                      <p className="text-xs text-[#f3be8d] font-semibold">
                        Colateral: {formatCollateralValue(spell.collateral)} (
                        {spell.collateral.durationType === 'turns'
                          ? `${spell.collateral.durationTurns || 1}t`
                          : 'Instantáneo'}
                        )
                      </p>
                    )}

                    {spell.effectDescription && (
                      <p
                        className={`text-[13px] leading-relaxed ${
                          isMagical
                            ? 'text-[var(--arc-magic-text)]/90'
                            : 'text-[var(--arc-phys-text)]/90'
                        }`}
                      >
                        {spell.effectDescription}
                      </p>
                    )}

                    {/* Progreso de Maestría inline */}
                    {activeCharacter && supportsMastery ? (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold ${
                              isMagical
                                ? 'text-[var(--arc-magic-accent)]'
                                : 'text-[var(--arc-phys-accent)]'
                            }`}
                          >
                            <Award className="h-3.5 w-3.5" />
                            Maestría Nv. {mastery.level}
                            {spell.effectType === 'damage' && mastery.dieUpgradeSteps > 0 && (
                              <span className="font-mono-num">
                                (+{mastery.dieUpgradeSteps} cat. desde {baseDiceText})
                              </span>
                            )}
                          </span>

                          <div
                            className={`flex flex-wrap items-center gap-1 font-mono-num ${
                              isMagical
                                ? 'text-[var(--arc-magic-text)]'
                                : 'text-[var(--arc-phys-text)]'
                            }`}
                          >
                            <span className="mr-1">
                              {mastery.isMaxLevel
                                ? `${mastery.successes} éxitos (Máx)`
                                : `${mastery.successes} / ${mastery.nextThreshold} éxitos`}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAdjustSpellMastery(spell.id, -1)}
                              title="Restar 1 éxito de maestría"
                              aria-label={`Restar 1 éxito de maestría a ${spell.name}`}
                              className="min-h-[32px] w-7 rounded text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              onClick={() => onAdjustSpellMastery(spell.id, 1)}
                              title="Sumar 1 éxito de maestría"
                              aria-label={`Sumar 1 éxito de maestría a ${spell.name}`}
                              className="min-h-[32px] w-7 rounded text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                            >
                              +
                            </button>
                            {onResetSpellMastery && mastery.successes > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmResetSpellId((curr) =>
                                    curr === spell.id ? null : spell.id
                                  )
                                }
                                title="Reiniciar maestría de este hechizo a 0"
                                className="ml-1 min-h-[32px] inline-flex items-center gap-1 rounded px-2 text-xs font-sans font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-atk-accent)] whitespace-nowrap shrink-0 transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Reiniciar
                              </button>
                            )}
                            {lastMasteryReset?.spellId === spell.id && onRevertSpellMastery && (
                              <button
                                type="button"
                                onClick={onRevertSpellMastery}
                                title={`Restaurar a Nv. ${lastMasteryReset.previousLevel} (${lastMasteryReset.previousSuccesses} éxitos)`}
                                className="ml-1 min-h-[32px] inline-flex items-center gap-1 rounded bg-[var(--arc-cat-buff-bg)] border border-[var(--arc-cat-buff-border)] px-2 text-xs font-sans font-semibold text-[var(--arc-cat-buff-accent)] hover:brightness-110 whitespace-nowrap shrink-0 transition-all"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Revertir ({lastMasteryReset.previousSuccesses})
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--arc-raised)]/80">
                          <div
                            className={`h-full transition-all duration-200 ${
                              isMagical
                                ? 'bg-[var(--arc-magic-accent)]'
                                : 'bg-[var(--arc-phys-accent)]'
                            }`}
                            style={{ width: `${mastery.progressPct}%` }}
                          />
                        </div>

                        {confirmResetSpellId === spell.id && onResetSpellMastery && (
                          <div className="rounded-lg border border-[var(--arc-atk-border)] bg-[var(--arc-atk-bg)] px-3 py-2 text-xs text-[var(--arc-atk-text)] flex flex-wrap items-center justify-between gap-2">
                            <span>
                              ¿Reiniciar maestría de <strong>{spell.name}</strong> a 0 éxitos?{' '}
                              <span className="font-mono-num opacity-85">
                                (Actual: Nv. {mastery.level} · {mastery.successes} éxitos)
                              </span>
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onResetSpellMastery(spell.id);
                                  setConfirmResetSpellId(null);
                                }}
                                className="min-h-[34px] inline-flex items-center gap-1 rounded-md bg-[#b84735] px-2.5 text-xs font-semibold text-white hover:bg-[#cc5440] whitespace-nowrap shrink-0 transition-colors"
                              >
                                Confirmar reinicio
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmResetSpellId(null)}
                                className="min-h-[34px] rounded-md px-2 text-xs font-medium text-[var(--arc-atk-text)] opacity-85 hover:bg-black/20 whitespace-nowrap shrink-0 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : activeCharacter ? (
                      <p className="text-xs text-[var(--arc-muted)] italic">
                        Este hechizo no puede ser mejorado por maestría.
                      </p>
                    ) : null}
                  </div>

                  {/* BLOQUE 3: ÓRDENES Y ESTADOS */}
                  {((spell.orders && spell.orders.length > 0) ||
                    (spell.statuses && spell.statuses.length > 0)) && (
                    <div className={`${blockDividerClass} space-y-2`}>
                      <span className={`block ${blockLabelClass}`}>Órdenes y Estados</span>

                      {spell.orders.length > 0 && (
                        <ul
                          className={`list-disc list-inside space-y-0.5 text-[13px] ${
                            isMagical
                              ? 'text-[var(--arc-magic-text)]/85'
                              : 'text-[var(--arc-phys-text)]/85'
                          }`}
                        >
                          {spell.orders.map((ord) => (
                            <li key={ord}>{ord}</li>
                          ))}
                        </ul>
                      )}

                      {spell.statuses && spell.statuses.length > 0 && (
                        <p
                          className={`text-[13px] ${
                            isMagical
                              ? 'text-[var(--arc-magic-accent)]'
                              : 'text-[var(--arc-phys-accent)]'
                          }`}
                        >
                          Estados (Influencia): {spell.statuses.join(' · ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Pie de gestión */}
                <div
                  className={`${blockDividerClass} flex flex-wrap items-center justify-between gap-2`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditSpell(spell)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-raised)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:brightness-110 whitespace-nowrap shrink-0 transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateSpell(spell)}
                      title="Clonar este hechizo como plantilla nueva"
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-transparent px-3 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicar
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {scope === 'known' && (
                      <button
                        type="button"
                        onClick={() => onToggleKnown(spell.id)}
                        title="Quitar de los hechizos aprendidos (sigue en Biblioteca)"
                        className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
                      >
                        Quitar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteSpell(spell.id)}
                      title="Eliminar hechizo permanentemente"
                      aria-label={`Eliminar ${spell.name}`}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-transparent px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[#361912] hover:text-[#e88a70] whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {inspectedSpell && (
        <SpellInspector
          key={inspectedSpell.id}
          spell={inspectedSpell}
          spells={spells}
          activeCharacter={activeCharacter}
          formula={formula}
          contextLabel={scope === 'known' ? 'Grimorio del personaje' : 'Biblioteca de hechizos'}
          onTestSpell={onTestSpell}
          onClose={() => setInspectedSpell(null)}
        />
      )}
    </section>
  );
}