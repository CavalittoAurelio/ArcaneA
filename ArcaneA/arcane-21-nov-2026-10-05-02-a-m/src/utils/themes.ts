import type {
  ArenaLayoutConfig,
  GrimorioThemeConfig,
  SavedCustomTheme,
  ThemeColors,
} from '../types/rpg';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const DEFAULT_ARENA_LAYOUT: ArenaLayoutConfig = {
  left: ['grimorio', 'weapons'],
  right: ['combat', 'log'],
};

export const THEME_COLOR_FIELDS: Array<{
  key: keyof ThemeColors;
  label: string;
  hint: string;
}> = [
  { key: 'canvas', label: 'Fondo general', hint: 'Lienzo de la página' },
  { key: 'header', label: 'Barra superior', hint: 'Encabezado y barra de actor' },
  { key: 'surface', label: 'Fondo de cajas', hint: 'Grimorio, Combate, Armas y Log' },
  { key: 'surfaceAlt', label: 'Tarjetas e inputs', hint: 'Hechizos, campos y subpaneles' },
  { key: 'raised', label: 'Botones secundarios', hint: 'Controles e ítems elevados' },
  { key: 'border', label: 'Bordes y líneas', hint: 'Marcos de cajas y divisores' },
  { key: 'text', label: 'Texto principal', hint: 'Lectura base y nombres' },
  { key: 'muted', label: 'Texto secundario', hint: 'Notas, metadatos y etiquetas' },
  { key: 'accent', label: 'Color de títulos', hint: 'Encabezados y acentos principales' },
  { key: 'action', label: 'Botón principal', hint: 'Atacar, guardar y acciones clave' },
  { key: 'physicalBg', label: 'Fondo daño físico', hint: 'Tarjetas y ataques físicos' },
  { key: 'physicalAccent', label: 'Color daño físico', hint: 'Títulos e indicador "Daño Físico"' },
  { key: 'magicBg', label: 'Fondo daño mágico', hint: 'Tarjetas mágicas y sónicas' },
  { key: 'magicAccent', label: 'Color daño mágico', hint: '"Daño Mágico", sónico y runas' },
];

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic',
    name: 'Pergamino Nocturno',
    description: 'Tema clásico cálido oscuro con bronce para daño físico y azul arcano para magia.',
    colors: {
      canvas: '#15100b',
      header: '#1b140e',
      surface: '#211912',
      surfaceAlt: '#18120d',
      raised: '#2b2017',
      border: '#3a2d20',
      text: '#efe6d5',
      muted: '#b0a084',
      accent: '#f5d57a',
      action: '#6a9147',
      physicalBg: '#261d12',
      physicalAccent: '#f0b865',
      magicBg: '#101826',
      magicAccent: '#7cb8ff',
    },
  },
  {
    id: 'ocean',
    name: 'Océano Abisal',
    description: 'Fosa abisal oscura con turquesa luminoso, acero marino (físico) y tonos violeta oscuro (mágico/sónico).',
    colors: {
      canvas: '#040914',
      header: '#060f1e',
      surface: '#091526',
      surfaceAlt: '#060e1b',
      raised: '#102138',
      border: '#1a3454',
      text: '#e4f3ff',
      muted: '#86aec9',
      accent: '#9af7ff',
      action: '#188596',
      physicalBg: '#12182b',
      physicalAccent: '#8cb4ff',
      magicBg: '#1c0e38',
      magicAccent: '#c48aff',
    },
  },
  {
    id: 'forest',
    name: 'Bosque Esmeralda',
    description: 'Grimorio druídico con follaje oscuro, títulos amarillo dorado, ámbar terroso (físico) y agua luminosa (mágico).',
    colors: {
      canvas: '#09140e',
      header: '#0d1c13',
      surface: '#122419',
      surfaceAlt: '#0d1b13',
      raised: '#1a3324',
      border: '#284d37',
      text: '#e8f5ec',
      muted: '#93b89f',
      accent: '#f4d862',
      action: '#4b9452',
      physicalBg: '#1f1c12',
      physicalAccent: '#e2b76b',
      magicBg: '#0e242b',
      magicAccent: '#74d6ff',
    },
  },
  {
    id: 'crimson',
    name: 'Grimorio Carmesí',
    description: 'Obsidiana volcánica con títulos dorados, brasas cobrizas (físico) y runas índigo brillantes (mágico).',
    colors: {
      canvas: '#14090b',
      header: '#1c0c0f',
      surface: '#241114',
      surfaceAlt: '#190b0e',
      raised: '#33181c',
      border: '#4f242b',
      text: '#f7eae8',
      muted: '#c79b97',
      accent: '#ffd278',
      action: '#b54336',
      physicalBg: '#2b1612',
      physicalAccent: '#f5a56d',
      magicBg: '#17132b',
      magicAccent: '#99baff',
    },
  },
  {
    id: 'astral',
    name: 'Astral Nocturno',
    description: 'Índigo estelar con títulos oro estelar, bronce astral (físico) y zafiro arcano (mágico).',
    colors: {
      canvas: '#0b0a17',
      header: '#111024',
      surface: '#171630',
      surfaceAlt: '#100f22',
      raised: '#222045',
      border: '#353263',
      text: '#eeebff',
      muted: '#a49ec9',
      accent: '#fae08c',
      action: '#6e57bf',
      physicalBg: '#201a29',
      physicalAccent: '#e8bf78',
      magicBg: '#101f3d',
      magicAccent: '#7ecbff',
    },
  },
  {
    id: 'parchment',
    name: 'Pergamino Claro',
    description: 'Modo diurno de papel antiguo con títulos ocre profundo, tinta siena (físico) y azul cobalto (mágico).',
    colors: {
      canvas: '#ebe2cf',
      header: '#f5efe1',
      surface: '#faf6ec',
      surfaceAlt: '#efe7d4',
      raised: '#e4d8be',
      border: '#c7b699',
      text: '#241c13',
      muted: '#5e503d',
      accent: '#6e3e05',
      action: '#48752e',
      physicalBg: '#f2e8d4',
      physicalAccent: '#9c5216',
      magicBg: '#e4ecf9',
      magicAccent: '#1c57b0',
    },
  },
];

export const DEFAULT_THEME_CONFIG: GrimorioThemeConfig = {
  presetId: THEME_PRESETS[0].id,
  colors: { ...THEME_PRESETS[0].colors },
  savedCustomThemes: [],
};

export function normalizeHexColor(value: string, fallback: string): string {
  const clean = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHexColor(hex, '#15100b');
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function mixHexColors(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return rgbToHex(
    a.r * (1 - w) + b.r * w,
    a.g * (1 - w) + b.g * w,
    a.b * (1 - w) + b.b * w
  );
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastTextColor(bgHex: string): string {
  return getRelativeLuminance(bgHex) > 0.36 ? '#121810' : '#f7f8fa';
}

export function normalizeThemeColors(
  rawColors: Partial<ThemeColors> | undefined,
  fallbackColors: ThemeColors
): ThemeColors {
  const src = rawColors || {};
  return {
    canvas: normalizeHexColor(String(src.canvas || ''), fallbackColors.canvas),
    header: normalizeHexColor(String(src.header || ''), fallbackColors.header),
    surface: normalizeHexColor(String(src.surface || ''), fallbackColors.surface),
    surfaceAlt: normalizeHexColor(String(src.surfaceAlt || ''), fallbackColors.surfaceAlt),
    raised: normalizeHexColor(String(src.raised || ''), fallbackColors.raised),
    border: normalizeHexColor(String(src.border || ''), fallbackColors.border),
    text: normalizeHexColor(String(src.text || ''), fallbackColors.text),
    muted: normalizeHexColor(String(src.muted || ''), fallbackColors.muted),
    accent: normalizeHexColor(String(src.accent || ''), fallbackColors.accent),
    action: normalizeHexColor(String(src.action || ''), fallbackColors.action),
    physicalBg: normalizeHexColor(String(src.physicalBg || ''), fallbackColors.physicalBg),
    physicalAccent: normalizeHexColor(
      String(src.physicalAccent || ''),
      fallbackColors.physicalAccent
    ),
    magicBg: normalizeHexColor(String(src.magicBg || ''), fallbackColors.magicBg),
    magicAccent: normalizeHexColor(String(src.magicAccent || ''), fallbackColors.magicAccent),
  };
}

export function normalizeThemeConfig(raw: unknown): GrimorioThemeConfig {
  const base = THEME_PRESETS[0].colors;
  if (!raw || typeof raw !== 'object') {
    return { presetId: THEME_PRESETS[0].id, colors: { ...base }, savedCustomThemes: [] };
  }
  const obj = raw as Partial<GrimorioThemeConfig>;
  const rawSaved = Array.isArray(obj.savedCustomThemes) ? obj.savedCustomThemes : [];
  const savedCustomThemes: SavedCustomTheme[] = rawSaved
    .filter(
      (item): item is SavedCustomTheme =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim())
    )
    .map((item) => ({
      id: item.id.trim(),
      name:
        typeof item.name === 'string' && item.name.trim()
          ? item.name.trim()
          : 'Tema personalizado',
      colors: normalizeThemeColors(item.colors, base),
      updatedAt:
        typeof item.updatedAt === 'string' && item.updatedAt
          ? item.updatedAt
          : new Date().toISOString(),
    }));

  const presetMatch = THEME_PRESETS.find((p) => p.id === obj.presetId);
  const savedMatch = savedCustomThemes.find((t) => t.id === obj.presetId);
  const fallbackColors = presetMatch ? presetMatch.colors : savedMatch ? savedMatch.colors : base;
  const rawColors = (obj.colors || {}) as Partial<ThemeColors>;

  const isLegacyOcean =
    obj.presetId === 'ocean' &&
    !rawColors.physicalBg &&
    (String(rawColors.canvas || '').toLowerCase() === '#06131d' ||
      String(rawColors.canvas || '').toLowerCase() === '#040914');

  if (isLegacyOcean && presetMatch) {
    return {
      presetId: 'ocean',
      colors: { ...presetMatch.colors },
      savedCustomThemes,
    };
  }

  const legacyAccents: Record<string, string> = {
    classic: '#e2c275',
    ocean: '#5be0e6',
    forest: '#a4e687',
    crimson: '#ff9d70',
    astral: '#d6b8ff',
    parchment: '#8c580e',
  };
  const rawAccentNorm = String(rawColors.accent || '').trim().toLowerCase();
  const normalizedColors = normalizeThemeColors(rawColors, fallbackColors);
  if (presetMatch && legacyAccents[presetMatch.id] === rawAccentNorm) {
    normalizedColors.accent = presetMatch.colors.accent;
  }

  return {
    presetId: typeof obj.presetId === 'string' ? obj.presetId : THEME_PRESETS[0].id,
    colors: normalizedColors,
    savedCustomThemes,
  };
}

export function buildThemeCssVars(colors: ThemeColors): Record<string, string> {
  const isLightTheme = getRelativeLuminance(colors.surface) > 0.45;
  const inputBg = isLightTheme
    ? mixHexColors(colors.surfaceAlt, '#ffffff', 0.35)
    : mixHexColors(colors.canvas, '#000000', 0.25);
  const borderStrong = mixHexColors(colors.border, colors.accent, 0.28);
  const actionHover = mixHexColors(colors.action, isLightTheme ? '#000000' : '#ffffff', 0.16);
  const actionBorder = mixHexColors(colors.action, '#ffffff', isLightTheme ? 0.05 : 0.24);
  const actionText = getContrastTextColor(colors.action);

  const physBorder = mixHexColors(colors.physicalBg, colors.physicalAccent, 0.42);
  const physRaised = mixHexColors(colors.physicalBg, colors.physicalAccent, 0.22);
  const physText = isLightTheme
    ? mixHexColors(colors.physicalAccent, '#22170a', 0.35)
    : mixHexColors(colors.physicalAccent, '#ffffff', 0.65);

  const magicBorder = mixHexColors(colors.magicBg, colors.magicAccent, 0.42);
  const magicRaised = mixHexColors(colors.magicBg, colors.magicAccent, 0.22);
  const magicText = isLightTheme
    ? mixHexColors(colors.magicAccent, '#0d1a2e', 0.35)
    : mixHexColors(colors.magicAccent, '#ffffff', 0.65);

  const atkBg = isLightTheme ? '#fae9ed' : '#2b1017';
  const atkRaised = isLightTheme ? '#f2d2da' : '#421723';
  const atkBorder = isLightTheme ? '#c9647c' : '#96354d';
  const atkAccent = isLightTheme ? '#b01c3c' : '#ff6b8b';
  const atkText = isLightTheme ? '#4a0d1c' : '#ffe4ea';

  const defBg = isLightTheme ? '#e3f5f1' : '#082422';
  const defRaised = isLightTheme ? '#c8ebe3' : '#103b37';
  const defBorder = isLightTheme ? '#40998a' : '#29857a';
  const defAccent = isLightTheme ? '#0d6e62' : '#3fe6c5';
  const defText = isLightTheme ? '#0a3b34' : '#dffcf5';

  // 6 categorías visuales separadas: Ataque, Defensa, Curación, Buff, Debuff, Efecto
  const catDamageBg = isLightTheme ? '#fae9e6' : '#2c1414';
  const catDamageBorder = isLightTheme ? '#cf7366' : '#8f3a32';
  const catDamageAccent = isLightTheme ? '#b02a1c' : '#ff8c78';
  const catDamageText = isLightTheme ? '#59160e' : '#ffd8d0';

  const catDefenseBg = isLightTheme ? '#e4f3fa' : '#0d222e';
  const catDefenseBorder = isLightTheme ? '#529ec2' : '#2a7599';
  const catDefenseAccent = isLightTheme ? '#0b668a' : '#6bd4f5';
  const catDefenseText = isLightTheme ? '#0a374a' : '#d2f1fc';

  const catHealBg = isLightTheme ? '#e5f7eb' : '#0e291b';
  const catHealBorder = isLightTheme ? '#4ba66c' : '#2c824e';
  const catHealAccent = isLightTheme ? '#157038' : '#6ce396';
  const catHealText = isLightTheme ? '#0c3f20' : '#d4f7e0';

  const catBuffBg = isLightTheme ? '#faf1d9' : '#2b220d';
  const catBuffBorder = isLightTheme ? '#c49635' : '#8c6e22';
  const catBuffAccent = isLightTheme ? '#8f5e06' : '#f5cf64';
  const catBuffText = isLightTheme ? '#4d3203' : '#faecc0';

  const catDebuffBg = isLightTheme ? '#f3e6fa' : '#261333';
  const catDebuffBorder = isLightTheme ? '#a365c4' : '#7b3c9e';
  const catDebuffAccent = isLightTheme ? '#7623a1' : '#df94ff';
  const catDebuffText = isLightTheme ? '#3f1157' : '#f2d9ff';

  const catEffectBg = isLightTheme ? '#e8eefc' : '#141e36';
  const catEffectBorder = isLightTheme ? '#6784c7' : '#3d5ea3';
  const catEffectAccent = isLightTheme ? '#284fa8' : '#96b8ff';
  const catEffectText = isLightTheme ? '#162c61' : '#dae6ff';

  return {
    '--arc-canvas': colors.canvas,
    '--arc-header': colors.header,
    '--arc-surface': colors.surface,
    '--arc-surface-alt': colors.surfaceAlt,
    '--arc-raised': colors.raised,
    '--arc-input': inputBg,
    '--arc-border': colors.border,
    '--arc-border-strong': borderStrong,
    '--arc-text': colors.text,
    '--arc-muted': colors.muted,
    '--arc-accent': colors.accent,
    '--arc-action': colors.action,
    '--arc-action-hover': actionHover,
    '--arc-action-border': actionBorder,
    '--arc-action-text': actionText,
    '--arc-phys-bg': colors.physicalBg,
    '--arc-phys-raised': physRaised,
    '--arc-phys-border': physBorder,
    '--arc-phys-accent': colors.physicalAccent,
    '--arc-phys-text': physText,
    '--arc-magic-bg': colors.magicBg,
    '--arc-magic-raised': magicRaised,
    '--arc-magic-border': magicBorder,
    '--arc-magic-accent': colors.magicAccent,
    '--arc-magic-text': magicText,
    '--arc-atk-bg': atkBg,
    '--arc-atk-raised': atkRaised,
    '--arc-atk-border': atkBorder,
    '--arc-atk-accent': atkAccent,
    '--arc-atk-text': atkText,
    '--arc-def-bg': defBg,
    '--arc-def-raised': defRaised,
    '--arc-def-border': defBorder,
    '--arc-def-accent': defAccent,
    '--arc-def-text': defText,
    '--arc-cat-damage-bg': catDamageBg,
    '--arc-cat-damage-border': catDamageBorder,
    '--arc-cat-damage-accent': catDamageAccent,
    '--arc-cat-damage-text': catDamageText,
    '--arc-cat-defense-bg': catDefenseBg,
    '--arc-cat-defense-border': catDefenseBorder,
    '--arc-cat-defense-accent': catDefenseAccent,
    '--arc-cat-defense-text': catDefenseText,
    '--arc-cat-heal-bg': catHealBg,
    '--arc-cat-heal-border': catHealBorder,
    '--arc-cat-heal-accent': catHealAccent,
    '--arc-cat-heal-text': catHealText,
    '--arc-cat-buff-bg': catBuffBg,
    '--arc-cat-buff-border': catBuffBorder,
    '--arc-cat-buff-accent': catBuffAccent,
    '--arc-cat-buff-text': catBuffText,
    '--arc-cat-debuff-bg': catDebuffBg,
    '--arc-cat-debuff-border': catDebuffBorder,
    '--arc-cat-debuff-accent': catDebuffAccent,
    '--arc-cat-debuff-text': catDebuffText,
    '--arc-cat-effect-bg': catEffectBg,
    '--arc-cat-effect-border': catEffectBorder,
    '--arc-cat-effect-accent': catEffectAccent,
    '--arc-cat-effect-text': catEffectText,
  };
}