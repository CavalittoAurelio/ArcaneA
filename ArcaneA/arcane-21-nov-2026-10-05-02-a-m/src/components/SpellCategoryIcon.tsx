import type { SpellCategory } from '../utils/dice';

interface SpellCategoryIconProps {
  category: SpellCategory;
  className?: string;
}

/**
 * Emblemas vectoriales arcanos para las 6 categorías de hechizo.
 * Heredan `currentColor` (conectados a `--arc-cat-*`) con relleno translúcido
 * para mantener contraste nítido en temas claros y oscuros.
 */
export function SpellCategoryIcon({
  category,
  className = 'h-4 w-4',
}: SpellCategoryIconProps) {
  const shared = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: `${className} shrink-0`,
  };

  switch (category) {
    case 'damage':
      // Estrella de impacto y hoja arcana
      return (
        <svg {...shared}>
          <path
            d="M19.5 4.5 14 6.2l-5.8 5.8 3.8 3.8 5.8-5.8L19.5 4.5Z"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <path d="M19.5 4.5 9.2 14.8" />
          <path d="M7.2 12.8 11.2 16.8" />
          <path d="M4.5 19.5 8.5 15.5" />
          <path d="M5.5 6.5 6.3 4.5 7.1 6.5 9.1 7.3 7.1 8.1 6.3 10.1 5.5 8.1 3.5 7.3 5.5 6.5Z" />
        </svg>
      );

    case 'defense':
      // Escudo rúnico facetado
      return (
        <svg {...shared}>
          <path
            d="M12 2.8 19.2 5.6v5.7c0 4.6-3 8.1-7.2 9.9-4.2-1.8-7.2-5.3-7.2-9.9V5.6L12 2.8Z"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <path d="M12 7.2 15.2 11.3 12 16.2 8.8 11.3 12 7.2Z" />
          <path d="M12 2.8v4.4" />
        </svg>
      );

    case 'heal':
      // Cruz vital radiante dentro de halo restaurador
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8.8" fill="currentColor" fillOpacity="0.14" />
          <path
            d="M10.3 6.8h3.4v3.5h3.5v3.4h-3.5v3.5h-3.4v-3.5H6.8v-3.4h3.5V6.8Z"
            fill="currentColor"
            fillOpacity="0.22"
          />
        </svg>
      );

    case 'buff':
      // Aureola ascendente con núcleo rúnico
      return (
        <svg {...shared}>
          <path
            d="M12 4.2 17.5 9.6 12 15 6.5 9.6 12 4.2Z"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <path d="M7.5 13.8 12 9.4l4.5 4.4" />
          <path d="M5.5 18.6 12 12.2l6.5 6.4" />
          <circle cx="12" cy="4.2" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'debuff':
      // Sello fracturado descendente
      return (
        <svg {...shared}>
          <path
            d="M12 3.8 18.6 10.4 12 17 5.4 10.4 12 3.8Z"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path d="M9.5 7.4 13.2 10.4 10.8 12.8" />
          <path d="M7 15.8 12 20.4l5-4.6" />
          <path d="M12 13.8v6.2" />
        </svg>
      );

    case 'effect':
      // Sello astrológico / Vórtice arcano
      return (
        <svg {...shared}>
          <ellipse
            cx="12"
            cy="12"
            rx="9.2"
            ry="4.2"
            transform="rotate(-28 12 12)"
            fill="currentColor"
            fillOpacity="0.14"
          />
          <path
            d="M12 5.2 13.5 10.5 18.8 12 13.5 13.5 12 18.8 10.5 13.5 5.2 12 10.5 10.5 12 5.2Z"
            fill="currentColor"
            fillOpacity="0.24"
          />
          <circle cx="18.2" cy="6.2" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}