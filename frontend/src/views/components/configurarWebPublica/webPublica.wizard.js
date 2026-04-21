/**
 * webPublica.wizard.js — Orquestador del wizard de 3 pasos
 */
import { renderPaso1, bindPaso1 } from './webPublica.paso1.identidad.js';
import { renderPaso2, bindPaso2 } from './webPublica.paso2.fotos.js';
import { renderPaso3, bindPaso3 } from './webPublica.paso3.seo.js';

const PASOS = [
    { num: 1, label: 'Identidad', icon: 'fa-solid fa-pen-to-square' },
    { num: 2, label: 'Fotos',     icon: 'fa-solid fa-camera' },
    { num: 3, label: 'SEO',       icon: 'fa-solid fa-magnifying-glass' },
];

// ── Render ────────────────────────────────────────────────────────────────────
export function renderWizard(state) {
    return `
    <div class="max-w-4xl mx-auto py-6 px-4">

        <!-- Header: back + nombre + step tabs -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <button id="wz-back"
                    class="flex-shrink-0 h-9 w-9 rounded-xl bg-white border border-gray-200 hover:border-primary-300 flex items-center justify-center text-gray-500 hover:text-primary-600 transition-colors shadow-sm"
                    title="Volver a alojamientos"><i class="fa-solid fa-arrow-left"></i></button>
                <div class="min-w-0">
                    <h2 class="text-xl font-bold text-gray-900 truncate">${esc(state.propiedadNombre)}</h2>
                    <p class="text-xs text-gray-400">Paso ${state.paso} de 3 — sitio público SSR (SEO, redes, IA)</p>
                </div>
            </div>
            <!-- Step tabs -->
            <div class="flex items-center gap-1 bg-gray-100 rounded-2xl p-1">
                ${PASOS.map(p => renderStepTab(p, state.paso)).join('')}
            </div>
        </div>

        <!-- Progreso global -->
        <div class="h-1 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div class="h-full bg-primary-500 rounded-full transition-all duration-500"
                 style="width:${Math.round((state.paso - 1) / 3 * 100 + 33)}%"></div>
        </div>

        <!-- Pipeline BuildContext status -->
        ${renderPipelineStatus(state)}

        <!-- Contenido del paso actual -->
        <div id="wz-step-content">
            ${renderStepContent(state)}
        </div>
    </div>`;
}

function renderStepTab(paso, pasoActual) {
    const active  = paso.num === pasoActual;
    const done    = paso.num < pasoActual;
    return `
    <button class="wz-step-tab flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all
        ${active ? 'bg-white shadow-sm text-gray-800' : done ? 'text-success-600' : 'text-gray-400 hover:text-gray-600'}"
        data-paso="${paso.num}" ${active ? 'disabled' : ''}>
        ${done ? '<i class="fa-solid fa-check"></i>' : `<i class="${paso.icon}"></i>`} ${paso.label}
    </button>`;
}

function renderPipelineStatus(state) {
    const ctx = state.buildContext;
    const espacios   = ctx?.producto?.espacios?.length || 0;
    const narrativa  = !!(ctx?.narrativa?.descripcionComercial);
    const jsonld     = !!(ctx?.publicacion?.jsonLd);

    const pill = (ok, label, detail) => `
        <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full ${ok ? 'bg-success-400' : 'bg-gray-200'}"></span>
            <span class="text-[11px] ${ok ? 'text-success-700 font-medium' : 'text-gray-400'}">${label}</span>
            ${detail ? `<span class="text-[10px] text-gray-400">${detail}</span>` : ''}
        </div>`;

    return `
    <div class="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 mb-3 text-[11px] text-gray-600 leading-snug">
        Este flujo alimenta la <strong>ficha pública SSR</strong> del alojamiento: buscadores, vistas previas en redes y asistentes de IA leen inventario, fotos, texto y JSON-LD que completes aquí.
        <span class="text-gray-400">robots.txt y sitemap.xml los genera el servidor automáticamente.</span>
    </div>
    <div class="flex items-center gap-4 mb-6 px-1 flex-wrap">
        ${pill(espacios > 0, 'Inventario', espacios > 0 ? `${espacios} espacio${espacios !== 1 ? 's' : ''}` : '')}
        <span class="text-gray-200 text-xs hidden sm:block">→</span>
        ${pill(narrativa, 'Narrativa IA', '')}
        <span class="text-gray-200 text-xs hidden sm:block">→</span>
        ${pill(jsonld, 'JSON-LD', '')}
    </div>`;
}

function renderStepContent(state) {
    if (state.paso === 1) return renderPaso1(state);
    if (state.paso === 2) return renderPaso2(state);
    return renderPaso3(state);
}

// ── Bind ──────────────────────────────────────────────────────────────────────
export function bindWizard(state, callbacks) {
    document.getElementById('wz-back')?.addEventListener('click', callbacks.onBack);

    document.querySelectorAll('.wz-step-tab:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const paso = parseInt(btn.dataset.paso);
            if (paso < state.paso) callbacks.onGoToPaso(paso);
        });
    });

    const stepCallbacks = {
        onNextStep: callbacks.onNextStep,
        onPrevStep: callbacks.onPrevStep,
        onFinish:   callbacks.onFinish,
    };

    if (state.paso === 1) bindPaso1(state, stepCallbacks);
    if (state.paso === 2) bindPaso2(state, stepCallbacks);
    if (state.paso === 3) bindPaso3(state, stepCallbacks);
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
