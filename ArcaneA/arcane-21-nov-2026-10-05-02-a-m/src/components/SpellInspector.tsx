import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Clock3,
  Dices,
  Flame,
  Heart,
  Link2,
  Lock,
  MapPin,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import type { Character, FormulaConfig, Spell } from '../types/rpg';
import {
  AREA_MODE_LABELS,
  ELEMENTAL_STATUS_META,
  SPELL_CATEGORY_LABELS,
  STAT_NAMES,
  SYNERGY_LABELS,
  formatSpellDependencyLine,
  getCharacterStatDice,
  getEffectiveDefenseManaCost,
  getEffectiveSpellDamageDice,
  getEffectiveSpellDamageKind,
  getSpellCastRequirement,
  getSpellCategory,
  getSpellMasteryStatus,
  isSpellMagical,
  spellSupportsMastery,
} from '../utils/dice';
import { SpellCategoryIcon } from './SpellCategoryIcon';

export interface SpellInspectorAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
}

interface SpellInspectorProps {
  spell: Spell;
  spells: Spell[];
  activeCharacter?: Character;
  formula: FormulaConfig;
  presentation?: 'dialog' | 'embedded';
  onClose?: () => void;
  contextLabel?: string;
  compatibility?: { label: string; detail?: string; compatible: boolean };
  dependencyStatus?: { met: boolean; reason?: string };
  archivePrerequisiteStatus?: { name: string; learned: boolean };
  actions?: SpellInspectorAction[];
  onTestSpell?: (spell: Spell) => void;
}

function formatDice(
  spell: Spell,
  dice = spell.damage.dice,
  bonus = spell.damage.bonus
): string {
  const diceText = dice
    .filter((die) => die.count > 0)
    .map((die) => `${die.count}${die.type}`)
    .join(' + ');
  if (!diceText) return bonus ? `${bonus > 0 ? '+' : ''}${bonus}` : '';
  if (!bonus) return diceText;
  return `${diceText} ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}`;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
      <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-muted)] sm:w-36">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-[var(--arc-text)]">{children}</dd>
    </div>
  );
}

export function SpellInspector({
  spell,
  spells,
  activeCharacter,
  formula,
  presentation = 'dialog',
  onClose,
  contextLabel,
  compatibility,
  dependencyStatus,
  archivePrerequisiteStatus,
  actions = [],
  onTestSpell,
}: SpellInspectorProps) {
  const [currentSpell, setCurrentSpell] = useState(spell);
  const [history, setHistory] = useState<Spell[]>([]);
  const isEmbedded = presentation === 'embedded';
  const category = getSpellCategory(currentSpell);
  const magical =
    currentSpell.effectType === 'damage'
      ? getEffectiveSpellDamageKind(currentSpell) === 'magico'
      : isSpellMagical(currentSpell);
  const mastery = getSpellMasteryStatus(
    activeCharacter?.spellMastery?.[currentSpell.id] || 0,
    formula
  );
  const damageDice = getEffectiveSpellDamageDice(currentSpell, mastery);
  const effectiveMana = getEffectiveDefenseManaCost(activeCharacter, currentSpell);
  const castRequirement = getSpellCastRequirement(currentSpell);
  const castDice =
    currentSpell.castStat === 'none'
      ? 0
      : currentSpell.castStat === 'manual'
        ? currentSpell.manualCastDice
        : getCharacterStatDice(activeCharacter, currentSpell.castStat, formula);
  const combatDice = currentSpell.combatStats.reduce(
    (total, stat) => total + getCharacterStatDice(activeCharacter, stat, formula),
    0
  );
  const elementalMeta = currentSpell.elementalStatus
    ? ELEMENTAL_STATUS_META[currentSpell.elementalStatus.kind]
    : undefined;
  const learned = Boolean(
    activeCharacter &&
      (activeCharacter.knownSpells.includes(currentSpell.id) ||
        (currentSpell.catalogTemplateId &&
          activeCharacter.knownSpells.some((id) =>
            spells.some(
              (knownSpell) =>
                knownSpell.id === id &&
                knownSpell.catalogTemplateId === currentSpell.catalogTemplateId
            )
          )))
  );

  const relatedSpells = useMemo(() => {
    const related = new Map<string, { spell: Spell; reason: string }>();
    const add = (candidate: Spell | undefined, reason: string) => {
      if (!candidate || candidate.id === currentSpell.id || related.has(candidate.id)) return;
      related.set(candidate.id, { spell: candidate, reason });
    };
    const dependency = currentSpell.dependency?.enabled
      ? currentSpell.dependency
      : undefined;
    if (dependency) {
      add(
        spells.find(
          (candidate) =>
            candidate.id === dependency.requiredSpellId ||
            candidate.catalogTemplateId === dependency.requiredSpellId ||
            candidate.name === dependency.requiredName
        ),
        'Requisito de activación'
      );
    }
    for (const candidate of spells) {
      if (
        candidate.dependency?.enabled &&
        (candidate.dependency.requiredSpellId === currentSpell.id ||
          candidate.dependency.requiredSpellId === currentSpell.catalogTemplateId)
      ) {
        add(candidate,         'Habilita la activación de este hechizo');
      }
      if (
        currentSpell.catalogChainGroup &&
        candidate.catalogChainGroup === currentSpell.catalogChainGroup
      ) {
        add(candidate, 'Misma familia del Archivo');
      }
      if (
        currentSpell.synergyReaction &&
        currentSpell.synergyReaction !== 'none' &&
        candidate.synergyReaction === currentSpell.synergyReaction
      ) {
        add(candidate, 'Sinergia relacionada');
      }
    }
    return [...related.values()];
  }, [currentSpell, spells]);

  useEffect(() => {
    if (isEmbedded) {
      setCurrentSpell(spell);
      setHistory([]);
      return;
    }
  }, [isEmbedded, spell]);

  useEffect(() => {
    if (isEmbedded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isEmbedded, onClose]);

  const navigateToSpell = (nextSpell: Spell) => {
    setHistory((previous) => [...previous, currentSpell]);
    setCurrentSpell(nextSpell);
  };

  const effectSummary =
    currentSpell.effectType === 'damage'
      ? formatDice(currentSpell, damageDice)
      : currentSpell.effectType === 'heal'
        ? formatDice(currentSpell)
        : '';
  const effectLabel =
    currentSpell.effectType === 'damage'
      ? 'Daño'
      : currentSpell.effectType === 'heal'
        ? 'Curación'
        : currentSpell.armorConfig?.isArmor
          ? 'Protección'
          : currentSpell.effectType === 'defense'
            ? 'Defensa'
            : 'Efecto';
  const currentActions = currentSpell.id === spell.id ? actions : [];
  const currentTestCallback = currentSpell.id === spell.id ? onTestSpell : undefined;
  const currentDependencyStatus =
    currentSpell.id === spell.id ? dependencyStatus : undefined;
  const explicitElement =
    currentSpell.armorConfig?.element || elementalMeta?.name;

  return (
    <div
      className={
        isEmbedded
          ? 'min-w-0 overflow-hidden rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)]'
          : 'fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4'
      }
      onMouseDown={
        isEmbedded
          ? undefined
          : (event) => {
              if (event.target === event.currentTarget) onClose?.();
            }
      }
    >
      <section
        role={isEmbedded ? undefined : 'dialog'}
        aria-modal={isEmbedded ? undefined : true}
        aria-labelledby="spell-inspector-title"
        className={
          isEmbedded
            ? 'w-full overflow-hidden'
            : 'max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-t-2xl border border-[var(--arc-border)] bg-[var(--arc-surface)] shadow-2xl sm:rounded-2xl'
        }
      >
        <header className="flex items-start gap-3 border-b border-[var(--arc-border)] px-4 py-4 sm:px-6">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const previous = history[history.length - 1];
                setHistory((items) => items.slice(0, -1));
                setCurrentSpell(previous);
              }}
              aria-label="Volver al hechizo anterior"
              className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--arc-accent)]">
                <SpellCategoryIcon category={category} className="h-3.5 w-3.5" />
                {SPELL_CATEGORY_LABELS[category]}
              </span>
              <span className={magical ? 'text-[var(--arc-magic-accent)]' : 'text-[var(--arc-phys-accent)]'}>
                {magical ? 'Mágico' : 'Físico'}
              </span>
              {currentSpell.catalogChainGroup && (
                <span className="text-[var(--arc-muted)]">{currentSpell.catalogChainGroup}</span>
              )}
              {explicitElement && (
                <span className="rounded-full border border-[var(--arc-border)] px-2 py-0.5 text-[var(--arc-text)]">
                  {explicitElement}
                </span>
              )}
              {learned && (
                <span className="rounded-full bg-[#9ad489]/10 px-2 py-0.5 text-[#9ad489]">
                  Aprendido
                </span>
              )}
            </div>
            <h2
              id="spell-inspector-title"
              className={`mt-1 font-display text-xl font-bold sm:text-2xl ${
                magical ? 'text-[var(--arc-magic-accent)]' : 'text-[var(--arc-phys-accent)]'
              }`}
            >
              {currentSpell.name}
            </h2>
            {contextLabel && (
              <p className="mt-0.5 text-xs text-[var(--arc-muted)]">{contextLabel}</p>
            )}
          </div>
          {!isEmbedded && (
            <button
              type="button"
              onClick={() => onClose?.()}
              aria-label="Cerrar ficha del hechizo"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <div
          className={
            isEmbedded
              ? 'space-y-5 px-4 py-4 sm:px-5 sm:py-5'
              : 'max-h-[calc(94vh-150px)] space-y-5 overflow-y-auto px-4 py-4 sm:max-h-[calc(90vh-150px)] sm:px-6 sm:py-5'
          }
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3 py-2.5">
              <Zap className="h-4 w-4 text-[var(--arc-accent)]" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">Maná</p>
                <p className="font-mono-num text-sm font-bold text-[var(--arc-text)]">
                  {activeCharacter && effectiveMana.cost !== currentSpell.manaCost
                    ? `${effectiveMana.cost} (base ${currentSpell.manaCost})`
                    : currentSpell.manaCost}
                </p>
              </div>
            </div>
            {effectSummary && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3 py-2.5">
                {currentSpell.effectType === 'heal' ? (
                  <Heart className="h-4 w-4 text-[#8fd2a1]" />
                ) : (
                  <Dices className="h-4 w-4 text-[var(--arc-accent)]" />
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">{effectLabel}</p>
                  <p className="font-mono-num text-base font-bold text-[var(--arc-text)]">{effectSummary}</p>
                </div>
              </div>
            )}
            {currentSpell.duration && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3 py-2.5">
                <Clock3 className="h-4 w-4 text-[var(--arc-accent)]" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--arc-muted)]">Duración</p>
                  <p className="text-sm font-semibold text-[var(--arc-text)]">{currentSpell.duration}</p>
                </div>
              </div>
            )}
          </div>

          {currentSpell.effectDescription && (
            <section>
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                Descripción
              </h3>
              <p className="text-sm leading-relaxed text-[var(--arc-text)]">
                {currentSpell.effectDescription}
              </p>
            </section>
          )}

          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
              Mecánica
            </h3>
            <dl className="space-y-2.5">
              <InfoRow label="Tipo">{SPELL_CATEGORY_LABELS[category]} · {magical ? 'Mágico' : 'Físico'}</InfoRow>
              {currentSpell.castStat !== 'none' && (
                <InfoRow label="Dados de lanzamiento">
                  <span className="font-mono-num font-semibold">
                    {currentSpell.castStat === 'manual'
                      ? currentSpell.manualCastDice
                      : castDice}d6
                  </span>
                  {' · '}
                  {currentSpell.castStat === 'manual'
                    ? 'Manual'
                    : STAT_NAMES[currentSpell.castStat]}
                  {activeCharacter && currentSpell.castStat !== 'manual' && (
                    <span className="ml-1 text-xs text-[var(--arc-muted)]">
                      (personaje: {castDice}d6)
                    </span>
                  )}
                </InfoRow>
              )}
              {currentSpell.combatStats.length > 0 && (
                <InfoRow label="Tirada de combate">
                  <span className="font-mono-num font-semibold">{combatDice}d6</span>
                  {' · '}
                  {currentSpell.combatStats.map((stat) => STAT_NAMES[stat]).join(' + ')}
                </InfoRow>
              )}
              {castRequirement !== 'none' && (
                <InfoRow label="Lanzamiento">
                  {castRequirement === 'prepare'
                    ? 'Requiere casteo previo'
                    : `Condicional${currentSpell.castCondition ? `: ${currentSpell.castCondition}` : ''}`}
                </InfoRow>
              )}
              {(currentSpell.assuredSuccess > 0 || mastery.bonusAssured > 0) && (
                <InfoRow label="Éxitos asegurados">
                  +{currentSpell.assuredSuccess}
                  {mastery.bonusAssured > 0 && ` + ${mastery.bonusAssured} por maestría`}
                </InfoRow>
              )}
              {(currentSpell.effectType === 'damage' || currentSpell.effectType === 'heal') &&
                currentSpell.damage.notes && (
                  <InfoRow label="Nota de daño">{currentSpell.damage.notes}</InfoRow>
                )}
              {spellSupportsMastery(currentSpell) && activeCharacter && (
                <InfoRow label="Maestría">
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                    Nv. {mastery.level} · {mastery.successes}
                    {!mastery.isMaxLevel && `/${mastery.nextThreshold}`} éxitos
                  </span>
                  {mastery.dieUpgradeSteps > 0 && (
                    <span className="ml-1 text-xs text-[var(--arc-muted)]">
                      · mejora {mastery.dieUpgradeSteps} dado(s)
                    </span>
                  )}
                </InfoRow>
              )}
              {currentSpell.orders.length > 0 && (
                <InfoRow label="Órdenes">{currentSpell.orders.join(' · ')}</InfoRow>
              )}
            </dl>
          </section>

          {(currentSpell.statuses.length > 0 ||
            elementalMeta ||
            currentSpell.armorConfig?.isArmor ||
            (currentSpell.maxHits ?? 0) > 0 ||
            currentSpell.collateral?.enabled ||
            currentSpell.dispelConfig?.enabled) && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                Efectos y consecuencias
              </h3>
              <dl className="space-y-2.5">
                {currentSpell.statuses.length > 0 && (
                  <InfoRow label="Estados">
                    <div className="flex flex-wrap gap-1.5">
                      {currentSpell.statuses.map((status) => (
                        <span key={status} className="rounded-full border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-2 py-0.5 text-xs">
                          {status}
                          {currentSpell.statusParams?.[status]?.autoFails
                            ? ` · ${currentSpell.statusParams[status].autoFails} fallo(s)`
                            : ''}
                          {currentSpell.statusParams?.[status]?.untilHit ? ' · hasta recibir un golpe' : ''}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                )}
                {elementalMeta && currentSpell.elementalStatus && (
                  <InfoRow label="Efecto elemental">
                    <span className="inline-flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                      {elementalMeta.name} · {currentSpell.elementalStatus.stacks} carga(s) ·{' '}
                      {currentSpell.elementalStatus.durationTurns} turnos · {elementalMeta.triggerLabel}
                    </span>
                    <p className="mt-0.5 text-xs text-[var(--arc-muted)]">{elementalMeta.description}</p>
                  </InfoRow>
                )}
                {currentSpell.armorConfig?.isArmor && (
                  <InfoRow label="Armadura">
                    {currentSpell.armorConfig.element || 'Arcano'} · reducción{' '}
                    {currentSpell.armorConfig.damageReduction ?? 0}
                    {currentSpell.armorConfig.damageDivisor === 0
                      ? ' · anula el daño'
                      : currentSpell.armorConfig.damageDivisor && currentSpell.armorConfig.damageDivisor > 1
                        ? ` · daño ÷${currentSpell.armorConfig.damageDivisor}`
                        : ''}
                    {(currentSpell.armorConfig.maxHits ?? currentSpell.maxHits ?? 0) > 0 &&
                      ` · ${currentSpell.armorConfig.maxHits ?? currentSpell.maxHits} golpes`}
                  </InfoRow>
                )}
                {!currentSpell.armorConfig?.isArmor && (currentSpell.maxHits ?? 0) > 0 && (
                  <InfoRow label="Resistencia">{currentSpell.maxHits} golpes</InfoRow>
                )}
                {currentSpell.collateral?.enabled && currentSpell.collateral && (
                  <InfoRow label="Daño colateral">
                    {currentSpell.collateral.label || 'Efecto colateral'} ·{' '}
                    {currentSpell.collateral.mode === 'fixed'
                      ? currentSpell.collateral.fixedAmount ?? 0
                      : formatDice(
                          currentSpell,
                          currentSpell.collateral.dice || [],
                          currentSpell.collateral.bonus || 0
                        )}
                    {currentSpell.collateral.durationType === 'turns' &&
                      ` · ${currentSpell.collateral.durationTurns || 1} turnos`}
                  </InfoRow>
                )}
                {currentSpell.dispelConfig?.enabled && (
                  <InfoRow label="Disipación">
                    {currentSpell.dispelConfig.scope.replace(/_/g, ' ')}
                    {currentSpell.dispelConfig.maxEffects
                      ? ` · máximo ${currentSpell.dispelConfig.maxEffects}`
                      : ' · todos los coincidentes'}
                    {currentSpell.dispelConfig.requiresInfluenceCheck
                      ? ' · requiere tirada de Influencia'
                      : ' · directa'}
                  </InfoRow>
                )}
              </dl>
            </section>
          )}

          {(currentSpell.areaConfig?.enabled ||
            currentSpell.dependency?.enabled ||
            currentSpell.synergyReaction ||
            currentSpell.damageKind ||
            compatibility ||
            dependencyStatus) && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                Alcance e interacciones
              </h3>
              <dl className="space-y-2.5">
                {currentSpell.areaConfig?.enabled && (
                  <InfoRow label="Alcance">
                    <span className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 text-[var(--arc-accent)]" />
                      {AREA_MODE_LABELS[currentSpell.areaConfig.mode]}
                      {currentSpell.areaConfig.maxTargets
                        ? ` · máximo ${currentSpell.areaConfig.maxTargets}`
                        : ''}
                      {currentSpell.areaConfig.shapeNote
                        ? ` · ${currentSpell.areaConfig.shapeNote}`
                        : ''}
                      {currentSpell.areaConfig.requiredStatusName
                        ? ` · requiere ${currentSpell.areaConfig.requiredStatusName}`
                        : ''}
                    </span>
                  </InfoRow>
                )}
                {currentSpell.dependency?.enabled && (
                  <InfoRow label="Requisito de activación">
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                      {formatSpellDependencyLine(currentSpell.dependency)}
                    </span>
                    {currentDependencyStatus && (
                      <p className={`mt-1 text-xs ${currentDependencyStatus.met ? 'text-[#9ad489]' : 'text-[#e6c07b]'}`}>
                        {currentDependencyStatus.met
                          ? 'Condición cumplida; hechizo habilitado.'
                          : currentDependencyStatus.reason || 'Falta cumplir el requisito de activación.'}
                      </p>
                    )}
                  </InfoRow>
                )}
                {currentSpell.synergyReaction && currentSpell.synergyReaction !== 'none' && (
                  <InfoRow label="Sinergia">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                      {SYNERGY_LABELS[currentSpell.synergyReaction]}
                      {currentSpell.synergyConsumeStacks === 'all'
                        ? ' · consume todas las cargas'
                        : typeof currentSpell.synergyConsumeStacks === 'number'
                          ? ` · consume ${currentSpell.synergyConsumeStacks} carga(s)`
                          : ''}
                    </span>
                  </InfoRow>
                )}
                {currentSpell.damageKind && currentSpell.effectType === 'damage' && (
                  <InfoRow label="Naturaleza del daño">{currentSpell.damageKind === 'magico' ? 'Mágico' : 'Físico'}</InfoRow>
                )}
                {compatibility && (
                  <InfoRow label="Compatibilidad">
                    <span className={compatibility.compatible ? 'text-[#9ad489]' : 'text-[#e6c07b]'}>
                      {compatibility.label}
                    </span>
                    {compatibility.detail && (
                      <p className="mt-0.5 text-xs text-[var(--arc-muted)]">{compatibility.detail}</p>
                    )}
                  </InfoRow>
                )}
              </dl>
            </section>
          )}

          {activeCharacter && (
            <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3.5 py-3">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                Para {activeCharacter.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                  learned ? 'bg-[#9ad489]/10 text-[#9ad489]' : 'bg-[var(--arc-raised)] text-[var(--arc-muted)]'
                }`}>
                  <BookOpen className="h-3 w-3" />
                  {learned ? 'Aprendido' : 'No aprendido'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--arc-raised)] px-2 py-1 font-mono-num text-[var(--arc-text)]">
                  <Zap className="h-3 w-3 text-[var(--arc-accent)]" />
                  Costo efectivo: {effectiveMana.cost} maná
                </span>
                {spellSupportsMastery(currentSpell) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--arc-raised)] px-2 py-1 text-[var(--arc-text)]">
                    <Award className="h-3 w-3 text-[var(--arc-accent)]" />
                    Maestría Nv. {mastery.level}
                  </span>
                )}
                {currentSpell.dependency?.enabled && !currentDependencyStatus && (
                  <span className="inline-flex items-center gap-1 text-[var(--arc-muted)]">
                    <Lock className="h-3 w-3" />
                    Se verifica al ejecutar en combate
                  </span>
                )}
              </div>
            </section>
          )}

          {archivePrerequisiteStatus && currentSpell.id === spell.id && (
            <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3.5 py-3">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                Requisito de aprendizaje del Archivo
              </h3>
              <p className="text-xs leading-relaxed text-[var(--arc-text)]">
                {archivePrerequisiteStatus.learned
                  ? `Ya aprendiste «${archivePrerequisiteStatus.name}». Para activar este hechizo en combate, ese requisito aún debe estar activo sobre el lanzador.`
                  : `Primero necesitás aprender «${archivePrerequisiteStatus.name}» en el Archivo. Aprenderlo no lo activa automáticamente en combate.`}
              </p>
            </section>
          )}

          {relatedSpells.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                Hechizos relacionados
              </h3>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {relatedSpells.map(({ spell: related, reason }) => (
                  <button
                    key={related.id}
                    type="button"
                    onClick={() => navigateToSpell(related)}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3 py-2 text-left hover:border-[var(--arc-accent)]/50"
                  >
                    <Target className="h-3.5 w-3.5 shrink-0 text-[var(--arc-accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--arc-text)]">{related.name}</span>
                      <span className="block truncate text-[10px] text-[var(--arc-muted)]">{reason}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--arc-muted)]" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {(currentActions.length > 0 || currentTestCallback) && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--arc-border)] px-4 py-3 sm:px-6">
            {currentTestCallback && (
              <button
                type="button"
                onClick={() => currentTestCallback(currentSpell)}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
              >
                <Dices className="h-3.5 w-3.5" />
                Probar
              </button>
            )}
            {currentActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  if (action.disabled) return;
                  onClose?.();
                  action.onClick();
                }}
                disabled={action.disabled}
                title={action.reason}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Zap className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </footer>
        )}
      </section>
    </div>
  );
}