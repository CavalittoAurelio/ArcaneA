import { useEffect, useState } from 'react';
import {
  Check,
  LayoutGrid,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { GrimorioThemeConfig, SavedCustomTheme, ThemeColors } from '../types/rpg';
import {
  DEFAULT_THEME_CONFIG,
  THEME_COLOR_FIELDS,
  THEME_PRESETS,
  normalizeHexColor,
} from '../utils/themes';
import { generateId } from '../utils/dice';

interface ThemeCustomizerProps {
  theme: GrimorioThemeConfig;
  customizeLayoutMode: boolean;
  isDefaultLayout: boolean;
  onChangeTheme: (next: GrimorioThemeConfig) => void;
  onToggleLayoutMode: () => void;
  onResetLayout: () => void;
  onClose?: () => void;
}

function areColorsEqual(a: ThemeColors, b: ThemeColors): boolean {
  return (Object.keys(a) as Array<keyof ThemeColors>).every(
    (k) => a[k].toLowerCase() === b[k].toLowerCase()
  );
}

function HexColorControl({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (nextHex: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleTextChange = (raw: string) => {
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
    setDraft(cleaned);
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned.trim())) {
      onChange(cleaned.trim().toLowerCase());
    }
  };

  const handleBlur = () => {
    const normalized = normalizeHexColor(draft, value);
    setDraft(normalized);
    if (normalized !== value) {
      onChange(normalized);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2.5 rounded-lg bg-[var(--arc-surface-alt)] px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[var(--arc-text)] truncate">{label}</div>
        <div className="text-xs text-[var(--arc-muted)] truncate">{hint}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="color"
          value={normalizeHexColor(value, '#15100b')}
          onChange={(e) => {
            const next = e.target.value.toLowerCase();
            setDraft(next);
            onChange(next);
          }}
          aria-label={`Selector visual para ${label}`}
          className="h-8 w-8 cursor-pointer rounded border border-[var(--arc-border)] bg-transparent p-0.5"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          maxLength={7}
          spellCheck={false}
          aria-label={`Código hex para ${label}`}
          className="font-mono-num w-[82px] min-h-[34px] rounded border border-[var(--arc-border)] bg-[var(--arc-input)] px-2 text-xs text-[var(--arc-text)] uppercase focus:outline-none focus:border-[var(--arc-accent)]"
        />
      </div>
    </div>
  );
}

export function ThemeCustomizer({
  theme,
  customizeLayoutMode,
  isDefaultLayout,
  onChangeTheme,
  onToggleLayoutMode,
  onResetLayout,
  onClose,
}: ThemeCustomizerProps) {
  const savedCustomThemes = theme.savedCustomThemes || [];
  const activePreset = THEME_PRESETS.find((p) => p.id === theme.presetId);
  const activeSavedTheme = savedCustomThemes.find((t) => t.id === theme.presetId);

  const [showHexEditor, setShowHexEditor] = useState(
    () => !activePreset && !activeSavedTheme
  );
  const [customThemeName, setCustomThemeName] = useState(
    () => activeSavedTheme?.name || 'Mi tema personalizado'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeSavedTheme) {
      setCustomThemeName(activeSavedTheme.name);
    } else if (theme.presetId === 'custom_draft') {
      setCustomThemeName((prev) =>
        prev.trim() ? prev : `Mi tema ${savedCustomThemes.length + 1}`
      );
    }
  }, [activeSavedTheme?.id, activeSavedTheme?.name, theme.presetId, savedCustomThemes.length]);

  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);

  const isCustomModified = activePreset
    ? !areColorsEqual(activePreset.colors, theme.colors)
    : activeSavedTheme
      ? !areColorsEqual(activeSavedTheme.colors, theme.colors)
      : true;

  const isSavedThemeNameChanged = Boolean(
    activeSavedTheme &&
      customThemeName.trim() &&
      customThemeName.trim() !== activeSavedTheme.name
  );

  const handleSelectPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setConfirmDeleteId(null);
    onChangeTheme({
      presetId: preset.id,
      colors: { ...preset.colors },
      savedCustomThemes,
    });
  };

  const handleSelectSavedCustom = (saved: SavedCustomTheme) => {
    setConfirmDeleteId(null);
    setCustomThemeName(saved.name);
    onChangeTheme({
      presetId: saved.id,
      colors: { ...saved.colors },
      savedCustomThemes,
    });
  };

  const handleStartNewCustom = () => {
    setConfirmDeleteId(null);
    setShowHexEditor(true);
    setCustomThemeName(
      savedCustomThemes.length === 0
        ? 'Mi tema personalizado'
        : `Mi tema personalizado ${savedCustomThemes.length + 1}`
    );
    onChangeTheme({
      presetId: 'custom_draft',
      colors: { ...theme.colors },
      savedCustomThemes,
    });
  };

  const handleUpdateColor = (key: keyof ThemeColors, hex: string) => {
    onChangeTheme({
      ...theme,
      colors: {
        ...theme.colors,
        [key]: hex,
      },
      savedCustomThemes,
    });
  };

  const handleSaveAsNewCustom = () => {
    const cleanName =
      customThemeName.trim() ||
      (savedCustomThemes.length === 0
        ? 'Mi tema personalizado'
        : `Mi tema personalizado ${savedCustomThemes.length + 1}`);
    const newTheme: SavedCustomTheme = {
      id: generateId('theme_'),
      name: cleanName,
      colors: { ...theme.colors },
      updatedAt: new Date().toISOString(),
    };
    const nextSaved = [...savedCustomThemes, newTheme];
    setCustomThemeName(cleanName);
    onChangeTheme({
      presetId: newTheme.id,
      colors: { ...newTheme.colors },
      savedCustomThemes: nextSaved,
    });
    setSavedNotice(`«${cleanName}» guardado permanentemente`);
  };

  const handleUpdateActiveSavedCustom = () => {
    if (!activeSavedTheme) return;
    const cleanName = customThemeName.trim() || activeSavedTheme.name;
    const nextSaved = savedCustomThemes.map((t) =>
      t.id === activeSavedTheme.id
        ? {
            ...t,
            name: cleanName,
            colors: { ...theme.colors },
            updatedAt: new Date().toISOString(),
          }
        : t
    );
    setCustomThemeName(cleanName);
    onChangeTheme({
      presetId: activeSavedTheme.id,
      colors: { ...theme.colors },
      savedCustomThemes: nextSaved,
    });
    setSavedNotice(`Cambios guardados en «${cleanName}»`);
  };

  const handleDeleteSavedCustom = (id: string) => {
    const nextSaved = savedCustomThemes.filter((t) => t.id !== id);
    setConfirmDeleteId(null);
    if (theme.presetId === id) {
      onChangeTheme({
        presetId: DEFAULT_THEME_CONFIG.presetId,
        colors: { ...DEFAULT_THEME_CONFIG.colors },
        savedCustomThemes: nextSaved,
      });
    } else {
      onChangeTheme({
        ...theme,
        savedCustomThemes: nextSaved,
      });
    }
  };

  const handleResetTheme = () => {
    if (activePreset && isCustomModified) {
      onChangeTheme({
        presetId: activePreset.id,
        colors: { ...activePreset.colors },
        savedCustomThemes,
      });
    } else if (activeSavedTheme && isCustomModified) {
      onChangeTheme({
        presetId: activeSavedTheme.id,
        colors: { ...activeSavedTheme.colors },
        savedCustomThemes,
      });
      setCustomThemeName(activeSavedTheme.name);
    } else {
      onChangeTheme({
        presetId: DEFAULT_THEME_CONFIG.presetId,
        colors: { ...DEFAULT_THEME_CONFIG.colors },
        savedCustomThemes,
      });
    }
  };

  return (
    <section className="rounded-xl border border-[var(--arc-border)] bg-[var(--arc-surface)] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--arc-border)] pb-3.5">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[var(--arc-accent)] flex items-center gap-2">
            <Palette className="h-4 w-4 shrink-0" />
            Personalizar Grimorio, Cajas y Temas
          </h2>
          <p className="text-[13px] text-[var(--arc-muted)] mt-0.5">
            Elegí un tema base, creá y guardá tus propios temas 100% personalizados por código hex y organizá las cajas del tablero.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleLayoutMode}
            className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              customizeLayoutMode
                ? 'bg-[var(--arc-action)] text-[var(--arc-action-text)]'
                : 'bg-transparent text-[var(--arc-text)] hover:bg-[var(--arc-raised)]'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {customizeLayoutMode ? 'Terminar de mover cajas' : 'Mover cajas de lugar'}
          </button>

          {!isDefaultLayout && (
            <button
              type="button"
              onClick={onResetLayout}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-transparent px-2.5 text-xs font-medium text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar cajas
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel de personalización"
              className="min-h-[36px] w-9 inline-flex items-center justify-center rounded-lg bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Paletas / Modos predefinidos + Temas 100% personalizados guardados */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--arc-text)]">
            Modos y temas del grimorio
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHexEditor((v) => !v)}
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                showHexEditor
                  ? 'bg-[var(--arc-raised)] text-[var(--arc-accent)]'
                  : 'bg-transparent text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)]'
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              {showHexEditor ? 'Ocultar editor Hex' : 'Personalizar colores (Hex)'}
            </button>

            <button
              type="button"
              onClick={handleResetTheme}
              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-transparent px-2.5 text-xs text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {activeSavedTheme && isCustomModified
                ? 'Volver al guardado'
                : isCustomModified
                  ? 'Volver al base del tema'
                  : 'Tema clásico'}
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PRESETS.map((preset) => {
            const isSelected = theme.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`text-left rounded-lg border p-3 transition-colors space-y-2 ${
                  isSelected
                    ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)]'
                    : 'border-transparent bg-[var(--arc-surface-alt)] hover:bg-[var(--arc-raised)]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--arc-text)] truncate">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--arc-accent)] shrink-0">
                      <Check className="h-3.5 w-3.5" />
                      {isCustomModified ? 'Editado' : 'Activo'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[var(--arc-muted)] line-clamp-2">
                  {preset.description}
                </p>

                <div className="flex items-center gap-1.5 pt-0.5" aria-hidden="true">
                  {[
                    preset.colors.canvas,
                    preset.colors.surface,
                    preset.colors.accent,
                    preset.colors.physicalAccent,
                    preset.colors.magicAccent,
                  ].map((hex, i) => (
                    <span
                      key={i}
                      className="h-4 w-6 rounded border border-black/25"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sección de temas 100% personalizados guardados por el usuario */}
        <div className="space-y-2 pt-2 border-t border-[var(--arc-border)]/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--arc-accent)] shrink-0" />
              <span className="text-xs font-semibold text-[var(--arc-text)]">
                Tus temas 100% personalizados
              </span>
              <span className="font-mono-num text-xs text-[var(--arc-muted)]">
                ({savedCustomThemes.length})
              </span>
            </div>
            <span className="text-xs text-[var(--arc-muted)]">
              Se conservan al cambiar de tema y solo se borran si vos lo elegís
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {savedCustomThemes.map((saved) => {
              const isSelected = theme.presetId === saved.id;
              const isConfirming = confirmDeleteId === saved.id;
              return (
                <div
                  key={saved.id}
                  className={`rounded-lg border p-3 transition-colors space-y-2 ${
                    isSelected
                      ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)]'
                      : 'border-[var(--arc-border)]/70 bg-[var(--arc-surface-alt)] hover:bg-[var(--arc-raised)]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectSavedCustom(saved)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--arc-text)] truncate">
                          {saved.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--arc-muted)] mt-0.5">
                        100% personalizado · Guardado
                      </p>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && !isConfirming && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--arc-accent)] mr-1">
                          <Check className="h-3.5 w-3.5" />
                          {isCustomModified ? 'Editado' : 'Activo'}
                        </span>
                      )}

                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedCustom(saved.id)}
                            className="min-h-[26px] rounded px-2 text-[11px] font-semibold bg-[var(--arc-cat-damage-bg)] text-[var(--arc-cat-damage-accent)] border border-[var(--arc-cat-damage-border)] hover:brightness-110 transition-colors"
                          >
                            Borrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[26px] rounded px-2 text-[11px] text-[var(--arc-muted)] hover:bg-[var(--arc-raised)] hover:text-[var(--arc-text)] transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(saved.id)}
                          aria-label={`Borrar tema personalizado ${saved.name}`}
                          title="Borrar tema personalizado"
                          className="min-h-[28px] w-7 inline-flex items-center justify-center rounded text-[var(--arc-muted)] hover:bg-[var(--arc-cat-damage-bg)] hover:text-[var(--arc-cat-damage-accent)] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectSavedCustom(saved)}
                    className="w-full flex items-center justify-between gap-2 pt-0.5 text-left"
                  >
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      {[
                        saved.colors.canvas,
                        saved.colors.surface,
                        saved.colors.accent,
                        saved.colors.physicalAccent,
                        saved.colors.magicAccent,
                      ].map((hex, i) => (
                        <span
                          key={i}
                          className="h-4 w-6 rounded border border-black/25"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-[var(--arc-muted)]">
                      {isSelected ? 'En uso' : 'Aplicar'}
                    </span>
                  </button>
                </div>
              );
            })}

            {/* Tarjeta para crear un nuevo tema 100% personalizado */}
            <button
              type="button"
              onClick={handleStartNewCustom}
              className={`text-left rounded-lg border border-dashed p-3 transition-colors flex flex-col justify-between gap-2 min-h-[96px] ${
                theme.presetId === 'custom_draft'
                  ? 'border-[var(--arc-accent)] bg-[var(--arc-raised)]/80'
                  : 'border-[var(--arc-border)] bg-[var(--arc-surface-alt)]/70 hover:border-[var(--arc-accent)] hover:bg-[var(--arc-raised)]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arc-accent)]">
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo tema 100% personalizado
                </span>
                {theme.presetId === 'custom_draft' && (
                  <span className="text-[11px] font-semibold text-[var(--arc-accent)]">
                    En edición
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--arc-muted)]">
                Elegí cada color en Hex y guardalo con nombre propio para volver cuando quieras.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Editor de colores individuales con código Hex + Guardado permanente */}
      {showHexEditor && (
        <div className="space-y-3 border-t border-[var(--arc-border)] pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--arc-accent)]">
              Editor 100% personalizado (selector o código #HEX)
            </span>
            {savedNotice ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--arc-cat-heal-accent)]">
                <Check className="h-3.5 w-3.5" />
                {savedNotice}
              </span>
            ) : (
              <span className="text-xs text-[var(--arc-muted)]">
                {activeSavedTheme
                  ? `Editando «${activeSavedTheme.name}»`
                  : 'Ajustá los 14 colores y guardá tu tema para conservarlo'}
              </span>
            )}
          </div>

          {/* Barra de nombre y guardado del tema personalizado */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--arc-border)] bg-[var(--arc-surface-alt)] p-3">
            <input
              type="text"
              value={customThemeName}
              onChange={(e) => setCustomThemeName(e.target.value)}
              placeholder="Nombre de tu tema personalizado (ej: Obsidiana Violeta)"
              aria-label="Nombre del tema personalizado"
              maxLength={40}
              className="flex-1 min-w-[200px] min-h-[36px] rounded-lg border border-[var(--arc-border)] bg-[var(--arc-input)] px-3 text-xs text-[var(--arc-text)] placeholder:text-[var(--arc-muted)] focus:border-[var(--arc-accent)] focus:outline-none"
            />

            {activeSavedTheme ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUpdateActiveSavedCustom}
                  disabled={!isCustomModified && !isSavedThemeNameChanged}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsNewCustom}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-raised)] px-3 text-xs font-semibold text-[var(--arc-text)] hover:brightness-110 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Guardar como nuevo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveAsNewCustom}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--arc-action)] px-3.5 text-xs font-semibold text-[var(--arc-action-text)] hover:bg-[var(--arc-action-hover)] whitespace-nowrap shrink-0 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Guardar tema personalizado
              </button>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_COLOR_FIELDS.map((field) => (
              <HexColorControl
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={theme.colors[field.key]}
                onChange={(hex) => handleUpdateColor(field.key, hex)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}