// frontend/src/platformConfig.js
// Fuente única del dominio de plataforma para el SPA.
// Llamar ensurePlatformConfig() una vez en la inicialización del router.

let _domain = '';
let _fetched = false;

export async function ensurePlatformConfig() {
    if (_fetched) return;
    try {
        const res = await fetch('/api/config/platform');
        if (res.ok) {
            const data = await res.json();
            _domain = String(data.platformDomain || '').trim();
        }
    } catch { /* ignorar — el dominio queda vacío */ }
    _fetched = true;
}

export function getPlatformDomain() {
    return _domain;
}
