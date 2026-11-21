import { useState } from 'react';
import { Dices, X } from 'lucide-react';
import type { DieType } from '../types/rpg';

const DIE_TYPES: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

export interface FreeRollResult {
  die: DieType;
  count: number;
  parts: number[];
  total: number;
}

interface DiceLauncherProps {
  onRoll: (die: DieType, count: number) => FreeRollResult;
}

export function DiceLauncher({ onRoll }: DiceLauncherProps) {
  const [open, setOpen] = useState(false);
  const [die, setDie] = useState<DieType>('d6');
  const [count, setCount] = useState(2);
  const [lastRoll, setLastRoll] = useState<FreeRollResult | null>(null);

  const handleRoll = () => {
    const safeCount = Math.max(1, Math.min(30, Math.floor(count) || 1));
    setCount(safeCount);
    setLastRoll(onRoll(die, safeCount));
  };

  return (
    <div className="fixed bottom-20 right-3 md:bottom-5 md:right-5 z-40 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="w-[260px] rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-2">
            <h2 className="font-display text-sm font-bold text-[var(--arc-accent)]">
              Lanzador de dados
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar lanzador de dados"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-[var(--arc-muted)]">
              Dado
              <select
                value={die}
                onChange={(e) => setDie(e.target.value as DieType)}
                aria-label="Tipo de dado"
                className="mt-1 w-full min-h-[36px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-sm text-[var(--arc-text)]"
              >
                {DIE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-20 text-xs text-[var(--arc-muted)]">
              Cantidad
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                aria-label="Cantidad de dados"
                className="font-mono-num mt-1 w-full min-h-[36px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-center text-sm text-[var(--arc-text)]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleRoll}
            className="min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] transition-colors"
          >
            <Dices className="h-3.5 w-3.5" />
            Tirar {count}
            {die}
          </button>

          {lastRoll && (
            <div className="rounded-lg bg-[var(--arc-surface-alt)] px-2.5 py-2 space-y-1">
              <div className="flex flex-wrap gap-1">
                {lastRoll.parts.map((value, idx) => (
                  <span
                    key={idx}
                    className="font-mono-num inline-flex h-6 min-w-6 items-center justify-center rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-1 text-xs font-bold text-[var(--arc-text)]"
                  >
                    {value}
                  </span>
                ))}
              </div>
              <p className="font-mono-num text-xs text-[var(--arc-muted)]">
                {lastRoll.count}
                {lastRoll.die} · Total{' '}
                <strong className="text-[var(--arc-accent)]">{lastRoll.total}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Cerrar lanzador de dados' : 'Abrir lanzador de dados'}
        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full border border-[var(--arc-border)] bg-[var(--arc-header)] px-4 text-xs font-semibold text-[var(--arc-accent)] shadow-lg hover:bg-[var(--arc-raised)] transition-colors"
      >
        <Dices className="h-4 w-4" />
        Dados
      </button>
    </div>
  );
}
