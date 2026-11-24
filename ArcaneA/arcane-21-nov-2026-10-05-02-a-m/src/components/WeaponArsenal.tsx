import { useState } from 'react';
import { Flame, Lock, Plus, RotateCcw, Shield, Sparkles, Swords, Trash2 } from 'lucide-react';
import type { Character, CharacterWeapon, FormulaConfig, StatKey } from '../types/rpg';
import {
  IMBUE_ELEMENTS,
  STAT_NAMES,
  WEAPON_PRESETS,
  type AggregatedStatusEffects,
  getCharacterStatDice,
  getHighestCharacterStat,
  getWeaponDamageFormula,
} from '../utils/dice';

interface WeaponArsenalProps {
  activeCharacter: Character | undefined;
  formula: FormulaConfig;
  isAttackLethal: boolean;
  actionsRemaining?: number;
  activeStatusEffects?: AggregatedStatusEffects;
  onRecoverDisarmedWeapon?: () => void;
  onAddWeapon: (presetId: string) => void;
  onRemoveWeapon: (weaponId: string) => void;
  onRestoreWeapon: (weaponId: string) => void;
  onImbueWeapon: (
    weaponId: string,
    element: string,
    manaCost: number,
    disintegratesAfterAttack: boolean
  ) => void;
  onClearImbuement: (weaponId: string) => void;
  onAttackWithWeapon: (weapon: CharacterWeapon, attackStat: StatKey) => void;
  onExpandShield: (weapon: CharacterWeapon, manaToSpend: number) => void;
}

const CATEGORY_LABELS: Record<CharacterWeapon['category'], string> = {
  melee: 'Cuerpo a cuerpo',
  ranged: 'A distancia',
  natural: 'Natural / Desarmado',
  catalyst: 'Catalizador mágico',
};

export function WeaponArsenal({
  activeCharacter,
  formula,
  isAttackLethal,
  actionsRemaining,
  activeStatusEffects,
  onRecoverDisarmedWeapon,
  onAddWeapon,
  onRemoveWeapon,
  onRestoreWeapon,
  onImbueWeapon,
  onClearImbuement,
  onAttackWithWeapon,
  onExpandShield,
}: WeaponArsenalProps) {
  const outOfTurnActions = typeof actionsRemaining === 'number' && actionsRemaining <= 0;
  const isDisarmed = Boolean(activeStatusEffects?.disarmed);
  const cannotAttackByStatus = Boolean(activeStatusEffects?.cannotAttack);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(WEAPON_PRESETS[0].id);
  const [imbuingWeaponId, setImbuingWeaponId] = useState<string | null>(null);
  const [imbueElement, setImbueElement] = useState<string>('Fuego');
  const [customElement, setCustomElement] = useState<string>('');
  const [imbueManaCost, setImbueManaCost] = useState<number>(1);
  const [disintegrates, setDisintegrates] = useState<boolean>(true);
  const [shieldManaInputs, setShieldManaInputs] = useState<Record<string, number>>({});
  const [weaponStatOverrides, setWeaponStatOverrides] = useState<
    Record<string, StatKey | 'highest'>
  >({});

  if (!activeCharacter) return null;

  const weapons = activeCharacter.weapons || [];
  const highestStatInfo = getHighestCharacterStat(activeCharacter, formula);
  const highestTiedLabel = highestStatInfo.tiedStats.map((k) => STAT_NAMES[k]).join(' / ');
  const meleePresets = WEAPON_PRESETS.filter((p) => p.category === 'melee');
  const rangedPresets = WEAPON_PRESETS.filter((p) => p.category === 'ranged');
  const naturalPresets = WEAPON_PRESETS.filter((p) => p.category === 'natural');
  const catalystPresets = WEAPON_PRESETS.filter((p) => p.category === 'catalyst');

  const selectedPreset = WEAPON_PRESETS.find((p) => p.id === selectedPresetId);

  const openImbueForm = (weapon: CharacterWeapon) => {
    if (imbuingWeaponId === weapon.id) {
      setImbuingWeaponId(null);
      return;
    }
    setImbuingWeaponId(weapon.id);
    setDisintegrates(!weapon.isNatural && !weapon.isMagicalCatalyst);
    setImbueManaCost(1);
  };

  const handleConfirmImbue = (weaponId: string) => {
    const finalElement =
      imbueElement === '__custom__' ? customElement.trim() || 'Elemento Arcano' : imbueElement;
    onImbueWeapon(weaponId, finalElement, Math.max(0, imbueManaCost), disintegrates);
    setImbuingWeaponId(null);
    setCustomElement('');
  };

  const getWeaponStatChoice = (weapon: CharacterWeapon): StatKey | 'highest' => {
    if (weaponStatOverrides[weapon.id]) return weaponStatOverrides[weapon.id];
    return weapon.isMagicalCatalyst ? 'highest' : 'fisico';
  };

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3.5 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--arc-border)] pb-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-xl font-bold text-[var(--arc-accent)] break-words">
            Armas, Catalizadores e Imbuición
          </h2>
          <p className="text-xs sm:text-[13px] text-[var(--arc-muted)] mt-0.5">
            Imbuir convierte el daño en{' '}
            <strong className="text-[var(--arc-text)]">mágico</strong>. Las armas comunes
            imbuidas se desintegran tras{' '}
            <strong className="text-[var(--arc-text)]">1 ataque</strong> (acierte o falle).
          </p>
        </div>
      </div>

      {isDisarmed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-[#7a3f28] bg-[#2a150e] px-3.5 py-2.5 text-xs text-[#ffd2be]">
          <span className="inline-flex items-start gap-1.5 font-medium leading-relaxed">
            <Lock className="h-3.5 w-3.5 text-[#ff9a76] shrink-0 mt-0.5" />
            <span>
              <strong>Desarmado:</strong> {activeCharacter.name} soltó su arma/escudo y no puede
              usarlos hasta gastar 1 acción en su turno para recuperarlos (armas naturales siguen
              disponibles).
            </span>
          </span>
          {onRecoverDisarmedWeapon && (
            <button
              type="button"
              disabled={outOfTurnActions || Boolean(activeStatusEffects?.cannotAct)}
              onClick={onRecoverDisarmedWeapon}
              title={
                outOfTurnActions
                  ? 'Sin acciones restantes en este turno'
                  : activeStatusEffects?.cannotAct
                    ? `Bloqueado por ${activeStatusEffects.cannotActReasons.join(', ')}`
                    : 'Gastar 1 acción de tu turno para recuperar tu arma y escudo'
              }
              className="min-h-[34px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-[#7c4820] px-3 text-xs font-semibold text-[#fff2de] hover:bg-[#945829] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Recuperar arma/escudo (1 acción)</span>
            </button>
          )}
        </div>
      )}

      {/* Selector para agregar armas o catalizadores */}
      <div className="space-y-2 border-b border-[var(--arc-border)] pb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            aria-label="Seleccionar categoría de arma o catalizador"
            className="w-full sm:flex-1 min-w-0 min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs text-[var(--arc-text)]"
          >
            <optgroup label="Armas cuerpo a cuerpo">
              {meleePresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.dice.map((d) => `${d.count}${d.type}`).join('+')})
                </option>
              ))}
            </optgroup>
            <optgroup label="Armas a distancia">
              {rangedPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.dice.map((d) => `${d.count}${d.type}`).join('+')})
                </option>
              ))}
            </optgroup>
            <optgroup label="Naturales / Desarmado">
              {naturalPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.dice.map((d) => `${d.count}${d.type}`).join('+')})
                </option>
              ))}
            </optgroup>
            <optgroup label="Catalizadores mágicos (armas especiales)">
              {catalystPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.dice.length > 0
                    ? ` (${p.dice.map((d) => `${d.count}${d.type}`).join('+')} + Inf + Man)`
                    : ' (Escudo / Rodela)'}
                </option>
              ))}
            </optgroup>
          </select>

          <button
            type="button"
            onClick={() => onAddWeapon(selectedPresetId)}
            className="min-h-[40px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-4 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm shrink-0 transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Equipar a {activeCharacter.name}</span>
          </button>
        </div>

        {selectedPreset && (
          <p className="text-xs text-[var(--arc-muted)]">{selectedPreset.description}</p>
        )}
      </div>

      {/* Lista de armas equipadas */}
      {weapons.length === 0 ? (
        <div className="rounded-lg bg-[var(--arc-surface-alt)] p-5 text-center text-xs sm:text-[13px] text-[var(--arc-muted)]">
          {activeCharacter.name} no tiene armas ni catalizadores equipados todavía. Elegí uno arriba
          para atacar o imbuir elementos.
        </div>
      ) : (
        <div className="space-y-3">
          {weapons.map((weapon) => {
            const dmgInfo = getWeaponDamageFormula(weapon, activeCharacter);
            const statChoice = getWeaponStatChoice(weapon);
            const attackStat: StatKey =
              statChoice === 'highest' ? highestStatInfo.stat : statChoice;
            const attackDice =
              statChoice === 'highest'
                ? highestStatInfo.dice
                : getCharacterStatDice(activeCharacter, attackStat, formula);
            const isShield = weapon.catalystKind === 'shield';
            const shieldMana = shieldManaInputs[weapon.id] ?? 1;
            const isImbueOpen = imbuingWeaponId === weapon.id;

            const isMagicalWeapon =
              !weapon.destroyed && (dmgInfo.damageKind === 'magico' || weapon.isMagicalCatalyst);

            return (
              <article
                key={weapon.id}
                className={`rounded-xl border p-3.5 sm:p-4 space-y-3 ${
                  weapon.destroyed
                    ? 'border-[#5a2c22] bg-[#1e1210] opacity-75'
                    : isMagicalWeapon
                      ? 'border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)]'
                      : 'border-[var(--arc-phys-border)] bg-[var(--arc-phys-bg)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3
                        className={`text-sm sm:text-base font-bold break-words ${
                          isMagicalWeapon
                            ? 'text-[var(--arc-magic-accent)]'
                            : 'text-[var(--arc-phys-accent)]'
                        }`}
                      >
                        {weapon.name}
                      </h3>
                      <span className="text-xs text-[var(--arc-muted)]">
                        · {CATEGORY_LABELS[weapon.category]}
                      </span>
                      {!weapon.destroyed && !isShield && (
                        <span
                          className={`text-xs font-semibold ${
                            dmgInfo.damageKind === 'magico'
                              ? 'text-[var(--arc-magic-accent)]'
                              : 'text-[var(--arc-phys-accent)]'
                          }`}
                        >
                          · Daño {dmgInfo.damageKind === 'magico' ? 'Mágico' : 'Físico'}
                        </span>
                      )}
                    </div>

                    {weapon.destroyed ? (
                      <p className="mt-1 text-xs sm:text-[13px] text-[#f09a82]">
                        Desintegrada: {weapon.destroyedReason || 'consumida tras el ataque imbuido'}.
                      </p>
                    ) : isShield ? (
                      <p className="mt-1 text-xs sm:text-[13px] text-[var(--arc-magic-text)] leading-relaxed">
                        Reduce en <strong className="font-mono-num">1</strong> el costo de maná de
                        hechizos de protección/defensa. Se expande según el maná que gastes.
                      </p>
                    ) : (
                      <div
                        className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-[13px] font-mono-num ${
                          isMagicalWeapon
                            ? 'text-[var(--arc-magic-text)]'
                            : 'text-[var(--arc-phys-text)]'
                        }`}
                      >
                        <span>Daño: {dmgInfo.text}</span>
                        <span>
                          Ataque: {attackDice}d6 (
                          {statChoice === 'highest'
                            ? `Mayor: ${highestTiedLabel}`
                            : STAT_NAMES[attackStat]}
                          )
                        </span>
                      </div>
                    )}

                    {!weapon.destroyed && weapon.imbued && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--arc-magic-raised)] px-2.5 py-0.5 font-semibold text-[var(--arc-magic-text)]">
                          <Flame className="h-3.5 w-3.5 text-[var(--arc-magic-accent)] shrink-0" />
                          Imbuida: {weapon.imbued.element} (1 ataque)
                        </span>
                        {weapon.imbued.disintegratesAfterAttack && (
                          <span className="text-xs text-[#f09a82]">
                            Se desintegra al atacar (acierte o falle)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {weapon.destroyed && (
                      <button
                        type="button"
                        onClick={() => onRestoreWeapon(weapon.id)}
                        title="Reponer arma nueva"
                        className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-transparent px-2.5 text-xs font-medium text-[var(--arc-text)] hover:bg-[var(--arc-raised)] transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reponer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveWeapon(weapon.id)}
                      title="Quitar arma"
                      aria-label={`Quitar ${weapon.name}`}
                      className="min-h-[34px] w-8 inline-flex items-center justify-center rounded-lg bg-transparent text-[var(--arc-muted)] hover:bg-[#361912] hover:text-[#e88a70] transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Controles específicos de Escudo Catalizador */}
                {!weapon.destroyed && isShield && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--arc-magic-border)]/60 pt-3 text-xs">
                    <Shield className="h-4 w-4 text-[var(--arc-magic-accent)] shrink-0" />
                    {isDisarmed ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#ffb89e]">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        Escudo soltado (Desarmado): sin bono de defensa ni expansión hasta
                        recuperarlo.
                      </span>
                    ) : (
                      <>
                        <span className="text-[var(--arc-magic-text)]">Expandir rodela (maná):</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, activeCharacter.mana.max)}
                          value={shieldMana}
                          onChange={(e) =>
                            setShieldManaInputs((prev) => ({
                              ...prev,
                              [weapon.id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                            }))
                          }
                          aria-label="Maná para expandir rodela"
                          className="font-mono-num w-16 min-h-[36px] rounded-md border border-[var(--arc-magic-border)] bg-[var(--arc-input)] px-2 text-center text-xs text-[var(--arc-text)]"
                        />
                        <button
                          type="button"
                          onClick={() => onExpandShield(weapon, shieldMana)}
                          className="min-h-[36px] inline-flex items-center justify-center rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm transition-colors"
                        >
                          Expandir ({shieldMana} maná)
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Controles de Imbuir / Atacar */}
                {!weapon.destroyed &&
                  !isShield &&
                  (() => {
                    const weaponBlockedByDisarm = isDisarmed && !weapon.isNatural;
                    const attackDisabled =
                      outOfTurnActions || cannotAttackByStatus || weaponBlockedByDisarm;
                    const disabledTitle = weaponBlockedByDisarm
                      ? 'Desarmado: gastá 1 acción en tu turno para recuperar el arma'
                      : cannotAttackByStatus
                        ? `No podés atacar (${activeStatusEffects?.cannotAttackReasons.join(', ')})`
                        : outOfTurnActions
                          ? 'Sin acciones restantes este turno — activá Hechizo Veloz o pasá el turno'
                          : undefined;
                    return (
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 border-t border-white/10 pt-3">
                        <select
                          value={statChoice}
                          onChange={(e) =>
                            setWeaponStatOverrides((prev) => ({
                              ...prev,
                              [weapon.id]: e.target.value as StatKey | 'highest',
                            }))
                          }
                          aria-label={`Atributo de ataque para ${weapon.name}`}
                          className="w-full sm:w-auto min-w-0 min-h-[38px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                        >
                          {weapon.isMagicalCatalyst && (
                            <option value="highest">
                              Mayor del PJ ({highestStatInfo.dice}d6 · {highestTiedLabel})
                            </option>
                          )}
                          <option value="fisico">Con Físico</option>
                          <option value="manipulacion">Con Manipulación</option>
                          <option value="influencia">Con Influencia</option>
                        </select>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={attackDisabled}
                            title={disabledTitle}
                            onClick={() => onAttackWithWeapon(weapon, attackStat)}
                            className="flex-1 sm:flex-initial min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                          >
                            {weaponBlockedByDisarm || cannotAttackByStatus ? (
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Swords className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span>
                              {weaponBlockedByDisarm
                                ? 'Soltada (Desarmado)'
                                : cannotAttackByStatus
                                  ? `Bloqueado (${activeStatusEffects?.cannotAttackReasons[0]})`
                                  : `Atacar (${isAttackLethal ? 'Letal' : 'No letal'})`}
                            </span>
                          </button>

                          {!weapon.imbued ? (
                            <button
                              type="button"
                              disabled={weaponBlockedByDisarm}
                              onClick={() => openImbueForm(weapon)}
                              className="flex-1 sm:flex-initial min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-surface-alt)] sm:bg-transparent px-3 text-xs font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Sparkles className="h-3.5 w-3.5 shrink-0" />
                              <span>Imbuir elemento</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onClearImbuement(weapon.id)}
                              className="min-h-[38px] rounded-lg bg-[var(--arc-surface-alt)] sm:bg-transparent px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                            >
                              Quitar imbuición
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                {/* Formulario inline para imbuir el arma */}
                {isImbueOpen && !weapon.destroyed && (
                  <div className="border-t border-[var(--arc-border)] pt-3 space-y-2.5">
                    <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <label className="block text-xs font-semibold text-[var(--arc-muted)] mb-1">
                          Elemento o propiedad a imbuir
                        </label>
                        <select
                          value={imbueElement}
                          onChange={(e) => setImbueElement(e.target.value)}
                          className="w-full min-h-[38px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                        >
                          {IMBUE_ELEMENTS.map((el) => (
                            <option key={el} value={el}>
                              {el}
                            </option>
                          ))}
                          <option value="__custom__">Otro (personalizado)...</option>
                        </select>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-xs font-semibold text-[var(--arc-muted)] mb-1">
                          Maná al imbuir
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={imbueManaCost}
                          onChange={(e) =>
                            setImbueManaCost(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="font-mono-num w-full min-h-[38px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                        />
                      </div>
                    </div>

                    {imbueElement === '__custom__' && (
                      <input
                        type="text"
                        value={customElement}
                        onChange={(e) => setCustomElement(e.target.value)}
                        placeholder="Ej: Ácido, Sangre, Cristal, Gravedad..."
                        className="w-full min-h-[38px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                      />
                    )}

                    <label className="inline-flex items-start gap-2 text-xs text-[var(--arc-text)] opacity-90 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disintegrates}
                        onChange={(e) => setDisintegrates(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--arc-accent)] shrink-0 mt-0.5"
                      />
                      <span>
                        Se desintegra tras 1 ataque (p. ej. se derrite/oxida sin importar si
                        acierta)
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmImbue(weapon.id)}
                        className="min-h-[36px] rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm transition-colors"
                      >
                        Confirmar imbuición
                      </button>
                      <button
                        type="button"
                        onClick={() => setImbuingWeaponId(null)}
                        className="min-h-[36px] rounded-lg bg-transparent px-3 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}