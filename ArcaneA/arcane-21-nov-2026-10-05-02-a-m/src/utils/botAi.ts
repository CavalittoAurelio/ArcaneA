import type {
  BotDifficulty,
  Character,
  CharacterWeapon,
  Combatant,
  DamageDivisor,
  DamageKind,
  FormulaConfig,
  PreparedSpell,
  Spell,
  StatKey,
} from '../types/rpg';
import {
  createWeaponFromPreset,
  evaluateSpellDependency,
  generateId,
  getCharacterStatDice,
  getCombatantStatusEffects,
  getEffectiveDefenseManaCost,
  getEffectiveEffectSubType,
  getMaxAffordableProtectionStacks,
  getSpellCastRequirement,
  getWeaponDamageFormula,
  isSpellMagical,
} from './dice';

export interface BotEnemyPreset {
  id: string;
  name: string;
  role: string;
  kind: 'mage' | 'npc';
  nature?: string;
  hp: number;
  mana: number;
  stats: { fisico: number; manipulacion: number; influencia: number };
  baseInitiative: number;
  knownSpells: string[];
  weaponPresetIds: string[];
  description: string;
}

export const BOT_ENEMY_PRESETS: BotEnemyPreset[] = [
  {
    id: 'bot_bandido',
    name: 'Bandido Ágil',
    role: 'Físico rápido',
    kind: 'npc',
    hp: 18,
    mana: 0,
    stats: { fisico: 2, manipulacion: 0, influencia: 1 },
    baseInitiative: 4,
    knownSpells: ['basic_golpe_fisico', 'basic_esquiva_fisica'],
    weaponPresetIds: ['wp_espada_corta', 'wp_daga'],
    description: 'Ataca cuerpo a cuerpo con Espada Corta (1d6) y esquiva con Físico.',
  },
  {
    id: 'bot_guardia',
    name: 'Guardia Blindado',
    role: 'Tanque físico',
    kind: 'npc',
    hp: 28,
    mana: 0,
    stats: { fisico: 3, manipulacion: 0, influencia: 1 },
    baseInitiative: 2,
    knownSpells: ['basic_golpe_fisico', 'basic_esquiva_fisica'],
    weaponPresetIds: ['wp_maza_corta', 'wp_espada_larga'],
    description: 'Alta vida (28 PV) y golpe contundente (1d8) para practicar combos largos.',
  },
  {
    id: 'bot_bestia',
    name: 'Bestia Salvaje',
    role: 'Agresivo natural',
    kind: 'npc',
    hp: 22,
    mana: 0,
    stats: { fisico: 3, manipulacion: 0, influencia: 1 },
    baseInitiative: 5,
    knownSpells: ['basic_golpe_fisico', 'basic_esquiva_fisica'],
    weaponPresetIds: ['wp_garras', 'wp_mordidas'],
    description: 'Criatura veloz con ataques naturales frecuentes y buena esquiva.',
  },
  {
    id: 'bot_hechicero',
    name: 'Hechicero Arcano',
    role: 'Mago equilibrado',
    kind: 'mage',
    nature: 'Arcano',
    hp: 20,
    mana: 12,
    stats: { fisico: 1, manipulacion: 3, influencia: 2 },
    baseInitiative: 4,
    knownSpells: [
      'basic_golpe_fisico',
      'basic_esquiva_fisica',
      'basic_ataque_canalizado',
      'basic_escudo_magico',
      'basic_proteccion',
      'basic_curar_heridas',
      'basic_destello_cegador',
      'basic_reforzar_hechizo',
      'basic_hechizo_veloz',
    ],
    weaponPresetIds: ['cat_1_mano'],
    description: 'Lanza Impacto Canalizado, ciega con Influencia, cura heridas y usa Escudo Mágico.',
  },
  {
    id: 'bot_duelista_magico',
    name: 'Duelista de Batalla',
    role: 'Híbrido táctico',
    kind: 'mage',
    nature: 'Rayo / Electricidad',
    hp: 24,
    mana: 14,
    stats: { fisico: 2, manipulacion: 3, influencia: 2 },
    baseInitiative: 3,
    knownSpells: [
      'basic_golpe_fisico',
      'basic_esquiva_fisica',
      'basic_ataque_canalizado',
      'basic_escudo_magico',
      'basic_maniobra_defensiva',
      'basic_proteccion',
      'basic_choque_noqueador',
      'basic_reforzar_hechizo',
      'basic_hechizo_veloz',
    ],
    weaponPresetIds: ['wp_espada_corta', 'cat_escudo'],
    description: 'Combina espada, Escudo catalizador, Onda Contundente y ataques canalizados.',
  },
];

export function createBotCharacterFromPreset(
  preset: BotEnemyPreset,
  copyIndex: number
): Character {
  const weapons = preset.weaponPresetIds
    .map((pid) => createWeaponFromPreset(pid))
    .filter((w): w is CharacterWeapon => Boolean(w));

  return {
    id: generateId('botch_'),
    name: copyIndex > 1 ? `${preset.name} #${copyIndex}` : preset.name,
    kind: preset.kind,
    nature: preset.nature,
    stats: { ...preset.stats },
    hp: { current: preset.hp, max: preset.hp },
    mana: { current: preset.mana, max: preset.mana },
    knownSpells: [...preset.knownSpells],
    spellMastery: {},
    weapons,
    condition: 'active',
    notes: `[Bot · ${preset.role}] ${preset.description}`,
    isBotPreset: true,
  };
}

function estimateDiceAverage(dice: Array<{ type: string; count: number }>, bonus = 0): number {
  const dieAvg: Record<string, number> = { d4: 2.5, d6: 3.5, d8: 4.5, d10: 5.5, d12: 6.5 };
  return (
    dice.reduce((sum, d) => sum + (dieAvg[d.type] || 3.5) * Math.max(0, d.count), 0) + bonus
  );
}

export type BotTurnDecision =
  | { type: 'heal'; spell: Spell; targetCharacterId: string }
  | { type: 'recover_weapon' }
  | { type: 'attack_prepared'; prepared: PreparedSpell; spell: Spell; targetCombatantId: string }
  | { type: 'cast_buff'; spell: Spell }
  | { type: 'cast_prepare'; spell: Spell }
  | { type: 'apply_status'; spell: Spell; targetCombatantId: string }
  | { type: 'attack_spell'; spell: Spell; targetCombatantId: string }
  | { type: 'attack_weapon'; weapon: CharacterWeapon; attackStat: StatKey; targetCombatantId: string }
  | { type: 'pass' };

export function chooseBotTurnAction(params: {
  botCombatant: Combatant;
  botChar: Character;
  allCombatants: Combatant[];
  allCharacters: Character[];
  spells: Spell[];
  formula: FormulaConfig;
  manaMode: 'auto' | 'manual';
  difficulty: BotDifficulty;
}): BotTurnDecision {
  const {
    botCombatant,
    botChar,
    allCombatants,
    allCharacters,
    spells,
    formula,
    manaMode,
    difficulty,
  } = params;

  const enemyTargets = allCombatants.filter((cb) => {
    if (cb.id === botCombatant.id) return false;
    if (cb.isBotControlled) return false;
    const ch = allCharacters.find((c) => c.id === cb.characterId);
    return Boolean(ch && ch.condition === 'active');
  });

  if (enemyTargets.length === 0) {
    return { type: 'pass' };
  }

  // En modo táctico prioriza al objetivo con menos PV; en normal elige el primer jugador activo (o aleatorio leve)
  const targetCb =
    difficulty === 'tactical'
      ? [...enemyTargets].sort((a, b) => {
          const chA = allCharacters.find((c) => c.id === a.characterId);
          const chB = allCharacters.find((c) => c.id === b.characterId);
          return (chA?.hp.current ?? 999) - (chB?.hp.current ?? 999);
        })[0]
      : enemyTargets[Math.floor(Math.random() * enemyTargets.length)];

  const botEffects = getCombatantStatusEffects(botCombatant, botChar);
  if (botEffects.cannotAct || botEffects.cannotAttack) {
    return { type: 'pass' };
  }

  const canAfford = (cost: number) => manaMode === 'manual' || botChar.mana.current >= cost;
  const isDepMet = (spell: Spell) =>
    evaluateSpellDependency({
      spell,
      casterCharacterId: botChar.id,
      combatants: allCombatants,
      characters: allCharacters,
      targetCombatantId: targetCb.id,
    }).met;
  const isSpellAllowed = (spell: Spell) =>
    !(botEffects.cannotCastMagic && isSpellMagical(spell)) && isDepMet(spell);
  const knownSpells = botChar.knownSpells
    .map((id) => spells.find((s) => s.id === id))
    .filter((s): s is Spell => Boolean(s))
    .filter(isSpellAllowed);

  // Si está desarmado y depende de armas no naturales, gasta 1 acción en recuperarla
  if (
    botEffects.disarmed &&
    (botChar.weapons || []).some((w) => !w.destroyed && !w.isNatural) &&
    botChar.kind === 'npc'
  ) {
    return { type: 'recover_weapon' };
  }

  // 1. Curación de emergencia si baja de 45% PV
  const hpRatio = botChar.hp.max > 0 ? botChar.hp.current / botChar.hp.max : 1;
  if (hpRatio <= (difficulty === 'tactical' ? 0.5 : 0.35)) {
    const healSpell = knownSpells.find((s) => s.effectType === 'heal' && canAfford(s.manaCost));
    if (healSpell) {
      return { type: 'heal', spell: healSpell, targetCharacterId: botChar.id };
    }
  }

  // 2. Si ya tiene un hechizo de ataque preparado, atacar con él (0 maná)
  if (botCombatant.preparedSpells.length > 0) {
    const usablePrep = botCombatant.preparedSpells
      .map((prep) => ({ prep, spell: spells.find((s) => s.id === prep.spellId) }))
      .find((entry): entry is { prep: PreparedSpell; spell: Spell } => Boolean(entry.spell && isDepMet(entry.spell)));
    if (usablePrep) {
      return {
        type: 'attack_prepared',
        prepared: usablePrep.prep,
        spell: usablePrep.spell,
        targetCombatantId: targetCb.id,
      };
    }
  }

  // 3. En modo táctico: activar Armadura / Buff defensivo si conoce alguno y no está activo
  if (difficulty === 'tactical') {
    const activeNames = new Set((botCombatant.activeStatuses || []).map((st) => st.name));
    const armorOrBuff = knownSpells.find(
      (s) =>
        s.effectType === 'effect' &&
        getEffectiveEffectSubType(s) === 'buff' &&
        s.id !== 'basic_proteccion' &&
        s.id !== 'basic_reforzar_hechizo' &&
        s.id !== 'basic_hechizo_veloz' &&
        s.id !== 'basic_elevar_limite' &&
        Boolean(s.armorConfig?.isArmor) &&
        !activeNames.has(s.name) &&
        canAfford(s.manaCost)
    );
    if (armorOrBuff) {
      return { type: 'cast_buff', spell: armorOrBuff };
    }
  }

  // 4. Debuff ocasional si el objetivo no lo tiene todavía (solo magos con Influencia)
  const targetStatusNames = new Set((targetCb.activeStatuses || []).map((st) => st.name));
  const debuffSpells = knownSpells.filter(
    (s) =>
      s.effectType === 'effect' &&
      ((s.statuses && s.statuses.length > 0) || getEffectiveEffectSubType(s) === 'debuff') &&
      canAfford(s.manaCost) &&
      !(s.statuses || []).every((stName) => targetStatusNames.has(stName))
  );
  if (debuffSpells.length > 0 && Math.random() < (difficulty === 'tactical' ? 0.35 : 0.2)) {
    return {
      type: 'apply_status',
      spell: debuffSpells[0],
      targetCombatantId: targetCb.id,
    };
  }

  // 5. Evaluar mejor ataque (hechizos de daño vs armas equipadas)
  const affordableDamageSpells = knownSpells.filter(
    (s) => s.effectType === 'damage' && canAfford(s.manaCost)
  );
  const usableWeapons = (botChar.weapons || []).filter(
    (w) => !w.destroyed && w.catalystKind !== 'shield' && (!botEffects.disarmed || Boolean(w.isNatural))
  );

  // Construir candidatos ofensivos con estimación de valor
  type Candidate =
    | { score: number; action: BotTurnDecision }
    | null;

  const candidates: Array<{ score: number; action: BotTurnDecision }> = [];

  for (const sp of affordableDamageSpells) {
    const req = getSpellCastRequirement(sp);
    const avgDmg = estimateDiceAverage(sp.damage.dice, sp.damage.bonus);
    const statDice = (sp.combatStats.length > 0 ? sp.combatStats : (['fisico'] as StatKey[])).reduce(
      (sum, st) => sum + getCharacterStatDice(botChar, st, formula),
      0
    );
    const score = avgDmg + statDice * 0.8 + (sp.manaCost > 0 ? 1.5 : 0);
    if (req === 'prepare') {
      candidates.push({
        score: score * 0.9,
        action: { type: 'cast_prepare', spell: sp },
      });
    } else {
      candidates.push({
        score,
        action: { type: 'attack_spell', spell: sp, targetCombatantId: targetCb.id },
      });
    }
  }

  for (const w of usableWeapons) {
    const dmg = getWeaponDamageFormula(w, botChar);
    const avgDmg = estimateDiceAverage(dmg.dice, dmg.bonus);
    const bestStat: StatKey = w.isMagicalCatalyst
      ? botChar.stats.manipulacion >= botChar.stats.fisico
        ? 'manipulacion'
        : 'fisico'
      : 'fisico';
    const statDice = getCharacterStatDice(botChar, bestStat, formula);
    const score = avgDmg + statDice * 0.85 + 0.5;
    candidates.push({
      score,
      action: {
        type: 'attack_weapon',
        weapon: w,
        attackStat: bestStat,
        targetCombatantId: targetCb.id,
      },
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const chosen: Candidate =
      difficulty === 'tactical' || candidates.length === 1
        ? candidates[0]
        : candidates[Math.random() < 0.7 ? 0 : Math.min(1, candidates.length - 1)];
    if (chosen) return chosen.action;
  }

  // Fallback a Golpe Físico si existe
  const fallbackPunch = spells.find((s) => s.id === 'basic_golpe_fisico');
  if (fallbackPunch) {
    return { type: 'attack_spell', spell: fallbackPunch, targetCombatantId: targetCb.id };
  }

  return { type: 'pass' };
}

export function chooseBotDefenseChoice(params: {
  defenderChar: Character;
  defenderCombatant?: Combatant;
  spells: Spell[];
  formula: FormulaConfig;
  manaMode: 'auto' | 'manual';
  difficulty: BotDifficulty;
}): string {
  const { defenderChar, defenderCombatant, spells, formula, manaMode, difficulty } = params;
  const defEffects = getCombatantStatusEffects(defenderCombatant, defenderChar);

  let bestChoice = 'stat:fisico';
  let bestScore = getCharacterStatDice(defenderChar, 'fisico', formula);

  const defSpells = defenderChar.knownSpells
    .map((id) => spells.find((s) => s.id === id))
    .filter(
      (s): s is Spell =>
        Boolean(s && s.effectType === 'defense' && !(defEffects.cannotCastMagic && isSpellMagical(s)))
    );

  for (const sp of defSpells) {
    const manaInfo = getEffectiveDefenseManaCost(defenderChar, sp, defEffects.disarmed);
    if (manaMode === 'auto' && defenderChar.mana.current < manaInfo.cost) continue;
    // En modo normal no gasta el último punto de maná en escudo si tiene buena esquiva física
    if (
      difficulty === 'normal' &&
      manaInfo.cost > 0 &&
      defenderChar.mana.current - manaInfo.cost <= 1
    ) {
      continue;
    }
    const stats = sp.combatStats.length > 0 ? sp.combatStats : (['fisico'] as StatKey[]);
    const dice = stats.reduce(
      (sum, st) => sum + getCharacterStatDice(defenderChar, st, formula),
      0
    );
    const score = dice + sp.assuredSuccess * 1.2 + (manaInfo.cost === 0 ? 0.3 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestChoice = `spell:${sp.id}`;
    }
  }

  return bestChoice;
}

export function getBotArmorModifiers(combatant: Combatant): {
  reduction: number;
  divisor: DamageDivisor;
} {
  let reduction = 0;
  let divisor: DamageDivisor = 1;
  for (const st of combatant.activeStatuses || []) {
    if (typeof st.armorReduction === 'number' && st.armorReduction > 0) {
      reduction += st.armorReduction;
    }
    if (st.armorDivisor === 0) {
      divisor = 0;
    } else if (st.armorDivisor === 4 && divisor !== 0) {
      divisor = 4;
    } else if (st.armorDivisor === 2 && divisor === 1) {
      divisor = 2;
    }
  }
  return { reduction, divisor };
}

export function chooseBotProtectionStacks(params: {
  defenderChar: Character;
  defenderCombatant?: Combatant;
  spells: Spell[];
  rawDamage: number;
  armorReduction: number;
  damageKind: DamageKind;
  manaMode: 'auto' | 'manual';
  difficulty: BotDifficulty;
}): number {
  const {
    defenderChar,
    defenderCombatant,
    spells,
    rawDamage,
    armorReduction,
    damageKind,
    manaMode,
    difficulty,
  } = params;

  const defEffects = getCombatantStatusEffects(defenderCombatant, defenderChar);
  if (defEffects.cannotReact || defEffects.cannotCastMagic) return 0;

  const netBeforeProt = Math.max(0, rawDamage - armorReduction);
  if (netBeforeProt <= 2) return 0;

  const knowsProt = defenderChar.knownSpells.includes('basic_proteccion');
  if (!knowsProt) return 0;

  const maxAffordable = getMaxAffordableProtectionStacks(
    defenderChar,
    spells,
    manaMode,
    undefined,
    defEffects.disarmed
  );
  if (maxAffordable <= 0) return 0;

  const reductionPerStack = damageKind === 'magico' ? 3 : 5;
  const wouldDropLow = defenderChar.hp.current - netBeforeProt <= Math.ceil(defenderChar.hp.max * 0.35);

  if (difficulty === 'tactical') {
    if (wouldDropLow || netBeforeProt >= reductionPerStack + 2) {
      return Math.min(maxAffordable, wouldDropLow && netBeforeProt >= reductionPerStack * 2 ? 2 : 1);
    }
    return 0;
  }

  // Normal: usa 1 protección solo si el golpe es fuerte y le queda maná cómodo
  if (netBeforeProt >= 6 && (manaMode === 'manual' || defenderChar.mana.current >= 4)) {
    return 1;
  }
  return 0;
}