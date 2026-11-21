import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  Clock3,
  Droplet,
  Flame,
  FlaskConical,
  Info,
  Snowflake,
  X,
  Zap,
} from 'lucide-react';
import type {
  ActiveStatus,
  Character,
  Combatant,
  DamageKind,
  LogEntry,
  Spell,
} from '../types/rpg';
import {
  COMBAT_STATUS_MECHANICS,
  ELEMENTAL_STATUS_META,
  MAX_ELEMENTAL_STACKS,
  calcDirectProtectionSummary,
  getCombatantStatusEffects,
  getStatusElementalKind,
  getStatusStackTurns,
  normalizeCombatStatusKey,
} from '../utils/dice';
import {
  getCombatMechanic,
  type CombatMechanicId,
  type CombatMechanicRecord,
} from '../utils/combatMechanics';

const ELEMENTAL_ID_KIND: Record<string, keyof typeof ELEMENTAL_STATUS_META> = {
  'elemental:burn': 'burn',
  'elemental:poison': 'poison',
  'elemental:frozen': 'frozen',
  'elemental:electrified': 'electrified',
  'elemental:bleeding': 'bleeding',
};

const SYNERGY_REQUIREMENT_KIND: Record<string, keyof typeof ELEMENTAL_STATUS_META> = {
  'synergy:detonate_burn': 'burn',
  'synergy:siphon_poison': 'poison',
  'synergy:shatter_frozen': 'frozen',
  'synergy:overload_electrified': 'electrified',
  'synergy:hemorrhage_bleed': 'bleeding',
};

export interface CombatMechanicContext {
  source: 'active-status' | 'reaction' | 'history' | 'compendium';
  combatantId?: string;
  statusId?: string;
  logEntry?: LogEntry;
}

interface CombatMechanicReaderProps {
  mechanicId: CombatMechanicId;
  context?: CombatMechanicContext;
  combatants: Combatant[];
  characters: Character[];
  spells: Spell[];
  logs: LogEntry[];
  onClose: () => void;
  onOpenCompendium: (mechanicId: CombatMechanicId) => void;
  onInspectRelated: (mechanicId: CombatMechanicId) => void;
}

function getStatusForContext(
  context: CombatMechanicContext | undefined,
  combatants: Combatant[]
): { combatant?: Combatant; status?: ActiveStatus } {
  if (!context?.combatantId) return {};
  const combatant = combatants.find((item) => item.id === context.combatantId);
  const status = context.statusId
    ? combatant?.activeStatuses?.find((item) => item.id === context.statusId)
    : undefined;
  return { combatant, status };
}

function getTargetLabel(
  combatant: Combatant | undefined,
  characters: Character[]
): string | undefined {
  return combatant
    ? characters.find((item) => item.id === combatant.characterId)?.name
    : undefined;
}

function getElementalKind(id: string): keyof typeof ELEMENTAL_STATUS_META | undefined {
  return ELEMENTAL_ID_KIND[id];
}

function getReactionKind(id: string): keyof typeof ELEMENTAL_STATUS_META | undefined {
  return SYNERGY_REQUIREMENT_KIND[id];
}

function ElementalLiveState({
  status,
  kind,
  targetName,
  combatant,
  targetCharacter,
  spells,
}: {
  status: ActiveStatus;
  kind: keyof typeof ELEMENTAL_STATUS_META;
  targetName?: string;
  combatant?: Combatant;
  targetCharacter?: Character;
  spells: Spell[];
}) {
  const meta = ELEMENTAL_STATUS_META[kind];
  const stackTurns = getStatusStackTurns(status);
  const tickDie = status.tickDie ?? meta.defaultTickDie;
  const damageKind: DamageKind = status.tickDamageKind || meta.defaultDamageKind;
  const remainingTurns = [...stackTurns].sort((a, b) => a - b);
  const pendingProtectionStacks = Math.max(0, status.pendingProtectionStacks || 0);

  return (
    <div className="rounded-lg border border-[var(--arc-accent)]/45 bg-[var(--arc-raised)]/50 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-accent)]">
        <Info className="h-3.5 w-3.5" />
        Estado actual del combate
      </h3>
      <p className="mt-1 text-xs text-[var(--arc-text)]">
        {targetName ? `${targetName} tiene ` : 'El objetivo tiene '}
        <strong>{stackTurns.length}/{MAX_ELEMENTAL_STACKS} cargas</strong>
        {remainingTurns.length > 0 &&
          `; vencen en ${remainingTurns.map((turns) => `${turns}t`).join(', ')} (la próxima en ${remainingTurns[0]} ${remainingTurns[0] === 1 ? 'turno' : 'turnos'}).`}
      </p>
      {tickDie ? (
        <p className="mt-1 text-xs text-[var(--arc-muted)]">
          Próximo inicio de turno: tirada de {stackTurns.length}{tickDie} {damageKind === 'magico' ? 'mágico' : 'físico'}, antes de aplicar la Protección preparada.
        </p>
      ) : (
        <p className="mt-1 text-xs text-[var(--arc-muted)]">
          Este estado no tiene daño periódico configurado; sus cargas solo conservan la duración y habilitan sus interacciones.
        </p>
      )}
      {pendingProtectionStacks > 0 && (
        <p className="mt-1 text-xs text-[var(--arc-muted)]">
          Protección preparada: ×{pendingProtectionStacks}
          {tickDie && combatant
            ? (() => {
                const summary = calcDirectProtectionSummary(
                  targetCharacter,
                  spells,
                  damageKind,
                  pendingProtectionStacks
                );
                return ` · reducción teórica ${summary.reduction} (${damageKind === 'magico' ? 3 : 5} por carga)`;
              })()
            : ''}
          . El daño final depende de la tirada real.
        </p>
      )}
    </div>
  );
}

function ReactionLiveState({
  mechanic,
  context,
  combatants,
  characters,
}: {
  mechanic: CombatMechanicRecord;
  context?: CombatMechanicContext;
  combatants: Combatant[];
  characters: Character[];
}) {
  const kind = getReactionKind(mechanic.id);
  if (!kind) return null;
  const requiredStatus = ELEMENTAL_STATUS_META[kind].name;
  const matchingCombatants = combatants
    .map((combatant) => ({
      combatant,
      character: characters.find((item) => item.id === combatant.characterId),
      status: combatant.activeStatuses?.find(
        (status) => getStatusElementalKind(status) === kind
      ),
    }))
    .filter((item) => item.status && getStatusStackTurns(item.status).length > 0);

  if (kind !== 'electrified' && context?.combatantId) {
    const target = matchingCombatants.find(
      (item) => item.combatant.id === context.combatantId
    );
    return (
      <div className="rounded-lg border border-[var(--arc-accent)]/45 bg-[var(--arc-raised)]/50 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-accent)]">
          <Info className="h-3.5 w-3.5" />
          Disponibilidad en el objetivo
        </h3>
        {target?.status ? (
          <p className="mt-1 text-xs text-[var(--arc-text)]">
            Disponible: {target.character?.name || 'El objetivo'} tiene{' '}
            <strong>{getStatusStackTurns(target.status).length} cargas</strong>. El botón manual
            consume 1 carga; {getStatusStackTurns(target.status).length - 1} quedarían.
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--arc-muted)]">
            No disponible ahora: el objetivo seleccionado no tiene cargas activas de {requiredStatus}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--arc-accent)]/45 bg-[var(--arc-raised)]/50 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-accent)]">
        <Info className="h-3.5 w-3.5" />
        Disponibilidad actual
      </h3>
      {matchingCombatants.length > 0 ? (
        <ul className="mt-1 space-y-1 text-xs text-[var(--arc-text)]">
          {matchingCombatants.map(({ combatant, character, status }) => {
            const stacks = status ? getStatusStackTurns(status).length : 0;
            return (
              <li key={combatant.id}>
                {character?.name || 'Combatiente'}: {stacks} carga{stacks === 1 ? '' : 's'}
                {kind === 'electrified' && ` · manual consume 1, quedan ${Math.max(0, stacks - 1)}`}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-[var(--arc-muted)]">
          No hay combatientes con cargas activas de {requiredStatus}; la reacción no se puede activar
          ahora.
        </p>
      )}
    </div>
  );
}

export function CombatMechanicReader({
  mechanicId,
  context,
  combatants,
  characters,
  spells,
  logs,
  onClose,
  onOpenCompendium,
  onInspectRelated,
}: CombatMechanicReaderProps) {
  const mechanic = getCombatMechanic(mechanicId);
  if (!mechanic) return null;

  const { combatant, status } = getStatusForContext(context, combatants);
  const targetName = getTargetLabel(combatant, characters);
  const targetCharacter = combatant
    ? characters.find((item) => item.id === combatant.characterId)
    : undefined;
  const elementalKind = getElementalKind(mechanic.id);
  const controlKey = mechanic.id.startsWith('control:')
    ? normalizeCombatStatusKey(mechanic.name)
    : null;
  const controlSummary =
    controlKey && combatant
      ? getCombatantStatusEffects(combatant, targetCharacter)
      : undefined;
  const logEntry = context?.logEntry
    ? logs.find((item) => item.id === context.logEntry?.id) || context.logEntry
    : undefined;
  const Icon =
    mechanic.icon === 'flame'
      ? Flame
      : mechanic.icon === 'flask'
        ? FlaskConical
        : mechanic.icon === 'snowflake'
          ? Snowflake
          : mechanic.icon === 'zap'
            ? Zap
            : mechanic.icon === 'droplet'
              ? Droplet
              : CircleHelp;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-mechanic-reader-title"
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--arc-border)] bg-[var(--arc-surface)] shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b border-[var(--arc-border)] px-4 py-4 sm:px-5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] text-[var(--arc-accent)]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--arc-muted)]">
              {mechanic.category === 'elemental'
                ? 'Estado elemental'
                : mechanic.category === 'control'
                  ? 'Estado de control'
                  : mechanic.category === 'synergy'
                    ? 'Sinergia / reacción'
                    : 'Efecto especial'}
              {mechanic.element ? ` · ${mechanic.element}` : ''}
            </p>
            <h2
              id="combat-mechanic-reader-title"
              className="font-display text-lg font-bold text-[var(--arc-accent)]"
            >
              {mechanic.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha de mecánica"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <section className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-text)]">
              <CircleHelp className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
              Explicación rápida
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--arc-text)]">{mechanic.quick}</p>
          </section>

          {logEntry && (
            <section className="rounded-lg border border-[var(--arc-accent)]/45 bg-[var(--arc-raised)]/50 p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-accent)]">
                <Info className="h-3.5 w-3.5" />
                En el historial
              </h3>
              <p className="mt-1 text-xs font-semibold text-[var(--arc-text)]">{logEntry.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--arc-muted)]">
                {logEntry.summaryText}
              </p>
              <p className="mt-1 text-[11px] text-[var(--arc-muted)]">
                El registro conserva este evento; no reconstruye estados que hayan cambiado después.
              </p>
            </section>
          )}

          {status && elementalKind && (
            <ElementalLiveState
              status={status}
              kind={elementalKind}
              targetName={targetName}
              combatant={combatant}
              targetCharacter={targetCharacter}
              spells={spells}
            />
          )}

          {mechanic.category === 'synergy' && (
            <ReactionLiveState
              mechanic={mechanic}
              context={context}
              combatants={combatants}
              characters={characters}
            />
          )}

          {status && controlKey && (
            <section className="rounded-lg border border-[var(--arc-accent)]/45 bg-[var(--arc-raised)]/50 p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-accent)]">
                <Info className="h-3.5 w-3.5" />
                Estado actual del combate
              </h3>
              <p className="mt-1 text-xs text-[var(--arc-text)]">
                {targetName ? `${targetName} tiene activo ` : 'Está activo '}
                <strong>{status.name}</strong>
                {status.endsOnHit
                  ? ' hasta recibir el próximo golpe.'
                  : typeof status.remainingTurns === 'number'
                    ? ` durante ${status.remainingTurns} ${status.remainingTurns === 1 ? 'turno' : 'turnos'} más.`
                    : ` (${status.duration || 'sin contador de turnos'}).`}
                {typeof status.autoFails === 'number' && ` Fallos automáticos configurados: ${status.autoFails}.`}
              </p>
              {controlSummary && controlSummary.summaryTags.length > 0 && (
                <p className="mt-1 text-xs text-[var(--arc-muted)]">
                  Efectos combinados activos: {controlSummary.summaryTags.join(' · ')}.
                </p>
              )}
              {controlKey === 'cegar' && targetCharacter?.immuneToBlind && (
                <p className="mt-1 text-xs font-semibold text-[#fbbf24]">
                  Este personaje es inmune a Cegar; el agregador ignora sus fallos automáticos.
                </p>
              )}
              {controlKey === 'empujar' && (
                <p className="mt-1 text-xs text-[var(--arc-muted)]">
                  {combatant?.activeStatuses?.some(
                    (item) => normalizeCombatStatusKey(item.name) === 'derribar'
                  )
                    ? 'Derribar también está activo en este objetivo.'
                    : 'No se encontró un estado Derribar asociado en el objetivo.'}
                </p>
              )}
            </section>
          )}

          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--arc-text)]">
              <BookOpen className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
              Regla completa
            </h3>
            {mechanic.rules.map((rule) => (
              <div
                key={rule.title}
                className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3"
              >
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-accent)]">
                  {rule.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-[var(--arc-text)]">{rule.text}</p>
              </div>
            ))}
            {mechanic.example && (
              <div className="rounded-lg border border-[var(--arc-accent)]/35 bg-[var(--arc-raised)]/50 p-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-accent)]">
                  Ejemplo
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-[var(--arc-text)]">
                  {mechanic.example}
                </p>
              </div>
            )}
          </section>

          {mechanic.related.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-bold text-[var(--arc-text)]">
                Relaciones de esta mecánica
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {mechanic.related.map((relatedId) => {
                  const related = getCombatMechanic(relatedId);
                  if (!related) return null;
                  return (
                    <button
                      key={related.id}
                      type="button"
                      onClick={() => onInspectRelated(related.id)}
                      className="min-h-[30px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      {related.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--arc-border)] pt-3">
            {context?.source === 'active-status' || context?.source === 'reaction' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--arc-muted)]">
                <Clock3 className="h-3.5 w-3.5" />
                Valores leídos del estado actual.
              </span>
            ) : (
              <span className="text-[11px] text-[var(--arc-muted)]">
                Datos explicativos basados en la implementación actual.
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenCompendium(mechanic.id)}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-md bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Abrir en el Compendio
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}