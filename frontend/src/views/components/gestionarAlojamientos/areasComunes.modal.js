// frontend/src/views/components/gestionarAlojamientos/areasComunes.modal.js
// Responsabilidad: modal para gestionar Instalaciones del Recinto (áreas comunes de empresa).
// Áreas comunes son instalaciones compartidas entre alojamientos: Piscina, Quincho, etc.
// NO usan tipos_componente (esos son para habitaciones de alojamientos).

import { fetchAPI } from '../../../api.js';
import { generarIdComponente } from './alojamientos.utils.js';

let _espacios = [];
let _onSaveAC = null;

// Iconos sugeridos para instalaciones comunes
const _ICONOS_AC = ['🏊', '🔥', '🚗', '🌿', '🏋️', '🛖', '🎾', '⛵', '🏔️', '🌊', '🌳', '🍖', '☕', '🧺', '🅿️'];

// ── Render helpers ─────────────────────────────────────────────────────────────

function _renderElemsAC(elementos, areaIndex) {
    if (!elementos || elementos.length === 0) {
        return '<p class="text-xs text-gray-400 italic py-1">Sin elementos agregados.</p>';
    }
    return elementos.map((elem, i) => `
        <div class="flex items-center justify-between py-1 px-2 rounded bg-gray-50 border border-gray-100 text-sm">
            <span class="text-gray-700">${elem.nombre}${elem.capacity > 0 ? ` <span class="text-xs text-gray-400">(cap. ${elem.capacity})</span>` : ''}</span>
            <button type="button" onclick="window.eliminarElemAC(${areaIndex},${i})"
                class="text-danger-400 hover:text-danger-600 text-xs px-1 ml-2">✕</button>
        </div>
    `).join('');
}

function _renderListaAC(espacios) {
    if (!espacios || espacios.length === 0) {
        return `<div class="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
            Sin instalaciones definidas aún.
        </div>`;
    }
    return espacios.map((area, i) => `
        <div class="bg-white border rounded-lg shadow-sm mb-3 overflow-hidden">
            <div class="bg-gray-50 p-3 flex justify-between items-center border-b cursor-pointer"
                onclick="window.toggleAC(${i})">
                <div class="flex items-center gap-2">
                    <span class="text-xl">${area.icono || '🌿'}</span>
                    <h4 class="font-semibold text-gray-800 text-sm">${area.nombre}</h4>
                    ${area.elementos?.length ? `<span class="text-xs text-gray-400">${area.elementos.length} elemento(s)</span>` : ''}
                </div>
                <button type="button" onclick="window.eliminarAC(${i}, event)"
                    class="text-gray-400 hover:text-danger-600 p-1 rounded hover:bg-danger-50 text-xs transition-colors">✕</button>
            </div>
            <div id="body-ac-${i}" class="p-3 hidden">
                <div class="space-y-1 mb-3">${_renderElemsAC(area.elementos, i)}</div>
                <div class="border-t pt-3 mt-2">
                    <p class="text-xs font-medium text-gray-500 mb-2">Agregar elemento a esta instalación</p>
                    <div class="flex gap-2 items-end flex-wrap">
                        <div class="flex-1 min-w-[120px]">
                            <label class="text-xs text-gray-500 block mb-1">Nombre del elemento</label>
                            <input type="text" id="elem-nombre-${i}" class="form-input w-full text-sm"
                                placeholder="Ej: Parrilla, Tumbonas…">
                        </div>
                        <div class="w-24">
                            <label class="text-xs text-gray-500 block mb-1">Capacidad</label>
                            <input type="number" id="elem-cap-${i}" class="form-input w-full text-sm" min="0" value="0" placeholder="0">
                        </div>
                        <button type="button" onclick="window.agregarElemAC(${i})"
                            class="btn-outline text-xs">+ Agregar</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function _renderModal(activo) {
    return `
        <div id="ac-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 my-6 flex flex-col max-h-[90vh]">
                <div class="flex items-center gap-3 p-4 border-b">
                    <div class="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center text-success-700 text-lg flex-shrink-0">🌿</div>
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900">Instalaciones del Recinto</h3>
                        <p class="text-xs text-gray-400">Piscinas, quinchos, estacionamientos y otras áreas compartidas</p>
                    </div>
                    <button id="ac-modal-close" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>

                <div class="p-5 overflow-y-auto flex-1 bg-gray-50 space-y-4">
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                        <input type="checkbox" id="ac-activo" class="rounded text-primary-600" ${activo ? 'checked' : ''}>
                        Este recinto tiene instalaciones compartidas entre alojamientos
                    </label>

                    <!-- Formulario agregar instalación -->
                    <div class="bg-white border border-primary-100 rounded-lg p-3">
                        <p class="text-xs font-medium text-primary-800 uppercase mb-2">Nueva instalación</p>
                        <div class="flex gap-2 items-end flex-wrap">
                            <div class="flex-1 min-w-[150px]">
                                <label class="text-xs text-gray-500 block mb-1">Nombre</label>
                                <input type="text" id="ac-nueva-nombre" class="form-input w-full text-sm"
                                    placeholder="Ej: Piscina exterior, Quincho…">
                            </div>
                            <div class="w-16">
                                <label class="text-xs text-gray-500 block mb-1">Ícono</label>
                                <select id="ac-nueva-icono" class="form-select w-full text-base text-center">
                                    ${_ICONOS_AC.map(ic => `<option value="${ic}">${ic}</option>`).join('')}
                                </select>
                            </div>
                            <button type="button" id="ac-agregar-btn" class="btn-primary text-sm whitespace-nowrap">
                                + Agregar
                            </button>
                        </div>
                    </div>

                    <div id="ac-lista">${_renderListaAC(_espacios)}</div>
                </div>

                <div class="p-4 border-t bg-white flex justify-end gap-2">
                    <button type="button" id="ac-modal-cancel" class="btn-outline">Cancelar</button>
                    <button type="button" id="ac-modal-save" class="btn-primary px-6">Guardar instalaciones</button>
                </div>
            </div>
        </div>
    `;
}

// ── Window functions (namespace "AC") ─────────────────────────────────────────

window.toggleAC = (i) => {
    document.getElementById(`body-ac-${i}`)?.classList.toggle('hidden');
};

window.eliminarAC = (i, event) => {
    if (event) event.stopPropagation();
    _espacios.splice(i, 1);
    _rerenderListaAC();
};

window.eliminarElemAC = (areaIndex, elemIndex) => {
    (_espacios[areaIndex]?.elementos || []).splice(elemIndex, 1);
    _rerenderListaAC();
};

window.agregarElemAC = (areaIndex) => {
    const nombre = document.getElementById(`elem-nombre-${areaIndex}`)?.value.trim();
    if (!nombre) return;
    const capacity = parseInt(document.getElementById(`elem-cap-${areaIndex}`)?.value || '0', 10);
    if (!_espacios[areaIndex].elementos) _espacios[areaIndex].elementos = [];
    _espacios[areaIndex].elementos.push({ nombre, capacity: isNaN(capacity) ? 0 : capacity });
    _rerenderListaAC();
};

// ── Privadas ───────────────────────────────────────────────────────────────────

function _rerenderListaAC() {
    const el = document.getElementById('ac-lista');
    if (el) el.innerHTML = _renderListaAC(_espacios);
}

function _wireModal() {
    const cerrar = () => document.getElementById('ac-modal')?.remove();

    document.getElementById('ac-modal-close').addEventListener('click', cerrar);
    document.getElementById('ac-modal-cancel').addEventListener('click', cerrar);

    document.getElementById('ac-agregar-btn').addEventListener('click', () => {
        const nombre = document.getElementById('ac-nueva-nombre').value.trim();
        const icono  = document.getElementById('ac-nueva-icono').value || '🌿';
        if (!nombre) return;
        _espacios.push({
            id:       generarIdComponente(nombre),
            nombre,
            icono,
            elementos: [],
        });
        document.getElementById('ac-nueva-nombre').value = '';
        _rerenderListaAC();
    });

    document.getElementById('ac-modal-save').addEventListener('click', async () => {
        const activo = document.getElementById('ac-activo').checked;
        try {
            await fetchAPI('/website/empresa/areas-comunes', {
                method: 'PUT',
                body: { activo, espacios: _espacios },
            });
            cerrar();
            if (_onSaveAC) _onSaveAC({ activo, espacios: _espacios });
        } catch (err) {
            alert('Error al guardar instalaciones: ' + err.message);
        }
    });
}

// ── Export ─────────────────────────────────────────────────────────────────────

export async function abrirModalAreasComunes(onSave) {
    _onSaveAC = onSave || null;
    try {
        const data = await fetchAPI('/website/empresa/areas-comunes');
        _espacios = data.espacios || [];
        document.body.insertAdjacentHTML('beforeend', _renderModal(data.activo ?? false));
        _wireModal();
    } catch (err) {
        alert('Error cargando instalaciones del recinto: ' + err.message);
    }
}
