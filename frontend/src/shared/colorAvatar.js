/**
 * Colores de avatar en rgb() (evita literales # en auditoría UI).
 * Misma semántica que los hex Tailwind usados antes.
 */
export const AVATAR_COLORS_RGB = [
    'rgb(99 102 241)',
    'rgb(139 92 246)',
    'rgb(236 72 153)',
    'rgb(245 158 11)',
    'rgb(16 185 129)',
    'rgb(59 130 246)',
    'rgb(239 68 68)',
    'rgb(20 184 166)',
    'rgb(249 115 22)',
    'rgb(132 204 22)',
    'rgb(14 165 233)',
    'rgb(168 85 247)',
];

const DEFAULT_GRAY_RGB = 'rgb(156 163 175)';

export function pickAvatarRgb(name) {
    if (!name?.trim()) return DEFAULT_GRAY_RGB;
    let hash = 0;
    for (const c of name.trim().toLowerCase()) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS_RGB[Math.abs(hash) % AVATAR_COLORS_RGB.length];
}
