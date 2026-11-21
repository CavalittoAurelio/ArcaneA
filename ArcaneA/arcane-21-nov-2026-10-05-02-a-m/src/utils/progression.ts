import type { Character, Spell } from '../types/rpg';
import {
  ALL_ARCHIVE_LOCKED_IDS,
  ADAPTABLE_CATALOG_SPELLS,
  adaptCatalogSpellForCharacter,
  evaluateCatalogSpellCompatibility,
  getCatalogPrerequisiteTemplateId,
  getCharacterOwnedNatureIds,
  resolveNaturePresetForCharacter,
} from './dice';

export type ProgressionRequirementStatus =
  | 'completed'
  | 'pending'
  | 'blocked'
  | 'unevaluable';

export interface ProgressionNode {
  id: string;
  name: string;
  status: ProgressionRequirementStatus;
  reason: string;
  spell?: Spell;
  isGoal: boolean;
  prerequisites: ProgressionNode[];
}

export interface SpellGoalProgress {
  achieved: boolean;
  status: 'achieved' | 'ready' | 'partial' | 'blocked';
  completedRequirements: number;
  totalRequirements: number;
  path: ProgressionNode[];
}

function isTemplateSpell(spell: Spell): boolean {
  return Boolean(spell.isAdaptableTemplate);
}

export function getSpellGoalProgress(
  character: Character,
  spells: Spell[],
  goalId: string
): SpellGoalProgress | null {
  const target =
    spells.find((spell) => spell.id === goalId) ||
    ADAPTABLE_CATALOG_SPELLS.find((spell) => spell.id === goalId);
  if (!target) return null;

  const knownIds = new Set(character.knownSpells || []);
  const unlockedKeys = new Set(character.unlockedArchiveSpellIds || []);
  const ownedNatures = new Set(getCharacterOwnedNatureIds(character));
  const resolvedNature = resolveNaturePresetForCharacter(character);
  const visited = new Set<string>();

  const buildNode = (spell: Spell, isGoal: boolean): ProgressionNode => {
    if (visited.has(spell.id)) {
      return {
        id: spell.id,
        name: spell.name,
        status: 'unevaluable',
        reason: 'Referencia circular en las dependencias.',
        spell,
        isGoal,
        prerequisites: [],
      };
    }
    visited.add(spell.id);

    const adaptable = isTemplateSpell(spell);
    const adapted = adaptable
      ? adaptCatalogSpellForCharacter(spell, character, {
          materialize: false,
          existingLearnedSpells: spells.filter((item) => knownIds.has(item.id)),
        })
      : spell;
    const learnedVariant =
      knownIds.has(spell.id) ||
      (adaptable &&
        spells.some(
          (item) => item.catalogTemplateId === spell.id && knownIds.has(item.id)
        ));
    const requiresKey =
      ALL_ARCHIVE_LOCKED_IDS.includes(spell.id) ||
      Boolean(spell.unlearnedByDefault);
    const keyUnlocked = !requiresKey || unlockedKeys.has(spell.id);
    const compatibility = adaptable
      ? evaluateCatalogSpellCompatibility(
          spell,
          resolvedNature.preset.id,
          resolvedNature.elementName
        )
      : { compatible: true, reason: '' };

    let status: ProgressionRequirementStatus = 'pending';
    let reason = 'Todavía necesita conseguirse.';

    if (learnedVariant) {
      status = 'completed';
      reason = 'Ya forma parte del grimorio.';
    } else if (adaptable && !ownedNatures.has(resolvedNature.preset.id)) {
      status = 'blocked';
      reason = `Requiere la afinidad ${resolvedNature.elementName}.`;
    } else if (!compatibility.compatible) {
      status = 'blocked';
      reason = compatibility.reason || 'No compatible con la afinidad actual.';
    } else if (!keyUnlocked) {
      status = 'blocked';
      reason = 'La llave del Archivo Arcano todavía está cerrada.';
    }

    const prerequisites: ProgressionNode[] = [];
    const prerequisiteTemplateId = adaptable
      ? getCatalogPrerequisiteTemplateId(spell)
      : spell.dependency?.enabled
        ? spell.dependency.requiredSpellId
        : undefined;

    if (prerequisiteTemplateId) {
      const prerequisite =
        ADAPTABLE_CATALOG_SPELLS.find((item) => item.id === prerequisiteTemplateId) ||
        spells.find((item) => item.id === prerequisiteTemplateId);
      if (prerequisite) prerequisites.push(buildNode(prerequisite, false));
    }

    if (prerequisites.length > 0 && status === 'pending') {
      const incomplete = prerequisites.some(
        (node) => node.status !== 'completed'
      );
      if (incomplete) {
        status = 'blocked';
        reason = 'Depende de un hechizo previo todavía no conseguido.';
      }
    }

    return {
      id: spell.id,
      name: adapted.name,
      status,
      reason,
      spell: adapted,
      isGoal,
      prerequisites,
    };
  };

  const path = [buildNode(target, true)];

  const flatten = (node: ProgressionNode): ProgressionNode[] => [
    node,
    ...node.prerequisites.flatMap(flatten),
  ];
  const nodes = flatten(path[0]);
  const achieved = nodes[0].status === 'completed';
  const completedRequirements = nodes.filter((node) => node.status === 'completed').length;
  const blockedRequirements = nodes.filter(
    (node) => node.status === 'blocked'
  ).length;

  return {
    achieved,
    status: achieved
      ? 'achieved'
      : blockedRequirements > 0
        ? 'blocked'
        : completedRequirements > 0
          ? 'partial'
          : 'partial',
    completedRequirements,
    totalRequirements: nodes.length,
    path,
  };
}