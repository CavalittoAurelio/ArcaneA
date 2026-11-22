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
  detectSpellSynergy,
  evaluateSpellDependency,
  generateId,
  getCharacterStatDice,
  getCombatantStatusEffects,
  getEffectiveDefenseManaCost,
  getEffectiveEffectSubType,
  getEffectiveSpellDamageKind,
  getMaxAffordableProtectionStacks,
  getSpellCastRequirement,
  getStatusElementalKind,
  getWeaponDamageFormula,
  isSpellMagical,
  matchesDispelScope,
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

function analyzeTargetDefenses(targetCb: Combatant, targetChar?: Character) {
  const armor = getBotArmorModifiers(targetCb);
  const statuses = targetCb.activeStatuses || [];
  const armorElements = statuses
    .map((st) => (st.armorElement || '').trim().toLowerCase())
    .filter(Boolean);
  const resText = (targetChar?.resistances || '').trim().toLowerCase();

  let hasShieldCharges = 0;
  let dispellableDefenseCount = 0;
  for (const st of statuses) {
    if (typeof st.remainingHits === 'number' && st.remainingHits > 0) {
      hasShieldCharges += st.remainingHits;
    }
    if (
      (st.armorReduction || 0) > 0 ||
      Boolean(st.armorElement) ||
      (st.armorDivisor !== undefined && st.armorDivisor !== 1) ||
      (st.remainingHits || 0) > 0
    ) {
      dispellableDefenseCount += 1;
    }
  }

  return {
    reduction: armor.reduction,
    divisor: armor.divisor,
    armorElements,
    resText,
    hasShieldCharges,
    dispellableDefenseCount,
    isImmuneAll: armor.divisor === 0,
    isResistantAll: armor.divisor === 2 || armor.divisor === 4,
    resistsPhysicalText:
      resText.includes('físico') ||
      resText.includes('fisico') ||
      resText.includes('cortante') ||
      resText.includes('contundente') ||
      resText.includes('perforante'),
    resistsMagicText:
      resText.includes('mágico') ||
      resText.includes('magico') ||
      resText.includes('arcano'),
    weakToFire: resText.includes('débil fuego') || resText.includes('debil fuego') || resText.includes('vulnerable fuego'),
    weakToIce: resText.includes('débil hielo') || resText.includes('debil hielo') || resText.includes('vulnerable hielo'),
    weakToLightning:
      resText.includes('débil rayo') ||
      resText.includes('debil rayo') ||
      resText.includes('débil electric') ||
      resText.includes('debil electric'),
  };
}

function estimateEffectiveDamage(
  rawAvg: number,
  dmgKind: DamageKind,
  tagsText: string,
  def: ReturnType<typeof analyzeTargetDefenses>
): number {
  if (def.isImmuneAll) return 0;

  let afterReduction = Math.max(0, rawAvg - def.reduction);
  if (def.divisor === 2) afterReduction = afterReduction / 2;
  else if (def.divisor === 4) afterReduction = afterReduction / 4;

  const lowerTags = tagsText.toLowerCase();
  if (dmgKind === 'fisico' && def.resistsPhysicalText) {
    afterReduction *= 0.65;
  } else if (dmgKind === 'magico' && def.resistsMagicText) {
    afterReduction *= 0.65;
  }

  // Penalización si el objetivo tiene una armadura elemental del mismo elemento que el ataque
  for (const el of def.armorElements) {
    if (el && lowerTags.includes(el)) {
      afterReduction *= 0.5;
    }
  }

  // Bonificación si aprovecha una debilidad documentada en las resistencias del blanco
  if (def.weakToFire && (lowerTags.includes('fuego') || lowerTags.includes('ígneo') || lowerTags.includes('igneo'))) {
    afterReduction *= 1.4;
  }
  if (def.weakToIce && (lowerTags.includes('hielo') || lowerTags.includes('frío') || lowerTags.includes('frio'))) {
    afterReduction *= 1.4;
  }
  if (def.weakToLightning && (lowerTags.includes('rayo') || lowerTags.includes('electric'))) {
    afterReduction *= 1.4;
  }

  return afterReduction;
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

  const botEffects = getCombatantStatusEffects(botCombatant, botChar);
  if (botEffects.cannotAct || botEffects.cannotAttack) {
    return { type: 'pass' };
  }

  const manaUnconsciousRisk =
    manaMode === 'auto' &&
    botChar.mana.max > 0 &&
    !botChar.ignoreManaUnconsciousness;

  const canAfford = (cost: number) => manaMode === 'manual' || botChar.mana.current >= cost;

  // En modo táctico evita dejarse a 0 de maná si eso lo deja Inconsciente automáticamente
  const canSafelySpendMana = (cost: number, allowDesperate = false) => {
    if (!canAfford(cost)) return false;
    if (cost <= 0 || !manaUnconsciousRisk) return true;
    const remaining = botChar.mana.current - cost;
    if (remaining >= 1) return true;
    return allowDesperate;
  };

  const manaRatio =
    botChar.mana.max > 0 ? botChar.mana.current / botChar.mana.max : 1;
  const isLowMana = manaMode === 'auto' && botChar.mana.max > 0 && manaRatio <= 0.3;

  // Selección de objetivo: en modo táctico pondera poca vida, falta de armadura y sinergias elementales activas
  const targetCb =
    difficulty === 'tactical'
      ? [...enemyTargets].sort((a, b) => {
          const scoreTarget = (cb: Combatant) => {
            const ch = allCharacters.find((c) => c.id === cb.characterId);
            const hp = ch?.hp.current ?? 999;
            const hpMax = Math.max(1, ch?.hp.max ?? 20);
            const def = analyzeTargetDefenses(cb, ch);
            const statuses = cb.activeStatuses || [];
            const hasPrimer = statuses.some((st) => Boolean(getStatusElementalKind(st)));
            let priority = (hp / hpMax) * 10 + hp * 0.25;
            priority += def.reduction * 1.4 + def.hasShieldCharges * 2.5;
            if (def.isImmuneAll) priority += 25;
            if (hasPrimer) priority -= 3.5;
            return priority;
          };
          return scoreTarget(a) - scoreTarget(b);
        })[0]
      : enemyTargets[Math.floor(Math.random() * enemyTargets.length)];

  const targetChar = allCharacters.find((c) => c.id === targetCb.characterId);
  const targetDefenses = analyzeTargetDefenses(targetCb, targetChar);

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
    (botChar.kind === 'npc' || isLowMana)
  ) {
    return { type: 'recover_weapon' };
  }

  // 1. Curación táctica (propia o de un aliado bot en apuros)
  const hpRatio = botChar.hp.max > 0 ? botChar.hp.current / botChar.hp.max : 1;
  const criticalSelfThreshold = difficulty === 'tactical' ? 0.55 : 0.35;
  const healSpells = knownSpells
    .filter((s) => s.effectType === 'heal' && canSafelySpendMana(s.manaCost, hpRatio <= 0.3))
    .sort((a, b) => a.manaCost - b.manaCost);

  if (healSpells.length > 0) {
    if (hpRatio <= criticalSelfThreshold) {
      return { type: 'heal', spell: healSpells[0], targetCharacterId: botChar.id };
    }
    if (difficulty === 'tactical' && !isLowMana) {
      const injuredAlly = allCombatants
        .filter((cb) => cb.isBotControlled && cb.id !== botCombatant.id)
        .map((cb) => allCharacters.find((c) => c.id === cb.characterId))
        .filter((ch): ch is Character => Boolean(ch && ch.condition === 'active' && ch.hp.max > 0))
        .filter((ch) => ch.hp.current / ch.hp.max <= 0.45)
        .sort((a, b) => a.hp.current / a.hp.max - b.hp.current / b.hp.max)[0];

      if (injuredAlly) {
        return { type: 'heal', spell: healSpells[0], targetCharacterId: injuredAlly.id };
      }
    }
  }

  // 2. Si ya tiene un hechizo de ataque preparado, lanzarlo antes de que expire (0 maná)
  if (botCombatant.preparedSpells.length > 0) {
    const usablePrep = botCombatant.preparedSpells
      .map((prep) => ({ prep, spell: spells.find((s) => s.id === prep.spellId) }))
      .find(
        (entry): entry is { prep: PreparedSpell; spell: Spell } =>
          Boolean(entry.spell && isDepMet(entry.spell))
      );
    if (usablePrep) {
      return {
        type: 'attack_prepared',
        prepared: usablePrep.prep,
        spell: usablePrep.spell,
        targetCombatantId: targetCb.id,
      };
    }
  }

  // 3. En modo táctico: disipar armaduras o escudos activos del objetivo si tiene un hechizo de disipación
  if (difficulty === 'tactical' && targetDefenses.dispellableDefenseCount > 0) {
    const dispelSpell = knownSpells.find((sp) => {
      if (!sp.dispelConfig?.enabled) return false;
      if (!canSafelySpendMana(sp.manaCost, false)) return false;
      return (targetCb.activeStatuses || []).some((st) =>
        matchesDispelScope(st, sp.dispelConfig!.scope)
      );
    });
    if (dispelSpell) {
      return {
        type: 'apply_status',
        spell: dispelSpell,
        targetCombatantId: targetCb.id,
      };
    }
  }

  // 4. En modo táctico: activar Armadura / Buff defensivo si no está activo y hay margen de maná
  if (difficulty === 'tactical' && !isLowMana) {
    const activeNames = new Set((botCombatant.activeStatuses || []).map((st) => st.name));
    const armorOrBuff = knownSpells.find(
      (s) =>
        s.effectType === 'effect' &&
        getEffectiveEffectSubType(s) === 'buff' &&
        s.id !== 'basic_proteccion' &&
        s.id !== 'basic_reforzar_hechizo' &&
        s.id !== 'basic_hechizo_veloz' &&
        s.id !== 'basic_elevar_limite' &&
        Boolean(s.armorConfig?.isArmor || (s.maxHits ?? 0) > 0) &&
        !activeNames.has(s.name) &&
        canSafelySpendMana(s.manaCost, false)
    );
    if (armorOrBuff) {
      return { type: 'cast_buff', spell: armorOrBuff };
    }
  }

  // 5. Debuff o estado elemental preparador si el objetivo no lo tiene todavía
  const targetStatusNames = new Set((targetCb.activeStatuses || []).map((st) => st.name));
  const debuffSpells = knownSpells.filter(
    (s) =>
      s.effectType === 'effect' &&
      ((s.statuses && s.statuses.length > 0) ||
        Boolean(s.elementalStatus) ||
        getEffectiveEffectSubType(s) === 'debuff') &&
      canSafelySpendMana(s.manaCost, false) &&
      !(s.statuses || []).every((stName) => targetStatusNames.has(stName))
  );
  const debuffChance = difficulty === 'tactical' ? (isLowMana ? 0.15 : 0.4) : 0.2;
  if (debuffSpells.length > 0 && Math.random() < debuffChance) {
    return {
      type: 'apply_status',
      spell: debuffSpells[0],
      targetCombatantId: targetCb.id,
    };
  }

  // 6. Evaluar mejor ataque (hechizos de daño vs armas equipadas)
  const affordableDamageSpells = knownSpells.filter(
    (s) => s.effectType === 'damage' && canAfford(s.manaCost)
  );
  const usableWeapons = (botChar.weapons || []).filter(
    (w) =>
      !w.destroyed &&
      w.catalystKind !== 'shield' &&
      (!botEffects.disarmed || Boolean(w.isNatural))
  );

  const candidates: Array<{ score: number; action: BotTurnDecision }> = [];

  for (const sp of affordableDamageSpells) {
    const req = getSpellCastRequirement(sp);
    const dmgKind = getEffectiveSpellDamageKind(sp);
    const rawAvgDmg = estimateDiceAverage(sp.damage.dice, sp.damage.bonus);
    const tagsText = [sp.name, ...(sp.orders || []), sp.damage.notes || ''].join(' ');
    const effectiveAvgDmg =
      difficulty === 'tactical'
        ? estimateEffectiveDamage(rawAvgDmg, dmgKind, tagsText, targetDefenses)
        : rawAvgDmg;

    const statDice = (sp.combatStats.length > 0 ? sp.combatStats : (['fisico'] as StatKey[])).reduce(
      (sum, st) => sum + getCharacterStatDice(botChar, st, formula),
      0
    );

    let score = effectiveAvgDmg + statDice * 0.8 + (sp.manaCost > 0 ? 1.2 : 0.4);

    if (difficulty === 'tactical') {
      // Penalizar fuertemente si la armadura del objetivo absorbe todo el daño esperado
      if (rawAvgDmg > 0 && effectiveAvgDmg <= 0.5) {
        score -= 6.5;
      }

      // Bonus por atravesar armaduras físicas con daño mágico (o viceversa)
      if (targetDefenses.resistsPhysicalText && dmgKind === 'magico') {
        score += 2.2;
      } else if (targetDefenses.resistsMagicText && dmgKind === 'fisico') {
        score += 2.2;
      }

      // Evaluación de Sinergias Elementales
      const syn = detectSpellSynergy(sp);
      const targetStatuses = targetCb.activeStatuses || [];
      const hasBurn = targetStatuses.some((st) => getStatusElementalKind(st) === 'burn');
      const hasPoison = targetStatuses.some((st) => getStatusElementalKind(st) === 'poison');
      const hasFrozen = targetStatuses.some((st) => getStatusElementalKind(st) === 'frozen');
      const hasElectrified = targetStatuses.some((st) => getStatusElementalKind(st) === 'electrified');
      const hasBleed = targetStatuses.some((st) => getStatusElementalKind(st) === 'bleeding');

      if (syn === 'detonate_burn' && hasBurn) score += 5.5;
      else if (syn === 'siphon_poison' && hasPoison) score += 5.0;
      else if (syn === 'shatter_frozen' && hasFrozen) score += 6.0;
      else if (syn === 'overload_electrified' && hasElectrified) score += 5.5;
      else if (syn === 'hemorrhage_bleed' && hasBleed) score += 5.0;

      // Remate de objetivo frágil
      const isFinishingBlow = Boolean(
        targetChar && targetChar.hp.current > 0 && effectiveAvgDmg >= targetChar.hp.current
      );
      if (targetChar && targetChar.hp.max > 0) {
        const targetHpRatio = targetChar.hp.current / targetChar.hp.max;
        if (targetHpRatio <= 0.3) {
          score += 3.0;
        }
      }

      // Conservación de maná: evitar caer a 0 de maná (Inconsciente) y cuidar reserva baja
      if (manaMode === 'auto' && sp.manaCost > 0) {
        const remainingAfter = botChar.mana.current - sp.manaCost;
        if (manaUnconsciousRisk && remainingAfter <= 0) {
          score += isFinishingBlow ? 2.0 : -15.0;
        } else if (isLowMana) {
          score -= sp.manaCost * 1.6;
        } else if (remainingAfter <= 2 && botChar.mana.max >= 6) {
          score -= sp.manaCost * 0.7;
        }
      } else if (isLowMana && sp.manaCost === 0) {
        score += 2.5;
      }
    }

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
    const rawAvgDmg = estimateDiceAverage(dmg.dice, dmg.bonus);
    const tagsText = [w.name, w.imbued?.element || ''].join(' ');
    const effectiveAvgDmg =
      difficulty === 'tactical'
        ? estimateEffectiveDamage(rawAvgDmg, dmg.damageKind, tagsText, targetDefenses)
        : rawAvgDmg;

    const bestStat: StatKey = w.isMagicalCatalyst
      ? botChar.stats.manipulacion >= botChar.stats.fisico
        ? 'manipulacion'
        : 'fisico'
      : 'fisico';
    const statDice = getCharacterStatDice(botChar, bestStat, formula);
    let score = effectiveAvgDmg + statDice * 0.85 + 0.6;

    if (difficulty === 'tactical') {
      if (rawAvgDmg > 0 && effectiveAvgDmg <= 0.5) {
        score -= 6.0;
      }
      if (w.imbued) {
        score += 2.5;
      }
      // Con maná bajo, las armas cuestan 0 maná y ganan prioridad
      if (isLowMana) {
        score += 2.8;
      }
    }

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
    const chosen =
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

  const physicalDice = getCharacterStatDice(defenderChar, 'fisico', formula);
  let bestChoice = 'stat:fisico';
  let bestScore = physicalDice;

  const manaUnconsciousRisk =
    manaMode === 'auto' &&
    defenderChar.mana.max > 0 &&
    !defenderChar.ignoreManaUnconsciousness;
  const isLowMana =
    manaMode === 'auto' &&
    defenderChar.mana.max > 0 &&
    defenderChar.mana.current / defenderChar.mana.max <= 0.3;

  const defSpells = defenderChar.knownSpells
    .map((id) => spells.find((s) => s.id === id))
    .filter(
      (s): s is Spell =>
        Boolean(s && s.effectType === 'defense' && !(defEffects.cannotCastMagic && isSpellMagical(s)))
    );

  for (const sp of defSpells) {
    const manaInfo = getEffectiveDefenseManaCost(defenderChar, sp, defEffects.disarmed);
    if (manaMode === 'auto' && defenderChar.mana.current < manaInfo.cost) continue;

    // Nunca gastar el último maná en defender si dejaría al personaje Inconsciente por 0 maná
    if (manaUnconsciousRisk && manaInfo.cost > 0 && defenderChar.mana.current - manaInfo.cost <= 0) {
      continue;
    }

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

    let score = dice + sp.assuredSuccess * 1.2 + (manaInfo.cost === 0 ? 0.3 : 0);
    if (difficulty === 'tactical' && manaInfo.cost > 0) {
      // Si tiene maná bajo o su esquiva física es igual/superior, ahorra maná para atacar o curarse
      if (isLowMana) score -= manaInfo.cost * 1.4;
      else if (dice <= physicalDice) score -= 0.8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestChoice = `spell:${sp.id}`;
    }
  }

  return bestChoice;
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

  const armor = defenderCombatant ? getBotArmorModifiers(defenderCombatant) : { reduction: armorReduction, divisor: 1 as DamageDivisor };
  const afterRed = Math.max(0, rawDamage - Math.max(armorReduction, armor.reduction));
  const netBeforeProt =
    armor.divisor === 0
      ? 0
      : armor.divisor > 1
        ? Math.floor(afterRed / armor.divisor)
        : afterRed;

  if (netBeforeProt <= 2) return 0;

  const knowsProt = defenderChar.knownSpells.includes('basic_proteccion');
  if (!knowsProt) return 0;

  let maxAffordable = getMaxAffordableProtectionStacks(
    defenderChar,
    spells,
    manaMode,
    undefined,
    defEffects.disarmed
  );
  if (maxAffordable <= 0) return 0;

  // En modo táctico, evitar caer a 0 maná por Protección si llegara a 0 PV igualmente o si lo deja Inconsciente sin salvarlo
  if (
    difficulty === 'tactical' &&
    manaMode === 'auto' &&
    defenderChar.mana.max > 0 &&
    !defenderChar.ignoreManaUnconsciousness
  ) {
    // Reservar al menos 1 de maná si tiene suficiente como para no caer inconsciente por maná
    if (defenderChar.mana.current > 1) {
      maxAffordable = Math.min(maxAffordable, defenderChar.mana.current - 1);
    }
  }
  if (maxAffordable <= 0) return 0;

  const reductionPerStack = damageKind === 'magico' ? 3 : 5;
  const wouldDropLow =
    defenderChar.hp.current - netBeforeProt <= Math.ceil(defenderChar.hp.max * 0.35);
  const isLethalThreat = defenderChar.hp.current - netBeforeProt <= 0;

  if (difficulty === 'tactical') {
    if (isLethalThreat) {
      const neededToSurvive = Math.ceil(
        (netBeforeProt - defenderChar.hp.current + 1) / reductionPerStack
      );
      return Math.min(maxAffordable, Math.max(1, neededToSurvive));
    }
    if (wouldDropLow || netBeforeProt >= reductionPerStack + 2) {
      return Math.min(
        maxAffordable,
        wouldDropLow && netBeforeProt >= reductionPerStack * 2 ? 2 : 1
      );
    }
    return 0;
  }

  // Normal: usa 1 protección solo si el golpe es fuerte y le queda maná cómodo
  if (netBeforeProt >= 6 && (manaMode === 'manual' || defenderChar.mana.current >= 4)) {
    return 1;
  }
  return 0;
}