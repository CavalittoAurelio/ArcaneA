import { useState } from 'react';
import { ArrowRight, BookOpen, Dices, Shield, Swords, Trash2 } from 'lucide-react';
import type { D6RollSummary, DamageRollSummary, LogClashOutcome, LogEntry } from '../types/rpg';
import { STAT_NAMES } from '../utils/dice';
import {
  getCombatMechanic,
  getMechanicsMentionedInLog,
  type CombatMechanicId,
} from '../utils/combatMechanics';
import type { CombatMechanicContext } from './CombatMechanicReader';

interface LogPanelProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  onQuickRoll: (diceCount: number, assured: number) => void;
  onInspectMechanic?: (mechanicId: CombatMechanicId, context: CombatMechanicContext) => void;
}

function DiceRow({ summary, tone }: { summary: D6RollSummary; tone?: 'atk' | 'def' }) {
  const netClass =
    tone === 'atk'
      ? 'text-[var(--arc-atk-accent)]'
      : tone === 'def'
        ? 'text-[var(--arc-def-accent)]'
        : summary.net > 0
          ? 'text-[#a4d67e]'
          : summary.net < 0
            ? 'text-[#e08060]'
            : 'text-[#e2c275]';

  const metaTextClass =
    tone === 'atk'
      ? 'text-[var(--arc-atk-text)] opacity-85'
      : tone === 'def'
        ? 'text-[var(--arc-def-text)] opacity-85'
        : 'text-[var(--arc-muted)]';

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {summary.rolls.map((val, idx) => {
          const style =
            val === 1
              ? 'border-[#7a3020] bg-[#381811] text-[#ff9a7a]'
              : val >= 5
                ? 'border-[#4a7a30] bg-[#1e3818] text-[#c4f2a4]'
                : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-muted)]';
          return (
            <span
              key={idx}
              className={`font-mono-num inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold ${style}`}
            >
              {val}
            </span>
          );
        })}
        {summary.assured > 0 && (
          <span className="font-mono-num inline-flex h-7 items-center justify-center rounded-md border border-dashed border-[#8a6a20] bg-[#332810] px-2 text-xs font-bold text-[#d4a843]">
            +{summary.assured} aseg.
          </span>
        )}
        {summary.statusAutoFails && summary.statusAutoFails > 0 && (
          <span
            title={summary.statusPenaltyNotes?.join(' · ') || 'Fallos automáticos por estado'}
            className="font-mono-num inline-flex h-7 items-center justify-center rounded-md border border-dashed border-[#8a3525] bg-[#361611] px-2 text-xs font-bold text-[#ff9a7a]"
          >
            +{summary.statusAutoFails} fallo{summary.statusAutoFails > 1 ? 's' : ''} auto.
          </span>
        )}
      </div>
      <div className={`text-xs font-mono-num break-words ${metaTextClass}`}>
        {summary.breakdown && summary.breakdown.length > 0 && (
          <span className="mr-1.5 opacity-80">
            ({summary.breakdown.map((b) => `${STAT_NAMES[b.stat]} ${b.dice}d6`).join(' + ')}) ·
          </span>
        )}
        <span>{summary.successes} éxito(s)</span>
        {' · '}
        <span>{summary.fails} fallo(s)</span>
        {summary.statusPenaltyNotes && summary.statusPenaltyNotes.length > 0 && (
          <span className="text-[#ff9a7a]"> [{summary.statusPenaltyNotes.join(', ')}]</span>
        )}
        {' · Neto '}
        <strong className={netClass}>{summary.net > 0 ? `+${summary.net}` : summary.net}</strong>
      </div>
    </div>
  );
}

function DamageLine({ damageRoll }: { damageRoll: DamageRollSummary }) {
  return (
    <div className="text-xs sm:text-[13px] font-mono-num text-[var(--arc-text)] rounded-lg bg-[var(--arc-input)]/75 px-3 py-2 break-words">
      {damageRoll.isCriticalHit && (
        <span className="mr-2 inline-flex items-center rounded bg-[#5e1c14] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#ffd6c9]">
          CRÍTICO AUTO{damageRoll.criticalReason ? ` · ${damageRoll.criticalReason}` : ''}
        </span>
      )}
      {damageRoll.damageKind && (
        <span
          className={`mr-2 font-semibold ${
            damageRoll.damageKind === 'magico'
              ? 'text-[var(--arc-magic-accent)]'
              : 'text-[var(--arc-phys-accent)]'
          }`}
        >
          [{damageRoll.damageKind === 'magico' ? 'Mágico' : 'Físico'}]
        </span>
      )}
      {damageRoll.isManual
        ? `Total manual: ${damageRoll.rawTotal ?? damageRoll.total}`
        : `${damageRoll.parts.join(' + ')}${damageRoll.bonus ? ` + ${damageRoll.bonus}` : ''} = ${
            damageRoll.rawTotal ?? damageRoll.total
          }`}
      {damageRoll.damageReduction && damageRoll.damageReduction > 0
        ? ` − ${damageRoll.damageReduction} reducción`
        : ''}
      {damageRoll.damageDivisor === 2
        ? ` ÷ 2 (resistencia)`
        : damageRoll.damageDivisor === 4
          ? ` ÷ 4 (resistencia)`
          : damageRoll.damageDivisor === 0
            ? ` → anulado por efecto`
            : ''}
      {(damageRoll.damageReduction && damageRoll.damageReduction > 0) ||
      (damageRoll.damageDivisor !== undefined && damageRoll.damageDivisor !== 1)
        ? ` = ${damageRoll.total}`
        : ''}
      {damageRoll.notes ? ` (${damageRoll.notes})` : ''}
      {damageRoll.burnStacksApplied && damageRoll.burnStacksApplied > 0 ? (
        <span className="ml-2 font-semibold text-[#ff935c]">
          [+{damageRoll.burnStacksApplied} Quemadura 1d4 · 2t]
        </span>
      ) : null}
    </div>
  );
}

function getClashVerdict(
  outcome?: LogClashOutcome,
  atkNet?: number,
  defNet?: number
): { label: string; toneClass: string } {
  if (outcome === 'defender_wins') {
    return { label: 'Bloqueado / Esquivado', toneClass: 'text-[var(--arc-def-accent)]' };
  }
  if (outcome === 'counterspell_success') {
    return { label: 'Hechizo anulado', toneClass: 'text-[var(--arc-def-accent)]' };
  }
  if (outcome === 'counterspell_fail') {
    return { label: 'Hechizo sostenido', toneClass: 'text-[var(--arc-atk-accent)]' };
  }
  if (outcome === 'tie_verify_damage') {
    return { label: 'Empate · Verificar daño', toneClass: 'text-[var(--arc-atk-accent)]' };
  }
  if (outcome === 'attacker_wins') {
    return { label: 'Impacta', toneClass: 'text-[var(--arc-atk-accent)]' };
  }
  if (typeof atkNet === 'number' && typeof defNet === 'number') {
    if (defNet > atkNet) {
      return { label: 'Bloqueado / Esquivado', toneClass: 'text-[var(--arc-def-accent)]' };
    }
    if (atkNet === defNet) {
      return { label: 'Empate · Verificar daño', toneClass: 'text-[var(--arc-atk-accent)]' };
    }
    return { label: 'Impacta', toneClass: 'text-[var(--arc-atk-accent)]' };
  }
  return { label: 'Enfrentamiento', toneClass: 'text-[var(--arc-accent)]' };
}

function MechanicLogLinks({
  entry,
  onInspectMechanic,
}: {
  entry: LogEntry;
  onInspectMechanic?: LogPanelProps['onInspectMechanic'];
}) {
  if (!onInspectMechanic) return null;
  const mentioned = getMechanicsMentionedInLog(
    [
      entry.title,
      entry.summaryText,
      entry.damageRoll?.notes,
      entry.clash?.attackerAction,
      entry.clash?.defenderAction,
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (mentioned.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-[11px] text-[var(--arc-muted)]">Consultar:</span>
      {mentioned.map((mechanicId) => (
        <button
          key={mechanicId}
          type="button"
          onClick={() =>
            onInspectMechanic(mechanicId, { source: 'history', logEntry: entry })
          }
          className="min-h-[28px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-[11px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
        >
          <BookOpen className="h-3 w-3 shrink-0" />
          <span>{getCombatMechanic(mechanicId)?.name || 'Mecánica'}</span>
        </button>
      ))}
    </div>
  );
}

export function LogPanel({ logs, onClearLogs, onQuickRoll, onInspectMechanic }: LogPanelProps) {
  const [quickDice, setQuickDice] = useState(2);
  const [quickAssured, setQuickAssured] = useState(0);

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3.5 sm:p-5 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-xl font-bold text-[var(--arc-accent)] break-words">
            Historial y Dados Rápidos
          </h2>
          <p className="text-xs sm:text-[13px] text-[var(--arc-muted)] mt-0.5">
            Registro cronológico de casteos, ataques, defensas y daños
          </p>
        </div>

        <button
          type="button"
          onClick={onClearLogs}
          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-transparent px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[#361912] hover:text-[#e88a70] transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          <span>Limpiar historial</span>
        </button>
      </div>

      {/* Tirador rápido integrado */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-[var(--arc-border)] pb-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[var(--arc-muted)] mr-1">Dados d6:</span>
            <button
              type="button"
              onClick={() => setQuickDice((n) => Math.max(1, n - 1))}
              className="min-h-[30px] w-7 rounded-md bg-[var(--arc-input)] sm:bg-transparent text-[var(--arc-text)] font-semibold hover:bg-[var(--arc-raised)] transition-colors"
            >
              −
            </button>
            <span className="font-mono-num w-6 text-center font-bold text-[var(--arc-accent)]">
              {quickDice}
            </span>
            <button
              type="button"
              onClick={() => setQuickDice((n) => Math.min(20, n + 1))}
              className="min-h-[30px] w-7 rounded-md bg-[var(--arc-input)] sm:bg-transparent text-[var(--arc-text)] font-semibold hover:bg-[var(--arc-raised)] transition-colors"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[var(--arc-muted)] mr-1">Asegurados:</span>
            <button
              type="button"
              onClick={() => setQuickAssured((n) => Math.max(0, n - 1))}
              className="min-h-[30px] w-7 rounded-md bg-[var(--arc-input)] sm:bg-transparent text-[var(--arc-text)] font-semibold hover:bg-[var(--arc-raised)] transition-colors"
            >
              −
            </button>
            <span className="font-mono-num w-6 text-center font-bold text-[var(--arc-accent)]">
              {quickAssured}
            </span>
            <button
              type="button"
              onClick={() => setQuickAssured((n) => Math.min(10, n + 1))}
              className="min-h-[30px] w-7 rounded-md bg-[var(--arc-input)] sm:bg-transparent text-[var(--arc-text)] font-semibold hover:bg-[var(--arc-raised)] transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onQuickRoll(quickDice, quickAssured)}
          className="w-full sm:w-auto min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm transition-colors shrink-0"
        >
          <Dices className="h-3.5 w-3.5 shrink-0" />
          <span>Tirar {quickDice}d6</span>
        </button>
      </div>

      {/* Entradas del log */}
      {logs.length === 0 ? (
        <div className="rounded-lg bg-[var(--arc-surface-alt)] p-6 text-center text-xs sm:text-[13px] text-[var(--arc-muted)]">
          Aún no se realizaron tiradas ni acciones de combate.
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] sm:max-h-[560px] overflow-y-auto pr-0.5 sm:pr-1">
          {logs.map((entry) => {
            const clash = entry.clash;
            const isSplitDuel = Boolean(entry.attackRoll && entry.defenseRoll);

            // 1. Duelo completo (Atacante izquierda cálida vs Defensor derecha fría)
            if (isSplitDuel && entry.attackRoll && entry.defenseRoll) {
              const verdict = getClashVerdict(
                clash?.outcome,
                entry.attackRoll.net,
                entry.defenseRoll.net
              );
              const atkName = clash?.attackerName || 'Atacante';
              const defName = clash?.defenderName || 'Defensor';
              const dmgKind = clash?.damageKind || entry.damageRoll?.damageKind;

              return (
                <article
                  key={entry.id}
                  className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] overflow-hidden min-w-0"
                >
                  {/* Barra superior con veredicto y participantes */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] bg-[var(--arc-surface)] px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs min-w-0">
                      <span className={`font-bold uppercase tracking-wide ${verdict.toneClass}`}>
                        {verdict.label}
                      </span>
                      <span className="text-[var(--arc-border-strong)]">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--arc-atk-accent)]">
                        <Swords className="h-3 w-3 shrink-0" />
                        <span>{atkName}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-[var(--arc-muted)] shrink-0" />
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--arc-def-accent)]">
                        <Shield className="h-3 w-3 shrink-0" />
                        <span>{defName}</span>
                      </span>
                      {dmgKind && (
                        <>
                          <span className="text-[var(--arc-border-strong)]">·</span>
                          <span
                            className={`font-semibold ${
                              dmgKind === 'magico'
                                ? 'text-[var(--arc-magic-accent)]'
                                : 'text-[var(--arc-phys-accent)]'
                            }`}
                          >
                            {dmgKind === 'magico' ? 'Mágico' : 'Físico'}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono-num text-xs text-[var(--arc-muted)] shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>

                  {/* Dos columnas: Atacante (cálido) | Defensor (frío) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--arc-border)]">
                    <div className="bg-[var(--arc-atk-bg)] p-3.5 space-y-2 min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--arc-atk-accent)] min-w-0">
                            <Swords className="h-3 w-3 shrink-0" />
                            <span className="truncate">Ataca · {atkName}</span>
                          </span>
                          <span className="font-mono-num text-sm font-bold text-[var(--arc-atk-accent)] shrink-0">
                            {entry.attackRoll.net > 0
                              ? `+${entry.attackRoll.net}`
                              : entry.attackRoll.net}
                          </span>
                        </div>
                        {clash?.attackerAction && (
                          <div className="text-xs sm:text-[13px] font-semibold text-[var(--arc-atk-text)] mt-0.5 break-words">
                            {clash.attackerAction}
                          </div>
                        )}
                      </div>
                      <DiceRow summary={entry.attackRoll} tone="atk" />
                    </div>

                    <div className="bg-[var(--arc-def-bg)] p-3.5 space-y-2 min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--arc-def-accent)] min-w-0">
                            <Shield className="h-3 w-3 shrink-0" />
                            <span className="truncate">Defiende · {defName}</span>
                          </span>
                          <span className="font-mono-num text-sm font-bold text-[var(--arc-def-accent)] shrink-0">
                            {entry.defenseRoll.net > 0
                              ? `+${entry.defenseRoll.net}`
                              : entry.defenseRoll.net}
                          </span>
                        </div>
                        {clash?.defenderAction && (
                          <div className="text-xs sm:text-[13px] font-semibold text-[var(--arc-def-text)] mt-0.5 break-words">
                            {clash.defenderAction}
                          </div>
                        )}
                      </div>
                      <DiceRow summary={entry.defenseRoll} tone="def" />
                    </div>
                  </div>

                  {/* Pie con daño y resumen */}
                  <div className="border-t border-[var(--arc-border)] px-3.5 py-2.5 space-y-1.5 min-w-0">
                    {entry.damageRoll && <DamageLine damageRoll={entry.damageRoll} />}
                    <p className="text-xs sm:text-[13px] text-[var(--arc-text)] opacity-90 leading-relaxed break-words">
                      {entry.summaryText}
                    </p>
                    {entry.manaNote && (
                      <p className="text-xs text-[var(--arc-magic-accent)] break-words">
                        {entry.manaNote}
                      </p>
                    )}
                    {entry.masteryNote && (
                      <p className="text-xs font-medium text-[var(--arc-accent)] break-words">
                        {entry.masteryNote}
                      </p>
                    )}
                    <MechanicLogLinks entry={entry} onInspectMechanic={onInspectMechanic} />
                  </div>
                </article>
              );
            }

            // 2. Entradas de rol individual (Ataque lanzado / Impacto directo / Protección / Prueba de defensa)
            const isSingleAttackRole =
              clash?.outcome === 'pending_defense' ||
              clash?.outcome === 'direct_hit' ||
              clash?.outcome === 'attacker_wins' ||
              (entry.kind === 'attack' && Boolean(entry.attackRoll));
            const isSingleDefenseRole =
              clash?.outcome === 'protection' ||
              clash?.outcome === 'defense_test' ||
              (entry.kind === 'defense' && !entry.attackRoll);

            if (isSingleAttackRole || isSingleDefenseRole) {
              const isAtk = isSingleAttackRole;
              const dmgKind = clash?.damageKind || entry.damageRoll?.damageKind;

              return (
                <article
                  key={entry.id}
                  className={`rounded-xl border p-3.5 sm:p-4 space-y-2.5 min-w-0 ${
                    isAtk
                      ? 'border-[var(--arc-atk-border)] bg-[var(--arc-atk-bg)]'
                      : 'border-[var(--arc-def-border)] bg-[var(--arc-def-bg)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider ${
                          isAtk ? 'text-[var(--arc-atk-accent)]' : 'text-[var(--arc-def-accent)]'
                        }`}
                      >
                        {isAtk ? (
                          <Swords className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Shield className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>{isAtk ? 'Ataca' : 'Defiende'}</span>
                      </span>

                      {clash?.attackerName && clash?.defenderName && (
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span className="text-[var(--arc-atk-accent)]">{clash.attackerName}</span>
                          <ArrowRight className="h-3 w-3 text-[var(--arc-muted)] shrink-0" />
                          <span className="text-[var(--arc-def-accent)]">{clash.defenderName}</span>
                        </span>
                      )}

                      {dmgKind && (
                        <span
                          className={`font-semibold ${
                            dmgKind === 'magico'
                              ? 'text-[var(--arc-magic-accent)]'
                              : 'text-[var(--arc-phys-accent)]'
                          }`}
                        >
                          · {dmgKind === 'magico' ? 'Mágico' : 'Físico'}
                        </span>
                      )}
                    </div>

                    <span className="font-mono-num text-xs text-[var(--arc-muted)] shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>

                  <h3
                    className={`text-sm sm:text-[15px] font-bold break-words ${
                      isAtk ? 'text-[var(--arc-atk-text)]' : 'text-[var(--arc-def-text)]'
                    }`}
                  >
                    {entry.title}
                  </h3>

                  {entry.attackRoll && <DiceRow summary={entry.attackRoll} tone="atk" />}
                  {entry.defenseRoll && <DiceRow summary={entry.defenseRoll} tone="def" />}
                  {entry.damageRoll && <DamageLine damageRoll={entry.damageRoll} />}

                  <p
                    className={`text-xs sm:text-[13px] leading-relaxed break-words ${
                      isAtk ? 'text-[var(--arc-atk-text)]' : 'text-[var(--arc-def-text)]'
                    } opacity-90`}
                  >
                    {entry.summaryText}
                  </p>

                  {entry.manaNote && (
                    <p className="text-xs text-[var(--arc-magic-accent)] break-words">
                      {entry.manaNote}
                    </p>
                  )}
                  {entry.masteryNote && (
                    <p className="text-xs font-medium text-[var(--arc-accent)] break-words">
                      {entry.masteryNote}
                    </p>
                  )}
                  <MechanicLogLinks entry={entry} onInspectMechanic={onInspectMechanic} />
                </article>
              );
            }

            // 3. Resto de entradas (casteos, curaciones, eventos, tiradas rápidas)
            const isMagicalEntry =
              Boolean(entry.isMagical) || entry.damageRoll?.damageKind === 'magico';
            const isPhysicalEntry =
              !isMagicalEntry &&
              (entry.damageRoll?.damageKind === 'fisico' ||
                (entry.isMagical === false && entry.kind === 'cast'));

            return (
              <article
                key={entry.id}
                className={`rounded-xl border p-3.5 sm:p-4 space-y-2.5 min-w-0 ${
                  isMagicalEntry
                    ? 'border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)]'
                    : isPhysicalEntry
                      ? 'border-[var(--arc-phys-border)] bg-[var(--arc-phys-bg)]'
                      : 'border-[var(--arc-border)] bg-[var(--arc-surface-alt)]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={`text-sm sm:text-[15px] font-bold break-words min-w-0 flex-1 ${
                      isMagicalEntry
                        ? 'text-[var(--arc-magic-accent)]'
                        : isPhysicalEntry
                          ? 'text-[var(--arc-phys-accent)]'
                          : 'text-[var(--arc-accent)]'
                    }`}
                  >
                    {entry.title}
                  </h3>
                  <span className="font-mono-num text-xs text-[var(--arc-muted)] shrink-0">
                    {entry.timestamp}
                  </span>
                </div>

                {entry.castRoll && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#8fb56a]">Tirada de casteo</div>
                    <DiceRow summary={entry.castRoll} />
                  </div>
                )}

                {entry.damageRoll && <DamageLine damageRoll={entry.damageRoll} />}

                <p className="text-xs sm:text-[13px] text-[var(--arc-text)] opacity-90 leading-relaxed break-words">
                  {entry.summaryText}
                </p>

                {entry.manaNote && (
                  <p className="text-xs text-[var(--arc-magic-accent)] break-words">
                    {entry.manaNote}
                  </p>
                )}

                {entry.masteryNote && (
                  <p className="text-xs font-medium text-[var(--arc-accent)] break-words">
                    {entry.masteryNote}
                  </p>
                )}
                <MechanicLogLinks entry={entry} onInspectMechanic={onInspectMechanic} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}