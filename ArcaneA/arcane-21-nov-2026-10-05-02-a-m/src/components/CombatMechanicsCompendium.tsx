import { useMemo, useState, type ComponentType } from 'react';
import {
  Anchor,
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  Clock3,
  Droplet,
  EarOff,
  EyeOff,
  Flame,
  FlaskConical,
  Move,
  Moon,
  PersonStanding,
  Search,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Swords,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { CombatMechanicId, CombatMechanicRecord } from '../utils/combatMechanics';
import { COMBAT_MECHANIC_CATALOG, getCombatMechanic } from '../utils/combatMechanics';

type CatalogFilter = 'all' | 'elemental' | 'synergy' | 'control' | 'special';

const FILTERS: Array<{ id: CatalogFilter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'elemental', label: 'Elementales' },
  { id: 'synergy', label: 'Sinergias' },
  { id: 'control', label: 'Control' },
  { id: 'special', label: 'Efectos especiales' },
];

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  flame: Flame,
  flask: FlaskConical,
  snowflake: Snowflake,
  zap: Zap,
  droplet: Droplet,
  dizzy: CircleAlert,
  'eye-off': EyeOff,
  'person-standing': PersonStanding,
  swords: Swords,
  move: Move,
  'ear-off': EarOff,
  anchor: Anchor,
  moon: Moon,
  snail: Clock3,
  'volume-x': VolumeX,
  'shield-alert': ShieldAlert,
};

const CATEGORY_LABELS: Record<CombatMechanicRecord['category'], string> = {
  elemental: 'Estado elemental',
  synergy: 'Sinergia / reacción',
  control: 'Estado de control',
  special: 'Efecto especial',
};

const CATEGORY_TONES: Record<CombatMechanicRecord['category'], string> = {
  elemental: 'border-[#6e5526] bg-[#2b2110] text-[#f1d58a]',
  synergy: 'border-[#63518a] bg-[#201a2c] text-[#d5c6ff]',
  control: 'border-[#75443c] bg-[#2b1915] text-[#ffbeae]',
  special: 'border-[#326478] bg-[#13252c] text-[#a6deff]',
};

interface CombatMechanicsCompendiumProps {
  onInspect: (id: CombatMechanicId) => void;
  initialMechanicId?: CombatMechanicId;
  compact?: boolean;
}

function MechanicIcon({ record, className }: { record: CombatMechanicRecord; className?: string }) {
  const Icon = ICONS[record.icon] || Sparkles;
  return <Icon className={className || 'h-4 w-4'} aria-hidden="true" />;
}

export function CombatMechanicsCompendium({
  onInspect,
  initialMechanicId,
  compact = false,
}: CombatMechanicsCompendiumProps) {
  const [query, setQuery] = useState(
    initialMechanicId ? getCombatMechanic(initialMechanicId)?.name || '' : ''
  );
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [element, setElement] = useState('all');

  const elements = useMemo(
    () => [...new Set(COMBAT_MECHANIC_CATALOG.map((item) => item.element).filter(Boolean))] as string[],
    []
  );
  const visibleMechanics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return COMBAT_MECHANIC_CATALOG.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (element !== 'all' && item.element !== element) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        item.name,
        item.element || '',
        item.quick,
        ...item.rules.map((rule) => `${rule.title} ${rule.text}`),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [element, filter, query]);

  return (
    <section className="space-y-3">
      {!compact && (
        <div>
          <h3 className="font-display text-base font-bold text-[var(--arc-accent)]">
            Compendio de Combate
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--arc-muted)]">
            Consultá qué hace cada mecánica, cómo se resuelve y con qué se relaciona. Las reglas se
            describen según el comportamiento actual del combate.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--arc-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar en el Compendio de Combate"
            placeholder="Buscar estado, reacción o regla..."
            className="min-h-[36px] w-full rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] pl-8 pr-3 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)]"
          />
        </div>
        <select
          value={element}
          onChange={(event) => setElement(event.target.value)}
          aria-label="Filtrar por elemento"
          className="min-h-[36px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)] sm:max-w-52"
        >
          <option value="all">Todos los elementos</option>
          {elements.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría de mecánica">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-[30px] rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              filter === item.id
                ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                : 'border-[var(--arc-border)] bg-[var(--arc-input)] text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleMechanics.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--arc-border)] p-4 text-center text-xs text-[var(--arc-muted)]">
          No hay mecánicas que coincidan. Probá otra búsqueda o filtro.
        </p>
      ) : (
        <div className="grid gap-2.5 xl:grid-cols-2">
          {visibleMechanics.map((record) => (
            <article
              key={record.id}
              className="min-w-0 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${CATEGORY_TONES[record.category]}`}
                >
                  <MechanicIcon record={record} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="font-semibold text-sm text-[var(--arc-text)]">{record.name}</h4>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_TONES[record.category]}`}
                    >
                      {CATEGORY_LABELS[record.category]}
                    </span>
                    {record.element && (
                      <span className="rounded-full border border-[var(--arc-border)] px-2 py-0.5 text-[10px] text-[var(--arc-muted)]">
                        {record.element}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--arc-muted)]">
                    {record.quick}
                  </p>
                </div>
              </div>

              <details className="mt-2.5 border-t border-[var(--arc-border)] pt-2">
                <summary className="flex min-h-[30px] cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--arc-accent)]">
                  <BookOpen className="h-3.5 w-3.5" />
                  Regla completa
                </summary>
                <div className="mt-2 space-y-2.5">
                  {record.rules.map((rule) => (
                    <div key={rule.title}>
                      <h5 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-text)]">
                        {rule.title}
                      </h5>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--arc-muted)]">
                        {rule.text}
                      </p>
                    </div>
                  ))}
                  {record.example && (
                    <div className="rounded-md border border-[var(--arc-accent)]/35 bg-[var(--arc-raised)]/50 p-2.5">
                      <h5 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-accent)]">
                        Ejemplo
                      </h5>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--arc-text)]">
                        {record.example}
                      </p>
                    </div>
                  )}
                  {record.related.length > 0 && (
                    <div className="border-t border-[var(--arc-border)] pt-2">
                      <p className="mb-1.5 text-[11px] font-semibold text-[var(--arc-text)]">
                        Mecánicas relacionadas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {record.related.map((relatedId) => {
                          const related = getCombatMechanic(relatedId);
                          if (!related) return null;
                          return (
                            <button
                              key={related.id}
                              type="button"
                              onClick={() => onInspect(related.id)}
                              className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-[11px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              {related.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onInspect(record.id)}
                    className="min-h-[30px] inline-flex items-center gap-1.5 rounded-md bg-[var(--arc-raised)] px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:brightness-110"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Abrir ficha contextual
                  </button>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

interface CombatMechanicsOverlayProps {
  initialMechanicId?: CombatMechanicId;
  onClose: () => void;
  onInspect: (id: CombatMechanicId) => void;
}

export function CombatMechanicsCatalogOverlay({
  initialMechanicId,
  onClose,
  onInspect,
}: CombatMechanicsOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Compendio de Combate"
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-[var(--arc-accent)]">
              Compendio de Combate
            </h2>
            <p className="mt-1 text-xs text-[var(--arc-muted)]">
              Referencia completa de estados, sinergias, reacciones y efectos especiales.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar Compendio de Combate"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <CombatMechanicsCompendium
          key={initialMechanicId || 'catalog'}
          onInspect={onInspect}
          initialMechanicId={initialMechanicId}
        />
      </section>
    </div>
  );
}