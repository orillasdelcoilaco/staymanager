// frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js
import { fetchAPI } from '../../../api.js';
import { generarIdComponente } from './alojamientos.utils.js';
import { renderComponentList } from './componentEditor.js';
import { getUbicacionData } from '../ubicacionWidget.js';
import { renderModalAlojamiento } from './alojamientos.modals.render.js';
import {
    loadModalCatalogCaches,
    buildIcalInputsHtml,
    mountAreasComunesIfNeeded,
    mountUbicacionCarteraIfNeeded,
} from './alojamientos.modals.openHelpers.js';
import {
    showCustomConfirm,
    detectarTipoEspacio,
    calcularCapacidadElementos,
    getCategoryForSpaceType,
    buildElementoFromTipo
} from './alojamientos.modals.helpers.js';

export { renderModalAlojamiento };

let onSaveCallback = null;
let editandoPropiedad = null;
let tipoNegocioEmpresa = null;
let componentesTemporales = []; // Array of { id, nombre, tipo, tipoId, icono, elementos: [] }
let canalesCache = [];
let tiposComponenteCache = [];
let tiposElementoCache = [];
let tempAiDescription = ''; // Almacena descripción de marketing generada por IA
let areasCompanyCache = []; // Instalaciones del recinto (empresa-level)

// --- UTILS: CUSTOM CONFIRM (imported from alojamientos.modals.helpers.js) ---

// --- FUNCIONES GLOBALES (Window) PARA EVENTOS EN HTML STRING ---

window.toggleComponente = (index) => {
    const body = document.getElementById(`body-comp-${index}`);
    const arrow = document.getElementById(`arrow-${index}`);
    if (body && arrow) {
        if (body.classList.contains('hidden')) {
            body.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
        } else {
            body.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
        }
    }
};

window.eliminarComponente = (index, event) => {
    console.log(`[DEBUG] eliminarComponente llamado para índice ${index}`);
    if (event) event.stopPropagation();

    showCustomConfirm('¿Estás seguro de eliminar este espacio y todo su contenido?', () => {
        componentesTemporales.splice(index, 1);
        console.log('[DEBUG] Componente eliminado. Nueva lista:', componentesTemporales);
        renderizarListaComponentes();
    });
};

window.agregarElemento = (compIndex) => {
    const select = document.getElementById(`select-elemento-${compIndex}`);
    const tipoId = select.value;
    if (!tipoId) return;

    const tipoData = tiposElementoCache.find(t => t.id === tipoId);
    if (!tipoData) return;

    if (!componentesTemporales[compIndex].elementos) {
        componentesTemporales[compIndex].elementos = [];
    }

    const existente = componentesTemporales[compIndex].elementos.find(e => e.tipoId === tipoId);

    if (existente && tipoData.permiteCantidad) {
        existente.cantidad++;
    } else {
        const cap = tipoData.capacity !== undefined ? parseInt(tipoData.capacity) : 0;
        componentesTemporales[compIndex].elementos.push({
            tipoId: tipoData.id,
            nombre: tipoData.nombre,
            icono: tipoData.icono,
            categoria: tipoData.categoria,
            permiteCantidad: tipoData.permiteCantidad,
            cantidad: 1,
            capacity: cap,
            sumaCapacidad: cap > 0 ? true : undefined,
            amenity: '',
            sales_context: tipoData.sales_context || ''
        });
    }

    renderizarListaComponentes();
    setTimeout(() => window.toggleComponente(compIndex), 0);
};

window.eliminarElemento = (compIndex, elemIndex) => {
    componentesTemporales[compIndex].elementos.splice(elemIndex, 1);
    renderizarListaComponentes();
    setTimeout(() => window.toggleComponente(compIndex), 0);
};

window.cambiarCantidadElemento = (compIndex, elemIndex, delta) => {
    const elem = componentesTemporales[compIndex].elementos[elemIndex];
    const nuevaCantidad = elem.cantidad + delta;
    if (nuevaCantidad > 0) {
        elem.cantidad = nuevaCantidad;
        renderizarListaComponentes();
        setTimeout(() => window.toggleComponente(compIndex), 0);
    }
};

window.toggleSumaCapacidad = (compIndex, elemIndex, value) => {
    const elem = componentesTemporales[compIndex]?.elementos[elemIndex];
    if (elem) {
        elem.sumaCapacidad = value;
        actualizarContadores();
    }
};

window.actualizarAmenidad = (compIndex, elemIndex, valor) => {
    const elem = componentesTemporales[compIndex].elementos[elemIndex];
    if (elem) {
        elem.amenity = valor;
    }
};

window.actualizarCapacidadManual = (compIndex, elemIndex, valor) => {
    const elem = componentesTemporales[compIndex].elementos[elemIndex];
    if (elem) {
        elem.capacity = parseInt(valor) || 0;
        renderizarListaComponentes();
    }
};

window.filtrarActivos = (compIndex, query) => {
    const q = (query || '').toLowerCase().trim();
    const panel = document.getElementById(`bulk-add-panel-${compIndex}`);
    if (!panel) return;

    const categorias = panel.querySelectorAll('[data-bulk-cat]');
    categorias.forEach(catDiv => {
        let tieneVisibles = false;
        const labels = catDiv.querySelectorAll(`input[name="bulk-check-${compIndex}"]`);
        labels.forEach(input => {
            const labelEl = input.closest('label');
            const nombre = labelEl.querySelector('span.text-xs')?.textContent.toLowerCase() || '';
            const visible = !q || nombre.includes(q);
            visible ? labelEl.classList.remove('hidden') : labelEl.classList.add('hidden');
            if (visible) tieneVisibles = true;
        });
        tieneVisibles ? catDiv.classList.remove('hidden') : catDiv.classList.add('hidden');
    });
};

window.toggleBulkPanel = (compIndex) => {
    const panel = document.getElementById(`bulk-add-panel-${compIndex}`);
    const arrow = document.getElementById(`bulk-arrow-${compIndex}`);
    if (panel && arrow) {
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
        } else {
            panel.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
            // Limpiar búsqueda al cerrar
            const searchInput = document.getElementById(`bulk-search-${compIndex}`);
            if (searchInput) { searchInput.value = ''; window.filtrarActivos(compIndex, ''); }
        }
    }
};

window.toggleCategoryGroup = (compIndex, categoryKey, isChecked) => {
    const checkboxes = document.querySelectorAll(`input[name="bulk-check-${compIndex}"][data-category="${categoryKey}"]`);
    checkboxes.forEach(cb => cb.checked = isChecked);
};

window.agregarSeleccionados = (compIndex) => {
    const checkboxes = document.querySelectorAll(`input[name="bulk-check-${compIndex}"]:checked`);
    if (checkboxes.length === 0) return;

    if (!componentesTemporales[compIndex].elementos) {
        componentesTemporales[compIndex].elementos = [];
    }

    let agregadosCount = 0;

    checkboxes.forEach(cb => {
        const tipoId = cb.value;
        const tipoData = tiposElementoCache.find(t => t.id === tipoId);
        if (!tipoData) return;

        const existente = componentesTemporales[compIndex].elementos.find(e => e.tipoId === tipoId);

        if (!existente) {
            const cap = tipoData.capacity !== undefined ? parseInt(tipoData.capacity) : 0;
            componentesTemporales[compIndex].elementos.push({
                tipoId: tipoData.id,
                nombre: tipoData.nombre,
                icono: tipoData.icono,
                categoria: tipoData.categoria,
                permiteCantidad: tipoData.permiteCantidad,
                cantidad: 1,
                capacity: cap,
                sumaCapacidad: cap > 0 ? true : undefined,
                amenity: '',
                sales_context: tipoData.sales_context || ''
            });
            agregadosCount++;
        }

        cb.checked = false;
    });

    const headers = document.querySelectorAll(`#bulk-add-panel-${compIndex} input[type="checkbox"]`);
    headers.forEach(h => h.checked = false);

    if (agregadosCount > 0) {
        renderizarListaComponentes();
        setTimeout(() => {
            window.toggleComponente(compIndex);
            window.toggleBulkPanel(compIndex);
        }, 0);
    } else {
        alert('Los elementos seleccionados ya estaban en la lista.');
    }
};

// --- FUNCIONES INTERNAS ---

function actualizarContadores() {
    let numPiezas = 0;
    let numBanos = 0;
    let capacidadTotal = 0;

    componentesTemporales.forEach(comp => {
        const { isDormitorio, isBano, isSuite } = detectarTipoEspacio(comp);

        if (isBano) {
            numBanos++;
        } else if (isDormitorio) {
            numPiezas++;
            if (isSuite) numBanos++;
        }

        capacidadTotal += calcularCapacidadElementos(comp.elementos);
    });

    const inputPiezas = document.getElementById('numPiezas');
    if (inputPiezas) inputPiezas.value = numPiezas;

    const inputBanos = document.getElementById('numBanos');
    if (inputBanos) inputBanos.value = numBanos;

    const inputCapacidad = document.getElementById('capacidad');
    if (inputCapacidad) inputCapacidad.value = capacidadTotal;

    console.log(`[DEBUG] Contadores actualizados: Piezas=${numPiezas}, Baños=${numBanos}, Capacidad=${capacidadTotal}`);
}

function renderizarListaComponentes() {
    console.log('[DEBUG] Renderizando lista de componentes:', componentesTemporales);
    const container = document.getElementById('lista-componentes');
    if (!container) {
        console.error('[DEBUG] Error: Contenedor lista-componentes no encontrado');
        return;
    }
    container.innerHTML = renderComponentList(componentesTemporales, tiposElementoCache);
    actualizarContadores();
}


function autoFillElementos(comp, tipoData, nombre) {
    if (comp.elementos.length > 0) return;

    const catSugerida = getCategoryForSpaceType(tipoData.nombreNormalizado || nombre);
    if (!catSugerida) return;

    console.log(`[AutoFill] Buscando activos para categoría '${catSugerida}'...`);
    const itemsSugeridos = tiposElementoCache.filter(te =>
        (te.categoria || '').toUpperCase().includes(catSugerida)
    );

    if (itemsSugeridos.length > 0) {
        console.log(`[AutoFill] Encontrados ${itemsSugeridos.length} items. Agregando...`);
        comp.elementos = itemsSugeridos.map(buildElementoFromTipo);
    }
}

function handleAgregarComponente() {
    const nombreInput = document.getElementById('nuevo-componente-nombre');
    const tipoSelect = document.getElementById('nuevo-componente-tipo');
    const nombre = nombreInput.value.trim();
    const tipoId = tipoSelect.value;

    if (!nombre || !tipoId) {
        alert('Por favor, ingresa un nombre y selecciona un tipo.');
        return;
    }

    const tipoData = tiposComponenteCache.find(t => t.id === tipoId) || {};

    componentesTemporales.push({
        id: generarIdComponente(nombre),
        nombre: nombre,
        tipo: tipoData.nombreNormalizado || 'Otro',
        tipoId: tipoId,
        icono: tipoData.icono || '📦',
        elementos: (tipoData.elementosDefault && Array.isArray(tipoData.elementosDefault))
            ? tipoData.elementosDefault.map(ed => ({
                tipoId: ed.tipoId,
                nombre: ed.nombre,
                titulo: ed.nombre,
                icono: ed.icono || '🔹',
                cantidad: ed.cantidad || 1,
                permiteCantidad: true,
                capacity: ed.capacity || 0,
                categoria: 'BÁSICOS'
            }))
            : []
    });

    const nuevoComp = componentesTemporales[componentesTemporales.length - 1];
    autoFillElementos(nuevoComp, tipoData, nombre);

    nombreInput.value = '';
    renderizarListaComponentes();
}

async function crearTiposSugeridos(suggestedNewTypes) {
    for (const nuevo of suggestedNewTypes) {
        await fetchAPI('/componentes', { method: 'POST', body: nuevo });
    }
    const timestamp = Date.now();
    const [tiposComp, tiposElem] = await Promise.all([
        fetchAPI(`/componentes?t=${timestamp}`),
        fetchAPI(`/tipos-elemento?t=${timestamp}`)
    ]);
    tiposComponenteCache = tiposComp;
    tiposElementoCache = tiposElem;
}

async function handleGenerarEstructuraIA() {
    console.log('[DEBUG] handleGenerarEstructuraIA iniciado');
    const descripcion = document.getElementById('descripcion').value;
    if (!descripcion || descripcion.length < 10) {
        alert("Por favor, escribe una descripción más detallada para que la IA pueda trabajar.");
        return;
    }

    const btn = document.getElementById('btn-generar-ia');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Analizando y Creando...';

    try {
        console.log('[DEBUG] Enviando petición a /ai/generate-structure con:', descripcion);
        const response = await fetchAPI('/ai/generate-structure', { method: 'POST', body: { descripcion } });
        console.log('[DEBUG] Respuesta IA recibida:', response);

        const listaComponentes = Array.isArray(response) ? response : (response.componentes || []);
        const ubicacionSugerida = Array.isArray(response) ? null : response.ubicacion;
        const marketingDescSugerida = Array.isArray(response) ? '' : (response.marketingDesc || '');

        if (!Array.isArray(listaComponentes)) return;

        const suggestedNewTypes = Array.isArray(response) ? [] : (response.suggestedNewTypes || []);

        if (suggestedNewTypes.length > 0) {
            console.log('[AI] Sugerencias detectadas:', suggestedNewTypes);
            const listaHTML = suggestedNewTypes.map(t => `<li>${t.icono} <b>${t.nombreNormalizado}</b></li>`).join('');

            showCustomConfirm(`
                <p class="mb-2">La IA detectó espacios que no tienes configurados:</p>
                <ul class="list-disc pl-5 mb-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">${listaHTML}</ul>
                <p>¿Deseas crearlos automáticamente ahora?</p>
            `, async () => {
                try {
                    const b = document.getElementById('btn-generar-ia');
                    if (b) b.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Creando tipos...';
                    console.log('[AI] Creando tipos sugeridos...');
                    await crearTiposSugeridos(suggestedNewTypes);
                    console.log('[AI] Tipos creados. Recargando cache...');
                    aplicarEstructuraIA(listaComponentes, ubicacionSugerida, marketingDescSugerida);
                } catch (createError) {
                    console.error('Error creando tipos:', createError);
                    alert('Error creando los tipos automáticos. Se intentará aplicar la estructura igual.');
                    aplicarEstructuraIA(listaComponentes, ubicacionSugerida, marketingDescSugerida);
                } finally {
                    const b = document.getElementById('btn-generar-ia');
                    if (b) { b.disabled = false; b.innerHTML = originalText; }
                }
            });
            return;
        }

        aplicarEstructuraIA(listaComponentes, ubicacionSugerida, marketingDescSugerida);

    } catch (error) {
        console.error("Error IA:", error);
        alert("Hubo un error al generar la estructura.");
        const b = document.getElementById('btn-generar-ia');
        if (b) { b.disabled = false; b.innerHTML = originalText; }
    }
}

function aplicarEstructuraIA(listaComponentes, ubicacionSugerida, marketingDescSugerida) {
    showCustomConfirm(`La IA ha sugerido agregar ${listaComponentes.length} nuevos espacios. ¿Deseas agregarlos a tu distribución actual?`, () => {
        try {
            if (ubicacionSugerida) {
                if (ubicacionSugerida.calle) document.getElementById('googleHotelStreet').value = ubicacionSugerida.calle;
                if (ubicacionSugerida.ciudad) document.getElementById('googleHotelCity').value = ubicacionSugerida.ciudad;
            }

            if (marketingDescSugerida) {
                tempAiDescription = marketingDescSugerida;
                console.log('[AI] Descripción de Marketing guardada temporalmente:', tempAiDescription);
            }

            const nuevosComponentes = listaComponentes.map(comp => {
                const metaTipo = tiposComponenteCache.find(t => t.id === comp.tipoId);
                return {
                    id: generarIdComponente(comp.nombre || 'Espacio'),
                    nombre: comp.nombre || 'Sin Nombre',
                    tipo: metaTipo ? metaTipo.nombreNormalizado : (comp.tipo || comp.sugerenciaNuevoTipo || 'Otro'),
                    tipoId: comp.tipoId || 'unknown',
                    icono: metaTipo ? metaTipo.icono : (comp.icono || '✨'),
                    elementos: Array.isArray(comp.elementos) ? comp.elementos.map(elem => {
                        const metaElem = tiposElementoCache.find(e => e.id === elem.tipoId);
                        return {
                            tipoId: elem.tipoId,
                            nombre: elem.nombre || (metaElem ? metaElem.nombre : 'Item'),
                            cantidad: elem.cantidad || 1,
                            icono: metaElem ? metaElem.icono : (elem.icono || '🔹'),
                            categoria: elem.categoria || (metaElem ? metaElem.categoria : 'OTROS'),
                            permiteCantidad: true,
                            amenity: '',
                            sales_context: metaElem ? (metaElem.sales_context || '') : ''
                        };
                    }) : []
                };
            });

            componentesTemporales = [...componentesTemporales, ...nuevosComponentes];
            console.log('[DEBUG] Estructura aplicada (Merged):', componentesTemporales);
            renderizarListaComponentes();

        } catch (mapError) {
            console.error('[DEBUG] Error mapeando datos IA:', mapError);
            alert("Error procesando la respuesta.");
        }
    });
}

// --- HELPERS PRIVADOS: abrirModalAlojamiento ---

function cargarSelectTipos(tipoSelect, tiposComp) {
    if (tiposComp.length === 0) {
        tipoSelect.innerHTML = '<option value="">Sin tipos definidos</option>';
        tipoSelect.disabled = true;
    } else {
        tipoSelect.disabled = false;
        tipoSelect.innerHTML = tiposComp.map(t =>
            `<option value="${t.id}">${t.icono || ''} ${t.nombreNormalizado}</option>`
        ).join('');
    }
}

function hidratarCapacidades(componentes) {
    componentes.forEach(comp => {
        if (!Array.isArray(comp.elementos)) return;
        comp.elementos.forEach(elem => {
            if (elem.capacity !== undefined && elem.capacity !== null) return;
            const tipoData = tiposElementoCache.find(t => t.id === elem.tipoId);
            if (tipoData && tipoData.capacity !== undefined) {
                elem.capacity = parseInt(tipoData.capacity);
                console.log(`[Hydrate] Elemento '${elem.nombre}' hidratado con capacidad: ${elem.capacity}`);
            }
        });
    });
}

function leerContextoComercialDelDom() {
    const tipo_viaje = Array.from(document.querySelectorAll('input[name="ctx-tv"]:checked')).map((c) => c.value);
    const entorno = Array.from(document.querySelectorAll('input[name="ctx-ent"]:checked')).map((c) => c.value);
    const raw = document.getElementById('ctx-destacados')?.value || '';
    const destacados = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return { tipo_viaje, entorno, destacados };
}

function aplicarContextoComercialAlDom(cc) {
    const data = cc || {};
    document.querySelectorAll('input[name="ctx-tv"]').forEach((cb) => {
        cb.checked = (data.tipo_viaje || []).includes(cb.value);
    });
    document.querySelectorAll('input[name="ctx-ent"]').forEach((cb) => {
        cb.checked = (data.entorno || []).includes(cb.value);
    });
    const ta = document.getElementById('ctx-destacados');
    if (ta) ta.value = (data.destacados || []).join('\n');
}

function poblarFormularioEdicion(form, propiedad, icalContainer) {
    editandoPropiedad = propiedad;
    document.getElementById('modal-title').textContent = 'Editar Alojamiento';
    const subtitleEl = document.getElementById('modal-alojamiento-subtitle');
    if (subtitleEl) subtitleEl.textContent = propiedad.nombre;

    form.nombre.value = propiedad.nombre || '';
    form.numPiezas.value = propiedad.numPiezas || 0;
    form.numBanos.value = propiedad.numBanos || 0;
    form.capacidad.value = propiedad.capacidad || 0;

    componentesTemporales = Array.isArray(propiedad.componentes)
        ? JSON.parse(JSON.stringify(propiedad.componentes))
        : [];

    icalContainer.querySelectorAll('.ical-input').forEach(input => {
        const canalKey = input.dataset.canalKey;
        input.value = (propiedad.sincronizacionIcal && propiedad.sincronizacionIcal[canalKey])
            ? propiedad.sincronizacionIcal[canalKey]
            : '';
    });

    form.googleHotelId.value = propiedad.googleHotelData?.hotelId || '';
    form.googleHotelIsListed.checked = propiedad.googleHotelData?.isListed || false;

    aplicarContextoComercialAlDom(propiedad.contextoComercial);
}

function poblarFormularioCreacion(form, icalContainer) {
    editandoPropiedad = null;
    document.getElementById('modal-title').textContent = 'Crear Nuevo Alojamiento';
    const subtitleEl = document.getElementById('modal-alojamiento-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'Configura los datos del alojamiento';
    form.reset();
    componentesTemporales = [];
    tempAiDescription = '';
    icalContainer.querySelectorAll('.ical-input').forEach(input => { input.value = ''; });
    aplicarContextoComercialAlDom({ tipo_viaje: [], entorno: [], destacados: [] });
}

// --- EXPORTS ---

export const abrirModalAlojamiento = async (propiedad = null, canales = []) => {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const icalContainer = document.getElementById('ical-fields-container');
    const tipoSelect = document.getElementById('nuevo-componente-tipo');

    canalesCache = canales;

    if (!tipoNegocioEmpresa) {
        try {
            const emp = await fetchAPI('/empresa');
            tipoNegocioEmpresa = emp.tipoNegocio || '';
        } catch { tipoNegocioEmpresa = ''; }
    }

    if (!modal || !form) return;

    try {
        const { tiposComp, tiposElem, areasCompanyCache: areas } = await loadModalCatalogCaches();
        tiposComponenteCache = tiposComp;
        tiposElementoCache = tiposElem;
        areasCompanyCache = areas;
        cargarSelectTipos(tipoSelect, tiposComponenteCache);
    } catch (error) {
        console.error("Error cargando metadatos:", error);
        alert("Error cargando configuraciones. Revisa la consola.");
    }

    icalContainer.innerHTML = buildIcalInputsHtml(canales);

    if (propiedad) {
        poblarFormularioEdicion(form, propiedad, icalContainer);
    } else {
        poblarFormularioCreacion(form, icalContainer);
    }

    hidratarCapacidades(componentesTemporales);

    const areasSection = document.getElementById('areas-comunes-section');
    const areasChecks = document.getElementById('areas-comunes-checks');
    mountAreasComunesIfNeeded(areasSection, areasChecks, areasCompanyCache, propiedad);

    const ubicacionContainer = document.getElementById('ubicacion-propiedad-container');
    const ubicacionWidgetEl = document.getElementById('ubicacion-propiedad-widget');
    mountUbicacionCarteraIfNeeded(tipoNegocioEmpresa, propiedad, ubicacionContainer, ubicacionWidgetEl);

    renderizarListaComponentes();
    modal.classList.remove('hidden');
};

export const cerrarModalAlojamiento = () => {
    document.getElementById('propiedad-modal').classList.add('hidden');
    editandoPropiedad = null;
    componentesTemporales = [];
};

export const setupModalAlojamiento = (callback) => {
    onSaveCallback = callback;
    const form = document.getElementById('propiedad-form');
    if (!form) return;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalAlojamiento);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalAlojamiento);
    document.getElementById('agregar-componente-btn').addEventListener('click', handleAgregarComponente);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const icalInputs = newForm.querySelectorAll('.ical-input');
        const sincronizacionIcal = {};
        icalInputs.forEach(input => {
            if (input.value) sincronizacionIcal[input.dataset.canalKey.toLowerCase()] = input.value;
        });

        const ubicacion = tipoNegocioEmpresa === 'cartera' ? getUbicacionData('prop-ubicacion') : null;

        const areas_comunes_ids = Array.from(
            document.querySelectorAll('input[name="area-comun-check"]:checked')
        ).map(cb => cb.value);

        const datos = {
            nombre: newForm.nombre.value,
            capacidad: parseInt(newForm.capacidad.value),
            numPiezas: parseInt(newForm.numPiezas.value) || 0,
            numBanos: parseInt(newForm.numBanos.value) || 0,
            descripcion: '',
            camas: {},
            equipamiento: {},
            amenidades: [],
            componentes: componentesTemporales,
            areas_comunes_ids,
            sincronizacionIcal,
            ...(ubicacion ? { ubicacion } : {}),
            googleHotelData: {
                hotelId: document.getElementById('googleHotelId').value.trim(),
                isListed: document.getElementById('googleHotelIsListed').checked,
            },
            contextoComercial: leerContextoComercialDelDom(),
            websiteData: {
                ...(editandoPropiedad?.websiteData || {}),
                aiDescription: tempAiDescription || editandoPropiedad?.websiteData?.aiDescription || '',
                images: editandoPropiedad?.websiteData?.images || {},
                cardImage: editandoPropiedad?.websiteData?.cardImage || null
            }
        };

        try {
            const endpoint = editandoPropiedad ? `/propiedades/${editandoPropiedad.id}` : '/propiedades';
            const method = editandoPropiedad ? 'PUT' : 'POST';
            const result = await fetchAPI(endpoint, { method: method, body: datos });

            // Fire-and-forget: sync buildContext en background (no bloquea)
            const propId = editandoPropiedad?.id || result?.id;
            if (propId && componentesTemporales.length > 0) {
                fetchAPI(`/website/propiedad/${propId}/build-context/sync-producto`, { method: 'POST' })
                    .catch(err => console.warn('[BuildContext] Sync fallido (no crítico):', err.message));
            }

            cerrarModalAlojamiento();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });
};
