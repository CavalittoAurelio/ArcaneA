import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dices,
  Droplets,
  Flame,
  HeartPulse,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  ShieldOff,
  ShieldPlus,
  SkipForward,
  Snowflake,
  Sparkles,
  Swords,
  Timer,
  Trash2,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  ActiveStatus,
  BotDifficulty,
  Character,
  Combatant,
  DamageDie,
  DamageDivisor,
  DamageKind,
  DieType,
  FormulaConfig,
  ManaDiscountMode,
  ManualStatusPayload,
  PendingAttack,
  PendingCounterspell,
  PendingStatusCheck,
  PreparedSpell,
  Spell,
  StatKey,
  SynergyReactionType,
} from '../types/rpg';
import {
  DIE_TYPES,
  DISPEL_SCOPE_LABELS,
  ELEMENTAL_STATUS_META,
  MAX_ELEMENTAL_STACKS,
  SPELL_CATEGORY_LABELS,
  STAT_NAMES,
  type SpellCategory,
  calcDirectProtectionSummary,
  conditionLabel,
  evaluateSpellDependency,
  formatCollateralValue,
  formatStatusChipMechanics,
  getCharacterStatDice,
  getCombatantStatusEffects,
  getCombatantTurnActionStatus,
  getEffectiveDefenseManaCost,
  getEffectiveEffectSubType,
  getEffectiveSpellDamageDice,
  getEffectiveSpellDamageKind,
  getMaxAffordableProtectionStacks,
  getSpellCategory,
  getSpellMasteryStatus,
  getStatusElementalKind,
  getStatusStackTurns,
  isFireDamageSpell,
  isSpellMagical,
  normalizeCombatStatusKey,
} from '../utils/dice';
import { BOT_ENEMY_PRESETS } from '../utils/botAi';
import { CombatStatusesUI } from './CombatStatusesUI';
import { SpellCategoryIcon } from './SpellCategoryIcon';
import type { CombatMechanicContext } from './CombatMechanicReader';
import {
  getControlMechanicId,
  getElementalMechanicId,
  getSynergyMechanicId,
  type CombatMechanicId,
} from '../utils/combatMechanics';

interface CombatPanelProps {
  round: number;
  manaMode: ManaDiscountMode;
  combatants: Combatant[];
  characters: Character[];
  spells: Spell[];
  activeCharacterId: string;
  selectedTargetId?: string;
  currentTurnCombatantId?: string;
  autoPassTurn?: boolean;
  autoPassPaused?: boolean;
  autoPassSecondsLeft?: number | null;
  onToggleAutoPassTurn?: (next: boolean) => void;
  onPauseAutoPass?: () => void;
  onAdvanceTurn?: () => void;
  formula: FormulaConfig;
  pendingAttack: PendingAttack | null;
  pendingCounterspell?: PendingCounterspell | null;
  pendingStatusCheck: PendingStatusCheck | null;
  pendingHeal: {
    id: string;
    healerName: string;
    spellName: string;
    amount: number;
    isManual: boolean;
    formulaText: string;
  } | null;
  onChangeRound: (delta: number) => void;
  onResetCombat: () => void;
  onChangeManaMode: (mode: ManaDiscountMode) => void;
  onAddToCombat: (characterId: string, initiative: number) => void;
  onUpdateInitiative: (combatantId: string, initiative: number) => void;
  onRemoveFromCombat: (combatantId: string) => void;
  onSelectActor: (characterId: string) => void;
  onAttackWithPrepared: (combatantId: string, prepared: PreparedSpell) => void;
  onRemovePrepared: (combatantId: string, preparedId: string) => void;
  onAdjustHp: (characterId: string, delta: number, lethal?: boolean) => void;
  onAdjustMana: (characterId: string, delta: number) => void;
  onResolveDirectDamage: (
    targetCombatantId: string,
    manualTotal?: number,
    damageReduction?: number,
    damageDivisor?: DamageDivisor
  ) => void;
  onRollDefense: (
    targetCombatantId: string,
    defenseChoice: string,
    manualDiceCount?: number,
    damageReduction?: number,
    damageDivisor?: DamageDivisor
  ) => void;
  onVerifyTieDamage: (
    manualTotal?: number,
    damageReduction?: number,
    damageDivisor?: DamageDivisor
  ) => void;
  onConfirmPendingDamage?: (
    damageReduction: number,
    damageDivisor: DamageDivisor,
    protectionStacks: number
  ) => void;
  onUseAttackProtection?: (targetCombatantId: string) => { ok: boolean; reductionAdded: number };
  onReinforcePendingAttack?: () => void;
  onTriggerCounterspellFromAttack?: (interruptorCombatantId: string) => void;
  onResolveCounterspell?: (casterCombatantId: string | 'manual', manualDiceCount?: number) => void;
  onDismissPendingCounterspell?: () => void;
  onDismissPendingAttack: () => void;
  onToggleAreaTarget?: (combatantId: string) => void;
  onResolveAllAreaDirect?: () => void;
  onRollStatusResistance: (targetCombatantId: string) => void;
  onApplyStatusDirect: (targetCombatantId: string) => void;
  onDismissPendingStatus: () => void;
  onApplyManualStatus?: (payload: ManualStatusPayload) => void;
  onUpdateCombatantStatus?: (
    combatantId: string,
    statusId: string,
    updates: Partial<Pick<ActiveStatus, 'autoFails' | 'endsOnHit' | 'remainingTurns' | 'duration'>>
  ) => void;
  onRemoveCombatantStatus: (combatantId: string, statusId: string) => void;
  onRecoverDisarmedWeapon?: (combatantId: string) => void;
  onStandUpFromProne?: (combatantId: string, statusId: string) => void;
  onAdjustStatusTurns?: (combatantId: string, statusId: string, delta: number) => void;
  onAdjustStatusHits?: (combatantId: string, statusId: string, delta: number) => void;
  onAdjustStatusProtection?: (combatantId: string, statusId: string, delta: number) => void;
  onResetTurnActions?: (combatantId: string) => void;
  onQuickCastTurnBuff?: (spell: Spell, casterCharacterId?: string) => void;
  spellOrder?: string[];
  isAttackLethal?: boolean;
  onToggleLethal?: (lethal: boolean) => void;
  onChainAttackSpell?: (spell: Spell, casterCharacterId: string) => void;
  onChainDefendSpell?: (spell: Spell, casterCharacterId: string) => void;
  onChainCastSpell?: (spell: Spell, casterCharacterId: string) => void;
  onChainHealSpell?: (spell: Spell, casterCharacterId: string) => void;
  onChainApplyStatusSpell?: (spell: Spell, casterCharacterId: string) => void;
  onApplyDirectDamageWithProtection?: (params: {
    combatantId: string;
    amount: number;
    damageKind: DamageKind;
    lethal: boolean;
    label?: string;
    protectionStacks: number;
  }) => void;
  onTriggerBurnTurn?: (combatantId: string, statusId: string) => void;
  onTriggerElementalTurn?: (combatantId: string, statusId: string) => void;
  onTriggerSynergyReaction?: (targetCombatantId: string, reaction: SynergyReactionType) => void;
  onInspectMechanic?: (
    mechanicId: CombatMechanicId,
    context: CombatMechanicContext
  ) => void;
  onCancelCombatantBuffs?: (combatantId: string) => void;
  onTriggerCollateralTurn?: (combatantId: string, statusId: string) => void;
  onApplyCollateralDamage?: (params: {
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
  }) => void;
  onApplyHeal: (targetCharacterId: string, manualAmount?: number) => void;
  onDismissPendingHeal: () => void;
  hasBotModeActive?: boolean;
  botBattleOutcome?: 'victory' | 'defeat' | null;
  isBotActingNow?: boolean;
  onStartBotPractice?: (params: {
    playerCharId: string;
    presetCounts: Record<string, number>;
    existingEnemyCharIds: string[];
    difficulty: BotDifficulty;
    playerGoesFirst: boolean;
  }) => void;
  onRematchBotPractice?: () => void;
  onEndBotPractice?: () => void;
  onToggleCombatantBot?: (combatantId: string) => void;
}

export function CombatPanel({
  round,
  manaMode,
  combatants,
  characters,
  spells,
  activeCharacterId,
  selectedTargetId,
  currentTurnCombatantId,
  autoPassTurn = true,
  autoPassPaused = false,
  autoPassSecondsLeft = null,
  onToggleAutoPassTurn,
  onPauseAutoPass,
  onAdvanceTurn,
  formula,
  pendingAttack,
  pendingCounterspell,
  pendingStatusCheck,
  pendingHeal,
  onChangeRound,
  onResetCombat,
  onChangeManaMode,
  onAddToCombat,
  onUpdateInitiative,
  onRemoveFromCombat,
  onSelectActor,
  onAttackWithPrepared,
  onRemovePrepared,
  onAdjustHp,
  onAdjustMana,
  onResolveDirectDamage,
  onRollDefense,
  onVerifyTieDamage,
  onConfirmPendingDamage,
  onUseAttackProtection,
  onReinforcePendingAttack,
  onTriggerCounterspellFromAttack,
  onResolveCounterspell,
  onDismissPendingCounterspell,
  onDismissPendingAttack,
  onToggleAreaTarget,
  onResolveAllAreaDirect,
  onRollStatusResistance,
  onApplyStatusDirect,
  onDismissPendingStatus,
  onApplyManualStatus,
  onUpdateCombatantStatus,
  onRemoveCombatantStatus,
  onRecoverDisarmedWeapon,
  onStandUpFromProne,
  onAdjustStatusTurns,
  onAdjustStatusHits,
  onAdjustStatusProtection,
  onResetTurnActions,
  onQuickCastTurnBuff,
  spellOrder = [],
  isAttackLethal = false,
  onToggleLethal,
  onChainAttackSpell,
  onChainDefendSpell,
  onChainCastSpell,
  onChainHealSpell,
  onChainApplyStatusSpell,
  onApplyDirectDamageWithProtection,
  onTriggerBurnTurn,
  onTriggerElementalTurn,
  onTriggerSynergyReaction,
  onInspectMechanic,
  onCancelCombatantBuffs,
  onTriggerCollateralTurn,
  onApplyCollateralDamage,
  onApplyHeal,
  onDismissPendingHeal,
  hasBotModeActive = false,
  botBattleOutcome = null,
  isBotActingNow = false,
  onStartBotPractice,
  onRematchBotPractice,
  onEndBotPractice,
  onToggleCombatantBot,
}: CombatPanelProps) {
  const [selectedAddId, setSelectedAddId] = useState('');
  const [addInitiative, setAddInitiative] = useState(0);
  const [defendingTargetId, setDefendingTargetId] = useState<string | null>(null);
  const [defenseChoice, setDefenseChoice] = useState<string>('stat:fisico');
  const [manualDefDice, setManualDefDice] = useState(2);
  const [manualCounterDice, setManualCounterDice] = useState(2);
  const [damageReduction, setDamageReduction] = useState(0);
  const [damageDivisor, setDamageDivisor] = useState<DamageDivisor>(1);
  const [pendingProtStacks, setPendingProtStacks] = useState(0);
  const [chainListCollapsed, setChainListCollapsed] = useState(false);
  const [manualDmgInput, setManualDmgInput] = useState('');
  const [manualHealInput, setManualHealInput] = useState('');
  const [showStatusesPanel, setShowStatusesPanel] = useState(false);
  const [showCollateralPanel, setShowCollateralPanel] = useState(false);
  const [colTargetId, setColTargetId] = useState('');
  const [colLabel, setColLabel] = useState('');
  const [colMode, setColMode] = useState<'fixed' | 'dice'>('fixed');
  const [colFixed, setColFixed] = useState<number>(3);
  const [colDieType, setColDieType] = useState<DieType>('d4');
  const [colDieCount, setColDieCount] = useState<number>(1);
  const [colBonus, setColBonus] = useState<number>(0);
  const [colKind, setColKind] = useState<DamageKind>('magico');
  const [colDurationType, setColDurationType] = useState<'instant' | 'turns'>('instant');
  const [colTurns, setColTurns] = useState<number>(2);
  const [colApplyNow, setColApplyNow] = useState<boolean>(false);
  const [colLethal, setColLethal] = useState<boolean>(false);
  const [colProtectionStacks, setColProtectionStacks] = useState<number>(0);
  const [directDmgCombatantId, setDirectDmgCombatantId] = useState<string | null>(null);
  const [directDmgAmount, setDirectDmgAmount] = useState<number>(4);
  const [directDmgKind, setDirectDmgKind] = useState<DamageKind>('magico');
  const [directDmgLethal, setDirectDmgLethal] = useState<boolean>(false);
  const [directDmgLabel, setDirectDmgLabel] = useState<string>('');
  const [directDmgProtStacks, setDirectDmgProtStacks] = useState<number>(0);

  // Configuración de práctica contra la máquina (PvE)
  const [showBotSetup, setShowBotSetup] = useState(false);
  const [botPlayerCharId, setBotPlayerCharId] = useState('');
  const [botPresetCounts, setBotPresetCounts] = useState<Record<string, number>>({
    bot_bandido: 1,
  });
  const [botExistingEnemyIds, setBotExistingEnemyIds] = useState<string[]>([]);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [botPlayerGoesFirst, setBotPlayerGoesFirst] = useState(true);

  const inCombatCharIds = new Set(combatants.map((c) => c.characterId));
  const availableToAdd = characters.filter((c) => !inCombatCharIds.has(c.id));
  const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const nonBotCharacters = characters.filter((c) => !c.isBotPreset);
  const resolvedBotPlayerId = nonBotCharacters.some((c) => c.id === botPlayerCharId)
    ? botPlayerCharId
    : nonBotCharacters.find((c) => c.id === activeCharacterId)?.id ||
      nonBotCharacters[0]?.id ||
      '';
  const availableExistingEnemies = nonBotCharacters.filter((c) => c.id !== resolvedBotPlayerId);
  const selectedPresetTotal = Object.values(botPresetCounts).reduce(
    (sum, n) => sum + (n > 0 ? n : 0),
    0
  );
  const validExistingEnemyIds = botExistingEnemyIds.filter((id) => id !== resolvedBotPlayerId);
  const totalSelectedBotEnemies = selectedPresetTotal + validExistingEnemyIds.length;

  // Lista compacta de hechizos conocidos lanzables con el maná restante tras activar Hechizo Veloz / Elevar el Límite
  const renderChainCastList = (
    casterChar: Character,
    casterCb: Combatant,
    variant: 'turn-bar' | 'duel'
  ) => {
    const knownSet = new Set(casterChar.knownSpells || []);
    const preparedSet = new Set((casterCb.preparedSpells || []).map((p) => p.spellId));
    const orderSource =
      casterChar.spellOrder && casterChar.spellOrder.length > 0
        ? casterChar.spellOrder
        : spellOrder;
    const orderMap = new Map(orderSource.map((id, idx) => [id, idx]));

    const categoryOrder: SpellCategory[] = [
      'damage',
      'defense',
      'heal',
      'buff',
      'debuff',
      'effect',
    ];

    const categoryStyles: Record<
      SpellCategory,
      { bg: string; border: string; accent: string; text: string }
    > = {
      damage: {
        bg: 'bg-[var(--arc-cat-damage-bg)]',
        border: 'border-[var(--arc-cat-damage-border)]',
        accent: 'text-[var(--arc-cat-damage-accent)]',
        text: 'text-[var(--arc-cat-damage-text)]',
      },
      defense: {
        bg: 'bg-[var(--arc-cat-defense-bg)]',
        border: 'border-[var(--arc-cat-defense-border)]',
        accent: 'text-[var(--arc-cat-defense-accent)]',
        text: 'text-[var(--arc-cat-defense-text)]',
      },
      heal: {
        bg: 'bg-[var(--arc-cat-heal-bg)]',
        border: 'border-[var(--arc-cat-heal-border)]',
        accent: 'text-[var(--arc-cat-heal-accent)]',
        text: 'text-[var(--arc-cat-heal-text)]',
      },
      buff: {
        bg: 'bg-[var(--arc-cat-buff-bg)]',
        border: 'border-[var(--arc-cat-buff-border)]',
        accent: 'text-[var(--arc-cat-buff-accent)]',
        text: 'text-[var(--arc-cat-buff-text)]',
      },
      debuff: {
        bg: 'bg-[var(--arc-cat-debuff-bg)]',
        border: 'border-[var(--arc-cat-debuff-border)]',
        accent: 'text-[var(--arc-cat-debuff-accent)]',
        text: 'text-[var(--arc-cat-debuff-text)]',
      },
      effect: {
        bg: 'bg-[var(--arc-cat-effect-bg)]',
        border: 'border-[var(--arc-cat-effect-border)]',
        accent: 'text-[var(--arc-cat-effect-accent)]',
        text: 'text-[var(--arc-cat-effect-text)]',
      },
    };

    const candidateSpells = spells
      .filter((s) => {
        if (!knownSet.has(s.id)) return false;
        if (s.id === 'basic_hechizo_veloz' || s.id === 'basic_elevar_limite') {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const idxA = orderMap.get(a.id);
        const idxB = orderMap.get(b.id);
        if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
        if (idxA !== undefined) return -1;
        if (idxB !== undefined) return 1;
        return a.name.localeCompare(b.name);
      });

    const getCost = (s: Spell) => {
      if (s.effectType === 'damage' && preparedSet.has(s.id)) return 0;
      if (s.effectType === 'defense' || s.id === 'basic_proteccion') {
        return getEffectiveDefenseManaCost(casterChar, s).cost;
      }
      return s.manaCost;
    };

    const remainingMana = casterChar.mana.current;
    const affordableSpells = candidateSpells.filter((s) => getCost(s) <= remainingMana);
    const hiddenByManaCount = candidateSpells.length - affordableSpells.length;
    const turnStatus = getCombatantTurnActionStatus(casterCb);
    const hasRemainingAction = turnStatus.remaining > 0;

    const groupedByCategory = categoryOrder
      .map((cat) => ({
        category: cat,
        label: SPELL_CATEGORY_LABELS[cat],
        style: categoryStyles[cat],
        items: affordableSpells.filter((s) => getSpellCategory(s) === cat),
      }))
      .filter((group) => group.items.length > 0);

    const formatShortValue = (s: Spell): string => {
      if (s.effectType === 'damage' || s.effectType === 'heal') {
        const mastery = getSpellMasteryStatus(casterChar.spellMastery?.[s.id] || 0, formula);
        const diceList =
          s.effectType === 'damage' ? getEffectiveSpellDamageDice(s, mastery) : s.damage.dice;
        const diceTxt = diceList.map((d) => `${d.count}${d.type}`).join(' + ');
        const bonusTxt = s.damage.bonus ? ` + ${s.damage.bonus}` : '';
        const merged = `${diceTxt}${bonusTxt}`.trim();
        if (merged) {
          return s.effectType === 'heal' ? `Cur. ${merged}` : merged;
        }
        return s.damageMode === 'manual' ? 'Manual' : '—';
      }
      if (s.effectType === 'defense') {
        const stats = s.combatStats.length > 0 ? s.combatStats : (['fisico'] as StatKey[]);
        const dice = stats.reduce(
          (acc, st) => acc + getCharacterStatDice(casterChar, st, formula),
          0
        );
        return `${dice}d6 def.`;
      }
      if (s.id === 'basic_proteccion') return '-3 mág / -5 fís';
      if (s.statuses && s.statuses.length > 0) return s.statuses.join(' / ');
      if (s.armorConfig?.isArmor) return `Red. +${s.armorConfig.damageReduction ?? 0}`;
      if (s.id === 'basic_reforzar_hechizo') return 'Daño ×2';
      return 'Efecto';
    };

    const isDuel = variant === 'duel';

    return (
      <div
        className={`rounded-lg border ${
          isDuel
            ? 'border-[var(--arc-atk-border)]/70 bg-[var(--arc-input)]/75'
            : 'border-[var(--arc-border)] bg-[var(--arc-surface)]'
        } overflow-hidden`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] px-3 py-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-bold text-[var(--arc-accent)] inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                Hechizos lanzables ({casterChar.name})
              </span>
              <span className="font-mono-num text-[var(--arc-muted)]">
                Maná:{' '}
                <strong className="text-[var(--arc-text)]">
                  {remainingMana}/{casterChar.mana.max}
                </strong>
                {' · '}
                Acciones:{' '}
                <strong
                  className={
                    hasRemainingAction ? 'text-[var(--arc-accent)]' : 'text-[#ff9c7a]'
                  }
                >
                  {turnStatus.remaining}/{turnStatus.max}
                </strong>
                {' · '}
                {affordableSpells.length} disp.
                {hiddenByManaCount > 0 ? ` (${hiddenByManaCount} sin maná)` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleLethal && !chainListCollapsed && hasRemainingAction && (
              <div className="inline-flex rounded-md bg-[var(--arc-input)] p-0.5">
                <button
                  type="button"
                  onClick={() => onToggleLethal(false)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-colors ${
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
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    isAttackLethal
                      ? 'bg-[#7a2e1f] text-[#ffe1d8]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  Letal
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setChainListCollapsed((v) => !v)}
              className="min-h-[28px] inline-flex items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              {chainListCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Ver ({affordableSpells.length})
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ocultar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Aviso de límite agotado (bloqueo estricto de 1 acción por buff) */}
        {!hasRemainingAction && (
          <div className="flex items-center gap-2 border-b border-[var(--arc-border)] bg-[#33220c] px-3 py-2 text-xs text-[#ffd28a]">
            <Lock className="h-3.5 w-3.5 shrink-0 text-[#f0a83a]" />
            <span>
              {turnStatus.hasElevarLimite
                ? `Acciones agotadas (${turnStatus.used}/${turnStatus.max}). Elevar el Límite solo otorga 1 acción extra — avanzá el turno para volver a lanzar.`
                : `Acciones de Hechizo Veloz agotadas (${turnStatus.used}/${turnStatus.max}). Activá Elevar el Límite (-5 maná) si querés 1 acción más.`}
            </span>
          </div>
        )}

        {!chainListCollapsed &&
          (groupedByCategory.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[var(--arc-muted)]">
              No quedan hechizos conocidos lanzables con {remainingMana} maná restante.
            </p>
          ) : (
            <div className="max-h-[290px] overflow-y-auto divide-y divide-[var(--arc-border)]">
              {groupedByCategory.map((group) => (
                <div key={group.category} className={group.style.bg}>
                  {/* Encabezado de categoría con emblema y color */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--arc-border)]/50">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${group.style.accent}`}
                    >
                      <SpellCategoryIcon category={group.category} className="h-3.5 w-3.5" />
                      {group.label} ({group.items.length})
                    </span>
                  </div>

                  <ul className="divide-y divide-[var(--arc-border)]/40">
                    {group.items.map((spell) => {
                      const isPrepared =
                        spell.effectType === 'damage' && preparedSet.has(spell.id);
                      const effCost = getCost(spell);
                      const isMagical = isSpellMagical(spell);
                      const dmgKind = getEffectiveSpellDamageKind(spell);
                      const typeIsMagic =
                        spell.effectType === 'damage' ? dmgKind === 'magico' : isMagical;
                      const effectSub =
                        spell.effectType === 'effect' ? getEffectiveEffectSubType(spell) : null;
                      const valText = formatShortValue(spell);
                      const depCheck = evaluateSpellDependency({
                        spell,
                        casterCharacterId: casterChar.id,
                        combatants,
                        characters,
                        targetCombatantId: selectedTargetId,
                      });
                      const blockedByDep = depCheck.hasDependency && !depCheck.met;

                      return (
                        <li
                          key={spell.id}
                          className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs transition-opacity ${
                            !hasRemainingAction || blockedByDep ? 'opacity-65' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span
                                className={`inline-flex items-center gap-1.5 font-bold truncate ${group.style.accent}`}
                              >
                                <SpellCategoryIcon
                                  category={group.category}
                                  className="h-3.5 w-3.5"
                                />
                                {spell.name}
                              </span>
                              <span className={`font-medium opacity-85 ${group.style.text}`}>
                                {typeIsMagic ? 'Mágico' : 'Físico'}
                              </span>
                              <span aria-hidden="true" className="text-[var(--arc-muted)]">
                                ·
                              </span>
                              <span className={`font-mono-num font-bold ${group.style.text}`}>
                                {valText}
                              </span>
                              <span aria-hidden="true" className="text-[var(--arc-muted)]">
                                ·
                              </span>
                              <span className="font-mono-num text-[var(--arc-muted)]">
                                {isPrepared ? '0m (Prep.)' : `${effCost} maná`}
                              </span>
                            </div>
                            {blockedByDep && (
                              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#f3b562]">
                                <Lock className="h-3 w-3 shrink-0" />
                                <span>{depCheck.missingReason || `Falta: ${depCheck.requiredName}`}</span>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0">
                            {blockedByDep ? (
                              <button
                                type="button"
                                disabled
                                title={depCheck.missingReason || `Requiere: ${depCheck.requiredName}`}
                                className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-raised)] px-2.5 text-xs font-semibold text-[#f3b562] opacity-85 cursor-not-allowed whitespace-nowrap shrink-0"
                              >
                                <Lock className="h-3 w-3 shrink-0" />
                                Bloqueado
                              </button>
                            ) : (
                              <>
                                {spell.effectType === 'damage' && onChainAttackSpell && (
                                  <button
                                    type="button"
                                    disabled={!hasRemainingAction}
                                    onClick={() => onChainAttackSpell(spell, casterChar.id)}
                                    className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                                  >
                                    <Swords className="h-3 w-3" />
                                    Atacar
                                  </button>
                                )}

                                {spell.effectType === 'defense' && onChainDefendSpell && (
                                  <button
                                    type="button"
                                    disabled={!hasRemainingAction}
                                    onClick={() => onChainDefendSpell(spell, casterChar.id)}
                                    className="min-h-[30px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-cat-defense-border)] bg-[var(--arc-input)]/80 px-2.5 text-xs font-semibold text-[var(--arc-cat-defense-accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-all"
                                  >
                                    <Shield className="h-3 w-3" />
                                    Defender
                                  </button>
                                )}

                                {spell.effectType === 'heal' && onChainHealSpell && (
                                  <button
                                    type="button"
                                    disabled={!hasRemainingAction}
                                    onClick={() => onChainHealSpell(spell, casterChar.id)}
                                    className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                                  >
                                    <HeartPulse className="h-3 w-3" />
                                    Curar
                                  </button>
                                )}

                                {spell.effectType === 'effect' &&
                                  ((spell.statuses && spell.statuses.length > 0) ||
                                    effectSub === 'debuff') &&
                                  onChainApplyStatusSpell && (
                                    <button
                                      type="button"
                                      disabled={!hasRemainingAction}
                                      onClick={() => onChainApplyStatusSpell(spell, casterChar.id)}
                                      className="min-h-[30px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-cat-debuff-border)] bg-[var(--arc-input)]/80 px-2.5 text-xs font-semibold text-[var(--arc-cat-debuff-accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-all"
                                    >
                                      <Dices className="h-3 w-3" />
                                      Aplicar
                                    </button>
                                  )}

                                {spell.effectType === 'effect' &&
                                  (!spell.statuses || spell.statuses.length === 0) &&
                                  effectSub !== 'debuff' &&
                                  onChainCastSpell && (
                                    <button
                                      type="button"
                                      disabled={!hasRemainingAction}
                                      onClick={() => onChainCastSpell(spell, casterChar.id)}
                                      className={`min-h-[30px] inline-flex items-center gap-1 rounded-md border ${group.style.border} bg-[var(--arc-input)]/80 px-2.5 text-xs font-semibold ${group.style.accent} hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-all`}
                                    >
                                      <Sparkles className="h-3 w-3" />
                                      Activar
                                    </button>
                                  )}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
      </div>
    );
  };

  const getCombatantArmorModifiers = (cb: Combatant | undefined) => {
    if (!cb || !cb.activeStatuses) {
      return { reduction: 0, divisor: 1 as DamageDivisor, names: [] as string[] };
    }
    let reduction = 0;
    let divisor: DamageDivisor = 1;
    const names: string[] = [];
    for (const st of cb.activeStatuses) {
      const hasRed = (st.armorReduction || 0) > 0;
      const hasDiv = st.armorDivisor !== undefined && st.armorDivisor !== 1;
      if (hasRed || hasDiv) {
        reduction += st.armorReduction || 0;
        if (st.armorDivisor === 0) divisor = 0;
        else if (st.armorDivisor === 4 && divisor !== 0) divisor = 4;
        else if (st.armorDivisor === 2 && divisor === 1) divisor = 2;
        names.push(
          `${st.name}${hasRed ? ` (+${st.armorReduction} red.)` : ''}${
            typeof st.remainingHits === 'number'
              ? ` · ${st.remainingHits}/${st.maxHits || st.remainingHits}g`
              : ''
          }`
        );
      }
    }
    return { reduction, divisor, names };
  };

  // Sincronizar el objetivo seleccionado cuando nace un nuevo pendingAttack
  useEffect(() => {
    setPendingProtStacks(0);
    if (!pendingAttack) {
      setDefendingTargetId(null);
      setDamageReduction(0);
      setDamageDivisor(1);
      return;
    }

    const candidates = combatants.filter(
      (cb) => cb.characterId !== pendingAttack.attackerCharacterId
    );
    const chosenId =
      pendingAttack.targetCombatantId &&
      candidates.some((c) => c.id === pendingAttack.targetCombatantId)
        ? pendingAttack.targetCombatantId
        : candidates[0]?.id || null;

    setDefendingTargetId(chosenId);

    const targetCb = chosenId ? combatants.find((c) => c.id === chosenId) : undefined;
    const armorMods = getCombatantArmorModifiers(targetCb);
    setDamageReduction(armorMods.reduction);
    setDamageDivisor(armorMods.divisor);

    if (chosenId) {
      const targetChar = targetCb
        ? characters.find((c) => c.id === targetCb.characterId)
        : undefined;
      if (targetChar) {
        const defSpells = targetChar.knownSpells
          .map((id) => spells.find((s) => s.id === id))
          .filter((s): s is Spell => Boolean(s && s.effectType === 'defense'));
        if (defSpells.length > 0) {
          setDefenseChoice(`spell:${defSpells[0].id}`);
        } else {
          setDefenseChoice('stat:fisico');
        }
      }
    }
  }, [pendingAttack?.id]);

  // Reiniciar las cargas de Protección en vista previa cuando se decide un nuevo daño entrante
  useEffect(() => {
    setPendingProtStacks(0);
  }, [pendingAttack?.pendingDamage]);

  const handleSelectDefender = (targetId: string) => {
    setDefendingTargetId(targetId);
    const targetCb = combatants.find((c) => c.id === targetId);
    const armorMods = getCombatantArmorModifiers(targetCb);
    setDamageReduction(armorMods.reduction);
    setDamageDivisor(armorMods.divisor);
    const targetChar = targetCb
      ? characters.find((c) => c.id === targetCb.characterId)
      : undefined;
    if (targetChar) {
      const defSpells = targetChar.knownSpells
        .map((id) => spells.find((s) => s.id === id))
        .filter((s): s is Spell => Boolean(s && s.effectType === 'defense'));
      if (defSpells.length > 0) {
        setDefenseChoice(`spell:${defSpells[0].id}`);
      } else {
        setDefenseChoice('stat:fisico');
      }
    }
  };

  const handleAdd = () => {
    const idToAdd = selectedAddId || availableToAdd[0]?.id;
    if (!idToAdd) return;
    onAddToCombat(idToAdd, addInitiative);
    setSelectedAddId('');
    setAddInitiative(0);
  };

  const effectiveReduction = Math.max(0, damageReduction);

  const defendingCombatant = combatants.find((c) => c.id === defendingTargetId);
  const defendingChar = defendingCombatant
    ? characters.find((c) => c.id === defendingCombatant.characterId)
    : undefined;

  const tieTargetCombatant = pendingAttack?.targetCombatantId
    ? combatants.find((c) => c.id === pendingAttack.targetCombatantId)
    : undefined;
  const tieTargetChar = tieTargetCombatant
    ? characters.find((c) => c.id === tieTargetCombatant.characterId)
    : undefined;

  const defenderDefenseSpells = defendingChar
    ? defendingChar.knownSpells
        .map((id) => spells.find((s) => s.id === id))
        .filter((s): s is Spell => Boolean(s && s.effectType === 'defense'))
    : [];

  const activeCombatant = combatants.find((c) => c.characterId === activeCharacterId);
  const activeChar = activeCombatant
    ? characters.find((c) => c.id === activeCombatant.characterId)
    : undefined;
  const activeTurnStatus = getCombatantTurnActionStatus(activeCombatant);
  const hechizoVelozSpell = spells.find((s) => s.id === 'basic_hechizo_veloz');
  const elevarLimiteSpell = spells.find((s) => s.id === 'basic_elevar_limite');
  const activeCanCastVeloz = Boolean(
    activeChar &&
      hechizoVelozSpell &&
      (activeChar.knownSpells.includes('basic_hechizo_veloz') || activeChar.mana.max > 0)
  );
  const activeCanCastElevar = Boolean(
    activeChar &&
      elevarLimiteSpell &&
      (activeChar.knownSpells.includes('basic_elevar_limite') || activeChar.mana.max > 0)
  );

  const resolvedColTargetId = colTargetId || combatants[0]?.id || '';
  const colTargetCb = combatants.find((c) => c.id === resolvedColTargetId);
  const colTargetChar = colTargetCb
    ? characters.find((c) => c.id === colTargetCb.characterId)
    : undefined;
  const colMaxProtStacks = getMaxAffordableProtectionStacks(colTargetChar, spells, manaMode);
  const effectiveColProtStacks = Math.min(colProtectionStacks, colMaxProtStacks);
  const colProtSummary = calcDirectProtectionSummary(
    colTargetChar,
    spells,
    colKind,
    effectiveColProtStacks
  );

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-4">
      {/* Cabecera de combate, cola de turnos y modo de maná */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--arc-border)] pb-3.5">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)]">
            Mesa de Combate · Ronda {round}
          </h2>
          <p className="text-[13px] text-[var(--arc-muted)] mt-0.5">
            Cola de iniciativa por turnos · al cerrar cada ronda se descuentan duraciones y hechizos preparados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--arc-muted)]">Maná:</span>
            <div className="flex p-0.5 rounded-lg bg-[var(--arc-input)]">
              <button
                type="button"
                onClick={() => onChangeManaMode('auto')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  manaMode === 'auto'
                    ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)]'
                    : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => onChangeManaMode('manual')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  manaMode === 'manual'
                    ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                    : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {onToggleAutoPassTurn && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--arc-muted)]">Turnos:</span>
              <div className="flex p-0.5 rounded-lg bg-[var(--arc-input)]">
                <button
                  type="button"
                  onClick={() => onToggleAutoPassTurn(true)}
                  title="Pasa el turno automáticamente al agotar tus acciones"
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    autoPassTurn
                      ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  Auto-pase
                </button>
                <button
                  type="button"
                  onClick={() => onToggleAutoPassTurn(false)}
                  title="Avanzás cada turno manualmente con el botón Siguiente turno"
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    !autoPassTurn
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangeRound(-1)}
              title="Ronda anterior"
              aria-label="Ronda anterior"
              className="min-h-[38px] w-9 inline-flex items-center justify-center rounded-lg bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => (onAdvanceTurn ? onAdvanceTurn() : onChangeRound(1))}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Siguiente turno
            </button>
            <button
              type="button"
              onClick={() => onChangeRound(1)}
              title="Avanzar 1 ronda completa ahora (descuenta todas las duraciones)"
              className="min-h-[38px] inline-flex items-center gap-1 rounded-lg bg-[var(--arc-raised)]/80 px-2.5 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0 transition-colors"
            >
              <Timer className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
              +1R
            </button>
            <button
              type="button"
              onClick={() => setShowStatusesPanel((v) => !v)}
              title="Abrir consola de estados en combate (activos, aplicar y reglas)"
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                showStatusesPanel
                  ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Estados ({combatants.reduce((acc, cb) => acc + (cb.activeStatuses?.length || 0), 0)})
            </button>
            <button
              type="button"
              onClick={onResetCombat}
              title="Reiniciar combate"
              aria-label="Reiniciar combate"
              className="min-h-[38px] w-9 inline-flex items-center justify-center rounded-lg bg-transparent text-[var(--arc-muted)] hover:bg-[#361912] hover:text-[#e88a70] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Consola dedicada de Estados en Combate */}
      {showStatusesPanel && onApplyManualStatus && onUpdateCombatantStatus && (
        <CombatStatusesUI
          combatants={combatants}
          characters={characters}
          selectedTargetId={selectedTargetId}
          onApplyManualStatus={onApplyManualStatus}
          onUpdateCombatantStatus={onUpdateCombatantStatus}
          onRemoveCombatantStatus={onRemoveCombatantStatus}
          onAdjustStatusTurns={onAdjustStatusTurns || (() => {})}
          onRecoverDisarmedWeapon={onRecoverDisarmedWeapon || (() => {})}
          onStandUpFromProne={onStandUpFromProne || (() => {})}
          onTriggerSynergyReaction={onTriggerSynergyReaction}
          onInspectMechanic={onInspectMechanic}
        />
      )}

      {/* Barra de estado / resultado del modo Práctica contra la Máquina */}
      {hasBotModeActive && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
            botBattleOutcome === 'victory'
              ? 'border-[#5f8240] bg-[#192513] text-[#d5f0b8]'
              : botBattleOutcome === 'defeat'
                ? 'border-[#8f4234] bg-[#291412] text-[#f7c5b8]'
                : 'border-[var(--arc-border)] bg-[var(--arc-surface-alt)] text-[var(--arc-text)]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {botBattleOutcome === 'victory' ? (
              <Trophy className="h-4 w-4 text-[#a7e06e] shrink-0" />
            ) : botBattleOutcome === 'defeat' ? (
              <AlertTriangle className="h-4 w-4 text-[#f08b75] shrink-0" />
            ) : (
              <Bot className="h-4 w-4 text-[var(--arc-accent)] shrink-0" />
            )}

            {botBattleOutcome === 'victory' ? (
              <span className="font-semibold">
                ¡Victoria en práctica! Derrotaste a todos los enemigos de la máquina.
              </span>
            ) : botBattleOutcome === 'defeat' ? (
              <span className="font-semibold">
                Derrota en práctica. Podés pedir revancha para restaurar PV/Maná y volver a intentar.
              </span>
            ) : (
              <span>
                <strong className="font-semibold text-[var(--arc-accent)]">
                  Práctica vs Máquina
                </strong>
                {isBotActingNow
                  ? ' · La máquina está resolviendo su jugada...'
                  : ' · Los enemigos actúan y defienden automáticamente en sus turnos.'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {onRematchBotPractice && (
              <button
                type="button"
                onClick={onRematchBotPractice}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-lg bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revancha
              </button>
            )}
            {onEndBotPractice && (
              <button
                type="button"
                onClick={onEndBotPractice}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-lg bg-black/25 px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-black/40 hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
              >
                Salir de práctica
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cola visual de turnos por orden de iniciativa */}
      {sortedCombatants.length > 0 && (
        <div className="border-b border-[var(--arc-border)] pb-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--arc-muted)] uppercase tracking-wider text-[11px]">
              Cola de turnos (por iniciativa)
            </span>
            <span className="font-mono-num text-[var(--arc-muted)]">
              Ronda {round} · {sortedCombatants.filter((cb) => cb.actedThisRound).length}/
              {sortedCombatants.length} completados
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {sortedCombatants.map((cb, idx) => {
              const ch = characters.find((c) => c.id === cb.characterId);
              if (!ch) return null;
              const isCurrentTurn = cb.id === currentTurnCombatantId;
              const isIncapacitated = ch.condition !== 'active';
              const acted = Boolean(cb.actedThisRound) && !isCurrentTurn;
              return (
                <button
                  key={cb.id}
                  type="button"
                  onClick={() => onSelectActor(ch.id)}
                  title={
                    isCurrentTurn
                      ? `Turno actual de ${ch.name}`
                      : `Saltar al turno de ${ch.name} (Ini ${cb.initiative})`
                  }
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                    isCurrentTurn
                      ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-text)] font-bold'
                      : isIncapacitated
                        ? 'border-transparent bg-[var(--arc-input)] text-[var(--arc-muted)] opacity-50 line-through'
                        : acted
                          ? 'border-transparent bg-[var(--arc-surface-alt)] text-[var(--arc-muted)] opacity-75 hover:opacity-100'
                          : 'border-[var(--arc-border)]/70 bg-[var(--arc-surface-alt)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]/70'
                  }`}
                >
                  <span className="font-mono-num text-[11px] text-[var(--arc-muted)]">
                    #{idx + 1}
                  </span>
                  {cb.isBotControlled && (
                    <Bot className="h-3.5 w-3.5 text-[var(--arc-accent)] shrink-0" />
                  )}
                  <span>{ch.name}</span>
                  <span className="font-mono-num text-[11px] text-[var(--arc-accent)]">
                    Ini {cb.initiative}
                  </span>
                  {isCurrentTurn && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--arc-accent)]">
                      · En turno
                    </span>
                  )}
                  {acted && !isIncapacitated && (
                    <Check className="h-3.5 w-3.5 text-[var(--arc-cat-heal-accent)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Contador visual de acciones del turno para el personaje activo */}
      {activeCombatant && activeChar && (
        <div className="border-b border-[var(--arc-border)] pb-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--arc-text)]">
                <Zap className="h-4 w-4 text-[var(--arc-accent)] shrink-0" />
                <span>Acciones de {activeChar.name} este turno:</span>
              </div>
              <span
                className={`font-mono-num text-sm font-bold ${
                  activeTurnStatus.remaining === 0
                    ? 'text-[#f0a83a]'
                    : 'text-[var(--arc-accent)]'
                }`}
              >
                {activeTurnStatus.remaining}/{activeTurnStatus.max}
              </span>
              <div className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: activeTurnStatus.max }).map((_, idx) => {
                  const isAvailable = idx < activeTurnStatus.remaining;
                  return (
                    <span
                      key={idx}
                      className={`h-2 w-6 rounded-full transition-colors ${
                        isAvailable ? 'bg-[var(--arc-accent)]' : 'bg-[var(--arc-raised)]'
                      }`}
                    />
                  );
                })}
              </div>
              {activeTurnStatus.used > activeTurnStatus.max && (
                <span className="font-mono-num text-xs text-[#ffd28a]">
                  ({activeTurnStatus.used} usadas)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onQuickCastTurnBuff && activeCanCastVeloz && hechizoVelozSpell && (
                <button
                  type="button"
                  disabled={activeTurnStatus.hasHechizoVeloz}
                  onClick={() => {
                    setChainListCollapsed(false);
                    onQuickCastTurnBuff(hechizoVelozSpell, activeChar.id);
                  }}
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    activeTurnStatus.hasHechizoVeloz
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)] opacity-75 cursor-default'
                      : 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)] hover:brightness-110'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {activeTurnStatus.hasHechizoVeloz
                    ? 'Hechizo Veloz activo (2/2)'
                    : 'Hechizo Veloz (-3)'}
                </button>
              )}

              {onQuickCastTurnBuff && activeCanCastElevar && elevarLimiteSpell && (
                <button
                  type="button"
                  disabled={!activeTurnStatus.canActivateElevarLimite}
                  onClick={() => {
                    setChainListCollapsed(false);
                    onQuickCastTurnBuff(elevarLimiteSpell, activeChar.id);
                  }}
                  title={
                    activeTurnStatus.hasElevarLimite
                      ? 'Elevar el Límite ya está activo en este turno'
                      : !activeTurnStatus.hasHechizoVeloz
                        ? 'Bloqueado: requiere activar Hechizo Veloz primero en este turno'
                        : 'Activar Elevar el Límite (-5 maná) para habilitar una 3ra acción ofensiva'
                  }
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    activeTurnStatus.hasElevarLimite
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)] opacity-75 cursor-default'
                      : !activeTurnStatus.hasHechizoVeloz
                        ? 'bg-[var(--arc-input)] text-[var(--arc-muted)] opacity-60 cursor-not-allowed'
                        : 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)] hover:brightness-110'
                  }`}
                >
                  {!activeTurnStatus.hasHechizoVeloz ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  {activeTurnStatus.hasElevarLimite
                    ? 'Elevar el Límite activo (3/3)'
                    : 'Elevar el Límite (-5)'}
                </button>
              )}

              {onResetTurnActions && activeTurnStatus.used > 0 && (
                <button
                  type="button"
                  onClick={() => onResetTurnActions(activeCombatant.id)}
                  title="Reiniciar contador de acciones ofensivas usadas en este turno"
                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-transparent px-2 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reiniciar
                </button>
              )}
            </div>
          </div>

          {activeTurnStatus.remaining === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#33220c] px-3 py-2 text-xs text-[#ffd28a]">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 text-[#f0a83a] shrink-0" />
                <span>
                  {autoPassSecondsLeft !== null &&
                  currentTurnCombatantId === activeCombatant.id ? (
                    <>
                      Turno completado · pasando automáticamente en{' '}
                      <strong className="font-mono-num text-white">{autoPassSecondsLeft}s</strong>
                      {!activeTurnStatus.hasHechizoVeloz
                        ? ' (podés activar Hechizo Veloz antes de que pase).'
                        : !activeTurnStatus.hasElevarLimite
                          ? ' (podés activar Elevar el Límite antes de que pase).'
                          : '.'}
                    </>
                  ) : autoPassTurn && autoPassPaused ? (
                    'Sin acciones restantes (auto-pase en pausa). Activá Hechizo Veloz o pasá turno manualmente.'
                  ) : !activeTurnStatus.hasHechizoVeloz ? (
                    'Sin acciones restantes este turno. Activá Hechizo Veloz (2/2) o pasá el turno.'
                  ) : !activeTurnStatus.hasElevarLimite ? (
                    'Sin acciones restantes este turno. Activá Elevar el Límite (3/3) o pasá el turno.'
                  ) : (
                    'Alcanzaste el límite de 3/3 acciones este turno. Pasá el turno para continuar.'
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {autoPassSecondsLeft !== null &&
                  currentTurnCombatantId === activeCombatant.id &&
                  onPauseAutoPass && (
                    <button
                      type="button"
                      onClick={onPauseAutoPass}
                      className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-black/30 px-2.5 text-xs font-semibold text-[#ffd28a] hover:bg-black/50 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Pause className="h-3 w-3" />
                      Pausar
                    </button>
                  )}
                {onAdvanceTurn && (
                  <button
                    type="button"
                    onClick={onAdvanceTurn}
                    className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
                  >
                    <SkipForward className="h-3 w-3" />
                    Pasar ahora
                  </button>
                )}
              </div>
            </div>
          )}

          {(activeTurnStatus.hasHechizoVeloz || activeTurnStatus.hasElevarLimite) &&
            !(
              pendingAttack &&
              !pendingAttack.resolved &&
              pendingAttack.attackerCharacterId === activeChar.id
            ) &&
            renderChainCastList(activeChar, activeCombatant, 'turn-bar')}
        </div>
      )}

      {/* Agregar PJs o PNJs al combate */}
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedAddId || availableToAdd[0]?.id || ''}
          onChange={(e) => setSelectedAddId(e.target.value)}
          aria-label="Seleccionar personaje o PNJ para agregar al combate"
          className="w-full sm:w-auto sm:flex-1 min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs text-[var(--arc-text)]"
        >
          {availableToAdd.length === 0 ? (
            <option value="">Todos los personajes creados ya están en combate</option>
          ) : (
            availableToAdd.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind === 'mage' ? 'PJ' : 'PNJ'})
              </option>
            ))
          )}
        </select>

        <div className="flex items-center gap-1.5">
          <label htmlFor="combat-init" className="text-xs text-[var(--arc-muted)]">
            Iniciativa
          </label>
          <input
            id="combat-init"
            type="number"
            value={addInitiative}
            onChange={(e) => setAddInitiative(parseInt(e.target.value, 10) || 0)}
            className="font-mono-num w-16 min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-center text-sm text-[var(--arc-text)]"
          />
        </div>

        <button
          type="button"
          disabled={availableToAdd.length === 0}
          onClick={handleAdd}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-raised)] px-3.5 text-xs font-semibold text-[var(--arc-text)] hover:brightness-110 disabled:opacity-40 whitespace-nowrap shrink-0 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir al combate
        </button>

        {onStartBotPractice && (
          <button
            type="button"
            onClick={() => setShowBotSetup((v) => !v)}
            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              showBotSetup || hasBotModeActive
                ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                : 'border-[var(--arc-border)] bg-[var(--arc-surface-alt)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            Vs Máquina
          </button>
        )}

        {onApplyCollateralDamage && combatants.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!showCollateralPanel && !colTargetId) {
                const actorCb = combatants.find((c) => c.characterId === activeCharacterId);
                setColTargetId(actorCb?.id || combatants[0]?.id || '');
              }
              setShowCollateralPanel((v) => !v);
            }}
            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              showCollateralPanel
                ? 'bg-[#662b0f] text-[#ffe0cc]'
                : 'bg-transparent text-[#f3be8d] hover:bg-[#3b1f10]'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Daño colateral
          </button>
        )}
      </div>

      {/* Panel de configuración: Combate de Práctica contra la Máquina */}
      {showBotSetup && onStartBotPractice && (
        <div className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2.5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[var(--arc-accent)] shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-[var(--arc-text)]">
                  Práctica contra la máquina
                </h3>
                <p className="text-xs text-[var(--arc-muted)]">
                  Elegí tu personaje y uno o más enemigos para practicar turnos, defensas y maná
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBotSetup(false)}
              className="rounded-md px-2.5 py-1 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
            >
              Cerrar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-5">
              <label
                htmlFor="bot-player-select"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
              >
                Tu personaje (jugador)
              </label>
              <select
                id="bot-player-select"
                value={resolvedBotPlayerId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setBotPlayerCharId(nextId);
                  setBotExistingEnemyIds((prev) => prev.filter((id) => id !== nextId));
                }}
                className="w-full min-h-[38px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
              >
                {nonBotCharacters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.kind === 'mage' ? 'PJ' : 'PNJ'} · PV {c.hp.max} / Maná {c.mana.max})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <span className="block text-xs font-semibold text-[var(--arc-muted)] mb-1">
                Estilo de la máquina
              </span>
              <div className="flex p-0.5 rounded-lg bg-[var(--arc-input)] border border-[var(--arc-border)]/70">
                <button
                  type="button"
                  onClick={() => setBotDifficulty('normal')}
                  className={`flex-1 min-h-[34px] rounded-md text-xs font-semibold transition-colors ${
                    botDifficulty === 'normal'
                      ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setBotDifficulty('tactical')}
                  className={`flex-1 min-h-[34px] rounded-md text-xs font-semibold transition-colors ${
                    botDifficulty === 'tactical'
                      ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  Táctico
                </button>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label className="flex items-center gap-2 min-h-[38px] rounded-lg border border-[var(--arc-border)]/70 bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={botPlayerGoesFirst}
                  onChange={(e) => setBotPlayerGoesFirst(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                />
                <span>Actúo primero</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--arc-text)]">
                Enemigos de práctica (elegí 1 o más)
              </span>
              <span className="font-mono-num text-[var(--arc-muted)]">
                {selectedPresetTotal} seleccionados
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {BOT_ENEMY_PRESETS.map((preset) => {
                const count = botPresetCounts[preset.id] || 0;
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors ${
                      count > 0
                        ? 'border-[var(--arc-accent)]/80 bg-[var(--arc-raised)]/60'
                        : 'border-[var(--arc-border)]/70 bg-[var(--arc-input)]/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--arc-text)]">
                          {preset.name}
                        </span>
                        <span className="text-[11px] text-[var(--arc-accent)]">
                          · {preset.role}
                        </span>
                      </div>
                      <div className="font-mono-num text-[11px] text-[var(--arc-muted)] mt-0.5">
                        PV {preset.hp}
                        {preset.mana > 0 ? ` · Maná ${preset.mana}` : ''} · Fís {preset.stats.fisico}{' '}
                        · Man {preset.stats.manipulacion} · Inf {preset.stats.influencia}
                      </div>
                      <p className="text-[11px] text-[var(--arc-muted)] mt-0.5 leading-snug">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={count <= 0}
                        onClick={() =>
                          setBotPresetCounts((prev) => ({
                            ...prev,
                            [preset.id]: Math.max(0, (prev[preset.id] || 0) - 1),
                          }))
                        }
                        aria-label={`Quitar un ${preset.name}`}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-mono-num w-6 text-center text-xs font-bold text-[var(--arc-text)]">
                        {count}
                      </span>
                      <button
                        type="button"
                        disabled={count >= 4}
                        onClick={() =>
                          setBotPresetCounts((prev) => ({
                            ...prev,
                            [preset.id]: Math.min(4, (prev[preset.id] || 0) + 1),
                          }))
                        }
                        aria-label={`Sumar un ${preset.name}`}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)] disabled:opacity-35 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {availableExistingEnemies.length > 0 && (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[var(--arc-muted)]">
                Opcional: sumar PJs / PNJs tuyos controlados por la máquina
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableExistingEnemies.map((c) => {
                  const selected = validExistingEnemyIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setBotExistingEnemyIds((prev) =>
                          prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                        )
                      }
                      className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        selected
                          ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-text)] font-semibold'
                          : 'border-[var(--arc-border)]/70 bg-[var(--arc-input)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                      }`}
                    >
                      <Bot className="h-3 w-3 shrink-0" />
                      <span>{c.name}</span>
                      <span className="font-mono-num text-[11px] opacity-80">
                        (PV {c.hp.max})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--arc-border)] pt-3">
            <span className="text-xs text-[var(--arc-muted)]">
              {botPlayerGoesFirst
                ? 'Empezás vos en el turno #1 y los enemigos responden en orden.'
                : 'Se ordena según iniciativa base de cada combatiente.'}
            </span>
            <button
              type="button"
              disabled={totalSelectedBotEnemies === 0 || !resolvedBotPlayerId}
              onClick={() => {
                onStartBotPractice({
                  playerCharId: resolvedBotPlayerId,
                  presetCounts: botPresetCounts,
                  existingEnemyCharIds: validExistingEnemyIds,
                  difficulty: botDifficulty,
                  playerGoesFirst: botPlayerGoesFirst,
                });
                setShowBotSetup(false);
              }}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 whitespace-nowrap shrink-0 shadow-sm transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              Iniciar práctica ({totalSelectedBotEnemies}{' '}
              {totalSelectedBotEnemies === 1 ? 'enemigo' : 'enemigos'})
            </button>
          </div>
        </div>
      )}

      {/* Panel de Daño Colateral (cercanía / impacto / quemadura por turnos) */}
      {showCollateralPanel && onApplyCollateralDamage && combatants.length > 0 && (
        <div className="rounded-xl border border-[#7d4423] bg-[#1f130c] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4a2b18] pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#ffbe94]">
              <AlertTriangle className="h-4 w-4 text-[#ff8748]" />
              <span>Daño colateral (hechizo muy cercano, explosión o efecto por turnos)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCollateralPanel(false);
                setColProtectionStacks(0);
              }}
              className="rounded-md px-2.5 py-1 text-xs text-[#cbb893] hover:bg-black/25 hover:text-white transition-colors"
            >
              Cerrar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                Afectado (puede ser el mismo lanzador)
              </label>
              <select
                value={resolvedColTargetId}
                onChange={(e) => {
                  setColTargetId(e.target.value);
                  setColProtectionStacks(0);
                }}
                className="w-full min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-2.5 text-xs text-[#efe6d5]"
              >
                {sortedCombatants.map((cb) => {
                  const char = characters.find((c) => c.id === cb.characterId);
                  if (!char) return null;
                  return (
                    <option key={cb.id} value={cb.id}>
                      {char.name} [{char.kind === 'mage' ? 'PJ' : 'PNJ'} · PV {char.hp.current}/
                      {char.hp.max}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                Motivo / etiqueta (opcional)
              </label>
              <input
                type="text"
                value={colLabel}
                onChange={(e) => setColLabel(e.target.value)}
                placeholder="Ej: Explosión cercana, Quemadura..."
                className="w-full min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-2.5 text-xs text-[#efe6d5]"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                Naturaleza
              </label>
              <select
                value={colKind}
                onChange={(e) => setColKind(e.target.value as DamageKind)}
                className="w-full min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-2 text-xs text-[#efe6d5]"
              >
                <option value="magico">Mágico</option>
                <option value="fisico">Físico</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                Formato de valor
              </label>
              <select
                value={colMode}
                onChange={(e) => setColMode(e.target.value as 'fixed' | 'dice')}
                className="w-full min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-2 text-xs text-[#efe6d5]"
              >
                <option value="fixed">Valor fijo exacto</option>
                <option value="dice">Tirada de dados</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              {colMode === 'fixed' ? (
                <>
                  <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                    Cantidad de daño
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={colFixed}
                    onChange={(e) => setColFixed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="font-mono-num w-full min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-2.5 text-xs text-[#efe6d5]"
                  />
                </>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                    Dados (+ bono fijo)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={colDieCount}
                      onChange={(e) =>
                        setColDieCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      aria-label="Cantidad de dados de daño colateral"
                      className="font-mono-num w-14 min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-1.5 text-center text-xs text-[#efe6d5]"
                    />
                    <select
                      value={colDieType}
                      onChange={(e) => setColDieType(e.target.value as DieType)}
                      aria-label="Tipo de dado de daño colateral"
                      className="min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-1.5 text-xs text-[#efe6d5]"
                    >
                      {DIE_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={colBonus}
                      onChange={(e) => setColBonus(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      aria-label="Bono fijo de daño colateral"
                      className="font-mono-num w-14 min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-1.5 text-center text-xs text-[#efe6d5]"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                Duración
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setColDurationType('instant')}
                  className={`min-h-[38px] rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                    colDurationType === 'instant'
                      ? 'bg-[#662b0f] text-[#ffd7bd]'
                      : 'bg-[#120c08] text-[#b0a084] hover:text-white'
                  }`}
                >
                  Instantáneo
                </button>
                <button
                  type="button"
                  onClick={() => setColDurationType('turns')}
                  className={`min-h-[38px] rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                    colDurationType === 'turns'
                      ? 'bg-[#662b0f] text-[#ffd7bd]'
                      : 'bg-[#120c08] text-[#b0a084] hover:text-white'
                  }`}
                >
                  Por turnos
                </button>
                {colDurationType === 'turns' && (
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={colTurns}
                      onChange={(e) =>
                        setColTurns(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      aria-label="Turnos de duración del daño colateral"
                      className="font-mono-num w-14 min-h-[38px] rounded-lg border border-[#5a3721] bg-[#120c08] px-1.5 text-center text-xs text-[#efe6d5]"
                    />
                    <span className="text-xs text-[#d6b18f]">t</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(colDurationType === 'instant' || colApplyNow) && colTargetChar && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-[#3b2214]">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#e8d2bc]">
                <Shield className="h-3.5 w-3.5 text-[#8cc8ff] shrink-0" />
                <span className="font-semibold">Protección ({colTargetChar.name}):</span>
                <div className="inline-flex items-center gap-1 rounded-lg bg-[#120c08] px-1.5 py-0.5">
                  <button
                    type="button"
                    disabled={effectiveColProtStacks <= 0}
                    onClick={() => setColProtectionStacks((s) => Math.max(0, s - 1))}
                    aria-label="Restar 1 uso de Protección en daño colateral"
                    className="h-7 w-7 rounded text-xs font-bold text-[#efe6d5] hover:bg-white/10 disabled:opacity-35 transition-colors"
                  >
                    −
                  </button>
                  <span className="font-mono-num min-w-[2.25rem] text-center text-xs font-bold text-[#9fd2ff]">
                    ×{effectiveColProtStacks}
                  </span>
                  <button
                    type="button"
                    disabled={effectiveColProtStacks >= colMaxProtStacks}
                    onClick={() =>
                      setColProtectionStacks((s) => Math.min(colMaxProtStacks, s + 1))
                    }
                    aria-label="Sumar 1 uso de Protección en daño colateral"
                    className="h-7 w-7 rounded text-xs font-bold text-[#efe6d5] hover:bg-white/10 disabled:opacity-35 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-xs font-mono-num text-[#d6b18f]">
                {effectiveColProtStacks > 0 ? (
                  <span>
                    −{colProtSummary.manaCost} maná → −{colProtSummary.reduction} daño
                    {colMode === 'fixed'
                      ? ` · neto: ${Math.max(0, colFixed - colProtSummary.reduction)} PV`
                      : ''}
                  </span>
                ) : (
                  <span>
                    1 maná → −{colKind === 'magico' ? '3 mág.' : '5 fís.'} (Maná:{' '}
                    {colTargetChar.mana.current}/{colTargetChar.mana.max})
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#3b2214]">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#d6b18f]">
              {colDurationType === 'turns' && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colApplyNow}
                    onChange={(e) => setColApplyNow(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#e07a3d]"
                  />
                  <span>Aplicar también 1er golpe ahora</span>
                </label>
              )}
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={colLethal}
                  onChange={(e) => setColLethal(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#d85a3a]"
                />
                <span>Letal (puede matar al llegar a 0 PV)</span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                const targetId = resolvedColTargetId;
                if (!targetId) return;
                onApplyCollateralDamage({
                  targetCombatantId: targetId,
                  label: colLabel,
                  mode: colMode,
                  fixedAmount: colFixed,
                  dice: [{ type: colDieType, count: colDieCount }],
                  bonus: colBonus,
                  damageKind: colKind,
                  durationType: colDurationType,
                  durationTurns: colTurns,
                  applyInitialHitNow: colApplyNow,
                  lethal: colLethal,
                  protectionStacks:
                    colDurationType === 'instant' || colApplyNow
                      ? effectiveColProtStacks
                      : 0,
                });
                setColProtectionStacks(0);
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[#b85a3a] px-4 text-xs font-semibold text-white hover:bg-[#cc6644] shadow-sm transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {colDurationType === 'instant'
                ? 'Aplicar impacto colateral'
                : `Aplicar colateral (${colTurns}t)`}
            </button>
          </div>
        </div>
      )}

      {/* Resolución de Ataque pendiente vs Defensa — Duelo Dividido (Ataca Izq / Defiende Der) */}
      {pendingAttack && !pendingAttack.resolved && (() => {
        const isPendingMagical = isSpellMagical(pendingAttack.spell);
        const pendingDmgKind = getEffectiveSpellDamageKind(pendingAttack.spell);
        const atkNet = pendingAttack.attackRoll.net;
        const atkNetFmt = atkNet > 0 ? `+${atkNet}` : `${atkNet}`;

        const attackerCb = combatants.find((c) => c.id === pendingAttack.attackerCombatantId);
        const attackerChar = characters.find((c) => c.id === pendingAttack.attackerCharacterId);
        const attackerTurnStatus = getCombatantTurnActionStatus(attackerCb);
        const attackerCanCastTurnBuffs = Boolean(
          onQuickCastTurnBuff &&
            attackerChar &&
            attackerChar.condition === 'active' &&
            (attackerChar.mana.max > 0 ||
              attackerChar.knownSpells.includes('basic_hechizo_veloz') ||
              attackerChar.knownSpells.includes('basic_elevar_limite'))
        );

        const resolvedTargetCb = pendingAttack.targetCombatantId
          ? combatants.find((c) => c.id === pendingAttack.targetCombatantId)
          : defendingCombatant;
        const resolvedTargetChar = resolvedTargetCb
          ? characters.find((c) => c.id === resolvedTargetCb.characterId)
          : defendingChar;
        const activeDefenderName =
          pendingAttack.defenseRoll?.defenderName ||
          resolvedTargetChar?.name ||
          'Seleccionar objetivo';

        const pendingDmg = pendingAttack.pendingDamage;
        const isAwaitingDamageDecision = Boolean(pendingDmg);
        const isAwaitingDefenseRoll = !pendingAttack.defenseRoll && !isAwaitingDamageDecision;
        const isAwaitingDamageRoll = Boolean(pendingAttack.defenseRoll && !isAwaitingDamageDecision);

        const defNet = pendingAttack.defenseRoll?.roll.net;
        const defNetFmt =
          defNet !== undefined ? (defNet > 0 ? `+${defNet}` : `${defNet}`) : '';
        const isTrueTie =
          pendingAttack.defenseRoll?.outcome === 'tie_verify_damage' && defNet === atkNet;

        const resolvedTargetEffects = getCombatantStatusEffects(
          resolvedTargetCb,
          resolvedTargetChar
        );
        const defendingEffects = getCombatantStatusEffects(defendingCombatant, defendingChar);
        const defenderCannotUseProtection =
          resolvedTargetEffects.cannotReact || resolvedTargetEffects.cannotCastMagic;

        // Cálculo en vivo de Protección y daño final cuando ya se tiró/decidió el daño
        const maxProtStacks =
          resolvedTargetChar && !defenderCannotUseProtection
            ? getMaxAffordableProtectionStacks(
                resolvedTargetChar,
                spells,
                manaMode,
                undefined,
                resolvedTargetEffects.disarmed
              )
            : 0;
        const effectiveProtStacks = Math.min(pendingProtStacks, maxProtStacks);
        const protSummary = calcDirectProtectionSummary(
          resolvedTargetChar,
          spells,
          pendingDmgKind,
          effectiveProtStacks,
          resolvedTargetEffects.disarmed
        );
        const stepRed = pendingDmgKind === 'magico' ? 3 : 5;
        const protSpell = spells.find((s) => s.id === 'basic_proteccion');
        const nextProtMana =
          effectiveProtStacks === 0 && resolvedTargetChar && protSpell
            ? getEffectiveDefenseManaCost(
                resolvedTargetChar,
                protSpell,
                resolvedTargetEffects.disarmed
              ).cost
            : 1;

        const rawDamageTotal = pendingDmg ? pendingDmg.rawSummary.total : 0;
        const totalPreviewReduction = effectiveReduction + protSummary.reduction;
        const previewFinalDamage = pendingDmg
          ? damageDivisor === 0
            ? 0
            : damageDivisor > 1
              ? Math.floor(Math.max(0, rawDamageTotal - totalPreviewReduction) / damageDivisor)
              : Math.max(0, rawDamageTotal - totalPreviewReduction)
          : 0;
        const previewResultingHp = resolvedTargetChar
          ? Math.max(0, resolvedTargetChar.hp.current - previewFinalDamage)
          : 0;

        return (
          <div className="rounded-xl border border-[var(--arc-border-strong)] bg-[var(--arc-surface-alt)] overflow-hidden">
            {/* Barra superior neutral de resumen del enfrentamiento */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] bg-[var(--arc-surface)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--arc-muted)]">
                  {isAwaitingDamageDecision ? 'Decisión de daño' : 'Duelo en curso'}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-[var(--arc-atk-accent)]">
                  <Swords className="h-3.5 w-3.5 shrink-0" />
                  {pendingAttack.attackerName}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--arc-muted)] shrink-0" />
                <span className="inline-flex items-center gap-1 font-bold text-[var(--arc-def-accent)]">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  {activeDefenderName}
                </span>
                <span className="text-[var(--arc-border-strong)]">·</span>
                <span
                  className={`text-xs font-semibold ${
                    pendingDmgKind === 'magico'
                      ? 'text-[var(--arc-magic-accent)]'
                      : 'text-[var(--arc-phys-accent)]'
                  }`}
                >
                  Daño {pendingDmgKind === 'magico' ? 'Mágico' : 'Físico'}
                </span>
                <span className="text-xs text-[var(--arc-muted)]">
                  · {pendingAttack.isLethal ? 'Letal' : 'No letal'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDefendingTargetId(null);
                  setPendingProtStacks(0);
                  onDismissPendingAttack();
                }}
                className="min-h-[32px] rounded-md bg-transparent px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
              >
                Cerrar
              </button>
            </div>

            {/* Barra de objetivos en Área / Multi-objetivo cuando corresponde */}
            {(pendingAttack.spell.areaConfig?.enabled ||
              (pendingAttack.areaTargetIds && pendingAttack.areaTargetIds.length > 0) ||
              (pendingAttack.areaResolvedTargets && pendingAttack.areaResolvedTargets.length > 0)) && (() => {
              const queuedIds = pendingAttack.areaTargetIds || [];
              const resolvedList = pendingAttack.areaResolvedTargets || [];
              const resolvedIdSet = new Set(resolvedList.map((r) => r.combatantId));
              const activeId = pendingAttack.targetCombatantId;
              const eligibleTargets = combatants.filter(
                (cb) => cb.id !== pendingAttack.attackerCombatantId
              );
              const totalRemaining = (activeId ? 1 : 0) + queuedIds.length;

              return (
                <div className="border-b border-[var(--arc-border)] bg-[var(--arc-input)]/60 px-4 py-2.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-[#9fd2ff]">
                        {pendingAttack.areaLabel || 'Ataque en área / Multi-objetivo'}
                      </span>
                      <span aria-hidden="true" className="text-[var(--arc-muted)]">·</span>
                      <span className="font-mono-num text-[var(--arc-muted)]">
                        Pendientes: {totalRemaining}
                        {resolvedList.length > 0 ? ` · Resueltos: ${resolvedList.length}` : ''}
                      </span>
                    </div>

                    {isAwaitingDefenseRoll && onResolveAllAreaDirect && totalRemaining > 1 && (
                      <button
                        type="button"
                        onClick={onResolveAllAreaDirect}
                        className="min-h-[30px] rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
                      >
                        Daño directo a los {totalRemaining} restantes
                      </button>
                    )}
                  </div>

                  {/* Selector rápido de blancos en el área */}
                  {onToggleAreaTarget && eligibleTargets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[var(--arc-muted)] mr-1">
                        Blancos en el área:
                      </span>
                      {eligibleTargets.map((cb) => {
                        const ch = characters.find((c) => c.id === cb.characterId);
                        if (!ch) return null;
                        const isCurrent = cb.id === activeId;
                        const isQueued = queuedIds.includes(cb.id);
                        const isDone = resolvedIdSet.has(cb.id);
                        const isElectrified = (cb.activeStatuses || []).some(
                          (st) => getStatusElementalKind(st) === 'electrified'
                        );
                        return (
                          <button
                            key={cb.id}
                            type="button"
                            disabled={isDone || (isCurrent && !isAwaitingDefenseRoll)}
                            onClick={() => onToggleAreaTarget(cb.id)}
                            className={`min-h-[28px] rounded-md border px-2 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              isDone
                                ? 'border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-muted)] line-through opacity-60 cursor-default'
                                : isCurrent
                                  ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                                  : isQueued
                                    ? 'border-[#5a8fd6] bg-[#16273d] text-[#cfe4ff] hover:brightness-110'
                                    : 'border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                            }`}
                          >
                            {isCurrent ? '▶ ' : isQueued ? '✓ ' : '+ '}
                            {ch.name}
                            {isElectrified ? ' ⚡' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {resolvedList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--arc-muted)]">
                      <span>Resueltos:</span>
                      {resolvedList.map((r) => (
                        <span key={r.combatantId} className="font-mono-num text-[var(--arc-text)]">
                          {r.name}: {r.outcome === 'blocked' ? 'Bloqueó' : `-${r.damage} PV`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Cuerpo dividido: Izquierda ATACA (cálido) | Derecha DEFIENDE (frío) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--arc-border)]">
              {/* COLUMNA IZQUIERDA — ATACA (Cálido) */}
              <div className="bg-[var(--arc-atk-bg)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--arc-atk-accent)]">
                      <Swords className="h-3.5 w-3.5 shrink-0" />
                      Ataca
                    </div>
                    <h3 className="text-base font-bold text-[var(--arc-atk-text)] mt-0.5 leading-snug">
                      {pendingAttack.attackerName}
                    </h3>
                    <p className="text-[13px] font-medium text-[var(--arc-atk-text)] opacity-85">
                      {pendingAttack.spell.name}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--arc-atk-text)] opacity-70">
                      Neto ataque
                    </div>
                    <div className="font-mono-num text-2xl font-bold leading-none text-[var(--arc-atk-accent)] mt-0.5">
                      {atkNetFmt}
                    </div>
                  </div>
                </div>

                {/* Dados del ataque */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {pendingAttack.attackRoll.rolls.map((val, idx) => {
                      const dieStyle =
                        val === 1
                          ? 'border-[var(--arc-atk-border)] bg-[var(--arc-atk-raised)] text-[var(--arc-atk-accent)]'
                          : val >= 5
                            ? 'border-[#4a7a30] bg-[#1e3818] text-[#c4f2a4]'
                            : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-muted)]';
                      return (
                        <span
                          key={idx}
                          className={`font-mono-num inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold ${dieStyle}`}
                        >
                          {val}
                        </span>
                      );
                    })}
                    {pendingAttack.attackRoll.assured > 0 && (
                      <span className="font-mono-num inline-flex h-7 items-center justify-center rounded-md border border-dashed border-[var(--arc-atk-border)] bg-[var(--arc-atk-raised)] px-2 text-xs font-bold text-[var(--arc-atk-accent)]">
                        +{pendingAttack.attackRoll.assured} aseg.
                      </span>
                    )}
                    {pendingAttack.attackRoll.statusAutoFails &&
                      pendingAttack.attackRoll.statusAutoFails > 0 && (
                        <span
                          title={pendingAttack.attackRoll.statusPenaltyNotes?.join(' · ')}
                          className="font-mono-num inline-flex h-7 items-center justify-center rounded-md border border-dashed border-[#8a3525] bg-[#361611] px-2 text-xs font-bold text-[#ff9a7a]"
                        >
                          +{pendingAttack.attackRoll.statusAutoFails} fallo
                          {pendingAttack.attackRoll.statusAutoFails > 1 ? 's' : ''} auto.
                        </span>
                      )}
                  </div>
                  <p className="text-xs font-mono-num text-[var(--arc-atk-text)] opacity-85">
                    {pendingAttack.attackRoll.successes} éxito(s) ·{' '}
                    {pendingAttack.attackRoll.fails} fallo(s)
                    {pendingAttack.attackRoll.statusPenaltyNotes &&
                    pendingAttack.attackRoll.statusPenaltyNotes.length > 0
                      ? ` [${pendingAttack.attackRoll.statusPenaltyNotes.join(', ')}]`
                      : ''}
                    {pendingAttack.attackRoll.breakdown &&
                    pendingAttack.attackRoll.breakdown.length > 0
                      ? ` · ${pendingAttack.attackRoll.breakdown
                          .map((b) => `${STAT_NAMES[b.stat]} ${b.dice}d6`)
                          .join(' + ')}`
                      : ''}
                  </p>
                </div>

                {/* Daño ya tirado/decidido (visible en la columna del atacante en Paso 3) */}
                {pendingDmg && (
                  <div className="border-t border-[var(--arc-atk-border)]/45 pt-2.5 space-y-1">
                    {pendingDmg.rawSummary.isCriticalHit && (
                      <div className="inline-flex items-center gap-1.5 rounded bg-[#5e1c14] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#ffd6c9]">
                        <Zap className="h-3 w-3 shrink-0" />
                        Crítico automático
                        {pendingDmg.rawSummary.criticalReason
                          ? ` (${pendingDmg.rawSummary.criticalReason})`
                          : ''}
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--arc-atk-accent)]">
                        Daño entrante tirado
                      </span>
                      <span className="font-mono-num text-xl font-bold text-[var(--arc-atk-accent)]">
                        {rawDamageTotal} PV
                      </span>
                    </div>
                    <div className="text-xs font-mono-num text-[var(--arc-atk-text)] opacity-90">
                      <span
                        className={`mr-1.5 font-semibold ${
                          pendingDmgKind === 'magico'
                            ? 'text-[var(--arc-magic-accent)]'
                            : 'text-[var(--arc-phys-accent)]'
                        }`}
                      >
                        [{pendingDmgKind === 'magico' ? 'Mágico' : 'Físico'}]
                      </span>
                      {pendingDmg.rawSummary.isManual
                        ? `Total manual: ${rawDamageTotal}`
                        : `${pendingDmg.rawSummary.parts.join(' + ')}${
                            pendingDmg.rawSummary.bonus ? ` + ${pendingDmg.rawSummary.bonus}` : ''
                          } = ${rawDamageTotal}`}
                      {pendingDmg.rawSummary.notes ? ` (${pendingDmg.rawSummary.notes})` : ''}
                    </div>
                    {isFireDamageSpell(pendingAttack.spell) &&
                      (pendingDmg.rawSummary.maxDieCount || 0) > 0 && (
                        <p className="text-xs font-semibold text-[#ffae7a] flex items-center gap-1.5 pt-0.5">
                          <Flame className="h-3.5 w-3.5 shrink-0" />
                          Dado máximo de fuego (×{pendingDmg.rawSummary.maxDieCount}): aplicará
                          Quemadura si entra daño (&gt; 0 PV).
                        </p>
                      )}
                  </div>
                )}

                {/* Notas de fuego y Reforzar (antes de tirar daño) */}
                {!pendingDmg && isFireDamageSpell(pendingAttack.spell) && (
                  <p className="text-xs font-medium text-[var(--arc-atk-text)] opacity-90 flex items-start gap-1.5">
                    <Flame className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--arc-atk-accent)]" />
                    <span>
                      Daño de fuego: cada dado máximo aplica +1 carga de Quemadura (1d4 × 2t, máx. 10).
                    </span>
                  </p>
                )}

                {!pendingDmg &&
                  pendingAttack.spell.id !== 'basic_golpe_fisico' &&
                  pendingAttack.spell.damageMode === 'auto' &&
                  pendingAttack.spell.damage.dice.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {pendingAttack.isReinforced ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--arc-atk-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--arc-atk-text)]">
                          <Zap className="h-3.5 w-3.5 text-[var(--arc-atk-accent)]" />
                          Reforzado: tirará daño ×2 y aplicará el mayor
                        </span>
                      ) : (
                        onReinforcePendingAttack && (
                          <button
                            type="button"
                            onClick={onReinforcePendingAttack}
                            className="min-h-[34px] inline-flex items-center gap-1.5 rounded-md bg-[var(--arc-atk-raised)] border border-[var(--arc-atk-border)] px-3 py-1 text-xs font-semibold text-[var(--arc-atk-text)] hover:brightness-110 whitespace-nowrap shrink-0 transition-all"
                          >
                            <Zap className="h-3.5 w-3.5 text-[var(--arc-atk-accent)]" />
                            Reforzar Hechizo (-1 maná · daño ×2)
                          </button>
                        )
                      )}
                    </div>
                  )}

                {/* Decisión rápida del atacante en Combate: Hechizo Veloz y Elevar el Límite */}
                {attackerCanCastTurnBuffs && (hechizoVelozSpell || elevarLimiteSpell) && (
                  <div className="border-t border-[var(--arc-atk-border)]/40 pt-2.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--arc-atk-text)] opacity-90">
                        ¿Encadenar otro ataque este turno?
                      </span>
                      <span className="font-mono-num font-bold text-[var(--arc-atk-accent)]">
                        Acciones {attackerTurnStatus.remaining}/{attackerTurnStatus.max}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {hechizoVelozSpell && (
                        <button
                          type="button"
                          disabled={attackerTurnStatus.hasHechizoVeloz}
                          onClick={() => {
                            setChainListCollapsed(false);
                            onQuickCastTurnBuff?.(
                              hechizoVelozSpell,
                              pendingAttack.attackerCharacterId
                            );
                          }}
                          className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                            attackerTurnStatus.hasHechizoVeloz
                              ? 'bg-[var(--arc-input)]/70 text-[var(--arc-atk-accent)] opacity-80 cursor-default'
                              : 'bg-[var(--arc-atk-raised)] border border-[var(--arc-atk-border)] text-[var(--arc-atk-text)] hover:brightness-110'
                          }`}
                        >
                          <Zap className="h-3.5 w-3.5 text-[var(--arc-atk-accent)]" />
                          {attackerTurnStatus.hasHechizoVeloz
                            ? 'Hechizo Veloz activo (2/2)'
                            : 'Hechizo Veloz (-3 maná → 2/2)'}
                        </button>
                      )}

                      {elevarLimiteSpell && (
                        <button
                          type="button"
                          disabled={!attackerTurnStatus.canActivateElevarLimite}
                          onClick={() => {
                            setChainListCollapsed(false);
                            onQuickCastTurnBuff?.(
                              elevarLimiteSpell,
                              pendingAttack.attackerCharacterId
                            );
                          }}
                          title={
                            attackerTurnStatus.hasElevarLimite
                              ? 'Elevar el Límite ya está activo en este turno'
                              : !attackerTurnStatus.hasHechizoVeloz
                                ? 'Bloqueado: activá Hechizo Veloz antes de Elevar el Límite'
                                : 'Activar Elevar el Límite (-5 maná) para una 3ra acción ofensiva'
                          }
                          className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                            attackerTurnStatus.hasElevarLimite
                              ? 'bg-[var(--arc-input)]/70 text-[var(--arc-atk-accent)] opacity-80 cursor-default'
                              : !attackerTurnStatus.hasHechizoVeloz
                                ? 'bg-[var(--arc-input)]/60 text-[var(--arc-muted)] opacity-60 cursor-not-allowed'
                                : 'bg-[var(--arc-atk-raised)] border border-[var(--arc-atk-border)] text-[var(--arc-atk-text)] hover:brightness-110'
                          }`}
                        >
                          {!attackerTurnStatus.hasHechizoVeloz ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <Zap className="h-3.5 w-3.5 text-[var(--arc-atk-accent)]" />
                          )}
                          {attackerTurnStatus.hasElevarLimite
                            ? 'Elevar el Límite activo (3/3)'
                            : 'Elevar el Límite (-5 maná → 3/3)'}
                        </button>
                      )}
                    </div>

                    {attackerChar &&
                      attackerCb &&
                      (attackerTurnStatus.hasHechizoVeloz || attackerTurnStatus.hasElevarLimite) && (
                        <div className="pt-1.5">
                          {renderChainCastList(attackerChar, attackerCb, 'duel')}
                        </div>
                      )}
                  </div>
                )}

                {pendingAttack.spell.collateral?.enabled && onApplyCollateralDamage && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--arc-atk-border)]/40 pt-2.5">
                    <span className="text-xs text-[var(--arc-atk-text)] opacity-85">
                      Colateral: {formatCollateralValue(pendingAttack.spell.collateral)} (
                      {pendingAttack.spell.collateral.durationType === 'turns'
                        ? `${pendingAttack.spell.collateral.durationTurns || 1}t`
                        : 'Instantáneo'}
                      )
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const col = pendingAttack.spell.collateral!;
                        setColTargetId(pendingAttack.attackerCombatantId || combatants[0]?.id || '');
                        setColLabel(col.label || `Colateral (${pendingAttack.spell.name})`);
                        setColMode(col.mode);
                        setColFixed(col.fixedAmount ?? 3);
                        setColDieType(col.dice?.[0]?.type || 'd4');
                        setColDieCount(col.dice?.[0]?.count || 1);
                        setColBonus(col.bonus || 0);
                        setColKind(col.damageKind || 'magico');
                        setColDurationType(col.durationType);
                        setColTurns(col.durationTurns || 2);
                        setColLethal(pendingAttack.isLethal);
                        setShowCollateralPanel(true);
                      }}
                      className="min-h-[30px] rounded-md bg-[var(--arc-atk-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--arc-atk-text)] hover:brightness-110 whitespace-nowrap shrink-0 transition-all"
                    >
                      Cargar daño colateral
                    </button>
                  </div>
                )}
              </div>

              {/* COLUMNA DERECHA — DEFIENDE (Frío) */}
              <div className="bg-[var(--arc-def-bg)] p-4 space-y-3">
                {/* PASO 1: Esperando tirada de defensa */}
                {isAwaitingDefenseRoll && (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--arc-def-accent)]">
                          <Shield className="h-3.5 w-3.5 shrink-0" />
                          Defiende
                        </div>
                        <p className="text-xs font-mono-num text-[var(--arc-def-text)] opacity-85 mt-0.5">
                          Debe superar{' '}
                          <strong className="text-[var(--arc-atk-accent)]">{atkNetFmt}</strong> para
                          evitar el daño
                        </p>
                      </div>

                      {defendingCombatant && defendingChar && pendingAttack.spell.damageMode === 'auto' && (
                        <button
                          type="button"
                          onClick={() =>
                            onResolveDirectDamage(
                              defendingCombatant.id,
                              undefined,
                              effectiveReduction,
                              damageDivisor
                            )
                          }
                          className="min-h-[32px] inline-flex items-center gap-1 rounded-md bg-transparent px-2 text-xs font-semibold text-[var(--arc-atk-accent)] hover:bg-[var(--arc-atk-bg)] whitespace-nowrap shrink-0 transition-colors"
                        >
                          <Swords className="h-3.5 w-3.5" />
                          Sin defensa
                        </button>
                      )}
                    </div>

                    {/* Selector del objetivo defensor */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="defense-target"
                        className="text-xs font-semibold text-[var(--arc-def-text)] shrink-0"
                      >
                        Objetivo:
                      </label>
                      <select
                        id="defense-target"
                        value={defendingTargetId || ''}
                        onChange={(e) => handleSelectDefender(e.target.value)}
                        className="flex-1 min-w-[180px] min-h-[38px] rounded-lg border border-[var(--arc-def-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                      >
                        {sortedCombatants
                          .filter((cb) => cb.characterId !== pendingAttack.attackerCharacterId)
                          .map((cb) => {
                            const char = characters.find((c) => c.id === cb.characterId);
                            if (!char) return null;
                            return (
                              <option key={cb.id} value={cb.id}>
                                {char.name} [{char.kind === 'mage' ? 'PJ' : 'PNJ'} · PV{' '}
                                {char.hp.current}/{char.hp.max}]
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    {/* Info de resistencias, armadura y estados activos del defensor */}
                    {defendingCombatant && defendingChar && (
                      <div className="space-y-1.5 text-xs">
                        {defendingEffects.summaryTags.length > 0 && (
                          <div className="rounded-md border border-[#7a3b26] bg-[#2a140d] px-2.5 py-2 space-y-1 text-[#ffd4c2]">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-[#ff9a76]">
                                Estados en {defendingChar.name}:
                              </span>
                              {defendingEffects.summaryTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-black/35 px-1.5 py-0.5 text-[11px] font-semibold text-[#ffe4d6]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            {defendingEffects.incomingAutoCrit && (
                              <p className="text-[11px] font-semibold text-[#ffb394]">
                                ⚡ Golpe entrante = Crítico automático (dados al máximo) por{' '}
                                {defendingEffects.incomingAutoCritReasons.join(', ')}.
                              </p>
                            )}
                            {defendingEffects.autoFailsDefense > 0 &&
                              !defendingEffects.cannotDefend && (
                                <p className="text-[11px] text-[#ffc9b0]">
                                  Penalización automática en defensa: +
                                  {defendingEffects.autoFailsDefense} fallo
                                  {defendingEffects.autoFailsDefense > 1 ? 's' : ''} (
                                  {defendingEffects.autoFailsDefenseNotes.join(', ')}).
                                </p>
                              )}
                          </div>
                        )}
                        {defendingChar.resistances && (
                          <p className="text-[var(--arc-def-text)] opacity-90">
                            <span className="font-semibold text-[var(--arc-def-accent)]">
                              Resistencias:
                            </span>{' '}
                            {defendingChar.resistances}
                          </p>
                        )}
                        {(() => {
                          const armorMods = getCombatantArmorModifiers(defendingCombatant);
                          if (armorMods.names.length === 0) return null;
                          return (
                            <p className="text-[var(--arc-def-accent)]">
                              Armadura activa: {armorMods.names.join(', ')} (aplicada abajo)
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    {/* Resistencia y reducción fija base */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--arc-def-border)]/40 pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[var(--arc-def-text)] opacity-80">Resistencia:</span>
                        <div className="flex flex-wrap p-0.5 rounded-md bg-[var(--arc-input)]/85 gap-0.5">
                          {(
                            [
                              { val: 1 as const, label: 'Normal' },
                              { val: 2 as const, label: '÷2' },
                              { val: 4 as const, label: '÷4' },
                              { val: 0 as const, label: 'Anular' },
                            ]
                          ).map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setDamageDivisor(opt.val)}
                              className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                                damageDivisor === opt.val
                                  ? opt.val === 0
                                    ? 'bg-[#63291d] text-[#ffd6c9]'
                                    : 'bg-[var(--arc-def-raised)] text-[var(--arc-def-accent)]'
                                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-center gap-1.5 text-[var(--arc-def-text)] opacity-85">
                        <span>Reducción:</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          disabled={damageDivisor === 0}
                          value={damageReduction}
                          onChange={(e) =>
                            setDamageReduction(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="font-mono-num w-14 min-h-[30px] rounded border border-[var(--arc-def-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)] disabled:opacity-40"
                        />
                      </label>
                    </div>

                    {/* Interrumpir Círculo (antes de resolver) + nota de Protección post-daño */}
                    {defendingCombatant && defendingChar && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {onTriggerCounterspellFromAttack &&
                          isPendingMagical &&
                          defendingChar.knownSpells.includes('basic_interrumpir_circulo') && (
                            <button
                              type="button"
                              disabled={
                                defendingEffects.cannotReact || defendingEffects.cannotCastMagic
                              }
                              title={
                                defendingEffects.cannotReact
                                  ? `Sin capacidad de reaccionar (${defendingEffects.cannotReactReasons.join(', ')})`
                                  : defendingEffects.cannotCastMagic
                                    ? `Silenciado (${defendingEffects.cannotCastMagicReasons.join(', ')})`
                                    : undefined
                              }
                              onClick={() =>
                                onTriggerCounterspellFromAttack(defendingCombatant.id)
                              }
                              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-magic-raised)] border border-[var(--arc-magic-border)] px-3 text-xs font-semibold text-[var(--arc-magic-text)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-all"
                            >
                              {(defendingEffects.cannotReact ||
                                defendingEffects.cannotCastMagic) && (
                                <Lock className="h-3 w-3 shrink-0" />
                              )}
                              Interrumpir Círculo (-7 maná · Inf+Man)
                            </button>
                          )}
                        <span className="text-xs text-[var(--arc-def-text)] opacity-75">
                          {defendingEffects.cannotReact
                            ? `Reacción bloqueada (${defendingEffects.cannotReactReasons.join(', ')}): no puede activar Protección.`
                            : defendingEffects.cannotCastMagic
                              ? `Silenciado (${defendingEffects.cannotCastMagicReasons.join(', ')}): no puede activar Protección mágica.`
                              : 'Si impacta, podrás activar Protección luego de ver el daño.'}
                        </span>
                      </div>
                    )}

                    {/* Tirada de defensa o resolución directa */}
                    {defendingCombatant && defendingChar && (
                      <div className="border-t border-[var(--arc-def-border)]/40 pt-3 space-y-2.5">
                        {defendingChar.condition !== 'active' || defendingEffects.cannotDefend ? (
                          <div className="space-y-2">
                            <p className="text-[13px] text-[var(--arc-atk-accent)]">
                              {defendingChar.condition !== 'active'
                                ? `${defendingChar.name} está ${conditionLabel(defendingChar.condition)} y no puede lanzar defensa activa.`
                                : `${defendingChar.name} no puede defenderse (${defendingEffects.cannotDefendReasons.join(', ')}).`}
                            </p>
                            {pendingAttack.spell.damageMode === 'auto' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onResolveDirectDamage(
                                    defendingCombatant.id,
                                    undefined,
                                    effectiveReduction,
                                    damageDivisor
                                  )
                                }
                                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[#b85a3a] px-4 text-xs font-semibold text-white hover:bg-[#cc6644] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                              >
                                <Swords className="h-3.5 w-3.5" />
                                {defendingEffects.incomingAutoCrit
                                  ? 'Aplicar daño crítico automático'
                                  : 'Tirar daño directo (sin defensa)'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={defenseChoice}
                              onChange={(e) => setDefenseChoice(e.target.value)}
                              aria-label="Opción de defensa"
                              className="w-full sm:w-auto sm:flex-1 min-h-[40px] rounded-lg border border-[var(--arc-def-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                            >
                              {defenderDefenseSpells.length > 0 && (
                                <optgroup label="Hechizos y acciones de defensa">
                                  {defenderDefenseSpells
                                    .filter(
                                      (s) =>
                                        !(
                                          defendingEffects.cannotCastMagic && isSpellMagical(s)
                                        )
                                    )
                                    .map((s) => {
                                      const dice = s.combatStats.reduce(
                                        (acc, k) =>
                                          acc + getCharacterStatDice(defendingChar, k, formula),
                                        0
                                      );
                                      const manaInfo = getEffectiveDefenseManaCost(
                                        defendingChar,
                                        s,
                                        defendingEffects.disarmed
                                      );
                                      return (
                                        <option key={s.id} value={`spell:${s.id}`}>
                                          {s.name} ({dice}d6
                                          {s.assuredSuccess > 0
                                            ? ` +${s.assuredSuccess} aseg.`
                                            : ''}{' '}
                                          ·{' '}
                                          {manaInfo.discount > 0
                                            ? `${manaInfo.cost} maná (-${manaInfo.discount} Escudo)`
                                            : `${s.manaCost} maná`}
                                          )
                                        </option>
                                      );
                                    })}
                                </optgroup>
                              )}
                              <optgroup label="Tirada directa por atributo">
                                {(['fisico', 'manipulacion', 'influencia'] as StatKey[]).map(
                                  (k) => (
                                    <option key={k} value={`stat:${k}`}>
                                      {STAT_NAMES[k]} (
                                      {getCharacterStatDice(defendingChar, k, formula)}d6)
                                    </option>
                                  )
                                )}
                                <option value="manual">Manual (elegir dados)</option>
                              </optgroup>
                            </select>

                            {defenseChoice === 'manual' && (
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={manualDefDice}
                                onChange={(e) =>
                                  setManualDefDice(Math.max(1, parseInt(e.target.value, 10) || 1))
                                }
                                aria-label="Cantidad de dados manuales de defensa"
                                className="font-mono-num w-16 min-h-[40px] rounded-lg border border-[var(--arc-def-border)] bg-[var(--arc-input)] px-2 text-center text-xs text-[var(--arc-text)]"
                              />
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                onRollDefense(
                                  defendingCombatant.id,
                                  defenseChoice,
                                  manualDefDice,
                                  effectiveReduction,
                                  damageDivisor
                                );
                              }}
                              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Tirar defensa
                            </button>
                          </div>
                        )}

                        {pendingAttack.spell.damageMode === 'manual' && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input
                              type="number"
                              min={0}
                              value={manualDmgInput}
                              onChange={(e) => setManualDmgInput(e.target.value)}
                              placeholder="Daño tirado manualmente..."
                              className="font-mono-num w-44 min-h-[38px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = parseInt(manualDmgInput, 10);
                                if (Number.isNaN(val)) return;
                                onResolveDirectDamage(
                                  defendingCombatant.id,
                                  val,
                                  effectiveReduction,
                                  damageDivisor
                                );
                                setManualDmgInput('');
                              }}
                              className="min-h-[38px] rounded-lg bg-[#b85a3a] px-3.5 text-xs font-semibold text-white hover:bg-[#cc6644] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                            >
                              Cargar daño directo
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* PASO 2 Y PASO 3: Defensa resuelta (o impacto directo) + Decisión de Protección tras ver el daño */}
                {(isAwaitingDamageRoll || isAwaitingDamageDecision) && (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--arc-def-accent)]">
                          <Shield className="h-3.5 w-3.5 shrink-0" />
                          Defiende
                        </div>
                        <h3 className="text-base font-bold text-[var(--arc-def-text)] mt-0.5 leading-snug">
                          {activeDefenderName}
                        </h3>
                        <p className="text-[13px] font-medium text-[var(--arc-def-text)] opacity-85">
                          {pendingAttack.defenseRoll
                            ? pendingAttack.defenseRoll.defenseLabel
                            : 'Sin defensa (impacto directo)'}
                        </p>
                      </div>

                      {pendingAttack.defenseRoll && (
                        <div className="text-right shrink-0">
                          <div className="text-[11px] uppercase tracking-wider text-[var(--arc-def-text)] opacity-70">
                            Neto defensa
                          </div>
                          <div className="font-mono-num text-2xl font-bold leading-none text-[var(--arc-def-accent)] mt-0.5">
                            {defNetFmt}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dados de la defensa (si hubo tirada defensiva) */}
                    {pendingAttack.defenseRoll && (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pendingAttack.defenseRoll.roll.rolls.map((val, idx) => {
                            const dieStyle =
                              val === 1
                                ? 'border-[var(--arc-atk-border)] bg-[var(--arc-atk-raised)] text-[var(--arc-atk-accent)]'
                                : val >= 5
                                  ? 'border-[var(--arc-def-border)] bg-[var(--arc-def-raised)] text-[var(--arc-def-accent)]'
                                  : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-muted)]';
                            return (
                              <span
                                key={idx}
                                className={`font-mono-num inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold ${dieStyle}`}
                              >
                                {val}
                              </span>
                            );
                          })}
                          {pendingAttack.defenseRoll.roll.assured > 0 && (
                            <span className="font-mono-num inline-flex h-7 items-center justify-center rounded-md border border-dashed border-[var(--arc-def-border)] bg-[var(--arc-def-raised)] px-2 text-xs font-bold text-[var(--arc-def-accent)]">
                              +{pendingAttack.defenseRoll.roll.assured} aseg.
                            </span>
                          )}
                          {pendingAttack.defenseRoll.roll.statusAutoFails &&
                            pendingAttack.defenseRoll.roll.statusAutoFails > 0 && (
                              <span
                                title={pendingAttack.defenseRoll.roll.statusPenaltyNotes?.join(' · ')}
                                className="font-mono-num inline-flex h-7 items-center justify-center rounded-md border border-dashed border-[#8a3525] bg-[#361611] px-2 text-xs font-bold text-[#ff9a7a]"
                              >
                                +{pendingAttack.defenseRoll.roll.statusAutoFails} fallo
                                {pendingAttack.defenseRoll.roll.statusAutoFails > 1 ? 's' : ''} auto.
                              </span>
                            )}
                        </div>
                        <p className="text-xs font-mono-num text-[var(--arc-def-text)] opacity-85">
                          {pendingAttack.defenseRoll.roll.successes} éxito(s) ·{' '}
                          {pendingAttack.defenseRoll.roll.fails} fallo(s)
                          {pendingAttack.defenseRoll.roll.statusPenaltyNotes &&
                          pendingAttack.defenseRoll.roll.statusPenaltyNotes.length > 0
                            ? ` [${pendingAttack.defenseRoll.roll.statusPenaltyNotes.join(', ')}]`
                            : ''}
                        </p>
                      </div>
                    )}

                    {resolvedTargetChar?.resistances && (
                      <p className="text-xs text-[var(--arc-def-text)] opacity-90">
                        <span className="font-semibold text-[var(--arc-def-accent)]">
                          Resistencias:
                        </span>{' '}
                        {resolvedTargetChar.resistances}
                      </p>
                    )}

                    {/* Resistencia y reducción base */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--arc-def-border)]/40 pt-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[var(--arc-def-text)] opacity-80">Resistencia:</span>
                        <div className="flex flex-wrap p-0.5 rounded-md bg-[var(--arc-input)]/85 gap-0.5">
                          {(
                            [
                              { val: 1 as const, label: 'Normal' },
                              { val: 2 as const, label: '÷2' },
                              { val: 4 as const, label: '÷4' },
                              { val: 0 as const, label: 'Anular' },
                            ]
                          ).map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setDamageDivisor(opt.val)}
                              className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                                damageDivisor === opt.val
                                  ? opt.val === 0
                                    ? 'bg-[#63291d] text-[#ffd6c9]'
                                    : 'bg-[var(--arc-def-raised)] text-[var(--arc-def-accent)]'
                                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-center gap-1.5 text-[var(--arc-def-text)] opacity-85">
                        <span>Reducción base:</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          disabled={damageDivisor === 0}
                          value={damageReduction}
                          onChange={(e) =>
                            setDamageReduction(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="font-mono-num w-14 min-h-[30px] rounded border border-[var(--arc-def-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)] disabled:opacity-40"
                        />
                      </label>
                    </div>

                    {/* PASO 3: Decisión de Protección DESPUÉS de conocer el daño tirado */}
                    {isAwaitingDamageDecision && resolvedTargetChar && (
                      <div className="border-t border-[var(--arc-def-border)]/50 pt-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arc-def-accent)]">
                            <ShieldPlus className="h-4 w-4 shrink-0" />
                            <span>Protección ante daño entrante</span>
                          </div>
                          <span className="font-mono-num text-xs text-[var(--arc-def-text)] opacity-85">
                            PV {resolvedTargetChar.hp.current}/{resolvedTargetChar.hp.max} · Maná{' '}
                            {resolvedTargetChar.mana.current}/{resolvedTargetChar.mana.max}
                          </span>
                        </div>

                        {resolvedTargetChar.condition !== 'active' ||
                        defenderCannotUseProtection ? (
                          <p className="text-xs text-[var(--arc-atk-accent)]">
                            {resolvedTargetChar.condition !== 'active'
                              ? `${resolvedTargetChar.name} está ${conditionLabel(resolvedTargetChar.condition)} y no puede activar Protección.`
                              : resolvedTargetEffects.cannotReact
                                ? `${resolvedTargetChar.name} no tiene capacidad de reaccionar (${resolvedTargetEffects.cannotReactReasons.join(', ')}) y no puede activar Protección.`
                                : `${resolvedTargetChar.name} está silenciado (${resolvedTargetEffects.cannotCastMagicReasons.join(', ')}) y no puede activar Protección mágica.`}
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--arc-def-border)] bg-[var(--arc-input)] px-1.5 py-0.5">
                                <button
                                  type="button"
                                  disabled={effectiveProtStacks <= 0}
                                  onClick={() =>
                                    setPendingProtStacks((s) => Math.max(0, s - 1))
                                  }
                                  aria-label="Restar 1 carga de Protección"
                                  className="h-7 w-7 rounded text-xs font-bold text-[var(--arc-text)] hover:bg-[var(--arc-def-raised)] disabled:opacity-35 transition-colors"
                                >
                                  −
                                </button>
                                <span className="font-mono-num min-w-[2.25rem] text-center text-xs font-bold text-[var(--arc-def-accent)]">
                                  ×{effectiveProtStacks}
                                </span>
                                <button
                                  type="button"
                                  disabled={
                                    effectiveProtStacks >= maxProtStacks || damageDivisor === 0
                                  }
                                  onClick={() =>
                                    setPendingProtStacks((s) => Math.min(maxProtStacks, s + 1))
                                  }
                                  aria-label="Sumar 1 carga de Protección"
                                  className="h-7 w-7 rounded text-xs font-bold text-[var(--arc-text)] hover:bg-[var(--arc-def-raised)] disabled:opacity-35 transition-colors"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={
                                  effectiveProtStacks >= maxProtStacks ||
                                  damageDivisor === 0 ||
                                  previewFinalDamage === 0
                                }
                                onClick={() =>
                                  setPendingProtStacks((s) => Math.min(maxProtStacks, s + 1))
                                }
                                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-def-raised)] border border-[var(--arc-def-border)] px-3 text-xs font-semibold text-[var(--arc-def-text)] hover:brightness-110 disabled:opacity-40 whitespace-nowrap shrink-0 transition-all"
                              >
                                <ShieldPlus className="h-3.5 w-3.5 text-[var(--arc-def-accent)]" />
                                +1 Protección (-{nextProtMana} maná → -{stepRed}{' '}
                                {pendingDmgKind === 'magico' ? 'mág.' : 'fís.'})
                              </button>
                            </div>

                            {effectiveProtStacks > 0 && (
                              <span className="font-mono-num text-xs font-semibold text-[var(--arc-def-accent)]">
                                −{protSummary.manaCost} maná → −{protSummary.reduction} daño
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isAwaitingDamageRoll && (
                      <p className="text-xs text-[var(--arc-def-text)] opacity-75">
                        Tirá o cargá el daño abajo; luego podrás decidir si activás{' '}
                        <strong>Protección</strong> antes de descontar PV.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Franja inferior — Paso 2: Tirar verificación de daños (empate o daño manual) */}
            {isAwaitingDamageRoll && pendingAttack.defenseRoll && (
              <div className="border-t border-[var(--arc-border)] bg-[var(--arc-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-[var(--arc-atk-accent)]">
                    {isTrueTie
                      ? `Empate (${atkNetFmt} == ${defNetFmt}): el ataque impacta`
                      : `Ataque (${atkNetFmt}) supera a Defensa (${defNetFmt}): cargar daño`}
                  </div>
                  <p className="text-xs text-[var(--arc-muted)]">
                    Se efectúa <strong>{pendingAttack.spell.name}</strong> sobre{' '}
                    <strong>{pendingAttack.defenseRoll.defenderName}</strong>
                    {pendingAttack.spell.effectDescription
                      ? ` — ${pendingAttack.spell.effectDescription}`
                      : ''}
                    . Luego se podrá activar Protección.
                  </p>
                </div>

                {pendingAttack.spell.damageMode === 'auto' ? (
                  <button
                    type="button"
                    onClick={() =>
                      onVerifyTieDamage(undefined, effectiveReduction, damageDivisor)
                    }
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Dices className="h-4 w-4" />
                    Tirar daño (
                    {pendingAttack.spell.damage.dice.map((d) => `${d.count}${d.type}`).join(' + ') ||
                      '0'}
                    {pendingAttack.spell.damage.bonus
                      ? ` + ${pendingAttack.spell.damage.bonus}`
                      : ''}
                    )
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={manualDmgInput}
                      onChange={(e) => setManualDmgInput(e.target.value)}
                      placeholder="Daño tirado..."
                      className="font-mono-num w-40 min-h-[38px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseInt(manualDmgInput, 10);
                        if (Number.isNaN(val)) return;
                        onVerifyTieDamage(val, effectiveReduction, damageDivisor);
                        setManualDmgInput('');
                      }}
                      className="min-h-[38px] rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                    >
                      Cargar daño y decidir Protección
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Franja inferior — Paso 3: Confirmación final del daño tras decidir Protección */}
            {isAwaitingDamageDecision && pendingDmg && resolvedTargetChar && (
              <div className="border-t border-[var(--arc-border)] bg-[var(--arc-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-[var(--arc-text)] font-mono-num">
                    Daño final a{' '}
                    <span className="text-[var(--arc-def-accent)]">{resolvedTargetChar.name}</span>:{' '}
                    <span
                      className={
                        previewFinalDamage > 0
                          ? 'text-[var(--arc-atk-accent)]'
                          : 'text-[var(--arc-def-accent)]'
                      }
                    >
                      {previewFinalDamage} PV
                    </span>
                    <span className="ml-2 text-xs font-normal text-[var(--arc-muted)]">
                      (PV {resolvedTargetChar.hp.current} → {previewResultingHp})
                    </span>
                  </div>
                  <p className="text-xs font-mono-num text-[var(--arc-muted)]">
                    Tirado {rawDamageTotal}
                    {effectiveReduction > 0 ? ` − ${effectiveReduction} base` : ''}
                    {protSummary.reduction > 0
                      ? ` − ${protSummary.reduction} Protección (×${effectiveProtStacks}, −${protSummary.manaCost} maná)`
                      : ''}
                    {damageDivisor === 2
                      ? ' ÷ 2'
                      : damageDivisor === 4
                        ? ' ÷ 4'
                        : damageDivisor === 0
                          ? ' → Anulado'
                          : ''}
                    {' = '}
                    <strong className="text-[var(--arc-text)]">{previewFinalDamage} PV</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onConfirmPendingDamage?.(
                      effectiveReduction,
                      damageDivisor,
                      effectiveProtStacks
                    );
                    setPendingProtStacks(0);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  {previewFinalDamage > 0
                    ? `Confirmar y aplicar ${previewFinalDamage} de daño`
                    : 'Confirmar (0 de daño · mitigado)'}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tirada enfrentada de Interrumpir Círculo (Influencia + Manipulación de maná) */}
      {pendingCounterspell && onResolveCounterspell && (
        <div className="rounded-xl border border-[#6e4fb8] bg-[#171129] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#dec7ff]">
                🌀 Interrumpir Círculo — {pendingCounterspell.interruptorName}
                {pendingCounterspell.spellName ? ` vs ${pendingCounterspell.spellName}` : ''}
              </h3>
              <p className="text-[13px] text-[#c7b3eb] font-mono-num mt-0.5">
                Tirada de {pendingCounterspell.interruptorName} (Influencia + Manipulación):{' '}
                {pendingCounterspell.interruptRoll.successes} éxito(s) ·{' '}
                {pendingCounterspell.interruptRoll.fails} fallo(s) · Neto{' '}
                <strong>
                  {pendingCounterspell.interruptRoll.net > 0
                    ? `+${pendingCounterspell.interruptRoll.net}`
                    : pendingCounterspell.interruptRoll.net}
                </strong>
              </p>
            </div>
            {onDismissPendingCounterspell && (
              <button
                type="button"
                onClick={onDismissPendingCounterspell}
                className="min-h-[32px] rounded-md bg-transparent px-2.5 text-xs text-[#cbb8eb] hover:bg-white/10 hover:text-white transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>

          <p className="text-[13px] text-[#d6c9ef] leading-relaxed">
            Tirada enfrentada de <strong>Influencia + Manipulación de maná</strong>. Si{' '}
            <strong>{pendingCounterspell.interruptorName}</strong> saca más neto que el lanzador rival,
            el hechizo queda anulado.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {sortedCombatants
              .filter((cb) => cb.characterId !== pendingCounterspell.interruptorCharacterId)
              .map((cb) => {
                const char = characters.find((c) => c.id === cb.characterId);
                if (!char) return null;
                const infManDice =
                  getCharacterStatDice(char, 'influencia', formula) +
                  getCharacterStatDice(char, 'manipulacion', formula);
                const isTarget = char.id === pendingCounterspell.targetCharacterId;
                return (
                  <button
                    key={cb.id}
                    type="button"
                    onClick={() => onResolveCounterspell(cb.id)}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      isTarget
                        ? 'bg-[#6e4fb8] text-white hover:bg-[#805fd1] shadow-sm'
                        : 'bg-[#2a1d4a] text-[#dec7ff] hover:bg-[#3a2866]'
                    }`}
                  >
                    <Dices className="h-3.5 w-3.5" />
                    {char.name} resiste ({infManDice}d6 Inf+Man)
                  </button>
                );
              })}

            <div className="inline-flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={20}
                value={manualCounterDice}
                onChange={(e) =>
                  setManualCounterDice(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                aria-label="Dados manuales de Influencia + Manipulación rival"
                className="font-mono-num w-14 min-h-[38px] rounded-lg border border-[#553e85] bg-[#100b1d] px-1.5 text-center text-xs text-[#efe6d5]"
              />
              <button
                type="button"
                onClick={() => onResolveCounterspell('manual', manualCounterDice)}
                className="min-h-[38px] rounded-lg bg-[#2a1d4a] px-3 text-xs font-semibold text-[#dec7ff] hover:bg-[#3a2866] transition-colors"
              >
                Rival manual ({manualCounterDice}d6)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chequeo de Estado pendiente (siempre por Influencia) */}
      {pendingStatusCheck && (
        <div className="rounded-xl border border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[var(--arc-magic-accent)]">
                Aplicar estado ({pendingStatusCheck.statuses.join(' / ')}): {pendingStatusCheck.casterName} — {pendingStatusCheck.spellName}
              </h3>
              <p className="text-[13px] text-[var(--arc-magic-text)] font-mono-num mt-0.5">
                Tirada de Influencia del lanzador: {pendingStatusCheck.casterRoll.successes} éxito(s) ·{' '}
                {pendingStatusCheck.casterRoll.fails} fallo(s) · Neto{' '}
                <strong>
                  {pendingStatusCheck.casterRoll.net > 0
                    ? `+${pendingStatusCheck.casterRoll.net}`
                    : pendingStatusCheck.casterRoll.net}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissPendingStatus}
              className="min-h-[32px] rounded-md bg-transparent px-2.5 text-xs text-[var(--arc-muted)] hover:bg-black/20 hover:text-[var(--arc-text)] transition-colors"
            >
              Cerrar
            </button>
          </div>

          <p className="text-[13px] text-[#cbb893] leading-relaxed">
            Los estados van siempre por <strong>Influencia</strong>. Elegí el objetivo para resistir con
            su Influencia (se aplica si lanzador ≥ defensor) o aplicalo directo:
          </p>
          {pendingStatusCheck.dispelConfig?.enabled && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#78432a] bg-[#2a1710] px-3 py-2 text-xs text-[#ffd2b8]">
              <ShieldOff className="h-3.5 w-3.5 text-[#ff9b70] shrink-0" />
              <span>
                <strong>Disipación:</strong> quitará{' '}
                {(pendingStatusCheck.dispelConfig.maxEffects ?? 0) > 0
                  ? `hasta ${pendingStatusCheck.dispelConfig.maxEffects} efecto(s)`
                  : 'todos los efectos'}{' '}
                de tipo <strong>{DISPEL_SCOPE_LABELS[pendingStatusCheck.dispelConfig.scope]}</strong>{' '}
                del objetivo.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {sortedCombatants
              .filter((cb) => cb.characterId !== pendingStatusCheck.casterCharacterId)
              .map((cb) => {
                const char = characters.find((c) => c.id === cb.characterId);
                if (!char) return null;
                const infDice = getCharacterStatDice(char, 'influencia', formula);
                return (
                  <div key={cb.id} className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onRollStatusResistance(cb.id)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Dices className="h-3.5 w-3.5" />
                      {char.name} resiste (Inf {infDice}d6)
                    </button>
                    <button
                      type="button"
                      onClick={() => onApplyStatusDirect(cb.id)}
                      className="min-h-[36px] rounded-lg bg-transparent px-2.5 text-xs font-medium text-[#d6c4a0] hover:bg-black/25 hover:text-white transition-colors"
                    >
                      Aplicar directo
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Curación pendiente para aplicar a un combatiente */}
      {pendingHeal && (
        <div className="rounded-xl border border-[#5f8240] bg-[#1c2615] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-[#cdeba9]">
              <HeartPulse className="inline h-4 w-4 mr-1.5" />
              {pendingHeal.healerName} lanzó {pendingHeal.spellName}:{' '}
              {pendingHeal.isManual ? `tirar ${pendingHeal.formulaText}` : `+${pendingHeal.amount} PV`}
            </div>
            <button
              type="button"
              onClick={onDismissPendingHeal}
              className="rounded-md px-2.5 py-1 text-xs text-[#9cb984] hover:bg-black/25 hover:text-white transition-colors"
            >
              Cerrar
            </button>
          </div>
          {pendingHeal.isManual && (
            <input
              type="number"
              min={0}
              value={manualHealInput}
              onChange={(e) => setManualHealInput(e.target.value)}
              placeholder="Total de curación..."
              className="font-mono-num w-40 min-h-[38px] rounded-md border border-[#4a6932] bg-[#12180e] px-2.5 text-xs text-[#efe6d5]"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {sortedCombatants.map((cb) => {
              const char = characters.find((c) => c.id === cb.characterId);
              if (!char) return null;
              return (
                <button
                  key={cb.id}
                  type="button"
                  onClick={() => {
                    if (pendingHeal.isManual) {
                      const v = parseInt(manualHealInput, 10);
                      if (Number.isNaN(v)) return;
                      onApplyHeal(char.id, v);
                      setManualHealInput('');
                    } else {
                      onApplyHeal(char.id);
                    }
                  }}
                  className="min-h-[38px] rounded-lg bg-[#5f8240] px-3.5 text-xs font-semibold text-[#141a0d] hover:bg-[#77a352] shadow-sm transition-colors"
                >
                  Curar a {char.name} ({char.hp.current}/{char.hp.max})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de combatientes con colores diferenciados PJ vs PNJ */}
      {sortedCombatants.length === 0 ? (
        <div className="rounded-lg bg-[var(--arc-surface-alt)] p-6 text-center text-[13px] text-[var(--arc-muted)]">
          Todavía no hay combatientes en la mesa. Añadí PJs o PNJs arriba.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedCombatants.map((cb) => {
            const char = characters.find((c) => c.id === cb.characterId);
            if (!char) return null;
            const isActor = char.id === activeCharacterId;
            const isPJ = char.kind === 'mage';
            const hpPct =
              char.hp.max > 0 ? Math.max(0, Math.min(100, (char.hp.current / char.hp.max) * 100)) : 0;
            const manaPct =
              char.mana.max > 0
                ? Math.max(0, Math.min(100, (char.mana.current / char.mana.max) * 100))
                : 0;

            const cardColors = isPJ
              ? 'border-[#4a7545] bg-[#172216]'
              : 'border-[#824234] bg-[#251614]';

            const isDown =
              char.hp.current <= 0 ||
              (!char.ignoreManaUnconsciousness && char.mana.max > 0 && char.mana.current <= 0) ||
              char.condition !== 'active';
            const isActiveAttacker = Boolean(
              pendingAttack && !pendingAttack.resolved && cb.id === pendingAttack.attackerCombatantId
            );
            const isActiveDefender = Boolean(
              pendingAttack &&
                !pendingAttack.resolved &&
                cb.id === (defendingTargetId || pendingAttack.targetCombatantId)
            );
            const cbTurnStatus = getCombatantTurnActionStatus(cb);
            const isDirectDmgOpen = directDmgCombatantId === cb.id;
            const directMaxProt = isDirectDmgOpen
              ? getMaxAffordableProtectionStacks(char, spells, manaMode)
              : 0;
            const effectiveDirectProt = Math.min(directDmgProtStacks, directMaxProt);
            const directProtSummary = isDirectDmgOpen
              ? calcDirectProtectionSummary(char, spells, directDmgKind, effectiveDirectProt)
              : null;
            const directNetDmg = directProtSummary
              ? Math.max(0, directDmgAmount - directProtSummary.reduction)
              : directDmgAmount;

            const activeRoleRing = isActiveAttacker
              ? 'ring-2 ring-[var(--arc-atk-accent)]'
              : isActiveDefender
                ? 'ring-2 ring-[var(--arc-def-accent)]'
                : isActor
                  ? 'ring-1 ring-[#d4a843]'
                  : '';

            return (
              <div
                key={cb.id}
                className={`rounded-xl border p-4 space-y-3 transition-all ${cardColors} ${activeRoleRing} ${
                  isDown ? 'grayscale opacity-75' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          isPJ ? 'text-[#9ad489]' : 'text-[#f09a82]'
                        }`}
                      >
                        {isPJ ? 'PJ' : 'PNJ'}
                      </span>
                      {cb.isBotControlled && (
                        <span
                          title={`Controlado por la máquina (${cb.botDifficulty === 'tactical' ? 'Táctico' : 'Normal'})`}
                          className="inline-flex items-center gap-1 rounded border border-[var(--arc-accent)]/50 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--arc-accent)]"
                        >
                          <Bot className="h-3 w-3 shrink-0" />
                          Máquina
                        </span>
                      )}
                      <span className="text-base font-bold text-[#efe6d5]">{char.name}</span>
                      {isActiveAttacker && (
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--arc-atk-bg)] border border-[var(--arc-atk-border)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--arc-atk-accent)]">
                          <Swords className="h-3 w-3 shrink-0" />
                          Atacando
                        </span>
                      )}
                      {isActiveDefender && (
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--arc-def-bg)] border border-[var(--arc-def-border)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--arc-def-accent)]">
                          <Shield className="h-3 w-3 shrink-0" />
                          Defendiendo
                        </span>
                      )}
                      <span className="text-xs text-[#b0a084]">
                        · {conditionLabel(char.condition)}
                      </span>
                      {isActor && (
                        <span
                          className={`font-mono-num text-xs font-semibold ${
                            cbTurnStatus.remaining === 0 ? 'text-[#f0a83a]' : 'text-[#d4a843]'
                          }`}
                        >
                          · Acciones {cbTurnStatus.remaining}/{cbTurnStatus.max}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[#a3947e] font-mono-num">
                      Fís {getCharacterStatDice(char, 'fisico', formula)}d6 · Man{' '}
                      {getCharacterStatDice(char, 'manipulacion', formula)}d6 · Inf{' '}
                      {getCharacterStatDice(char, 'influencia', formula)}d6
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-xs text-[#a3947e] mr-1">
                      <span>Init</span>
                      <input
                        type="number"
                        value={cb.initiative}
                        onChange={(e) =>
                          onUpdateInitiative(cb.id, parseInt(e.target.value, 10) || 0)
                        }
                        aria-label={`Iniciativa de ${char.name}`}
                        className="font-mono-num w-14 min-h-[34px] rounded border border-[#433324] bg-[#120d09] px-1.5 text-center text-xs text-[#d4a843]"
                      />
                    </div>

                    {onToggleCombatantBot && (
                      <button
                        type="button"
                        onClick={() => onToggleCombatantBot(cb.id)}
                        title={
                          cb.isBotControlled
                            ? 'Pasar a control manual'
                            : 'Dejar que la máquina controle a este combatiente'
                        }
                        className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                          cb.isBotControlled
                            ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                            : 'border-transparent bg-transparent text-[#a3947e] hover:bg-white/10 hover:text-[#efe6d5]'
                        }`}
                      >
                        <Bot className="h-3.5 w-3.5 shrink-0" />
                        Bot
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectActor(char.id)}
                      className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        isActor
                          ? 'bg-[#d4a843] text-[#181209]'
                          : 'bg-transparent text-[#efe6d5] hover:bg-white/10'
                      }`}
                    >
                      {isActor ? 'Actuando' : 'Usar turno'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveFromCombat(cb.id)}
                      title="Quitar del combate"
                      aria-label={`Quitar a ${char.name} del combate`}
                      className="min-h-[34px] w-8 inline-flex items-center justify-center rounded-lg bg-transparent text-[#9c8b75] hover:bg-[#361912] hover:text-[#e88a70] transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Barras rápidas PV y Maná */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-mono-num">
                      <span className="text-[#d6c9b3] font-semibold">
                        PV {char.hp.current}/{char.hp.max}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[-5, -1, 1, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => onAdjustHp(char.id, d, false)}
                            className="min-h-[30px] min-w-[30px] rounded bg-transparent px-1.5 text-xs font-semibold text-[#d6c9b3] hover:bg-black/30 hover:text-white transition-colors"
                          >
                            {d > 0 ? `+${d}` : d}
                          </button>
                        ))}
                        {onApplyDirectDamageWithProtection && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isDirectDmgOpen) {
                                setDirectDmgCombatantId(null);
                              } else {
                                setDirectDmgCombatantId(cb.id);
                                setDirectDmgProtStacks(0);
                                setDirectDmgLabel('');
                              }
                            }}
                            title="Aplicar daño directo con opción rápida de Protección"
                            className={`min-h-[30px] inline-flex items-center gap-1 rounded px-2 text-xs font-sans font-semibold whitespace-nowrap shrink-0 transition-colors ${
                              isDirectDmgOpen
                                ? 'bg-[#1a3352] text-[#9fd2ff]'
                                : 'bg-transparent text-[#9fd2ff] hover:bg-black/30'
                            }`}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Daño / Prot.
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#120d09]">
                      <div className="h-full bg-[#d85a3a]" style={{ width: `${hpPct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono-num">
                      <span className="text-[#d6c9b3] font-semibold">
                        Maná {char.mana.current}/{char.mana.max}
                      </span>
                      <div className="flex gap-0.5">
                        {[-3, -1, 1, 3].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => onAdjustMana(char.id, d)}
                            className="min-h-[30px] min-w-[30px] rounded bg-transparent px-1.5 text-xs font-semibold text-[#d6c9b3] hover:bg-black/30 hover:text-white transition-colors"
                          >
                            {d > 0 ? `+${d}` : d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#120d09]">
                      <div className="h-full bg-[#5282d6]" style={{ width: `${manaPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Sub-sección plana de Daño directo con Protección */}
                {isDirectDmgOpen && onApplyDirectDamageWithProtection && directProtSummary && (
                  <div className="border-t border-white/10 pt-2.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#9fd2ff] inline-flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        Daño directo a {char.name} con Protección rápida
                      </span>
                      <button
                        type="button"
                        onClick={() => setDirectDmgCombatantId(null)}
                        className="rounded px-2 py-0.5 text-xs text-[#cbb893] hover:bg-black/30 hover:text-white transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor={`direct-dmg-${cb.id}`}
                          className="text-[#cbb893] font-medium"
                        >
                          Daño
                        </label>
                        <input
                          id={`direct-dmg-${cb.id}`}
                          type="number"
                          min={1}
                          max={999}
                          value={directDmgAmount}
                          onChange={(e) =>
                            setDirectDmgAmount(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="font-mono-num w-16 min-h-[34px] rounded-md border border-white/15 bg-black/35 px-2 text-center text-xs text-[#efe6d5]"
                        />
                      </div>

                      <div className="inline-flex rounded-lg bg-black/35 p-0.5">
                        <button
                          type="button"
                          onClick={() => setDirectDmgKind('magico')}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                            directDmgKind === 'magico'
                              ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)]'
                              : 'text-[#cbb893] hover:text-white'
                          }`}
                        >
                          Mágico (−3)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirectDmgKind('fisico')}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                            directDmgKind === 'fisico'
                              ? 'bg-[var(--arc-phys-raised)] text-[var(--arc-phys-text)]'
                              : 'text-[#cbb893] hover:text-white'
                          }`}
                        >
                          Físico (−5)
                        </button>
                      </div>

                      <div className="inline-flex items-center gap-1 rounded-lg bg-black/35 px-1.5 py-0.5">
                        <span className="text-[#9fd2ff] font-semibold pl-1">Prot.</span>
                        <button
                          type="button"
                          disabled={effectiveDirectProt <= 0}
                          onClick={() => setDirectDmgProtStacks((s) => Math.max(0, s - 1))}
                          aria-label={`Restar Protección para ${char.name}`}
                          className="h-7 w-7 rounded text-xs font-bold text-[#efe6d5] hover:bg-white/10 disabled:opacity-35 transition-colors"
                        >
                          −
                        </button>
                        <span className="font-mono-num min-w-[2rem] text-center font-bold text-[#9fd2ff]">
                          ×{effectiveDirectProt}
                        </span>
                        <button
                          type="button"
                          disabled={effectiveDirectProt >= directMaxProt}
                          onClick={() =>
                            setDirectDmgProtStacks((s) => Math.min(directMaxProt, s + 1))
                          }
                          aria-label={`Sumar Protección para ${char.name}`}
                          className="h-7 w-7 rounded text-xs font-bold text-[#efe6d5] hover:bg-white/10 disabled:opacity-35 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <input
                        type="text"
                        value={directDmgLabel}
                        onChange={(e) => setDirectDmgLabel(e.target.value)}
                        placeholder="Motivo (opcional)"
                        aria-label={`Motivo del daño directo para ${char.name}`}
                        className="flex-1 min-w-[130px] min-h-[34px] rounded-md border border-white/15 bg-black/35 px-2.5 text-xs text-[#efe6d5]"
                      />

                      <label className="inline-flex items-center gap-1.5 text-[#d6c9b3] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={directDmgLethal}
                          onChange={(e) => setDirectDmgLethal(e.target.checked)}
                          className="h-3.5 w-3.5 accent-[#d85a3a]"
                        />
                        <span>Letal</span>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono-num text-[#d6c9b3]">
                        Daño neto: <strong className="text-[#ffd28a]">{directNetDmg} PV</strong>
                        {effectiveDirectProt > 0 && (
                          <>
                            {' '}
                            (−{directProtSummary.reduction} por Protección · −
                            {directProtSummary.manaCost} maná)
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={directDmgAmount <= 0}
                        onClick={() => {
                          onApplyDirectDamageWithProtection({
                            combatantId: cb.id,
                            amount: directDmgAmount,
                            damageKind: directDmgKind,
                            lethal: directDmgLethal,
                            label: directDmgLabel,
                            protectionStacks: effectiveDirectProt,
                          });
                          setDirectDmgProtStacks(0);
                          setDirectDmgLabel('');
                        }}
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#b85a3a] px-3.5 text-xs font-semibold text-white hover:bg-[#cc6644] disabled:opacity-40 shadow-sm whitespace-nowrap shrink-0 transition-colors"
                      >
                        Aplicar daño ({directNetDmg} PV)
                      </button>
                    </div>
                  </div>
                )}

                {/* Hechizos preparados / activos (casteados en este turno o turnos anteriores) */}
                {cb.preparedSpells.length > 0 && (
                  <div className="border-t border-white/10 pt-2.5 space-y-1.5">
                    <span className="block text-xs font-semibold text-[var(--arc-magic-accent)]">
                      Hechizos preparados (listos para atacar en acción aparte):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {cb.preparedSpells.map((prep) => {
                        const prepSpell = spells.find((s) => s.id === prep.spellId);
                        const isPrepMagic = prepSpell ? isSpellMagical(prepSpell) : true;
                        const prepTurnStatus = getCombatantTurnActionStatus(cb);
                        const prepOutOfActions = prepTurnStatus.remaining <= 0;
                        const prepDepCheck = prepSpell
                          ? evaluateSpellDependency({
                              spell: prepSpell,
                              casterCharacterId: cb.characterId,
                              combatants,
                              characters,
                              targetCombatantId: selectedTargetId,
                            })
                          : null;
                        const cbEffectsForPrep = getCombatantStatusEffects(cb, char);
                        const prepStatusBlock = cbEffectsForPrep.cannotAttack
                          ? `Bloqueado (${cbEffectsForPrep.cannotAttackReasons.join(', ')})`
                          : isPrepMagic && cbEffectsForPrep.cannotCastMagic
                            ? `Silenciado (${cbEffectsForPrep.cannotCastMagicReasons.join(', ')})`
                            : null;
                        const prepBlockedByDep = Boolean(
                          prepDepCheck && prepDepCheck.hasDependency && !prepDepCheck.met
                        );
                        return (
                          <div
                            key={prep.id}
                            className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                              isPrepMagic
                                ? 'bg-[var(--arc-magic-bg)]'
                                : 'bg-[var(--arc-phys-bg)]'
                            }`}
                          >
                            <span
                              className={`font-semibold ${
                                isPrepMagic
                                  ? 'text-[var(--arc-magic-accent)]'
                                  : 'text-[var(--arc-phys-accent)]'
                              }`}
                            >
                              {prep.spellName}
                            </span>
                            <span className="text-[#9c8b75] font-mono-num">
                              (
                              {typeof prep.remainingTurns === 'number'
                                ? `${prep.remainingTurns}/${prep.durationTurns || prep.remainingTurns}t`
                                : prep.duration || 'activo'}{' '}
                              · R{prep.roundCast})
                            </span>
                            {prepStatusBlock || prepBlockedByDep ? (
                              <button
                                type="button"
                                disabled
                                title={
                                  prepStatusBlock ||
                                  prepDepCheck?.missingReason ||
                                  `Requiere: ${prepDepCheck?.requiredName}`
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-[var(--arc-raised)] px-2 py-1 text-xs font-semibold text-[#f3b562] opacity-85 cursor-not-allowed whitespace-nowrap shrink-0"
                              >
                                <Lock className="h-3 w-3 shrink-0" />
                                {prepStatusBlock || prepDepCheck?.missingReason || 'Bloqueado'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={prepOutOfActions}
                                title={
                                  prepOutOfActions
                                    ? 'Sin acciones restantes este turno — activá Hechizo Veloz o pasá el turno'
                                    : `Atacar con ${prep.spellName} (0 maná)`
                                }
                                onClick={() => onAttackWithPrepared(cb.id, prep)}
                                className="rounded-md bg-[var(--arc-action)] px-2.5 py-1 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Atacar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemovePrepared(cb.id, prep.id)}
                              aria-label={`Descartar ${prep.spellName}`}
                              className="text-[#9c8b75] hover:text-[#e88a70] px-1"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Buffs, Armaduras, Debuffs y Estados activos con contador de turnos */}
                {cb.activeStatuses && cb.activeStatuses.length > 0 && (() => {
                  const cancellableBuffCount = cb.activeStatuses.filter(
                    (st) =>
                      st.kind === 'buff' ||
                      st.kind === 'general' ||
                      (st.armorReduction || 0) > 0 ||
                      Boolean(st.armorElement) ||
                      (st.kind !== 'debuff' && typeof st.remainingTurns === 'number')
                  ).length;
                  const triggerElemTurn = onTriggerElementalTurn || onTriggerBurnTurn;
                  const cbStatusEffects = getCombatantStatusEffects(cb, char);
                  return (
                  <div className="border-t border-white/10 pt-2.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#cbb893]">
                        Buffs, Armaduras, Estados y Debuffs activos:
                      </span>
                      {onCancelCombatantBuffs && cancellableBuffCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onCancelCombatantBuffs(cb.id)}
                          title="Cancelar todos los hechizos por turno y buffs activos de este combatiente"
                          className="min-h-[26px] inline-flex items-center gap-1 rounded-md border border-[#6e3a2c] bg-[#2a1510] px-2 text-[11px] font-semibold text-[#ffb8a3] hover:bg-[#3d1e17] whitespace-nowrap shrink-0 transition-colors"
                        >
                          <XCircle className="h-3 w-3 shrink-0" />
                          Cancelar buffs ({cancellableBuffCount})
                        </button>
                      )}
                    </div>
                    {cbStatusEffects.summaryTags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[#633222] bg-[#22110c] px-2.5 py-1.5 text-[11px] text-[#ffd4c2]">
                        <span className="font-bold text-[#ff9a76]">Efectos mecánicos:</span>
                        {cbStatusEffects.summaryTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-black/35 px-1.5 py-0.5 font-semibold text-[#ffe4d6]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {cb.activeStatuses.map((st) => {
                        const elemKind = getStatusElementalKind(st);
                        const elemStacks = getStatusStackTurns(st);
                        const isElemental = Boolean(elemKind && elemStacks.length > 0);
                        const isCollateral = Boolean(st.collateralConfig);
                        const isBuff = st.kind === 'buff' || (st.armorReduction || 0) > 0;
                        const isDebuff = st.kind === 'debuff';
                        const hasTimer = typeof st.remainingTurns === 'number' || isElemental;
                        const isAboutToExpire = !isElemental && hasTimer && st.remainingTurns === 1;
                        const controlKey = !isElemental && !isCollateral
                          ? normalizeCombatStatusKey(st.name)
                          : null;
                        const mechanicId = elemKind
                          ? getElementalMechanicId(elemKind)
                          : controlKey
                            ? getControlMechanicId(controlKey)
                            : undefined;
                        const controlRuleHint = controlKey
                          ? formatStatusChipMechanics(st, char)
                          : null;

                        const chipColorClass = isElemental
                          ? elemKind === 'burn'
                            ? 'bg-[#2c140c] text-[#ffc4a3]'
                            : elemKind === 'poison'
                              ? 'bg-[#162614] text-[#c2f0ad]'
                              : elemKind === 'frozen'
                                ? 'bg-[#0f2330] text-[#b5e4ff]'
                                : elemKind === 'electrified'
                                  ? 'bg-[#29220a] text-[#ffe899]'
                                  : 'bg-[#2d1015] text-[#ffb8c2]'
                          : isCollateral
                            ? 'bg-[#29170b] text-[#ffd7bd]'
                            : isBuff
                              ? 'bg-[#112418] text-[#bff0cb]'
                              : isDebuff
                                ? 'bg-[#2a1510] text-[#ffc9b8]'
                                : 'bg-[#2a2112] text-[#f1d58a]';

                        return (
                          <span
                            key={st.id}
                            className={`inline-flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${chipColorClass}`}
                          >
                            {elemKind === 'burn' && <Flame className="h-3.5 w-3.5 text-[#ff8748]" />}
                            {elemKind === 'poison' && (
                              <Droplets className="h-3.5 w-3.5 text-[#7ee068]" />
                            )}
                            {elemKind === 'frozen' && (
                              <Snowflake className="h-3.5 w-3.5 text-[#7ad0ff]" />
                            )}
                            {elemKind === 'electrified' && (
                              <Zap className="h-3.5 w-3.5 text-[#ffd859]" />
                            )}
                            {elemKind === 'bleeding' && (
                              <Droplets className="h-3.5 w-3.5 text-[#ff6b81]" />
                            )}
                            {!isElemental && isCollateral && (
                              <AlertTriangle className="h-3.5 w-3.5 text-[#ff9d5c]" />
                            )}
                            {!isElemental && !isCollateral && isBuff && (
                              <ShieldPlus className="h-3.5 w-3.5 text-[#7ee098]" />
                            )}
                            {isElemental && elemKind && mechanicId && onInspectMechanic ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onInspectMechanic(mechanicId, {
                                    source: 'active-status',
                                    combatantId: cb.id,
                                    statusId: st.id,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs uppercase tracking-wide font-bold opacity-90 hover:underline"
                                aria-label={`Consultar ${ELEMENTAL_STATUS_META[elemKind].name}`}
                                title={`Consultar regla de ${ELEMENTAL_STATUS_META[elemKind].name}`}
                              >
                                {ELEMENTAL_STATUS_META[elemKind].name}
                                <BookOpen className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="text-xs uppercase tracking-wide opacity-80 font-bold">
                                {isElemental && elemKind
                                  ? ELEMENTAL_STATUS_META[elemKind].name
                                  : isCollateral
                                    ? 'Colateral'
                                    : isBuff
                                      ? 'Buff'
                                      : isDebuff
                                        ? 'Debuff'
                                        : 'Efecto'}
                              </span>
                            )}
                            {!isElemental &&
                              (mechanicId && onInspectMechanic ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onInspectMechanic(mechanicId, {
                                      source: 'active-status',
                                      combatantId: cb.id,
                                      statusId: st.id,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 font-bold hover:underline"
                                  aria-label={`Consultar ${st.name}`}
                                  title={`Consultar regla de ${st.name}`}
                                >
                                  {st.name}
                                  <BookOpen className="h-3 w-3" />
                                </button>
                              ) : (
                                <strong>{st.name}</strong>
                              ))}
                            {controlRuleHint && (
                              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] font-medium opacity-95">
                                {controlRuleHint}
                              </span>
                            )}
                            {controlKey === 'desarmar' && onRecoverDisarmedWeapon && (
                              <button
                                type="button"
                                disabled={
                                  cbTurnStatus.remaining <= 0 || cbStatusEffects.cannotAct
                                }
                                onClick={() => onRecoverDisarmedWeapon(cb.id)}
                                title={
                                  cbTurnStatus.remaining <= 0
                                    ? 'Necesita 1 acción disponible en su turno para recuperar arma/escudo'
                                    : cbStatusEffects.cannotAct
                                      ? `Bloqueado por ${cbStatusEffects.cannotActReasons.join(', ')}`
                                      : 'Gastar 1 acción del turno para recuperar el arma/escudo soltado'
                                }
                                className="rounded bg-[#7c4820] px-2 py-0.5 text-[11px] font-semibold text-[#fff2de] hover:bg-[#945829] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                              >
                                Recuperar arma (1 acc.)
                              </button>
                            )}
                            {controlKey === 'derribar' && onStandUpFromProne && (
                              <button
                                type="button"
                                disabled={cbStatusEffects.cannotAct || cbStatusEffects.mobility === 'zero'}
                                onClick={() => onStandUpFromProne(cb.id, st.id)}
                                title={
                                  cbStatusEffects.cannotAct || cbStatusEffects.mobility === 'zero'
                                    ? 'No puede levantarse mientras tiene movilidad 0 o está impedido'
                                    : 'Levantarse del suelo (retira Derribar)'
                                }
                                className="rounded bg-black/35 px-2 py-0.5 text-[11px] font-semibold hover:bg-black/55 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                              >
                                Levantarse
                              </button>
                            )}
                            {isCollateral && st.collateralConfig && (() => {
                              const pendingProt = Math.max(0, st.pendingProtectionStacks || 0);
                              const maxStatusProt = getMaxAffordableProtectionStacks(
                                char,
                                spells,
                                manaMode
                              );
                              const statusProtReduction =
                                pendingProt *
                                (st.collateralConfig.damageKind === 'magico' ? 3 : 5);
                              return (
                                <>
                                  <span className="font-mono-num text-xs text-[#ffbe94]">
                                    {formatCollateralValue(st.collateralConfig)}/t
                                  </span>
                                  {onAdjustStatusProtection && (
                                    <span
                                      className="inline-flex items-center gap-0.5 rounded bg-black/35 px-1 py-0.5 text-xs text-[#9fd2ff]"
                                      title="Preparar Protección (1 maná/uso) para mitigar el próximo golpe de este daño colateral"
                                    >
                                      <Shield className="h-3 w-3 shrink-0" />
                                      <button
                                        type="button"
                                        disabled={pendingProt <= 0}
                                        onClick={() => onAdjustStatusProtection(cb.id, st.id, -1)}
                                        aria-label={`Restar Protección en ${st.name}`}
                                        className="h-5 w-5 rounded hover:bg-white/10 disabled:opacity-35 leading-none"
                                      >
                                        −
                                      </button>
                                      <span className="font-mono-num px-0.5 font-semibold">
                                        ×{pendingProt}
                                        {pendingProt > 0 ? ` (−${statusProtReduction})` : ''}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={pendingProt >= maxStatusProt}
                                        onClick={() => onAdjustStatusProtection(cb.id, st.id, 1)}
                                        aria-label={`Sumar Protección en ${st.name}`}
                                        className="h-5 w-5 rounded hover:bg-white/10 disabled:opacity-35 leading-none"
                                      >
                                        +
                                      </button>
                                    </span>
                                  )}
                                  {onTriggerCollateralTurn && (
                                    <button
                                      type="button"
                                      onClick={() => onTriggerCollateralTurn(cb.id, st.id)}
                                      title="Aplicar daño colateral de inicio de turno ahora y descontar 1 turno"
                                      className="rounded bg-[#45200d] px-2 py-0.5 text-xs font-semibold text-[#ffd7bd] hover:bg-[#5e2c12] transition-colors"
                                    >
                                      Inicio turno
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                            {isElemental && elemKind && (() => {
                              const meta = ELEMENTAL_STATUS_META[elemKind];
                              const tickDie = st.tickDie ?? meta.defaultTickDie;
                              const tickKind = st.tickDamageKind || meta.defaultDamageKind;
                              const pendingProt = Math.max(0, st.pendingProtectionStacks || 0);
                              const maxStatusProt = getMaxAffordableProtectionStacks(
                                char,
                                spells,
                                manaMode
                              );
                              const protReduction = pendingProt * (tickKind === 'magico' ? 3 : 5);
                              const synergyBtn: {
                                reaction: Exclude<SynergyReactionType, 'none'>;
                                label: string;
                                title: string;
                                cls: string;
                              } =
                                elemKind === 'burn'
                                  ? {
                                      reaction: 'detonate_burn',
                                      label: 'Detonar (1 carga · 1d6)',
                                      title:
                                        'Reacción de sinergia: consume 1 carga de Quemadura (regla base) → 1d6 mágico explosivo',
                                      cls: 'bg-[#5c220c] text-[#ffe1cc] hover:bg-[#7a2e10]',
                                    }
                                  : elemKind === 'poison'
                                    ? {
                                        reaction: 'siphon_poison',
                                        label: 'Sifonar (1 carga · 1d4)',
                                        title:
                                          'Reacción de sinergia: consume 1 carga de Envenenado (regla base) → 1d4 + recupera PV y Maná al actor activo',
                                        cls: 'bg-[#1a4728] text-[#c7ffd9] hover:bg-[#246137]',
                                      }
                                    : elemKind === 'frozen'
                                      ? {
                                          reaction: 'shatter_frozen',
                                          label: 'Quebrar (1 carga · 1d8)',
                                          title:
                                            'Reacción de sinergia: consume 1 carga de Congelado (regla base) → 1d8 físico',
                                          cls: 'bg-[#153e59] text-[#d1f0ff] hover:bg-[#1e5578]',
                                        }
                                      : elemKind === 'electrified'
                                        ? {
                                            reaction: 'overload_electrified',
                                            label: 'Sobrecarga (1/objetivo · 1d6)',
                                            title:
                                              'Sobrecarga: consume 1 carga de cada combatiente Electrificado y causa 1d6 mágico por carga',
                                            cls: 'bg-[#54440e] text-[#fff0b3] hover:bg-[#705b14]',
                                          }
                                        : {
                                            reaction: 'hemorrhage_bleed',
                                            label: 'Desgarrar (1 carga · 1d6)',
                                            title:
                                              'Reacción de sinergia: consume 1 carga de Sangrando (regla base) → 1d6 físico',
                                            cls: 'bg-[#5c1622] text-[#ffd1d9] hover:bg-[#7a1e2e]',
                                          };

                              return (
                                <>
                                  <strong className="font-mono-num">
                                    {elemStacks.length}/{MAX_ELEMENTAL_STACKS}
                                    {tickDie ? ` (${elemStacks.length}${tickDie})` : ''}
                                  </strong>
                                  <span className="font-mono-num text-xs opacity-90">
                                    [{elemStacks.map((t) => `${t}t`).join(', ')}]
                                  </span>
                                  {tickDie && onAdjustStatusProtection && (
                                    <span
                                      className="inline-flex items-center gap-0.5 rounded bg-black/35 px-1 py-0.5 text-xs text-[#9fd2ff]"
                                      title={`Preparar Protección (1 maná = −${tickKind === 'magico' ? 3 : 5}) para el próximo inicio de turno`}
                                    >
                                      <Shield className="h-3 w-3 shrink-0" />
                                      <button
                                        type="button"
                                        disabled={pendingProt <= 0}
                                        onClick={() => onAdjustStatusProtection(cb.id, st.id, -1)}
                                        aria-label={`Restar Protección en ${meta.name}`}
                                        className="h-5 w-5 rounded hover:bg-white/10 disabled:opacity-35 leading-none"
                                      >
                                        −
                                      </button>
                                      <span className="font-mono-num px-0.5 font-semibold">
                                        ×{pendingProt}
                                        {pendingProt > 0 ? ` (−${protReduction})` : ''}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={pendingProt >= maxStatusProt}
                                        onClick={() => onAdjustStatusProtection(cb.id, st.id, 1)}
                                        aria-label={`Sumar Protección en ${meta.name}`}
                                        className="h-5 w-5 rounded hover:bg-white/10 disabled:opacity-35 leading-none"
                                      >
                                        +
                                      </button>
                                    </span>
                                  )}
                                  {tickDie && triggerElemTurn && (
                                    <button
                                      type="button"
                                      onClick={() => triggerElemTurn(cb.id, st.id)}
                                      title={`Aplicar daño de ${meta.name} al inicio del turno y descontar 1 turno`}
                                      className="rounded bg-black/35 px-2 py-0.5 text-xs font-semibold hover:bg-black/55 whitespace-nowrap shrink-0 transition-colors"
                                    >
                                      Inicio turno ({elemStacks.length}
                                      {tickDie})
                                    </button>
                                  )}
                                  {onTriggerSynergyReaction && (
                                    <span className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onTriggerSynergyReaction(cb.id, synergyBtn.reaction)
                                        }
                                        title={synergyBtn.title}
                                        className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${synergyBtn.cls}`}
                                      >
                                        {synergyBtn.label}
                                      </button>
                                      {onInspectMechanic && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onInspectMechanic(
                                              getSynergyMechanicId(synergyBtn.reaction),
                                              {
                                                source: 'reaction',
                                                combatantId: cb.id,
                                                statusId: st.id,
                                              }
                                            )
                                          }
                                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-black/30 text-current hover:bg-black/50"
                                          aria-label={`Consultar ${synergyBtn.label}`}
                                          title={`Consultar regla de ${synergyBtn.label}`}
                                        >
                                          <BookOpen className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            {(st.armorReduction || 0) > 0 && (
                              <span className="font-mono-num text-xs text-[#8ee0a4]">
                                Red. +{st.armorReduction}
                              </span>
                            )}
                            {st.armorDivisor !== undefined && st.armorDivisor !== 1 && (
                              <span className="font-mono-num text-xs text-[#8ee0a4]">
                                {st.armorDivisor === 0 ? 'Anula' : `÷${st.armorDivisor}`}
                              </span>
                            )}
                            {typeof st.remainingHits === 'number' && (
                              <span
                                className={`inline-flex items-center gap-0.5 rounded bg-black/30 px-1.5 py-0.5 font-mono-num text-xs ${
                                  st.remainingHits <= 1
                                    ? 'text-[#ffd07a] font-bold'
                                    : 'text-[#9fd2ff] font-semibold'
                                }`}
                                title="Golpes restantes antes de que se rompa o disipe"
                              >
                                <Shield className="h-3 w-3 shrink-0" />
                                <span>
                                  {st.remainingHits}/{st.maxHits || st.remainingHits}g
                                </span>
                                {onAdjustStatusHits && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onAdjustStatusHits(cb.id, st.id, -1)}
                                      title="Restar 1 golpe (se rompe si llega a 0)"
                                      aria-label={`Restar 1 golpe a ${st.name}`}
                                      className="h-5 w-5 rounded text-xs leading-none hover:bg-white/15 transition-colors ml-0.5"
                                    >
                                      −
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onAdjustStatusHits(cb.id, st.id, 1)}
                                      title="Sumar 1 golpe de resistencia"
                                      aria-label={`Sumar 1 golpe a ${st.name}`}
                                      className="h-5 w-5 rounded text-xs leading-none hover:bg-white/15 transition-colors"
                                    >
                                      +
                                    </button>
                                  </>
                                )}
                              </span>
                            )}
                            {!isElemental && (
                              <span
                                className={`font-mono-num text-xs ${
                                  isAboutToExpire ? 'text-[#ffd07a] font-bold' : 'opacity-85'
                                }`}
                              >
                                {hasTimer
                                  ? `${st.remainingTurns}/${st.durationTurns || st.remainingTurns}t`
                                  : st.duration || 'activo'}
                              </span>
                            )}
                            {hasTimer && onAdjustStatusTurns && (
                              <span className="inline-flex items-center gap-0.5 ml-0.5">
                                <button
                                  type="button"
                                  onClick={() => onAdjustStatusTurns(cb.id, st.id, -1)}
                                  title="Restar 1 turno (disipar si llega a 0)"
                                  aria-label={`Restar 1 turno a ${st.name}`}
                                  className="h-6 w-6 rounded text-xs leading-none hover:bg-black/30 transition-colors"
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAdjustStatusTurns(cb.id, st.id, 1)}
                                  title="Sumar 1 turno"
                                  aria-label={`Sumar 1 turno a ${st.name}`}
                                  className="h-6 w-6 rounded text-xs leading-none hover:bg-black/30 transition-colors"
                                >
                                  +
                                </button>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemoveCombatantStatus(cb.id, st.id)}
                              title={`Cancelar / disipar ${st.name}`}
                              aria-label={`Cancelar ${st.name}`}
                              className="inline-flex items-center gap-0.5 rounded bg-black/25 px-1.5 py-0.5 text-[11px] font-semibold opacity-85 hover:bg-[#5c2015] hover:text-[#ffd2c4] hover:opacity-100 ml-0.5 whitespace-nowrap shrink-0 transition-colors"
                            >
                              Cancelar ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}