// frontend/src/views/gestionarTarifas.js
import { fetchAPI } from '../api.js';
import {
    initTemporadas, renderModalTemporada, renderListaTemporadas,
    abrirModalTemporada, initEventosTemporadas,
} from './components/gestionarTarifas/temporadas.js';
import { initMatriz, renderMatriz } from './components/gestionarTarifas/matriz.js';

let temporadas   = [];
let propiedades  = [];
let canales      = [];
let temporadaSeleccionada = null;

export async function render() {
    try {
        [temporadas, propiedades, canales] = await Promise.all([
            fetchAPI('/tarifas/temporadas'),
            fetchAPI('/propiedades'),
            fetchAPI('/canales'),
        ]);
    } catch (err) {
        return `<p class="text-danger-500">Error al cargar datos: ${err.message}</p>`;
    }

    const canalPD = canales.find(c => c.esCanalPorDefecto);
    if (!canalPD) {
        return `<div class="bg-danger-100 p-4 rounded-lg text-danger-800">
            <b>Error de configuración:</b> No hay canal por defecto definido.
            Ve a <b>Gestionar Canales</b> y marca uno con la estrella.
        </div>`;
    }

    return `
    <div class="flex gap-4 h-[calc(100vh-130px)]">

        <!-- Panel izquierdo: lista de temporadas -->
        <div class="w-72 flex-shrink-0 bg-white rounded-xl shadow flex flex-col">
            <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b flex-shrink-0">
                <h2 class="font-semibold text-gray-900">Temporadas</h2>
                <button id="nueva-temporada-btn" class="btn-primary text-sm px-3 py-1.5">+ Nueva</button>
            </div>
            <div id="temporadas-lista" class="flex-grow overflow-y-auto p-3 space-y-2"></div>
        </div>

        <!-- Panel derecho: matriz de precios -->
        <div class="flex-grow bg-white rounded-xl shadow p-4 overflow-hidden flex flex-col" id="matriz-container">
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <div class="text-5xl mb-4">👈</div>
                <p class="text-sm">Selecciona una temporada para ver y editar los precios</p>
            </div>
        </div>
    </div>

    ${renderModalTemporada()}`;
}

export async function afterRender() {
    const canalPD = canales.find(c => c.esCanalPorDefecto);
    if (!canalPD) return;

    initMatriz(canales, recargar);
    initTemporadas(onSeleccionarTemporada);

    renderListaTemporadas(temporadas, propiedades.length);

    // Eventos: una sola vez
    initEventosTemporadas(recargar);
    document.getElementById('nueva-temporada-btn')
        ?.addEventListener('click', () => abrirModalTemporada());
}

async function onSeleccionarTemporada(temporada) {
    temporadaSeleccionada = temporada;
    if (!temporada) {
        renderMatriz(null, [], propiedades);
        return;
    }
    try {
        const tarifas = await fetchAPI(`/tarifas?temporadaId=${temporada.id}`);
        renderMatriz(temporada, tarifas, propiedades);
    } catch (err) {
        document.getElementById('matriz-container').innerHTML =
            `<p class="text-danger-500 p-4">Error al cargar tarifas: ${err.message}</p>`;
    }
}

async function recargar() {
    try {
        temporadas = await fetchAPI('/tarifas/temporadas');
        renderListaTemporadas(temporadas, propiedades.length);
        if (temporadaSeleccionada) {
            const actualizada = temporadas.find(t => t.id === temporadaSeleccionada.id);
            await onSeleccionarTemporada(actualizada || null);
        }
    } catch (err) {
        console.error('Error al recargar temporadas:', err);
    }
}
