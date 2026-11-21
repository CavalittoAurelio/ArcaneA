import { useState } from 'react';
import {
  Dices,
  Eye,
  Flame,
  HeartPulse,
  Link2,
  Lock,
  Search,
  Shield,
  ShieldPlus,
  SkipForward,
  Sparkles,
  Star,
  Swords,
  Zap,
} from 'lucide-react';
import type { Character, Combatant, FormulaConfig, Spell } from '../types/rpg';
import {
  SPELL_CATEGORY_LABELS,
  type SpellCategory,
  evaluateSpellDependency,
  formatSpellAreaSummary,
  formatSpellDependencyLine,
  getCharacterStatDice,
  getCombatantStatusEffects,
  getCombatantTurnActionStatus,
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
  spellAllowsDirectCastButton,
  spellConsumesTurnAction,
  spellSupportsMastery,
} from '../utils/dice';
import { SpellCategoryIcon } from './SpellCategoryIcon';
import { SpellInspector, type SpellInspectorAction } from './SpellInspector';

interface QuickCastPanelProps {
  spells: Spell[];
  activeCharacter: Character | undefined;
  combatants: Combatant[];
  characters: Character[];
  selectedTargetId: string;
  onSelectTarget: (combatantId: string) => void;
  /** Modo Combate IRL: tiradas sin objetivo ni defensa rival */
  irlMode?: boolean;
  formula: FormulaConfig;
  spellOrder: string[];
  manaMode: 'auto' | 'manual';
  isAttackLethal: boolean;
  onToggleLethal: (lethal: boolean) => void;
  onCastSpell: (spell: Spell) => void;
  onAttackSpell: (spell: Spell) => void;
  onDefendTestSpell: (spell: Spell) => void;
  onHealSpell: (spell: Spell) => void;
  onApplyStatusSpell: (spell: Spell) => void;
  onTestSpell?: (spell: Spell) => void;
  autoPassSecondsLeft?: number | null;
  onAdvanceTurn?: () => void;
  onToggleFavoriteSpell: (spellId: string) => void;
}

type QuickOriginFilter = 'all' | 'custom' | 'base';
type QuickRoleFilter = 'all' | SpellCategory;

const ROLE_FILTER_OPTIONS: Array<{ value: QuickRoleFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'damage', label: 'Ataque' },
  { value: 'defense', label: 'Defensa' },
  { value: 'heal', label: 'Curación' },
  { value: 'buff', label: 'Buffs' },
  { value: 'debuff', label: 'Debuffs' },
  { value: 'effect', label: 'Efectos' },
];

const CAT_BADGE_CLASSES: Record<SpellCategory, string> = {
  damage: 'text-[var(--arc-cat-damage-accent)]',
  defense: 'text-[var(--arc-cat-defense-accent)]',
  heal: 'text-[var(--arc-cat-heal-accent)]',
  buff: 'text-[var(--arc-cat-buff-accent)]',
  debuff: 'text-[var(--arc-cat-debuff-accent)]',
  effect: 'text-[var(--arc-cat-effect-accent)]',
};

const CAT_ACTIVE_FILTER_CLASSES: Record<SpellCategory, string> = {
  damage: 'bg-[var(--arc-cat-damage-bg)] text-[var(--arc-cat-damage-accent)] ring-1 ring-[var(--arc-cat-damage-border)]',
  defense: 'bg-[var(--arc-cat-defense-bg)] text-[var(--arc-cat-defense-accent)] ring-1 ring-[var(--arc-cat-defense-border)]',
  heal: 'bg-[var(--arc-cat-heal-bg)] text-[var(--arc-cat-heal-accent)] ring-1 ring-[var(--arc-cat-heal-border)]',
  buff: 'bg-[var(--arc-cat-buff-bg)] text-[var(--arc-cat-buff-accent)] ring-1 ring-[var(--arc-cat-buff-border)]',
  debuff: 'bg-[var(--arc-cat-debuff-bg)] text-[var(--arc-cat-debuff-accent)] ring-1 ring-[var(--arc-cat-debuff-border)]',
  effect: 'bg-[var(--arc-cat-effect-bg)] text-[var(--arc-cat-effect-accent)] ring-1 ring-[var(--arc-cat-effect-border)]',
};

function formatCompactDamage(
  spell: Spell,
  character: Character | undefined,
  formula: FormulaConfig
): string {
  if (spell.effectType === 'damage' || spell.effectType === 'heal') {
    const mastery = character
      ? getSpellMasteryStatus(character.spellMastery?.[spell.id] || 0, formula)
      : undefined;
    const effectiveDice =
      spell.effectType === 'damage' && mastery
        ? getEffectiveSpellDamageDice(spell, mastery)
        : spell.damage.dice;
    const diceStr = effectiveDice.map((d) => `${d.count}${d.type}`).join(' + ');
    const bonusStr = spell.damage.bonus ? ` + ${spell.damage.bonus}` : '';
    const full = `${diceStr}${bonusStr}`.trim();
    if (full) {
      return spell.damageMode === 'manual' ? `${full} (man.)` : full;
    }
    return spell.damageMode === 'manual' ? 'Manual' : '—';
  }
  if (spell.armorConfig?.isArmor) {
    const red = spell.armorConfig.damageReduction ?? 0;
    const div =
      spell.armorConfig.damageDivisor === 2
        ? ' · ÷2'
        : spell.armorConfig.damageDivisor === 4
          ? ' · ÷4'
          : spell.armorConfig.damageDivisor === 0
            ? ' · Anula'
            : '';
    const hits = spell.armorConfig.maxHits ?? spell.maxHits ?? 0;
    const hitsTxt = hits > 0 ? ` · ${hits}g` : '';
    return `Red. +${red}${div}${hitsTxt}`;
  }
  if ((spell.maxHits ?? 0) > 0) {
    return `${spell.maxHits} ${spell.maxHits === 1 ? 'golpe' : 'golpes'}`;
  }
  if (spell.id === 'basic_proteccion') {
    return '-3 mág / -5 fís';
  }
  if (spell.id === 'basic_reforzar_hechizo') {
    return 'Daño ×2 (mayor)';
  }
  if (spell.id === 'basic_hechizo_veloz') {
    return '2 acciones';
  }
  if (spell.id === 'basic_elevar_limite') {
    return '3 acciones';
  }
  if (spell.statuses && spell.statuses.length > 0) {
    return spell.statuses.join(' / ');
  }
  return '—';
}

function formatCompactRollDice(
  spell: Spell,
  character: Character | undefined,
  formula: FormulaConfig
): string {
  if (!character) return '—';
  const mastery = getSpellMasteryStatus(character.spellMastery?.[spell.id] || 0, formula);
  const assured =
    spell.assuredSuccess + (spellSupportsMastery(spell) ? mastery.bonusAssured : 0);
  if (spell.effectType === 'damage' || spell.effectType === 'defense') {
    const stats = spell.combatStats.length > 0 ? spell.combatStats : ['fisico' as const];
    const totalDice = stats.reduce(
      (acc, st) => acc + getCharacterStatDice(character, st, formula),
      0
    );
    return `${totalDice}d6${assured > 0 ? ` +${assured}` : ''}`;
  }
  if (spell.id === 'basic_interrumpir_circulo') {
    const totalDice =
      getCharacterStatDice(character, 'influencia', formula) +
      getCharacterStatDice(character, 'manipulacion', formula);
    return `${totalDice}d6${assured > 0 ? ` +${assured}` : ''}`;
  }
  if (
    (spell.statuses && spell.statuses.length > 0) ||
    (spell.effectType === 'effect' && getEffectiveEffectSubType(spell) === 'debuff')
  ) {
    const infDice = getCharacterStatDice(character, 'influencia', formula);
    return `${infDice}d6 Inf`;
  }
  if (spell.castStat !== 'none') {
    const dice =
      spell.castStat === 'manual'
        ? spell.manualCastDice
        : getCharacterStatDice(character, spell.castStat, formula);
    return `${dice}d6${assured > 0 ? ` +${assured}` : ''}`;
  }
  return 'Auto';
}

export function QuickCastPanel({
  spells,
  activeCharacter,
  combatants,
  characters,
  selectedTargetId,
  onSelectTarget,
  irlMode = false,
  formula,
  spellOrder,
  manaMode,
  isAttackLethal,
  onToggleLethal,
  onCastSpell,
  onAttackSpell,
  onDefendTestSpell,
  onHealSpell,
  onApplyStatusSpell,
  onTestSpell,
  autoPassSecondsLeft = null,
  onAdvanceTurn,
  onToggleFavoriteSpell,
}: QuickCastPanelProps) {
  const [originFilter, setOriginFilter] = useState<QuickOriginFilter>('all');
  const [roleFilter, setRoleFilter] = useState<QuickRoleFilter>('all');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [personalTagFilter, setPersonalTagFilter] = useState('');
  const [inspectedSpell, setInspectedSpell] = useState<{
    spell: Spell;
    actions: SpellInspectorAction[];
    dependencyStatus?: { met: boolean; reason?: string };
  } | null>(null);

  const knownIds = new Set(activeCharacter?.knownSpells || []);
  const activeCombatant = combatants.find((cb) => cb.characterId === activeCharacter?.id);
  const activeStatusEffects = getCombatantStatusEffects(activeCombatant, activeCharacter);
  const turnStatus = getCombatantTurnActionStatus(activeCombatant);
  const outOfTurnActions = Boolean(activeCombatant && turnStatus.remaining <= 0);
  const preparedSpellMap = new Map(
    (activeCombatant?.preparedSpells || []).map((p) => [p.spellId, p])
  );
  const preparedSpellIds = new Set(preparedSpellMap.keys());
  const potentialTargets = combatants.filter((cb) => cb.characterId !== activeCharacter?.id);

  const orderIndexMap = new Map(spellOrder.map((id, idx) => [id, idx]));

  const knownSpells = spells
    .filter((s) => knownIds.has(s.id))
    .sort((a, b) => {
      const idxA = orderIndexMap.get(a.id);
      const idxB = orderIndexMap.get(b.id);
      if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
      if (idxA !== undefined) return -1;
      if (idxB !== undefined) return 1;
      if (!a.isBasic && b.isBasic) return -1;
      if (a.isBasic && !b.isBasic) return 1;
      return a.name.localeCompare(b.name);
    });

  const getEffectiveMana = (spell: Spell): { cost: number; isPrepared: boolean; shieldDiscount: number } => {
    const isPrepared = spell.effectType === 'damage' && preparedSpellIds.has(spell.id);
    if (isPrepared) return { cost: 0, isPrepared: true, shieldDiscount: 0 };
    const defMana = getEffectiveDefenseManaCost(
      activeCharacter,
      spell,
      activeStatusEffects.disarmed
    );
    return { cost: defMana.cost, isPrepared: false, shieldDiscount: defMana.discount };
  };

  const currentMana = activeCharacter?.mana.current ?? 0;

  const customCount = knownSpells.filter((s) => !s.isBasic).length;
  const baseCount = knownSpells.length - customCount;

  const affordableCount = knownSpells.filter((s) => {
    const { cost } = getEffectiveMana(s);
    return cost <= currentMana;
  }).length;

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSpells = knownSpells.filter((s) => {
    if (originFilter === 'base' && !s.isBasic) return false;
    if (originFilter === 'custom' && s.isBasic) return false;

    if (roleFilter !== 'all') {
      if (getSpellCategory(s) !== roleFilter) return false;
    }
    if (favoritesOnly && !(activeCharacter?.favoriteSpellIds || []).includes(s.id)) return false;
    if (
      personalTagFilter &&
      !(activeCharacter?.personalSpellTags?.[s.id] || []).includes(personalTagFilter)
    ) return false;

    if (onlyAffordable) {
      const { cost } = getEffectiveMana(s);
      if (cost > currentMana) return false;
    }

    if (normalizedQuery && !s.name.toLowerCase().includes(normalizedQuery)) {
      return false;
    }

    return true;
  });

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-3.5">
      {/* Encabezado limpio con datos clave del personaje */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--arc-border)] pb-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)] flex items-center gap-2">
            <Zap className="h-5 w-5 shrink-0" />
            Casteo rápido — {activeCharacter?.name || 'Personaje'}
          </h2>
          <p className="text-[13px] text-[var(--arc-muted)] mt-0.5 font-mono-num">
            {activeCharacter ? (
              <>
                Maná {activeCharacter.mana.current}/{activeCharacter.mana.max}
                {activeCombatant && (
                  <>
                    {' · '}Acciones {turnStatus.remaining}/{turnStatus.max}
                  </>
                )}
                {' · '}
                {affordableCount}/{knownSpells.length} lanzables ahora
              </>
            ) : (
              'Seleccioná un personaje en la barra superior.'
            )}
          </p>
        </div>

        {/* Selector rápido de objetivo y Letal / No letal */}
        {activeCharacter && (
          <div className="flex flex-wrap items-center gap-2">
            {irlMode && (
              <span className="inline-flex items-center rounded-lg bg-[var(--arc-input)] px-2.5 py-1.5 text-xs font-semibold text-[var(--arc-accent)]">
                Modo IRL · sin objetivo
              </span>
            )}

            {!irlMode && potentialTargets.length > 0 && (
              <select
                value={selectedTargetId}
                onChange={(e) => onSelectTarget(e.target.value)}
                aria-label="Objetivo de ataque rápido"
                className="min-h-[36px] max-w-[200px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
              >
                {potentialTargets.map((cb) => {
                  const targetChar = characters.find((c) => c.id === cb.characterId);
                  if (!targetChar) return null;
                  return (
                    <option key={cb.id} value={cb.id}>
                      Obj: {targetChar.name} (PV {targetChar.hp.current}/{targetChar.hp.max})
                    </option>
                  );
                })}
              </select>
            )}

            <div
              className="inline-flex rounded-lg bg-[var(--arc-input)] p-0.5"
              role="group"
              aria-label="Tipo de golpe en casteo rápido"
            >
              <button
                type="button"
                onClick={() => onToggleLethal(false)}
                className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  !isAttackLethal
                    ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                    : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                No letal
              </button>
              <button
                type="button"
                onClick={() => onToggleLethal(true)}
                className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  isAttackLethal
                    ? 'bg-[#7a2e1f] text-[#ffe1d8]'
                    : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                Letal
              </button>
            </div>
          </div>
        )}
      </div>

      {activeCombatant && activeStatusEffects.summaryTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#723b26] bg-[#26140d] px-3 py-2 text-xs text-[#ffd2be]">
          <span className="font-bold text-[#ff9f7c]">Estados activos:</span>
          {activeStatusEffects.summaryTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-[#ffe0d1]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {outOfTurnActions && activeCharacter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#33220c] px-3 py-2 text-xs text-[#ffd28a]">
          <span>
            {autoPassSecondsLeft !== null ? (
              <>
                Acciones agotadas ({turnStatus.used}/{turnStatus.max}) · pasando turno en{' '}
                <strong className="font-mono-num text-white">{autoPassSecondsLeft}s</strong>
                {!turnStatus.hasHechizoVeloz
                  ? ' (podés activar Hechizo Veloz antes de que pase).'
                  : '.'}
              </>
            ) : (
              <>
                Sin acciones restantes este turno ({turnStatus.used}/{turnStatus.max}). Activá{' '}
                <strong>
                  {!turnStatus.hasHechizoVeloz
                    ? 'Hechizo Veloz'
                    : !turnStatus.hasElevarLimite
                      ? 'Elevar el Límite'
                      : 'otro turno'}
                </strong>{' '}
                o pasá el turno.
              </>
            )}
          </span>
          {onAdvanceTurn && (
            <button
              type="button"
              onClick={onAdvanceTurn}
              className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pasar turno
            </button>
          )}
        </div>
      )}

      {/* Filtros compactos */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Propios vs Base */}
            <div className="inline-flex p-0.5 rounded-lg bg-[var(--arc-input)]">
              {(
                [
                  { id: 'all', label: `Todo (${knownSpells.length})` },
                  { id: 'custom', label: `Propios (${customCount})` },
                  { id: 'base', label: `Base (${baseCount})` },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOriginFilter(opt.id)}
                  className={`min-h-[30px] px-2.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    originFilter === opt.id
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOnlyAffordable((v) => !v)}
              className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                onlyAffordable
                  ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                  : 'bg-[var(--arc-input)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
              }`}
            >
              Solo con maná ({affordableCount})
            </button>
            <button
              type="button"
              onClick={() => setFavoritesOnly((value) => !value)}
              className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                favoritesOnly
                  ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                  : 'bg-[var(--arc-input)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
              Favoritos ({knownSpells.filter((spell) => activeCharacter?.favoriteSpellIds?.includes(spell.id)).length})
            </button>
            {(activeCharacter?.personalSpellTagNames || []).length > 0 && (
              <select
                aria-label="Filtrar por etiqueta personal"
                value={personalTagFilter}
                onChange={(event) => setPersonalTagFilter(event.target.value)}
                className="min-h-[32px] max-w-[170px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
              >
                <option value="">Todas las etiquetas</option>
                {activeCharacter?.personalSpellTagNames?.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
          </div>

          {/* Buscador rápido */}
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--arc-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar hechizo..."
              aria-label="Buscar hechizo en casteo rápido"
              className="w-full min-h-[32px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] pl-8 pr-2.5 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
            />
          </div>
        </div>

        {/* Filtro por categoría (6 categorías separadas por color e icono) */}
        <div className="flex flex-wrap items-center gap-1">
          {ROLE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRoleFilter(opt.value)}
              className={`min-h-[30px] inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                roleFilter === opt.value
                  ? opt.value === 'all'
                    ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                    : CAT_ACTIVE_FILTER_CLASSES[opt.value]
                  : 'text-[var(--arc-muted)] hover:bg-[var(--arc-surface-alt)] hover:text-[var(--arc-text)]'
              }`}
            >
              {opt.value !== 'all' && (
                <SpellCategoryIcon category={opt.value} className="h-3.5 w-3.5" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla / Lista compacta: solo Nombre, Tipo, Daño, Maná, Tirada y Acción */}
      {!activeCharacter ? (
        <p className="py-6 text-center text-sm text-[var(--arc-muted)]">
          Creá o seleccioná un personaje para usar el casteo rápido.
        </p>
      ) : filteredSpells.length === 0 ? (
        <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-4 py-6 text-center space-y-1.5">
          <p className="text-sm font-semibold text-[var(--arc-text)]">
            No hay hechizos que coincidan con este filtro.
          </p>
          <p className="text-xs text-[var(--arc-muted)]">
            {onlyAffordable
              ? `Maná actual de ${activeCharacter.name}: ${currentMana}/${activeCharacter.mana.max}. Desactivá "Solo con maná" para ver todos los conocidos.`
              : 'Agregá hechizos conocidos desde el Grimorio o limpiá la búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] overflow-hidden">
          {/* Encabezado de columnas en escritorio */}
          <div className="hidden sm:grid sm:grid-cols-12 items-center gap-2 border-b border-[var(--arc-border)] bg-[var(--arc-surface)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--arc-muted)]">
            <div className="col-span-4">Hechizo · Tipo</div>
            <div className="col-span-3">Daño / Efecto</div>
            <div className="col-span-2 text-right">Maná · Dados</div>
            <div className="col-span-3 text-right">Acción</div>
          </div>

          <ul className="divide-y divide-[var(--arc-border)]">
            {filteredSpells.map((spell) => {
              const isMagical = isSpellMagical(spell);
              const dmgKind = getEffectiveSpellDamageKind(spell);
              const isSonic = isSonicSpell(spell);
              const isFire = isFireDamageSpell(spell);
              const effectSub =
                spell.effectType === 'effect' ? getEffectiveEffectSubType(spell) : null;
              const { cost: effectiveMana, isPrepared, shieldDiscount } = getEffectiveMana(spell);
              const preparedEntry = preparedSpellMap.get(spell.id);
              const lacksMana = manaMode === 'auto' && effectiveMana > currentMana;
              const canCast = spellAllowsDirectCastButton(spell);
              const castReq = getSpellCastRequirement(spell);
              const requiresPrepareFirst =
                spell.effectType === 'damage' && castReq === 'prepare' && !isPrepared;
              const consumesAction = spellConsumesTurnAction(spell);
              const blockedByTurn = outOfTurnActions && consumesAction;

              const damageText = formatCompactDamage(spell, activeCharacter, formula);
              const rollDiceText = formatCompactRollDice(spell, activeCharacter, formula);

              const spellCat = getSpellCategory(spell);
              const roleLabel = SPELL_CATEGORY_LABELS[spellCat];

              const isElevarBlocked =
                spell.id === 'basic_elevar_limite' && !turnStatus.hasHechizoVeloz;
              const isElevarActive =
                spell.id === 'basic_elevar_limite' && turnStatus.hasElevarLimite;
              const isVelozActive =
                spell.id === 'basic_hechizo_veloz' && turnStatus.hasHechizoVeloz;
              const isTurnBuffLocked = isElevarBlocked || isElevarActive || isVelozActive;

              const depCheck = evaluateSpellDependency({
                spell,
                casterCharacterId: activeCharacter?.id,
                combatants,
                characters,
                targetCombatantId: selectedTargetId,
              });
              const blockedByDependency = depCheck.hasDependency && !depCheck.met;

              let statusBlockReason: string | null = null;
              if (activeCombatant) {
                if (activeStatusEffects.cannotAct) {
                  statusBlockReason = `Impedido (${activeStatusEffects.cannotActReasons.join(', ')})`;
                } else if (spell.effectType === 'damage' && activeStatusEffects.cannotAttack) {
                  statusBlockReason = `No podés atacar (${activeStatusEffects.cannotAttackReasons.join(', ')})`;
                } else if (spell.effectType === 'defense' && activeStatusEffects.cannotDefend) {
                  statusBlockReason = `No podés defender (${activeStatusEffects.cannotDefendReasons.join(', ')})`;
                } else if (isMagical && activeStatusEffects.cannotCastMagic) {
                  statusBlockReason = `Silenciado (${activeStatusEffects.cannotCastMagicReasons.join(', ')})`;
                } else if (
                  turnStatus.isSlowed &&
                  (spell.id === 'basic_hechizo_veloz' || spell.id === 'basic_elevar_limite')
                ) {
                  statusBlockReason = 'Ralentizado (máx. 1 acción)';
                }
              }
              const blockedByStatus = Boolean(statusBlockReason);
              const hardBlocked = blockedByDependency || blockedByStatus;
              const hardBlockReason =
                statusBlockReason || depCheck.missingReason || `Falta: ${depCheck.requiredName}`;

              const typeIsMagic = spell.effectType === 'damage' ? dmgKind === 'magico' : isMagical;
              const typeLabel = typeIsMagic
                ? isSonic
                  ? 'Mágico (Sónico)'
                  : 'Mágico'
                : 'Físico';
              const actionBlockedReason = hardBlocked
                ? hardBlockReason
                : lacksMana
                  ? `Maná insuficiente (${currentMana}/${activeCharacter?.mana.max ?? 0}).`
                  : isTurnBuffLocked
                    ? isElevarBlocked
                      ? 'Requiere Hechizo Veloz activo primero.'
                      : 'Ya está activo este turno.'
                    : blockedByTurn
                      ? 'Sin acciones restantes este turno.'
                      : undefined;
              const inspectActions: SpellInspectorAction[] = hardBlocked
                ? [
                    {
                      label: 'Bloqueado',
                      disabled: true,
                      reason: actionBlockedReason,
                      onClick: () => undefined,
                    },
                  ]
                : spell.effectType === 'damage'
                  ? requiresPrepareFirst
                    ? [
                        {
                          label: 'Castear y preparar',
                          disabled: lacksMana || blockedByTurn,
                          reason: actionBlockedReason,
                          onClick: () => onCastSpell(spell),
                        },
                      ]
                    : [
                        ...(canCast && !isPrepared
                          ? [
                              {
                                label: 'Castear',
                                disabled: lacksMana || blockedByTurn,
                                reason: actionBlockedReason,
                                onClick: () => onCastSpell(spell),
                              },
                            ]
                          : []),
                        {
                          label: 'Atacar',
                          disabled: lacksMana || blockedByTurn,
                          reason: actionBlockedReason,
                          onClick: () => onAttackSpell(spell),
                        },
                      ]
                  : spell.effectType === 'defense'
                    ? [
                        {
                          label: 'Defender',
                          onClick: () => onDefendTestSpell(spell),
                        },
                      ]
                    : spell.effectType === 'heal'
                      ? [
                          {
                            label: 'Curar',
                            disabled: lacksMana || blockedByTurn,
                            reason: actionBlockedReason,
                            onClick: () => onHealSpell(spell),
                          },
                        ]
                      : [
                          {
                            label:
                              spell.statuses.length > 0
                                ? 'Aplicar estado'
                                : effectSub === 'debuff'
                                  ? 'Aplicar efecto'
                                  : 'Activar',
                            disabled:
                              lacksMana ||
                              blockedByTurn ||
                              (!spell.statuses.length && isTurnBuffLocked),
                            reason: actionBlockedReason,
                            onClick: () =>
                              spell.statuses.length > 0 || effectSub === 'debuff'
                                ? onApplyStatusSpell(spell)
                                : onCastSpell(spell),
                          },
                        ];

              return (
                <li
                  key={spell.id}
                  className={`px-3.5 py-2.5 transition-colors hover:bg-[var(--arc-surface)]/70 ${
                    lacksMana || blockedByTurn || hardBlocked ? 'opacity-65' : ''
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
                    {/* Columna 1: Nombre + Categoría (emblema + color) + Tipo (Mágico/Físico) */}
                    <div className="sm:col-span-4 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={CAT_BADGE_CLASSES[spellCat]}>
                          <SpellCategoryIcon category={spellCat} className="h-4 w-4" />
                        </span>
                        <span
                          className={`text-sm font-bold truncate ${CAT_BADGE_CLASSES[spellCat]}`}
                        >
                          {spell.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setInspectedSpell({
                              spell,
                              actions: inspectActions,
                              dependencyStatus: depCheck.hasDependency
                                ? {
                                    met: depCheck.met,
                                    reason: depCheck.missingReason,
                                  }
                                : undefined,
                            })
                          }
                          aria-label={`Consultar ficha de ${spell.name}`}
                          title="Consultar ficha completa"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-accent)]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleFavoriteSpell(spell.id)}
                          aria-label={
                            activeCharacter?.favoriteSpellIds?.includes(spell.id)
                              ? `Quitar ${spell.name} de favoritos`
                              : `Marcar ${spell.name} como favorito`
                          }
                          aria-pressed={activeCharacter?.favoriteSpellIds?.includes(spell.id) || false}
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                            activeCharacter?.favoriteSpellIds?.includes(spell.id)
                              ? 'text-[var(--arc-accent)]'
                              : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                          }`}
                        >
                          <Star className={`h-3.5 w-3.5 ${
                            activeCharacter?.favoriteSpellIds?.includes(spell.id) ? 'fill-current' : ''
                          }`} />
                        </button>
                        {isFire && (
                          <Flame
                            className="h-3.5 w-3.5 shrink-0 text-[#ff935c]"
                            aria-label="Daño de fuego"
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--arc-muted)] mt-0.5">
                        <span className={`font-semibold ${CAT_BADGE_CLASSES[spellCat]}`}>
                          {roleLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            typeIsMagic
                              ? 'font-medium text-[var(--arc-magic-text)]'
                              : 'font-medium text-[var(--arc-phys-text)]'
                          }
                        >
                          {typeLabel}
                        </span>
                        {isPrepared && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[var(--arc-accent)] font-mono-num">
                              Preparado
                              {typeof preparedEntry?.remainingTurns === 'number'
                                ? ` (${preparedEntry.remainingTurns}/${
                                    preparedEntry.durationTurns || preparedEntry.remainingTurns
                                  }t)`
                                : ''}
                            </span>
                          </>
                        )}
                        {spell.areaConfig?.enabled && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#9fd2ff]">
                              {formatSpellAreaSummary(spell.areaConfig)}
                            </span>
                          </>
                        )}
                      </div>
                      {blockedByStatus && (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#ff9a76]">
                          <Lock className="h-3 w-3 shrink-0" />
                          <span>{statusBlockReason}</span>
                        </div>
                      )}
                      {!blockedByStatus && blockedByDependency && (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#f3b562]">
                          <Lock className="h-3 w-3 shrink-0" />
                          <span>{depCheck.missingReason || `Falta: ${depCheck.requiredName}`}</span>
                        </div>
                      )}
                      {depCheck.hasDependency && depCheck.met && (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs text-[#8ee0a4]">
                          <Link2 className="h-3 w-3 shrink-0" />
                          <span>
                            Condición cumplida · {formatSpellDependencyLine(spell.dependency)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Columna 2: Daño / Valor clave */}
                    <div className="sm:col-span-3 flex items-center justify-between sm:block">
                      <span className="text-xs text-[var(--arc-muted)] sm:hidden">Daño / Efecto</span>
                      <span
                        className={`font-mono-num text-sm font-bold ${
                          spell.effectType === 'damage'
                            ? 'text-[var(--arc-text)]'
                            : spell.effectType === 'heal'
                              ? 'text-[#8ee0a4]'
                              : 'text-[var(--arc-muted)] font-medium text-xs'
                        }`}
                      >
                        {damageText}
                      </span>
                    </div>

                    {/* Columna 3: Costo de maná y dados de tirada */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:block sm:text-right font-mono-num">
                      <span
                        className={`text-xs font-bold ${
                          lacksMana
                            ? 'text-[#f08b72]'
                            : isPrepared
                              ? 'text-[var(--arc-accent)]'
                              : 'text-[var(--arc-text)]'
                        }`}
                      >
                        {isPrepared
                          ? '0 maná'
                          : shieldDiscount > 0
                            ? `${effectiveMana}m (-${shieldDiscount})`
                            : `${effectiveMana} maná`}
                      </span>
                      <div className="text-xs text-[var(--arc-muted)]">{rollDiceText}</div>
                    </div>

                    {/* Columna 4: Botón directo de lanzamiento */}
                    <div className="sm:col-span-3 flex flex-wrap items-center justify-end gap-1.5">
                      {hardBlocked ? (
                        <button
                          type="button"
                          disabled
                          title={hardBlockReason}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-raised)] px-3 text-xs font-semibold text-[#f3b562] opacity-85 cursor-not-allowed whitespace-nowrap shrink-0"
                        >
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          Bloqueado
                        </button>
                      ) : (
                        <>
                          {spell.effectType === 'damage' && (
                            <>
                              {requiresPrepareFirst ? (
                                <button
                                  type="button"
                                  disabled={lacksMana || blockedByTurn}
                                  onClick={() => onCastSpell(spell)}
                                  title={
                                    blockedByTurn
                                      ? 'Sin acciones restantes este turno — activá Hechizo Veloz o pasá el turno'
                                      : 'Castear y preparar hechizo (gasta 1 acción)'
                                  }
                                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Castear
                                </button>
                              ) : (
                                <>
                                  {canCast && !isPrepared && (
                                    <button
                                      type="button"
                                      disabled={lacksMana || blockedByTurn}
                                      onClick={() => onCastSpell(spell)}
                                      title={
                                        blockedByTurn
                                          ? 'Sin acciones restantes este turno'
                                          : 'Declarar casteo (gasta 1 acción)'
                                      }
                                      className="min-h-[34px] inline-flex items-center gap-1 rounded-md bg-transparent px-2 text-xs font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Castear
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={lacksMana || blockedByTurn}
                                    onClick={() => onAttackSpell(spell)}
                                    title={
                                      blockedByTurn
                                        ? 'Sin acciones restantes este turno — activá Hechizo Veloz o pasá el turno'
                                        : undefined
                                    }
                                    className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                                  >
                                    <Swords className="h-3.5 w-3.5" />
                                    Atacar
                                  </button>
                                </>
                              )}
                            </>
                          )}

                          {spell.effectType === 'defense' && (
                            <button
                              type="button"
                              onClick={() => onDefendTestSpell(spell)}
                              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-def-raised)] border border-[var(--arc-def-border)] px-3 text-xs font-semibold text-[var(--arc-def-text)] hover:brightness-110 whitespace-nowrap shrink-0 transition-all"
                            >
                              <Shield className="h-3.5 w-3.5 text-[var(--arc-def-accent)]" />
                              Defender
                            </button>
                          )}

                          {spell.effectType === 'heal' && (
                            <button
                              type="button"
                              disabled={lacksMana || blockedByTurn}
                              onClick={() => onHealSpell(spell)}
                              title={blockedByTurn ? 'Sin acciones restantes este turno' : undefined}
                              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                            >
                              <HeartPulse className="h-3.5 w-3.5" />
                              Curar
                            </button>
                          )}

                          {spell.effectType === 'effect' &&
                            (!spell.statuses || spell.statuses.length === 0) && (
                              <button
                                type="button"
                                disabled={lacksMana || isTurnBuffLocked || blockedByTurn}
                                onClick={() =>
                                  effectSub === 'debuff'
                                    ? onApplyStatusSpell(spell)
                                    : onCastSpell(spell)
                                }
                                title={
                                  isElevarBlocked
                                    ? 'Requiere Hechizo Veloz activo primero'
                                    : isElevarActive || isVelozActive
                                      ? 'Ya activo este turno'
                                      : blockedByTurn
                                        ? 'Sin acciones restantes este turno'
                                        : undefined
                                }
                                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                                  lacksMana || isTurnBuffLocked || blockedByTurn
                                    ? 'bg-[var(--arc-raised)] text-[var(--arc-muted)] opacity-50 cursor-not-allowed'
                                    : effectSub === 'debuff'
                                      ? 'bg-[#b85a3a] text-white hover:bg-[#cc6644]'
                                      : 'bg-[var(--arc-action)] text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)]'
                                }`}
                              >
                                {isElevarBlocked ? (
                                  <Lock className="h-3.5 w-3.5" />
                                ) : spell.armorConfig?.isArmor ? (
                                  <ShieldPlus className="h-3.5 w-3.5" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                                {isElevarActive || isVelozActive
                                  ? 'Activo'
                                  : isElevarBlocked
                                    ? 'Bloqueado'
                                    : effectSub === 'debuff'
                                      ? 'Aplicar'
                                      : 'Activar'}
                              </button>
                            )}

                          {spell.statuses &&
                            spell.statuses.length > 0 &&
                            spell.effectType !== 'damage' && (
                              <button
                                type="button"
                                disabled={lacksMana || blockedByTurn}
                                onClick={() => onApplyStatusSpell(spell)}
                                title={blockedByTurn ? 'Sin acciones restantes este turno' : undefined}
                                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#b85a3a] px-3 text-xs font-semibold text-white hover:bg-[#cc6644] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                              >
                                <Dices className="h-3.5 w-3.5" />
                                Aplicar
                              </button>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {inspectedSpell && (
        <SpellInspector
          key={inspectedSpell.spell.id}
          spell={inspectedSpell.spell}
          spells={spells}
          activeCharacter={activeCharacter}
          formula={formula}
          contextLabel="Casteo rápido · acciones sujetas al estado y reglas actuales"
          dependencyStatus={inspectedSpell.dependencyStatus}
          actions={inspectedSpell.actions}
          onTestSpell={onTestSpell}
          onClose={() => setInspectedSpell(null)}
        />
      )}
    </section>
  );
}