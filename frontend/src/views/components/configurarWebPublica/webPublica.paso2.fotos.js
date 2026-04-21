/**
 * webPublica.paso2.fotos.js — Paso 2: Fotos por espacio
 *
 * Delega toda la lógica al módulo webPublica.galeria.js que ya tiene:
 *   - Wizard IA paso a paso (plan de tomas requeridas con guías)
 *   - Auditor IA que valida y rechaza fotos que no cumplen
 *   - Slots requeridos/adicionales con estado visual
 *   - Gallery picker (seleccionar desde Galería de Fotos)
 *   - Subida masiva directa
 */
import { initGaleria, renderGaleria, setupGaleriaEvents } from './webPublica.galeria.js';

// ── Init async (llamar antes de renderPaso2) ──────────────────────────────────
export async function initPaso2(propiedadId, images) {
    // initGaleria carga internamente el photo-plan desde la IA
    await initGaleria(propiedadId, images || {});
}

// ── Render ────────────────────────────────────────────────────────────────────
export function renderPaso2(state) {
    const componentes = state.propiedadComponentes || [];

    return `
    <div class="max-w-4xl mx-auto space-y-6">

        <!-- Info banner -->
        <div class="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm text-primary-700 flex items-center gap-3">
            <i class="fa-solid fa-robot text-xl text-primary-400 flex-shrink-0"></i>
            <div>
                <p class="font-medium">Asistente IA de Fotos activo</p>
                <p class="text-xs text-primary-600 mt-0.5">
                    Las fotos alimentan la galería SSR, Google Imágenes y previews en redes (alt/title por imagen).
                    Cada espacio tiene un plan de tomas por IA — usa
                    <strong><i class="fa-solid fa-camera"></i> Asistente IA</strong>,
                    <strong><i class="fa-solid fa-images"></i> Galería</strong> o
                    <strong><i class="fa-solid fa-upload"></i> Subir</strong>.
                </p>
            </div>
        </div>

        <!-- Galería delegada al módulo original -->
        <div id="paso2-galeria-container">
            ${renderGaleria(componentes)}
        </div>

        <!-- Navegación -->
        <div class="flex justify-between pt-4 border-t border-gray-100">
            <button id="btn-paso2-back" class="btn-ghost flex items-center gap-2">
                <i class="fa-solid fa-arrow-left"></i> Anterior
            </button>
            <button id="btn-guardar-paso2" class="btn-primary flex items-center gap-2">
                Continuar con SEO <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>
    </div>`;
}

// ── Bind ──────────────────────────────────────────────────────────────────────
export function bindPaso2(state, callbacks) {
    // Activar todos los eventos del módulo galeria (wizard, picker, upload, eliminar)
    setupGaleriaEvents();

    document.getElementById('btn-paso2-back')?.addEventListener('click', callbacks.onPrevStep);
    document.getElementById('btn-guardar-paso2')?.addEventListener('click', callbacks.onNextStep);
}
