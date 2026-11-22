import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Copy,
  Download,
  RotateCcw,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { FormulaConfig, MasteryGrowthMode } from '../types/rpg';
import {
  calcStatDice,
  formatFormulaText,
  getMasteryMilestones,
  getStatMilestones,
} from '../utils/dice';

interface FormulaAndBackupProps {
  formula: FormulaConfig;
  onChangeFormula: (next: FormulaConfig) => void;
  onExportBackup: () => string;
  onImportBackup: (jsonText: string) => { ok: boolean; message: string };
  customSpellCount?: number;
  onExportCustomSpells?: () => { ok: boolean; count: number; message: string };
  canRevertReset: boolean;
  onResetAllData: () => void;
  onRevertReset: () => void;
}

interface PendingBackupImport {
  fileName: string;
  rawContent: string;
  summary: string;
}

const MASTERY_MODES: Array<{ id: MasteryGrowthMode; label: string; hint: string }> = [
  { id: 'linear', label: 'Lineal (base)', hint: '0, 10, 20, 30...' },
  { id: 'double', label: 'Duplicado', hint: '0, B, 2B, 4B, 8B' },
  { id: 'stepped', label: 'Escalonado', hint: '0, B, 3B, 6B, 10B' },
  { id: 'custom', label: 'Personalizado', hint: 'Hitos manuales' },
];

function summarizeBackupContent(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let jsonCandidate = trimmed;
  const arcaneMatch = trimmed.match(/ARCANE1:[A-Za-z0-9+/=]+/);
  if (arcaneMatch) {
    try {
      const base64 = arcaneMatch[0].slice('ARCANE1:'.length).trim();
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      jsonCandidate = new TextDecoder().decode(bytes);
    } catch {
      return 'Código ARCANE1 detectado (se validará al importar)';
    }
  } else {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      characters?: unknown[];
      spells?: unknown[];
      round?: unknown;
    };
    const charCount = Array.isArray(parsed?.characters) ? parsed.characters.length : null;
    const spellCount = Array.isArray(parsed?.spells) ? parsed.spells.length : null;
    const roundNum =
      typeof parsed?.round === 'number' && parsed.round >= 1 ? Math.floor(parsed.round) : null;

    if (charCount === null && spellCount === null) {
      return null;
    }

    const parts: string[] = [];
    if (charCount !== null) parts.push(`${charCount} personaje(s)`);
    if (spellCount !== null) parts.push(`${spellCount} hechizo(s)`);
    if (roundNum !== null) parts.push(`Ronda ${roundNum}`);
    return parts.join(' · ');
  } catch {
    return null;
  }
}

export function FormulaAndBackup({
  formula,
  onChangeFormula,
  onExportBackup,
  onImportBackup,
  customSpellCount = 0,
  onExportCustomSpells,
  canRevertReset,
  onResetAllData,
  onRevertReset,
}: FormulaAndBackupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupMsg, setBackupMsg] = useState<string>('');
  const [backupError, setBackupError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingBackupImport | null>(null);

  const milestones = getMasteryMilestones(formula);
  const statMilestones = getStatMilestones(formula);

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      setBackupError(true);
      setBackupMsg(`Copiá manualmente este enlace: ${window.location.origin}`);
    }
  };

  const handleDownload = () => {
    const content = onExportBackup();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const header = `=== ARCANE GRIMORIO · COPIA DE SEGURIDAD (${stamp}) ===\n`;
    const blob = new Blob([header + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcane-backup-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    setBackupError(false);
    setBackupMsg('Copia de seguridad .txt descargada correctamente.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const summary = summarizeBackupContent(text);
      if (!summary) {
        setBackupError(true);
        setBackupMsg('El archivo seleccionado no contiene una copia de seguridad válida.');
        setPendingImport(null);
        return;
      }
      setBackupError(false);
      setBackupMsg('');
      setPendingImport({
        fileName: file.name,
        rawContent: text,
        summary,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const res = onImportBackup(pendingImport.rawContent);
    setBackupError(!res.ok);
    setBackupMsg(res.message);
    setPendingImport(null);
  };

  const handleSwitchMasteryMode = (mode: MasteryGrowthMode) => {
    if (mode === 'custom') {
      const current = getMasteryMilestones(formula);
      onChangeFormula({
        ...formula,
        masteryGrowth: 'custom',
        masteryCustomMilestones: current,
      });
    } else {
      onChangeFormula({
        ...formula,
        masteryGrowth: mode,
      });
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12 items-start">
      {/* Fórmula de dados + Maestría por éxitos acumulados */}
      <div className="lg:col-span-6 space-y-5">
        <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--arc-border)] pb-3.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)]">
              Fórmula de dados por nivel
            </h2>
            <p className="text-[13px] text-[var(--arc-muted)] mt-0.5">
              Fórmula actual:{' '}
              <strong className="text-[var(--arc-accent)] font-mono-num">
                {formatFormulaText(formula)}
              </strong>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="f-base"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
              >
                Dados base
              </label>
              <input
                id="f-base"
                type="number"
                min={0}
                max={10}
                value={formula.base}
                onChange={(e) =>
                  onChangeFormula({
                    ...formula,
                    base: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="font-mono-num w-full min-h-[42px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-sm text-[var(--arc-text)]"
              />
            </div>

            <div>
              <label
                htmlFor="f-mult"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
              >
                Multiplicador por nivel
              </label>
              <input
                id="f-mult"
                type="number"
                min={0}
                max={5}
                value={formula.multiplier}
                onChange={(e) =>
                  onChangeFormula({
                    ...formula,
                    multiplier: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="font-mono-num w-full min-h-[42px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-sm text-[var(--arc-text)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Solo nivel (base)', base: 0, multiplier: 1 },
              { label: '1 + nivel', base: 1, multiplier: 1 },
              { label: '1 + 2×nivel', base: 1, multiplier: 2 },
              { label: '2 + nivel', base: 2, multiplier: 1 },
            ].map((preset) => {
              const active =
                formula.base === preset.base && formula.multiplier === preset.multiplier;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onChangeFormula({
                      ...formula,
                      base: preset.base,
                      multiplier: preset.multiplier,
                    })
                  }
                  className={`min-h-[36px] rounded-lg px-3 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)] font-semibold'
                      : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-[var(--arc-border)] pt-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[var(--arc-accent)]">
                  Hitos de nivel por característica (Físico, Manipulación, Influencia)
                </h3>
                <p className="text-xs text-[var(--arc-muted)] mt-0.5">
                  El PJ suma puntos libremente (ej. 11 o 14 mantiene su nivel hasta alcanzar el
                  siguiente hito).
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onChangeFormula({
                      ...formula,
                      statMilestones: [0, 10, 20, 40, 80, 160],
                    })
                  }
                  className="min-h-[30px] rounded-md bg-transparent px-2.5 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                >
                  Desde 10 (×2)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeFormula({
                      ...formula,
                      statMilestones: [0, 10, 20, 30, 40, 50],
                    })
                  }
                  className="min-h-[30px] rounded-md bg-transparent px-2.5 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                >
                  Lineal 10 en 10
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg bg-[var(--arc-surface-alt)]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--arc-border)] text-[var(--arc-muted)]">
                    <th className="py-2.5 px-3 text-left font-semibold">Nivel</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Hito (desde valor)</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Dados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--arc-border)] font-mono-num">
                  {statMilestones.map((ms, idx) => {
                    const lvl = idx + 1;
                    return (
                      <tr key={lvl}>
                        <td className="py-2 px-3 text-[var(--arc-text)]">Nivel {lvl}</td>
                        <td className="py-1.5 px-3 text-right">
                          {idx === 0 ? (
                            <span className="text-[var(--arc-muted)]">0 pts</span>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              max={9999}
                              value={ms}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                const next = [...statMilestones];
                                next[idx] = val;
                                onChangeFormula({ ...formula, statMilestones: next });
                              }}
                              aria-label={`Hito de valor para Nivel ${lvl}`}
                              className="font-mono-num w-20 min-h-[30px] rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-right text-xs text-[var(--arc-accent)]"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#8fb56a]">
                          {calcStatDice(lvl, formula)}d6
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label
              htmlFor="f-notes"
              className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
            >
              Notas del sistema / DM
            </label>
            <input
              id="f-notes"
              type="text"
              value={formula.notes}
              onChange={(e) => onChangeFormula({ ...formula, notes: e.target.value })}
              placeholder="Ej: Reglas de mesa confirmadas..."
              className="w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs text-[var(--arc-text)]"
            />
          </div>
        </section>

        {/* Maestría acumulada por hechizo */}
        <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-4">
          <div className="border-b border-[var(--arc-border)] pb-3.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)] inline-flex items-center gap-2">
              <Award className="h-4 w-4 text-[var(--arc-accent)]" />
              Maestría de hechizos (éxitos acumulados)
            </h2>
            <p className="text-[13px] text-[var(--arc-muted)] mt-1 leading-relaxed">
              Cada <strong className="text-[var(--arc-text)]">5 vale +1</strong> y cada{' '}
              <strong className="text-[var(--arc-text)]">6 vale +2</strong>; los negativos (1) no
              restan a la maestría. Sube de forma{' '}
              <strong className="text-[var(--arc-text)]">lineal de 10 en 10</strong> y aumenta el
              dado de daño en 1 categoría por nivel hasta{' '}
              <strong className="text-[var(--arc-text)]">2 veces</strong> (ej.{' '}
              <span className="font-mono-num">1d4 → 1d6 → 1d8</span>).
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MASTERY_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSwitchMasteryMode(m.id)}
                className={`min-h-[46px] rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  formula.masteryGrowth === m.id
                    ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                    : 'border-transparent bg-[var(--arc-surface-alt)] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)]/60 hover:text-[var(--arc-text)]'
                }`}
              >
                <div className="text-xs font-semibold">{m.label}</div>
                <div className="text-xs opacity-80 font-mono-num">{m.hint}</div>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {formula.masteryGrowth !== 'custom' && (
              <div>
                <label
                  htmlFor="m-base"
                  className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
                >
                  Subida lineal / base
                </label>
                <input
                  id="m-base"
                  type="number"
                  min={1}
                  max={500}
                  value={formula.masteryBaseMilestone}
                  onChange={(e) =>
                    onChangeFormula({
                      ...formula,
                      masteryBaseMilestone: Math.max(1, parseInt(e.target.value, 10) || 10),
                    })
                  }
                  className="font-mono-num w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-sm text-[var(--arc-text)]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="m-die-cap"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
              >
                Subidas máx. de dado
              </label>
              <input
                id="m-die-cap"
                type="number"
                min={0}
                max={4}
                value={formula.masteryMaxDieUpgrades}
                onChange={(e) =>
                  onChangeFormula({
                    ...formula,
                    masteryMaxDieUpgrades: Math.min(
                      4,
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    ),
                  })
                }
                className="font-mono-num w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-sm text-[var(--arc-text)]"
              />
            </div>

            <div className={formula.masteryGrowth === 'custom' ? 'sm:col-span-2' : ''}>
              <label
                htmlFor="m-bonus"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
              >
                +Éxitos aseg. / nivel
              </label>
              <input
                id="m-bonus"
                type="number"
                min={0}
                max={5}
                value={formula.masteryAssuredBonusPerLevel}
                onChange={(e) =>
                  onChangeFormula({
                    ...formula,
                    masteryAssuredBonusPerLevel: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="font-mono-num w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-sm text-[var(--arc-text)]"
              />
            </div>
          </div>

          {formula.masteryGrowth === 'custom' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx}>
                  <label className="block text-xs font-semibold text-[var(--arc-muted)] mb-1">
                    Hito Nv. {idx + 1}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={milestones[idx] ?? idx * 10}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      const next = [...milestones];
                      next[idx] = val;
                      onChangeFormula({
                        ...formula,
                        masteryCustomMilestones: next,
                      });
                    }}
                    className="font-mono-num w-full min-h-[38px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg bg-[var(--arc-surface-alt)]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--arc-border)] text-[var(--arc-muted)]">
                  <th className="py-2.5 px-3 text-left font-semibold">Maestría</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Hito (éxitos)</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Dado de daño</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Bono extra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--arc-border)] font-mono-num">
                {milestones.map((ms, idx) => {
                  const steps = Math.min(formula.masteryMaxDieUpgrades ?? 2, idx);
                  const example =
                    steps === 0
                      ? 'Base (ej. 1d4)'
                      : `+${steps} cat. (ej. ${steps === 1 ? '1d6' : '1d8'})`;
                  return (
                    <tr key={idx}>
                      <td className="py-2 px-3 text-[var(--arc-text)]">Nivel {idx + 1}</td>
                      <td className="py-2 px-3 text-right text-[var(--arc-accent)]">{ms} éxitos</td>
                      <td className="py-2 px-3 text-right text-[var(--arc-magic-accent)]">
                        {example}
                      </td>
                      <td className="py-2 px-3 text-right text-[#8fb56a]">
                        +{idx * (formula.masteryAssuredBonusPerLevel || 0)} aseg.
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Reglas del sistema + Compartir + Copias + Borrar info */}
      <div className="lg:col-span-6 space-y-5">
        <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)] border-b border-[var(--arc-border)] pb-2.5">
            Reglas de combate integradas
          </h2>
          <ul className="space-y-2.5 text-[13px] text-[var(--arc-text)] opacity-90 leading-relaxed">
            <li>
              <strong className="text-[var(--arc-text)]">Dados d6 y Maestría:</strong> 1 = 1 fallo ·
              5 = +1 éxito · 6 = +2 éxitos. Para la maestría del hechizo el negativo (1) no resta:
              los éxitos se acumulan de 10 en 10 y mejoran el dado de daño +1 categoría hasta 2 veces
              (1d4 → 1d6 → 1d8).
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Daño Mágico vs Físico:</strong> todos los
              hechizos hacen daño mágico aunque vayan con Físico. Las armas comunes hacen daño físico,
              y al imbuirlas pasan a hacer daño mágico, sirven para 1 solo ataque y luego se
              desintegran sin importar si aciertan.
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Catalizadores mágicos:</strong> al imbuirse
              hacen daño meramente mágico (1 mano: 1d6 + Inf + Man · Arco: 1d6 + Inf + Man · Grande:
              2d6 + Man + Inf). El Catalizador Escudo se expande según el maná usado y reduce en 1 el
              costo de maná de hechizos de protección.
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Casteo siempre funciona:</strong> declarar el
              casteo gasta 1 acción importante y prepara el hechizo (o activa efectos como Luz de Mago
              / Curar Heridas sin tirada de casteo).
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Defensa ante cualquier ataque:</strong> aunque
              el ataque saque neto negativo (ej. -1), pasa a defensa. El defensor evita el daño sacando
              más que el ataque (ej. 0 o más); si empata o saca menos, el daño se calcula salvo
              efectos que lo reduzcan o anulen.
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Empate (Ataque == Defensa):</strong> el
              ataque tiene éxito; se aplica el efecto del hechizo y se realiza una tirada adicional
              de dados para verificar los daños.
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Maná en 0 / PV en 0:</strong> 0 maná ={' '}
              <em>Inconsciente</em> · 0 PV puede ser <em>No letal</em> (Inconsciente) o <em>Letal</em>{' '}
              (Muerto).
            </li>
            <li>
              <strong className="text-[var(--arc-text)]">Estados alterados:</strong> se resuelven
              siempre mediante tirada de <em>Influencia</em> del lanzador contra <em>Influencia</em>{' '}
              del objetivo.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)] border-b border-[var(--arc-border)] pb-2.5">
            Compartir con amigos (un grimorio por jugador)
          </h2>
          <ol className="space-y-2 text-[13px] text-[var(--arc-text)] opacity-90 leading-relaxed list-decimal list-inside">
            <li>
              Compartí el enlace de la aplicación con tus amigos para que cada uno la abra en su
              dispositivo.
            </li>
            <li>
              Cada jugador crea su propio Mago eligiendo su elemento/naturaleza (que define su{' '}
              <em>Impacto Canalizado</em> de 1d4 y variante física) y sus hechizos quedan aislados.
            </li>
            <li>
              Luego pulsan <strong>Exportar PJ (.txt)</strong> o <strong>Copiar código</strong> en{' '}
              <em>Personajes y PNJs</em> y te lo envían para importarlos en tu mesa.
            </li>
          </ol>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="min-h-[40px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--arc-raised)] px-4 text-xs font-semibold text-[var(--arc-accent)] hover:brightness-110 transition-all"
          >
            {copiedLink ? (
              <Check className="h-4 w-4 text-[#a4d67e]" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {copiedLink ? 'Enlace copiado' : 'Copiar enlace para amigos'}
            <Copy className="h-3.5 w-3.5 opacity-70" />
          </button>
        </section>

        <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--arc-accent)] border-b border-[var(--arc-border)] pb-2.5">
            Copias de seguridad completas (.txt)
          </h2>
          <p className="text-[13px] text-[var(--arc-muted)] leading-relaxed">
            Todos los hechizos, maestrías, personajes, PNJs, temas y orden de cajas se guardan
            automáticamente en este navegador. Exportá o restaurá tu respaldo en{' '}
            <strong className="text-[var(--arc-text)]">.txt</strong> (también admite{' '}
            <strong className="text-[var(--arc-text)]">.json</strong> o códigos{' '}
            <span className="font-mono-num">ARCANE1:...</span>).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar copia (.txt)
            </button>
            {onExportCustomSpells && (
              <button
                type="button"
                disabled={customSpellCount === 0}
                onClick={() => {
                  const res = onExportCustomSpells();
                  setBackupError(!res.ok);
                  setBackupMsg(res.message);
                }}
                title={
                  customSpellCount === 0
                    ? 'Creá al menos un hechizo propio para exportar'
                    : `Descargar ${customSpellCount} hechizo(s) propio(s) en .txt`
                }
                className="min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--arc-raised)] px-4 text-xs font-semibold text-[var(--arc-accent)] hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-all"
              >
                <Download className="h-4 w-4" />
                Exportar hechizos propios{' '}
                <span className="font-mono-num">({customSpellCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-transparent px-4 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)] whitespace-nowrap shrink-0 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Importar respaldo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,text/plain,application/json"
              onChange={handleFileChange}
              hidden
            />
          </div>

          {pendingImport && (
            <div className="rounded-lg border border-[var(--arc-accent)]/60 bg-[var(--arc-surface-alt)] p-3 space-y-2.5 text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold text-[var(--arc-accent)]">
                  ¿Reemplazar los datos actuales con esta copia de seguridad?
                </p>
                <p className="text-[var(--arc-text)]">
                  Archivo: <strong className="font-mono-num">{pendingImport.fileName}</strong> ·{' '}
                  {pendingImport.summary}
                </p>
                <p className="text-[var(--arc-muted)]">
                  Esta acción sobrescribirá los personajes, hechizos y configuraciones actuales.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Confirmar restauración
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="min-h-[36px] rounded-lg px-3 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {backupMsg && (
            <p className={`text-xs ${backupError ? 'text-[#e88a70]' : 'text-[#a4d67e]'}`}>
              {backupMsg}
            </p>
          )}
        </section>

        {/* Borrar información + Revertir */}
        <section className="rounded-xl border border-[#5c2c22] bg-[#241411] p-4 sm:p-5 space-y-3">
          <div className="border-b border-[#4a261e] pb-2.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#f09a82] inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Restablecer aplicación
            </h2>
            <p className="text-[13px] text-[#cbb893] mt-1 leading-relaxed">
              Borra todos los datos introducidos y deja la app limpia (Mago en 0 pts / Nivel 1,
              Maniquí de pruebas y fórmula base por nivel). Podés revertir el borrado si te
              arrepentís.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-[#8f2e1b] px-4 text-xs font-semibold text-white hover:bg-[#ab3923] shadow-sm transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Borrar información
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onResetAllData();
                    setConfirmReset(false);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-[#a8321b] px-4 text-xs font-semibold text-white hover:bg-[#c23b21] shadow-sm transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Confirmar borrado total
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[40px] rounded-lg bg-transparent px-3.5 text-xs text-[#cbb893] hover:bg-black/25 hover:text-[#efe6d5] transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}

            {canRevertReset && (
              <button
                type="button"
                onClick={() => {
                  onRevertReset();
                  setConfirmReset(false);
                }}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-[#d4a843] px-4 text-xs font-semibold text-[#181209] hover:brightness-110 shadow-sm transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                Revertir borrado
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}