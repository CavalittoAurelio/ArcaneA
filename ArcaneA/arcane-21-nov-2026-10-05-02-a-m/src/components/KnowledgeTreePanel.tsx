import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  createLucideIcon,
  KeyRound,
  List,
  Lock,
  LockKeyhole,
  Network,
  Plus,
  Sparkles,
  type IconNode,
  type LucideIcon,
} from 'lucide-react';
import type { Character, KnowledgeTreeSettings, Spell } from '../types/rpg';
import {
  KNOWLEDGE_DISCIPLINES,
  KNOWLEDGE_SPELL_METADATA,
  type KnowledgeBranch,
  type KnowledgeSpellMetadata,
  getKnowledgeBranches,
  getKnowledgeDisciplineAccess,
  getKnowledgeRequirements,
  getKnowledgeSpellAccess,
} from '../utils/knowledgeTrees';

interface KnowledgeTreePanelProps {
  spells: Spell[];
  activeCharacter: Character | undefined;
  settings: KnowledgeTreeSettings;
  onLearnSpell: (spellId: string) => string | null;
  onSetDisciplineMastery: (disciplineId: string, level: number) => void;
  onToggleDisciplineDiscovery: (disciplineId: string, unlock: boolean) => void;
  onUpdateSettings: (settings: KnowledgeTreeSettings) => void;
  onGoToGrimorio: () => void;
}

const DISCIPLINE_KIND_LABELS = {
  nature: 'Naturaleza',
  specialization: 'Especialización de Tierra',
  combined: 'Disciplina combinada',
};

const defineSpellIcon = (name: string, shapes: IconNode): LucideIcon => {
  const keyedShapes: IconNode = shapes.map(([tag, attributes], index) => {
    const node: IconNode[number] = [
      tag,
      { ...attributes, key: `${name}-${index}` },
    ];
    return node;
  });
  return createLucideIcon(name, keyedShapes);
};

const SPELL_ICONS: Record<string, LucideIcon> = {
  knowledge_earth_scree_surge: defineSpellIcon('ScreeSurge', [
    ['path', { d: 'M3 18h18' }],
    ['path', { d: 'M6 17l2-7 5 2 2-6 4 11' }],
    ['path', { d: 'M4 7h4' }],
    ['path', { d: 'M5 5l-2 2 2 2' }],
    ['path', { d: 'M15 14l3 3-3 3' }],
  ]),
  knowledge_earth_fault_pulse: defineSpellIcon('FaultPulse', [
    ['path', { d: 'M2 17h4l2-5 3 7 3-10 2 5h6' }],
    ['path', { d: 'M5 8c1.8-1.8 4.2-1.8 6 0' }],
    ['path', { d: 'M13 8c1.8-1.8 4.2-1.8 6 0' }],
    ['path', { d: 'M8 5c2.8-2.7 5.2-2.7 8 0' }],
  ]),
  knowledge_earth_marl_prison: defineSpellIcon('MarlPrison', [
    ['circle', { cx: '12', cy: '8', r: '2' }],
    ['path', { d: 'M8 19v-2a4 4 0 0 1 8 0v2' }],
    ['path', { d: 'M4 8c0 5 2 8 5 10' }],
    ['path', { d: 'M20 8c0 5-2 8-5 10' }],
    ['path', { d: 'M4 8l2-2M20 8l-2-2' }],
  ]),
  knowledge_earth_layered_guard: defineSpellIcon('LayeredGuard', [
    ['path', { d: 'M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z' }],
    ['path', { d: 'M6 8.5 12 6l6 2.5' }],
    ['path', { d: 'M5 12l7-3 7 3' }],
    ['path', { d: 'M7 15l5-2 5 2' }],
  ]),
  knowledge_earth_quarry_spike: defineSpellIcon('QuarrySpike', [
    ['path', { d: 'M3 20h18' }],
    ['path', { d: 'm7 19 5-14 5 14' }],
    ['path', { d: 'M12 5v-2' }],
    ['path', { d: 'M4 15h2M18 15h2' }],
  ]),
  knowledge_rock_flint_pin: defineSpellIcon('FlintPin', [
    ['path', { d: 'm4 19 5-13 3 6 2-8 6 15-9-3-7 3Z' }],
    ['path', { d: 'm9 6 5 11' }],
    ['path', { d: 'm14 4 1 9' }],
    ['path', { d: 'M3 21h18' }],
  ]),
  knowledge_rock_basalt_aegis: defineSpellIcon('BasaltAegis', [
    ['path', { d: 'M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z' }],
    ['path', { d: 'm8 12 2.5 2.5L16 9' }],
    ['path', { d: 'm7 7 5-2 5 2' }],
  ]),
  knowledge_rock_strata_split: defineSpellIcon('StrataSplit', [
    ['path', { d: 'M3 6h7l2 3 2-3h7' }],
    ['path', { d: 'M3 12h5l4 3 4-3h5' }],
    ['path', { d: 'M3 18h7l2-3 2 3h7' }],
    ['path', { d: 'm12 2-1 4 2 3-2 3 2 3-1 7' }],
  ]),
  knowledge_rock_resonant_plate: defineSpellIcon('ResonantPlate', [
    ['path', { d: 'M5 7 12 4l7 3v10l-7 3-7-3V7Z' }],
    ['path', { d: 'M8 10c1.2 1.2 1.2 2.8 0 4' }],
    ['path', { d: 'M16 10c-1.2 1.2-1.2 2.8 0 4' }],
    ['path', { d: 'M3 9v6M21 9v6' }],
  ]),
  knowledge_magma_slag_arc: defineSpellIcon('SlagArc', [
    ['path', { d: 'M3 18c4-1 5-8 10-8 3 0 4 2 7 1' }],
    ['path', { d: 'm17 8 3 3-3 3' }],
    ['path', { d: 'M7 16c-.6-1.4.2-2.2 1.2-3 .2 1 1.2 1.3 1.2 2.3' }],
    ['path', { d: 'M12 19h2' }],
  ]),
  knowledge_magma_vitrified_trap: defineSpellIcon('VitrifiedTrap', [
    ['path', { d: 'M3 17h18' }],
    ['path', { d: 'M5 16v-3l3-2 1-5 3 4 2-2 4 3v5' }],
    ['path', { d: 'M8 17v3M16 17v3' }],
    ['path', { d: 'M10 14h4' }],
  ]),
  knowledge_magma_scoria_shell: defineSpellIcon('ScoriaShell', [
    ['path', { d: 'M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z' }],
    ['path', { d: 'm8 8 2 2-1 2 3 2 1-2 3 1' }],
    ['path', { d: 'M9 17h6' }],
    ['circle', { cx: '7', cy: '5', r: '.7' }],
    ['circle', { cx: '18', cy: '16', r: '.7' }],
  ]),
  knowledge_magma_caldera_spill: defineSpellIcon('CalderaSpill', [
    ['path', { d: 'm3 19 6-12 3 5 3-8 6 15H3Z' }],
    ['path', { d: 'M12 9c2 2 2 4 4 5s2 2 2 4' }],
    ['path', { d: 'M7 19c1-1 2-1 3 0M15 19c1-1 2-1 3 0' }],
    ['path', { d: 'M10 4h2' }],
  ]),
  knowledge_water_current_needle: defineSpellIcon('CurrentNeedle', [
    ['path', { d: 'M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z' }],
    ['path', { d: 'm9 15 5-6' }],
    ['path', { d: 'm12 9 2 0 0 2' }],
    ['path', { d: 'M4 20h3M17 20h3' }],
  ]),
  knowledge_water_backwash: defineSpellIcon('Backwash', [
    ['path', { d: 'M3 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3' }],
    ['path', { d: 'M18 9l-3 3 3 3' }],
    ['path', { d: 'M3 19c2.5 0 2.5-2 5-2 1.4 0 2.1.6 3 1.2' }],
    ['path', { d: 'M7 7c1-1.6 2.6-2.4 4.5-2.4' }],
  ]),
  knowledge_water_mist_veil: defineSpellIcon('MistVeil', [
    ['path', { d: 'M4 8h11a3 3 0 1 0-3-3' }],
    ['path', { d: 'M2 12h16a3 3 0 1 1-3 3' }],
    ['path', { d: 'M5 16h7a3 3 0 1 1-3 3' }],
    ['path', { d: 'M20 6h2M20 18h2' }],
  ]),
  knowledge_water_countercurrent_bind: defineSpellIcon('CountercurrentBind', [
    ['circle', { cx: '12', cy: '8', r: '2' }],
    ['path', { d: 'M8 20v-3a4 4 0 0 1 8 0v3' }],
    ['path', { d: 'M4 10c2 0 2-2 4-2M20 10c-2 0-2-2-4-2' }],
    ['path', { d: 'M4 14c2 0 2 2 4 2M20 14c-2 0-2 2-4 2' }],
  ]),
  knowledge_water_cleansing_tide: defineSpellIcon('CleansingTide', [
    ['path', { d: 'M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z' }],
    ['path', { d: 'm9.5 14 1.7 1.7 3.5-3.5' }],
    ['path', { d: 'M3 5h3M4.5 3.5v3M19 19h2M20 18v2' }],
  ]),
  knowledge_ice_frost_lance: defineSpellIcon('FrostLance', [
    ['path', { d: 'M12 3 7 15l5 6 5-6-5-12Z' }],
    ['path', { d: 'm9 10 3 2 3-2M7 15h10' }],
    ['path', { d: 'M4 7h2M18 18h2' }],
  ]),
  knowledge_ice_sleet_fan: defineSpellIcon('SleetFan', [
    ['path', { d: 'M4 19c3-4 5-6 8-7 3 1 5 3 8 7' }],
    ['path', { d: 'M12 12V4M9 6l3-2 3 2M7 9l5 3 5-3M5 14l7-2 7 2' }],
    ['path', { d: 'M4 19h16' }],
  ]),
  knowledge_ice_rime_cage: defineSpellIcon('RimeCage', [
    ['circle', { cx: '12', cy: '9', r: '2' }],
    ['path', { d: 'M8 19v-2a4 4 0 0 1 8 0v2' }],
    ['path', { d: 'M4 18V8l3 2v8M20 18V8l-3 2v8' }],
    ['path', { d: 'm4 8 3-4 2 4M20 8l-3-4-2 4' }],
  ]),
  knowledge_ice_glacial_aegis: defineSpellIcon('GlacialAegis', [
    ['path', { d: 'M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z' }],
    ['path', { d: 'm12 5-3 6 3 2 3-2-3-6ZM9 11l-2 5 5 3 5-3-2-5' }],
  ]),
  knowledge_ice_shard_impact: defineSpellIcon('ShardImpact', [
    ['path', { d: 'm4 4 8 8-5 1-3-9ZM12 12l5-2 4 4-9 1' }],
    ['path', { d: 'm6 19 4-4 3 2 3-3 3 1' }],
    ['path', { d: 'm12 12-1 4 3 3' }],
  ]),
  knowledge_air_pressure_edge: defineSpellIcon('PressureEdge', [
    ['path', { d: 'M4 17 17 5l-4 11-2-4-7 5Z' }],
    ['path', { d: 'M3 9h5M2 12h4M5 20h5' }],
  ]),
  knowledge_air_crosswind_lash: defineSpellIcon('CrosswindLash', [
    ['path', { d: 'M3 8c4 0 3 8 8 8 3 0 4-4 8-4' }],
    ['path', { d: 'm16 8 4 4-4 4' }],
    ['path', { d: 'M5 5h4M6 20h5' }],
  ]),
  knowledge_air_ground_sweep: defineSpellIcon('GroundSweep', [
    ['path', { d: 'M3 18h18' }],
    ['path', { d: 'M3 13h8M5 10h8M3 7h6' }],
    ['path', { d: 'm14 10 4 3-4 3' }],
    ['path', { d: 'M18 7v3' }],
  ]),
  knowledge_air_slipstream_guard: defineSpellIcon('SlipstreamGuard', [
    ['path', { d: 'M3 10h7c3 0 3 4 6 4h5' }],
    ['path', { d: 'm17 10 4 4-4 4' }],
    ['path', { d: 'M8 6c2-2 5-2 7 0M6 19c2 2 5 2 7 0' }],
  ]),
  knowledge_air_disarming_vortex: defineSpellIcon('DisarmingVortex', [
    ['path', { d: 'm10 4 10 10M8 2l4 4M18 12l4 4M8 14l4-4' }],
    ['path', { d: 'M4 9a7 7 0 0 0 11 8' }],
    ['path', { d: 'M20 7a7 7 0 0 0-11-3' }],
  ]),
  knowledge_lightning_thunder_needle: defineSpellIcon('ThunderNeedle', [
    ['path', { d: 'm13 2-8 12h6l-1 8 9-13h-6l1-7Z' }],
    ['path', { d: 'M3 5h3M18 19h3' }],
  ]),
  knowledge_lightning_forked_arc: defineSpellIcon('ForkedArc', [
    ['circle', { cx: '5', cy: '12', r: '2' }],
    ['circle', { cx: '19', cy: '5', r: '2' }],
    ['circle', { cx: '19', cy: '19', r: '2' }],
    ['path', { d: 'm7 11 4-3 2 2 4-4M7 13l4 3 2-2 4 4' }],
    ['path', { d: 'm11 8 1-4 3 2M11 16l1 4 3-2' }],
  ]),
  knowledge_lightning_circuit_overload: defineSpellIcon('CircuitOverload', [
    ['circle', { cx: '5', cy: '6', r: '2' }],
    ['circle', { cx: '19', cy: '6', r: '2' }],
    ['circle', { cx: '5', cy: '18', r: '2' }],
    ['circle', { cx: '19', cy: '18', r: '2' }],
    ['path', { d: 'M7 6h3l2 3 2-3h3M7 18h3l2-3 2 3h3M5 8v8M19 8v8' }],
    ['path', { d: 'm13 9-3 4h3l-2 3' }],
  ]),
  knowledge_lightning_neuromuscular_pulse: defineSpellIcon('NeuromuscularPulse', [
    ['circle', { cx: '12', cy: '5', r: '2' }],
    ['path', { d: 'M8 21v-5l2-4-2-3M16 21v-5l-2-4 2-3M8 12h8' }],
    ['path', { d: 'm11 8 2 2-2 2 2 2' }],
  ]),
  knowledge_lightning_return_arc: defineSpellIcon('ReturnArc', [
    ['circle', { cx: '16', cy: '13', r: '5' }],
    ['path', { d: 'M3 8h8l-2-2M11 8 9 10' }],
    ['path', { d: 'm16 9-2 4h3l-1 3' }],
    ['path', { d: 'M4 16h4' }],
  ]),
  knowledge_storm_cumulonimbus: defineSpellIcon('Cumulonimbus', [
    ['path', { d: 'M5 15a4 4 0 0 1 .5-8A6 6 0 0 1 17 8a3.5 3.5 0 1 1 1 7H5Z' }],
    ['path', { d: 'm13 11-3 5h3l-1 4 4-6h-3l1-3Z' }],
    ['path', { d: 'M7 18v2M18 18v2' }],
  ]),
  knowledge_storm_windward_front: defineSpellIcon('WindwardFront', [
    ['path', { d: 'M3 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3' }],
    ['path', { d: 'm16 9 3 3-3 3' }],
    ['path', { d: 'M5 7h7a2 2 0 1 0-2-2' }],
    ['path', { d: 'M6 19h7' }],
  ]),
  knowledge_storm_thunder_bell: defineSpellIcon('ThunderBell', [
    ['path', { d: 'M5 15a4 4 0 0 1 .5-8A6 6 0 0 1 17 8a3.5 3.5 0 1 1 1 7H5Z' }],
    ['path', { d: 'M8 17c1.5 1.5 1.5 3 0 4M12 17c1.5 1.5 1.5 3 0 4M16 17c1.5 1.5 1.5 3 0 4' }],
  ]),
  knowledge_storm_eye_guard: defineSpellIcon('StormEyeGuard', [
    ['path', { d: 'M2 12c2.5-4 5.8-6 10-6s7.5 2 10 6c-2.5 4-5.8 6-10 6s-7.5-2-10-6Z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
    ['path', { d: 'M12 9V3M10 5l2-2 2 2' }],
  ]),
  knowledge_storm_barometric_weight: defineSpellIcon('BarometricWeight', [
    ['path', { d: 'M3 7h18M5 11h14M7 15h10' }],
    ['path', { d: 'm9 17 3 4 3-4' }],
    ['path', { d: 'M12 3v17' }],
  ]),
  knowledge_air_tempest_crown: defineSpellIcon('TempestCrown', [
    ['path', { d: 'M3 14c2-3 4-4 7-4s5 1 7 4' }],
    ['path', { d: 'M5 18c2-2 4-3 7-3s5 1 7 3' }],
    ['path', { d: 'm12 2-2 6h4l-2 5' }],
    ['path', { d: 'M3 7h3M18 7h3' }],
  ]),
  knowledge_lightning_sky_lance: defineSpellIcon('SkyLance', [
    ['path', { d: 'm14 2-8 12h6l-1 8 8-13h-6l1-7Z' }],
    ['circle', { cx: '12', cy: '12', r: '10' }],
  ]),
  knowledge_storm_supercell: defineSpellIcon('Supercell', [
    ['path', { d: 'M5 15a4 4 0 0 1 .5-8A6 6 0 0 1 17 8a3.5 3.5 0 1 1 1 7H5Z' }],
    ['path', { d: 'm11 10-2 4h3l-1 4M16 11l-2 3h2l-1 3' }],
    ['path', { d: 'M5 19v2M19 18v2' }],
  ]),
  knowledge_earth_titan_fault: defineSpellIcon('TitanFault', [
    ['path', { d: 'M2 17h5l2-5 3 7 3-11 2 5h5' }],
    ['path', { d: 'M5 7h4M15 7h4M7 4h3M14 4h3' }],
    ['path', { d: 'm10 3 2 3-2 3 3 3-2 4 2 4' }],
  ]),
  knowledge_rock_resonant_break: defineSpellIcon('ResonantBreak', [
    ['path', { d: 'm4 8 8-5 8 5-8 5-8-5ZM4 16l8 5 8-5' }],
    ['path', { d: 'M12 13v8M2 12h4M18 12h4' }],
    ['path', { d: 'M6 9v6M18 9v6' }],
  ]),
  knowledge_magma_crucible_seal: defineSpellIcon('CrucibleSeal', [
    ['path', { d: 'M4 7h16l-2 13H6L4 7Z' }],
    ['path', { d: 'M7 4c1-2 2-2 3 0s2 2 3 0 2-2 4 0' }],
    ['path', { d: 'M8 14c2-2 3 2 5 0s3 2 4 0' }],
    ['path', { d: 'm11 8 2 2-2 2' }],
  ]),
  knowledge_water_purifying_deluge: defineSpellIcon('PurifyingDeluge', [
    ['path', { d: 'M12 2C9 6 5 10 5 15a7 7 0 0 0 14 0c0-5-4-9-7-13Z' }],
    ['path', { d: 'm8.5 14 2.2 2.2 4.8-4.8' }],
    ['path', { d: 'M2 5h3M19 20h3' }],
  ]),
  knowledge_ice_glacier_break: defineSpellIcon('GlacierBreak', [
    ['path', { d: 'm12 2-2 6 4 4-5 3 3 7' }],
    ['path', { d: 'm4 5 5 4M20 5l-5 4M3 16l6-1M21 16l-6-1' }],
    ['path', { d: 'M12 2v5M12 17v5' }],
  ]),
};

const SPELL_IMAGE_ICONS: Record<string, string> = {};

const DISCIPLINE_ICON_COLORS: Record<string, string> = {
  fuego: '#ff9252',
  tierra: '#c9a66b',
  roca: '#a6b0bd',
  magma: '#ff6045',
  agua: '#57b7d1',
  hielo: '#9edced',
  aire: '#a9cadb',
  rayo: '#f2cf5b',
  tormenta: '#8d99d7',
};

function toggleId(ids: string[], id: string, enabled: boolean): string[] {
  return enabled ? [...new Set([...ids, id])] : ids.filter((entry) => entry !== id);
}

interface KnowledgeSpellNodeProps {
  spell: Spell;
  metadata: KnowledgeSpellMetadata;
  character: Character | undefined;
  settings: KnowledgeTreeSettings;
  learned: boolean;
  expanded: boolean;
  isCapstone?: boolean;
  gmMode: boolean;
  presentation: 'map' | 'list';
  onToggleDetails: () => void;
  onLearnSpell: (spellId: string) => void;
  onGoToGrimorio: () => void;
  onUpdateSettings: (settings: KnowledgeTreeSettings) => void;
}

const FIRE_SHEET_URL = '/public/assets/aistudio/Hoja_de__conos_de_fuego_fant_stico_3fe021dc.png';
const CATALOG_SHEET_URL = '/public/assets/aistudio/Cat_logo_de_Hechizos_Elementales_b4615a00.png';

const FIRE_SPELL_INDICES: Record<string, number> = {
  knowledge_fire_ember_thread: 0,
  knowledge_fire_recoil_lash: 1,
  knowledge_fire_thermal_fold: 2,
  knowledge_fire_ash_bloom: 3,
  knowledge_fire_combustion_ring: 4,
  knowledge_fire_pyroclastic_tide: 5,
};

const CATALOG_DISCIPLINE_CONFIG: Record<string, { row: number; col: number; count: number }> = {
  tierra: { row: 0, col: 0, count: 6 },
  roca: { row: 0, col: 1, count: 5 },
  magma: { row: 1, col: 0, count: 5 },
  agua: { row: 1, col: 1, count: 6 },
  hielo: { row: 2, col: 0, count: 6 },
  aire: { row: 2, col: 1, count: 6 },
  rayo: { row: 3, col: 0, count: 6 },
  tormenta: { row: 3, col: 1, count: 6 },
};

const CATALOG_SPELL_INDICES: Record<string, { discipline: string; index: number }> = {
  knowledge_earth_scree_surge: { discipline: 'tierra', index: 0 },
  knowledge_earth_fault_pulse: { discipline: 'tierra', index: 1 },
  knowledge_earth_marl_prison: { discipline: 'tierra', index: 2 },
  knowledge_earth_layered_guard: { discipline: 'tierra', index: 3 },
  knowledge_earth_quarry_spike: { discipline: 'tierra', index: 4 },
  knowledge_earth_titan_fault: { discipline: 'tierra', index: 5 },

  knowledge_rock_flint_pin: { discipline: 'roca', index: 0 },
  knowledge_rock_basalt_aegis: { discipline: 'roca', index: 1 },
  knowledge_rock_strata_split: { discipline: 'roca', index: 2 },
  knowledge_rock_resonant_plate: { discipline: 'roca', index: 3 },
  knowledge_rock_resonant_break: { discipline: 'roca', index: 4 },

  knowledge_magma_slag_arc: { discipline: 'magma', index: 0 },
  knowledge_magma_vitrified_trap: { discipline: 'magma', index: 1 },
  knowledge_magma_scoria_shell: { discipline: 'magma', index: 2 },
  knowledge_magma_caldera_spill: { discipline: 'magma', index: 3 },
  knowledge_magma_crucible_seal: { discipline: 'magma', index: 4 },

  knowledge_water_current_needle: { discipline: 'agua', index: 0 },
  knowledge_water_backwash: { discipline: 'agua', index: 1 },
  knowledge_water_mist_veil: { discipline: 'agua', index: 2 },
  knowledge_water_countercurrent_bind: { discipline: 'agua', index: 3 },
  knowledge_water_cleansing_tide: { discipline: 'agua', index: 4 },
  knowledge_water_purifying_deluge: { discipline: 'agua', index: 5 },

  knowledge_ice_frost_lance: { discipline: 'hielo', index: 0 },
  knowledge_ice_sleet_fan: { discipline: 'hielo', index: 1 },
  knowledge_ice_rime_cage: { discipline: 'hielo', index: 2 },
  knowledge_ice_glacial_aegis: { discipline: 'hielo', index: 3 },
  knowledge_ice_shard_impact: { discipline: 'hielo', index: 4 },
  knowledge_ice_glacier_break: { discipline: 'hielo', index: 5 },

  knowledge_air_pressure_edge: { discipline: 'aire', index: 0 },
  knowledge_air_crosswind_lash: { discipline: 'aire', index: 1 },
  knowledge_air_ground_sweep: { discipline: 'aire', index: 2 },
  knowledge_air_slipstream_guard: { discipline: 'aire', index: 3 },
  knowledge_air_disarming_vortex: { discipline: 'aire', index: 4 },
  knowledge_air_tempest_crown: { discipline: 'aire', index: 5 },

  knowledge_lightning_thunder_needle: { discipline: 'rayo', index: 0 },
  knowledge_lightning_forked_arc: { discipline: 'rayo', index: 1 },
  knowledge_lightning_circuit_overload: { discipline: 'rayo', index: 2 },
  knowledge_lightning_neuromuscular_pulse: { discipline: 'rayo', index: 3 },
  knowledge_lightning_return_arc: { discipline: 'rayo', index: 4 },
  knowledge_lightning_sky_lance: { discipline: 'rayo', index: 5 },

  knowledge_storm_cumulonimbus: { discipline: 'tormenta', index: 0 },
  knowledge_storm_windward_front: { discipline: 'tormenta', index: 1 },
  knowledge_storm_thunder_bell: { discipline: 'tormenta', index: 2 },
  knowledge_storm_eye_guard: { discipline: 'tormenta', index: 3 },
  knowledge_storm_barometric_weight: { discipline: 'tormenta', index: 4 },
  knowledge_storm_supercell: { discipline: 'tormenta', index: 5 },
};

const CUSTOM_SPELL_ICONS: Record<string, string> = {
  // Fuego
  knowledge_fire_ember_thread: '/public/assets/aistudio/Hilo_de_Ascua_3da3b75d.svg',
  knowledge_fire_recoil_lash: '/public/assets/aistudio/Latigazo_de_Reflujo_2446c57d.svg',
  knowledge_fire_thermal_fold: '/public/assets/aistudio/Pliegue_de_Reverbero_8151b0ce.svg',
  knowledge_fire_ash_bloom: '/public/assets/aistudio/Flor_de_Ceniza_a0b3dc37.svg',
  knowledge_fire_combustion_ring: '/public/assets/aistudio/Anillo_de_Combusti_n_aff4e4ba.svg',
  knowledge_fire_pyroclastic_tide: '/public/assets/aistudio/Marea_Pirocl_stica_17db725a.svg',
  // Tierra
  knowledge_earth_scree_surge: '/public/assets/aistudio/Laja_de_Impulso_4e36fa28.svg',
  knowledge_earth_fault_pulse: '/public/assets/aistudio/Pulso_de_Falla_943f95ec.svg',
  knowledge_earth_marl_prison: '/public/assets/aistudio/Prisi_n_de_Marga_44e0a676.svg',
  knowledge_earth_layered_guard: '/public/assets/aistudio/Guardia_Estratificada_a6a11184.svg',
  knowledge_earth_quarry_spike: '/public/assets/aistudio/Estaca_de_Cantera_7a069e47.svg',
  knowledge_earth_titan_fault: '/public/assets/aistudio/Falla_del_Tit_n_7a870122.svg',
  // Roca
  knowledge_rock_flint_pin: '/public/assets/aistudio/Clavo_de_Pedernal_7cf74031.svg',
  knowledge_rock_basalt_aegis: '/public/assets/aistudio/Cota_de_Basalto_8451f71e.svg',
  knowledge_rock_strata_split: '/public/assets/aistudio/Quiebre_de_Estratos_453597b4.svg',
  knowledge_rock_resonant_plate: '/public/assets/aistudio/Placa_Resonante_854ceac8.svg',
  knowledge_rock_resonant_break: '/public/assets/aistudio/Resonancia_de_Quiebre_c30a2ca9.svg',
  // Magma
  knowledge_magma_slag_arc: '/public/assets/aistudio/Arco_de_Escoria_Fundida_8ec5c847.svg',
  knowledge_magma_vitrified_trap: '/public/assets/aistudio/Costura_Vitrificada_e359009b.svg',
  knowledge_magma_scoria_shell: '/public/assets/aistudio/Coraza_de_Escoria_cd3697d4.svg',
  knowledge_magma_caldera_spill: '/public/assets/aistudio/Desborde_de_Caldero_0e2384aa.svg',
  knowledge_magma_crucible_seal: '/public/assets/aistudio/Sello_del_Crisol_913ba711.svg',
  // Agua
  knowledge_water_current_needle: '/public/assets/aistudio/Aguja_de_Corriente_4cea533a.svg',
  knowledge_water_backwash: '/public/assets/aistudio/Golpe_de_Resaca_043e9f44.svg',
  knowledge_water_mist_veil: '/public/assets/aistudio/Velo_de_Bruma_38cd12f3.svg',
  knowledge_water_countercurrent_bind: '/public/assets/aistudio/Lazo_de_Contracorriente_4dcc4a9b.svg',
  knowledge_water_cleansing_tide: '/public/assets/aistudio/Marea_Clarificadora_6f74f281.svg',
  knowledge_water_purifying_deluge: '/public/assets/aistudio/Diluvio_Purificador_a18e8594.svg',
  // Hielo
  knowledge_ice_frost_lance: '/public/assets/aistudio/Lanza_de_Escarcha_197815ad.svg',
  knowledge_ice_sleet_fan: '/public/assets/aistudio/Abanico_de_Aguanieve_e4c70962.svg',
  knowledge_ice_rime_cage: '/public/assets/aistudio/Prisi_n_de_Escarcha_d23ef16b.svg',
  knowledge_ice_glacial_aegis: '/public/assets/aistudio/_gida_Glacial_21f02eee.svg',
  knowledge_ice_shard_impact: '/public/assets/aistudio/Impacto_de_Esquirla_8ed3c66e.svg',
  knowledge_ice_glacier_break: '/public/assets/aistudio/Ruptura_del_Glaciar_6d22b04e.svg',
  // Aire
  knowledge_air_pressure_edge: '/public/assets/aistudio/Filo_de_Presi_n_17673876.svg',
  knowledge_air_crosswind_lash: '/public/assets/aistudio/Latigazo_de_Contraviento_52266c24.svg',
  knowledge_air_ground_sweep: '/public/assets/aistudio/Barrido_de_Borrasca_53b9668a.svg',
  knowledge_air_slipstream_guard: '/public/assets/aistudio/Desv_o_de_Rebufo_85e8bdff.svg',
  knowledge_air_disarming_vortex: '/public/assets/aistudio/V_rtice_Desarmador_66ea2f8e.svg',
  knowledge_air_tempest_crown: '/public/assets/aistudio/Corona_del_Vendaval_78a2b841.svg',
  // Rayo
  knowledge_lightning_thunder_needle: '/public/assets/aistudio/Aguja_de_Trueno_817f251b.svg',
  knowledge_lightning_forked_arc: '/public/assets/aistudio/Arco_de_Derivaci_n_67293090.svg',
  knowledge_lightning_circuit_overload: '/public/assets/aistudio/Reacci_n_de_Sobrecarga_fa4eee07.svg',
  knowledge_lightning_neuromuscular_pulse: '/public/assets/aistudio/Pulso_Neuromuscular_1fb1aeae.svg',
  knowledge_lightning_return_arc: '/public/assets/aistudio/Descarga_de_Retorno_61030747.svg',
  knowledge_lightning_sky_lance: '/public/assets/aistudio/Lanza_del_Cielo_El_ctrico_54b5ab3a.svg',
  // Tormenta
  knowledge_storm_cumulonimbus: '/public/assets/aistudio/Nube_de_C_mulo_ab1b3170.svg',
  knowledge_storm_windward_front: '/public/assets/aistudio/Frente_de_Barlovento_94164ae8.svg',
  knowledge_storm_thunder_bell: '/public/assets/aistudio/Campana_del_Trueno_8fe4c791.svg',
  knowledge_storm_eye_guard: '/public/assets/aistudio/Ojo_del_Temporal_fabd6de7.svg',
  knowledge_storm_barometric_weight: '/public/assets/aistudio/Peso_Barom_trico_16bb1ca4.svg',
  knowledge_storm_supercell: '/public/assets/aistudio/Superc_lula_Desatada_059684bb.svg',
};

function renderSpellArtIcon(spellId: string, disciplineId: string, FallbackIcon: LucideIcon, isCapstone: boolean) {
  const customImg = CUSTOM_SPELL_ICONS[spellId];
  if (customImg) {
    return (
      <img
        src={customImg}
        alt=""
        className="h-full w-full object-cover rounded-md"
      />
    );
  }

  const fireIdx = FIRE_SPELL_INDICES[spellId];
  if (fireIdx !== undefined) {
    const col = fireIdx % 3;
    const row = Math.floor(fireIdx / 3);
    return (
      <div 
        className="h-full w-full rounded-md overflow-hidden bg-no-repeat bg-center"
        style={{
          backgroundImage: `url('${FIRE_SHEET_URL}')`,
          backgroundSize: '300% 200%',
          backgroundPosition: `${col * 50}% ${row * 100}%`,
        }}
      />
    );
  }

  const catalogEntry = CATALOG_SPELL_INDICES[spellId];
  if (catalogEntry) {
    const cfg = CATALOG_DISCIPLINE_CONFIG[catalogEntry.discipline];
    if (cfg) {
      const { row, col, count } = cfg;
      const idx = catalogEntry.index;
      const scaleX = count * 200;
      const scaleY = 800;
      const xPct = col * 50 + ((idx + 0.5) / count) * 50;
      const yPct = row * 25 + 12;
      return (
        <div 
          className="h-full w-full rounded-md overflow-hidden bg-no-repeat"
          style={{
            backgroundImage: `url('${CATALOG_SHEET_URL}')`,
            backgroundSize: `${scaleX}% ${scaleY}%`,
            backgroundPosition: `${xPct * (scaleX / 100)}% ${yPct * (scaleY / 100)}%`,
          }}
        />
      );
    }
  }

  return <FallbackIcon className={isCapstone ? 'h-8 w-8' : 'h-5 w-5'} />;
}

function KnowledgeSpellNode({
  spell,
  metadata,
  character,
  settings,
  learned,
  expanded,
  isCapstone = false,
  gmMode,
  presentation,
  onToggleDetails,
  onLearnSpell,
  onGoToGrimorio,
  onUpdateSettings,
}: KnowledgeSpellNodeProps) {
  const SpellIcon = SPELL_ICONS[spell.id] || Sparkles;
  const spellImageIcon = SPELL_IMAGE_ICONS[spell.id];
  const iconColor = DISCIPLINE_ICON_COLORS[metadata.disciplineId] || '#c9a66b';
  const spellAccess = getKnowledgeSpellAccess(metadata, character, settings);
  const isSpellDisabled = settings.disabledSpellIds.includes(spell.id);
  const damageDice = spell.damage.dice
    .filter((die) => die.count > 0)
    .map((die) => `${die.count}${die.type}`)
    .join(' + ');

  const actions = (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`knowledge-details-${spell.id}`}
        onClick={onToggleDetails}
        className="min-h-[26px] inline-flex items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-surface)]"
      >
        {expanded ? 'Cerrar' : 'Detalles'}
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {learned ? (
        <button
          type="button"
          onClick={onGoToGrimorio}
          className="min-h-[26px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] px-2 text-[10px] font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
        >
          <BookOpen className="h-3 w-3" />
          Grimorio
        </button>
      ) : (
        <button
          type="button"
          disabled={!spellAccess.accessible}
          onClick={() => onLearnSpell(spell.id)}
          className="min-h-[26px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2 text-[10px] font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          Aprender
        </button>
      )}
    </>
  );

  const details = expanded && (
    <div
      id={`knowledge-details-${spell.id}`}
      className={`space-y-2 border-t border-[var(--arc-border)] pt-2 text-left ${
        presentation === 'map'
          ? 'absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border bg-[var(--arc-surface)] p-3 shadow-xl'
          : 'mt-2'
      }`}
    >
      <p className="text-xs leading-relaxed text-[var(--arc-muted)]">{spell.effectDescription}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--arc-muted)]">
        <span>{spell.manaCost} maná</span>
        <span>Maestría requerida: Nv. {spellAccess.requiredMastery}</span>
        <span>Duración: {spell.duration}</span>
        {damageDice && (
          <span>
            Daño {spell.damageKind === 'fisico' ? 'físico' : 'mágico'}: {damageDice}
            {spell.damage.bonus !== 0 &&
              ` ${spell.damage.bonus > 0 ? '+' : '−'} ${Math.abs(spell.damage.bonus)}`}
          </span>
        )}
        {spell.assuredSuccess > 0 && <span>Éxitos asegurados: +{spell.assuredSuccess}</span>}
        {spell.orders.length > 0 && <span>Órdenes: {spell.orders.join(', ')}</span>}
        {spell.statuses.length > 0 && <span>Estados: {spell.statuses.join(', ')}</span>}
        {spell.elementalStatus && (
          <span>
            Estado elemental: {spell.elementalStatus.kind} · {spell.elementalStatus.stacks} carga(s),{' '}
            {spell.elementalStatus.durationTurns} turnos
          </span>
        )}
        {spell.areaConfig?.enabled && (
          <span>
            Área: {spell.areaConfig.shapeNote || spell.areaConfig.mode}
            {spell.areaConfig.maxTargets ? ` · hasta ${spell.areaConfig.maxTargets} objetivos` : ''}
          </span>
        )}
        {spell.armorConfig?.isArmor && (
          <span>
            Armadura: reduce {spell.armorConfig.damageReduction || 0}
            {spell.armorConfig.maxHits ? ` · ${spell.armorConfig.maxHits} impactos` : ''}
          </span>
        )}
      </div>
      {!learned && !spellAccess.accessible && (
        <p className="text-[11px] font-medium text-[#e09b7d]">{spellAccess.reason}</p>
      )}
      {learned && isSpellDisabled && (
        <p className="text-[11px] text-[var(--arc-muted)]">
          El DJ deshabilitó nuevas adquisiciones; el hechizo aprendido se conserva.
        </p>
      )}
      {gmMode && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--arc-border)] pt-2">
          <label className="flex items-center gap-1 text-[10px] text-[var(--arc-muted)]">
            Maestría mínima
            <select
              aria-label={`Maestría requerida para ${spell.name}`}
              value={
                settings.masteryRequirementsBySpell[spell.id] === undefined
                  ? 'default'
                  : settings.masteryRequirementsBySpell[spell.id]
              }
              onChange={(event) => {
                const masteryRequirementsBySpell = { ...settings.masteryRequirementsBySpell };
                if (event.target.value === 'default') {
                  delete masteryRequirementsBySpell[spell.id];
                } else {
                  masteryRequirementsBySpell[spell.id] = Number(event.target.value);
                }
                onUpdateSettings({ ...settings, masteryRequirementsBySpell });
              }}
              className="min-h-[28px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-[var(--arc-text)]"
            >
              <option value="default">Predet. ({metadata.minimumMastery})</option>
              {[0, 1, 2, 3].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                disabledSpellIds: toggleId(
                  settings.disabledSpellIds,
                  spell.id,
                  !isSpellDisabled
                ),
              })
            }
            className="min-h-[28px] rounded-md border border-[var(--arc-border)] px-2 text-[10px] font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-surface)]"
          >
            {isSpellDisabled ? 'Rehabilitar' : 'Deshabilitar'}
          </button>
        </div>
      )}
    </div>
  );

  if (presentation === 'map') {
    return (
      <div className={`relative flex w-full flex-col items-center gap-1 text-center ${isCapstone ? 'max-w-56' : 'max-w-48'}`}>
        <span
          aria-hidden="true"
          className={`relative flex items-center justify-center rounded-full border bg-[var(--arc-surface)] transition-transform hover:scale-105 ${
            isCapstone ? 'h-[76px] w-[76px] border-2' : 'h-[52px] w-[52px]'
          } ${
            learned
              ? 'border-[#9ad489] shadow-[0_0_16px_rgba(154,212,137,0.28)]'
              : spellAccess.accessible
                ? 'shadow-[0_0_16px_rgba(220,180,90,0.2)]'
                : 'border-[var(--arc-border)]'
          }`}
          style={{
            color: iconColor,
            borderColor: learned
              ? undefined
              : spellAccess.accessible
                ? `${iconColor}cc`
                : undefined,
            boxShadow: isCapstone && spellAccess.accessible
              ? `0 0 24px ${iconColor}55`
              : undefined,
          }}
        >
          {renderSpellArtIcon(spell.id, metadata.disciplineId, SpellIcon, isCapstone)}
          {learned && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#9ad489] bg-[var(--arc-surface)] text-[#9ad489]">
              <Check className="h-3 w-3" />
            </span>
          )}
          {!spellAccess.accessible && !learned && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--arc-border)] bg-[var(--arc-surface)] text-[var(--arc-muted)]">
              <Lock className="h-3 w-3" />
            </span>
          )}
        </span>
        <span className={`max-w-full truncate text-xs font-semibold ${isCapstone ? 'text-[var(--arc-accent)]' : 'text-[var(--arc-text)]'}`}>
          {spell.name}
        </span>
        {isCapstone && (
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--arc-muted)]">
            Nodo culminante · Nv. {spellAccess.requiredMastery}
          </span>
        )}
        <div className="flex flex-wrap items-center justify-center gap-1">{actions}</div>
        {details}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-2.5 ${
        learned
          ? 'border-[#9ad489]/60 bg-[var(--arc-raised)]'
          : spellAccess.accessible
            ? 'border-[var(--arc-accent)]/60 bg-[var(--arc-raised)]'
            : 'border-[var(--arc-border)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
            style={{
              color: iconColor,
              borderColor: `${iconColor}66`,
              backgroundColor: `${iconColor}14`,
            }}
          >
            {renderSpellArtIcon(spell.id, metadata.disciplineId, SpellIcon, false)}
          </span>
          <span className="font-semibold text-[var(--arc-text)]">{spell.name}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
      </div>
      {details}
    </div>
  );
}

interface KnowledgeTreeNetworkProps {
  branches: KnowledgeBranch[];
  disciplineColor: string;
  capstoneNode?: ReactNode;
  renderNode: (spellId: string) => ReactNode;
}

function KnowledgeTreeNetwork({
  branches,
  disciplineColor,
  capstoneNode,
  renderNode,
}: KnowledgeTreeNetworkProps) {
  const maxBranchLength = Math.max(0, ...branches.map((branch) => branch.spellIds.length));
  const nodeSpacing = 112;
  const firstNodeY = 84;
  const capstoneY = firstNodeY + maxBranchLength * nodeSpacing;
  const height = capstoneNode
    ? capstoneY + 110
    : firstNodeY + Math.max(0, maxBranchLength - 1) * nodeSpacing + 110;
  const minWidth = Math.max(620, branches.length * 260);

  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="relative mx-auto"
        style={{ minWidth: `${minWidth}px`, height: `${height}px` }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
        >
          <g
            fill="none"
            stroke={disciplineColor}
            strokeOpacity="0.5"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          >
            {branches.map((branch, branchIndex) => {
              const x = ((branchIndex + 0.5) / branches.length) * 1000;
              const lastNodeY = firstNodeY + (branch.spellIds.length - 1) * nodeSpacing;
              return (
                <g key={branch.id}>
                  <path d={`M 500 0 C 500 38 ${x} 38 ${x} ${firstNodeY}`} />
                  {branch.spellIds.slice(1).map((spellId, index) => {
                    const y = firstNodeY + index * nodeSpacing;
                    return <path key={`${spellId}-edge`} d={`M ${x} ${y} V ${y + nodeSpacing}`} />;
                  })}
                  {capstoneNode && branch.spellIds.length > 0 && (
                    <path
                      d={`M ${x} ${lastNodeY} C ${x} ${capstoneY - 30} 500 ${capstoneY - 30} 500 ${capstoneY}`}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {branches.map((branch, branchIndex) => (
          <section
            key={branch.id}
            className="absolute top-0 z-10 flex h-full flex-col items-center"
            style={{
              left: `${(branchIndex / branches.length) * 100}%`,
              width: `${100 / branches.length}%`,
            }}
          >
            <h4 className="absolute top-7 max-w-[90%] truncate text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--arc-accent)]">
              {branch.label}
            </h4>
            {branch.spellIds.map((spellId, nodeIndex) => (
              <div
                key={spellId}
                className="absolute flex w-full justify-center"
                style={{ top: `${firstNodeY + nodeIndex * nodeSpacing - 28}px` }}
              >
                {renderNode(spellId)}
              </div>
            ))}
          </section>
        ))}

        {capstoneNode && (
          <div
            className="absolute left-1/2 z-20 flex -translate-x-1/2 justify-center"
            style={{ top: `${capstoneY - 38}px` }}
          >
            {capstoneNode}
          </div>
        )}
      </div>
    </div>
  );
}

export function KnowledgeTreePanel({
  spells,
  activeCharacter,
  settings,
  onLearnSpell,
  onSetDisciplineMastery,
  onToggleDisciplineDiscovery,
  onUpdateSettings,
  onGoToGrimorio,
}: KnowledgeTreePanelProps) {
  const [gmMode, setGmMode] = useState(false);
  const [treeViewMode, setTreeViewMode] = useState<'graph' | 'list'>('graph');
  const [expandedSpellIds, setExpandedSpellIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const spellsById = useMemo(
    () => new Map(spells.map((spell) => [spell.id, spell])),
    [spells]
  );
  const metadataBySpellId = useMemo(
    () => new Map(KNOWLEDGE_SPELL_METADATA.map((metadata) => [metadata.spellId, metadata])),
    []
  );
  const knownSpellIds = useMemo(
    () => new Set(activeCharacter?.knownSpells || []),
    [activeCharacter?.knownSpells]
  );
  const discoveredDisciplines = useMemo(
    () => new Set(activeCharacter?.discoveredKnowledgeDisciplines || []),
    [activeCharacter?.discoveredKnowledgeDisciplines]
  );

  const updateDisciplineRequirements = (
    disciplineId: string,
    requirements: KnowledgeTreeSettings['accessRequirementsByDiscipline'][string]
  ) => {
    onUpdateSettings({
      ...settings,
      accessRequirementsByDiscipline: {
        ...settings.accessRequirementsByDiscipline,
        [disciplineId]: requirements,
      },
    });
  };

  const updateSpellMasteryRequirement = (spellId: string, value: string) => {
    const masteryRequirementsBySpell = { ...settings.masteryRequirementsBySpell };
    if (value === 'default') {
      delete masteryRequirementsBySpell[spellId];
    } else {
      masteryRequirementsBySpell[spellId] = Number(value);
    }
    onUpdateSettings({ ...settings, masteryRequirementsBySpell });
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-[var(--arc-accent)]">
              Disciplinas de conocimiento
            </h2>
            <span className="text-xs text-[var(--arc-muted)]">
              {KNOWLEDGE_SPELL_METADATA.length} técnicas · progreso separado del combate
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--arc-muted)]">
            La maestría de disciplina la administra el DJ y no se deduce de la posición del hechizo ni
            de la cantidad aprendida. Habilitar una disciplina no añade hechizos al grimorio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--arc-border)] p-0.5">
            <button
              type="button"
              aria-pressed={treeViewMode === 'graph'}
              onClick={() => setTreeViewMode('graph')}
              className={`min-h-[30px] inline-flex items-center gap-1 rounded-md px-2 text-xs font-semibold ${
                treeViewMode === 'graph'
                  ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              Mapa
            </button>
            <button
              type="button"
              aria-pressed={treeViewMode === 'list'}
              onClick={() => setTreeViewMode('list')}
              className={`min-h-[30px] inline-flex items-center gap-1 rounded-md px-2 text-xs font-semibold ${
                treeViewMode === 'list'
                  ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                  : 'text-[var(--arc-muted)] hover:text-[var(--arc-text)]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
          </div>
          <button
            type="button"
            onClick={onGoToGrimorio}
            className="min-h-[34px] rounded-lg border border-[var(--arc-border)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
          >
            Ver Grimorio
          </button>
          <button
            type="button"
            disabled={!activeCharacter}
            onClick={() => setGmMode((value) => !value)}
            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-40 ${
              gmMode
                ? 'border-[var(--arc-accent)] bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                : 'border-[var(--arc-border)] text-[var(--arc-accent)] hover:bg-[var(--arc-raised)]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {gmMode ? 'Control del DJ: activo' : 'Control del DJ'}
          </button>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface)] px-3 py-2 text-xs text-[var(--arc-text)]"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[var(--arc-muted)] hover:text-[var(--arc-text)]"
          >
            Cerrar
          </button>
        </div>
      )}

      {gmMode && activeCharacter && (
        <div className="rounded-xl border border-[var(--arc-accent)]/50 bg-[var(--arc-surface)] p-4 text-xs text-[var(--arc-muted)]">
          El DJ puede modificar los requisitos, ajustar maestrías y abrir o cerrar disciplinas.
          Deshabilitar contenido no elimina hechizos ya aprendidos.
        </div>
      )}

      {!activeCharacter && (
        <div className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-5 text-sm text-[var(--arc-muted)]">
          Seleccioná un personaje para consultar o administrar su progreso.
        </div>
      )}

      <div className="grid gap-4">
        {KNOWLEDGE_DISCIPLINES.map((discipline) => {
          const access = getKnowledgeDisciplineAccess(discipline, activeCharacter, settings);
          const isDisabled = settings.disabledDisciplineIds.includes(discipline.id);
          const isDiscovered = discoveredDisciplines.has(discipline.id);
          const mastery = activeCharacter?.knowledgeMastery?.[discipline.id] || 0;
          const requirements = getKnowledgeRequirements(discipline, settings);
          const orderedBranches = getKnowledgeBranches(discipline, settings);
          const renderSpellNode = (
            spellId: string,
            presentation: 'map' | 'list',
            isCapstone = false
          ) => {
            const spell = spellsById.get(spellId);
            const metadata = metadataBySpellId.get(spellId);
            if (!spell || !metadata) return null;
            return (
              <KnowledgeSpellNode
                key={spell.id}
                spell={spell}
                metadata={metadata}
                character={activeCharacter}
                settings={settings}
                learned={knownSpellIds.has(spell.id)}
                expanded={expandedSpellIds.has(spell.id)}
                isCapstone={isCapstone}
                gmMode={gmMode}
                presentation={presentation}
                onToggleDetails={() =>
                  setExpandedSpellIds((previous) => {
                    const next = new Set(previous);
                    if (next.has(spell.id)) next.delete(spell.id);
                    else next.add(spell.id);
                    return next;
                  })
                }
                onLearnSpell={(id) => setNotice(onLearnSpell(id))}
                onGoToGrimorio={onGoToGrimorio}
                onUpdateSettings={onUpdateSettings}
              />
            );
          };
          const capstoneNode = discipline.capstoneSpellId
            ? renderSpellNode(discipline.capstoneSpellId, 'map', true)
            : null;

          return (
            <article
              key={discipline.id}
              className={`space-y-4 rounded-xl border bg-[var(--arc-surface)] p-4 ${
                isDisabled
                  ? 'border-[var(--arc-border)] opacity-70'
                  : 'border-[var(--arc-border)]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--arc-border)] pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-[var(--arc-text)]">
                      {discipline.label}
                    </h3>
                    <span className="rounded-full border border-[var(--arc-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--arc-muted)]">
                      {DISCIPLINE_KIND_LABELS[discipline.kind]}
                    </span>
                    {!access.accessible && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#e09b7d]">
                        <Lock className="h-3 w-3" />
                        Bloqueada
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--arc-muted)]">
                    {discipline.description}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--arc-muted)]">
                    {access.reason}
                  </p>
                  {requirements.length > 0 && (
                    <p className="mt-1 text-[11px] text-[var(--arc-muted)]">
                      Ruta actual: {requirements.map((requirement) => {
                        const requiredDiscipline = KNOWLEDGE_DISCIPLINES.find(
                          (entry) => entry.id === requirement.disciplineId
                        );
                        return `${requiredDiscipline?.label || requirement.disciplineId} Nv. ${requirement.minimumMastery}`;
                      }).join(' + ')}
                    </p>
                  )}
                  {isDiscovered && (
                    <p className="mt-1 text-[11px] font-semibold text-[#9ad489]">
                      Habilitada manualmente por el DJ; no se aprendieron hechizos.
                    </p>
                  )}
                </div>

                {gmMode && activeCharacter && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--arc-muted)]">
                      Maestría
                      <select
                        aria-label={`Maestría de ${discipline.label}`}
                        value={mastery}
                        onChange={(event) =>
                          onSetDisciplineMastery(discipline.id, Number(event.target.value))
                        }
                        className="min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-[var(--arc-text)]"
                      >
                        {[0, 1, 2, 3].map((level) => (
                          <option key={level} value={level}>
                            Nv. {level}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onToggleDisciplineDiscovery(discipline.id, !isDiscovered)}
                      className="min-h-[30px] rounded-md border border-[var(--arc-border)] px-2 text-[11px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] disabled:opacity-40"
                    >
                      {isDiscovered ? 'Revocar acceso manual' : 'Habilitar manualmente'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          disabledDisciplineIds: toggleId(
                            settings.disabledDisciplineIds,
                            discipline.id,
                            !isDisabled
                          ),
                        })
                      }
                      className="min-h-[30px] rounded-md border border-[var(--arc-border)] px-2 text-[11px] font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-raised)]"
                    >
                      {isDisabled ? 'Habilitar disciplina' : 'Deshabilitar disciplina'}
                    </button>
                  </div>
                )}
              </div>

              {gmMode && (
                <div className="space-y-2 rounded-lg border border-[var(--arc-border)] p-3">
                  <p className="font-semibold text-[var(--arc-text)]">Requisitos de descubrimiento</p>
                  {requirements.map((requirement, index) => (
                    <div
                      key={`${discipline.id}-${requirement.disciplineId}-${index}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <select
                        aria-label={`Disciplina requerida para ${discipline.label}`}
                        value={requirement.disciplineId}
                        onChange={(event) => {
                          const next = [...requirements];
                          next[index] = { ...requirement, disciplineId: event.target.value };
                          updateDisciplineRequirements(discipline.id, next);
                        }}
                        className="min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-[var(--arc-text)]"
                      >
                        {KNOWLEDGE_DISCIPLINES.filter((entry) => entry.id !== discipline.id).map(
                          (entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.label}
                            </option>
                          )
                        )}
                      </select>
                      <span className="text-[var(--arc-muted)]">maestría</span>
                      <select
                        aria-label={`Nivel de maestría requerido para ${discipline.label}`}
                        value={requirement.minimumMastery}
                        onChange={(event) => {
                          const next = [...requirements];
                          next[index] = {
                            ...requirement,
                            minimumMastery: Number(event.target.value),
                          };
                          updateDisciplineRequirements(discipline.id, next);
                        }}
                        className="min-h-[30px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-[var(--arc-text)]"
                      >
                        {[0, 1, 2, 3].map((level) => (
                          <option key={level} value={level}>
                            Nv. {level}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Quitar requisito de ${discipline.label}`}
                        onClick={() =>
                          updateDisciplineRequirements(
                            discipline.id,
                            requirements.filter((_, requirementIndex) => requirementIndex !== index)
                          )
                        }
                        className="rounded-md px-2 py-1 text-[11px] text-[#e09b7d] hover:bg-[var(--arc-raised)]"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const nextRequirement = KNOWLEDGE_DISCIPLINES.find(
                        (entry) =>
                          entry.id !== discipline.id &&
                          !requirements.some((requirement) => requirement.disciplineId === entry.id)
                      );
                      if (nextRequirement) {
                        updateDisciplineRequirements(discipline.id, [
                          ...requirements,
                          { disciplineId: nextRequirement.id, minimumMastery: 1 },
                        ]);
                      }
                    }}
                    disabled={
                      requirements.length >= KNOWLEDGE_DISCIPLINES.length - 1
                    }
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-raised)] disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar requisito
                  </button>
                  {requirements.length === 0 && (
                    <p className="text-[11px] text-[var(--arc-muted)]">
                      Sin requisitos de maestría.
                    </p>
                  )}
                </div>
              )}

              {treeViewMode === 'graph' && (
                <div className="flex justify-center">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 ${
                      access.accessible
                        ? 'border-[var(--arc-accent)]/70 bg-[var(--arc-raised)]'
                        : 'border-[var(--arc-border)] bg-[var(--arc-surface)]'
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--arc-accent)] text-[var(--arc-accent)]">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[var(--arc-text)]">
                        {discipline.label}
                      </span>
                      <span className="block text-[10px] text-[var(--arc-muted)]">
                        {DISCIPLINE_KIND_LABELS[discipline.kind]}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {treeViewMode === 'graph' && (
                <KnowledgeTreeNetwork
                  branches={orderedBranches}
                  disciplineColor={DISCIPLINE_ICON_COLORS[discipline.id] || '#c9a66b'}
                  capstoneNode={capstoneNode}
                  renderNode={(spellId) => renderSpellNode(spellId, 'map')}
                />
              )}

              {treeViewMode === 'list' && (
                <div className="space-y-4">
                <div className="space-y-4">
                <div className="space-y-4">
                {orderedBranches.map((branch, branchIndex) => (
                  <section
                    key={branch.id}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--arc-accent)]">
                        {branch.label}
                      </h4>
                      {gmMode && (
                        <div className="flex items-center">
                          <button
                            type="button"
                            disabled={branchIndex === 0}
                            aria-label={`Mover ${branch.label} arriba`}
                            onClick={() => {
                              const next = [...orderedBranches];
                              [next[branchIndex - 1], next[branchIndex]] = [
                                next[branchIndex],
                                next[branchIndex - 1],
                              ];
                              onUpdateSettings({
                                ...settings,
                                branchOrderByDiscipline: {
                                  ...settings.branchOrderByDiscipline,
                                  [discipline.id]: next.map((item) => item.id),
                                },
                              });
                            }}
                            className="rounded p-1 text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={branchIndex === orderedBranches.length - 1}
                            aria-label={`Mover ${branch.label} abajo`}
                            onClick={() => {
                              const next = [...orderedBranches];
                              [next[branchIndex], next[branchIndex + 1]] = [
                                next[branchIndex + 1],
                                next[branchIndex],
                              ];
                              onUpdateSettings({
                                ...settings,
                                branchOrderByDiscipline: {
                                  ...settings.branchOrderByDiscipline,
                                  [discipline.id]: next.map((item) => item.id),
                                },
                              });
                            }}
                            className="rounded p-1 text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {branch.spellIds.map((spellId) => {
                        const spell = spellsById.get(spellId);
                        const metadata = metadataBySpellId.get(spellId);
                        if (!spell || !metadata) return null;

                        const learned = knownSpellIds.has(spell.id);
                        const SpellIcon = SPELL_ICONS[spell.id] || Sparkles;
                        const iconColor =
                          DISCIPLINE_ICON_COLORS[metadata.disciplineId] || '#c9a66b';
                        const spellAccess = getKnowledgeSpellAccess(
                          metadata,
                          activeCharacter,
                          settings
                        );
                        const isSpellDisabled = settings.disabledSpellIds.includes(spell.id);
                        const isExpanded = expandedSpellIds.has(spell.id);
                        const damageDice = spell.damage.dice
                          .filter((die) => die.count > 0)
                          .map((die) => `${die.count}${die.type}`)
                          .join(' + ');

                        return (
                          <div key={spell.id}>
                            <div
                              className={`rounded-lg border p-2.5 ${
                                learned
                                  ? 'border-[#9ad489]/60 bg-[var(--arc-raised)]'
                                  : spellAccess.accessible
                                    ? 'border-[var(--arc-accent)]/60 bg-[var(--arc-raised)]'
                                    : 'border-[var(--arc-border)]'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    aria-hidden="true"
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                                    style={{
                                      color: iconColor,
                                      borderColor: `${iconColor}66`,
                                      backgroundColor: `${iconColor}14`,
                                    }}
                                  >
                                    {renderSpellArtIcon(spell.id, metadata.disciplineId, SpellIcon, false)}
                                  </span>
                                  <span className="font-semibold text-[var(--arc-text)]">
                                    {spell.name}
                                  </span>
                                </div>
                                {treeViewMode === 'list' && learned && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#9ad489]">
                                    <Check className="h-3 w-3" />
                                    En grimorio
                                  </span>
                                )}
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    aria-expanded={isExpanded}
                                    aria-controls={`knowledge-details-${spell.id}`}
                                    onClick={() =>
                                      setExpandedSpellIds((previous) => {
                                        const next = new Set(previous);
                                        if (next.has(spell.id)) next.delete(spell.id);
                                        else next.add(spell.id);
                                        return next;
                                      })
                                    }
                                    className="min-h-[28px] inline-flex items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[var(--arc-accent)] hover:bg-[var(--arc-surface)]"
                                  >
                                    {isExpanded ? 'Ocultar' : 'Detalles'}
                                    <ChevronDown
                                      className={`h-3 w-3 transition-transform ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {learned ? (
                                    <button
                                      type="button"
                                      onClick={onGoToGrimorio}
                                      className="min-h-[28px] inline-flex items-center gap-1 rounded-md border border-[var(--arc-border)] px-2 text-[11px] font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-surface)]"
                                    >
                                      <BookOpen className="h-3 w-3" />
                                      Grimorio
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!spellAccess.accessible}
                                      onClick={() => setNotice(onLearnSpell(spell.id))}
                                      className="min-h-[28px] inline-flex items-center gap-1 rounded-md bg-[var(--arc-action)] px-2 text-[11px] font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Sparkles className="h-3 w-3" />
                                      Aprender
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div
                                  id={`knowledge-details-${spell.id}`}
                                  className="mt-2 space-y-2 border-t border-[var(--arc-border)] pt-2"
                                >
                                  <p className="text-xs leading-relaxed text-[var(--arc-muted)]">
                                    {spell.effectDescription}
                                  </p>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--arc-muted)]">
                                    <span>{spell.manaCost} maná</span>
                                    <span>Maestría requerida: Nv. {spellAccess.requiredMastery}</span>
                                    <span>Duración: {spell.duration}</span>
                                    {damageDice && (
                                      <span>
                                        Daño {spell.damageKind === 'fisico' ? 'físico' : 'mágico'}: {damageDice}
                                        {spell.damage.bonus !== 0 &&
                                          ` ${spell.damage.bonus > 0 ? '+' : '−'} ${Math.abs(spell.damage.bonus)}`}
                                      </span>
                                    )}
                                    {spell.assuredSuccess > 0 && (
                                      <span>Éxitos asegurados: +{spell.assuredSuccess}</span>
                                    )}
                                    {spell.orders.length > 0 && (
                                      <span>Órdenes: {spell.orders.join(', ')}</span>
                                    )}
                                    {spell.statuses.length > 0 && (
                                      <span>Estados: {spell.statuses.join(', ')}</span>
                                    )}
                                    {spell.elementalStatus && (
                                      <span>
                                        Estado elemental: {spell.elementalStatus.kind} ·{' '}
                                        {spell.elementalStatus.stacks} carga(s),{' '}
                                        {spell.elementalStatus.durationTurns} turnos
                                      </span>
                                    )}
                                    {spell.areaConfig?.enabled && (
                                      <span>
                                        Área: {spell.areaConfig.shapeNote || spell.areaConfig.mode}
                                        {spell.areaConfig.maxTargets
                                          ? ` · hasta ${spell.areaConfig.maxTargets} objetivos`
                                          : ''}
                                      </span>
                                    )}
                                    {spell.armorConfig?.isArmor && (
                                      <span>
                                        Armadura: reduce {spell.armorConfig.damageReduction || 0}
                                        {spell.armorConfig.maxHits
                                          ? ` · ${spell.armorConfig.maxHits} impactos`
                                          : ''}
                                      </span>
                                    )}
                                  </div>
                                  {!learned && !spellAccess.accessible && (
                                    <p className="text-[11px] font-medium text-[#e09b7d]">
                                      {spellAccess.reason}
                                    </p>
                                  )}
                                  {learned && isSpellDisabled && (
                                    <p className="text-[11px] text-[var(--arc-muted)]">
                                      El DJ deshabilitó nuevas adquisiciones; el hechizo aprendido se conserva.
                                    </p>
                                  )}
                                  {gmMode && (
                                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--arc-border)] pt-2">
                                      <label className="flex items-center gap-1 text-[10px] text-[var(--arc-muted)]">
                                        Maestría mínima
                                        <select
                                          aria-label={`Maestría requerida para ${spell.name}`}
                                          value={
                                            settings.masteryRequirementsBySpell[spell.id] === undefined
                                              ? 'default'
                                              : settings.masteryRequirementsBySpell[spell.id]
                                          }
                                          onChange={(event) =>
                                            updateSpellMasteryRequirement(
                                              spell.id,
                                              event.target.value
                                            )
                                          }
                                          className="min-h-[28px] rounded-md border border-[var(--arc-border)] bg-[var(--arc-input)] px-1.5 text-[var(--arc-text)]"
                                        >
                                          <option value="default">
                                            Predet. ({metadata.minimumMastery})
                                          </option>
                                          {[0, 1, 2, 3].map((level) => (
                                            <option key={level} value={level}>
                                              {level}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateSettings({
                                            ...settings,
                                            disabledSpellIds: toggleId(
                                              settings.disabledSpellIds,
                                              spell.id,
                                              !isSpellDisabled
                                            ),
                                          })
                                        }
                                        className="min-h-[28px] rounded-md border border-[var(--arc-border)] px-2 text-[10px] font-semibold text-[var(--arc-text)] hover:bg-[var(--arc-surface)]"
                                      >
                                        {isSpellDisabled ? 'Rehabilitar' : 'Deshabilitar'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
                </div>
                </div>
              </div>
              )}

              {treeViewMode === 'list' && discipline.capstoneSpellId && (
                <section className="rounded-xl border border-[var(--arc-accent)]/50 bg-[var(--arc-raised)] p-4">
                  <h4 className="mb-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-[var(--arc-accent)]">
                    Nodo culminante
                  </h4>
                  <div className="flex justify-center">
                    {renderSpellNode(discipline.capstoneSpellId, 'list', true)}
                  </div>
                </section>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}