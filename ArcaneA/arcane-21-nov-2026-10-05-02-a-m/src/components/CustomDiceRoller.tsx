/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Dice1 as Dice } from 'lucide-react';
import type { DamageDie, DamageKind, DieType } from '../types/rpg';
import { rollDamageDice } from '../utils/dice';
import type { LogEntry } from '../types/rpg';

type CustomDiceRollerProps = {
  open: boolean;
  onClose: () => void;
  onRoll: (result: { count: number; type: DieType; total: number; parts: string[]; notes: string }) => void;
};

const DIE_TYPES: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

const dieFaces: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
};

export function CustomDiceRoller({
  open,
  onClose,
  onRoll,
}: CustomDiceRollerProps) {
  const [count, setCount] = useState<number>(2);
  const [type, setType] = useState<DieType>('d6');
  const [damageKind, setDamageKind] = useState<DamageKind>('fisico');

  const handleRoll = () => {
    const dice: DamageDie[] = [{ type, count }];
    const summary = rollDamageDice(dice, 0, 'Dados personalizados', damageKind);
    onRoll({
      count,
      type,
      total: summary.total,
      parts: summary.parts,
      notes: summary.notes,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-dice-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-w-md w-full flex-col overflow-hidden rounded-2xl border border-[var(--arc-border)] bg-[var(--arc-surface)] shadow-2xl p-5 text-[var(--arc-text)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--arc-border)] pb-2.5 mb-3">
          <h3
            id="custom-dice-title"
            className="font-semibold text-[var(--arc-accent)]"
          >
            Lanzador de dados
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar lanzador de dados"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] p-2 text-xs">
              <span className="font-semibold text-[var(--arc-muted)]">Cantidad</span>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-full min-h-[32px] rounded border-none bg-transparent px-1 text-center text-xs text-[var(--arc-accent)] outline-none"
              />
            </label>
            <label className="flex flex-col items-center justify-center gap-1 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] p-2 text-xs">
              <span className="font-semibold text-[var(--arc-muted)]">Dado</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DieType)}
                className="w-full min-h-[32px] rounded border-none bg-transparent px-1 text-center text-xs text-[var(--arc-accent)] outline-none"
              >
                {DIE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()} (1-{dieFaces[t]})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--arc-muted)]">
              Daño
              <select
                value={damageKind}
                onChange={(e) => setDamageKind(e.target.value as DamageKind)}
                className="rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-xs text-[var(--arc-text)] outline-none"
              >
                <option value="fisico">Físico</option>
                <option value="magico">Mágico</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={handleRoll}
            className="min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--arc-action)] px-4 py-2 text-sm font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm"
          >
            <Dice className="h-4 w-4" />
            Tirar {count}{type.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}