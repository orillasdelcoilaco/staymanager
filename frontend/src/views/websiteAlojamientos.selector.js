/**

 * HTML del selector de alojamientos (lista de tarjetas).

 */

import { esc, calcularCompletitud, getChecks } from './websiteAlojamientos.utils.js';



function renderGaleriaWarningBanner(sinGaleria) {

    if (sinGaleria.length === 0) return '';

    return `

        <div class="mb-6 flex items-start gap-3 bg-warning-50 border border-warning-200 rounded-xl px-4 py-3 text-sm text-warning-800">

            <i class="fa-solid fa-triangle-exclamation text-warning-500 text-lg flex-shrink-0 mt-0.5"></i>

            <div>

                <p class="font-medium">Sube fotos a la Galería antes de configurar el contenido web</p>

                <p class="text-xs text-warning-700 mt-0.5">

                    ${sinGaleria.length === 1

        ? `<strong>${esc(sinGaleria[0].nombre)}</strong> no tiene fotos clasificadas.`

        : `<strong>${sinGaleria.length} alojamientos</strong> no tienen fotos clasificadas.`}

                    La IA de contenido web usa las fotos ya clasificadas para generar descripciones más precisas.

                    <a href="#" data-navigate="/galeria-propiedad"

                       class="underline font-semibold ml-1">Ir a Galería →</a>

                </p>

            </div>

        </div>`;

}



function fotoSlotsStatusHtml(galStats) {

    const totalSlots = galStats.slotsTotal || 0;

    const cumplidos = galStats.slotsCumplidos || 0;

    if (totalSlots === 0) {

        return galStats.asignadas > 0

            ? '<span class="flex items-center gap-1 text-xs text-success-700"><span class="h-1.5 w-1.5 rounded-full bg-success-400"></span>Fotos <span class="text-success-500">(' + galStats.asignadas + ')</span></span>'

            : '<span class="flex items-center gap-1 text-xs text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-200"></span>Sin plan de fotos</span>';

    }

    if (cumplidos >= totalSlots) {

        return '<span class="flex items-center gap-1 text-xs text-success-700"><span class="h-1.5 w-1.5 rounded-full bg-success-400"></span>Fotos <span class="text-success-500">(' + cumplidos + '/' + totalSlots + ')</span></span>';

    }

    return '<span class="flex items-center gap-1 text-xs text-warning-600"><span class="h-1.5 w-1.5 rounded-full bg-warning-400"></span>Fotos <span class="text-warning-500">(' + cumplidos + '/' + totalSlots + ')</span></span>';

}



function renderPropertyCardHtml(p) {

    const wd = p.websiteData || {};

    const galStats = p.galeriaStats || { asignadas: 0, pendientes: 0 };

    const pct = calcularCompletitud(wd, galStats);

    const checks = getChecks(wd, galStats);

    const cardImg = wd.cardImage?.storagePath || null;



    return `

        <div class="prop-card-wrapper group relative bg-white rounded-2xl border-2 border-gray-100

                hover:border-primary-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">

            <div class="relative h-32 bg-gray-100 overflow-hidden flex-shrink-0">

                ${cardImg

        ? `<img src="${esc(cardImg)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"

                           onerror="this.style.display='none'; this.nextElementSibling?.style.display='flex'">

                       <div class="w-full h-full flex-col items-center justify-center text-gray-300 hidden">

                           <svg class="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>

                           <span class="text-xs">Sin portada</span>

                       </div>`

        : `<div class="w-full h-full flex flex-col items-center justify-center text-gray-300">

                           <svg class="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>

                           <span class="text-xs">Sin portada</span>

                       </div>`}

                <button class="btn-cambiar-portada absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100"

                    data-id="${esc(p.id)}" title="Cambiar imagen de portada">

                    <span class="bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5">

                        <i class="fa-solid fa-camera"></i> Cambiar portada

                    </span>

                </button>

                <div class="absolute top-2 right-2 bg-black/55 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full font-semibold pointer-events-none">

                    ${pct}%

                </div>

            </div>

            <div class="p-4 flex flex-col gap-2 flex-1">

                <div>

                    <h3 class="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">${esc(p.nombre)}</h3>

                    <p class="text-xs text-gray-400 mt-0.5">Cap. ${p.capacidad || '—'} · ${(p.componentes || []).length} espacio(s)</p>

                </div>

                <div class="flex items-center gap-3 flex-wrap">

                    ${checks.descripcion

        ? '<span class="flex items-center gap-1 text-xs text-success-700"><span class="h-1.5 w-1.5 rounded-full bg-success-400"></span>Descripción</span>'

        : '<span class="flex items-center gap-1 text-xs text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-200"></span>Descripción</span>'}

                    ${fotoSlotsStatusHtml(galStats)}

                    ${checks.seo

        ? '<span class="flex items-center gap-1 text-xs text-success-700"><span class="h-1.5 w-1.5 rounded-full bg-success-400"></span>SEO</span>'

        : '<span class="flex items-center gap-1 text-xs text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-200"></span>SEO</span>'}

                </div>

                <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">

                    <div class="h-full rounded-full transition-all ${pct === 100 ? 'bg-success-400' : 'bg-primary-400'}" style="width:${pct}%"></div>

                </div>

                <button class="btn-editar-contenido flex items-center gap-1.5 mt-auto pt-2 border-t border-gray-50 w-full hover:text-primary-700 transition-colors"

                    data-id="${esc(p.id)}">

                    <span class="text-xs text-primary-600 font-medium group-hover:text-primary-700">Editar contenido</span>

                    <i class="fa-solid fa-arrow-right text-[10px] text-primary-400"></i>

                </button>

            </div>

        </div>`;

}



export function renderSelectorHtml(state) {

    const total = state.propiedades.length;

    const completas = state.propiedades.filter((p) => calcularCompletitud(p.websiteData, p.galeriaStats) === 100).length;



    const sinGaleria = state.propiedades.filter((p) => (p.galeriaStats?.asignadas || 0) === 0);

    const bannerGaleria = renderGaleriaWarningBanner(sinGaleria);

    const cards = state.propiedades.map((p) => renderPropertyCardHtml(p)).join('');



    return `

    <div class="max-w-5xl mx-auto py-10 px-4">

        ${bannerGaleria}

        <div class="mb-8">

            <div class="flex items-center gap-3 mb-1">

                <div class="h-9 w-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600"><i class="fa-solid fa-pen-to-square"></i></div>

                <h1 class="text-2xl font-bold text-gray-900">Contenido Web</h1>

            </div>

            <p class="text-gray-500 text-sm ml-12">Gestiona descripciones, fotos y SEO de cada alojamiento</p>

        </div>



        ${state.error ? `<div class="bg-danger-50 border border-danger-200 text-danger-700 rounded-xl p-4 mb-6 text-sm">${state.error}</div>` : ''}



        ${total > 0 ? `

        <div class="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex items-center gap-4">

            <div class="flex-1">

                <div class="flex justify-between text-xs text-gray-500 mb-1.5">

                    <span>${completas} de ${total} alojamientos completos</span>

                    <span class="font-semibold text-gray-700">${Math.round((completas / total) * 100)}%</span>

                </div>

                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">

                    <div class="h-full bg-primary-400 rounded-full transition-all" style="width:${Math.round((completas / total) * 100)}%"></div>

                </div>

            </div>

        </div>` : ''}



        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            ${cards || '<p class="text-gray-400 col-span-4 text-center py-10">No hay alojamientos disponibles.</p>'}

        </div>

    </div>`;

}


