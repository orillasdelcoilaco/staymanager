// Catálogo y URLs del motor de plantillas PG (disparadores) — reutilizado en SPA.
import { fetchAPI } from '../api.js';

export function escAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function fetchDisparadoresCatalog() {
    const data = await fetchAPI('/plantillas/disparadores-motor').catch(() => ({ items: [] }));
    return Array.isArray(data.items) ? data.items : [];
}

/** GET /plantillas con fusión opcional por disparador(es), separados por coma o +. */
export function plantillasListUrl(motorVal) {
    if (!motorVal || motorVal === 'off') return '/plantillas';
    return `/plantillas?motorDisparador=${encodeURIComponent(motorVal)}`;
}

/** Cuerpo para POST /mensajes/preparar (motor vs solo Firestore). */
export function prepararMensajeMotorPayload(selectValue) {
    if (selectValue === 'off') return { motorDisparador: false };
    if (selectValue === 'auto' || !selectValue) return {};
    return { motorDisparador: selectValue };
}
