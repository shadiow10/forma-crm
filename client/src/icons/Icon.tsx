import { GLYPHS, type IconName } from "./glyphs";

/** Named sizes; any pixel number still works. */
export const ICON_SIZES = { xs: 13, sm: 15, md: 18, lg: 22, xl: 28 } as const;
export type IconSize = keyof typeof ICON_SIZES | number;

/** Radius of the "perle" accent, in grid units. */
const PEARL = 1.35;

/**
 * Optical sizing: the charte's 1.8 stroke is drawn as-is from 20 px up; smaller icons get a
 * slightly heavier stroke so they keep the same apparent weight next to 15 px text.
 */
const strokeFor = (px: number) => Math.round(1.8 * Math.max(1, Math.sqrt(20 / px)) * 100) / 100;

type Props = {
  name: IconName;
  size?: IconSize;
  /** Stroke colour. Defaults to currentColor so the icon follows its parent's text colour. */
  stroke?: string;
  /** Accessible name. Leave empty for decorative icons (the default): they are hidden from screen readers. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = "md", stroke = "currentColor", label, className }: Props) {
  const px = typeof size === "number" ? size : ICON_SIZES[size];
  const glyph = GLYPHS[name];
  return (
    <svg
      className={className ? `cx-icon ${className}` : "cx-icon"}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeFor(px)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {label && <title>{label}</title>}
      {glyph.d && <path d={glyph.d} />}
      {"dots" in glyph && glyph.dots?.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={PEARL} fill={stroke} stroke="none" />)}
    </svg>
  );
}
