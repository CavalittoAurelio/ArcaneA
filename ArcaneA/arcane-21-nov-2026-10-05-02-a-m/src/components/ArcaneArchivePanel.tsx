import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Edit3,
  Eye,
  KeyRound,
  Link2,
  Lock,
  LockOpen,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type {
  Character,
  DamageDie,
  FormulaConfig,
  KnowledgeTreeSettings,
  Spell,
} from '../types/rpg';
import {
  ADAPTABLE_CATALOG_SPELLS,
  ALL_ARCHIVE_LOCKED_IDS,
  ELEMENTAL_STATUS_META,
  MAGE_NATURES,
  adaptCatalogSpellForCharacter,
  evaluateCatalogSpellCompatibility,
  formatSpellDependencyLine,
  getCatalogPrerequisiteTemplateId,
  getCharacterOwnedNatureIds,
  getNatureShortName,
  getSpellCategory,
  getSuggestedNatureEvolutions,
  resolveNaturePresetForCharacter,
  spellSupportsMastery,
  type SpellCategory,
  type SpellElementalCompatibility,
} from '../utils/dice';
import { SpellCategoryIcon } from './SpellCategoryIcon';
import { getSpellGoalProgress } from '../utils/progression';
import { SpellInspector, type SpellInspectorAction } from './SpellInspector';
import { KnowledgeTreePanel } from './KnowledgeTreePanel';
import { KNOWLEDGE_SPELL_IDS } from '../utils/knowledgeTrees';

function formatDiceSummary(dice: DamageDie[], bonus: number): string {
  const parts = dice
    .filter((d) => d.count > 0)
    .map((d) => `${d.count}${d.type}`);
  const base = parts.join(' + ');
  if (!base) return bonus !== 0 ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : '';
  if (bonus > 0) return `${base} + ${bonus}`;
  if (bonus < 0) return `${base} - ${Math.abs(bonus)}`;
  return base;
}

interface ArcaneArchivePanelProps {
  spells: Spell[];
  activeCharacter: Character | undefined;
  characters: Character[];
  formula: FormulaConfig;
  onTestSpell?: (spell: Spell) => void;
  onLearnBasicSpell: (spellId: string, prereqSpellId?: string) => string | null;
  onLearnAdaptedSpell: (
    template: Spell,
    overrideNatureId?: string,
    includePrerequisite?: boolean
  ) => string | null;
  onCustomizeCatalogSpell: (template: Spell, overrideNatureId?: string) => void;
  onToggleArchiveKeyLock: (spellId: string, unlock?: boolean) => void;
  onSetArchiveKeyLocksBulk: (spellIds: string[], unlock: boolean) => void;
  onToggleUnlockedNature: (natureId: string, unlock?: boolean) => void;
  knowledgeTreeSettings: KnowledgeTreeSettings;
  onLearnKnowledgeSpell: (spellId: string) => string | null;
  onSetDisciplineMastery: (disciplineId: string, level: number) => void;
  onToggleDisciplineDiscovery: (disciplineId: string, unlock: boolean) => void;
  onUpdateKnowledgeTreeSettings: (settings: KnowledgeTreeSettings) => void;
  onToggleArchiveGoal: (spellId: string) => void;
  onGoToGrimorio: () => void;
  onGoToCombat: () => void;
}

type ArchiveScope = 'all' | 'adaptable' | 'foco' | 'other_unlearned' | 'exclusive';
type ArchiveCategoryFilter =
  | 'all'
  | 'compatible'
  | 'incompatible'
  | 'key_unlocked'
  | 'key_locked'
  | SpellCategory
  | 'with_dependency'
  | 'area'
  | 'with_mastery'
  | 'no_mastery';
type ArchiveSort = 'relevance' | 'name' | 'category' | 'mana' | 'chain';
type ArchiveGrouping = 'chains' | 'all';

interface ArchiveEntry {
  key: string;
  section: 'adaptable' | 'foco' | 'other_unlearned' | 'exclusive';
  template: Spell;
  displaySpell: Spell;
  isLearned: boolean;
  learnedVariantNames: string[];
  ownerName?: string;
  prereqTemplate?: Spell;
  prereqLearned: boolean;
  prereqAdaptedName?: string;
  prereqKeyUnlocked: boolean;
  prereqCompatible: boolean;
  requiresKey: boolean;
  isKeyUnlocked: boolean;
  compatibility: SpellElementalCompatibility;
}

const CATEGORY_LABELS: Record<SpellCategory, string> = {
  damage: 'Ataque',
  defense: 'Defensa',
  heal: 'Curación',
  buff: 'Buff',
  debuff: 'Debuff',
  effect: 'Efecto',
};

const TRIGGER_LABELS: Record<string, string> = {
  always: '100%',
  upper_half: '50% (mitad sup.)',
  max_die: 'máx. dado',
  auto: 'auto',
};

const FOCO_IDS = new Set([
  'basic_foco_arcano',
  'basic_descarga_focalizada',
  'basic_estallido_conmocionante',
]);

const ARCHIVE_LOCKED_SET = new Set(ALL_ARCHIVE_LOCKED_IDS);

export function ArcaneArchivePanel({
  spells,
  activeCharacter,
  characters,
  formula,
  onTestSpell,
  onLearnBasicSpell,
  onLearnAdaptedSpell,
  onCustomizeCatalogSpell,
  onToggleArchiveKeyLock,
  onSetArchiveKeyLocksBulk,
  onToggleUnlockedNature,
  knowledgeTreeSettings,
  onLearnKnowledgeSpell,
  onSetDisciplineMastery,
  onToggleDisciplineDiscovery,
  onUpdateKnowledgeTreeSettings,
  onToggleArchiveGoal,
  onGoToGrimorio,
  onGoToCombat,
}: ArcaneArchivePanelProps) {
  const [scope, setScope] = useState<ArchiveScope>('all');
  const [archiveView, setArchiveView] = useState<'catalog' | 'knowledge'>('catalog');
  const [categoryFilter, setCategoryFilter] = useState<ArchiveCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAlreadyLearned, setShowAlreadyLearned] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [archiveGrouping, setArchiveGrouping] = useState<ArchiveGrouping>('chains');
  const [archiveSort, setArchiveSort] = useState<ArchiveSort>('relevance');
  const [selectedNatureId, setSelectedNatureId] = useState<string>('');
  const [dmKeyMode, setDmKeyMode] = useState(false);
  const [natureToGrant, setNatureToGrant] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const [inspectedEntry, setInspectedEntry] = useState<{
    entry: ArchiveEntry;
    actions: SpellInspectorAction[];
  } | null>(null);

  // Reset selected preview nature when switching active character
  useEffect(() => {
    setSelectedNatureId('');
  }, [activeCharacter?.id]);

  const primaryNature = useMemo(
    () => resolveNaturePresetForCharacter(activeCharacter),
    [activeCharacter]
  );

  const ownedNatureIds = useMemo(
    () => getCharacterOwnedNatureIds(activeCharacter),
    [activeCharacter]
  );

  const ownedNatureSet = useMemo(() => new Set(ownedNatureIds), [ownedNatureIds]);

  const resolvedNature = useMemo(
    () => resolveNaturePresetForCharacter(activeCharacter, selectedNatureId || undefined),
    [activeCharacter, selectedNatureId]
  );

  const isSelectedNatureOwned = ownedNatureSet.has(resolvedNature.preset.id);

  const unlockedKeySet = useMemo(
    () => new Set(activeCharacter?.unlockedArchiveSpellIds || []),
    [activeCharacter?.unlockedArchiveSpellIds]
  );

  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    for (const c of characters) {
      map.set(c.id, c);
    }
    return map;
  }, [characters]);

  const knownIdSet = useMemo(
    () => new Set(activeCharacter?.knownSpells || []),
    [activeCharacter?.knownSpells]
  );

  const activeLearnedSpells = useMemo(
    () => spells.filter((s) => knownIdSet.has(s.id)),
    [spells, knownIdSet]
  );

  const learnedByTemplateId = useMemo(() => {
    const map = new Map<string, Spell[]>();
    for (const sp of activeLearnedSpells) {
      if (sp.catalogTemplateId) {
        const list = map.get(sp.catalogTemplateId) || [];
        list.push(sp);
        map.set(sp.catalogTemplateId, list);
      }
    }
    return map;
  }, [activeLearnedSpells]);

  const adaptableById = useMemo(() => {
    const map = new Map<string, Spell>();
    for (const sp of ADAPTABLE_CATALOG_SPELLS) {
      map.set(sp.id, sp);
    }
    return map;
  }, []);

  const allEntries = useMemo<ArchiveEntry[]>(() => {
    const entries: ArchiveEntry[] = [];

    // 1. 10 Adaptable Catalog Spells (audited 1-by-1 + locked under key by default)
    for (const tpl of ADAPTABLE_CATALOG_SPELLS) {
      const adapted = adaptCatalogSpellForCharacter(tpl, activeCharacter, {
        overrideNatureId: selectedNatureId || undefined,
        materialize: false,
        existingLearnedSpells: activeLearnedSpells,
      });
      const compatibility = evaluateCatalogSpellCompatibility(
        tpl,
        resolvedNature.preset.id,
        resolvedNature.elementName
      );
      const learnedCopies = learnedByTemplateId.get(tpl.id) || [];
      const prereqId = getCatalogPrerequisiteTemplateId(tpl);
      const prereqTemplate = prereqId ? adaptableById.get(prereqId) : undefined;
      const prereqLearned = prereqTemplate
        ? (learnedByTemplateId.get(prereqTemplate.id)?.length || 0) > 0
        : true;
      const prereqAdaptedName = prereqTemplate
        ? adaptCatalogSpellForCharacter(prereqTemplate, activeCharacter, {
            overrideNatureId: selectedNatureId || undefined,
            materialize: false,
          }).name
        : undefined;
      const prereqCompatibility = prereqTemplate
        ? evaluateCatalogSpellCompatibility(
            prereqTemplate,
            resolvedNature.preset.id,
            resolvedNature.elementName
          )
        : { compatible: true };

      entries.push({
        key: `adapt_${tpl.id}`,
        section: 'adaptable',
        template: tpl,
        displaySpell: adapted,
        isLearned: learnedCopies.length > 0,
        learnedVariantNames: learnedCopies.map((s) => s.name),
        prereqTemplate,
        prereqLearned,
        prereqAdaptedName,
        prereqKeyUnlocked: prereqTemplate ? unlockedKeySet.has(prereqTemplate.id) : true,
        prereqCompatible: prereqCompatibility.compatible,
        requiresKey: ARCHIVE_LOCKED_SET.has(tpl.id),
        isKeyUnlocked: unlockedKeySet.has(tpl.id),
        compatibility,
      });
    }

    // 2. Foco Arcano 3 base spells (unlearned + locked under key by default)
    const focoSpells = spells.filter((s) => FOCO_IDS.has(s.id));
    const focoBase = focoSpells.find((s) => s.id === 'basic_foco_arcano');
    const focoLearned = knownIdSet.has('basic_foco_arcano');

    for (const sp of focoSpells) {
      const needsFoco = sp.id !== 'basic_foco_arcano' && Boolean(sp.dependency?.enabled);
      const compatibility = evaluateCatalogSpellCompatibility(
        sp,
        resolvedNature.preset.id,
        resolvedNature.elementName
      );
      entries.push({
        key: `foco_${sp.id}`,
        section: 'foco',
        template: sp,
        displaySpell: sp,
        isLearned: knownIdSet.has(sp.id),
        learnedVariantNames: knownIdSet.has(sp.id) ? [sp.name] : [],
        prereqTemplate: needsFoco ? focoBase : undefined,
        prereqLearned: needsFoco ? focoLearned : true,
        prereqAdaptedName: needsFoco ? focoBase?.name : undefined,
        prereqKeyUnlocked: needsFoco ? unlockedKeySet.has('basic_foco_arcano') : true,
        prereqCompatible: true,
        requiresKey: ARCHIVE_LOCKED_SET.has(sp.id),
        isKeyUnlocked: unlockedKeySet.has(sp.id),
        compatibility,
      });
    }

    // 3. Other unlearned spells learnable by active character
    for (const sp of spells) {
      if (FOCO_IDS.has(sp.id) || sp.isAdaptableTemplate) continue;
      if (KNOWLEDGE_SPELL_IDS.has(sp.id)) continue;
      const isOtherOwner = Boolean(
        sp.ownerCharacterId && sp.ownerCharacterId !== activeCharacter?.id
      );
      if (isOtherOwner) continue;
      if (knownIdSet.has(sp.id)) continue;

      entries.push({
        key: `unlearned_${sp.id}`,
        section: 'other_unlearned',
        template: sp,
        displaySpell: sp,
        isLearned: false,
        learnedVariantNames: [],
        prereqLearned: true,
        prereqKeyUnlocked: true,
        prereqCompatible: true,
        requiresKey: false,
        isKeyUnlocked: true,
        compatibility: { compatible: true },
      });
    }

    // 4. Exclusive / non-learnable spells owned by other characters
    for (const sp of spells) {
      if (FOCO_IDS.has(sp.id) || sp.isAdaptableTemplate) continue;
      if (!sp.ownerCharacterId || sp.ownerCharacterId === activeCharacter?.id) continue;
      const owner = characterMap.get(sp.ownerCharacterId);
      entries.push({
        key: `excl_${sp.id}`,
        section: 'exclusive',
        template: sp,
        displaySpell: sp,
        isLearned: false,
        learnedVariantNames: [],
        ownerName: owner?.name || 'Otro personaje',
        prereqLearned: true,
        prereqKeyUnlocked: true,
        prereqCompatible: false,
        requiresKey: false,
        isKeyUnlocked: false,
        compatibility: { compatible: false },
      });
    }

    return entries;
  }, [
    spells,
    activeCharacter,
    selectedNatureId,
    activeLearnedSpells,
    resolvedNature.preset.id,
    resolvedNature.elementName,
    learnedByTemplateId,
    adaptableById,
    unlockedKeySet,
    knownIdSet,
    characterMap,
  ]);

  const catalogEntries = useMemo(
    () => allEntries.filter((e) => e.section === 'adaptable' || e.section === 'foco'),
    [allEntries]
  );

  const catalogStats = useMemo(() => {
    const total = catalogEntries.length;
    const compatible = catalogEntries.filter((e) => e.compatibility.compatible).length;
    const incompatible = total - compatible;
    const unlockedKeys = catalogEntries.filter((e) => e.isKeyUnlocked).length;
    const learned = catalogEntries.filter((e) => e.isLearned).length;
    return { total, compatible, incompatible, unlockedKeys, learned };
  }, [catalogEntries]);

  const scopeCounts = useMemo(() => {
    const visibleBase = allEntries.filter((e) => showAlreadyLearned || !e.isLearned);
    return {
      all: visibleBase.length,
      adaptable: visibleBase.filter((e) => e.section === 'adaptable').length,
      foco: visibleBase.filter((e) => e.section === 'foco').length,
      other_unlearned: visibleBase.filter((e) => e.section === 'other_unlearned').length,
      exclusive: visibleBase.filter((e) => e.section === 'exclusive').length,
    };
  }, [allEntries, showAlreadyLearned]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return allEntries.filter((entry) => {
      if (!showAlreadyLearned && entry.isLearned) return false;
      if (scope !== 'all' && entry.section !== scope) return false;

      const sp = entry.displaySpell;
      const cat = getSpellCategory(sp);
      const hasMastery = spellSupportsMastery(sp);

      if (categoryFilter === 'compatible') {
        if (!entry.compatibility.compatible) return false;
      } else if (categoryFilter === 'incompatible') {
        if (entry.compatibility.compatible) return false;
      } else if (categoryFilter === 'key_unlocked') {
        if (!entry.requiresKey || !entry.isKeyUnlocked) return false;
      } else if (categoryFilter === 'key_locked') {
        if (!entry.requiresKey || entry.isKeyUnlocked) return false;
      } else if (categoryFilter === 'with_dependency') {
        if (!sp.dependency?.enabled) return false;
      } else if (categoryFilter === 'area') {
        if (!sp.areaConfig?.enabled) return false;
      } else if (categoryFilter === 'with_mastery') {
        if (!hasMastery) return false;
      } else if (categoryFilter === 'no_mastery') {
        if (hasMastery) return false;
      } else if (categoryFilter !== 'all' && cat !== categoryFilter) {
        return false;
      }

      if (q) {
        const haystack = [
          sp.name,
          sp.effectDescription,
          sp.catalogChainGroup || '',
          sp.dependency?.requiredName || '',
          entry.ownerName || '',
          entry.compatibility.reason || '',
          ...sp.orders,
          ...sp.statuses,
        ]
          .join(' ')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allEntries, showAlreadyLearned, scope, categoryFilter, searchQuery]);

  const sortedEntries = useMemo(() => {
    const entries = [...filteredEntries];
    if (archiveSort === 'name') {
      entries.sort((a, b) =>
        (a.displaySpell.name || '').localeCompare(b.displaySpell.name || '', 'es')
      );
    } else if (archiveSort === 'category') {
      entries.sort((a, b) =>
        CATEGORY_LABELS[getSpellCategory(a.displaySpell)].localeCompare(
          CATEGORY_LABELS[getSpellCategory(b.displaySpell)],
          'es'
        )
      );
    } else if (archiveSort === 'mana') {
      entries.sort(
        (a, b) =>
          a.displaySpell.manaCost - b.displaySpell.manaCost ||
          a.displaySpell.name.localeCompare(b.displaySpell.name, 'es')
      );
    } else if (archiveSort === 'chain') {
      entries.sort((a, b) =>
        (a.displaySpell.catalogChainGroup || 'Sin cadena').localeCompare(
          b.displaySpell.catalogChainGroup || 'Sin cadena',
          'es'
        )
      );
    } else {
      entries.sort((a, b) => {
        const rank = (entry: ArchiveEntry) =>
          entry.isLearned ? 3 : entry.compatibility.compatible && !entry.requiresKey ? 0 :
          entry.compatibility.compatible ? 1 : 2;
        return rank(a) - rank(b) || a.displaySpell.name.localeCompare(b.displaySpell.name, 'es');
      });
    }
    return entries;
  }, [filteredEntries, archiveSort]);

  const groupedEntries = useMemo(() => {
    if (archiveGrouping === 'all') {
      return [{ title: 'Todos los hechizos', entries: sortedEntries }];
    }

    const groups = new Map<string, ArchiveEntry[]>();
    for (const entry of sortedEntries) {
      const title =
        entry.displaySpell.catalogChainGroup ||
        (entry.section === 'exclusive'
          ? 'Exclusivos'
          : entry.section === 'foco'
            ? 'Foco Arcano'
            : 'Otros hechizos');
      const list = groups.get(title) || [];
      list.push(entry);
      groups.set(title, list);
    }

    return Array.from(groups.entries())
      .map(([title, entries]) => ({ title, entries }))
      .sort((a, b) => {
        if (a.title === 'Foco Arcano') return -1;
        if (b.title === 'Foco Arcano') return 1;
        return a.title.localeCompare(b.title, 'es');
      });
  }, [archiveGrouping, sortedEntries]);

  const suggestedEvolutions = useMemo(() => {
    const base = getSuggestedNatureEvolutions(primaryNature.preset.id);
    return base.filter((id) => !ownedNatureSet.has(id));
  }, [primaryNature.preset.id, ownedNatureSet]);

  const availableNaturesToGrant = useMemo(
    () =>
      MAGE_NATURES.filter(
        (n) => n.id !== 'personalizada' && !ownedNatureSet.has(n.id)
      ),
    [ownedNatureSet]
  );

  const triggerLearnAdapted = (template: Spell, includePrerequisite = false) => {
    const message = onLearnAdaptedSpell(
      template,
      selectedNatureId || undefined,
      includePrerequisite
    );
    if (message) setNotice(message);
  };

  const triggerLearnBasic = (spellId: string, prereqSpellId?: string) => {
    const message = onLearnBasicSpell(spellId, prereqSpellId);
    if (message) setNotice(message);
  };

  const handleGrantNatureAndSelect = (natureId: string) => {
    if (!activeCharacter || !natureId) return;
    onToggleUnlockedNature(natureId, true);
    setSelectedNatureId(natureId);
    setNotice(
      `Afinidad ${getNatureShortName(natureId)} desbloqueada para ${activeCharacter.name}. Ahora podés abrir las llaves de sus hechizos compatibles.`
    );
  };

  if (archiveView === 'knowledge') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-3">
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--arc-accent)]">
              Árboles de conocimiento
            </h1>
            <p className="text-xs text-[var(--arc-muted)]">
              Progresión de disciplinas y especializaciones; los requisitos no son dependencias de combate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setArchiveView('catalog')}
            className="min-h-[36px] rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
          >
            Volver al Archivo Arcano
          </button>
        </div>
        <KnowledgeTreePanel
          spells={spells}
          activeCharacter={activeCharacter}
          settings={knowledgeTreeSettings}
          onLearnSpell={onLearnKnowledgeSpell}
          onSetDisciplineMastery={onSetDisciplineMastery}
          onToggleDisciplineDiscovery={onToggleDisciplineDiscovery}
          onUpdateSettings={onUpdateKnowledgeTreeSettings}
          onGoToGrimorio={onGoToGrimorio}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera, resumen de auditoría elemental y botón Llave del DJ */}
      <div className="flex flex-col gap-3 border-b border-[var(--arc-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--arc-accent)]">
              Archivo Arcano
            </h1>
            <span className="font-mono-num text-xs text-[var(--arc-muted)]">
              {catalogStats.compatible}/{catalogStats.total} viables con {resolvedNature.elementName} ·{' '}
              {catalogStats.unlockedKeys}/{catalogStats.total} llaves abiertas ·{' '}
              {catalogStats.learned}/{catalogStats.total} aprendidos
            </span>
          </div>
          <p className="text-[13px] text-[var(--arc-muted)]">
            Todos los hechizos del catálogo comienzan bajo llave y se validan 1 a 1 según la física y naturaleza del elemento activo.
          </p>
        </div>

        {/* Selector de afinidad + interruptor Llave del DJ */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Elemento o naturaleza activa del Archivo Arcano"
            value={selectedNatureId}
            onChange={(e) => setSelectedNatureId(e.target.value)}
            className="min-h-[36px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs font-medium text-[var(--arc-text)]"
          >
            <optgroup label={`Afinidades de ${activeCharacter?.name || 'Personaje'}`}>
              <option value="">
                Principal: {primaryNature.elementName}
              </option>
              {(activeCharacter?.unlockedNatures || []).map((natId) => (
                <option key={natId} value={natId}>
                  Desbloqueado: {getNatureShortName(natId)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Solo vista previa (no desbloqueado)">
              {MAGE_NATURES.filter(
                (n) => n.id !== 'personalizada' && !ownedNatureSet.has(n.id)
              ).map((nat) => (
                <option key={nat.id} value={nat.id}>
                  Vista previa: {nat.label}
                </option>
              ))}
            </optgroup>
          </select>

          {selectedNatureId && (
            <button
              type="button"
              onClick={() => setSelectedNatureId('')}
              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
              title="Volver al elemento principal del personaje"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Principal
            </button>
          )}

          <button
            type="button"
            disabled={!activeCharacter}
            onClick={() => setDmKeyMode((v) => !v)}
            className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
              dmKeyMode
                ? 'border-[var(--arc-accent)] bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                : 'border-[var(--arc-border)] bg-transparent text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {dmKeyMode ? 'Llave del DJ: Activa' : 'Llave del DJ'}
          </button>
          <button
            type="button"
            onClick={() => setArchiveView('knowledge')}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap transition-colors"
          >
            Árboles de conocimiento
          </button>
        </div>
      </div>

      {/* Aviso si se está previsualizando un elemento que el personaje todavía no desbloqueó */}
      {!isSelectedNatureOwned && activeCharacter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#7c5c26] bg-[var(--arc-surface)] px-3.5 py-2.5 text-xs">
          <div className="inline-flex items-center gap-2 text-[#e6c07b]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Vista previa de {resolvedNature.elementName}:</strong> {activeCharacter.name}{' '}
              aún no desbloqueó esta afinidad (solo posee{' '}
              {ownedNatureIds.map((id) => getNatureShortName(id)).join(', ')}). No podrá aprender hechizos de{' '}
              {resolvedNature.elementName} hasta que el DJ la desbloquee.
            </span>
          </div>
          {dmKeyMode && (
            <button
              type="button"
              onClick={() => handleGrantNatureAndSelect(resolvedNature.preset.id)}
              className="min-h-[32px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Desbloquear {resolvedNature.elementName}
            </button>
          )}
        </div>
      )}

      {/* Panel de Gestión de Llaves y Sub-elementos (solo visible en Modo Llave del DJ) */}
      {dmKeyMode && activeCharacter && (
        <div className="rounded-xl border border-[var(--arc-accent)]/50 bg-[var(--arc-surface)] px-4 py-3.5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2.5">
            <div className="inline-flex items-center gap-2 font-semibold text-[var(--arc-accent)]">
              <KeyRound className="h-4 w-4" />
              <span>
                Control de Llaves del DJ · {activeCharacter.name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const compatibleIds = catalogEntries
                    .filter((e) => e.compatibility.compatible)
                    .map((e) => e.template.id);
                  onSetArchiveKeyLocksBulk(compatibleIds, true);
                  setNotice(
                    `Llaves abiertas para los ${compatibleIds.length} hechizos compatibles con ${resolvedNature.elementName}.`
                  );
                }}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-[var(--arc-border)] px-2.5 font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
              >
                <LockOpen className="h-3.5 w-3.5 text-[#9ad489]" />
                Abrir compatibles ({catalogStats.compatible})
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetArchiveKeyLocksBulk(ALL_ARCHIVE_LOCKED_IDS, true);
                  setNotice(
                    `Todas las llaves del catálogo (13) fueron abiertas para ${activeCharacter.name}. Los hechizos incompatibles seguirán bloqueados por física elemental.`
                  );
                }}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-[var(--arc-border)] px-2.5 font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
              >
                Abrir todas (13)
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetArchiveKeyLocksBulk(ALL_ARCHIVE_LOCKED_IDS, false);
                  setNotice(
                    `Todos los hechizos del Archivo Arcano volvieron a quedar bajo llave para ${activeCharacter.name}.`
                  );
                }}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-[var(--arc-border)] px-2.5 font-semibold text-[#e09b7d] hover:bg-[var(--arc-raised)]"
              >
                <Lock className="h-3.5 w-3.5" />
                Bloquear todo bajo llave
              </button>
            </div>
          </div>

          {/* Sub-elementos / Evoluciones desbloqueadas del personaje */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-[var(--arc-muted)]">Afinidades activas:</span>
              <strong className="text-[var(--arc-text)]">
                {primaryNature.elementName} (principal)
              </strong>
              {(activeCharacter.unlockedNatures || []).map((natId) => (
                <span
                  key={natId}
                  className="inline-flex items-center gap-1 font-semibold text-[#9ad489]"
                >
                  <span className="text-[var(--arc-muted)]">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedNatureId(natId)}
                    className="hover:underline"
                    title={`Seleccionar ${getNatureShortName(natId)}`}
                  >
                    {getNatureShortName(natId)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleUnlockedNature(natId, false);
                      if (selectedNatureId === natId) setSelectedNatureId('');
                    }}
                    aria-label={`Revocar afinidad ${getNatureShortName(natId)}`}
                    className="text-[var(--arc-muted)] hover:text-[#e08060]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {suggestedEvolutions.map((evoId) => (
                <button
                  key={evoId}
                  type="button"
                  onClick={() => handleGrantNatureAndSelect(evoId)}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-lg border border-[var(--arc-accent)]/50 px-2.5 font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
                >
                  <Plus className="h-3 w-3" />
                  Desbloquear {getNatureShortName(evoId)}
                </button>
              ))}

              <select
                aria-label="Otorgar sub-elemento o naturaleza adicional"
                value={natureToGrant}
                onChange={(e) => {
                  const id = e.target.value;
                  setNatureToGrant('');
                  if (id) handleGrantNatureAndSelect(id);
                }}
                className="min-h-[30px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
              >
                <option value="">+ Otra afinidad...</option>
                {availableNaturesToGrant.map((nat) => (
                  <option key={nat.id} value={nat.id}>
                    {nat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación discreta tras aprender o desbloquear */}
      {notice && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] px-3.5 py-2.5 text-xs">
          <div className="inline-flex items-center gap-2 text-[var(--arc-text)]">
            <Check className="h-4 w-4 shrink-0 text-[#9ad489]" />
            <span>{notice}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onGoToGrimorio}
              className="font-semibold text-[var(--arc-accent)] hover:underline"
            >
              Ver en Grimorio
            </button>
            <button
              type="button"
              onClick={onGoToCombat}
              className="font-semibold text-[var(--arc-text)] hover:underline"
            >
              Ir a Combate
            </button>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Cerrar aviso"
              className="text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Barra de alcance segmentado + filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--arc-border)] pb-3">
          {(
            [
              { id: 'all', label: 'Todos', count: scopeCounts.all },
              { id: 'adaptable', label: 'Adaptables', count: scopeCounts.adaptable },
              { id: 'foco', label: 'Foco Arcano', count: scopeCounts.foco },
              {
                id: 'other_unlearned',
                label: 'Otros no aprendidos',
                count: scopeCounts.other_unlearned,
              },
              {
                id: 'exclusive',
                label: 'Exclusivos / No aprendibles',
                count: scopeCounts.exclusive,
              },
            ] as Array<{ id: ArchiveScope; label: string; count: number }>
          ).map((item) => {
            const active = scope === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                    : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                }`}
              >
                <span>{item.label}</span>
                <span className="font-mono-num opacity-80">({item.count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[210px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--arc-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, cadena, elemento, estado u orden..."
                className="min-h-[36px] w-full rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] pl-8 pr-8 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1" aria-label="Categorías rápidas">
              {(
                [
                  ['all', 'Todas'],
                  ['damage', 'Ataque'],
                  ['defense', 'Defensa'],
                  ['heal', 'Curación'],
                  ['buff', 'Buff'],
                  ['debuff', 'Control'],
                ] as Array<[ArchiveCategoryFilter, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === value ? 'all' : value)}
                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                    categoryFilter === value
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)] ring-1 ring-[var(--arc-accent)]/40'
                      : 'text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAdvancedFiltersOpen((open) => !open)}
              aria-expanded={advancedFiltersOpen}
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                advancedFiltersOpen || categoryFilter !== 'all'
                  ? 'border-[var(--arc-accent)]/50 text-[var(--arc-accent)]'
                  : 'border-[var(--arc-border)] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              <ChevronDown className={`h-3 w-3 transition-transform ${advancedFiltersOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Agrupar hechizos"
                value={archiveGrouping}
                onChange={(e) => setArchiveGrouping(e.target.value as ArchiveGrouping)}
                className="min-h-[34px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
              >
                <option value="chains">Por familias</option>
                <option value="all">Todos juntos</option>
              </select>
              <select
                aria-label="Ordenar hechizos"
                value={archiveSort}
                onChange={(e) => setArchiveSort(e.target.value as ArchiveSort)}
                className="min-h-[34px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
              >
                <option value="relevance">Exploración recomendada</option>
                <option value="name">Nombre</option>
                <option value="category">Categoría</option>
                <option value="mana">Costo de maná</option>
                <option value="chain">Familia</option>
              </select>
            </div>
          </div>

          {advancedFiltersOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] px-3 py-2.5">
              <select
                aria-label="Filtro avanzado"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ArchiveCategoryFilter)}
                className="min-h-[34px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
              >
                <option value="all">Todos los criterios</option>
                <option value="compatible">Viables con {resolvedNature.elementName}</option>
                <option value="incompatible">Bloqueados por elemento ({resolvedNature.elementName})</option>
                <option value="key_unlocked">Llave abierta</option>
                <option value="key_locked">Bajo llave</option>
                <option value="effect">Efectos generales</option>
                <option value="with_dependency">Con requisito de activación</option>
                <option value="area">Daño en área</option>
                <option value="with_mastery">Admite maestría</option>
                <option value="no_mastery">Sin maestría</option>
              </select>
              <label className="inline-flex min-h-[34px] items-center gap-2 rounded-lg px-2 text-xs text-[var(--arc-muted)] cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showAlreadyLearned}
                  onChange={(e) => setShowAlreadyLearned(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[var(--arc-border)] accent-[var(--arc-action)]"
                />
                Mostrar ya aprendidos
              </label>
              {(searchQuery || categoryFilter !== 'all' || showAlreadyLearned || scope !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setScope('all');
                    setShowAlreadyLearned(false);
                  }}
                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpiar todo
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-mono-num font-semibold text-[var(--arc-text)]">
              {sortedEntries.length} resultado{sortedEntries.length === 1 ? '' : 's'}
            </span>
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="inline-flex items-center gap-1 rounded-full border border-[var(--arc-border)] px-2 py-1 text-[var(--arc-muted)] hover:text-[var(--arc-text)]">
                Búsqueda: {searchQuery}<X className="h-3 w-3" />
              </button>
            )}
            {categoryFilter !== 'all' && (
              <button type="button" onClick={() => setCategoryFilter('all')} className="inline-flex items-center gap-1 rounded-full border border-[var(--arc-accent)]/40 px-2 py-1 text-[var(--arc-accent)]">
                Filtro activo<X className="h-3 w-3" />
              </button>
            )}
            {scope !== 'all' && (
              <button type="button" onClick={() => setScope('all')} className="inline-flex items-center gap-1 rounded-full border border-[var(--arc-border)] px-2 py-1 text-[var(--arc-muted)] hover:text-[var(--arc-text)]">
                Alcance<X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Listado principal plano de una sola elevación */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] px-5 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-[var(--arc-text)]">
            No hay hechizos que coincidan con estos filtros
          </p>
          <p className="text-xs text-[var(--arc-muted)]">
            Probá limpiar la búsqueda, cambiar de pestaña o activar &ldquo;Mostrar ya aprendidos&rdquo;.
          </p>
          {(searchQuery || categoryFilter !== 'all' || !showAlreadyLearned) && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setScope('all');
                }}
                className="min-h-[34px] rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
              >
                Ver todos los disponibles
              </button>
              {!showAlreadyLearned && (
                <button
                  type="button"
                  onClick={() => setShowAlreadyLearned(true)}
                  className="min-h-[34px] rounded-lg px-3 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
                >
                  Mostrar ya aprendidos
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedEntries.map((group) => (
            <section
              key={group.title}
              className="overflow-hidden rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)]"
            >
              {archiveGrouping === 'chains' && (
                <header className="flex items-center justify-between gap-3 border-b border-[var(--arc-border)] px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-[var(--arc-accent)]" />
                    <h2 className="text-sm font-bold text-[var(--arc-text)]">{group.title}</h2>
                  </div>
                  <span className="font-mono-num text-xs text-[var(--arc-muted)]">
                    {group.entries.length} hechizo{group.entries.length === 1 ? '' : 's'}
                  </span>
                </header>
              )}
              <div className="divide-y divide-[var(--arc-border)]">
          {group.entries.map((entry) => {
            const sp = entry.displaySpell;
            const cat = getSpellCategory(sp);
            const hasMastery = spellSupportsMastery(sp);
            const isElementCompatible = entry.compatibility.compatible;
            const isCatalogEntry = entry.section === 'adaptable' || entry.section === 'foco';
            const isLockedByKey = entry.requiresKey && !entry.isKeyUnlocked;
            const canLearnNow =
              Boolean(activeCharacter) &&
              entry.section !== 'exclusive' &&
              isElementCompatible &&
              !isLockedByKey &&
              (entry.section !== 'adaptable' || isSelectedNatureOwned);

            const canLearnChainNow =
              canLearnNow &&
              !entry.isLearned &&
              Boolean(entry.prereqTemplate) &&
              !entry.prereqLearned &&
              entry.prereqCompatible &&
              entry.prereqKeyUnlocked;

            const damageText =
              sp.damage.dice.length > 0 || sp.damage.bonus !== 0
                ? formatDiceSummary(sp.damage.dice, sp.damage.bonus)
                : '';
            const armorText = sp.armorConfig?.isArmor
              ? `Armadura ${sp.armorConfig.element || ''} (-${sp.armorConfig.damageReduction || 0} daño${
                  sp.armorConfig.maxHits ? ` · ${sp.armorConfig.maxHits} golpes` : ''
                })`.trim()
              : '';
            const elemMeta = sp.elementalStatus
              ? ELEMENTAL_STATUS_META[sp.elementalStatus.kind]
              : null;

            const suggestedUnlockableNatures =
              !isElementCompatible && entry.compatibility.suggestedNatureIds
                ? entry.compatibility.suggestedNatureIds.filter((id) => !ownedNatureSet.has(id))
                : [];
            const goalId = entry.template.id;
            const isGoal = Boolean(activeCharacter?.archiveGoalIds?.includes(goalId));
            const goalProgress = activeCharacter
              ? getSpellGoalProgress(activeCharacter, spells, goalId)
              : null;
            const isGoalExpanded = expandedGoalIds.has(goalId);

            return (
              <div
                key={entry.key}
              className={`border-l-2 px-4 py-4 sm:px-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${
                entry.isLearned
                  ? 'border-l-[#9ad489]'
                  : entry.section === 'exclusive'
                    ? 'border-l-[#e09b7d]'
                    : isCatalogEntry && (!isElementCompatible || isLockedByKey)
                      ? 'border-l-[#b7864e] bg-[#b7864e]/[0.025]'
                      : 'border-l-transparent'
              }`}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Fila de título + cadena + estado de llave / viabilidad */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <SpellCategoryIcon category={cat} className="h-4 w-4 shrink-0" />
                    <h2 className="text-[15px] font-semibold text-[var(--arc-text)]">
                      {sp.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        const actions: SpellInspectorAction[] = entry.isLearned
                          ? [
                              {
                                label: 'Ver en Grimorio',
                                onClick: onGoToGrimorio,
                              },
                            ]
                          : entry.section === 'exclusive' ||
                              isLockedByKey ||
                              (entry.section === 'adaptable' &&
                                (!isElementCompatible || !isSelectedNatureOwned))
                            ? []
                            : [
                                {
                                  label:
                                    entry.section === 'adaptable'
                                      ? 'Aprender adaptado'
                                      : 'Aprender',
                                  disabled: !activeCharacter,
                                  reason: activeCharacter
                                    ? undefined
                                    : 'Seleccioná un personaje para aprender hechizos.',
                                  onClick: () =>
                                    entry.section === 'adaptable'
                                      ? triggerLearnAdapted(entry.template, false)
                                      : triggerLearnBasic(entry.template.id),
                                },
                              ];
                        setInspectedEntry({ entry, actions });
                      }}
                      aria-label={`Consultar ficha de ${sp.name}`}
                      title="Consultar ficha completa"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {sp.catalogChainGroup && (
                      <span className="text-xs font-medium text-[var(--arc-accent)]">
                        Familia: {sp.catalogChainGroup}
                      </span>
                    )}
                    {entry.section === 'adaptable' && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--arc-muted)]">
                        <Sparkles className="h-3 w-3 text-[var(--arc-accent)]" />
                        {resolvedNature.elementName}
                      </span>
                    )}
                    {isCatalogEntry && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isLockedByKey ? 'text-[#e09b7d]' : 'text-[#9ad489]'
                        }`}
                      >
                        {isLockedByKey ? (
                          <>
                            <Lock className="h-3 w-3" />
                            Bajo llave
                          </>
                        ) : (
                          <>
                            <LockOpen className="h-3 w-3" />
                            Llave abierta
                          </>
                        )}
                      </span>
                    )}
                    {entry.section === 'exclusive' && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#e09b7d]">
                        <Lock className="h-3 w-3" />
                        Exclusivo de {entry.ownerName}
                      </span>
                    )}
                    {entry.isLearned && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9ad489]">
                        <Check className="h-3.5 w-3.5" />
                        Aprendido
                        {entry.learnedVariantNames.length > 0 &&
                          entry.learnedVariantNames[0] !== sp.name &&
                          ` (${entry.learnedVariantNames.join(', ')})`}
                      </span>
                    )}
                  </div>

                  {/* Línea estructurada de estadísticas clave (sin cápsulas estáticas) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono-num text-[var(--arc-muted)]">
                    <span className="font-sans font-semibold text-[var(--arc-text)]">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{sp.manaCost} maná</span>
                    {damageText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--arc-text)]">
                          {sp.effectType === 'heal'
                            ? `Cura ${damageText} PV`
                            : `${damageText} ${sp.damageKind === 'fisico' ? 'físico' : 'mágico'}`}
                        </span>
                      </>
                    )}
                    {sp.assuredSuccess > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#9ad489]">+{sp.assuredSuccess} éxito aseg.</span>
                      </>
                    )}
                    {armorText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans text-[var(--arc-text)]">{armorText}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">{sp.duration || 'Instantáneo'}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-sans inline-flex items-center gap-1 ${
                        hasMastery ? 'text-[var(--arc-accent)]' : 'text-[var(--arc-muted)]'
                      }`}
                    >
                      <Award className="h-3 w-3" />
                      {hasMastery ? 'Admite maestría' : 'Sin maestría'}
                    </span>
                  </div>

                  {/* Auditoría 1 a 1 de viabilidad elemental */}
                  {entry.section === 'adaptable' && !isElementCompatible && (
                    <div className="flex flex-wrap items-start gap-2 pt-0.5 text-xs text-[#e09b7d]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p>
                          <strong>No viable con {resolvedNature.elementName}:</strong>{' '}
                          {entry.compatibility.reason}
                        </p>
                        {entry.compatibility.suggestedNatureIds &&
                          entry.compatibility.suggestedNatureIds.length > 0 && (
                            <p className="text-[var(--arc-muted)]">
                              Viable desbloqueando:{' '}
                              <span className="font-semibold text-[var(--arc-text)]">
                                {entry.compatibility.suggestedNatureIds
                                  .map((id) => getNatureShortName(id))
                                  .join(', ')}
                              </span>
                            </p>
                          )}
                      </div>
                    </div>
                  )}

                  {isElementCompatible && entry.compatibility.tacticalNote && (
                    <p className="text-xs text-[var(--arc-accent)]">
                      {entry.compatibility.tacticalNote}
                    </p>
                  )}

                  {/* Requisitos de activación, área y estados */}
                  {(sp.dependency?.enabled ||
                    sp.areaConfig?.enabled ||
                    sp.statuses.length > 0 ||
                    elemMeta) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {sp.dependency?.enabled && (
                        <span className="inline-flex items-center gap-1 text-[#e6c07b]">
                          <Link2 className="h-3.5 w-3.5 shrink-0" />
                          {formatSpellDependencyLine(sp.dependency)}
                        </span>
                      )}
                      {sp.areaConfig?.enabled && (
                        <span className="text-[var(--arc-magic-accent)]">
                          Área: {sp.areaConfig.shapeNote || 'Múltiples objetivos'}
                        </span>
                      )}
                      {sp.statuses.length > 0 && (
                        <span className="text-[var(--arc-text)]">
                          Estados: {sp.statuses.join(', ')}
                        </span>
                      )}
                      {elemMeta && sp.elementalStatus && (
                        <span className="text-[var(--arc-muted)]">
                          Efecto elemental: {elemMeta.name} (
                          {TRIGGER_LABELS[sp.elementalStatus.trigger] || sp.elementalStatus.trigger})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Descripción y órdenes */}
                  <p className="text-[13px] leading-relaxed text-[var(--arc-muted)]">
                    {sp.effectDescription}
                  </p>
                  {goalProgress && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onToggleArchiveGoal(goalId)}
                        className={`min-h-[30px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                          isGoal
                            ? 'border-[var(--arc-accent)] bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                            : 'border-[var(--arc-border)] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                        }`}
                      >
                        <Target className="h-3.5 w-3.5" />
                        {isGoal ? 'Quitar objetivo' : 'Marcar objetivo'}
                      </button>
                      {isGoal && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGoalIds((previous) => {
                              const next = new Set(previous);
                              if (next.has(goalId)) next.delete(goalId);
                              else next.add(goalId);
                              return next;
                            })
                          }
                          aria-expanded={isGoalExpanded}
                          className="min-h-[30px] inline-flex items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
                        >
                          {goalProgress.completedRequirements}/{goalProgress.totalRequirements} requisitos
                          <ChevronDown className={`h-3 w-3 transition-transform ${isGoalExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  )}
                  {isGoal && isGoalExpanded && goalProgress && (
                    <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] px-3 py-2.5">
                      <p className="mb-2 text-xs font-semibold text-[var(--arc-text)]">
                        Camino de progresión
                      </p>
                      <div className="space-y-2">
                        {(() => {
                          const renderPath = (node: (typeof goalProgress.path)[number], depth = 0): React.ReactNode => (
                            <div key={`${node.id}-${depth}`} style={{ marginLeft: `${depth * 14}px` }}>
                              <div className="flex items-start gap-2 text-xs">
                                <span
                                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                    node.status === 'completed'
                                      ? 'bg-[#9ad489]'
                                      : node.status === 'blocked'
                                        ? 'bg-[#e09b7d]'
                                        : 'bg-[var(--arc-muted)]'
                                  }`}
                                />
                                <div>
                                  <p className="font-semibold text-[var(--arc-text)]">{node.name}</p>
                                  <p className="text-[var(--arc-muted)]">{node.reason}</p>
                                </div>
                              </div>
                              {node.prerequisites.map((prerequisite) => renderPath(prerequisite, depth + 1))}
                            </div>
                          );
                          return goalProgress.path.map((node) => renderPath(node));
                        })()}
                      </div>
                    </div>
                  )}
                  {sp.orders.length > 0 && (
                    <div className="text-[11px] text-[var(--arc-muted)]">
                      Órdenes: <span className="text-[var(--arc-text)]">{sp.orders.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Columna de acciones y control de llave */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end lg:min-w-[220px] shrink-0">
                  {/* Controles de Llave del DJ por hechizo */}
                  {dmKeyMode && isCatalogEntry && activeCharacter && (
                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleArchiveKeyLock(entry.template.id, !entry.isKeyUnlocked);
                          setNotice(
                            !entry.isKeyUnlocked
                              ? `Llave abierta para ${sp.name} (${activeCharacter.name}).`
                              : `${sp.name} volvió a quedar bajo llave para ${activeCharacter.name}.`
                          );
                        }}
                        className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                          entry.isKeyUnlocked
                            ? 'border-[var(--arc-border)] text-[#e09b7d] hover:bg-[var(--arc-raised)]'
                            : 'border-[var(--arc-accent)] text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]'
                        }`}
                      >
                        {entry.isKeyUnlocked ? (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            Cerrar llave
                          </>
                        ) : (
                          <>
                            <KeyRound className="h-3.5 w-3.5" />
                            Abrir llave
                          </>
                        )}
                      </button>

                      {!isElementCompatible && suggestedUnlockableNatures[0] && (
                        <button
                          type="button"
                          onClick={() =>
                            handleGrantNatureAndSelect(suggestedUnlockableNatures[0])
                          }
                          className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-[var(--arc-border)] px-2.5 text-xs font-semibold text-[#9ad489] hover:bg-[var(--arc-raised)] whitespace-nowrap"
                          title={`Desbloquear afinidad ${getNatureShortName(suggestedUnlockableNatures[0])} para ${activeCharacter.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {getNatureShortName(suggestedUnlockableNatures[0])}
                        </button>
                      )}
                    </div>
                  )}

                  {entry.section === 'exclusive' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--arc-muted)] py-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      No aprendible
                    </span>
                  ) : entry.section === 'adaptable' ? (
                    <>
                      {!isElementCompatible ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#e09b7d] py-1">
                          <Lock className="h-3.5 w-3.5" />
                          Bloqueado por elemento
                        </span>
                      ) : !isSelectedNatureOwned ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e6c07b] py-1 text-right">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          Requiere afinidad {resolvedNature.elementName}
                        </span>
                      ) : isLockedByKey ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--arc-muted)] py-1">
                          <Lock className="h-3.5 w-3.5" />
                          Bajo llave (pedir al DJ)
                        </span>
                      ) : !entry.isLearned ? (
                        <button
                          type="button"
                          disabled={!canLearnNow}
                          onClick={() => triggerLearnAdapted(entry.template, false)}
                          className="min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 whitespace-nowrap transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Aprender adaptado
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={onGoToGrimorio}
                            className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap transition-colors"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Ver en Grimorio
                          </button>
                          {selectedNatureId &&
                            isSelectedNatureOwned &&
                            !entry.learnedVariantNames.includes(sp.name) && (
                              <button
                                type="button"
                                disabled={!canLearnNow}
                                onClick={() => triggerLearnAdapted(entry.template, false)}
                                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap transition-colors"
                              >
                                Aprender versión {resolvedNature.elementName}
                              </button>
                            )}
                        </div>
                      )}

                      {canLearnChainNow && entry.prereqTemplate && (
                        <button
                          type="button"
                          onClick={() => triggerLearnAdapted(entry.template, true)}
                          className="min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--arc-border)] bg-transparent px-3 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap transition-colors"
                          title={`Aprende ${entry.prereqAdaptedName || entry.prereqTemplate.name} y ${sp.name} juntos`}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Aprender ambos
                        </button>
                      )}

                      {(canLearnNow || dmKeyMode) && isElementCompatible && (
                        <button
                          type="button"
                          disabled={!activeCharacter}
                          onClick={() =>
                            onCustomizeCatalogSpell(entry.template, selectedNatureId || undefined)
                          }
                          className="min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] disabled:opacity-40 whitespace-nowrap transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Personalizar en editor
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {isLockedByKey ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--arc-muted)] py-1">
                          <Lock className="h-3.5 w-3.5" />
                          Bajo llave (pedir al DJ)
                        </span>
                      ) : !entry.isLearned ? (
                        <>
                          <button
                            type="button"
                            disabled={!activeCharacter}
                            onClick={() => triggerLearnBasic(entry.template.id)}
                            className="min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 whitespace-nowrap transition-colors"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Aprender
                          </button>
                          {canLearnChainNow && entry.prereqTemplate && (
                            <button
                              type="button"
                              disabled={!activeCharacter}
                              onClick={() =>
                                triggerLearnBasic(entry.template.id, entry.prereqTemplate?.id)
                              }
                              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] disabled:opacity-40 whitespace-nowrap transition-colors"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Aprender con {entry.prereqTemplate.name}
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={onGoToGrimorio}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap transition-colors"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          Ver en Grimorio
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
              </div>
            </section>
          ))}
        </div>
      )}
      {inspectedEntry && (
        <SpellInspector
          key={inspectedEntry.entry.displaySpell.id}
          spell={inspectedEntry.entry.displaySpell}
          spells={spells}
          activeCharacter={activeCharacter}
          formula={formula}
          contextLabel={`Archivo Arcano · ${resolvedNature.elementName}`}
          compatibility={{
            compatible: inspectedEntry.entry.compatibility.compatible,
            label: inspectedEntry.entry.compatibility.compatible
              ? `Compatible con ${resolvedNature.elementName}`
              : `No compatible con ${resolvedNature.elementName}`,
            detail:
              inspectedEntry.entry.compatibility.reason ||
              inspectedEntry.entry.compatibility.tacticalNote ||
              (inspectedEntry.entry.requiresKey && !inspectedEntry.entry.isKeyUnlocked
                ? 'Este hechizo está bajo llave.'
                : undefined),
          }}
          archivePrerequisiteStatus={
            inspectedEntry.entry.prereqTemplate
              ? {
                  learned: inspectedEntry.entry.prereqLearned,
                  name:
                    inspectedEntry.entry.prereqAdaptedName ||
                    inspectedEntry.entry.prereqTemplate.name,
                }
              : undefined
          }
          actions={inspectedEntry.actions}
          onTestSpell={onTestSpell}
          onClose={() => setInspectedEntry(null)}
        />
      )}
    </div>
  );
}