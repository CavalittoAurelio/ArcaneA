import { useRef, useState } from 'react';
import {
  Award,
  Check,
  Copy,
  Download,
  Heart,
  Lock,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  ScrollText,
  Search,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Utensils,
  X,
} from 'lucide-react';
import type {
  Character,
  CharacterKind,
  FormulaConfig,
  MagePhysicalVariant,
  ProgressionHistoryEntry,
  Spell,
  SpellEffectType,
  StatKey,
} from '../types/rpg';
import {
  MAGE_NATURES,
  MAGE_NATURE_CATEGORIES,
  PHYSICAL_VARIANTS,
  STARTER_NPC_SPELL_IDS,
  STAT_NAMES,
  calcStatLevelFromPoints,
  characterHasNatureCanalizado,
  conditionLabel,
  generateId,
  getCharacterLevel,
  getCharacterStatDice,
  getCharacterStatPoints,
  getEffectiveEffectSubType,
  getEffectiveSpellDamageDice,
  getMageStarterBasicIds,
  getSpellMasteryStatus,
  getStatLevelStatus,
  getStatMilestones,
  isSpellMagical,
  parseDurationTurns,
  rollSingleDie,
  spellSupportsMastery,
} from '../utils/dice';
import { KNOWLEDGE_TREE_SPELLS } from '../utils/knowledgeTrees';
import { getSpellGoalProgress } from '../utils/progression';

const KNOWLEDGE_TREE_SPELL_IDS = new Set(KNOWLEDGE_TREE_SPELLS.map((s) => s.id));

export interface CreateCharacterOptions {
  name: string;
  kind: CharacterKind;
  natureId: string;
  customNature?: string;
  physicalVariant: MagePhysicalVariant;
  customPhysicalName?: string;
}

interface CharacterRosterProps {
  characters: Character[];
  activeCharacterId: string;
  spells: Spell[];
  formula: FormulaConfig;
  combatCharacterIds: Set<string>;
  onSelectCharacter: (id: string) => void;
  onUpdateCharacter: (updated: Character) => void;
  onCreateCharacter: (options: CreateCharacterOptions) => void;
  onApplyNatureToCharacter: (
    characterId: string,
    options: Omit<CreateCharacterOptions, 'name' | 'kind'> & {
      keepPreviousCanalizado?: boolean;
    }
  ) => void;
  onDuplicateCharacter: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
  onExportCharacter: (id: string) => void;
  onCopyCharacterCode: (id: string) => Promise<boolean>;
  onImportCharacter: (rawText: string) => { ok: boolean; message: string };
  onToggleKnownSpell: (characterId: string, spellId: string) => void;
  onSetKnownSpells: (characterId: string, spellIds: string[]) => void;
  onAdjustHp: (id: string, delta: number, lethal?: boolean) => void;
  onAdjustMana: (id: string, delta: number) => void;
  onResetResources: (id: string, resource: 'hp' | 'mana') => void;
  onAddToCombat: (id: string) => void;
}

const STAT_KEYS: StatKey[] = ['fisico', 'manipulacion', 'influencia'];

const TYPE_FILTERS: Array<{ value: 'all' | SpellEffectType; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'damage', label: 'Ataque' },
  { value: 'defense', label: 'Defensa' },
  { value: 'heal', label: 'Curación' },
  { value: 'effect', label: 'Efecto' },
];

const TYPE_LABELS: Record<SpellEffectType, string> = {
  damage: 'Ataque',
  defense: 'Defensa',
  heal: 'Curación',
  effect: 'Efecto',
};

export function CharacterRoster({
  characters,
  activeCharacterId,
  spells,
  formula,
  combatCharacterIds,
  onSelectCharacter,
  onUpdateCharacter,
  onCreateCharacter,
  onApplyNatureToCharacter,
  onDuplicateCharacter,
  onDeleteCharacter,
  onExportCharacter,
  onCopyCharacterCode,
  onImportCharacter,
  onToggleKnownSpell,
  onSetKnownSpells,
  onAdjustHp,
  onAdjustMana,
  onResetResources,
  onAddToCombat,
}: CharacterRosterProps) {
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CharacterKind>('mage');
  const [newNatureId, setNewNatureId] = useState('fuego');
  const [newCustomNature, setNewCustomNature] = useState('');
  const [newPhysicalVariant, setNewPhysicalVariant] = useState<MagePhysicalVariant>('golpe_fisico');
  const [newCustomPhysicalName, setNewCustomPhysicalName] = useState('');
  const [showAdaptNature, setShowAdaptNature] = useState(false);
  const [adaptNatureId, setAdaptNatureId] = useState('fuego');
  const [adaptCustomNature, setAdaptCustomNature] = useState('');
  const [adaptPhysicalVariant, setAdaptPhysicalVariant] =
    useState<MagePhysicalVariant>('golpe_fisico');
  const [adaptCustomPhysicalName, setAdaptCustomPhysicalName] = useState('');
  const [adaptKeepPreviousCanalizado, setAdaptKeepPreviousCanalizado] = useState(false);
  const [spellSearch, setSpellSearch] = useState('');
  const [spellFilter, setSpellFilter] = useState<'all' | SpellEffectType>('all');
  const [showOtherPlayersSpells, setShowOtherPlayersSpells] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [levelUpCharId, setLevelUpCharId] = useState<string | null>(null);
  const [levelUpAlloc, setLevelUpAlloc] = useState<Record<StatKey, number>>({
    fisico: 0,
    manipulacion: 0,
    influencia: 0,
  });
  const [levelUpRestoreMana, setLevelUpRestoreMana] = useState(true);
  const [levelUpFeedback, setLevelUpFeedback] = useState<string>('');

  const [banquetCharId, setBanquetCharId] = useState<string | null>(null);
  const [banquetNote, setBanquetNote] = useState('');
  const [banquetRestoreCurrent, setBanquetRestoreCurrent] = useState(true);

  const [showProgressionHistory, setShowProgressionHistory] = useState(false);

  const active = characters.find((c) => c.id === activeCharacterId) || characters[0];
  const activeLevel = getCharacterLevel(active);
  const activeHistory = active?.progressionHistory || [];
  const showLevelUp = Boolean(active && levelUpCharId === active.id);
  const showBanquet = Boolean(active && banquetCharId === active.id);
  const LEVEL_UP_MANA_GAIN = 5;
  const LEVEL_UP_STAT_POOL = 5;
  const BANQUET_BONUS = 5;
  const levelUpAssigned =
    levelUpAlloc.fisico + levelUpAlloc.manipulacion + levelUpAlloc.influencia;
  const levelUpRemaining = Math.max(0, LEVEL_UP_STAT_POOL - levelUpAssigned);

  const formatHistoryTimestamp = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
  };

  const openLevelUpPanel = () => {
    if (!active) return;
    setBanquetCharId(null);
    if (showLevelUp) {
      setLevelUpCharId(null);
      return;
    }
    setLevelUpAlloc({ fisico: 0, manipulacion: 0, influencia: 0 });
    setLevelUpRestoreMana(true);
    setLevelUpFeedback('');
    setLevelUpCharId(active.id);
  };

  const openBanquetPanel = () => {
    if (!active) return;
    setLevelUpCharId(null);
    if (showBanquet) {
      setBanquetCharId(null);
      return;
    }
    setBanquetNote('');
    setBanquetRestoreCurrent(true);
    setLevelUpFeedback('');
    setBanquetCharId(active.id);
  };

  const adjustLevelUpStat = (key: StatKey, delta: number) => {
    setLevelUpAlloc((prev) => {
      const currentAssigned = prev.fisico + prev.manipulacion + prev.influencia;
      const remaining = Math.max(0, LEVEL_UP_STAT_POOL - currentAssigned);
      const nextVal =
        delta > 0
          ? prev[key] + Math.min(delta, remaining)
          : Math.max(0, prev[key] + delta);
      return { ...prev, [key]: nextVal };
    });
  };

  const handleConfirmLevelUp = () => {
    if (!active || levelUpRemaining !== 0) return;
    const prevCharLevel = getCharacterLevel(active);
    const nextCharLevel = prevCharLevel + 1;
    const basePoints = {
      fisico: getCharacterStatPoints(active, 'fisico', formula),
      manipulacion: getCharacterStatPoints(active, 'manipulacion', formula),
      influencia: getCharacterStatPoints(active, 'influencia', formula),
    };
    const prevFisicoLvl = calcStatLevelFromPoints(basePoints.fisico, formula);
    const nextPoints = {
      fisico: basePoints.fisico + levelUpAlloc.fisico,
      manipulacion: basePoints.manipulacion + levelUpAlloc.manipulacion,
      influencia: basePoints.influencia + levelUpAlloc.influencia,
    };
    const nextStats = {
      fisico: calcStatLevelFromPoints(nextPoints.fisico, formula),
      manipulacion: calcStatLevelFromPoints(nextPoints.manipulacion, formula),
      influencia: calcStatLevelFromPoints(nextPoints.influencia, formula),
    };

    const fisicoLevelsGained = Math.max(0, nextStats.fisico - prevFisicoLvl);
    const hpDiceRolls: number[] = [];
    for (let i = 0; i < fisicoLevelsGained; i++) {
      hpDiceRolls.push(rollSingleDie('d4'));
    }
    const hpGain = hpDiceRolls.reduce((acc, v) => acc + v, 0);
    const nextHpMax = active.hp.max + hpGain;
    const nextHpCurrent = active.hp.current + hpGain;

    const nextManaMax = active.mana.max + LEVEL_UP_MANA_GAIN;
    const nextManaCurrent = levelUpRestoreMana
      ? Math.min(nextManaMax, active.mana.current + LEVEL_UP_MANA_GAIN)
      : active.mana.current;

    const parts = STAT_KEYS.filter((k) => levelUpAlloc[k] > 0).map((k) => {
      const prevLvl = calcStatLevelFromPoints(basePoints[k], formula);
      const newLvl = nextStats[k];
      return newLvl > prevLvl
        ? `+${levelUpAlloc[k]} ${STAT_NAMES[k]} (Nv.${prevLvl}→Nv.${newLvl})`
        : `+${levelUpAlloc[k]} ${STAT_NAMES[k]}`;
    });

    const hpRollNote =
      hpGain > 0
        ? ` · Físico subió de nivel: ${fisicoLevelsGained}d4 [${hpDiceRolls.join(', ')}] = +${hpGain} PV máx. (${active.hp.max}→${nextHpMax})`
        : '';

    const summary = `Subida a Nivel ${nextCharLevel} · +${LEVEL_UP_MANA_GAIN} Maná máx. (${active.mana.max}→${nextManaMax}) · ${parts.join(', ')}${hpRollNote}`;

    const entry: ProgressionHistoryEntry = {
      id: generateId('prog_'),
      timestamp: formatHistoryTimestamp(),
      kind: 'level_up',
      characterLevelAfter: nextCharLevel,
      summary,
      manaMaxDelta: LEVEL_UP_MANA_GAIN,
      hpMaxDelta: hpGain > 0 ? hpGain : undefined,
      hpDiceRolls: hpDiceRolls.length > 0 ? hpDiceRolls : undefined,
      statDeltas: {
        ...(levelUpAlloc.fisico > 0 ? { fisico: levelUpAlloc.fisico } : {}),
        ...(levelUpAlloc.manipulacion > 0 ? { manipulacion: levelUpAlloc.manipulacion } : {}),
        ...(levelUpAlloc.influencia > 0 ? { influencia: levelUpAlloc.influencia } : {}),
      },
      fisicoLevelChange:
        fisicoLevelsGained > 0 ? { from: prevFisicoLvl, to: nextStats.fisico } : undefined,
    };

    onUpdateCharacter({
      ...active,
      characterLevel: nextCharLevel,
      hp: { current: nextHpCurrent, max: nextHpMax },
      mana: { current: nextManaCurrent, max: nextManaMax },
      statPoints: nextPoints,
      stats: nextStats,
      progressionHistory: [entry, ...(active.progressionHistory || [])],
    });

    setLevelUpFeedback(`¡${active.name} subió a Nivel ${nextCharLevel}! ${summary}`);
    setLevelUpCharId(null);
    setLevelUpAlloc({ fisico: 0, manipulacion: 0, influencia: 0 });
  };

  const handleConfirmBanquet = () => {
    if (!active) return;
    const charLevel = getCharacterLevel(active);
    const nextHpMax = active.hp.max + BANQUET_BONUS;
    const nextHpCurrent = banquetRestoreCurrent
      ? Math.min(nextHpMax, active.hp.current + BANQUET_BONUS)
      : active.hp.current;
    const nextManaMax = active.mana.max + BANQUET_BONUS;
    const nextManaCurrent = banquetRestoreCurrent
      ? Math.min(nextManaMax, active.mana.current + BANQUET_BONUS)
      : active.mana.current;
    const trimmedNote = banquetNote.trim();

    const summary = `Banquete · +${BANQUET_BONUS} PV máx. (${active.hp.max}→${nextHpMax}) y +${BANQUET_BONUS} Maná máx. (${active.mana.max}→${nextManaMax})${trimmedNote ? ` · ${trimmedNote}` : ''}`;

    const entry: ProgressionHistoryEntry = {
      id: generateId('prog_'),
      timestamp: formatHistoryTimestamp(),
      kind: 'banquet',
      characterLevelAfter: charLevel,
      summary,
      hpMaxDelta: BANQUET_BONUS,
      manaMaxDelta: BANQUET_BONUS,
      note: trimmedNote || undefined,
    };

    onUpdateCharacter({
      ...active,
      hp: { current: nextHpCurrent, max: nextHpMax },
      mana: { current: nextManaCurrent, max: nextManaMax },
      progressionHistory: [entry, ...(active.progressionHistory || [])],
    });

    setLevelUpFeedback(`¡Banquete registrado para ${active.name}! ${summary}`);
    setBanquetCharId(null);
    setBanquetNote('');
  };

  const handleSelectNewNature = (natureId: string) => {
    setNewNatureId(natureId);
    const preset = MAGE_NATURES.find((n) => n.id === natureId);
    if (preset) {
      setNewPhysicalVariant(preset.defaultPhysicalVariant);
    }
  };

  const handleSelectAdaptNature = (natureId: string) => {
    setAdaptNatureId(natureId);
    const preset = MAGE_NATURES.find((n) => n.id === natureId);
    if (preset) {
      setAdaptPhysicalVariant(preset.defaultPhysicalVariant);
    }
  };

  const handleCreate = () => {
    const trimmed = newName.trim() || (newKind === 'mage' ? 'Mago' : 'PNJ');
    onCreateCharacter({
      name: trimmed,
      kind: newKind,
      natureId: newNatureId,
      customNature: newCustomNature,
      physicalVariant: newPhysicalVariant,
      customPhysicalName: newCustomPhysicalName,
    });
    setNewName('');
    setNewCustomNature('');
    setNewCustomPhysicalName('');
  };

  if (!active) return null;

  const hpPct = active.hp.max > 0 ? Math.max(0, Math.min(100, (active.hp.current / active.hp.max) * 100)) : 0;
  const manaPct =
    active.mana.max > 0 ? Math.max(0, Math.min(100, (active.mana.current / active.mana.max) * 100)) : 0;

  const knownSet = new Set(active.knownSpells);
  const knownSpellsList = spells.filter((s) => knownSet.has(s.id));
  const hasNatureCanalizado = characterHasNatureCanalizado(active, spells);
  const query = spellSearch.trim().toLowerCase();
  const filteredSpells = spells
    .filter((s) => {
      if (KNOWLEDGE_TREE_SPELL_IDS.has(s.id) || s.isAdaptableTemplate) {
        return false;
      }
      if (
        !showOtherPlayersSpells &&
        s.id === 'basic_ataque_canalizado' &&
        hasNatureCanalizado &&
        !knownSet.has(s.id)
      ) {
        return false;
      }
      return (
        showOtherPlayersSpells ||
        s.isBasic ||
        !s.ownerCharacterId ||
        s.ownerCharacterId === active.id ||
        knownSet.has(s.id)
      );
    })
    .filter((s) => (spellFilter === 'all' ? true : s.effectType === spellFilter))
    .filter((s) => {
      if (!query) return true;
      return (
        s.name.toLowerCase().includes(query) ||
        s.orders.some((o) => o.toLowerCase().includes(query)) ||
        (s.statuses || []).some((st) => st.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      const aKnown = knownSet.has(a.id) ? 0 : 1;
      const bKnown = knownSet.has(b.id) ? 0 : 1;
      if (aKnown !== bKnown) return aKnown - bKnown;
      return a.name.localeCompare(b.name);
    });

  const handleCopyCode = async () => {
    const ok = await onCopyCharacterCode(active.id);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    }
  };

  const handlePrintSheet = () => {
    window.print();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = onImportCharacter(String(reader.result || ''));
      setImportError(!res.ok);
      setImportMsg(res.message);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportPaste = () => {
    const res = onImportCharacter(pasteText);
    setImportError(!res.ok);
    setImportMsg(res.message);
    if (res.ok) {
      setPasteText('');
      setShowPasteImport(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hoja imprimible / Guardar como PDF para el personaje activo */}
      <div className="arc-print-sheet space-y-4">
        <div className="border-b-2 border-zinc-800 pb-3 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{active.name}</h1>
            <p className="text-xs text-zinc-600">
              {active.kind === 'mage' ? 'Mago / PJ' : 'PNJ / Enemigo'} · Nivel {activeLevel}
              {active.nature ? ` · Naturaleza: ${active.nature}` : ''} · Estado:{' '}
              {conditionLabel(active.condition)}
            </p>
          </div>
          <div className="text-right text-xs font-mono text-zinc-700">
            <div>
              PV: {active.hp.current} / {active.hp.max}
            </div>
            <div>
              Maná: {active.mana.current} / {active.mana.max}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {STAT_KEYS.map((k) => {
            const pts = getCharacterStatPoints(active, k, formula);
            const st = getStatLevelStatus(pts, formula);
            const dice = getCharacterStatDice(active, k, formula);
            return (
              <div key={k} className="arc-print-card rounded p-2">
                <div className="font-bold uppercase text-zinc-700">{STAT_NAMES[k]}</div>
                <div className="font-mono text-sm font-bold text-zinc-900">
                  Nv.{st.level} ({dice}d6) · {pts} pts
                </div>
              </div>
            );
          })}
        </div>

        {(active.notes || active.resistances) && (
          <div className="text-xs text-zinc-700 space-y-1">
            {active.notes && (
              <p>
                <strong>Notas:</strong> {active.notes}
              </p>
            )}
            {active.resistances && (
              <p>
                <strong>Resistencias:</strong> {active.resistances}
              </p>
            )}
          </div>
        )}

        {active.weapons && active.weapons.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase text-zinc-800 border-b border-zinc-300 pb-1">
              Armas y Escudos
            </h2>
            <ul className="text-xs text-zinc-800 space-y-0.5">
              {active.weapons.map((w) => (
                <li key={w.id}>
                  <strong>{w.name}</strong>
                  {w.destroyed ? ' (Destruida)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-zinc-800 border-b border-zinc-300 pb-1">
            Grimorio ({knownSpellsList.length})
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {knownSpellsList.map((sp) => {
              const mastery = getSpellMasteryStatus(active.spellMastery?.[sp.id] || 0, formula);
              const diceTxt = getEffectiveSpellDamageDice(sp, mastery)
                .map((d) => `${d.count}${d.type}`)
                .join(' + ');
              return (
                <div key={sp.id} className="arc-print-card rounded p-2 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-zinc-900">{sp.name}</span>
                    <span className="font-mono text-zinc-700">{sp.manaCost}m</span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-600">
                    {TYPE_LABELS[sp.effectType]}
                    {diceTxt ? ` · ${diceTxt}` : ''}
                    {spellSupportsMastery(sp) ? ` · Maestría Nv.${mastery.level}` : ''}
                  </div>
                  {sp.effectDescription && (
                    <p className="text-[11px] text-zinc-700 leading-snug">{sp.effectDescription}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ficha compacta en 2 columnas: Perfil activo (izq) + Armar grimorio (der) */}
      <section className="arc-no-print rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3.5 sm:p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--arc-border)] pb-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-[var(--arc-accent)] truncate">
              {active.name}
            </h2>
            <span
              className="font-mono-num text-xs font-bold text-[#a4d67e]"
              title="Nivel del personaje (no modificable manualmente; sube con Subir de nivel)"
            >
              Nivel {activeLevel}
            </span>
            <span className="text-xs text-[var(--arc-muted)]">
              {active.kind === 'mage' ? 'Mago / PJ' : 'PNJ / Enemigo'}
              {active.nature ? ` · ${active.nature}` : ''}
              {active.ignoreManaUnconsciousness ? ' · Lostbell' : ''}
              {active.immuneToBlind ? ' · Inmune a Cegar' : ''} ·{' '}
              <strong
                className={
                  active.condition === 'active' ? 'text-[#a4d67e]' : 'text-[#e88a70]'
                }
              >
                {conditionLabel(active.condition)}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={active.kind}
              onChange={(e) =>
                onUpdateCharacter({ ...active, kind: e.target.value as CharacterKind })
              }
              aria-label="Tipo de personaje"
              className="min-h-[34px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
            >
              <option value="mage">PJ / Mago</option>
              <option value="npc">PNJ / Enemigo</option>
            </select>

            <button
              type="button"
              onClick={openLevelUpPanel}
              title="Subir 1 nivel (+5 Maná máx., 5 pts de estadística y 1d4 PV máx. si sube Físico)"
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                showLevelUp
                  ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)] text-[var(--arc-magic-accent)] hover:brightness-110'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Subir de nivel
            </button>

            <button
              type="button"
              onClick={openBanquetPanel}
              title="Banquete: añade +5 PV totales y +5 Maná totales con registro inmutable"
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                showBanquet
                  ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'border-[#5a4a2a] bg-[#241c0f] text-[#f0c76e] hover:brightness-110'
              }`}
            >
              <Utensils className="h-3.5 w-3.5" />
              Banquete
            </button>

            <button
              type="button"
              onClick={handlePrintSheet}
              title="Abrir vista de impresión o guardar ficha y grimorio en PDF"
              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Ficha / PDF
            </button>

            <button
              type="button"
              onClick={() => onExportCharacter(active.id)}
              title="Descargar archivo .txt solo de este personaje y sus hechizos"
              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>

            <button
              type="button"
              onClick={handleCopyCode}
              title="Copiar código para enviar por WhatsApp o Discord"
              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0 transition-colors"
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-[#a4d67e]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedCode ? 'Copiado' : 'Código'}
            </button>

            {!combatCharacterIds.has(active.id) && (
              <button
                type="button"
                onClick={() => onAddToCombat(active.id)}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
              >
                <Swords className="h-3.5 w-3.5" />
                A combate
              </button>
            )}
          </div>
        </div>

        {levelUpFeedback && !showLevelUp && !showBanquet && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#4a7545] bg-[#172216] px-3 py-2 text-xs text-[#cdeba9]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-[#9ad489] shrink-0" />
              <span>{levelUpFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setLevelUpFeedback('')}
              className="text-xs text-[#9cb984] hover:text-white px-1.5"
            >
              Cerrar
            </button>
          </div>
        )}

        {showBanquet && (
          <div className="rounded-xl border border-[#5a4a2a] bg-[var(--arc-surface-alt)] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#f0c76e]">
                  <Utensils className="h-4 w-4 shrink-0" />
                  Banquete: {active.name}
                </span>
                <span className="font-mono-num text-[#f09a82]">
                  +{BANQUET_BONUS} PV máx. ({active.hp.max} → {active.hp.max + BANQUET_BONUS})
                </span>
                <span className="font-mono-num text-[#8fc0ff]">
                  +{BANQUET_BONUS} Maná máx. ({active.mana.max} →{' '}
                  {active.mana.max + BANQUET_BONUS})
                </span>
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--arc-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={banquetRestoreCurrent}
                  onChange={(e) => setBanquetRestoreCurrent(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                />
                <span>También sumar +5 a PV y Maná actuales</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={banquetNote}
                onChange={(e) => setBanquetNote(e.target.value)}
                placeholder="Motivo o sesión opcional (ej: Banquete en la capital)..."
                className="flex-1 min-w-[200px] min-h-[34px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)] focus:border-[var(--arc-accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setBanquetCharId(null)}
                className="min-h-[34px] rounded-md px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBanquet}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Confirmar Banquete (+5 PV / +5 Maná)
              </button>
            </div>
          </div>
        )}

        {showLevelUp && (
          <div className="rounded-xl border border-[var(--arc-magic-border)] bg-[var(--arc-surface-alt)] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-[var(--arc-accent)]">
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  Subir de nivel: {active.name}
                </span>
                <span className="font-mono-num font-bold text-[#a4d67e]">
                  Nivel {activeLevel} → Nivel {activeLevel + 1}
                </span>
                <span className="font-mono-num text-[var(--arc-magic-accent)]">
                  +{LEVEL_UP_MANA_GAIN} Maná máx. ({active.mana.max} →{' '}
                  {active.mana.max + LEVEL_UP_MANA_GAIN})
                </span>
                <span
                  className={`font-mono-num font-semibold ${
                    levelUpRemaining === 0 ? 'text-[#a4d67e]' : 'text-[#f0c05a]'
                  }`}
                >
                  Puntos por repartir: {levelUpRemaining}/{LEVEL_UP_STAT_POOL}
                </span>
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--arc-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={levelUpRestoreMana}
                  onChange={(e) => setLevelUpRestoreMana(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                />
                <span>También sumar +5 al maná actual</span>
              </label>
            </div>

            {(() => {
              const curFisPts = getCharacterStatPoints(active, 'fisico', formula);
              const curFisLvl = calcStatLevelFromPoints(curFisPts, formula);
              const nextFisLvl = calcStatLevelFromPoints(curFisPts + levelUpAlloc.fisico, formula);
              const fisGain = Math.max(0, nextFisLvl - curFisLvl);
              if (fisGain <= 0) return null;
              return (
                <div className="rounded-lg border border-[#4a7545] bg-[#172216] px-3 py-1.5 text-xs text-[#cdeba9]">
                  <strong>Físico sube +{fisGain} nivel{fisGain > 1 ? 'es' : ''}:</strong> al confirmar se tirará automáticamente{' '}
                  <strong className="font-mono-num text-[#f0c76e]">{fisGain}d4</strong> para sumar a PV totales (registrado en historial inmutable).
                </div>
              );
            })()}

            <div className="grid gap-2 sm:grid-cols-3">
              {STAT_KEYS.map((key) => {
                const basePts = getCharacterStatPoints(active, key, formula);
                const added = levelUpAlloc[key];
                const projPts = basePts + added;
                const baseStatus = getStatLevelStatus(basePts, formula);
                const projStatus = getStatLevelStatus(projPts, formula);
                const projDice = formula.base + projStatus.level * formula.multiplier;
                const leveledStat = projStatus.level > baseStatus.level;

                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-2.5 space-y-2 transition-colors ${
                      added > 0
                        ? 'border-[var(--arc-accent)]/70 bg-[var(--arc-raised)]/65'
                        : 'border-[var(--arc-border)]/70 bg-[var(--arc-input)]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="font-semibold text-[var(--arc-text)]">
                        {STAT_NAMES[key]}
                      </span>
                      <span
                        className={`font-mono-num font-bold ${
                          leveledStat ? 'text-[#a4d67e]' : 'text-[var(--arc-muted)]'
                        }`}
                      >
                        {leveledStat
                          ? `Nv.${baseStatus.level} → Nv.${projStatus.level} (${projDice}d6)`
                          : `Nv.${projStatus.level} · ${projDice}d6`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono-num text-xs text-[var(--arc-muted)]">
                        {basePts}
                        {added > 0 ? (
                          <strong className="text-[var(--arc-accent)]">
                            {' '}
                            → {projPts} (+{added})
                          </strong>
                        ) : (
                          ' pts'
                        )}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={added <= 0}
                          onClick={() => adjustLevelUpStat(key, -1)}
                          aria-label={`Quitar 1 punto a ${STAT_NAMES[key]}`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded border border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={levelUpRemaining <= 0}
                          onClick={() => adjustLevelUpStat(key, 1)}
                          aria-label={`Sumar 1 punto a ${STAT_NAMES[key]}`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded border border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={levelUpRemaining <= 0}
                          onClick={() => adjustLevelUpStat(key, levelUpRemaining)}
                          title={`Asignar todos los puntos restantes (+${levelUpRemaining}) a ${STAT_NAMES[key]}`}
                          className="font-mono-num h-7 rounded border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-[11px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] disabled:opacity-35 whitespace-nowrap shrink-0 transition-colors"
                        >
                          +{levelUpRemaining > 0 ? levelUpRemaining : 0}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                {levelUpAssigned > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLevelUpAlloc({ fisico: 0, manipulacion: 0, influencia: 0 })
                    }
                    className="min-h-[32px] rounded-md px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLevelUpCharId(null)}
                  className="min-h-[32px] rounded-md px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                >
                  Cancelar
                </button>
              </div>

              <button
                type="button"
                disabled={levelUpRemaining !== 0}
                onClick={handleConfirmLevelUp}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 whitespace-nowrap shrink-0 shadow-sm transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Confirmar subida (+{LEVEL_UP_MANA_GAIN} Maná y +{LEVEL_UP_STAT_POOL} pts)
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-12 items-start">
          <div className="xl:col-span-6 space-y-3 xl:border-r xl:border-[var(--arc-border)] xl:pr-4">
            {active.kind === 'mage' && (
              <div className="rounded-lg bg-[var(--arc-surface-alt)] px-3 py-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-[var(--arc-muted)]">
                    Naturaleza:{' '}
                    <strong className="text-[var(--arc-accent)]">
                      {active.nature || 'Sin definir'}
                    </strong>{' '}
                    · Físico base:{' '}
                    <strong className="text-[#a4d67e]">
                      {PHYSICAL_VARIANTS[active.physicalVariant || 'golpe_fisico'].spellName}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!showAdaptNature) {
                        const raw = (active.nature || '').trim().toLowerCase();
                        const matched = MAGE_NATURES.find(
                          (n) =>
                            n.label.toLowerCase() === raw ||
                            n.label.split('/')[0].trim().toLowerCase() === raw ||
                            (raw === 'maldición / drenaje' && n.id === 'drenaje') ||
                            (raw === 'agua / hielo' && n.id === 'agua') ||
                            (raw === 'aire / rayo' && n.id === 'aire')
                        );
                        if (matched) {
                          setAdaptNatureId(matched.id);
                        } else if (raw) {
                          setAdaptNatureId('personalizada');
                          setAdaptCustomNature(active.nature || '');
                        }
                        setAdaptPhysicalVariant(active.physicalVariant || 'golpe_fisico');
                      }
                      setShowAdaptNature((v) => !v);
                    }}
                    className="rounded px-2 py-1 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0 transition-colors"
                  >
                    {showAdaptNature ? 'Ocultar' : 'Cambiar'}
                  </button>
                </div>

                {showAdaptNature && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-[var(--arc-border)]">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#b0a084] mb-1">
                        Elemento / Naturaleza (1d4)
                      </label>
                      <select
                        value={adaptNatureId}
                        onChange={(e) => handleSelectAdaptNature(e.target.value)}
                        className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#120d09] px-2 text-xs text-[#efe6d5]"
                      >
                        {MAGE_NATURE_CATEGORIES.map((cat) => (
                          <optgroup key={cat.id} label={cat.label}>
                            {MAGE_NATURES.filter((n) => n.category === cat.id).map((nat) => (
                              <option key={nat.id} value={nat.id}>
                                {nat.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#b0a084] mb-1">
                        Ataque físico base
                      </label>
                      <select
                        value={adaptPhysicalVariant}
                        onChange={(e) =>
                          setAdaptPhysicalVariant(e.target.value as MagePhysicalVariant)
                        }
                        className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#120d09] px-2 text-xs text-[#efe6d5]"
                      >
                        {Object.entries(PHYSICAL_VARIANTS).map(([key, info]) => (
                          <option key={key} value={key}>
                            {info.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {adaptNatureId === 'personalizada' && (
                      <input
                        type="text"
                        value={adaptCustomNature}
                        onChange={(e) => setAdaptCustomNature(e.target.value)}
                        placeholder="Elemento (ej: Sangre, Gravedad)..."
                        className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                      />
                    )}

                    {adaptPhysicalVariant === 'personalizado' && (
                      <input
                        type="text"
                        value={adaptCustomPhysicalName}
                        onChange={(e) => setAdaptCustomPhysicalName(e.target.value)}
                        placeholder="Ataque físico (ej: Cornada)..."
                        className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                      />
                    )}

                    {(() => {
                      const sel = MAGE_NATURES.find((n) => n.id === adaptNatureId);
                      if (!sel || sel.affinityOrders.length === 0) return null;
                      return (
                        <div className="sm:col-span-2 text-[11px] text-[var(--arc-muted)] leading-snug">
                          Órdenes afines:{' '}
                          <span className="text-[var(--arc-ink)]">
                            {sel.affinityOrders.join(' · ')}
                          </span>
                        </div>
                      );
                    })()}

                    <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--arc-muted)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={adaptKeepPreviousCanalizado}
                        onChange={(e) => setAdaptKeepPreviousCanalizado(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                      />
                      <span>Conservar ataque canalizado anterior (mago multielemento)</span>
                    </label>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyNatureToCharacter(active.id, {
                            natureId: adaptNatureId,
                            customNature: adaptCustomNature,
                            physicalVariant: adaptPhysicalVariant,
                            customPhysicalName: adaptCustomPhysicalName,
                            keepPreviousCanalizado: adaptKeepPreviousCanalizado,
                          });
                          setAdaptKeepPreviousCanalizado(false);
                          setShowAdaptNature(false);
                        }}
                        className="min-h-[34px] rounded-md bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] transition-colors"
                      >
                        Aplicar a {active.name}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="active-char-name"
                  className="block text-[11px] font-semibold text-[#b0a084] mb-0.5"
                >
                  Nombre
                </label>
                <input
                  id="active-char-name"
                  type="text"
                  value={active.name}
                  onChange={(e) => onUpdateCharacter({ ...active, name: e.target.value })}
                  className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#16110c] px-2.5 text-xs text-[#efe6d5] focus:border-[#8fb56a] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="active-char-notes"
                  className="block text-[11px] font-semibold text-[#b0a084] mb-0.5"
                >
                  Notas / Arquetipo
                </label>
                <input
                  id="active-char-notes"
                  type="text"
                  value={active.notes}
                  onChange={(e) => onUpdateCharacter({ ...active, notes: e.target.value })}
                  placeholder="Licántropo, piromante..."
                  className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#16110c] px-2.5 text-xs text-[#efe6d5] focus:border-[#8fb56a] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="active-char-res"
                  className="block text-[11px] font-semibold text-[#b0a084] mb-0.5"
                >
                  Resistencias / Rasgos
                </label>
                <input
                  id="active-char-res"
                  type="text"
                  value={active.resistances || ''}
                  onChange={(e) => onUpdateCharacter({ ...active, resistances: e.target.value })}
                  placeholder="Tierra ÷2 (físico)..."
                  className="w-full min-h-[34px] rounded-md border border-[#433324] bg-[#16110c] px-2.5 text-xs text-[#efe6d5] focus:border-[#d4a843] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 border-t border-[var(--arc-border)] pt-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#efe6d5]">
                    <Heart className="h-3.5 w-3.5 text-[#d85a3a] shrink-0" />
                    PV
                  </span>
                  <div className="flex items-center gap-1 font-mono-num text-xs">
                    <span className="font-bold text-[#efe6d5]">{active.hp.current}</span>
                    <span className="text-[#8e7f6a]">/</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={active.hp.max}
                      onChange={(e) => {
                        const max = Math.max(1, parseInt(e.target.value, 10) || 1);
                        onUpdateCharacter({
                          ...active,
                          hp: { max, current: Math.min(active.hp.current, max) },
                        });
                      }}
                      aria-label="PV máximo"
                      className="w-12 rounded border border-[#433324] bg-[#16110c] px-1 py-0.5 text-right text-xs text-[#efe6d5]"
                    />
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--arc-input)]">
                  <div
                    className="h-full bg-[#d85a3a] transition-all duration-200"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {[-5, -1, 1, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onAdjustHp(active.id, d, false)}
                      className="font-mono-num min-h-[28px] flex-1 rounded bg-[var(--arc-surface-alt)] px-1.5 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] transition-colors"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onResetResources(active.id, 'hp')}
                    title="Restaurar PV"
                    aria-label="Restaurar PV"
                    className="min-h-[28px] w-7 inline-flex items-center justify-center rounded text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#efe6d5] truncate">
                    <Sparkles className="h-3.5 w-3.5 text-[#6694e0] shrink-0" />
                    {active.ignoreManaUnconsciousness
                      ? 'Maná (Lostbell)'
                      : active.mana.max === 0
                        ? 'Maná (0 base)'
                        : 'Maná'}
                  </span>
                  <div className="flex items-center gap-1 font-mono-num text-xs shrink-0">
                    <span className="font-bold text-[#efe6d5]">{active.mana.current}</span>
                    <span className="text-[#8e7f6a]">/</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={active.mana.max}
                      onChange={(e) => {
                        const max = Math.max(0, parseInt(e.target.value, 10) || 0);
                        onUpdateCharacter({
                          ...active,
                          mana: { max, current: Math.min(active.mana.current, max) },
                        });
                      }}
                      aria-label="Maná máximo"
                      className="w-12 rounded border border-[#433324] bg-[#16110c] px-1 py-0.5 text-right text-xs text-[#efe6d5]"
                    />
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--arc-input)]">
                  <div
                    className="h-full bg-[#5282d6] transition-all duration-200"
                    style={{ width: `${manaPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {[-5, -1, 1, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onAdjustMana(active.id, d)}
                      className="font-mono-num min-h-[28px] flex-1 rounded bg-[var(--arc-surface-alt)] px-1.5 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] transition-colors"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onResetResources(active.id, 'mana')}
                    title="Restaurar Maná"
                    aria-label="Restaurar Maná"
                    className="min-h-[28px] w-7 inline-flex items-center justify-center rounded text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#cbb893] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(active.ignoreManaUnconsciousness)}
                    onChange={(e) =>
                      onUpdateCharacter({
                        ...active,
                        ignoreManaUnconsciousness: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                  />
                  <span>Reino de Lostbell (0 maná ≠ inconsciente)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#cbb893] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(active.immuneToBlind)}
                    onChange={(e) =>
                      onUpdateCharacter({
                        ...active,
                        immuneToBlind: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                  />
                  <span>Ciego / ve por otros sentidos (inmune a Cegar)</span>
                </label>
              </div>
            </div>

            <div className="border-t border-[var(--arc-border)] pt-2.5 divide-y divide-[var(--arc-border)]/60">
              {STAT_KEYS.map((key) => {
                const points = getCharacterStatPoints(active, key, formula);
                const statStatus = getStatLevelStatus(points, formula);
                const milestones = getStatMilestones(formula);
                const dice = getCharacterStatDice(active, key, formula);

                const applyPoints = (nextPoints: number) => {
                  const safePts = Math.max(0, Math.floor(nextPoints || 0));
                  const deltaPts = safePts - points;
                  if (deltaPts === 0) return;
                  const prevLvl = statStatus.level;
                  const nextLvl = calcStatLevelFromPoints(safePts, formula);
                  const basePoints = {
                    fisico: getCharacterStatPoints(active, 'fisico', formula),
                    manipulacion: getCharacterStatPoints(active, 'manipulacion', formula),
                    influencia: getCharacterStatPoints(active, 'influencia', formula),
                  };

                  let nextHpMax = active.hp.max;
                  let nextHpCurrent = active.hp.current;
                  const hpDiceRolls: number[] = [];
                  if (key === 'fisico' && nextLvl > prevLvl) {
                    const gained = nextLvl - prevLvl;
                    for (let i = 0; i < gained; i++) {
                      hpDiceRolls.push(rollSingleDie('d4'));
                    }
                    const hpGain = hpDiceRolls.reduce((acc, v) => acc + v, 0);
                    nextHpMax += hpGain;
                    nextHpCurrent += hpGain;
                  }

                  const hpGainTotal = nextHpMax - active.hp.max;
                  const lvlText =
                    nextLvl !== prevLvl ? ` (Nv.${prevLvl}→Nv.${nextLvl})` : '';
                  const hpText =
                    hpGainTotal > 0
                      ? ` · Físico subió de nivel: ${hpDiceRolls.length}d4 [${hpDiceRolls.join(', ')}] = +${hpGainTotal} PV máx. (${active.hp.max}→${nextHpMax})`
                      : '';

                  const entry: ProgressionHistoryEntry = {
                    id: generateId('prog_'),
                    timestamp: formatHistoryTimestamp(),
                    kind: 'stat_change',
                    characterLevelAfter: activeLevel,
                    summary: `${STAT_NAMES[key]} ${deltaPts > 0 ? `+${deltaPts}` : deltaPts} (${points}→${safePts})${lvlText}${hpText}`,
                    statDeltas: { [key]: deltaPts },
                    hpMaxDelta: hpGainTotal > 0 ? hpGainTotal : undefined,
                    hpDiceRolls: hpDiceRolls.length > 0 ? hpDiceRolls : undefined,
                    fisicoLevelChange:
                      key === 'fisico' && nextLvl !== prevLvl
                        ? { from: prevLvl, to: nextLvl }
                        : undefined,
                  };

                  if (hpGainTotal > 0) {
                    setLevelUpFeedback(
                      `Físico de ${active.name} subió a Nv.${nextLvl}: tirada automática ${hpDiceRolls.length}d4 [${hpDiceRolls.join(', ')}] = +${hpGainTotal} PV totales.`
                    );
                  }

                  onUpdateCharacter({
                    ...active,
                    hp: { current: nextHpCurrent, max: nextHpMax },
                    statPoints: { ...basePoints, [key]: safePts },
                    stats: { ...active.stats, [key]: nextLvl },
                    progressionHistory: [entry, ...(active.progressionHistory || [])],
                  });
                };

                return (
                  <div
                    key={key}
                    className="py-2 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-[140px] flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#d4a843]">{STAT_NAMES[key]}</span>
                        <span className="font-mono-num font-bold text-[#8fb56a]">
                          Nv.{statStatus.level} · {dice}d6
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#120d09]">
                          <div
                            className="h-full bg-[#8fb56a] transition-all duration-200"
                            style={{ width: `${statStatus.progressPct}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-[11px] text-[#9c8b75] whitespace-nowrap">
                          {statStatus.nextThreshold !== null
                            ? `${points}/${statStatus.nextThreshold}`
                            : 'Máx'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => applyPoints(points - 1)}
                        aria-label={`Restar 1 a ${STAT_NAMES[key]}`}
                        className="font-mono-num min-h-[30px] w-7 rounded bg-[var(--arc-surface-alt)] text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                      >
                        −1
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={points}
                        onChange={(e) => applyPoints(parseInt(e.target.value, 10) || 0)}
                        aria-label={`Valor de ${STAT_NAMES[key]}`}
                        className="font-mono-num w-12 min-h-[30px] rounded border border-[#433324] bg-[#120d09] px-1 text-center text-xs font-bold text-[#efe6d5]"
                      />
                      <button
                        type="button"
                        onClick={() => applyPoints(points + 1)}
                        aria-label={`Sumar 1 a ${STAT_NAMES[key]}`}
                        className="font-mono-num min-h-[30px] w-7 rounded bg-[var(--arc-surface-alt)] text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPoints(points + 5)}
                        aria-label={`Sumar 5 a ${STAT_NAMES[key]}`}
                        className="font-mono-num min-h-[30px] w-8 rounded bg-[var(--arc-surface-alt)] text-xs font-semibold text-[#d4a843] hover:bg-[var(--arc-raised)] transition-colors"
                      >
                        +5
                      </button>
                      <select
                        value={statStatus.level}
                        onChange={(e) => {
                          const lvl = parseInt(e.target.value, 10) || 1;
                          applyPoints(milestones[lvl - 1] ?? 0);
                        }}
                        aria-label={`Hito de nivel de ${STAT_NAMES[key]}`}
                        className="min-h-[30px] rounded border border-[#433324] bg-[#120d09] px-1.5 text-[11px] text-[#cbb893]"
                      >
                        {[1, 2, 3, 4, 5, 6].map((lvl, idx) => (
                          <option key={lvl} value={lvl}>
                            Nv.{lvl} ({milestones[idx] ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--arc-border)] pt-2.5 space-y-2">
              <button
                type="button"
                onClick={() => setShowProgressionHistory((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-left text-xs font-semibold text-[#cbb893] hover:text-[#f0c76e] transition-colors"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ScrollText className="h-3.5 w-3.5 text-[#d4a843] shrink-0" />
                  <span>Historial de progresión</span>
                  <span className="font-mono-num text-[11px] text-[var(--arc-muted)]">
                    ({activeHistory.length})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--arc-muted)] whitespace-nowrap shrink-0">
                  <Lock className="h-3 w-3 shrink-0" />
                  <span>Solo lectura</span>
                  <span>{showProgressionHistory ? '▲' : '▼'}</span>
                </span>
              </button>

              {showProgressionHistory && (
                <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] p-2.5 space-y-1.5 max-h-52 overflow-y-auto">
                  {activeHistory.length === 0 ? (
                    <p className="text-[11px] text-[var(--arc-muted)] leading-relaxed">
                      Sin registros aún. Cada subida de nivel, banquete o cambio en estadísticas (incluyendo tiradas automáticas de 1d4 PV por subir Físico) queda sellado aquí sin opción de edición ni borrado.
                    </p>
                  ) : (
                    activeHistory.map((entry) => {
                      const badgeText =
                        entry.kind === 'level_up'
                          ? `NIVEL ${entry.characterLevelAfter}`
                          : entry.kind === 'banquet'
                            ? 'BANQUETE'
                            : 'ESTADÍSTICA';
                      const badgeColor =
                        entry.kind === 'level_up'
                          ? 'text-[#a4d67e]'
                          : entry.kind === 'banquet'
                            ? 'text-[#f0c76e]'
                            : 'text-[#8fc0ff]';
                      return (
                        <div
                          key={entry.id}
                          className="border-b border-[var(--arc-border)]/50 pb-1.5 last:border-b-0 last:pb-0 space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className={`font-bold uppercase tracking-wide ${badgeColor}`}>
                              {badgeText}
                            </span>
                            <span className="font-mono-num text-[var(--arc-muted)]">
                              {entry.timestamp} · Nv.{entry.characterLevelAfter}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--arc-text)] leading-snug">
                            {entry.summary}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-6 space-y-2.5 border-t border-[var(--arc-border)] pt-3 xl:border-t-0 xl:pt-0">
            {(() => {
              const goalIds = [...new Set(active.archiveGoalIds || [])];
              const goals = goalIds
                .map((goalId) => ({
                  id: goalId,
                  progress: getSpellGoalProgress(active, spells, goalId),
                }))
                .filter((goal) => goal.progress);
              const pendingGoals = goals.filter((goal) => !goal.progress?.achieved);
              const achievedGoals = goals.filter((goal) => goal.progress?.achieved);

              if (goalIds.length === 0) return null;

              return (
                <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--arc-accent)]">
                      <Target className="h-4 w-4" />
                      Objetivos de progresión
                    </h3>
                    <span className="font-mono-num text-xs text-[var(--arc-muted)]">
                      {pendingGoals.length} pendientes · {achievedGoals.length} conseguidos
                    </span>
                  </div>
                  <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {goals.map(({ id, progress }) => {
                      if (!progress) return null;
                      const target = progress.path[0];
                      const missing = [
                        ...target.prerequisites,
                        ...target.prerequisites.flatMap((node) => node.prerequisites),
                      ].filter((node) => node.status !== 'completed');
                      return (
                        <article
                          key={id}
                          className={`rounded-lg border px-2.5 py-2 ${
                            progress.achieved
                              ? 'border-[#7fa36b]/60 bg-[#7fa36b]/5'
                              : progress.status === 'blocked'
                                ? 'border-[#b7864e]/60'
                                : 'border-[var(--arc-border)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[var(--arc-text)]">
                                {target.name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[var(--arc-muted)]">
                                {progress.achieved
                                  ? 'Objetivo conseguido'
                                  : `${progress.completedRequirements}/${progress.totalRequirements} requisitos cumplidos`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCharacter({
                                  ...active,
                                  archiveGoalIds: (active.archiveGoalIds || []).filter(
                                    (goalId) => goalId !== id
                                  ),
                                })
                              }
                              aria-label={`Quitar objetivo ${target.name}`}
                              className="min-h-[24px] w-6 shrink-0 rounded text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[#e88a70]"
                            >
                              <X className="mx-auto h-3.5 w-3.5" />
                            </button>
                          </div>
                          {missing.length > 0 && (
                            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--arc-muted)]">
                              Falta: {missing.map((node) => node.name).join(' · ')}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#e2c275]">
                Armar grimorio ({active.knownSpells.length} aprendidos)
              </h3>

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onSetKnownSpells(
                      active.id,
                      STARTER_NPC_SPELL_IDS.filter((id) => spells.some((s) => s.id === id))
                    )
                  }
                  className="min-h-[30px] rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
                >
                  Físicos
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetKnownSpells(active.id, getMageStarterBasicIds(active, spells))
                  }
                  className="min-h-[30px] rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
                >
                  Básicos mago
                </button>
                <button
                  type="button"
                  onClick={() => onSetKnownSpells(active.id, [])}
                  className="min-h-[30px] rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[#e88a70] whitespace-nowrap shrink-0 transition-colors"
                >
                  Vaciar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e7f6a]" />
                <input
                  type="text"
                  value={spellSearch}
                  onChange={(e) => setSpellSearch(e.target.value)}
                  placeholder="Buscar hechizo, orden o estado..."
                  className="w-full min-h-[34px] rounded-lg border border-[#433324] bg-[#16110c] pl-8 pr-2.5 text-xs text-[#efe6d5] placeholder-[#6c5c4b] focus:border-[#8fb56a] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-0.5 p-0.5 rounded-lg bg-[var(--arc-input)]">
                {TYPE_FILTERS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSpellFilter(opt.value)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                      spellFilter === opt.value
                        ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)] font-semibold'
                        : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9c8b75] cursor-pointer">
              <input
                type="checkbox"
                checked={showOtherPlayersSpells}
                onChange={(e) => setShowOtherPlayersSpells(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#8fb56a]"
              />
              <span>Incluir hechizos privados de otros jugadores</span>
            </label>

            <div className="grid gap-1.5 sm:grid-cols-2 max-h-[340px] overflow-y-auto pr-1">
              {filteredSpells.map((sp) => {
                const learned = knownSet.has(sp.id);
                const isMagical = isSpellMagical(sp);
                const ownerChar = sp.ownerCharacterId
                  ? characters.find((c) => c.id === sp.ownerCharacterId)
                  : undefined;
                const mastery = getSpellMasteryStatus(active.spellMastery?.[sp.id] || 0, formula);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => onToggleKnownSpell(active.id, sp.id)}
                    className={`flex items-start justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      learned
                        ? isMagical
                          ? 'border-[var(--arc-magic-accent)] bg-[var(--arc-magic-bg)]'
                          : 'border-[var(--arc-phys-accent)] bg-[var(--arc-phys-bg)]'
                        : isMagical
                          ? 'border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)]/55 hover:border-[var(--arc-magic-accent)]'
                          : 'border-[var(--arc-phys-border)] bg-[var(--arc-phys-bg)]/55 hover:border-[var(--arc-phys-accent)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-semibold truncate ${
                          isMagical
                            ? 'text-[var(--arc-magic-accent)]'
                            : 'text-[var(--arc-phys-accent)]'
                        }`}
                      >
                        {sp.name}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] font-mono-num leading-snug ${
                          isMagical
                            ? 'text-[var(--arc-magic-text)]/80'
                            : 'text-[var(--arc-phys-text)]/80'
                        }`}
                      >
                        {sp.effectType === 'effect'
                          ? getEffectiveEffectSubType(sp) === 'buff'
                            ? 'Buff'
                            : getEffectiveEffectSubType(sp) === 'debuff'
                              ? 'Debuff'
                              : 'Efecto'
                          : TYPE_LABELS[sp.effectType]}{' '}
                        · {sp.manaCost}m
                        {parseDurationTurns(sp) ? ` · ${parseDurationTurns(sp)}t` : ''}
                        {sp.armorConfig?.isArmor
                          ? ` · Arm.+${sp.armorConfig.damageReduction ?? 0}`
                          : ''}
                        {(sp.armorConfig?.maxHits ?? sp.maxHits ?? 0) > 0
                          ? ` · ${sp.armorConfig?.maxHits ?? sp.maxHits}g`
                          : ''}
                        {spellSupportsMastery(sp) && mastery.successes > 0
                          ? ` · M${mastery.level}`
                          : ''}
                        {ownerChar ? ` · ${ownerChar.name}` : ''}
                      </div>
                    </div>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                        learned
                          ? isMagical
                            ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)]'
                            : 'bg-[var(--arc-phys-raised)] text-[var(--arc-phys-text)]'
                          : isMagical
                            ? 'bg-[var(--arc-input)] text-[var(--arc-magic-accent)]'
                            : 'bg-[var(--arc-input)] text-[var(--arc-phys-accent)]'
                      }`}
                    >
                      {learned ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Award className="h-3 w-3 opacity-60" />
                      )}
                      {learned ? 'Sí' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Roster de Magos y PNJs/Enemigos */}
      <section className="arc-no-print rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3.5 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--arc-border)] pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--arc-accent)]">
              Magos y PNJs / Enemigos ({characters.length})
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--arc-muted)]">
              Cada jugador tiene su propia lista de hechizos. Importá los magos de tus amigos sin mezclar ni pisar los demás.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar jugador (.txt / .json)
            </button>
            <button
              type="button"
              onClick={() => setShowPasteImport((v) => !v)}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0 transition-colors"
            >
              Pegar código de amigo
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".txt,.json,text/plain,application/json"
              onChange={handleImportFile}
              hidden
            />
          </div>
        </div>

        {showPasteImport && (
          <div className="rounded-lg bg-[var(--arc-surface-alt)] p-3.5 space-y-2.5">
            <label htmlFor="paste-friend-code" className="block text-xs font-semibold text-[var(--arc-accent)]">
              Pegá el código (ARCANE1:...) o JSON del jugador que te envió tu amigo:
            </label>
            <textarea
              id="paste-friend-code"
              rows={3}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="ARCANE1:..."
              className="w-full rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] p-2.5 text-xs font-mono-num text-[var(--arc-text)] placeholder-[#6c5c4b] focus:border-[var(--arc-accent)] focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleImportPaste}
                className="min-h-[38px] rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm transition-colors"
              >
                Importar a la mesa
              </button>
              <button
                type="button"
                onClick={() => setShowPasteImport(false)}
                className="min-h-[38px] rounded-lg px-3 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {importMsg && (
          <p className={`text-xs ${importError ? 'text-[#e88a70]' : 'text-[#a4d67e]'}`}>
            {importMsg}
          </p>
        )}

        <div className="rounded-lg bg-[var(--arc-surface-alt)] p-3.5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={newKind === 'mage' ? 'Nombre del nuevo Mago (por defecto "Mago")...' : 'Nombre del PNJ / Enemigo...'}
              className="w-full sm:w-auto sm:flex-1 min-h-[42px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-sm text-[var(--arc-text)] placeholder-[#6c5c4b] focus:border-[var(--arc-accent)] focus:outline-none"
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as CharacterKind)}
              aria-label="Rol del nuevo personaje"
              className="min-h-[42px] flex-1 sm:flex-none rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs text-[var(--arc-text)]"
            >
              <option value="mage">Mago (valor inicial 0 · Nv. 1)</option>
              <option value="npc">PNJ / Enemigo</option>
            </select>
            <button
              type="button"
              onClick={handleCreate}
              className="min-h-[42px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Crear {newKind === 'mage' ? 'Mago' : 'PNJ'}
            </button>
          </div>

          {newKind === 'mage' && (
            <div className="grid gap-2.5 sm:grid-cols-2 border-t border-[var(--arc-border)] pt-3">
              <div>
                <label className="block text-xs font-semibold text-[#b0a084] mb-1">
                  Elemento / Naturaleza para Impacto Canalizado (1d4 a distancia)
                </label>
                <select
                  value={newNatureId}
                  onChange={(e) => handleSelectNewNature(e.target.value)}
                  className="w-full min-h-[38px] rounded-lg border border-[#433324] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                >
                  {MAGE_NATURE_CATEGORIES.map((cat) => (
                    <optgroup key={cat.id} label={cat.label}>
                      {MAGE_NATURES.filter((n) => n.category === cat.id).map((nat) => (
                        <option key={nat.id} value={nat.id}>
                          {nat.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {(() => {
                  const sel = MAGE_NATURES.find((n) => n.id === newNatureId);
                  if (!sel || sel.affinityOrders.length === 0) return null;
                  return (
                    <p className="mt-1 text-[11px] text-[var(--arc-muted)] leading-snug">
                      Órdenes afines:{' '}
                      <span className="text-[var(--arc-ink)]">
                        {sel.affinityOrders.join(' · ')}
                      </span>
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#b0a084] mb-1">
                  Ataque físico base (reemplaza Golpe Físico si es bestial/físico)
                </label>
                <select
                  value={newPhysicalVariant}
                  onChange={(e) => setNewPhysicalVariant(e.target.value as MagePhysicalVariant)}
                  className="w-full min-h-[38px] rounded-lg border border-[#433324] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                >
                  {Object.entries(PHYSICAL_VARIANTS).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              {newNatureId === 'personalizada' && (
                <input
                  type="text"
                  value={newCustomNature}
                  onChange={(e) => setNewCustomNature(e.target.value)}
                  placeholder="Tu elemento/naturaleza (ej: Sangre, Veneno, Tiempo)..."
                  className="w-full min-h-[38px] rounded-lg border border-[#433324] bg-[#120d09] px-3 text-xs text-[#efe6d5]"
                />
              )}

              {newPhysicalVariant === 'personalizado' && (
                <input
                  type="text"
                  value={newCustomPhysicalName}
                  onChange={(e) => setNewCustomPhysicalName(e.target.value)}
                  placeholder="Nombre del ataque físico base (ej: Cornada, Coletazo)..."
                  className="w-full min-h-[38px] rounded-lg border border-[#433324] bg-[#120d09] px-3 text-xs text-[#efe6d5]"
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {characters.map((char) => {
            const isActive = char.id === active.id;
            const isPJ = char.kind === 'mage';
            const isDown =
              char.hp.current <= 0 ||
              (!char.ignoreManaUnconsciousness && char.mana.max > 0 && char.mana.current <= 0) ||
              char.condition !== 'active';
            return (
              <div
                key={char.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 ${
                  isPJ
                    ? 'border-[#4a7545] bg-[#172216]'
                    : 'border-[#824234] bg-[#251614]'
                } ${isActive ? 'ring-1 ring-[#d4a843]' : ''} ${
                  isDown ? 'grayscale opacity-75' : ''
                }`}
              >
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${
                        isPJ ? 'text-[#9ad489]' : 'text-[#f09a82]'
                      }`}
                    >
                      {isPJ ? 'PJ' : 'PNJ'}
                    </span>
                    <span className="text-sm font-semibold text-[#efe6d5]">{char.name}</span>
                    <span className="font-mono-num text-xs font-semibold text-[#a4d67e]">
                      · Nv.{getCharacterLevel(char)}
                    </span>
                    {char.nature && (
                      <span className="text-xs text-[#d4a843]">· {char.nature}</span>
                    )}
                    {char.ignoreManaUnconsciousness && (
                      <span className="text-xs font-semibold text-[#8fc0ff]">· Lostbell</span>
                    )}
                  </div>
                  <div className="text-[13px] text-[#a3947e] font-mono-num mt-0.5">
                    PV {char.hp.current}/{char.hp.max} · Maná {char.mana.current}/{char.mana.max} ·{' '}
                    {char.knownSpells.length} hechizos · {conditionLabel(char.condition)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSelectCharacter(char.id)}
                      className="min-h-[34px] rounded-md px-3 text-xs font-semibold text-[#efe6d5] hover:bg-[#ffffff14] transition-colors"
                    >
                      Controlar
                    </button>
                  )}
                  {!combatCharacterIds.has(char.id) && (
                    <button
                      type="button"
                      onClick={() => onAddToCombat(char.id)}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-md px-2.5 text-xs font-medium text-[#d4a843] hover:bg-[#ffffff14] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Combate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDuplicateCharacter(char.id)}
                    title="Duplicar personaje"
                    aria-label={`Duplicar ${char.name}`}
                    className="min-h-[34px] w-8 inline-flex items-center justify-center rounded-md text-[#b0a084] hover:bg-[#ffffff14] hover:text-[#efe6d5] transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCharacter(char.id)}
                    title="Eliminar personaje"
                    aria-label={`Eliminar ${char.name}`}
                    className="min-h-[34px] w-8 inline-flex items-center justify-center rounded-md text-[#b0a084] hover:bg-[#ffffff14] hover:text-[#e88a70] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}