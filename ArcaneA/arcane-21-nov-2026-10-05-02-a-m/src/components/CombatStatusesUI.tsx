import { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Check,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ActiveStatus,
  Character,
  CombatStatusKey,
  Combatant,
  DamageKind,
  DieType,
  EffectSubType,
  ElementalStatusKind,
  ManualStatusPayload,
  SynergyReactionType,
} from '../types/rpg';
import {
  COMBAT_STATUS_MECHANICS,
  DIE_TYPES,
  ELEMENTAL_STATUS_META,
  MAX_ELEMENTAL_STACKS,
  formatStatusChipMechanics,
  getCombatantStatusEffects,
  getStatusElementalKind,
  getStatusStackTurns,
  normalizeCombatStatusKey,
} from '../utils/dice';
import {
  getControlMechanicId,
  getElementalMechanicId,
  getSynergyMechanicId,
  type CombatMechanicId,
} from '../utils/combatMechanics';
import { CombatMechanicsCompendium } from './CombatMechanicsCompendium';
import type { CombatMechanicContext } from './CombatMechanicReader';

interface CombatStatusesUIProps {
  combatants: Combatant[];
  characters: Character[];
  selectedTargetId?: string;
  onApplyManualStatus: (payload: ManualStatusPayload) => void;
  onUpdateCombatantStatus: (
    combatantId: string,
    statusId: string,
    updates: Partial<Pick<ActiveStatus, 'autoFails' | 'endsOnHit' | 'remainingTurns' | 'duration'>>
  ) => void;
  onRemoveCombatantStatus: (combatantId: string, statusId: string) => void;
  onAdjustStatusTurns: (combatantId: string, statusId: string, delta: number) => void;
  onRecoverDisarmedWeapon: (combatantId: string) => void;
  onStandUpFromProne: (combatantId: string, statusId: string) => void;
  onTriggerSynergyReaction?: (
    targetCombatantId: string,
    reaction: SynergyReactionType
  ) => void;
  onInspectMechanic?: (
    mechanicId: CombatMechanicId,
    context: CombatMechanicContext
  ) => void;
}

type StatusSubTab = 'active' | 'apply' | 'reference';
type ActiveFilter = 'all' | 'with_status' | 'control' | 'elemental' | 'buff_other';

const CONTROL_KEYS: CombatStatusKey[] = [
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

const ELEMENTAL_KEYS: ElementalStatusKind[] = [
  'burn',
  'poison',
  'frozen',
  'electrified',
  'bleeding',
];

function getSynergyActionForElemental(kind: ElementalStatusKind): {
  reaction: Exclude<SynergyReactionType, 'none'>;
  label: string;
} {
  switch (kind) {
    case 'burn':
      return { reaction: 'detonate_burn', label: 'Detonar (1 carga · 1d6)' };
    case 'poison':
      return { reaction: 'siphon_poison', label: 'Sifonar (1 carga · 1d4)' };
    case 'frozen':
      return { reaction: 'shatter_frozen', label: 'Quebrar (1 carga · 1d8)' };
    case 'electrified':
      return { reaction: 'overload_electrified', label: 'Sobrecarga (1/objetivo · 1d6)' };
    case 'bleeding':
      return { reaction: 'hemorrhage_bleed', label: 'Desgarrar (1 carga · 1d6)' };
  }
}

export function CombatStatusesUI({
  combatants,
  characters,
  selectedTargetId,
  onApplyManualStatus,
  onUpdateCombatantStatus,
  onRemoveCombatantStatus,
  onAdjustStatusTurns,
  onRecoverDisarmedWeapon,
  onStandUpFromProne,
  onTriggerSynergyReaction,
  onInspectMechanic,
}: CombatStatusesUIProps) {
  const [subTab, setSubTab] = useState<StatusSubTab>('active');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [activeSearch, setActiveSearch] = useState('');
  const [editingStatusKey, setEditingStatusKey] = useState<string | null>(null);
  const [editAutoFails, setEditAutoFails] = useState<number>(1);
  const [editUntilHit, setEditUntilHit] = useState<boolean>(true);
  const [editTurns, setEditTurns] = useState<number>(1);

  // Estado del formulario "Aplicar estado"
  const [targetId, setTargetId] = useState<string>('');
  const [applyMode, setApplyMode] = useState<'control' | 'elemental' | 'custom'>('control');
  const [selectedControl, setSelectedControl] = useState<CombatStatusKey>('aturdir');
  const [controlAutoFails, setControlAutoFails] = useState<number>(1);
  const [controlUntilHit, setControlUntilHit] = useState<boolean>(true);
  const [controlTurns, setControlTurns] = useState<number>(1);
  const [includeProneOnPush, setIncludeProneOnPush] = useState<boolean>(true);

  const [selectedElemental, setSelectedElemental] = useState<ElementalStatusKind>('burn');
  const [elemStacks, setElemStacks] = useState<number>(1);
  const [elemTurns, setElemTurns] = useState<number>(2);
  const [elemTickDie, setElemTickDie] = useState<DieType | 'none'>('d4');
  const [elemDamageKind, setElemDamageKind] = useState<DamageKind>('magico');

  const [customName, setCustomName] = useState<string>('');
  const [customKind, setCustomKind] = useState<EffectSubType | 'status'>('debuff');
  const [customTurns, setCustomTurns] = useState<number>(2);
  const [customDesc, setCustomDesc] = useState<string>('');
  const [customIsMagical, setCustomIsMagical] = useState<boolean>(true);

  const charMap = useMemo(() => {
    const m = new Map<string, Character>();
    characters.forEach((c) => m.set(c.id, c));
    return m;
  }, [characters]);

  const resolvedTargetId = useMemo(() => {
    if (targetId && combatants.some((c) => c.id === targetId)) return targetId;
    if (selectedTargetId && combatants.some((c) => c.id === selectedTargetId)) {
      return selectedTargetId;
    }
    return combatants[0]?.id || '';
  }, [combatants, selectedTargetId, targetId]);

  const resolvedTargetCb = combatants.find((c) => c.id === resolvedTargetId);
  const resolvedTargetChar = resolvedTargetCb
    ? charMap.get(resolvedTargetCb.characterId)
    : undefined;

  const summaryCounts = useMemo(() => {
    let total = 0;
    let control = 0;
    let elemental = 0;
    let other = 0;
    combatants.forEach((cb) => {
      (cb.activeStatuses || []).forEach((st) => {
        total += 1;
        if (normalizeCombatStatusKey(st.name)) control += 1;
        else if (getStatusElementalKind(st)) elemental += 1;
        else other += 1;
      });
    });
    return { total, control, elemental, other };
  }, [combatants]);

  const selectControlKey = (key: CombatStatusKey) => {
    setSelectedControl(key);
    const meta = COMBAT_STATUS_MECHANICS[key];
    setControlAutoFails(meta.defaultAutoFails || 1);
    setControlUntilHit(Boolean(meta.defaultUntilHit));
    setControlTurns(key === 'desarmar' ? 0 : 1);
  };

  const selectElementalKey = (kind: ElementalStatusKind) => {
    setSelectedElemental(kind);
    const meta = ELEMENTAL_STATUS_META[kind];
    setElemTurns(meta.defaultDuration);
    setElemTickDie(meta.defaultTickDie ?? 'none');
    setElemDamageKind(meta.defaultDamageKind);
  };

  const handleSubmitManualStatus = () => {
    if (!resolvedTargetId) return;

    if (applyMode === 'control') {
      const meta = COMBAT_STATUS_MECHANICS[selectedControl];
      onApplyManualStatus({
        targetCombatantId: resolvedTargetId,
        mode: 'control',
        statusName: meta.canonicalName,
        controlKey: selectedControl,
        kind: 'status',
        autoFails: meta.supportsAutoFails || selectedControl === 'empujar' ? controlAutoFails : undefined,
        untilHit: selectedControl === 'aturdir' ? controlUntilHit : undefined,
        durationTurns:
          selectedControl === 'desarmar'
            ? undefined
            : selectedControl === 'aturdir' && controlUntilHit
              ? undefined
              : Math.max(1, controlTurns),
        includeProneOnPush: selectedControl === 'empujar' ? includeProneOnPush : undefined,
        isMagical: false,
      });
      setSubTab('active');
      return;
    }

    if (applyMode === 'elemental') {
      const meta = ELEMENTAL_STATUS_META[selectedElemental];
      onApplyManualStatus({
        targetCombatantId: resolvedTargetId,
        mode: 'elemental',
        statusName: meta.name,
        elementalKind: selectedElemental,
        stacks: Math.max(1, Math.min(MAX_ELEMENTAL_STACKS, elemStacks)),
        durationTurns: Math.max(1, elemTurns),
        tickDie: elemTickDie,
        damageKind: elemDamageKind,
        isMagical: elemDamageKind === 'magico',
      });
      setSubTab('active');
      return;
    }

    const cleanName = customName.trim();
    if (!cleanName) return;
    onApplyManualStatus({
      targetCombatantId: resolvedTargetId,
      mode: 'custom',
      statusName: cleanName,
      kind: customKind,
      durationTurns: customTurns > 0 ? customTurns : undefined,
      effectDescription: customDesc.trim() || undefined,
      isMagical: customIsMagical,
    });
    setCustomName('');
    setCustomDesc('');
    setSubTab('active');
  };

  const startInlineEdit = (cbId: string, st: ActiveStatus) => {
    setEditingStatusKey(`${cbId}:${st.id}`);
    setEditAutoFails(st.autoFails ?? 1);
    setEditUntilHit(Boolean(st.endsOnHit));
    setEditTurns(st.remainingTurns && st.remainingTurns > 0 ? st.remainingTurns : 1);
  };

  const saveInlineEdit = (cbId: string, st: ActiveStatus) => {
    const cKey = normalizeCombatStatusKey(st.name);
    const meta = cKey ? COMBAT_STATUS_MECHANICS[cKey] : undefined;
    const updates: Partial<Pick<ActiveStatus, 'autoFails' | 'endsOnHit' | 'remainingTurns' | 'duration'>> = {};
    if (meta?.supportsAutoFails) {
      updates.autoFails = Math.max(1, Math.min(6, editAutoFails || 1));
    }
    if (cKey === 'aturdir') {
      updates.endsOnHit = editUntilHit;
      if (editUntilHit) {
        updates.remainingTurns = undefined;
        updates.duration = 'Hasta recibir 1 golpe';
      } else {
        const safeTurns = Math.max(1, Math.min(20, editTurns || 1));
        updates.remainingTurns = safeTurns;
        updates.duration = `${safeTurns} ${safeTurns === 1 ? 'turno' : 'turnos'}`;
      }
    } else if (cKey !== 'desarmar') {
      const safeTurns = Math.max(0, Math.min(20, editTurns || 0));
      updates.remainingTurns = safeTurns > 0 ? safeTurns : undefined;
      updates.duration =
        safeTurns > 0 ? `${safeTurns} ${safeTurns === 1 ? 'turno' : 'turnos'}` : 'Hasta ser disipado';
    }
    onUpdateCombatantStatus(cbId, st.id, updates);
    setEditingStatusKey(null);
  };

  const filteredCombatants = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    return combatants
      .map((cb) => {
        const ch = charMap.get(cb.characterId);
        const statuses = (cb.activeStatuses || []).filter((st) => {
          const isCtrl = Boolean(normalizeCombatStatusKey(st.name));
          const isElem = Boolean(getStatusElementalKind(st));
          if (activeFilter === 'control' && !isCtrl) return false;
          if (activeFilter === 'elemental' && !isElem) return false;
          if (activeFilter === 'buff_other' && (isCtrl || isElem)) return false;
          if (q) {
            const hay = `${ch?.name || ''} ${st.name} ${st.effectDescription || ''}`.toLowerCase();
            return hay.includes(q);
          }
          return true;
        });
        return { cb, ch, statuses };
      })
      .filter(({ cb, ch, statuses }) => {
        if (!ch) return false;
        if (activeFilter === 'with_status') return (cb.activeStatuses || []).length > 0;
        if (activeFilter === 'control' || activeFilter === 'elemental' || activeFilter === 'buff_other') {
          return statuses.length > 0;
        }
        if (q) {
          return ch.name.toLowerCase().includes(q) || statuses.length > 0;
        }
        return true;
      });
  }, [activeFilter, activeSearch, charMap, combatants]);

  const selectedControlMeta = COMBAT_STATUS_MECHANICS[selectedControl];
  const targetImmuneToSelectedBlind =
    applyMode === 'control' &&
    selectedControl === 'cegar' &&
    Boolean(resolvedTargetChar?.immuneToBlind);

  return (
    <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 space-y-4">
      {/* Encabezado y conmutador de vistas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--arc-border)] pb-3">
        <div>
          <h3 className="font-display text-base font-bold text-[var(--arc-accent)]">
            Gestión de Estados en Combate
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--arc-muted)] tabular-nums">
            <span>{summaryCounts.total} activos</span>
            <span aria-hidden="true">·</span>
            <span>{summaryCounts.control} control</span>
            <span aria-hidden="true">·</span>
            <span>{summaryCounts.elemental} elementales</span>
            <span aria-hidden="true">·</span>
            <span>{summaryCounts.other} buffs / otros</span>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[var(--arc-input)] p-1">
          <button
            type="button"
            onClick={() => setSubTab('active')}
            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'active'
                ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Activos ({summaryCounts.total})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('apply')}
            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'apply'
                ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Aplicar estado
          </button>
          <button
            type="button"
            onClick={() => setSubTab('reference')}
            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'reference'
                ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Reglas
          </button>
        </div>
      </div>

      {/* VISTA 1: ACTIVOS EN COMBATE */}
      {subTab === 'active' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[var(--arc-input)] p-1">
              {(
                [
                  ['all', 'Todos'],
                  ['with_status', 'Con estados'],
                  ['control', 'Control'],
                  ['elemental', 'Elementales'],
                  ['buff_other', 'Buffs / Otros'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className={`min-h-[30px] rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    activeFilter === key
                      ? 'bg-[var(--arc-raised)] text-[var(--arc-text)]'
                      : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px] flex-1 sm:max-w-[260px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--arc-muted)]" />
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
                placeholder="Buscar combatiente o estado..."
                className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] pl-8 pr-3 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
              />
            </div>
          </div>

          {combatants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--arc-border)] px-4 py-6 text-center space-y-2">
              <p className="text-sm font-medium text-[var(--arc-text)]">
                No hay combatientes en la mesa todavía.
              </p>
              <p className="text-xs text-[var(--arc-muted)]">
                Sumá personajes o enemigos a la Mesa de Combate para gestionar sus estados, penalizaciones y duraciones desde aquí.
              </p>
            </div>
          ) : filteredCombatants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--arc-border)] px-4 py-6 text-center space-y-2">
              <p className="text-sm font-medium text-[var(--arc-text)]">
                Ningún combatiente coincide con el filtro actual.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setActiveSearch('');
                }}
                className="min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--arc-border)] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)]/40">
              {filteredCombatants.map(({ cb, ch, statuses }) => {
                if (!ch) return null;
                const fx = getCombatantStatusEffects(cb, ch);
                const mobilityLabel =
                  fx.mobility === 'zero'
                    ? 'Movilidad 0'
                    : fx.mobility === 'half'
                      ? 'Movilidad ½'
                      : 'Movilidad normal';
                const reactionLabel = fx.cannotReact ? 'Reacción 0' : 'Reacción activa';

                return (
                  <div key={cb.id} className="p-3.5 space-y-2.5">
                    {/* Cabecera del combatiente + resumen mecánico limpio */}
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-bold text-[var(--arc-text)]">{ch.name}</span>
                        <span className="font-mono-num text-xs text-[var(--arc-muted)]">
                          PV {ch.hp.current}/{ch.hp.max} · Maná {ch.mana.current}/{ch.mana.max}
                        </span>
                        {ch.immuneToBlind && (
                          <span className="text-xs text-[var(--arc-accent)]">
                            · Inmune a Cegar
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
                        <span
                          className={
                            fx.mobility === 'zero'
                              ? 'font-semibold text-[#fca5a5]'
                              : fx.mobility === 'half'
                                ? 'font-semibold text-[#fbbf24]'
                                : 'text-[var(--arc-muted)]'
                          }
                        >
                          {mobilityLabel}
                        </span>
                        <span aria-hidden="true" className="text-[var(--arc-muted)]">
                          ·
                        </span>
                        <span
                          className={
                            fx.cannotReact
                              ? 'font-semibold text-[#fca5a5]'
                              : 'text-[var(--arc-muted)]'
                          }
                        >
                          {reactionLabel}
                        </span>
                        {fx.incomingAutoCrit && (
                          <>
                            <span aria-hidden="true" className="text-[var(--arc-muted)]">
                              ·
                            </span>
                            <span className="font-semibold text-[#fca5a5]">
                              Crítico entrante automático
                            </span>
                          </>
                        )}
                        {fx.disarmed && (
                          <>
                            <span aria-hidden="true" className="text-[var(--arc-muted)]">
                              ·
                            </span>
                            <span className="font-semibold text-[#fbbf24]">Desarmado</span>
                          </>
                        )}
                        {(fx.autoFailsAttack > 0 ||
                          fx.autoFailsDefense > 0 ||
                          fx.autoFailsInfluence > 0) && (
                          <>
                            <span aria-hidden="true" className="text-[var(--arc-muted)]">
                              ·
                            </span>
                            <span className="font-semibold text-[#fbbf24]">
                              Fallos auto:{' '}
                              {[
                                fx.autoFailsAttack > 0 ? `Atq +${fx.autoFailsAttack}` : '',
                                fx.autoFailsDefense > 0 ? `Def +${fx.autoFailsDefense}` : '',
                                fx.autoFailsInfluence > 0 ? `Inf +${fx.autoFailsInfluence}` : '',
                              ]
                                .filter(Boolean)
                                .join(' / ')}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setTargetId(cb.id);
                            setSubTab('apply');
                          }}
                          className="ml-1 inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0"
                        >
                          <Plus className="h-3 w-3" />
                          Agregar
                        </button>
                      </div>
                    </div>

                    {/* Lista de estados activos del combatiente */}
                    {statuses.length === 0 ? (
                      <p className="text-xs text-[var(--arc-muted)]">
                        Sin estados activos en este combatiente.
                      </p>
                    ) : (
                      <div className="divide-y divide-[var(--arc-border)]/70 border-t border-[var(--arc-border)]/70">
                        {statuses.map((st) => {
                          const cKey = normalizeCombatStatusKey(st.name);
                          const elemKind = getStatusElementalKind(st);
                          const elemStacks = elemKind ? getStatusStackTurns(st) : [];
                          const mechText = formatStatusChipMechanics(st, ch);
                          const rowKey = `${cb.id}:${st.id}`;
                          const isEditing = editingStatusKey === rowKey;
                          const canInlineEdit = Boolean(cKey && cKey !== 'desarmar');
                          const mechanicId = elemKind
                            ? getElementalMechanicId(elemKind)
                            : cKey
                              ? getControlMechanicId(cKey)
                              : undefined;
                          const categoryLabel = cKey
                            ? 'Control'
                            : elemKind
                              ? 'Elemental'
                              : st.kind === 'buff'
                                ? 'Buff'
                                : st.kind === 'debuff'
                                  ? 'Debuff'
                                  : 'Estado';

                          return (
                            <div key={st.id} className="py-2.5 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                                    {mechanicId && onInspectMechanic ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onInspectMechanic(mechanicId, {
                                            source: 'active-status',
                                            combatantId: cb.id,
                                            statusId: st.id,
                                          })
                                        }
                                        className="inline-flex min-h-[24px] items-center gap-1 font-bold text-[var(--arc-text)] hover:text-[var(--arc-accent)]"
                                        aria-label={`Consultar ${st.name}`}
                                        title={`Consultar regla de ${st.name}`}
                                      >
                                        {st.name}
                                        <BookOpen className="h-3 w-3 text-[var(--arc-accent)]" />
                                      </button>
                                    ) : (
                                      <span className="font-bold text-[var(--arc-text)]">
                                        {st.name}
                                      </span>
                                    )}
                                    <span className="text-[var(--arc-muted)]">{categoryLabel}</span>
                                    <span aria-hidden="true" className="text-[var(--arc-muted)]">
                                      ·
                                    </span>
                                    <span className="font-mono-num text-[var(--arc-text)]">
                                      {elemKind && elemStacks.length > 0
                                        ? `${elemStacks.length}/${MAX_ELEMENTAL_STACKS} cargas [${elemStacks.map((t) => `${t}t`).join(', ')}]`
                                        : st.endsOnHit
                                          ? 'Hasta recibir 1 golpe'
                                          : st.remainingTurns !== undefined
                                            ? `${st.remainingTurns} ${st.remainingTurns === 1 ? 'turno' : 'turnos'}`
                                            : st.duration || 'Sin límite de turnos'}
                                    </span>
                                    {st.sourceName && st.sourceName !== st.name && (
                                      <>
                                        <span aria-hidden="true" className="text-[var(--arc-muted)]">
                                          ·
                                        </span>
                                        <span className="text-[var(--arc-muted)]">
                                          Origen: {st.sourceName}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {(mechText || st.effectDescription) && (
                                    <p className="mt-0.5 text-xs text-[var(--arc-muted)]">
                                      {mechText || st.effectDescription}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  {cKey === 'desarmar' && (
                                    <button
                                      type="button"
                                      onClick={() => onRecoverDisarmedWeapon(cb.id)}
                                      className="min-h-[30px] rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0"
                                    >
                                      Recuperar arma (1 acc.)
                                    </button>
                                  )}

                                  {cKey === 'derribar' && (
                                    <button
                                      type="button"
                                      onClick={() => onStandUpFromProne(cb.id, st.id)}
                                      className="min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2.5 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0"
                                    >
                                      Levantarse
                                    </button>
                                  )}

                                  {elemKind && elemStacks.length > 0 && onTriggerSynergyReaction && (() => {
                                    const syn = getSynergyActionForElemental(elemKind);
                                    return (
                                      <span className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onTriggerSynergyReaction(cb.id, syn.reaction)
                                          }
                                          className="min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0"
                                        >
                                          {syn.label}
                                        </button>
                                        {onInspectMechanic && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onInspectMechanic(
                                                getSynergyMechanicId(syn.reaction),
                                                {
                                                  source: 'reaction',
                                                  combatantId: cb.id,
                                                  statusId: st.id,
                                                }
                                              )
                                            }
                                            className="inline-flex min-h-[30px] w-8 items-center justify-center rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-muted)] hover:text-[var(--arc-accent)]"
                                            aria-label={`Consultar ${syn.label}`}
                                            title={`Consultar regla de ${syn.label}`}
                                          >
                                            <BookOpen className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </span>
                                    );
                                  })()}

                                  {(st.remainingTurns !== undefined ||
                                    (elemKind && elemStacks.length > 0)) && (
                                    <div className="inline-flex items-center rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)]">
                                      <button
                                        type="button"
                                        onClick={() => onAdjustStatusTurns(cb.id, st.id, -1)}
                                        title={elemKind ? 'Quitar 1 carga' : 'Restar 1 turno'}
                                        className="min-h-[30px] px-2 text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onAdjustStatusTurns(cb.id, st.id, 1)}
                                        title={elemKind ? 'Sumar 1 carga' : 'Sumar 1 turno'}
                                        className="min-h-[30px] border-l border-[var(--arc-border)] px-2 text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}

                                  {canInlineEdit && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        isEditing
                                          ? setEditingStatusKey(null)
                                          : startInlineEdit(cb.id, st)
                                      }
                                      className="min-h-[30px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs font-medium text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0"
                                    >
                                      <SlidersHorizontal className="h-3 w-3" />
                                      Ajustar
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => onRemoveCombatantStatus(cb.id, st.id)}
                                    title="Quitar o disipar este estado"
                                    className="min-h-[30px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs font-medium text-[#fca5a5] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Quitar
                                  </button>
                                </div>
                              </div>

                              {/* Editor rápido en línea */}
                              {isEditing && cKey && (
                                <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-3 py-2 text-xs">
                                  {COMBAT_STATUS_MECHANICS[cKey].supportsAutoFails && (
                                    <label className="inline-flex items-center gap-1.5">
                                      <span className="text-[var(--arc-muted)]">Fallos auto.:</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={6}
                                        value={editAutoFails}
                                        onChange={(e) =>
                                          setEditAutoFails(
                                            Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1))
                                          )
                                        }
                                        className="font-mono-num w-14 min-h-[30px] rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)]"
                                      />
                                    </label>
                                  )}

                                  {cKey === 'aturdir' && (
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editUntilHit}
                                        onChange={(e) => setEditUntilHit(e.target.checked)}
                                        className="h-3.5 w-3.5 accent-[var(--arc-accent)]"
                                      />
                                      <span>Termina al recibir 1 golpe</span>
                                    </label>
                                  )}

                                  {(cKey !== 'aturdir' || !editUntilHit) && (
                                    <label className="inline-flex items-center gap-1.5">
                                      <span className="text-[var(--arc-muted)]">Turnos:</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={editTurns}
                                        onChange={(e) =>
                                          setEditTurns(
                                            Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0))
                                          )
                                        }
                                        className="font-mono-num w-14 min-h-[30px] rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)]"
                                      />
                                    </label>
                                  )}

                                  <div className="ml-auto flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => saveInlineEdit(cb.id, st)}
                                      className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)]"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingStatusKey(null)}
                                      className="min-h-[30px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] px-2 text-xs text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: APLICAR ESTADO MANUAL */}
      {subTab === 'apply' && (
        <div className="space-y-4">
          {combatants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--arc-border)] px-4 py-6 text-center text-xs text-[var(--arc-muted)]">
              Agregá al menos un combatiente a la mesa para poder aplicar estados.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="manual-status-target"
                    className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
                  >
                    Objetivo en combate
                  </label>
                  <select
                    id="manual-status-target"
                    value={resolvedTargetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full min-h-[38px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs text-[var(--arc-text)]"
                  >
                    {combatants.map((cb) => {
                      const ch = charMap.get(cb.characterId);
                      if (!ch) return null;
                      return (
                        <option key={cb.id} value={cb.id}>
                          {ch.name} (PV {ch.hp.current}/{ch.hp.max})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[var(--arc-muted)] mb-1">
                    Tipo de estado
                  </span>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-[var(--arc-input)] p-1">
                    {(
                      [
                        ['control', 'Control'],
                        ['elemental', 'Elemental'],
                        ['custom', 'Personalizado'],
                      ] as const
                    ).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setApplyMode(m)}
                        className={`min-h-[30px] rounded text-xs font-semibold transition-colors ${
                          applyMode === m
                            ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                            : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {applyMode === 'control' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
                    {CONTROL_KEYS.map((key) => {
                      const meta = COMBAT_STATUS_MECHANICS[key];
                      const active = selectedControl === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => selectControlKey(key)}
                          className={`min-h-[36px] rounded-md border px-2.5 text-xs font-semibold text-left transition-colors ${
                            active
                              ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                              : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]/60'
                          }`}
                        >
                          {meta.canonicalName}
                        </button>
                      );
                    })}
                  </div>

                  {/* Vista previa mecánica y parámetros */}
                  <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)]/50 p-3.5 space-y-3">
                    <div>
                      <div className="text-xs font-bold text-[var(--arc-text)]">
                        {selectedControlMeta.canonicalName}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--arc-muted)]">
                        {selectedControlMeta.detailedRule}
                      </p>
                      {targetImmuneToSelectedBlind && (
                        <p className="mt-1.5 text-xs font-semibold text-[#fbbf24]">
                          Aviso: {resolvedTargetChar?.name} tiene el rasgo de ceguera / sentidos alternativos (inmune a Cegar). No recibirá fallos automáticos.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {(selectedControlMeta.supportsAutoFails ||
                        selectedControl === 'empujar') && (
                        <label className="inline-flex items-center gap-2">
                          <span className="font-semibold text-[var(--arc-muted)]">
                            {selectedControl === 'empujar'
                              ? 'Fallos auto. del Derribar:'
                              : 'Fallos automáticos:'}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={controlAutoFails}
                            onChange={(e) =>
                              setControlAutoFails(
                                Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1))
                              )
                            }
                            className="font-mono-num w-16 min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-center text-xs text-[var(--arc-text)]"
                          />
                        </label>
                      )}

                      {selectedControl === 'aturdir' && (
                        <div className="flex items-center gap-1 rounded-md bg-[var(--arc-surface)] p-1 border border-[var(--arc-border)]">
                          <button
                            type="button"
                            onClick={() => setControlUntilHit(true)}
                            className={`min-h-[28px] rounded px-2.5 text-xs font-semibold ${
                              controlUntilHit
                                ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                                : 'text-[var(--arc-muted)]'
                            }`}
                          >
                            Hasta recibir 1 golpe
                          </button>
                          <button
                            type="button"
                            onClick={() => setControlUntilHit(false)}
                            className={`min-h-[28px] rounded px-2.5 text-xs font-semibold ${
                              !controlUntilHit
                                ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                                : 'text-[var(--arc-muted)]'
                            }`}
                          >
                            Por turnos
                          </button>
                        </div>
                      )}

                      {selectedControl === 'empujar' && (
                        <label className="inline-flex items-center gap-2 cursor-pointer text-[var(--arc-text)]">
                          <input
                            type="checkbox"
                            checked={includeProneOnPush}
                            onChange={(e) => setIncludeProneOnPush(e.target.checked)}
                            className="h-4 w-4 accent-[var(--arc-accent)]"
                          />
                          <span>Aplicar Derribar automáticamente</span>
                        </label>
                      )}

                      {selectedControl !== 'desarmar' &&
                        selectedControl !== 'empujar' &&
                        !(selectedControl === 'aturdir' && controlUntilHit) && (
                          <label className="inline-flex items-center gap-2">
                            <span className="font-semibold text-[var(--arc-muted)]">
                              Duración (turnos):
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={controlTurns}
                              onChange={(e) =>
                                setControlTurns(
                                  Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                                )
                              }
                              className="font-mono-num w-16 min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-center text-xs text-[var(--arc-text)]"
                            />
                          </label>
                        )}

                      {selectedControl === 'desarmar' && (
                        <span className="text-[var(--arc-muted)]">
                          Permanece activo hasta que el objetivo gaste 1 acción en su turno para recuperar arma o escudo.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {applyMode === 'elemental' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {ELEMENTAL_KEYS.map((k) => {
                      const meta = ELEMENTAL_STATUS_META[k];
                      const active = selectedElemental === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => selectElementalKey(k)}
                          className={`min-h-[36px] rounded-md border px-2.5 text-xs font-semibold text-left transition-colors ${
                            active
                              ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                              : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]/60'
                          }`}
                        >
                          {meta.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)]/50 p-3.5 space-y-3">
                    <p className="text-xs text-[var(--arc-muted)]">
                      {ELEMENTAL_STATUS_META[selectedElemental].description}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-4 text-xs">
                      <label className="space-y-1">
                        <span className="block font-semibold text-[var(--arc-muted)]">Cargas</span>
                        <input
                          type="number"
                          min={1}
                          max={MAX_ELEMENTAL_STACKS}
                          value={elemStacks}
                          onChange={(e) =>
                            setElemStacks(
                              Math.max(
                                1,
                                Math.min(MAX_ELEMENTAL_STACKS, parseInt(e.target.value, 10) || 1)
                              )
                            )
                          }
                          className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-center text-xs text-[var(--arc-text)]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block font-semibold text-[var(--arc-muted)]">Turnos</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={elemTurns}
                          onChange={(e) =>
                            setElemTurns(
                              Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                            )
                          }
                          className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-center text-xs text-[var(--arc-text)]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block font-semibold text-[var(--arc-muted)]">
                          Daño por turno
                        </span>
                        <select
                          value={elemTickDie}
                          onChange={(e) => setElemTickDie(e.target.value as DieType | 'none')}
                          className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs text-[var(--arc-text)]"
                        >
                          <option value="none">Sin daño/turno</option>
                          {DIE_TYPES.map((d) => (
                            <option key={d} value={d}>
                              1{d} / carga
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block font-semibold text-[var(--arc-muted)]">
                          Tipo de daño
                        </span>
                        <select
                          value={elemDamageKind}
                          onChange={(e) => setElemDamageKind(e.target.value as DamageKind)}
                          className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs text-[var(--arc-text)]"
                        >
                          <option value="magico">Mágico</option>
                          <option value="fisico">Físico</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {applyMode === 'custom' && (
                <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)]/50 p-3.5 grid gap-3 sm:grid-cols-12 text-xs">
                  <label className="sm:col-span-5 space-y-1">
                    <span className="block font-semibold text-[var(--arc-muted)]">
                      Nombre del estado / buff
                    </span>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ej. Marca del Cazador, Miedo..."
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2.5 text-xs text-[var(--arc-text)]"
                    />
                  </label>

                  <label className="sm:col-span-3 space-y-1">
                    <span className="block font-semibold text-[var(--arc-muted)]">Categoría</span>
                    <select
                      value={customKind}
                      onChange={(e) => setCustomKind(e.target.value as EffectSubType | 'status')}
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      <option value="debuff">Debuff</option>
                      <option value="buff">Buff</option>
                      <option value="status">Estado</option>
                      <option value="general">Efecto general</option>
                    </select>
                  </label>

                  <label className="sm:col-span-2 space-y-1">
                    <span className="block font-semibold text-[var(--arc-muted)]">
                      Turnos (0=∞)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={customTurns}
                      onChange={(e) =>
                        setCustomTurns(
                          Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0))
                        )
                      }
                      className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-center text-xs text-[var(--arc-text)]"
                    />
                  </label>

                  <div className="sm:col-span-2 flex items-end pb-1">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[var(--arc-text)]">
                      <input
                        type="checkbox"
                        checked={customIsMagical}
                        onChange={(e) => setCustomIsMagical(e.target.checked)}
                        className="h-4 w-4 accent-[var(--arc-accent)]"
                      />
                      <span>Mágico</span>
                    </label>
                  </div>

                  <label className="sm:col-span-12 space-y-1">
                    <span className="block font-semibold text-[var(--arc-muted)]">
                      Efecto o nota (opcional)
                    </span>
                    <input
                      type="text"
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      placeholder="Describe brevemente qué provoca este estado..."
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2.5 text-xs text-[var(--arc-text)]"
                    />
                  </label>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={applyMode === 'custom' && !customName.trim()}
                  onClick={handleSubmitManualStatus}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Aplicar estado a {resolvedTargetChar?.name || 'objetivo'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* VISTA 3: COMPENDIO DE COMBATE */}
      {subTab === 'reference' && (
        <CombatMechanicsCompendium
          compact
          onInspect={(mechanicId) =>
            onInspectMechanic?.(mechanicId, { source: 'compendium' })
          }
        />
      )}
    </div>
  );
}