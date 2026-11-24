import { useEffect, useRef, useState } from 'react';
import {
  CircleHelp,
  ArrowRight,
  ChevronDown,
  Dices,
  Droplets,
  Eye,
  Flame,
  Link2,
  Plus,
  Save,
  Search,
  ShieldOff,
  ShieldPlus,
  Snowflake,
  Sparkles,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { SpellCategoryIcon } from './SpellCategoryIcon';
import { SpellInspector } from './SpellInspector';
import type {
  AreaTargetMode,
  CastStatOption,
  Character,
  DamageDie,
  DamageDivisor,
  DamageKind,
  DamageResolutionMode,
  DieType,
  DispelTargetScope,
  EffectSubType,
  ElementalStatusKind,
  ElementalTriggerRule,
  FormulaConfig,
  Spell,
  SpellCastRequirement,
  SpellDependencyScope,
  SpellEffectType,
  SpellStatusParamConfig,
  StatKey,
  SynergyReactionType,
} from '../types/rpg';
import {
  AREA_MODE_LABELS,
  ARMOR_ELEMENTS,
  COMBAT_STATUS_MECHANICS,
  DIE_TYPES,
  DISPEL_SCOPE_LABELS,
  ELEMENTAL_STATUS_META,
  ORDER_LIBRARY,
  SONIC_BASE_ORDER,
  SONIC_ORDERS,
  SPELL_DEPENDENCY_SCOPE_LABELS,
  STAT_NAMES,
  SYNERGY_LABELS,
  doesCharacterControlEarth,
  doesCharacterControlSonic,
  formatTurnDuration,
  generateId,
  getCharacterStatDice,
  getDefaultArmorElementForCharacter,
  getEffectiveEffectSubType,
  getSpellCastRequirement,
  isSonicSpell,
  normalizeCombatStatusKey,
  parseDurationTurns,
} from '../utils/dice';

interface GrimorioEditorProps {
  activeCharacter: Character | undefined;
  spells?: Spell[];
  formula: FormulaConfig;
  allOrders: string[];
  allStatuses: string[];
  editingSpell: Spell | null;
  onSaveSpell: (spell: Spell, learnForActive: boolean) => void;
  onCancelEdit: () => void;
  onCreateOrder: (order: string) => void;
  onCreateStatus: (status: string) => void;
  onTestSpell: (spell: Spell) => void;
}

type EditorLevel = 'essential' | 'personalization' | 'advanced';

const EDITOR_LEVEL_RANK: Record<EditorLevel, number> = {
  essential: 0,
  personalization: 1,
  advanced: 2,
};

function FieldHelp({ text }: { text: string }) {
  return (
    <span
      role="img"
      tabIndex={0}
      aria-label={`Ayuda: ${text}`}
      title={text}
      className="inline-flex shrink-0 align-middle text-[var(--arc-accent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--arc-accent)]"
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </span>
  );
}

const STAT_KEYS: StatKey[] = ['fisico', 'manipulacion', 'influencia'];

type ElementalTemplateKey =
  | 'poison'
  | 'burn'
  | 'frozen'
  | 'electrified'
  | 'bleeding'
  | 'detonate_burn'
  | 'siphon_poison'
  | 'shatter_frozen'
  | 'overload_electrified'
  | 'hemorrhage_bleed';

const ELEMENTAL_TEMPLATE_GUIDES: Record<
  ElementalTemplateKey,
  { quick: string; steps: string[]; example: string; ifNotTriggered: string; interactions: string }
> = {
  poison: {
    quick: 'Un proyectil mágico que hiere y puede dejar veneno activo en el objetivo.',
    steps: [
      'Tirada de ataque con Manipulación; daño directo base: 1d6 mágico.',
      'Si el ataque causa daño y el d6 queda en su mitad superior (4–6), aplica 2 cargas de Envenenado durante 3 turnos.',
      'Cada carga causa 1d4 mágico al inicio del turno del objetivo. Las cargas tienen duración independiente y el límite compartido es 10.',
    ],
    example:
      'Impacta con un 5 en el d6: además del daño directo, aplica 2 cargas. Al inicio del próximo turno se tira 2d4 mágico; cada carga sigue contando sus propios turnos.',
    ifNotTriggered:
      'Con 1–3, si el golpe no causa daño positivo o si no impacta, no aplica Envenenado. El daño directo del ataque se resuelve por separado.',
    interactions: 'Sifón Tóxico consume cargas de Envenenado; una por defecto.',
  },
  burn: {
    quick: 'Una llamarada mágica impacta y deja una quemadura que sigue dañando al objetivo.',
    steps: [
      'Tirada de ataque con Manipulación; daño directo base: 1d6 mágico.',
      'El disparador está configurado como siempre: si impacta y causa daño positivo, aplica 2 cargas de Quemadura durante 2 turnos.',
      'Cada carga causa 1d4 mágico al inicio del turno; las cargas tienen duración independiente y el límite compartido es 10.',
    ],
    example:
      'Si impacta y el daño no queda reducido a cero, agrega 2 cargas; al inicio del turno del objetivo, se tira 2d4 mágico.',
    ifNotTriggered:
      'Si el ataque no impacta o el daño final es cero, no se aplican las cargas. El estado no depende de sacar un dado máximo en esta plantilla.',
    interactions: 'Detonar Quemadura consume cargas y causa 1d6 mágico por cada una.',
  },
  frozen: {
    quick: 'Una lanza de hielo hiere y puede dejar al objetivo Congelado.',
    steps: [
      'Tirada de ataque con Manipulación; daño directo base: 1d6 mágico.',
      'Si el ataque causa daño y el d6 queda en su mitad superior (4–6), aplica 1 carga de Congelado durante 2 turnos.',
      'La carga causa 1d4 mágico al inicio del turno, por el dado predeterminado que aplica el motor.',
    ],
    example:
      'Con un 6 en el d6 y daño positivo, el objetivo recibe el daño directo y queda con 1 carga de Congelado; en el siguiente inicio de turno recibe un d4 mágico.',
    ifNotTriggered:
      'Con 1–3, sin impacto o si el daño final queda en cero, no se aplica Congelado.',
    interactions: 'Quebrar Congelado consume una carga por defecto y causa 1d8 físico.',
  },
  electrified: {
    quick: 'Un rayo hiere y deja al objetivo cargado para que otros ataques eléctricos puedan propagarse.',
    steps: [
      'Tirada de ataque con Manipulación; daño directo base: 1d6 mágico.',
      'Con impacto que cause daño positivo, aplica 1 carga de Electrificado durante 3 turnos.',
      'Electrificado no causa daño periódico por defecto. Un impacto posterior de rayo puede causar 1d4 mágico por carga a otros combatientes vivos Electrificados, sin consumir sus cargas.',
    ],
    example:
      'El objetivo A queda Electrificado. Un ataque posterior de rayo contra B causa además 1d4 por cada carga de A; A conserva sus cargas.',
    ifNotTriggered:
      'Sin impacto o sin daño positivo no aplica Electrificado. Si no hay otros Electrificados vivos, el rayo no tiene objetivos secundarios.',
    interactions:
      'La Expansión eléctrica automática usa 1d4 y no consume cargas. Sobrecarga de Antena es otra reacción: consume una carga por defecto e inflige 1d6 mágico por carga.',
  },
  bleeding: {
    quick: 'Un tajo físico hiere y puede dejar una hemorragia que causa daño en turnos posteriores.',
    steps: [
      'Tirada de ataque con Físico; daño directo base: 1d6 físico.',
      'Con impacto que cause daño positivo, aplica 1 carga de Sangrando durante 3 turnos.',
      'Cada carga causa 1d4 físico al inicio del turno; las cargas tienen duración independiente y el límite compartido es 10.',
    ],
    example:
      'Un tajo que causa daño agrega 1 carga. Al inicio del próximo turno, el objetivo recibe 1d4 físico si la carga sigue activa.',
    ifNotTriggered:
      'Si no impacta o el daño final queda en cero, no aplica Sangrando. La aplicación no espera un resultado máximo del d6.',
    interactions: 'Desgarrar Sangrado consume una carga por defecto y causa 1d6 físico.',
  },
  detonate_burn: {
    quick: 'Golpea con magia y, si el objetivo está Quemado, detona una carga como parte del impacto.',
    steps: [
      'Tirada de ataque con Manipulación; daño directo base: 1d4 mágico.',
      'Tras un impacto, el hechizo intenta la reacción configurada. Si el objetivo tiene Quemadura, consume 1 carga y causa 1d6 mágico adicional.',
      'También se puede usar el botón de reacción manual desde un estado de Quemadura activo; ese control no descuenta acciones ni Maná en el ejecutor.',
    ],
    example:
      'Si el objetivo conserva 2 cargas, el impacto causa su daño directo 1d4 y detona 1 carga por 1d6 adicional; queda 1 carga.',
    ifNotTriggered:
      'Sin impacto o sin cargas de Quemadura no hay detonación. Si el ataque impacta, su daño directo se resuelve igualmente.',
    interactions:
      'La reacción consume primero la carga con menos duración restante. El editor permite cambiar la cantidad consumida.',
  },
  siphon_poison: {
    quick: 'Golpea con magia y extrae una carga de veneno para dañar al objetivo y, si es otra persona, recuperar recursos.',
    steps: [
      'Tirada de ataque con Manipulación; daño directo base: 1d4 mágico.',
      'Tras un impacto, intenta consumir 1 carga de Envenenado y causa 1d4 mágico adicional por carga consumida.',
      'Si lanzador y objetivo son distintos, el lanzador recupera max(1, techo del daño de sifón / 2) PV y 1 Maná por carga. Si son la misma persona, no recupera PV ni Maná.',
    ],
    example:
      'Con 1 carga y un 3 en el d4 del sifón, el objetivo recibe 3 de daño adicional y otro lanzador recupera 2 PV y 1 Maná; la carga se consume.',
    ifNotTriggered:
      'Sin impacto o sin cargas de Envenenado no se ejecuta el sifón. Si el ataque impacta, conserva su daño directo; no hay recuperación si el lanzador también es el objetivo.',
    interactions:
      'Consume primero las cargas con menos duración restante. La cantidad consumida puede configurarse en el hechizo.',
  },
  shatter_frozen: {
    quick: 'Fractura Congelado para consumir cargas e infligir daño físico.',
    steps: [
      'Tirada de ataque con Manipulación; la plantilla no configura dados de daño directo.',
      'Tras un impacto, si el objetivo tiene Congelado, la reacción consume 1 carga por defecto e inflige 1d8 físico por carga consumida.',
      'El motor consume primero las cargas con menos duración restante. La reacción no aplica un estado nuevo.',
    ],
    example:
      'Con 2 cargas de Congelado, un impacto consume 1, tira 1d8 físico y deja 1 carga activa.',
    ifNotTriggered:
      'Sin impacto o sin cargas de Congelado no se ejecuta la reacción. Como la plantilla no tiene daño directo, no causa daño si la reacción no se activa.',
    interactions:
      'La carga de Congelado causa además su daño periódico normal al inicio del turno mientras siga activa.',
  },
  overload_electrified: {
    quick: 'Descarga las cargas de Electrificado de todos los combatientes; la reacción es global, no solo sobre el blanco del impacto.',
    steps: [
      'Tirada de ataque con Manipulación. La plantilla usa el modo de objetivos Electrificados y no configura dados de daño directo.',
      'Tras resolver un impacto, el motor ejecuta Sobrecarga sobre todos los combatientes Electrificados: consume 1 carga por defecto de cada uno e inflige 1d6 mágico por carga consumida.',
      'El área selecciona objetivos distintos del lanzador para la resolución del ataque; la reacción global también incluye al lanzador si está Electrificado.',
    ],
    example:
      'Si dos combatientes tienen una carga, al activarse la reacción cada uno recibe 1d6 mágico y pierde esa carga, aunque el ataque de entrada se haya dirigido a uno solo.',
    ifNotTriggered:
      'Sin impacto o sin cargas de Electrificado no hay descarga. La plantilla no añade daño directo; si no hay objetivos Electrificados, la reacción no produce daño.',
    interactions:
      'La Sobrecarga consume cargas y causa 1d6 mágico por carga. No es la Expansión eléctrica automática, que causa 1d4 por carga sin consumirla.',
  },
  hemorrhage_bleed: {
    quick: 'Desgarra cargas de Sangrando para infligir daño físico adicional.',
    steps: [
      'Tirada de ataque con Manipulación; la plantilla no configura dados de daño directo.',
      'Tras un impacto, si el objetivo tiene Sangrando, Hemorragia consume 1 carga por defecto e inflige 1d6 físico por carga consumida.',
      'El motor consume primero las cargas con menos duración restante. La reacción no vuelve a aplicar Sangrando.',
    ],
    example:
      'Con 2 cargas de Sangrando, un impacto consume 1, tira 1d6 físico y deja 1 carga activa.',
    ifNotTriggered:
      'Sin impacto o sin cargas de Sangrando no se ejecuta la reacción. Como la plantilla no tiene daño directo, no causa daño si la reacción no se activa.',
    interactions:
      'Las cargas restantes continúan causando su daño periódico al inicio del turno hasta expirar o ser consumidas.',
  },
};

export function GrimorioEditor({
  activeCharacter,
  spells = [],
  formula,
  allOrders,
  allStatuses,
  editingSpell,
  onSaveSpell,
  onCancelEdit,
  onCreateOrder,
  onCreateStatus,
  onTestSpell,
}: GrimorioEditorProps) {
  const controlsEarth = doesCharacterControlEarth(activeCharacter, spells);
  const controlsSonic = doesCharacterControlSonic(activeCharacter, spells);
  const defaultArmorElement = getDefaultArmorElementForCharacter(activeCharacter, spells);
  const [name, setName] = useState('');
  const [manaCost, setManaCost] = useState(3);
  const [duration, setDuration] = useState('1 golpe');
  const [durationTurns, setDurationTurns] = useState<number>(0);
  const [orders, setOrders] = useState<string[]>(() => (controlsSonic ? [SONIC_BASE_ORDER] : []));
  const [orderCategory, setOrderCategory] = useState<string>(() =>
    controlsSonic ? 'sonic' : 'elemental'
  );
  const [orderSearch, setOrderSearch] = useState('');
  const [newOrderInput, setNewOrderInput] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [newStatusInput, setNewStatusInput] = useState('');
  const [previewSnapshot, setPreviewSnapshot] = useState<Spell | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [configurationLevel, setConfigurationLevel] = useState<EditorLevel>('essential');
  const draftSpellIdRef = useRef(editingSpell?.id || generateId('spell-preview_'));
  const [castRequirement, setCastRequirement] = useState<SpellCastRequirement>('none');
  const [castCondition, setCastCondition] = useState('');
  const [castStat, setCastStat] = useState<CastStatOption>('none');
  const [manualCastDice, setManualCastDice] = useState(2);
  const [assuredSuccess, setAssuredSuccess] = useState(0);
  const [effectType, setEffectType] = useState<SpellEffectType>('damage');
  const [effectSubType, setEffectSubType] = useState<EffectSubType>('general');
  const [isArmor, setIsArmor] = useState(false);
  const [armorElement, setArmorElement] = useState(defaultArmorElement);
  const [armorReduction, setArmorReduction] = useState(3);
  const [armorDivisor, setArmorDivisor] = useState<DamageDivisor>(1);
  const [maxHits, setMaxHits] = useState<number>(0);
  const [combatStats, setCombatStats] = useState<StatKey[]>(['fisico']);
  const [damageDice, setDamageDice] = useState<DamageDie[]>([{ type: 'd6', count: 1 }]);
  const [damageBonus, setDamageBonus] = useState(0);
  const [damageNotes, setDamageNotes] = useState('');
  const [damageMode, setDamageMode] = useState<DamageResolutionMode>('auto');
  const [damageKind, setDamageKind] = useState<DamageKind>('magico');
  const [noMastery, setNoMastery] = useState<boolean>(false);
  const [hasCollateral, setHasCollateral] = useState<boolean>(false);
  const [collateralLabel, setCollateralLabel] = useState('');
  const [collateralMode, setCollateralMode] = useState<'fixed' | 'dice'>('fixed');
  const [collateralFixed, setCollateralFixed] = useState<number>(3);
  const [collateralDieType, setCollateralDieType] = useState<DieType>('d4');
  const [collateralDieCount, setCollateralDieCount] = useState<number>(1);
  const [collateralBonus, setCollateralBonus] = useState<number>(0);
  const [collateralKind, setCollateralKind] = useState<DamageKind>('magico');
  const [collateralDurationType, setCollateralDurationType] = useState<'instant' | 'turns'>('instant');
  const [collateralTurns, setCollateralTurns] = useState<number>(2);
  const [effectDescription, setEffectDescription] = useState('');
  const [isExclusive, setIsExclusive] = useState(true);
  const [learnForActive, setLearnForActive] = useState(true);

  // Disipación (Debuff para quitar/cancelar armaduras, buffs o debuffs enemigos)
  const [dispelEnabled, setDispelEnabled] = useState(false);
  const [dispelScope, setDispelScope] = useState<DispelTargetScope>('armor');
  const [dispelMaxTargets, setDispelMaxTargets] = useState<number>(1);
  const [dispelRequiresInfluence, setDispelRequiresInfluence] = useState<boolean>(true);

  // Estado elemental definido (Quemadura, Envenenado, Congelado, Electrificado, Sangrando)
  const [elemEnabled, setElemEnabled] = useState(false);
  const [elemKind, setElemKind] = useState<ElementalStatusKind>('poison');
  const [elemStacks, setElemStacks] = useState<number>(1);
  const [elemDurationTurns, setElemDurationTurns] = useState<number>(3);
  const [elemTrigger, setElemTrigger] = useState<ElementalTriggerRule>('upper_half');
  const [elemTickDie, setElemTickDie] = useState<DieType | 'none'>('d4');
  const [elemDamageKind, setElemDamageKind] = useState<DamageKind>('magico');
  const [selectedElementalTemplate, setSelectedElementalTemplate] =
    useState<ElementalTemplateKey | null>(null);

  // Reacción / Sinergia de combate
  const [synergyReaction, setSynergyReaction] = useState<SynergyReactionType>('none');
  const [synergyConsumeMode, setSynergyConsumeMode] = useState<'1' | 'custom' | 'all'>('1');
  const [synergyConsumeCount, setSynergyConsumeCount] = useState<number>(2);

  // Requisito de activación que se verifica en combate.
  const [depEnabled, setDepEnabled] = useState(false);
  const [depScope, setDepScope] = useState<SpellDependencyScope>('self_active');
  const [depRequiredSpellId, setDepRequiredSpellId] = useState<string>('');
  const [depRequiredName, setDepRequiredName] = useState<string>('');
  const [depConsumeOnUse, setDepConsumeOnUse] = useState<boolean>(false);

  // Parámetros mecánicos por estado (fallos automáticos / duración hasta 1 golpe para Aturdir)
  const [statusParams, setStatusParams] = useState<Record<string, SpellStatusParamConfig>>({});

  // Daño en área / múltiples objetivos (ej. Bola de Fuego, Arco Voltaico)
  const [areaEnabled, setAreaEnabled] = useState<boolean>(false);
  const [areaMode, setAreaMode] = useState<AreaTargetMode>('area_selected');
  const [areaMaxTargets, setAreaMaxTargets] = useState<number>(0);
  const [areaRequiredStatus, setAreaRequiredStatus] = useState<string>('Electrificado');
  const [areaShapeNote, setAreaShapeNote] = useState<string>('');
  const tierIsVisible = (minimum: EditorLevel) =>
    EDITOR_LEVEL_RANK[configurationLevel] >= EDITOR_LEVEL_RANK[minimum];

  const resetFields = () => {
    draftSpellIdRef.current = generateId('spell-preview_');
    setPreviewSnapshot(null);
    setName('');
    setManaCost(3);
    setDuration('1 golpe');
    setDurationTurns(0);
    setOrders(controlsSonic ? [SONIC_BASE_ORDER] : []);
    setOrderCategory(controlsSonic ? 'sonic' : 'elemental');
    setNewOrderInput('');
    setStatuses([]);
    setStatusParams({});
    setSelectedStatus('');
    setNewStatusInput('');
    setCastRequirement('none');
    setCastCondition('');
    setCastStat('none');
    setManualCastDice(2);
    setAssuredSuccess(0);
    setEffectType('damage');
    setEffectSubType('general');
    setIsArmor(false);
    setArmorElement(defaultArmorElement);
    setArmorReduction(3);
    setArmorDivisor(1);
    setMaxHits(0);
    setCombatStats(['fisico']);
    setDamageDice([{ type: 'd6', count: 1 }]);
    setDamageBonus(0);
    setDamageNotes('');
    setDamageMode('auto');
    setDamageKind('magico');
    setNoMastery(false);
    setHasCollateral(false);
    setCollateralLabel('');
    setCollateralMode('fixed');
    setCollateralFixed(3);
    setCollateralDieType('d4');
    setCollateralDieCount(1);
    setCollateralBonus(0);
    setCollateralKind('magico');
    setCollateralDurationType('instant');
    setCollateralTurns(2);
    setEffectDescription('');
    setIsExclusive(true);
    setLearnForActive(true);
    setDispelEnabled(false);
    setDispelScope('armor');
    setDispelMaxTargets(1);
    setDispelRequiresInfluence(true);
    setElemEnabled(false);
    setElemKind('poison');
    setElemStacks(1);
    setElemDurationTurns(3);
    setElemTrigger('upper_half');
    setElemTickDie('d4');
    setElemDamageKind('magico');
    setSelectedElementalTemplate(null);
    setSynergyReaction('none');
    setSynergyConsumeMode('1');
    setSynergyConsumeCount(2);
    setDepEnabled(false);
    setDepScope('self_active');
    setDepRequiredSpellId('');
    setDepRequiredName('');
    setDepConsumeOnUse(false);
    setAreaEnabled(false);
    setAreaMode('area_selected');
    setAreaMaxTargets(0);
    setAreaRequiredStatus('Electrificado');
    setAreaShapeNote('');
  };

  useEffect(() => {
    draftSpellIdRef.current = editingSpell?.id || generateId('spell-preview_');
    setConfigurationLevel(editingSpell ? 'personalization' : 'essential');
    if (!editingSpell) {
      resetFields();
      return;
    }
    setName(editingSpell.name);
    setManaCost(editingSpell.manaCost);
    setDuration(editingSpell.duration || '');
    setDurationTurns(parseDurationTurns(editingSpell) || 0);
    setOrders([...editingSpell.orders]);
    setStatuses([...(editingSpell.statuses || [])]);
    setStatusParams(editingSpell.statusParams ? { ...editingSpell.statusParams } : {});
    setCastRequirement(getSpellCastRequirement(editingSpell));
    setCastCondition(editingSpell.castCondition || '');
    setCastStat(editingSpell.castStat);
    setManualCastDice(editingSpell.manualCastDice || 2);
    setAssuredSuccess(editingSpell.assuredSuccess || 0);
    setEffectType(editingSpell.effectType);
    setEffectSubType(getEffectiveEffectSubType(editingSpell));
    setIsArmor(Boolean(editingSpell.armorConfig?.isArmor));
    setArmorElement(editingSpell.armorConfig?.element || defaultArmorElement);
    setArmorReduction(editingSpell.armorConfig?.damageReduction ?? 3);
    setArmorDivisor(editingSpell.armorConfig?.damageDivisor ?? 1);
    setMaxHits(editingSpell.armorConfig?.maxHits ?? editingSpell.maxHits ?? 0);
    setCombatStats(
      editingSpell.combatStats.length > 0
        ? [...editingSpell.combatStats]
        : editingSpell.effectType === 'damage' || editingSpell.effectType === 'defense'
          ? ['fisico']
          : []
    );
    setDamageDice(
      editingSpell.damage.dice.length > 0
        ? editingSpell.damage.dice.map((d) => ({ ...d }))
        : [{ type: editingSpell.effectType === 'heal' ? 'd4' : 'd6', count: 1 }]
    );
    setDamageBonus(editingSpell.damage.bonus || 0);
    setDamageNotes(editingSpell.damage.notes || '');
    setDamageMode(editingSpell.damageMode || 'auto');
    setDamageKind(editingSpell.damageKind || 'magico');
    setNoMastery(Boolean(editingSpell.noMastery || editingSpell.id === 'basic_curar_heridas'));
    const col = editingSpell.collateral;
    setHasCollateral(Boolean(col?.enabled));
    setCollateralLabel(col?.label || '');
    setCollateralMode(col?.mode || 'fixed');
    setCollateralFixed(col?.fixedAmount ?? 3);
    setCollateralDieType(col?.dice?.[0]?.type || 'd4');
    setCollateralDieCount(col?.dice?.[0]?.count ?? 1);
    setCollateralBonus(col?.bonus ?? 0);
    setCollateralKind(col?.damageKind || 'magico');
    setCollateralDurationType(col?.durationType || 'instant');
    setCollateralTurns(col?.durationTurns ?? 2);
    setEffectDescription(editingSpell.effectDescription || '');
    setIsExclusive(Boolean(editingSpell.ownerCharacterId));
    setDispelEnabled(Boolean(editingSpell.dispelConfig?.enabled));
    setDispelScope(editingSpell.dispelConfig?.scope || 'armor');
    setDispelMaxTargets(editingSpell.dispelConfig?.maxEffects ?? 1);
    setDispelRequiresInfluence(editingSpell.dispelConfig?.requiresInfluenceCheck ?? true);
    if (editingSpell.elementalStatus) {
      setElemEnabled(true);
      setElemKind(editingSpell.elementalStatus.kind);
      setElemStacks(editingSpell.elementalStatus.stacks || 1);
      setElemDurationTurns(editingSpell.elementalStatus.durationTurns || 3);
      setElemTrigger(editingSpell.elementalStatus.trigger);
      setElemTickDie(editingSpell.elementalStatus.tickDie ?? 'none');
      setElemDamageKind(
        editingSpell.elementalStatus.damageKind ||
          ELEMENTAL_STATUS_META[editingSpell.elementalStatus.kind].defaultDamageKind
      );
    } else {
      setElemEnabled(false);
    }
    setSynergyReaction(editingSpell.synergyReaction || 'none');
    if (editingSpell.synergyConsumeStacks === 'all') {
      setSynergyConsumeMode('all');
      setSynergyConsumeCount(2);
    } else if (
      typeof editingSpell.synergyConsumeStacks === 'number' &&
      editingSpell.synergyConsumeStacks > 1
    ) {
      setSynergyConsumeMode('custom');
      setSynergyConsumeCount(Math.min(10, Math.floor(editingSpell.synergyConsumeStacks)));
    } else {
      setSynergyConsumeMode('1');
      setSynergyConsumeCount(2);
    }
    if (editingSpell.dependency?.enabled && editingSpell.dependency.requiredName?.trim()) {
      setDepEnabled(true);
      setDepScope(editingSpell.dependency.scope || 'self_active');
      setDepRequiredSpellId(editingSpell.dependency.requiredSpellId || '');
      setDepRequiredName(editingSpell.dependency.requiredName || '');
      setDepConsumeOnUse(Boolean(editingSpell.dependency.consumeOnUse));
    } else {
      setDepEnabled(false);
      setDepScope('self_active');
      setDepRequiredSpellId('');
      setDepRequiredName('');
      setDepConsumeOnUse(false);
    }
    if (editingSpell.areaConfig?.enabled) {
      setAreaEnabled(true);
      setAreaMode(editingSpell.areaConfig.mode || 'area_selected');
      setAreaMaxTargets(editingSpell.areaConfig.maxTargets || 0);
      setAreaRequiredStatus(editingSpell.areaConfig.requiredStatusName || 'Electrificado');
      setAreaShapeNote(editingSpell.areaConfig.shapeNote || '');
    } else {
      setAreaEnabled(false);
      setAreaMode('area_selected');
      setAreaMaxTargets(0);
      setAreaRequiredStatus('Electrificado');
      setAreaShapeNote('');
    }
  }, [editingSpell]);

  useEffect(() => {
    if (!editingSpell) {
      setArmorElement(defaultArmorElement);
      setOrderCategory(controlsSonic ? 'sonic' : 'elemental');
      setOrders((prev) => {
        if (controlsSonic && prev.length === 0) return [SONIC_BASE_ORDER];
        if (!controlsSonic && prev.length === 1 && prev[0] === SONIC_BASE_ORDER) return [];
        return prev;
      });
    }
  }, [activeCharacter?.id, controlsSonic, defaultArmorElement, editingSpell]);

  const applyTurnCount = (turns: number) => {
    const safe = Math.max(0, Math.min(999, Math.floor(turns || 0)));
    setDurationTurns(safe);
    if (safe > 0) {
      setDuration(formatTurnDuration(safe));
    } else if (/^\d+\s*(turno|turnos|ronda|rondas|t)\b/i.test(duration.trim())) {
      setDuration('Hasta ser disipado');
    }
  };

  const applyArmorTemplate = (element = defaultArmorElement) => {
    const cleanEl = element.trim() || defaultArmorElement;
    setEffectType('effect');
    setEffectSubType('buff');
    setIsArmor(true);
    setArmorElement(cleanEl);
    setArmorReduction((prev) => (prev > 0 ? prev : 3));
    const hitsToUse = maxHits > 0 ? maxHits : 3;
    setMaxHits(hitsToUse);
    if (!name.trim() || name.trim().startsWith('Armadura de ')) {
      setName(`Armadura de ${cleanEl}`);
    }
    const turnsToUse = durationTurns > 0 ? durationTurns : 10;
    setDurationTurns(turnsToUse);
    setDuration(formatTurnDuration(turnsToUse));
    setCastRequirement('none');
    if (orders.length === 0) {
      const nextOrders = ['Escudo', 'Proteger'];
      if (cleanEl.toLowerCase() === 'tierra') nextOrders.push('Levantar tierra', 'Moldear roca');
      setOrders(nextOrders);
    }
    if (!effectDescription.trim()) {
      setEffectDescription(
        `Recubre al lanzador con una armadura elemental de ${cleanEl} durante ${turnsToUse} turnos o hasta resistir ${hitsToUse} golpes. Reduce el daño recibido y se rompe/disipa al agotar turnos o golpes.`
      );
    }
  };

  const handleSelectElemKind = (kind: ElementalStatusKind) => {
    const meta = ELEMENTAL_STATUS_META[kind];
    setElemKind(kind);
    setElemDurationTurns(meta.defaultDuration);
    setElemTrigger(meta.defaultTrigger);
    setElemTickDie(meta.defaultTickDie ?? 'none');
    setElemDamageKind(meta.defaultDamageKind);
  };

  const applyDispelTemplate = (scope: DispelTargetScope = 'armor') => {
    setEffectType('effect');
    setEffectSubType('debuff');
    setIsArmor(false);
    setDispelEnabled(true);
    setDispelScope(scope);
    setDispelMaxTargets(1);
    setDispelRequiresInfluence(true);
    setDuration('Instantáneo');
    setDurationTurns(0);
    setManaCost(3);
    setCastRequirement('none');
    setCastStat('none');
    setStatuses(['Disipar']);
    if (scope === 'armor') {
      setName('Disipar Armadura');
      setOrders(['Disipar', 'Deshacer']);
      setEffectDescription(
        'Quita o cancela una armadura o barrera elemental activa sobre el enemigo objetivo (ej: Armadura de Tierra) al superar su Influencia.'
      );
    } else {
      setName('Anular Encantamiento');
      setOrders(['Disipar', 'Neutralizar']);
      setEffectDescription(
        'Cancela y disipa un buff, armadura o efecto mágico enemigo al superar su Influencia.'
      );
    }
  };

  const resetTemplateOptions = () => {
    setStatuses([]);
    setStatusParams({});
    setOrders([]);
    setCombatStats([]);
    setDamageDice([{ type: 'd6', count: 1 }]);
    setDamageKind('magico');
    setEffectType('damage');
    setEffectSubType('general');
    setIsArmor(false);
    setDispelEnabled(false);
    setElemEnabled(false);
    setSynergyReaction('none');
    setDepEnabled(false);
    setAreaEnabled(false);
    setHasCollateral(false);
  };

  const applyCreationTemplate = (
    template:
      | 'projectile'
      | 'shield'
      | 'healing'
      | 'buff'
      | 'curse'
      | 'dispel'
      | 'control'
  ) => {
    setSelectedElementalTemplate(null);
    resetTemplateOptions();
    setDuration('Instantáneo');
    setDurationTurns(0);
    setCastRequirement('none');
    setCastCondition('');
    setCastStat('none');
    setAssuredSuccess(0);
    setDamageBonus(0);
    setDamageNotes('');
    setDamageMode('auto');
    setNoMastery(false);

    if (template === 'projectile') {
      setName('Proyectil Arcano');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['fisico']);
      setDamageDice([{ type: 'd6', count: 1 }]);
      setDamageKind('magico');
      setOrders(['Proyectar']);
      setEffectDescription('Un proyectil mágico que causa 1d6 de daño al objetivo.');
      setConfigurationLevel('personalization');
    } else if (template === 'shield') {
      applyArmorTemplate();
      const element = defaultArmorElement.trim() || 'Arcano';
      setName(`Armadura de ${element}`);
      setManaCost(3);
      setIsArmor(true);
      setArmorElement(element);
      setArmorReduction(3);
      setMaxHits(3);
      setDuration('10 turnos');
      setDurationTurns(10);
      setEffectDescription(
        `Recubre al lanzador con una armadura elemental de ${element} durante 10 turnos o hasta resistir 3 golpes. Reduce el daño recibido y se rompe/disipa al agotar turnos o golpes.`
      );
      setOrders(
        element.toLowerCase() === 'tierra'
          ? ['Escudo', 'Proteger', 'Levantar tierra', 'Moldear roca']
          : ['Escudo', 'Proteger']
      );
      setConfigurationLevel('personalization');
    } else if (template === 'healing') {
      setName('Curación');
      setManaCost(3);
      setEffectType('heal');
      setEffectSubType('general');
      setCombatStats([]);
      setDamageDice([{ type: 'd4', count: 1 }]);
      setDamageKind('magico');
      setOrders(['Curar']);
      setEffectDescription('Restaura 1d4 puntos de vida a un objetivo.');
      setConfigurationLevel('personalization');
    } else if (template === 'buff') {
      setName('Potenciador');
      setManaCost(3);
      setEffectType('effect');
      setEffectSubType('buff');
      setDuration('3 turnos');
      setDurationTurns(3);
      setCombatStats([]);
      setDamageDice([]);
      setOrders([]);
      setEffectDescription('Describe aquí qué mejora concede y a quién afecta.');
      setConfigurationLevel('personalization');
    } else if (template === 'curse') {
      setName('Maldición');
      setManaCost(3);
      setEffectType('effect');
      setEffectSubType('debuff');
      setDuration('3 turnos');
      setDurationTurns(3);
      setCombatStats([]);
      setDamageDice([]);
      setStatuses(['Ralentizar']);
      setOrders([]);
      setEffectDescription('Aplica Ralentizar al objetivo durante 3 turnos.');
      setConfigurationLevel('personalization');
    } else if (template === 'dispel') {
      applyDispelTemplate('armor');
      setConfigurationLevel('advanced');
    } else {
      setName('Prisión Elemental');
      setManaCost(3);
      setEffectType('effect');
      setEffectSubType('debuff');
      setDuration('2 turnos');
      setDurationTurns(2);
      setCombatStats([]);
      setDamageDice([]);
      setStatuses(['Inmovilizar']);
      setOrders(['Contener', 'Inmovilizar']);
      setEffectDescription('Ata o fija al objetivo para impedir su movimiento durante 2 turnos.');
      setConfigurationLevel('personalization');
    }
  };

  const applyElementalTemplate = (template: ElementalTemplateKey) => {
    setSelectedElementalTemplate(template);
    setDispelEnabled(false);
    setIsArmor(false);
    setCastRequirement('none');
    setCastStat('none');
    setDuration('Instantáneo');
    setDurationTurns(0);
    setDamageMode('auto');
    setDamageNotes('');
    setAreaEnabled(false);
    setAreaMode('area_selected');
    setAreaMaxTargets(0);
    setAreaRequiredStatus('Electrificado');
    setAreaShapeNote('');
    setSynergyReaction('none');
    setSynergyConsumeMode('1');

    if (template === 'poison') {
      setName('Dardo Venenoso');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([{ type: 'd6', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Veneno', 'Disparar']);
      setStatuses([]);
      setElemEnabled(true);
      handleSelectElemKind('poison');
      setElemStacks(2);
      setSynergyReaction('none');
      setEffectDescription(
        'Un proyectil mágico que hiere y, con un resultado de 4–6 en el d6, puede dejar 2 cargas de Envenenado durante 3 turnos.'
      );
      return;
    }

    if (template === 'burn') {
      setName('Llama Incendiaria');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([{ type: 'd6', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Fuego', 'Quemar']);
      setStatuses([]);
      setElemEnabled(true);
      handleSelectElemKind('burn');
      setElemStacks(2);
      setElemTrigger('always');
      setSynergyReaction('none');
      setEffectDescription(
        'Una llamarada mágica que, si causa daño, deja 2 cargas de Quemadura durante 2 turnos.'
      );
      return;
    }

    if (template === 'frozen') {
      setName('Lanza de Hielo');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([{ type: 'd6', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Hielo', 'Congelar']);
      setStatuses([]);
      setElemEnabled(true);
      handleSelectElemKind('frozen');
      setElemStacks(1);
      setSynergyReaction('none');
      setEffectDescription(
        'Una lanza de hielo mágica que, con un resultado de 4–6 en el d6 y daño positivo, puede dejar 1 carga de Congelado durante 2 turnos.'
      );
      return;
    }

    if (template === 'electrified') {
      setName('Arco Voltaico');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([{ type: 'd6', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Rayo', 'Electrificar']);
      setStatuses([]);
      setElemEnabled(true);
      handleSelectElemKind('electrified');
      setElemStacks(1);
      setSynergyReaction('none');
      setEffectDescription(
        'Un rayo mágico que electrifica al objetivo si causa daño; otros combatientes Electrificados pueden recibir una descarga cuando impacta un rayo.'
      );
      return;
    }

    if (template === 'bleeding') {
      setName('Tajo Sangrante');
      setManaCost(2);
      setEffectType('damage');
      setCombatStats(['fisico']);
      setDamageDice([{ type: 'd6', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('fisico');
      setOrders(['Cortar', 'Sangrar']);
      setStatuses([]);
      setElemEnabled(true);
      handleSelectElemKind('bleeding');
      setElemStacks(1);
      setSynergyReaction('none');
      setEffectDescription(
        'Un tajo físico que, si causa daño, deja 1 carga de Sangrando durante 3 turnos.'
      );
      return;
    }

    if (template === 'detonate_burn') {
      setName('Detonar Quemadura');
      setManaCost(4);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([{ type: 'd4', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Fuego', 'Detonar']);
      setStatuses([]);
      setElemEnabled(false);
      setSynergyReaction('detonate_burn');
      setSynergyConsumeMode('1');
      setEffectDescription(
        'Un impacto mágico que detona una carga de Quemadura del objetivo y añade daño mágico si la carga existe.'
      );
      return;
    }

    if (template === 'siphon_poison') {
      setName('Sifón Tóxico');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([{ type: 'd4', count: 1 }]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Veneno', 'Drenar']);
      setStatuses([]);
      setElemEnabled(false);
      setSynergyReaction('siphon_poison');
      setSynergyConsumeMode('1');
      setEffectDescription(
        'Un impacto mágico que extrae cargas de Envenenado para dañar al objetivo; un lanzador distinto del objetivo también recupera recursos.'
      );
      return;
    }

    if (template === 'shatter_frozen') {
      setName('Fractura Glacial');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([]);
      setDamageBonus(0);
      setDamageKind('fisico');
      setOrders(['Hielo', 'Fracturar']);
      setStatuses([]);
      setElemEnabled(false);
      setSynergyReaction('shatter_frozen');
      setSynergyConsumeMode('1');
      setEffectDescription(
        'Ataque con Manipulación sin daño directo configurado. Tras un impacto, consume 1 carga de Congelado del objetivo e inflige 1d8 físico por carga consumida.'
      );
      return;
    }

    if (template === 'overload_electrified') {
      setName('Sobrecarga Eléctrica');
      setManaCost(3);
      setEffectType('damage');
      setCombatStats(['manipulacion']);
      setDamageDice([]);
      setDamageBonus(0);
      setDamageKind('magico');
      setOrders(['Electricidad', 'Sobrecargar']);
      setStatuses([]);
      setElemEnabled(false);
      setSynergyReaction('overload_electrified');
      setSynergyConsumeMode('1');
      setAreaEnabled(true);
      setAreaMode('all_electrified');
      setAreaMaxTargets(0);
      setAreaShapeNote('Cadena eléctrica');
      setEffectDescription(
        'Ataque multiobjetivo con Manipulación y sin daño directo configurado. Al resolverse, la reacción global consume 1 carga de Electrificado por combatiente y causa 1d6 mágico por carga consumida.'
      );
      return;
    }

    setName('Hemorragia');
    setManaCost(3);
    setEffectType('damage');
    setCombatStats(['manipulacion']);
    setDamageDice([]);
    setDamageBonus(0);
    setDamageKind('fisico');
    setOrders(['Sangre', 'Consumir']);
    setStatuses([]);
    setElemEnabled(false);
    setSynergyReaction('hemorrhage_bleed');
    setSynergyConsumeMode('1');
    setEffectDescription(
      'Ataque con Manipulación sin daño directo configurado. Tras un impacto, consume 1 carga de Sangrando del objetivo e inflige 1d6 físico por carga consumida; no vuelve a aplicar Sangrando.'
    );
  };

  const handleCategoryChange = (
    nextCat: 'damage' | 'defense' | 'heal' | 'buff' | 'debuff' | 'effect'
  ) => {
    if (nextCat === 'buff' || nextCat === 'debuff' || nextCat === 'effect') {
      setEffectType('effect');
      setEffectSubType(nextCat === 'effect' ? 'general' : nextCat);
      if (nextCat !== 'buff') {
        setIsArmor(false);
      }
      if (durationTurns === 0 && (duration === '1 golpe' || duration === 'Instantáneo')) {
        setDuration('Hasta ser disipado');
      }
      return;
    }

    setEffectType(nextCat);
    if (nextCat === 'defense' && combatStats.length === 0) {
      setCombatStats(['fisico', 'manipulacion']);
      if (castStat === 'manipulacion') setCastStat('none');
    } else if (nextCat === 'damage' && combatStats.length === 0) {
      setCombatStats(['fisico']);
    } else if (nextCat === 'heal' && damageDice.length === 1 && damageDice[0].type === 'd6') {
      setDamageDice([{ type: 'd4', count: 1 }]);
    }
  };

  const toggleCombatStat = (key: StatKey) => {
    setCombatStats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleOrder = (ord: string) => {
    setOrders((prev) => {
      if (prev.includes(ord)) {
        return prev.filter((o) => o !== ord);
      }
      const next = [...prev, ord];
      if (
        SONIC_ORDERS.includes(ord) &&
        ord !== SONIC_BASE_ORDER &&
        !next.includes(SONIC_BASE_ORDER)
      ) {
        return [SONIC_BASE_ORDER, ...next];
      }
      return next;
    });
  };

  const handleCreateOrder = () => {
    const trimmed = newOrderInput.trim();
    if (!trimmed) return;
    onCreateOrder(trimmed);
    if (!orders.includes(trimmed)) {
      setOrders((prev) => [...prev, trimmed]);
    }
    setNewOrderInput('');
  };

  const addExistingStatus = () => {
    if (selectedStatus && !statuses.includes(selectedStatus)) {
      setStatuses((prev) => [...prev, selectedStatus]);
      setSelectedStatus('');
    }
  };

  const handleCreateStatus = () => {
    const trimmed = newStatusInput.trim();
    if (!trimmed) return;
    onCreateStatus(trimmed);
    if (!statuses.includes(trimmed)) {
      setStatuses((prev) => [...prev, trimmed]);
    }
    setNewStatusInput('');
  };

  const buildSpellObject = (
    id = editingSpell ? editingSpell.id : generateId('sp_')
  ): Spell => {
    const cleanedStatusParams: Record<string, SpellStatusParamConfig> = {};
    for (const st of statuses) {
      const cfg = statusParams[st];
      if (cfg && (cfg.autoFails !== undefined || cfg.untilHit !== undefined)) {
        cleanedStatusParams[st] = { ...cfg };
      }
    }
    return {
      id,
      name: name.trim() || 'Hechizo sin nombre',
      manaCost: Math.max(0, manaCost),
      orders: [...orders],
      statuses: [...statuses],
      statusParams: Object.keys(cleanedStatusParams).length > 0 ? cleanedStatusParams : undefined,
      ownerCharacterId:
        editingSpell?.isBasic || !isExclusive
          ? undefined
          : editingSpell?.ownerCharacterId || activeCharacter?.id,
      castRequirement,
      castCondition: castRequirement === 'conditional' ? castCondition.trim() || undefined : undefined,
      castStat: castRequirement === 'none' && effectType === 'damage' ? 'none' : castStat,
      manualCastDice:
        castRequirement === 'none' && effectType === 'damage'
          ? 0
          : Math.max(0, manualCastDice),
      assuredSuccess: Math.max(0, assuredSuccess),
      combatStats: effectType === 'damage' || effectType === 'defense' ? [...combatStats] : [],
      damageMode,
      effectType,
      effectSubType: effectType === 'effect' ? effectSubType : undefined,
      armorConfig:
        effectType === 'effect' && effectSubType === 'buff' && isArmor
          ? {
              isArmor: true,
              element: armorElement.trim() || 'Arcano',
              damageReduction: Math.max(0, armorReduction),
              damageDivisor: armorDivisor,
              maxHits: maxHits > 0 ? maxHits : undefined,
            }
          : undefined,
      collateral: hasCollateral
        ? {
            enabled: true,
            label: collateralLabel.trim() || undefined,
            mode: collateralMode,
            fixedAmount: collateralMode === 'fixed' ? Math.max(0, collateralFixed) : undefined,
            dice:
              collateralMode === 'dice'
                ? [{ type: collateralDieType, count: Math.max(1, collateralDieCount) }]
                : undefined,
            bonus: collateralMode === 'dice' ? collateralBonus : 0,
            damageKind: collateralKind,
            durationType: collateralDurationType,
            durationTurns:
              collateralDurationType === 'turns' ? Math.max(1, collateralTurns) : undefined,
          }
        : undefined,
      damageKind:
        effectType === 'damage'
          ? isSonicSpell({
              name: name.trim(),
              orders,
              damage: { dice: damageDice, bonus: damageBonus, notes: damageNotes },
            })
            ? 'magico'
            : damageKind
          : undefined,
      noMastery: editingSpell?.id === 'basic_curar_heridas' ? true : noMastery,
      damage: {
        dice:
          effectType === 'damage' || effectType === 'heal'
            ? damageDice.map((d) => ({ ...d }))
            : [],
        bonus: damageBonus,
        notes: damageNotes.trim(),
      },
      effectDescription: effectDescription.trim(),
      duration:
        durationTurns > 0 && !duration.trim()
          ? formatTurnDuration(durationTurns)
          : duration.trim(),
      durationTurns: durationTurns > 0 ? durationTurns : undefined,
      maxHits:
        (effectType === 'defense' ||
          (effectType === 'effect' && effectSubType === 'buff')) &&
        maxHits > 0
          ? maxHits
          : undefined,
      dispelConfig:
        effectType === 'effect' && effectSubType === 'debuff' && dispelEnabled
          ? {
              enabled: true,
              scope: dispelScope,
              maxEffects: Math.max(0, Math.floor(dispelMaxTargets || 0)),
              requiresInfluenceCheck: dispelRequiresInfluence,
            }
          : undefined,
      elementalStatus: elemEnabled
        ? {
            kind: elemKind,
            stacks: Math.max(1, Math.min(10, Math.floor(elemStacks || 1))),
            durationTurns: Math.max(1, Math.min(20, Math.floor(elemDurationTurns || 1))),
            trigger: elemTrigger,
            tickDie: elemTickDie === 'none' ? undefined : elemTickDie,
            damageKind: elemDamageKind,
          }
        : undefined,
      synergyReaction: synergyReaction !== 'none' ? synergyReaction : undefined,
      synergyConsumeStacks:
        synergyReaction !== 'none'
          ? synergyConsumeMode === 'all'
            ? 'all'
            : synergyConsumeMode === 'custom'
              ? Math.max(2, Math.min(10, Math.floor(synergyConsumeCount || 2)))
              : 1
          : undefined,
      dependency:
        depEnabled && depRequiredName.trim()
          ? {
              enabled: true,
              scope: depScope,
              requiredSpellId: depRequiredSpellId.trim() || undefined,
              requiredName: depRequiredName.trim(),
              consumeOnUse: depConsumeOnUse,
            }
          : undefined,
      areaConfig: areaEnabled
        ? {
            enabled: true,
            mode: areaMode,
            maxTargets: areaMaxTargets > 0 ? Math.floor(areaMaxTargets) : undefined,
            requiredStatusName:
              areaMode === 'all_with_status' ? areaRequiredStatus.trim() || undefined : undefined,
            shapeNote: areaShapeNote.trim() || undefined,
          }
        : undefined,
      isBasic: editingSpell?.isBasic || false,
    };
  };

  const handleSave = () => {
    const spell = buildSpellObject();
    onSaveSpell(spell, isExclusive ? true : learnForActive);
    if (!editingSpell) {
      resetFields();
      setConfigurationLevel('essential');
    }
  };

  const presetSet = new Set(ORDER_LIBRARY.flatMap((cat) => cat.orders));
  const customOnlyOrders = allOrders.filter((o) => !presetSet.has(o));
  const activeCategoryObj = ORDER_LIBRARY.find((cat) => cat.id === orderCategory);
  const trimmedOrderSearch = orderSearch.trim().toLowerCase();
  const displayedLibraryOrders = trimmedOrderSearch
    ? allOrders.filter((o) => o.toLowerCase().includes(trimmedOrderSearch))
    : orderCategory === 'custom'
      ? customOnlyOrders
      : activeCategoryObj
        ? activeCategoryObj.orders
        : allOrders;

  const castDiceCount =
    castStat === 'none'
      ? 0
      : castStat === 'manual'
        ? manualCastDice
        : getCharacterStatDice(activeCharacter, castStat, formula);

  const combinedCombatDice = combatStats.reduce(
    (sum, k) => sum + getCharacterStatDice(activeCharacter, k, formula),
    0
  );
  const livePreviewSpell = buildSpellObject(draftSpellIdRef.current);
  const selectedCategory =
    effectType === 'effect'
      ? effectSubType === 'buff'
        ? 'buff'
        : effectSubType === 'debuff'
          ? 'debuff'
          : 'effect'
      : effectType;
  const validationMessages = [
    !name.trim() ? 'Agregá un nombre para que el hechizo sea fácil de reconocer.' : '',
    castRequirement === 'conditional' && !castCondition.trim()
      ? 'Indicá cuándo se necesita castear; la condición elegida está vacía.'
      : '',
    depEnabled && !depRequiredName.trim()
      ? 'Elegí o escribí el requisito para que el hechizo pueda guardarse.'
      : '',
    areaEnabled && areaMode === 'all_with_status' && !areaRequiredStatus.trim()
      ? 'Indicá qué estado deben tener los objetivos de esta área.'
      : '',
  ].filter(Boolean);
  const selectedTemplateGuide = selectedElementalTemplate
    ? ELEMENTAL_TEMPLATE_GUIDES[selectedElementalTemplate]
    : null;
  const configuredDamageFormula = damageDice.length
    ? `${damageDice
        .filter((die) => die.count > 0)
        .map((die) => `${die.count}${die.type}`)
        .join(' + ') || 'sin dados'}${damageBonus !== 0 ? ` ${damageBonus > 0 ? '+' : ''}${damageBonus}` : ''}`
    : 'sin dados directos';
  const triggerDescription =
    elemTrigger === 'always'
      ? 'siempre que el impacto cause daño positivo'
      : elemTrigger === 'max_die'
        ? 'solo con el valor máximo de un dado'
        : 'con un resultado de la mitad superior del dado';
  const configuredConsumption =
    synergyConsumeMode === 'all'
      ? 'todas las cargas disponibles'
      : synergyConsumeMode === 'custom'
        ? `${synergyConsumeCount} carga(s)`
        : '1 carga';

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3 sm:p-5 space-y-3.5 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--arc-border)] pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-lg font-bold text-[var(--arc-accent)] break-words">
            {editingSpell ? `Editando: ${editingSpell.name}` : 'Crear un hechizo'}
          </h2>
          <p className="text-xs sm:text-[13px] leading-relaxed text-[var(--arc-muted)]">
            Empezá por la idea principal. Podés ajustar cada detalle o abrir todas las opciones avanzadas cuando las necesites.
          </p>
        </div>
        {editingSpell && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar edición
          </button>
        )}
      </div>

      <div className="space-y-3.5 rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-bold text-[var(--arc-text)]">Configuración progresiva</h3>
            <p className="mt-0.5 text-xs text-[var(--arc-muted)]">
              Cada nivel suma opciones; cambiar de nivel no borra lo que ya configuraste.
            </p>
          </div>
          <div
            className="grid grid-cols-1 sm:flex sm:flex-wrap gap-1.5"
            role="tablist"
            aria-label="Nivel de configuración"
          >
            {(
              [
                ['essential', '1 · Esencial', 'Nombre, coste y tipo principal.'],
                ['personalization', '2 · Personalización', 'Dados, duración, estados y alcance.'],
                ['advanced', '3 · Avanzado', 'Sinergias, condiciones y relaciones especiales.'],
              ] as const
            ).map(([level, label, description]) => (
              <button
                key={level}
                type="button"
                role="tab"
                aria-selected={configurationLevel === level}
                title={description}
                onClick={() => setConfigurationLevel(level)}
                className={`min-h-[34px] rounded-lg border px-2.5 sm:px-3 text-xs font-semibold text-left sm:text-center transition-colors ${
                  configurationLevel === level
                    ? 'border-[var(--arc-accent)] bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                    : 'border-[var(--arc-border)] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--arc-muted)]">
            ¿Qué querés lograr? Elegir una intención solo te lleva a la categoría inicial; podés combinarla con cualquier otra configuración.
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(
              [
                ['damage', 'Atacar'],
                ['defense', 'Defender'],
                ['heal', 'Curar'],
                ['buff', 'Potenciar'],
                ['debuff', 'Debilitar / controlar'],
                ['effect', 'Otro efecto'],
              ] as const
            ).map(([category, label]) => (
              <button
                key={category}
                type="button"
                aria-pressed={selectedCategory === category}
                onClick={() => {
                  handleCategoryChange(category);
                  setConfigurationLevel('personalization');
                }}
                className={`min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                  selectedCategory === category
                    ? 'border-[var(--arc-accent)]/70 bg-[var(--arc-raised)] text-[var(--arc-text)]'
                    : 'border-[var(--arc-border)] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                }`}
              >
                <SpellCategoryIcon category={category} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <details className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--arc-accent)]">
            Empezar desde una plantilla editable
          </summary>
          <p className="my-2 text-xs text-[var(--arc-muted)]">
            La plantilla reemplaza la configuración actual del formulario; después podés cambiar cualquier valor y añadir opciones avanzadas.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['projectile', 'Proyectil ofensivo'],
                ['shield', 'Escudo protector'],
                ['healing', 'Curación'],
                ['buff', 'Potenciador'],
                ['curse', 'Maldición'],
                ['dispel', 'Disipación'],
                ['control', 'Control de objetivos'],
              ] as const
            ).map(([template, label]) => (
              <button
                key={template}
                type="button"
                onClick={() => applyCreationTemplate(template)}
                className="min-h-[30px] rounded-md border border-[var(--arc-border)] px-2.5 text-[11px] font-semibold text-[var(--arc-text)] hover:border-[var(--arc-accent)] hover:bg-[var(--arc-raised)]"
              >
                {label}
              </button>
            ))}
          </div>
        </details>

        {validationMessages.length > 0 && (
          <div className="rounded-lg border border-[#b7864e]/40 bg-[#b7864e]/10 px-3 py-2 text-xs text-[#e6c07b]">
            <p className="font-semibold">Revisá estos detalles antes de guardar:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 sm:gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {/* Nombre, Maná y Duración */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12" data-builder-tier="essential">
            <div className="sm:col-span-6">
              <label
                htmlFor="spell-name"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1.5"
              >
                Nombre{' '}
                <FieldHelp text="Es el título que verán los jugadores en el grimorio. Usá un nombre breve y reconocible." />
              </label>
              <input
                id="spell-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Zarpazo Lunar / Escudo Ígneo / Impacto Arcano"
                className="w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 py-2 text-sm text-[var(--arc-text)] placeholder-[#6c5c4b] focus:border-[var(--arc-accent)] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="spell-mana"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1.5"
              >
                Coste de maná{' '}
                <FieldHelp text="Cantidad de maná que cuesta ejecutar el hechizo según las reglas actuales." />
              </label>
              <input
                id="spell-mana"
                type="number"
                min={0}
                value={manaCost}
                onChange={(e) => setManaCost(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="font-mono-num w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 py-2 text-sm text-[var(--arc-text)] focus:border-[var(--arc-accent)] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="spell-duration"
                className="block text-xs font-semibold text-[var(--arc-muted)] mb-1.5"
              >
                Duración{' '}
                <FieldHelp text="Cuánto permanece activo el efecto. Usá Instantáneo para efectos puntuales o turnos para que la aplicación lleve la cuenta." />
              </label>
              <input
                id="spell-duration"
                type="text"
                list="duration-suggestions"
                value={duration}
                onChange={(e) => {
                  const val = e.target.value;
                  setDuration(val);
                  const parsed = parseDurationTurns({ duration: val, durationTurns: undefined });
                  if (parsed) setDurationTurns(parsed);
                  else if (
                    val.trim().toLowerCase() === 'instantáneo' ||
                    val.trim().toLowerCase() === '1 golpe' ||
                    val.trim().toLowerCase() === 'hasta ser disipado'
                  ) {
                    setDurationTurns(0);
                  }
                }}
                placeholder="Instantáneo, 10 turnos..."
                className="w-full min-h-[40px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 py-2 text-sm text-[var(--arc-text)] placeholder-[#6c5c4b] focus:border-[var(--arc-accent)] focus:outline-none"
              />
              <datalist id="duration-suggestions">
                <option value="Instantáneo" />
                <option value="1 golpe" />
                <option value="3 turnos" />
                <option value="5 turnos" />
                <option value="10 turnos" />
                <option value="Hasta el final del combate" />
                <option value="Hasta ser disipado" />
              </datalist>
            </div>
          </div>

          {/* Contador de turnos automático (se disipa tras X turnos) */}
          <div
            hidden={!tierIsVisible('personalization')}
            data-builder-tier="personalization"
            className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 rounded-lg bg-[var(--arc-surface-alt)] px-3 py-2.5 text-xs"
          >
            <div className="flex items-start sm:items-center gap-2 text-[var(--arc-muted)]">
              <Timer className="h-3.5 w-3.5 text-[var(--arc-magic-accent)] shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Contador automático de turnos{' '}
                <FieldHelp text="Cuando la duración se expresa en turnos, Arcane reduce este contador al avanzar la ronda y retira el efecto al llegar a cero." />
                :{' '}
                <strong className="font-mono-num text-[var(--arc-accent)]">
                  {durationTurns > 0 ? formatTurnDuration(durationTurns) : 'Sin contador'}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyTurnCount(0)}
                className={`min-h-[30px] rounded-md px-2 text-xs font-semibold transition-colors ${
                  durationTurns === 0
                    ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                    : 'text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                }`}
              >
                Sin límite
              </button>
              {[1, 3, 5, 10].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyTurnCount(t)}
                  className={`min-h-[30px] rounded-md px-2 font-mono-num text-xs font-semibold transition-colors ${
                    durationTurns === t
                      ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-text)]'
                      : 'text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                  }`}
                >
                  {t}t
                </button>
              ))}
              <div className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={durationTurns}
                  onChange={(e) => applyTurnCount(parseInt(e.target.value, 10) || 0)}
                  aria-label="Cantidad exacta de turnos antes de disiparse"
                  className="font-mono-num w-14 min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)]"
                />
                <span className="text-xs text-[var(--arc-muted)]">turnos</span>
              </div>
            </div>
          </div>

          {/* Categoría del hechizo: 6 categorías totalmente separadas */}
          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-[var(--arc-muted)]">
              Categoría / intención principal{' '}
              <FieldHelp text="Elegí cómo resuelve principalmente el hechizo. Las opciones adicionales no quedan bloqueadas y pueden combinarse cuando el modelo lo permite." />
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 rounded-lg bg-[var(--arc-input)]">
              {(
                [
                  {
                    cat: 'damage' as const,
                    label: 'Ataque',
                    activeCls:
                      'bg-[var(--arc-cat-damage-bg)] text-[var(--arc-cat-damage-accent)] ring-1 ring-[var(--arc-cat-damage-border)]',
                  },
                  {
                    cat: 'defense' as const,
                    label: 'Defensa',
                    activeCls:
                      'bg-[var(--arc-cat-defense-bg)] text-[var(--arc-cat-defense-accent)] ring-1 ring-[var(--arc-cat-defense-border)]',
                  },
                  {
                    cat: 'heal' as const,
                    label: 'Curación',
                    activeCls:
                      'bg-[var(--arc-cat-heal-bg)] text-[var(--arc-cat-heal-accent)] ring-1 ring-[var(--arc-cat-heal-border)]',
                  },
                  {
                    cat: 'buff' as const,
                    label: 'Buff',
                    activeCls:
                      'bg-[var(--arc-cat-buff-bg)] text-[var(--arc-cat-buff-accent)] ring-1 ring-[var(--arc-cat-buff-border)]',
                  },
                  {
                    cat: 'debuff' as const,
                    label: 'Debuff',
                    activeCls:
                      'bg-[var(--arc-cat-debuff-bg)] text-[var(--arc-cat-debuff-accent)] ring-1 ring-[var(--arc-cat-debuff-border)]',
                  },
                  {
                    cat: 'effect' as const,
                    label: 'Efecto',
                    activeCls:
                      'bg-[var(--arc-cat-effect-bg)] text-[var(--arc-cat-effect-accent)] ring-1 ring-[var(--arc-cat-effect-border)]',
                  },
                ]
              ).map(({ cat, label, activeCls }) => {
                const currentCat =
                  effectType === 'effect'
                    ? effectSubType === 'buff'
                      ? 'buff'
                      : effectSubType === 'debuff'
                        ? 'debuff'
                        : 'effect'
                    : effectType;
                const active = currentCat === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    title={
                      {
                        damage: 'Afecta al objetivo mediante una tirada de ataque.',
                        defense: 'Se utiliza para defenderse, esquivar o bloquear.',
                        heal: 'Recupera puntos de vida.',
                        buff: 'Aplica una mejora o protección activa.',
                        debuff: 'Aplica un perjuicio, estado o disipación.',
                        effect: 'Representa otro efecto mágico o narrativo.',
                      }[cat]
                    }
                    onClick={() => handleCategoryChange(cat)}
                    className={`min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? activeCls
                        : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)] hover:bg-[var(--arc-raised)]'
                    }`}
                  >
                    <SpellCategoryIcon category={cat} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Configuración opcional de durabilidad en golpes para Defensas / Escudos Mágicos */}
            {effectType === 'defense' && (
              <div
                hidden={!tierIsVisible('personalization')}
                className="rounded-lg border border-[var(--arc-cat-defense-border)] bg-[var(--arc-cat-defense-bg)] p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-[var(--arc-cat-defense-accent)]">
                    Durabilidad del escudo / barrera (opcional)
                  </span>
                  <p className="text-xs text-[var(--arc-cat-defense-text)] opacity-85 mt-0.5">
                    Si es mayor a 0, el escudo queda activo y se rompe tras recibir o bloquear esa cantidad de golpes (además de su duración en turnos).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="defense-max-hits"
                    className="text-xs font-semibold text-[var(--arc-cat-defense-text)]"
                  >
                    Se rompe tras (golpes):
                  </label>
                  <input
                    id="defense-max-hits"
                    type="number"
                    min={0}
                    max={99}
                    value={maxHits}
                    onChange={(e) => setMaxHits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="font-mono-num w-20 min-h-[34px] rounded-md border border-[var(--arc-cat-defense-border)] bg-[var(--arc-input)] px-2.5 text-center text-xs text-[var(--arc-text)]"
                  />
                  <span className="text-[11px] text-[var(--arc-muted)]">
                    {maxHits === 0 ? 'Puntual' : `${maxHits} ${maxHits === 1 ? 'golpe' : 'golpes'}`}
                  </span>
                </div>
              </div>
            )}

            {/* Configuración exclusiva de Buff (Armadura Elemental / Mejoras) */}
            {effectType === 'effect' && effectSubType === 'buff' && (
              <div
                hidden={!tierIsVisible('personalization')}
                className="rounded-lg border border-[var(--arc-cat-buff-border)] bg-[var(--arc-cat-buff-bg)] p-3 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[var(--arc-cat-buff-accent)]">
                      Buff (Mejora / Armadura)
                    </span>
                    <p className="text-xs text-[var(--arc-cat-buff-text)] opacity-85 mt-0.5">
                      Armaduras elementales, barreras protectoras o potenciadores con duración en turnos y/o límite de golpes.
                    </p>
                  </div>
                  {controlsEarth && (
                    <button
                      type="button"
                      onClick={() => applyArmorTemplate('Tierra')}
                      className="min-h-[32px] inline-flex items-center gap-1.5 rounded-md border border-[var(--arc-cat-buff-border)] px-2.5 text-xs font-semibold text-[var(--arc-cat-buff-accent)] bg-[var(--arc-input)]/70 hover:brightness-110 transition-all"
                    >
                      <ShieldPlus className="h-3.5 w-3.5 shrink-0" />
                      <span>Plantilla: Armadura de Tierra (10t · 3 golpes)</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-[var(--arc-cat-buff-border)]/45 pt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--arc-cat-buff-text)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isArmor}
                        onChange={(e) => setIsArmor(e.target.checked)}
                        className="h-4 w-4 accent-[#6a9147] shrink-0"
                      />
                      <span>Configurar como Armadura Elemental / Barrera protectora</span>
                      <FieldHelp text="Activa los campos para definir la armadura que reduce o bloquea daño. Usalo para una barrera; desactivalo si el efecto solo concede otra mejora." />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="buff-max-hits"
                        className="text-xs font-semibold text-[#a7d4b3]"
                      >
                        Se rompe tras (golpes):{' '}
                        <FieldHelp text="Con 0, la barrera no se rompe por golpes. Con un valor mayor, desaparece al recibir o reducir esa cantidad de golpes." />
                      </label>
                      <input
                        id="buff-max-hits"
                        type="number"
                        min={0}
                        max={99}
                        value={maxHits}
                        onChange={(e) => setMaxHits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="font-mono-num w-16 min-h-[34px] rounded-md border border-[#3a6147] bg-[#0c140f] px-2 text-center text-xs text-[#e5f7ea]"
                      />
                      <span className="text-[11px] text-[#9ac2a5]">
                        {maxHits === 0 ? 'Solo turnos' : `${maxHits} ${maxHits === 1 ? 'golpe' : 'golpes'}`}
                      </span>
                    </div>
                  </div>

                  {isArmor && (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-[#a7d4b3] mb-1">
                          Elemento / Material de armadura{' '}
                          <FieldHelp text="Nombre visible del material o elemento de la protección, por ejemplo Tierra o Hielo. No cambia por sí solo la reducción." />
                        </label>
                        <input
                          type="text"
                          list="armor-elements-list"
                          value={armorElement}
                          onChange={(e) => setArmorElement(e.target.value)}
                          placeholder="Ej: Tierra, Fuego, Hielo..."
                          className="w-full min-h-[36px] rounded-md border border-[#3a6147] bg-[#0c140f] px-2.5 text-xs text-[#e5f7ea] focus:border-[#78c28c] focus:outline-none"
                        />
                        <datalist id="armor-elements-list">
                          {ARMOR_ELEMENTS.map((el) => (
                            <option key={el} value={el} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#a7d4b3] mb-1">
                          Reducción de daño por golpe{' '}
                          <FieldHelp text="Cantidad fija que la armadura resta del daño de cada golpe recibido." />
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={armorReduction}
                          onChange={(e) =>
                            setArmorReduction(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="font-mono-num w-full min-h-[36px] rounded-md border border-[#3a6147] bg-[#0c140f] px-2.5 text-xs text-[#e5f7ea]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#a7d4b3] mb-1">
                          Mitigación / Resistencia extra{' '}
                          <FieldHelp text="Después de la reducción fija, indica si el daño restante se divide o se anula, según las opciones disponibles." />
                        </label>
                        <select
                          value={armorDivisor}
                          onChange={(e) => setArmorDivisor(Number(e.target.value) as DamageDivisor)}
                          className="w-full min-h-[36px] rounded-md border border-[#3a6147] bg-[#0c140f] px-2.5 text-xs text-[#e5f7ea]"
                        >
                          <option value={1}>Normal (solo reducción fija)</option>
                          <option value={2}>Divide daño ÷2</option>
                          <option value={4}>Divide daño ÷4</option>
                          <option value={0}>Anula daño (0)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {effectType === 'effect' && effectSubType === 'debuff' && (
              <details
                hidden={!tierIsVisible('advanced')}
                data-builder-tier="advanced"
                className="rounded-lg border border-[var(--arc-cat-debuff-border)] bg-[var(--arc-cat-debuff-bg)] p-3 space-y-3 text-xs text-[var(--arc-cat-debuff-text)]"
              >
                <summary className="cursor-pointer font-semibold text-[var(--arc-cat-debuff-accent)]">
                  Opciones avanzadas de debuff y disipación
                  <span className="ml-1 font-normal text-[var(--arc-cat-debuff-text)]">
                    · contrarrestar efectos activos
                  </span>
                </summary>
                <div className="pt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="text-[var(--arc-cat-debuff-accent)]">
                        Debuff / Disipación:
                      </strong>{' '}
                      penalizadores, maldiciones, estados alterados o hechizos para quitar/disipar armaduras y buffs enemigos (se resuelven por Influencia).
                    </div>
                    <button
                      type="button"
                      onClick={() => applyDispelTemplate('armor')}
                      className="min-h-[32px] inline-flex items-center gap-1.5 rounded-md border border-[var(--arc-cat-debuff-border)] px-2.5 text-xs font-semibold text-[var(--arc-cat-debuff-accent)] bg-[var(--arc-input)]/70 hover:brightness-110 transition-all"
                    >
                      <ShieldOff className="h-3.5 w-3.5 shrink-0" />
                      <span>Plantilla: Disipar Armadura</span>
                    </button>
                  </div>

                  <div className="border-t border-[var(--arc-cat-debuff-border)]/45 pt-2.5 space-y-2.5">
                    <label className="inline-flex items-center gap-2 font-semibold text-[var(--arc-cat-debuff-text)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dispelEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDispelEnabled(checked);
                          if (checked && statuses.length === 0) {
                            setStatuses(['Disipar']);
                          }
                        }}
                        className="h-4 w-4 accent-[#d97757] shrink-0"
                      />
                      <span>Quitar / cancelar / disipar efectos activos del objetivo</span>
                      <FieldHelp text="Activa la configuración para retirar efectos que ya estén activos en un objetivo. No aplica por sí sola una maldición o estado." />
                    </label>

                    {dispelEnabled && (
                      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--arc-cat-debuff-accent)] mb-1">
                            Qué puede disipar{' '}
                            <FieldHelp text="Define qué clase de efecto activo puede retirar este hechizo, según los alcances que ya admite el sistema." />
                          </label>
                          <select
                            value={dispelScope}
                            onChange={(e) => setDispelScope(e.target.value as DispelTargetScope)}
                            className="w-full min-h-[34px] rounded-md border border-[var(--arc-cat-debuff-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                          >
                            {(Object.keys(DISPEL_SCOPE_LABELS) as DispelTargetScope[]).map(
                              (scope) => (
                                <option key={scope} value={scope}>
                                  {DISPEL_SCOPE_LABELS[scope]}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--arc-cat-debuff-accent)] mb-1">
                            Cantidad máxima (0 = todos){' '}
                            <FieldHelp text="Máximo de efectos que se pueden retirar con una aplicación. Cero no establece un límite." />
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={dispelMaxTargets}
                            onChange={(e) =>
                              setDispelMaxTargets(Math.max(0, parseInt(e.target.value, 10) || 0))
                            }
                            className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-cat-debuff-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)]"
                          />
                        </div>

                        <div className="flex items-end pb-1">
                          <label className="inline-flex items-center gap-2 text-xs text-[var(--arc-cat-debuff-text)] cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={dispelRequiresInfluence}
                              onChange={(e) => setDispelRequiresInfluence(e.target.checked)}
                              className="h-3.5 w-3.5 accent-[#d97757] shrink-0"
                            />
                            <span>Requiere chequeo de Influencia</span>
                            <FieldHelp text="Si está activo, la disipación necesita superar la tirada de Influencia del objetivo, como en la resolución actual." />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )}

            {effectType === 'effect' && effectSubType === 'general' && (
              <div className="rounded-lg border border-[var(--arc-cat-effect-border)] bg-[var(--arc-cat-effect-bg)] px-3 py-2.5 text-xs text-[var(--arc-cat-effect-text)]">
                <strong className="text-[var(--arc-cat-effect-accent)]">Efecto:</strong> utilidades mágicas, ilusiones, invocaciones, luz de mago o efectos narrativos (separado de Buffs y Debuffs).
              </div>
            )}
          </div>

          {/* Estados elementales y Sinergias (Quemadura, Veneno, Congelado, Electrificado, Sangrando) */}
          <details
            hidden={!tierIsVisible('advanced')}
            data-builder-tier="advanced"
            className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3 space-y-3"
          >
            <summary className="cursor-pointer text-xs font-semibold text-[var(--arc-accent)]">
              Configurar estados elementales y sinergias
              <span className="ml-1 font-normal text-[var(--arc-muted)]">
                · reacciones avanzadas
              </span>
            </summary>
            <div className="pt-3 space-y-3">
              <div>
                <span className="text-xs font-semibold text-[#e2c275]">
                  Estados elementales y Sinergias (Reacciones)
                </span>
                <p className="text-[11px] text-[var(--arc-muted)] mt-0.5">
                  Configurá cuándo se aplica un estado, sus cargas, duración y daño periódico, o una reacción que consuma cargas.
                </p>
              </div>

              {/* Plantillas rápidas 1-clic */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('poison')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#182716] border border-[#3a6133] px-2 text-[11px] font-semibold text-[#b4e89e] hover:brightness-110 transition-all"
                >
                  <Droplets className="h-3 w-3 shrink-0" />
                  Dardo Venenoso
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('burn')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#2c150c] border border-[#78391e] px-2 text-[11px] font-semibold text-[#ffbe94] hover:brightness-110 transition-all"
                >
                  <Flame className="h-3 w-3 shrink-0" />
                  Llama Incendiaria
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('frozen')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#102330] border border-[#2d5d7a] px-2 text-[11px] font-semibold text-[#a6deff] hover:brightness-110 transition-all"
                >
                  <Snowflake className="h-3 w-3 shrink-0" />
                  Lanza de Hielo
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('electrified')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#26200b] border border-[#735e1a] px-2 text-[11px] font-semibold text-[#ffe28a] hover:brightness-110 transition-all"
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  Arco Voltaico
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('bleeding')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#2c1014] border border-[#782632] px-2 text-[11px] font-semibold text-[#ffb3be] hover:brightness-110 transition-all"
                >
                  <Droplets className="h-3 w-3 shrink-0" />
                  Tajo Sangrante
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('detonate_burn')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#33190d] border border-[#944b24] px-2 text-[11px] font-semibold text-[#ffd0a6] hover:brightness-110 transition-all"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  Detonar Quemadura
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('siphon_poison')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#132920] border border-[#2f6e52] px-2 text-[11px] font-semibold text-[#9ff0c8] hover:brightness-110 transition-all"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  Sifón Tóxico
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('shatter_frozen')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#102330] border border-[#2d5d7a] px-2 text-[11px] font-semibold text-[#a6deff] hover:brightness-110 transition-all"
                >
                  <Snowflake className="h-3 w-3 shrink-0" />
                  Fractura Glacial
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('overload_electrified')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#26200b] border border-[#735e1a] px-2 text-[11px] font-semibold text-[#ffe28a] hover:brightness-110 transition-all"
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  Sobrecarga Eléctrica
                </button>
                <button
                  type="button"
                  onClick={() => applyElementalTemplate('hemorrhage_bleed')}
                  className="min-h-[30px] inline-flex items-center gap-1 rounded-md bg-[#2c1014] border border-[#782632] px-2 text-[11px] font-semibold text-[#ffb3be] hover:brightness-110 transition-all"
                >
                  <Droplets className="h-3 w-3 shrink-0" />
                  Hemorragia
                </button>
              </div>

              {selectedTemplateGuide && (
                <aside
                  aria-live="polite"
                  className="space-y-3 rounded-lg border border-[var(--arc-accent)]/45 bg-[var(--arc-surface)] p-3"
                >
                  <div>
                    <h4 className="text-sm font-bold text-[var(--arc-accent)]">
                      Cómo funciona {name || 'esta plantilla'}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--arc-text)]">
                      {selectedTemplateGuide.quick}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <section>
                      <h5 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-muted)]">
                        Resolución
                      </h5>
                      <ol className="mt-1 list-inside list-decimal space-y-1 text-xs leading-relaxed text-[var(--arc-text)]">
                        {selectedTemplateGuide.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </section>
                    <div className="space-y-2.5">
                      <section>
                        <h5 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-muted)]">
                          Ejemplo
                        </h5>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--arc-text)]">
                          {selectedTemplateGuide.example}
                        </p>
                      </section>
                      <section>
                        <h5 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-muted)]">
                          Si no se activa
                        </h5>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--arc-text)]">
                          {selectedTemplateGuide.ifNotTriggered}
                        </p>
                      </section>
                      <section>
                        <h5 className="text-[11px] font-bold uppercase tracking-wide text-[var(--arc-muted)]">
                          Interacciones
                        </h5>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--arc-text)]">
                          {selectedTemplateGuide.interactions}
                        </p>
                      </section>
                    </div>
                  </div>
                  <div className="rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] px-3 py-2 text-xs text-[var(--arc-muted)]">
                    <h5 className="font-bold text-[var(--arc-text)]">
                      Configuración actual del formulario
                    </h5>
                    <p className="mt-1">
                      Coste: <strong className="text-[var(--arc-text)]">{manaCost} Maná</strong> ·
                      Daño directo base configurado:{' '}
                      <strong className="font-mono-num text-[var(--arc-text)]">
                        {configuredDamageFormula} {damageKind === 'magico' ? 'mágico' : 'físico'}
                      </strong>
                      {combatStats.length > 0 && (
                        <>
                          {' '}
                          · Tirada de ataque:{' '}
                          <strong className="text-[var(--arc-text)]">
                            {combatStats.map((stat) => STAT_NAMES[stat]).join(' + ')}
                          </strong>
                        </>
                      )}
                    </p>
                    <p className="mt-1">
                      {elemEnabled && elemKind
                        ? `${ELEMENTAL_STATUS_META[elemKind].name}: ${elemStacks} carga(s), ${elemDurationTurns} turno(s); activación ${triggerDescription}; daño por carga ${
                            elemTickDie === 'none'
                              ? 'ninguno'
                              : `1${elemTickDie} ${elemDamageKind === 'magico' ? 'mágico' : 'físico'}`
                          }.`
                        : 'Sin aplicación directa de estado elemental.'}
                      {synergyReaction !== 'none' &&
                        ` Reacción ${SYNERGY_LABELS[synergyReaction]}; este formulario consume ${configuredConsumption}.`}
                    </p>
                    <p className="mt-1 text-[11px]">
                      Son los valores configurados como base; la resolución final depende de la tirada y de los modificadores de combate existentes.
                    </p>
                  </div>
                </aside>
              )}

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 border-t border-[var(--arc-border)] pt-2.5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--arc-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={elemEnabled}
                    onChange={(e) => setElemEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[var(--arc-accent)] shrink-0"
                  />
                  <span>Aplicar estado elemental definido al impactar</span>
                  <FieldHelp text="Configura el estado elemental que se intentará aplicar cuando el ataque impacte; sus cargas y duración se definen abajo." />
                </label>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="spell-synergy-select"
                      className="text-xs font-semibold text-[var(--arc-muted)]"
                    >
                      Reacción / Sinergia:{' '}
                      <FieldHelp text="Elige una reacción que interactúa con las cargas elementales existentes. Si no corresponde, deja “Sin reacción”." />
                    </label>
                    <select
                      id="spell-synergy-select"
                      value={synergyReaction}
                      onChange={(e) => setSynergyReaction(e.target.value as SynergyReactionType)}
                      className="w-full sm:flex-1 min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      {(Object.keys(SYNERGY_LABELS) as SynergyReactionType[]).map((synKey) => (
                        <option key={synKey} value={synKey}>
                          {SYNERGY_LABELS[synKey]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {synergyReaction !== 'none' && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)]/80 px-2.5 py-2 text-xs">
                      <span className="font-semibold text-[var(--arc-muted)]">
                        Cargas consumidas por efecto:
                        <FieldHelp text="Determina cuántas cargas consume esta reacción al resolverse; la regla base consume una." />
                      </span>
                      <select
                        aria-label="Cantidad de cargas consumidas en reacción sinergia"
                        value={synergyConsumeMode}
                        onChange={(e) =>
                          setSynergyConsumeMode(e.target.value as '1' | 'custom' | 'all')
                        }
                        className="min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                      >
                        <option value="1">1 carga (regla base)</option>
                        <option value="custom">Cantidad específica</option>
                        <option value="all">Todas las cargas</option>
                      </select>
                      {synergyConsumeMode === 'custom' && (
                        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--arc-text)]">
                          <input
                            type="number"
                            min={2}
                            max={10}
                            value={synergyConsumeCount}
                            onChange={(e) =>
                              setSynergyConsumeCount(
                                Math.max(2, Math.min(10, parseInt(e.target.value, 10) || 2))
                              )
                            }
                            className="font-mono-num w-14 min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-center text-xs text-[var(--arc-text)]"
                          />
                          <span className="text-[var(--arc-muted)]">cargas</span>
                        </label>
                      )}
                      <span className="text-[11px] text-[var(--arc-muted)]">
                        Por defecto solo se consume 1 carga en cada efecto, salvo que este hechizo indique otra cantidad.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {elemEnabled && (
                <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-12 pt-1">
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Estado elemental{' '}
                      <FieldHelp text="Elige qué estado elemental intenta aplicar el hechizo; cada opción muestra su funcionamiento existente." />
                    </label>
                    <select
                      value={elemKind}
                      onChange={(e) => handleSelectElemKind(e.target.value as ElementalStatusKind)}
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      {(Object.keys(ELEMENTAL_STATUS_META) as ElementalStatusKind[]).map((k) => (
                        <option key={k} value={k}>
                          {ELEMENTAL_STATUS_META[k].name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Cargas{' '}
                      <FieldHelp text="Cantidad de cargas del estado que se aplica al objetivo." />
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={elemStacks}
                      onChange={(e) =>
                        setElemStacks(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))
                      }
                      className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-center text-xs text-[var(--arc-text)]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Turnos{' '}
                      <FieldHelp text="Cuántos turnos permanece el estado elemental, de acuerdo con su resolución actual." />
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={elemDurationTurns}
                      onChange={(e) =>
                        setElemDurationTurns(
                          Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                        )
                      }
                      className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-center text-xs text-[var(--arc-text)]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Cuándo se activa{' '}
                      <FieldHelp text="Define con qué resultado se aplica el estado: siempre al impactar, con la mitad positiva del dado o solo con su valor máximo." />
                    </label>
                    <select
                      value={elemTrigger}
                      onChange={(e) => setElemTrigger(e.target.value as ElementalTriggerRule)}
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      <option value="always">100% al impactar</option>
                      <option value="upper_half">50% (mitad positiva del dado)</option>
                      <option value="max_die">Dado máximo (ej. 6 en d6)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Daño por carga{' '}
                      <FieldHelp text="Elegí el tamaño del dado que causa cada carga al activarse; “Sin daño periódico” deja el estado sin ese daño adicional." />
                    </label>
                    <select
                      value={elemTickDie}
                      onChange={(e) => setElemTickDie(e.target.value as DieType | 'none')}
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      <option value="none">Sin daño periódico</option>
                      {DIE_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          1{dt}/t
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Naturaleza del daño por carga{' '}
                      <FieldHelp text="Define si el daño periódico de cada carga cuenta como mágico o físico, según las reglas actuales." />
                    </label>
                    <select
                      value={elemDamageKind}
                      onChange={(e) => setElemDamageKind(e.target.value as DamageKind)}
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      <option value="magico">Mágico</option>
                      <option value="fisico">Físico</option>
                    </select>
                  </div>

                  <p className="sm:col-span-12 text-[11px] text-[var(--arc-muted)]">
                    {ELEMENTAL_STATUS_META[elemKind].description}
                  </p>
                </div>
              )}
            </div>
          </details>

          {/* Biblioteca de Órdenes mágicas y de transformación */}
          <div
            hidden={!tierIsVisible('personalization')}
            data-builder-tier="personalization"
            className="space-y-2.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-[#b0a084]">
                Palabras y órdenes del hechizo{' '}
                <FieldHelp text="Las órdenes describen la forma de la magia y ayudan a clasificarla; podés elegir varias o crear una propia. No alteran por sí solas el cálculo de dados." />
              </span>
              <span className="text-xs text-[#8e7f6a]">{orders.length} seleccionada(s)</span>
            </div>

            {orders.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {orders.map((ord) => (
                  <span
                    key={ord}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#5f8240] bg-[#1e2916] px-2.5 py-1 text-xs text-[#d7ebb8]"
                  >
                    {ord}
                    <button
                      type="button"
                      onClick={() => setOrders((prev) => prev.filter((o) => o !== ord))}
                      aria-label={`Quitar orden ${ord}`}
                      className="text-[#9cb984] hover:text-[#e88a70]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#7c6d5a]">
                Sin órdenes asignadas (útil para golpes físicos puros o rasgos sin componente mágico).
              </p>
            )}

            <div className="rounded-lg bg-[var(--arc-surface-alt)] p-3 sm:p-3.5 space-y-3">
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-12">
                <div className="relative sm:col-span-6">
                  <select
                    value={
                      orderCategory === 'custom' && customOnlyOrders.length === 0
                        ? 'elemental'
                        : orderCategory
                    }
                    onChange={(e) => {
                      setOrderCategory(e.target.value);
                      if (orderSearch) setOrderSearch('');
                    }}
                    aria-label="Categoría de órdenes"
                    className="w-full min-h-[38px] appearance-none rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] pl-3 pr-8 text-xs font-semibold text-[var(--arc-text)] focus:border-[var(--arc-accent)] focus:outline-none cursor-pointer transition-colors"
                  >
                    {ORDER_LIBRARY.map((cat) => (
                      <option
                        key={cat.id}
                        value={cat.id}
                        className="bg-[var(--arc-surface)] text-[var(--arc-text)]"
                      >
                        {cat.name} ({cat.orders.length})
                      </option>
                    ))}
                    {customOnlyOrders.length > 0 && (
                      <option
                        value="custom"
                        className="bg-[var(--arc-surface)] text-[var(--arc-text)]"
                      >
                        Personalizadas ({customOnlyOrders.length})
                      </option>
                    )}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--arc-muted)]"
                    aria-hidden="true"
                  />
                </div>

                <div className="relative sm:col-span-6">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--arc-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder={`Buscar entre ${allOrders.length} órdenes...`}
                    aria-label="Buscar orden en la biblioteca"
                    className="w-full min-h-[38px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] pl-8 pr-8 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)] focus:border-[var(--arc-accent)] focus:outline-none"
                  />
                  {orderSearch && (
                    <button
                      type="button"
                      onClick={() => setOrderSearch('')}
                      aria-label="Limpiar búsqueda de órdenes"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {trimmedOrderSearch ? (
                <p className="text-xs text-[var(--arc-muted)]">
                  Mostrando{' '}
                  <strong className="font-mono-num text-[var(--arc-text)]">
                    {displayedLibraryOrders.length}
                  </strong>{' '}
                  coincidencia(s) en todas las categorías.
                </p>
              ) : activeCategoryObj ? (
                <p className="text-xs leading-relaxed text-[var(--arc-muted)]">
                  {activeCategoryObj.description}
                </p>
              ) : orderCategory === 'custom' ? (
                <p className="text-xs leading-relaxed text-[var(--arc-muted)]">
                  Órdenes personalizadas creadas por vos.
                </p>
              ) : null}

              {(orderCategory === 'sonic' || orders.some((o) => SONIC_ORDERS.includes(o))) &&
                !orders.includes(SONIC_BASE_ORDER) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--arc-magic-bg)] px-3 py-2 text-xs text-[var(--arc-magic-text)]">
                    <span>
                      Base sónica: <strong>{SONIC_BASE_ORDER}</strong> acompaña a todos los
                      hechizos sónicos.
                    </span>
                    <button
                      type="button"
                      onClick={() => setOrders((prev) => [SONIC_BASE_ORDER, ...prev])}
                      className="rounded-md bg-[var(--arc-magic-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--arc-magic-text)] hover:brightness-110 transition-colors"
                    >
                      + Añadir {SONIC_BASE_ORDER}
                    </button>
                  </div>
                )}

              {displayedLibraryOrders.length === 0 ? (
                <p className="text-xs text-[var(--arc-muted)] py-1">
                  No se encontró ninguna orden con &ldquo;{orderSearch.trim()}&rdquo;. Podés crearla
                  abajo.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {displayedLibraryOrders.map((ord) => {
                    const selected = orders.includes(ord);
                    return (
                      <button
                        key={ord}
                        type="button"
                        onClick={() => toggleOrder(ord)}
                        className={`min-h-[30px] rounded-md px-2.5 text-xs transition-colors ${
                          selected
                            ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)] font-semibold'
                            : 'bg-[var(--arc-surface)] text-[var(--arc-text)] hover:bg-[var(--arc-raised)]'
                        }`}
                      >
                        {selected ? `✓ ${ord}` : `+ ${ord}`}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2.5 border-t border-[var(--arc-border)]">
                <input
                  type="text"
                  value={newOrderInput}
                  onChange={(e) => setNewOrderInput(e.target.value)}
                  placeholder="Crear nueva orden personalizada (ej: Astral, Cristal, Espejo)..."
                  className="w-full sm:flex-1 min-h-[38px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 py-1.5 text-xs text-[var(--arc-text)] placeholder-[#6c5c4b] focus:border-[var(--arc-accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  className="min-h-[38px] w-full sm:w-auto rounded-lg px-3.5 text-xs font-medium text-[var(--arc-text)] bg-[var(--arc-raised)]/80 hover:bg-[var(--arc-raised)] transition-colors"
                >
                  Crear y añadir
                </button>
              </div>
            </div>
          </div>

          {/* Estados posibles (siempre van por Influencia) */}
          <div
            hidden={!tierIsVisible('personalization')}
            data-builder-tier="personalization"
            className="space-y-2 border-t border-[#3a2d20] pt-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-[#b0a084]">
                Estados que puede aplicar{' '}
                <FieldHelp text="Cada estado se resuelve mediante una tirada de Influencia. Los detalles de cada estado se ajustan según las reglas existentes." />
              </span>
              <span className="font-mono-num text-xs text-[#d4a843]">
                Influencia actual: {getCharacterStatDice(activeCharacter, 'influencia', formula)}d6
              </span>
            </div>
            {statuses.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {statuses.map((st) => (
                    <span
                      key={st}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#785e2a] bg-[#2a2112] px-2.5 py-1 text-xs text-[#f1d58a]"
                    >
                      {st}
                      <button
                        type="button"
                        onClick={() => {
                          setStatuses((prev) => prev.filter((s) => s !== st));
                          setStatusParams((prev) => {
                            const copy = { ...prev };
                            delete copy[st];
                            return copy;
                          });
                        }}
                        aria-label={`Quitar estado ${st}`}
                        className="text-[#cbb893] hover:text-[#e88a70]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {(() => {
                  const configuredStatuses = statuses
                    .map((st) => ({ name: st, key: normalizeCombatStatusKey(st) }))
                    .filter((x): x is { name: string; key: NonNullable<typeof x.key> } =>
                      Boolean(x.key)
                    );
                  if (configuredStatuses.length === 0) return null;

                  return (
                    <div className="rounded-lg border border-[#524028] bg-[#1a140d] p-3 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[#d4a843]">
                        Reglas mecánicas de estados en combate
                      </div>
                      <div className="space-y-2">
                        {configuredStatuses.map(({ name: stName, key }) => {
                          const meta = COMBAT_STATUS_MECHANICS[key];
                          const currentParam = statusParams[stName] || {};
                          const currentFails =
                            currentParam.autoFails ?? meta.defaultAutoFails ?? 1;
                          const currentUntilHit =
                            currentParam.untilHit ?? meta.defaultUntilHit ?? true;

                          return (
                            <div
                              key={stName}
                              className="rounded-md border border-[#3a2d20] bg-[#120e09] p-2.5 space-y-1.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[#f1d58a]">{stName}</span>
                                {meta.supportsAutoFails && (
                                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#cbb893]">
                                    <span>Fallos auto. ({meta.autoFailsTargetLabel}):</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={6}
                                      value={currentFails}
                                      onChange={(e) => {
                                        const val = Math.max(
                                          1,
                                          Math.min(6, parseInt(e.target.value, 10) || 1)
                                        );
                                        setStatusParams((prev) => ({
                                          ...prev,
                                          [stName]: { ...prev[stName], autoFails: val },
                                        }));
                                      }}
                                      className="font-mono-num w-14 min-h-[28px] rounded border border-[#524028] bg-[#1b150e] px-1.5 text-center text-xs font-bold text-[#f1d58a]"
                                    />
                                  </label>
                                )}
                                {meta.supportsUntilHit && (
                                  <div className="inline-flex flex-wrap rounded-md border border-[#524028] bg-[#1b150e] p-0.5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStatusParams((prev) => ({
                                          ...prev,
                                          [stName]: { ...prev[stName], untilHit: true },
                                        }))
                                      }
                                      className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                                        currentUntilHit
                                          ? 'bg-[#6b4d1f] text-[#fff2cf]'
                                          : 'text-[#a3947a] hover:text-[#efe6d5]'
                                      }`}
                                    >
                                      Hasta recibir 1 golpe
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStatusParams((prev) => ({
                                          ...prev,
                                          [stName]: { ...prev[stName], untilHit: false },
                                        }))
                                      }
                                      className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                                        !currentUntilHit
                                          ? 'bg-[#6b4d1f] text-[#fff2cf]'
                                          : 'text-[#a3947a] hover:text-[#efe6d5]'
                                      }`}
                                    >
                                      Duración del hechizo
                                    </button>
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] text-[#b0a084] leading-snug">
                                {meta.detailedRule}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-xs text-[#7c6d5a]">
                Sin estados asignados. Si agregás uno (ej. Aturdir, Cegar, Derribar, Desarmar,
                Empujar, Ensordecer o Inmovilizar), se resolverá por Influencia con sus efectos
                automáticos.
              </p>
            )}
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              <div className="flex gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Seleccionar estado existente"
                  className="flex-1 min-w-0 min-h-[38px] rounded-lg border border-[#433324] bg-[#16110c] px-3 py-2 text-xs text-[#efe6d5] focus:border-[#8fb56a] focus:outline-none"
                >
                  <option value="">Elegir estado...</option>
                  {allStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addExistingStatus}
                  className="min-h-[38px] rounded-lg px-3 text-xs font-medium text-[var(--arc-text)] bg-[var(--arc-raised)]/80 hover:bg-[var(--arc-raised)] shrink-0 transition-colors"
                >
                  Añadir
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStatusInput}
                  onChange={(e) => setNewStatusInput(e.target.value)}
                  placeholder="Nuevo estado..."
                  className="flex-1 min-w-0 min-h-[38px] rounded-lg border border-[#433324] bg-[#16110c] px-3 py-2 text-xs text-[#efe6d5] placeholder-[#6c5c4b] focus:border-[#8fb56a] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateStatus}
                  className="min-h-[38px] rounded-lg px-3 text-xs font-medium text-[var(--arc-text)] bg-[var(--arc-raised)]/80 hover:bg-[var(--arc-raised)] shrink-0 transition-colors"
                >
                  Crear
                </button>
              </div>
            </div>
          </div>

          {/* ¿Cuándo necesita acción de casteo? + Éxitos asegurados */}
          <div
            hidden={!tierIsVisible('personalization')}
            data-builder-tier="personalization"
            className="space-y-4 border-t border-[var(--arc-border)] pt-4"
          >
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#b0a084]">
                ¿En qué momento necesita acción de &quot;Castear&quot;?
              </span>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                {[
                  {
                    value: 'none' as const,
                    title: 'No necesita casteo',
                    desc: 'Ataque o uso directo. Solo muestra «Atacar (Letal / No letal)».',
                  },
                  {
                    value: 'prepare' as const,
                    title: 'Siempre (1 acción previa)',
                    desc: 'Primero declarás casteo (gasta 1 acción y queda preparado) y luego atacás.',
                  },
                  {
                    value: 'conditional' as const,
                    title: 'En situaciones específicas',
                    desc: 'Definís cuándo hace falta castear; si no aplica, podés atacar directo.',
                  },
                ].map((opt) => {
                  const selected = castRequirement === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCastRequirement(opt.value);
                        if (opt.value === 'none' && effectType === 'damage') {
                          setCastStat('none');
                        }
                      }}
                      className={`rounded-lg p-3 text-left transition-colors ${
                        selected
                          ? 'bg-[var(--arc-magic-bg)] text-[var(--arc-magic-text)] ring-1 ring-[var(--arc-magic-accent)]'
                          : 'bg-[var(--arc-surface-alt)] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.title}</div>
                      <div className="mt-1 text-xs leading-relaxed opacity-85">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>

              {castRequirement === 'conditional' && (
                <div className="pt-1">
                  <label
                    htmlFor="cast-condition-input"
                    className="block text-xs font-semibold text-[var(--arc-magic-accent)] mb-1"
                  >
                    ¿En qué momento o situación es necesario castear?
                  </label>
                  <input
                    id="cast-condition-input"
                    type="text"
                    list="cast-condition-suggestions"
                    value={castCondition}
                    onChange={(e) => setCastCondition(e.target.value)}
                    placeholder="Ej: Solo al potenciarlo en área, fuera de forma bestial o para mantenerlo..."
                    className="w-full min-h-[38px] rounded-lg border border-[var(--arc-magic-border)] bg-[var(--arc-magic-bg)] px-3 py-1.5 text-xs text-[var(--arc-magic-text)] placeholder-[var(--arc-muted)] focus:border-[var(--arc-magic-accent)] focus:outline-none"
                  />
                  {!castCondition.trim() && (
                    <p role="alert" className="mt-1 text-xs text-[#e6c07b]">
                      Falta describir la situación. Sin texto, la condición no queda definida.
                    </p>
                  )}
                  <datalist id="cast-condition-suggestions">
                    <option value="Solo al potenciar el ataque" />
                    <option value="Solo fuera de combate o como ritual" />
                    <option value="Solo para mantener el efecto varios turnos" />
                    <option value="Solo en forma humana / sin transformación" />
                    <option value="Solo si requiere preparar terreno o material" />
                  </datalist>
                </div>
              )}
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="cast-stat" className="block text-xs font-semibold text-[#b0a084]">
                  Tirada al castear (opcional){' '}
                  <FieldHelp text="Elegí el atributo que determina los dados de una fase de casteo. Si seleccionás una tirada, la configuración puede cambiar a requerir casteo previo." />
                </label>
                {castRequirement === 'none' && effectType === 'damage' ? (
                  <div className="rounded-lg bg-[var(--arc-surface-alt)] px-3 py-2.5 text-xs leading-relaxed text-[var(--arc-muted)]">
                    Sin fase de casteo: se ejecuta directo con{' '}
                    <strong className="text-[#d7ebb8]">Atacar (Letal / No letal)</strong>.
                    {manaCost > 0 && ' El costo de maná se descuenta automáticamente al atacar.'}
                  </div>
                ) : (
                  <>
                    <select
                      id="cast-stat"
                      value={castStat}
                      onChange={(e) => {
                        const next = e.target.value as CastStatOption;
                        setCastStat(next);
                        if (next !== 'none' && castRequirement === 'none') {
                          setCastRequirement('prepare');
                        }
                      }}
                      className="w-full min-h-[38px] rounded-lg border border-[#433324] bg-[#16110c] px-3 py-2 text-sm text-[#efe6d5] focus:border-[#8fb56a] focus:outline-none"
                    >
                      <option value="none">Ninguna (siempre funciona al declarar)</option>
                      <option value="manipulacion">Opcional: Manipulación</option>
                      <option value="fisico">Opcional: Físico</option>
                      <option value="influencia">Opcional: Influencia</option>
                      <option value="manual">Opcional: Manual</option>
                    </select>

                    {castStat === 'manual' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setManualCastDice((d) => Math.max(0, d - 1))}
                          className="min-h-[36px] w-9 rounded-lg text-sm font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                        >
                          −
                        </button>
                        <span className="font-mono-num text-sm font-bold text-[#8fb56a] px-2">
                          {manualCastDice}d6
                        </span>
                        <button
                          type="button"
                          onClick={() => setManualCastDice((d) => Math.min(20, d + 1))}
                          className="min-h-[36px] w-9 rounded-lg text-sm font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                        >
                          +
                        </button>
                      </div>
                    ) : castStat !== 'none' ? (
                      <p className="font-mono-num text-xs text-[#9c8b75]">
                        Pool con {activeCharacter?.name || 'activo'}:{' '}
                        <strong className="text-[#8fb56a]">{castDiceCount}d6</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-[#7c6d5a]">
                        El casteo siempre funciona: solo se declara (1 acción) y gasta maná.
                      </p>
                    )}
                  </>
                )}
              </div>

              <details
                hidden={!tierIsVisible('advanced')}
                data-builder-tier="advanced"
                className="space-y-2 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3"
              >
                <summary className="cursor-pointer text-xs font-semibold text-[#b0a084]">
                  Éxitos asegurados{' '}
                  <FieldHelp text="Suma éxitos directamente al resultado de ataque, defensa o casteo, sin depender de que aparezcan en los dados. Úsalo solo cuando el efecto garantice ese resultado." />
                </summary>
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssuredSuccess((n) => Math.max(0, n - 1))}
                      aria-label="Reducir éxitos asegurados"
                      className="min-h-[36px] w-9 rounded-lg text-sm font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                    >
                      −
                    </button>
                    <span className="font-mono-num w-20 text-center text-sm font-bold text-[#d4a843]">
                      +{assuredSuccess} éxito{assuredSuccess === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssuredSuccess((n) => Math.min(15, n + 1))}
                      aria-label="Aumentar éxitos asegurados"
                      className="min-h-[36px] w-9 rounded-lg text-sm font-semibold text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-[#7c6d5a]">
                    Se suman al ataque, a la defensa o al casteo según el modo del hechizo.
                  </p>
                </div>
              </details>
            </div>
          </div>

          {/* Atributos híbridos para Ataque o Defensa */}
          {(effectType === 'damage' || effectType === 'defense') && (
            <details
              hidden={!tierIsVisible('advanced')}
              data-builder-tier="advanced"
              className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3"
            >
              <summary className="cursor-pointer text-xs font-semibold text-[var(--arc-accent)]">
                Elegir atributos para la tirada
                <FieldHelp text="Podés sumar uno o varios atributos al pool de combate. Arcane usa la suma de sus dados según la fórmula actual del personaje." />
              </summary>
              <div className="space-y-2.5 pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-[#b0a084]">
                    {effectType === 'defense'
                      ? 'Atributos de defensa (híbrido — p. ej. Físico + Manipulación)'
                      : castRequirement === 'none'
                        ? 'Atributos de ataque (híbrido — se tira directo al atacar)'
                        : castRequirement === 'conditional'
                          ? 'Atributos de ataque (híbrido — directo o tras castear según situación)'
                          : 'Atributos de ataque (híbrido — acción aparte tras castear)'}
                  </span>
                  <span className="font-mono-num text-xs font-bold text-[#8fb56a]">
                    Total: {combinedCombatDice}d6
                  </span>
                </div>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                  {STAT_KEYS.map((key) => {
                    const checked = combatStats.includes(key);
                    const dice = getCharacterStatDice(activeCharacter, key, formula);
                    return (
                      <label
                        key={key}
                        className={`min-h-[40px] flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#242e1b] text-[#efe6d5] ring-1 ring-[#6a9147]'
                            : 'bg-[var(--arc-surface)] text-[#9c8b75] hover:bg-[var(--arc-raised)]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCombatStat(key)}
                            className="h-4 w-4 accent-[#8fb56a]"
                          />
                          <span className="font-medium">{STAT_NAMES[key]}</span>
                        </span>
                        <span className="font-mono-num font-bold text-[#d4a843]">{dice}d6</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          {/* Dados de daño o curación */}
          {(effectType === 'damage' || effectType === 'heal') && (
            <div
              hidden={!tierIsVisible('personalization')}
              data-builder-tier="personalization"
              className="space-y-3 border-t border-[var(--arc-border)] pt-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#b0a084]">
                  {effectType === 'heal' ? 'Dados de curación' : 'Dados de daño'}{' '}
                  <FieldHelp text="Elegí cantidad y tamaño de dados. El resultado se muestra en el grimorio; no cambia ninguna fórmula del sistema." />
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDamageDice((prev) => [
                      ...prev,
                      { type: effectType === 'heal' ? 'd4' : 'd6', count: 1 },
                    ])
                  }
                  className="min-h-[32px] inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir dado
                </button>
              </div>

              <div className="space-y-2">
                {damageDice.map((die, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={die.type}
                      onChange={(e) =>
                        setDamageDice((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, type: e.target.value as DieType } : d
                          )
                        )
                      }
                      aria-label="Tipo de dado"
                      className="w-24 min-h-[36px] rounded-lg border border-[#433324] bg-[#16110c] px-2.5 text-sm text-[#efe6d5]"
                    >
                      {DIE_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={die.count}
                      onChange={(e) =>
                        setDamageDice((prev) =>
                          prev.map((d, i) =>
                            i === idx
                              ? { ...d, count: Math.max(1, parseInt(e.target.value, 10) || 1) }
                              : d
                          )
                        )
                      }
                      aria-label="Cantidad de dados"
                      className="font-mono-num w-20 min-h-[36px] rounded-lg border border-[#433324] bg-[#16110c] px-2.5 text-sm text-[#efe6d5]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDamageDice((prev) =>
                          prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
                        )
                      }
                      aria-label="Quitar dado"
                      className="min-h-[36px] w-9 rounded-lg text-sm text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[#e88a70] transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <label htmlFor="dmg-bonus" className="block text-xs text-[#9c8b75] mb-1">
                    Bonificador fijo{' '}
                    <FieldHelp text="Se suma al resultado de los dados. Puede ser positivo o negativo." />
                  </label>
                  <input
                    id="dmg-bonus"
                    type="number"
                    value={damageBonus}
                    onChange={(e) => setDamageBonus(parseInt(e.target.value, 10) || 0)}
                    className="font-mono-num w-full min-h-[36px] rounded-lg border border-[#433324] bg-[#16110c] px-2.5 text-sm text-[#efe6d5]"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label htmlFor="dmg-notes" className="block text-xs text-[#9c8b75] mb-1">
                    Naturaleza o nota{' '}
                    <FieldHelp text="Texto descriptivo para aclarar el tipo de daño o curación; no modifica el resultado numérico." />
                  </label>
                  <input
                    id="dmg-notes"
                    type="text"
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Ej: ígneo, mágico puro, cortante..."
                    className="w-full min-h-[36px] rounded-lg border border-[#433324] bg-[#16110c] px-2.5 text-sm text-[#efe6d5]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="dmg-mode" className="block text-xs text-[#9c8b75] mb-1">
                    Cómo registrar el resultado{' '}
                    <FieldHelp text="Automático hace que Arcane tire los dados; manual permite anotar el total fuera de la aplicación." />
                  </label>
                  <select
                    id="dmg-mode"
                    value={damageMode}
                    onChange={(e) => setDamageMode(e.target.value as DamageResolutionMode)}
                    className="w-full min-h-[36px] rounded-lg border border-[#433324] bg-[#16110c] px-2.5 text-xs text-[#efe6d5]"
                  >
                    <option value="auto">Automático (app tira dados)</option>
                    <option value="manual">Manual (anotar total)</option>
                  </select>
                </div>
              </div>

              {effectType === 'damage' &&
                (() => {
                  const isSonicDraft = isSonicSpell({
                    name,
                    orders,
                    damage: { dice: damageDice, bonus: damageBonus, notes: damageNotes },
                  });
                  const effectiveKind = isSonicDraft ? 'magico' : damageKind;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--arc-surface-alt)] px-3 py-2 text-xs">
                      <span className="text-[var(--arc-muted)]">
                        {isSonicDraft
                          ? 'Naturaleza del daño: el daño sónico siempre cuenta como Mágico.'
                          : '¿El daño es mágico o físico no mágico?'}{' '}
                        <FieldHelp text="Los hechizos mágicos y todo daño sónico cuentan como mágicos. Elegí físico no mágico solo para ataques puramente físicos." />
                      </span>
                      <div className="flex flex-wrap gap-1 p-0.5 rounded-md bg-[var(--arc-input)]">
                        <button
                          type="button"
                          onClick={() => setDamageKind('magico')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            effectiveKind === 'magico'
                              ? 'bg-[var(--arc-magic-raised)] text-[var(--arc-magic-accent)]'
                              : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                          }`}
                        >
                          {isSonicDraft ? 'Mágico (Sónico)' : 'Mágico'}
                        </button>
                        <button
                          type="button"
                          disabled={isSonicDraft}
                          onClick={() => setDamageKind('fisico')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            effectiveKind === 'fisico'
                              ? 'bg-[var(--arc-phys-raised)] text-[var(--arc-phys-accent)]'
                              : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                          }`}
                        >
                          Físico no mágico
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* Daño en área / Múltiples objetivos (ej. Bola de Fuego, Arco Voltaico) */}
          {effectType === 'damage' && (
            <div
              hidden={!tierIsVisible('personalization')}
              data-builder-tier="personalization"
              className="border-t border-[var(--arc-border)] pt-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#9fd2ff] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaEnabled}
                    onChange={(e) => setAreaEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[var(--arc-accent)] shrink-0"
                  />
                  <span>
                    Daño en área / Multi-objetivo (afecta a más de 1 enemigo en el mismo ataque)
                  </span>
                  <FieldHelp text="Permite seleccionar varios objetivos para la misma tirada de ataque. Usalo para explosiones o cadenas; la tirada y defensas siguen las reglas actuales." />
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setName('Bola de Fuego');
                      setManaCost(5);
                      setEffectType('damage');
                      setCombatStats(['manipulacion']);
                      setDamageDice([{ type: 'd6', count: 2 }]);
                      setDamageBonus(0);
                      setDamageKind('magico');
                      setOrders(['Fuego', 'Expandir', 'Proyectar']);
                      setElemEnabled(true);
                      setElemKind('burn');
                      setElemStacks(1);
                      setElemDurationTurns(2);
                      setElemTrigger('max_die');
                      setElemTickDie('d4');
                      setElemDamageKind('magico');
                      setAreaEnabled(true);
                      setAreaMode('area_selected');
                      setAreaMaxTargets(0);
                      setAreaShapeNote('Radio 20 pies');
                      setEffectDescription(
                        'Esfera ígnea explosiva que afecta a múltiples enemigos en el área con una sola tirada de ataque.'
                      );
                    }}
                    className="min-h-[28px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-[11px] font-semibold text-[#fca5a5] hover:bg-[var(--arc-raised)]"
                  >
                    Plantilla: Bola de Fuego
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setName('Arco Voltaico');
                      setManaCost(4);
                      setEffectType('damage');
                      setCombatStats(['manipulacion']);
                      setDamageDice([{ type: 'd6', count: 2 }]);
                      setDamageBonus(0);
                      setDamageKind('magico');
                      setOrders(['Rayo', 'Expandir']);
                      setElemEnabled(true);
                      setElemKind('electrified');
                      setElemStacks(1);
                      setElemDurationTurns(2);
                      setElemTrigger('always');
                      setElemTickDie('none');
                      setElemDamageKind('magico');
                      setAreaEnabled(true);
                      setAreaMode('all_electrified');
                      setAreaMaxTargets(0);
                      setAreaShapeNote('Cadena eléctrica');
                      setEffectDescription(
                        'Descarga de arco voltaico que salta y ataca automáticamente a todos los enemigos Electrificados.'
                      );
                    }}
                    className="min-h-[28px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-[11px] font-semibold text-[#fde047] hover:bg-[var(--arc-raised)]"
                  >
                    Plantilla: Arco Voltaico
                  </button>
                </div>
              </div>

              {areaEnabled && (
                <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)]/60 p-3 grid gap-3 grid-cols-1 sm:grid-cols-12 text-xs">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      A quién alcanza{' '}
                      <FieldHelp text="Elegí la regla existente para decidir qué objetivos reciben el efecto; solo se aplica a la configuración multiobjetivo." />
                    </label>
                    <select
                      value={areaMode}
                      onChange={(e) => setAreaMode(e.target.value as AreaTargetMode)}
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs text-[var(--arc-text)]"
                    >
                      {(Object.keys(AREA_MODE_LABELS) as AreaTargetMode[]).map((m) => (
                        <option key={m} value={m}>
                          {AREA_MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Máx. objetivos (0 = todos){' '}
                      <FieldHelp text="Limita la cantidad de objetivos afectados. Cero conserva el comportamiento sin límite." />
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={areaMaxTargets}
                      onChange={(e) =>
                        setAreaMaxTargets(
                          Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0))
                        )
                      }
                      className="font-mono-num w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-center text-xs text-[var(--arc-text)]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                      Forma o alcance (nota){' '}
                      <FieldHelp text="Texto informativo, por ejemplo “radio 20 pies” o “cadena eléctrica”; no cambia el cálculo." />
                    </label>
                    <input
                      type="text"
                      value={areaShapeNote}
                      onChange={(e) => setAreaShapeNote(e.target.value)}
                      placeholder="Ej. Radio 20 pies"
                      className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2 text-xs text-[var(--arc-text)]"
                    />
                  </div>

                  {areaMode === 'all_with_status' && (
                    <div className="sm:col-span-12">
                      <label className="block text-[11px] font-semibold text-[var(--arc-muted)] mb-1">
                        Estado que deben tener{' '}
                        <FieldHelp text="Solo se usa con “Todos con estado”: esos objetivos deben tener este estado activo." />
                      </label>
                      <input
                        type="text"
                        value={areaRequiredStatus}
                        onChange={(e) => setAreaRequiredStatus(e.target.value)}
                        placeholder="Ej. Electrificado, Quemadura, Envenenado..."
                        className="w-full min-h-[34px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-surface)] px-2.5 text-xs text-[var(--arc-text)]"
                      />
                      {!areaRequiredStatus.trim() && (
                        <p role="alert" className="mt-1 text-xs text-[#e6c07b]">
                          Indicá el estado que deben tener los objetivos para que esta selección pueda aplicarse.
                        </p>
                      )}
                    </div>
                  )}

                  <p className="sm:col-span-12 text-[11px] text-[var(--arc-muted)]">
                    Al lanzar en combate se tira una sola vez el ataque y se arma una cola de objetivos afectados. En la mesa podés incluir/excluir blancos, resolver cada defensa por separado o aplicar daño directo a todos a la vez.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Daño colateral opcional (impacto cercano o secuela por turnos) */}
          <details
            hidden={!tierIsVisible('advanced')}
            data-builder-tier="advanced"
            className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3"
          >
            <summary className="cursor-pointer text-xs font-semibold text-[var(--arc-accent)]">
              Configuración avanzada: daño colateral
              <span className="ml-1 font-normal text-[var(--arc-muted)]">
                · impacto indirecto o secuela
              </span>
            </summary>
            <div className="pt-3 space-y-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#f3be8d] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCollateral}
                  onChange={(e) => setHasCollateral(e.target.checked)}
                  className="h-4 w-4 accent-[#e07a3d] shrink-0"
                />
                <span>
                  Configurar daño colateral (p. ej. si se lanza muy cerca del usuario o deja secuela)
                </span>
                <FieldHelp text="Define un efecto indirecto o una secuela adicional. Solo se aplica si el sistema actual resuelve ese daño colateral." />
              </label>

              {hasCollateral && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 rounded-lg bg-[var(--arc-surface)] p-3">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                      Motivo del efecto{' '}
                      <FieldHelp text="Describe qué provoca el daño indirecto, por ejemplo una explosión cercana o una secuela." />
                    </label>
                    <input
                      type="text"
                      value={collateralLabel}
                      onChange={(e) => setCollateralLabel(e.target.value)}
                      placeholder="Ej: Explosión cercana, Quemadura colateral..."
                      className="w-full min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                      Formato del resultado{' '}
                      <FieldHelp text="Elegí un valor fijo o una fórmula de dados para el efecto colateral." />
                    </label>
                    <select
                      value={collateralMode}
                      onChange={(e) => setCollateralMode(e.target.value as 'fixed' | 'dice')}
                      className="w-full min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-2 text-xs text-[#efe6d5]"
                    >
                      <option value="fixed">Valor fijo</option>
                      <option value="dice">Dados (d4–d12)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    {collateralMode === 'fixed' ? (
                      <>
                        <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                          Valor fijo de daño{' '}
                          <FieldHelp text="Cantidad aplicada directamente cuando el efecto colateral es fijo." />
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={collateralFixed}
                          onChange={(e) =>
                            setCollateralFixed(Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="font-mono-num w-full min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                          Dados colaterales (+ fijo){' '}
                          <FieldHelp text="Cantidad y tamaño de dados del daño indirecto; el campo siguiente suma un bono fijo opcional." />
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={collateralDieCount}
                            onChange={(e) =>
                              setCollateralDieCount(
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            aria-label="Cantidad de dados colaterales"
                            className="font-mono-num w-14 min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-1.5 text-center text-xs text-[#efe6d5]"
                          />
                          <select
                            value={collateralDieType}
                            onChange={(e) => setCollateralDieType(e.target.value as DieType)}
                            aria-label="Tipo de dado colateral"
                            className="min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-1.5 text-xs text-[#efe6d5]"
                          >
                            {DIE_TYPES.map((dt) => (
                              <option key={dt} value={dt}>
                                {dt}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={collateralBonus}
                            onChange={(e) =>
                              setCollateralBonus(Math.max(0, parseInt(e.target.value, 10) || 0))
                            }
                            aria-label="Bono fijo colateral"
                            title="Bono fijo opcional (+N)"
                            className="font-mono-num w-14 min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-1.5 text-center text-xs text-[#efe6d5]"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                      Naturaleza del daño{' '}
                      <FieldHelp text="Indica si el daño indirecto cuenta como mágico o físico." />
                    </label>
                    <select
                      value={collateralKind}
                      onChange={(e) => setCollateralKind(e.target.value as DamageKind)}
                      className="w-full min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-2 text-xs text-[#efe6d5]"
                    >
                      <option value="magico">Mágico</option>
                      <option value="fisico">Físico</option>
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                      Duración del daño{' '}
                      <FieldHelp text="Instantáneo aplica un impacto; por turnos causa el efecto al inicio de cada turno durante el período indicado." />
                    </label>
                    <select
                      value={collateralDurationType}
                      onChange={(e) =>
                        setCollateralDurationType(e.target.value as 'instant' | 'turns')
                      }
                      className="w-full min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-2 text-xs text-[#efe6d5]"
                    >
                      <option value="instant">Instantáneo (1 impacto)</option>
                      <option value="turns">Por turnos (inicio de turno)</option>
                    </select>
                  </div>

                  {collateralDurationType === 'turns' && (
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-[#d6b18f] mb-1">
                        Cantidad de turnos{' '}
                        <FieldHelp text="Cuántos turnos se repite el daño colateral cuando su duración es por turnos." />
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={collateralTurns}
                        onChange={(e) =>
                          setCollateralTurns(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="font-mono-num w-full min-h-[36px] rounded-md border border-[#4f3422] bg-[#120d09] px-2.5 text-xs text-[#efe6d5]"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>

          {/* Requisitos de activación */}
          <details
            hidden={!tierIsVisible('advanced')}
            data-builder-tier="advanced"
            className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3"
          >
            <summary className="cursor-pointer text-xs font-semibold text-[var(--arc-accent)]">
              Requisitos de activación
              <span className="ml-1 font-normal text-[var(--arc-muted)]">· condición previa</span>
            </summary>
            <div className="pt-3 space-y-3">
              <p className="text-xs leading-relaxed text-[var(--arc-muted)]">
                Este hechizo necesita que se cumpla una condición antes de poder ejecutarse. Podés requerir un efecto activo sobre vos, un aliado o tu objetivo.
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--arc-accent)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={depEnabled}
                  onChange={(e) => setDepEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[var(--arc-action)] shrink-0"
                />
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span>Este hechizo requiere una condición previa</span>
                <FieldHelp text="Al usarlo en combate se comprueba el requisito con la validación existente; si falta, el hechizo no se ejecuta." />
              </label>

              {depEnabled &&
                (() => {
                  const activeKnownSet = new Set(activeCharacter?.knownSpells || []);
                  const candidateSpells = spells.filter((s) => s.id !== editingSpell?.id);
                  const ownSpells = candidateSpells
                    .filter(
                      (s) =>
                        activeKnownSet.has(s.id) ||
                        (activeCharacter && s.ownerCharacterId === activeCharacter.id)
                    )
                    .sort((a, b) => {
                      const aBuff =
                        a.effectType === 'effect' && getEffectiveEffectSubType(a) === 'buff'
                          ? 0
                          : 1;
                      const bBuff =
                        b.effectType === 'effect' && getEffectiveEffectSubType(b) === 'buff'
                          ? 0
                          : 1;
                      if (aBuff !== bBuff) return aBuff - bBuff;
                      if (!a.isBasic && b.isBasic) return -1;
                      if (a.isBasic && !b.isBasic) return 1;
                      return a.name.localeCompare(b.name);
                    });
                  const ownIds = new Set(ownSpells.map((s) => s.id));
                  const otherSpells = candidateSpells
                    .filter((s) => !ownIds.has(s.id))
                    .sort((a, b) => a.name.localeCompare(b.name));
                  const debuffSpells = candidateSpells
                    .filter(
                      (s) =>
                        (s.effectType === 'effect' && getEffectiveEffectSubType(s) === 'debuff') ||
                        (s.statuses && s.statuses.length > 0)
                    )
                    .sort((a, b) => a.name.localeCompare(b.name));

                  const elementalNames = Object.values(ELEMENTAL_STATUS_META).map((m) => m.name);
                  const elementalSet = new Set(elementalNames.map((n) => n.toLowerCase()));
                  const extraStatuses = allStatuses.filter(
                    (st) => !elementalSet.has(st.trim().toLowerCase())
                  );

                  const selectedDropdownVal = depRequiredSpellId
                    ? `spell:${depRequiredSpellId}`
                    : depScope === 'target_status' &&
                        (elementalNames.includes(depRequiredName) ||
                          extraStatuses.includes(depRequiredName))
                      ? `status:${depRequiredName}`
                      : '';

                  return (
                    <div className="rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] p-3 space-y-3">
                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-[var(--arc-muted)]">
                          ¿Dónde debe cumplirse?{' '}
                          <FieldHelp text="Elegí en qué personaje o blanco busca el combate el efecto requerido." />
                        </span>
                        <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-[var(--arc-input)]">
                          {(
                            [
                              { id: 'self_active' as const, label: 'Sobre vos' },
                              { id: 'ally_active' as const, label: 'Vos o un aliado' },
                              { id: 'target_status' as const, label: 'En el objetivo' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setDepScope(opt.id);
                                if (opt.id === 'target_status' && depRequiredSpellId) {
                                  const linked = spells.find((s) => s.id === depRequiredSpellId);
                                  if (linked && getEffectiveEffectSubType(linked) === 'buff') {
                                    setDepRequiredSpellId('');
                                  }
                                }
                              }}
                              className={`min-h-[30px] px-2.5 text-xs font-semibold rounded-md transition-colors ${
                                depScope === opt.id
                                  ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--arc-muted)]">
                          {SPELL_DEPENDENCY_SCOPE_LABELS[depScope]}
                        </p>
                      </div>

                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="dep-select-existing"
                            className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
                          >
                            {depScope === 'target_status'
                              ? 'Qué estado o efecto debe tener el objetivo'
                              : 'Qué efecto o hechizo debe estar activo'}{' '}
                            <FieldHelp text="Elegí una opción existente para vincularla por su identidad, o escribí el nombre exacto del requisito." />
                          </label>
                          <select
                            id="dep-select-existing"
                            value={selectedDropdownVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                setDepRequiredSpellId('');
                                return;
                              }
                              if (val.startsWith('spell:')) {
                                const spId = val.slice(6);
                                const found = spells.find((s) => s.id === spId);
                                if (found) {
                                  setDepRequiredSpellId(found.id);
                                  setDepRequiredName(found.name);
                                }
                              } else if (val.startsWith('status:')) {
                                setDepRequiredSpellId('');
                                setDepRequiredName(val.slice(7));
                              }
                            }}
                            className="w-full min-h-[36px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)] focus:border-[var(--arc-accent)] focus:outline-none"
                          >
                            <option value="">
                              {depScope === 'target_status'
                                ? 'Seleccionar estado o efecto...'
                                : 'Seleccionar hechizo o efecto...'}
                            </option>
                            {depScope === 'target_status' ? (
                              <>
                                <optgroup label="Estados elementales">
                                  {elementalNames.map((stName) => (
                                    <option key={`el-${stName}`} value={`status:${stName}`}>
                                      {stName}
                                    </option>
                                  ))}
                                </optgroup>
                                {extraStatuses.length > 0 && (
                                  <optgroup label="Otros estados">
                                    {extraStatuses.map((stName) => (
                                      <option key={`st-${stName}`} value={`status:${stName}`}>
                                        {stName}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {debuffSpells.length > 0 && (
                                  <optgroup label="Debuffs creados">
                                    {debuffSpells.map((sp) => (
                                      <option key={sp.id} value={`spell:${sp.id}`}>
                                        {sp.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </>
                            ) : (
                              <>
                                {ownSpells.length > 0 && (
                                  <optgroup
                                    label={`Grimorio de ${activeCharacter?.name || 'personaje activo'}`}
                                  >
                                    {ownSpells.map((sp) => (
                                      <option key={sp.id} value={`spell:${sp.id}`}>
                                        {sp.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {otherSpells.length > 0 && (
                                  <optgroup label="Otros hechizos / buffs de compañeros">
                                    {otherSpells.map((sp) => (
                                      <option key={sp.id} value={`spell:${sp.id}`}>
                                        {sp.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="dep-required-name"
                            className="block text-xs font-semibold text-[var(--arc-muted)] mb-1"
                          >
                            Nombre del requisito{' '}
                            <FieldHelp text="Debe coincidir con el nombre del estado o efecto que se encontrará durante el combate." />
                          </label>
                          <input
                            id="dep-required-name"
                            type="text"
                            value={depRequiredName}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setDepRequiredName(nextVal);
                              if (depRequiredSpellId) {
                                const linked = spells.find((s) => s.id === depRequiredSpellId);
                                if (!linked || linked.name !== nextVal) {
                                  setDepRequiredSpellId('');
                                }
                              }
                            }}
                            placeholder={
                              depScope === 'target_status'
                                ? 'Ej: Quemadura, Envenenado, Marca...'
                                : 'Ej: Nombre del buff o hechizo previo...'
                            }
                            className="w-full min-h-[36px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2.5 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)] focus:border-[var(--arc-accent)] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-[var(--arc-border)]/70 pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--arc-muted)]">
                            ¿Qué pasa con el requisito al ejecutar?
                          </span>
                          <FieldHelp text="Consumir retira el estado o hechizo preparado que cumplió el requisito. Mantenerlo deja que continúe según su duración y las reglas normales." />
                        </div>
                        <div className="inline-flex flex-wrap p-0.5 rounded-lg bg-[var(--arc-input)]">
                          <button
                            type="button"
                            onClick={() => setDepConsumeOnUse(false)}
                            className={`min-h-[30px] px-3 text-xs font-semibold rounded-md transition-colors ${
                              !depConsumeOnUse
                                ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                                : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                            }`}
                          >
                            Mantener requisito
                          </button>
                          <button
                            type="button"
                            onClick={() => setDepConsumeOnUse(true)}
                            className={`min-h-[30px] px-3 text-xs font-semibold rounded-md transition-colors ${
                              depConsumeOnUse
                                ? 'bg-[#7a2e1f] text-[#ffe1d8]'
                                : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
                            }`}
                          >
                            Consumir requisito
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--arc-muted)]">
                          {depConsumeOnUse
                            ? `Al ejecutar, se consumirá «${depRequiredName.trim() || 'el requisito'}» en el personaje que lo tenga. Ejemplo: si habilita «${name.trim() || 'este hechizo'}», se retira al ejecutarlo.`
                            : `«${depRequiredName.trim() || 'El requisito'}» no se consume: permanece hasta que venza o termine por sus reglas normales. Ejemplo: puede seguir habilitando «${name.trim() || 'este hechizo'}» mientras continúe activo.`}
                        </p>
                      </div>

                      {depRequiredName.trim() ? (
                        <div
                          aria-label="Relación entre requisito y hechizo"
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--arc-accent)]/30 bg-[var(--arc-surface-alt)] px-3 py-2 text-xs"
                        >
                          <span className="rounded-md bg-[var(--arc-raised)] px-2 py-1 font-semibold text-[var(--arc-text)]">
                            {depRequiredName.trim()}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                          <span className="text-[var(--arc-muted)]">condición cumplida</span>
                          <ArrowRight className="h-3.5 w-3.5 text-[var(--arc-accent)]" />
                          <span className="rounded-md bg-[var(--arc-raised)] px-2 py-1 font-semibold text-[var(--arc-accent)]">
                            {name.trim() || 'Este hechizo'} habilitado
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--arc-muted)] leading-relaxed">
                          Elegí o escribí el requisito para que el combate pueda comprobarlo y habilitar este hechizo.
                        </p>
                      )}
                      {depEnabled && !depRequiredName.trim() && (
                        <p role="alert" className="text-xs text-[#e6c07b]">
                          Este requisito está activado, pero no se guardará hasta indicar qué efecto se necesita.
                        </p>
                      )}
                    </div>
                  );
                })()}
            </div>
          </details>

          {/* Descripción del efecto */}
          <div
            data-builder-tier="essential"
            className="space-y-1.5 border-t border-[var(--arc-border)] pt-4"
          >
            <label
              htmlFor="effect-desc"
              className="block text-xs font-semibold text-[var(--arc-muted)]"
            >
              ¿Qué ocurre cuando se usa?{' '}
              <FieldHelp text="Explicá el efecto con palabras claras: qué hace, sobre quién y en qué situación. Esta descripción acompaña los valores mecánicos; no los reemplaza." />
            </label>
            <textarea
              id="effect-desc"
              rows={2}
              value={effectDescription}
              onChange={(e) => setEffectDescription(e.target.value)}
              placeholder="Ej: Se transforma parcialmente o canaliza energía para potenciar el siguiente impacto..."
              className="w-full rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 py-2 text-sm text-[var(--arc-text)] placeholder-[#6c5c4b] focus:border-[var(--arc-accent)] focus:outline-none"
            />
            <label
              hidden={!tierIsVisible('advanced')}
              className="inline-flex items-center gap-2 text-xs text-[var(--arc-muted)] cursor-pointer pt-1"
            >
              <input
                type="checkbox"
                checked={noMastery}
                disabled={editingSpell?.id === 'basic_curar_heridas'}
                onChange={(e) => setNoMastery(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--arc-accent)] shrink-0"
              />
              <span>No puede ser mejorado por maestría</span>
              <FieldHelp text="Desactiva únicamente las mejoras de maestría para este hechizo; no cambia su aprendizaje ni el nivel del personaje." />
            </label>
          </div>

          {activeCharacter && !editingSpell?.isBasic && (
            <div
              hidden={!tierIsVisible('advanced')}
              data-builder-tier="advanced"
              className="space-y-2 border-t border-[var(--arc-border)] pt-4 text-xs"
            >
              <span className="block font-semibold text-[var(--arc-muted)]">
                Lista donde se guarda este hechizo:{' '}
                <FieldHelp text="Elige si el hechizo queda asociado solo a este personaje o si se comparte en la biblioteca general." />
              </span>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
                <label className="inline-flex items-center gap-2 text-[var(--arc-text)] cursor-pointer">
                  <input
                    type="radio"
                    name="spell-ownership"
                    checked={isExclusive}
                    onChange={() => {
                      setIsExclusive(true);
                      setLearnForActive(true);
                    }}
                    className="h-4 w-4 accent-[var(--arc-action)] shrink-0"
                  />
                  <span>
                    Solo de <strong>{activeCharacter.name}</strong> (no se mezcla con otros
                    jugadores)
                  </span>
                </label>
                <label className="inline-flex items-center gap-2 text-[var(--arc-muted)] cursor-pointer">
                  <input
                    type="radio"
                    name="spell-ownership"
                    checked={!isExclusive}
                    onChange={() => setIsExclusive(false)}
                    className="h-4 w-4 accent-[var(--arc-accent)] shrink-0"
                  />
                  <span>Compartido en biblioteca general</span>
                </label>
              </div>
              {!isExclusive && !editingSpell && (
                <label className="inline-flex items-center gap-2 text-[var(--arc-text)] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={learnForActive}
                    onChange={(e) => setLearnForActive(e.target.checked)}
                    className="h-4 w-4 accent-[var(--arc-action)] shrink-0"
                  />
                  <span>
                    Agregar también al grimorio de <strong>{activeCharacter.name}</strong>
                  </span>
                  <FieldHelp text="Al guardar el hechizo compartido, agrega también este hechizo al grimorio del personaje activo." />
                </label>
              )}
            </div>
          )}

          {/* Acciones del formulario */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="col-span-2 sm:flex-1 min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--arc-action)] px-4 py-2 text-xs sm:text-sm font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] shadow-sm transition-colors"
            >
              <Save className="h-4 w-4 shrink-0" />
              <span>{editingSpell ? 'Actualizar hechizo' : 'Guardar hechizo'}</span>
            </button>
            <button
              type="button"
              onClick={() => onTestSpell(buildSpellObject())}
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-surface-alt)] sm:bg-transparent px-3 py-2 text-xs sm:text-sm font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
            >
              <Dices className="h-4 w-4 shrink-0" />
              <span>Probar</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewSnapshot(buildSpellObject(draftSpellIdRef.current))}
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-surface-alt)] sm:bg-transparent px-3 py-2 text-xs sm:text-sm font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
            >
              <Eye className="h-4 w-4 shrink-0" />
              <span>Ficha</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetFields();
                if (editingSpell) onCancelEdit();
              }}
              className="col-span-2 sm:col-span-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--arc-surface-alt)] sm:bg-transparent px-3 py-2 text-xs sm:text-sm font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>

        <aside className="min-w-0 border-t xl:border-t-0 border-[var(--arc-border)] pt-4 xl:pt-0 space-y-3">
          <div className="flex items-center justify-between gap-2 xl:block mb-1">
            <div>
              <h3 className="text-sm font-bold text-[var(--arc-text)]">Vista en tiempo real</h3>
              <p className="text-xs text-[var(--arc-muted)] hidden xl:block">
                Se actualiza con los valores del formulario. No guarda el hechizo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMobilePreview(!showMobilePreview)}
              className="xl:hidden min-h-[32px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-raised)] px-2.5 text-xs font-semibold text-[var(--arc-accent)] hover:brightness-110 shrink-0"
            >
              {showMobilePreview ? 'Ocultar vista previa' : 'Ver vista previa'}
            </button>
          </div>
          <div className={`${showMobilePreview ? 'block' : 'hidden xl:block'}`}>
            <SpellInspector
              key={`live-${draftSpellIdRef.current}`}
              presentation="embedded"
              spell={livePreviewSpell}
              spells={[
                ...spells.filter((spell) => spell.id !== livePreviewSpell.id),
                livePreviewSpell,
              ]}
              activeCharacter={activeCharacter}
              formula={formula}
              contextLabel="Borrador sin guardar"
              onTestSpell={onTestSpell}
            />
          </div>
        </aside>
      </div>

      {previewSnapshot && (
        <SpellInspector
          key={previewSnapshot.id}
          spell={previewSnapshot}
          spells={[
            ...spells.filter((spell) => spell.id !== previewSnapshot.id),
            previewSnapshot,
          ]}
          activeCharacter={activeCharacter}
          formula={formula}
          contextLabel="Vista previa del borrador · todavía no guardado"
          onTestSpell={onTestSpell}
          onClose={() => setPreviewSnapshot(null)}
        />
      )}
    </section>
  );
}