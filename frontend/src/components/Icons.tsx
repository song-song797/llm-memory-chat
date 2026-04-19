import type { CSSProperties, HTMLAttributes } from 'react';
import iconCatalogSource from '../assets/icon.md?raw';

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
}

function parseIconCatalog(source: string): Record<string, string> {
  const icons: Record<string, string> = {};
  const normalizedSource = source.replace(/\r\n/g, '\n').trim();

  if (!normalizedSource) {
    return icons;
  }

  const lines = normalizedSource.split('\n');
  let currentName = '';
  let currentSvgLines: string[] = [];

  const commitCurrentIcon = () => {
    if (!currentName || currentSvgLines.length === 0) {
      return;
    }

    const svg = currentSvgLines.join('\n').trim();
    if (svg.startsWith('<svg') && svg.endsWith('</svg>')) {
      icons[currentName] = svg;
    }
  };

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    if (/^[a-z0-9-]+$/i.test(trimmedLine)) {
      commitCurrentIcon();
      currentName = trimmedLine.toLowerCase();
      currentSvgLines = [];
      continue;
    }

    if (currentName) {
      currentSvgLines.push(trimmedLine);
    }
  }

  commitCurrentIcon();

  return icons;
}

const ICON_CATALOG = parseIconCatalog(iconCatalogSource);

function getIconMarkup(name: string): string | null {
  return ICON_CATALOG[name.trim().toLowerCase()] ?? null;
}

export default function Icon({
  name,
  className,
  style,
  ['aria-label']: ariaLabel,
  ...rest
}: IconProps) {
  const markup = getIconMarkup(name);

  if (!markup) {
    return null;
  }

  const mergedStyle: CSSProperties = {
    display: 'inline-flex',
    lineHeight: 0,
    flexShrink: 0,
    ...style,
  };

  return (
    <span
      className={className}
      style={mergedStyle}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      dangerouslySetInnerHTML={{ __html: markup }}
      {...rest}
    />
  );
}
