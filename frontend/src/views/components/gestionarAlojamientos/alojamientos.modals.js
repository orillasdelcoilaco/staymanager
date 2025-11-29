// frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js
import { fetchAPI } from '../../../api.js';
import { generarIdComponente } from './alojamientos.utils.js';
import { renderComponentList } from './componentEditor.js';

let onSaveCallback = null;
let editandoPropiedad = null;
let componentesTemporales = []; // Array of { id, nombre, tipo, tipoId, icono, elementos: [] }
let canalesCache = [];
let tiposComponenteCache = [];
let tiposElementoCache = [];

// --- UTILS: CUSTOM CONFIRM ---
function showCustomConfirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '9999'; // Force high z-index to be above everything
    overlay.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Confirmación</h3>
            <p class="text-gray-600 mb-6">${message}</p>
            <div class="flex justify-end gap-3">
                <button id="custom-cancel-btn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">Cancelar</button>
                <button id="custom-confirm-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    };

    document.getElementById('custom-cancel-btn').onclick = close;
    document.getElementById('custom-confirm-btn').onclick = () => {
        close();
        onConfirm();
    };
}

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

    // Verificar si ya existe (si no permite cantidad, o si queremos agrupar)
    const existente = componentesTemporales[compIndex].elementos.find(e => e.tipoId === tipoId);

    if (existente && tipoData.permiteCantidad) {
        existente.cantidad++;
    } else {
        componentesTemporales[compIndex].elementos.push({
            tipoId: tipoData.id,
            nombre: tipoData.nombre,
            icono: tipoData.icono,
            categoria: tipoData.categoria,
            permiteCantidad: tipoData.permiteCantidad,
            cantidad: 1,
            amenity: '' // Nuevo campo para detalles
        });
    }

    renderizarListaComponentes();
    // Re-abrir el componente
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

window.actualizarAmenidad = (compIndex, elemIndex, valor) => {
    const elem = componentesTemporales[compIndex].elementos[elemIndex];
    if (elem) {
        elem.amenity = valor;
    }
};

// --- FUNCIONES INTERNAS ---

function actualizarContadores() {
    let numPiezas = 0;
    let numBanos = 0;
    let capacidadTotal = 0;

    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    componentesTemporales.forEach(comp => {
        // Normalizar a mayúsculas y eliminar acentos para comparación robusta
        const rawTipo = (comp.tipo || '').toUpperCase();
        const rawNombre = (comp.nombre || '').toUpperCase();

        const tipo = normalize(rawTipo);
        const nombre = normalize(rawNombre);

        // Palabras clave para detectar tipos (debe coincidir con backend/services/propiedadLogicService.js)
        const isDormitorio = tipo.includes('DORMITORIO') || tipo.includes('HABITACION') || tipo.includes('PIEZA') || tipo.includes('BEDROOM') ||
            nombre.includes('DORMITORIO') || nombre.includes('HABITACION');

        const isBano = tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
            nombre.includes('BANO') || nombre.includes('TOILET');

        if (isBano) {
            numBanos++;
        } else if (isDormitorio) {
            numPiezas++;
            // Lógica En Suite: Si es dormitorio y dice "SUITE", asumimos +1 baño
            if (nombre.includes('SUITE') || tipo.includes('SUITE')) {
                numBanos++;
            }
        }

        // Calcular capacidad basada en elementos (camas)
        if (comp.elementos && Array.isArray(comp.elementos)) {
            comp.elementos.forEach(elem => {
                const nombreElem = normalize((elem.nombre || '').toUpperCase());
                const cantidad = parseInt(elem.cantidad) || 1;

                // Lógica heurística de capacidad mejorada y expandida

                // 1. Detectar explícitamente capacidad doble
                const esDoble = nombreElem.includes('KING') ||
                    nombreElem.includes('QUEEN') ||
                    nombreElem.includes('MATRIMONIAL') ||
                    nombreElem.includes('DOBLE') ||
                    nombreElem.includes('2 PLAZAS') ||
                    nombreElem.includes('DOS PLAZAS');

                // 2. Detectar explícitamente capacidad simple
                const esSimple = nombreElem.includes('1 PLAZA') ||
                    nombreElem.includes('1.5 PLAZA') ||
                    nombreElem.includes('INDIVIDUAL') ||
                    nombreElem.includes('SINGLE') ||
                    nombreElem.includes('NIDO') ||
                    nombreElem.includes('CATRE') ||
                    nombreElem.includes('SIMPLE');

                // 3. Tipos de muebles para dormir
                const esCama = nombreElem.includes('CAMA') || nombreElem.includes('BED');
                const esLitera = nombreElem.includes('LITERA') || nombreElem.includes('CAMAROTE');
                const esSofa = nombreElem.includes('SOFA') || nombreElem.includes('FUTON');
                const esColchon = nombreElem.includes('COLCHON') || nombreElem.includes('INFLABLE');

                if (esLitera) {
                    // Literas generalmente son 2 camas
                    capacidadTotal += 2 * cantidad;
                } else if (esDoble) {
                    // Cualquier cosa explícitamente doble suma 2
                    capacidadTotal += 2 * cantidad;
                } else if (esSimple) {
                    // Cualquier cosa explícitamente simple suma 1
                    capacidadTotal += 1 * cantidad;
                } else {
                    // Casos ambiguos o por defecto
                    if (esSofa || esColchon) {
                        // Sofás cama y colchones inflables sin especificar tamaño -> Asumimos 1 (conservador)
                        capacidadTotal += 1 * cantidad;
                    } else if (esCama) {
                        // Si dice solo "Cama" y no especificó nada más -> Asumimos 1
                        capacidadTotal += 1 * cantidad;
                    }
                }
            });
        }
    });

    // Actualizar inputs del DOM si existen
    const inputPiezas = document.getElementById('numPiezas');
    if (inputPiezas) {
        inputPiezas.value = numPiezas;
    }

    const inputBanos = document.getElementById('numBanos');
    if (inputBanos) {
        inputBanos.value = numBanos;
    }

    const inputCapacidad = document.getElementById('capacidad');
    if (inputCapacidad) {
        inputCapacidad.value = capacidadTotal;
    }

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
        elementos: []
    });

    nombreInput.value = '';
    renderizarListaComponentes();
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
    btn.innerHTML = '✨ Generando...';

    try {
        console.log('[DEBUG] Enviando petición a /ai/generate-structure con:', descripcion);
        const response = await fetchAPI('/ai/generate-structure', {
            method: 'POST',
            body: { descripcion }
        });
        console.log('[DEBUG] Respuesta IA recibida:', response);

        if (response && Array.isArray(response)) {
            showCustomConfirm(`La IA ha detectado ${response.length} espacios. ¿Deseas reemplazar la estructura actual con esta propuesta?`, () => {
                try {
                    console.log('[DEBUG] Iniciando mapeo de respuesta IA...');
                    // Mapear respuesta de IA a estructura interna
                    componentesTemporales = response.map(comp => ({
                        id: generarIdComponente(comp.nombre || 'Espacio'),
                        nombre: comp.nombre || 'Sin Nombre',
                        tipo: comp.nombre || 'Otro', // El nombre del componente sirve como tipo visual
                        tipoId: comp.tipoId || 'unknown', // ID real del tipo para backend
                        icono: '✨', // Icono temporal, idealmente buscar en cache
                        elementos: (comp.elementos && Array.isArray(comp.elementos)) ? comp.elementos.map(elem => {
                            // Intentar buscar el tipo de elemento en cache para tener el icono y datos correctos
                            let tipoElemData = null;
                            if (elem.nombre && tiposElementoCache.length > 0) {
                                tipoElemData = tiposElementoCache.find(t => t.nombre.toLowerCase().includes(elem.nombre.toLowerCase()) || t.categoria === elem.categoria);
                            }

                            return {
                                tipoId: tipoElemData ? tipoElemData.id : 'unknown',
                                nombre: elem.nombre || 'Elemento',
                                cantidad: elem.cantidad || 1,
                                icono: tipoElemData ? tipoElemData.icono : '🔹',
                                categoria: elem.categoria || 'OTROS',
                                permiteCantidad: true
                            };
                        }) : []
                    }));

                    // Actualizar iconos de componentes basándose en el tipoId si existe en cache
                    componentesTemporales.forEach(c => {
                        const tipoData = tiposComponenteCache.find(t => t.id === c.tipoId);
                        if (tipoData) {
                            c.icono = tipoData.icono;
                            c.tipo = tipoData.nombreNormalizado;
                        }
                    });

                    console.log('[DEBUG] Estructura procesada correctamente:', componentesTemporales);
                    renderizarListaComponentes();

                } catch (mapError) {
                    console.error('[DEBUG] Error durante el mapeo de datos IA:', mapError);
                    alert("Error procesando la respuesta de la IA.");
                }
            });
        } else {
            console.warn('[DEBUG] Respuesta inválida de IA (no es array):', response);
            alert("No se pudo generar una estructura válida. Intenta mejorar la descripción.");
        }

    } catch (error) {
        console.error("Error IA:", error);
        alert("Hubo un error al generar la estructura con IA.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- EXPORTS ---

export const renderModalAlojamiento = () => {
    return `
        <div id="propiedad-modal" class="modal hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40 flex items-center justify-center">
             <div class="modal-content relative bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 md:mx-auto my-5 flex flex-col max-h-[95vh]">
                 <div class="flex justify-between items-center p-5 border-b">
                    <h3 id="modal-title" class="text-xl font-semibold text-gray-800"></h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                </div>
                <div class="p-6 overflow-y-auto bg-gray-50">
                    <form id="propiedad-form" class="space-y-6">
                        
                        <!-- SECCIÓN 1: DATOS BÁSICOS -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border">
                            <h4 class="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Información General</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div class="lg:col-span-2">
                                    <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Alojamiento</label>
                                    <input type="text" id="nombre" name="nombre" required class="form-input mt-1 w-full" placeholder="Ej: Cabaña del Lago">
                                </div>
                                <div>
                                    <label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad Máxima</label>
                                    <input type="number" id="capacidad" name="capacidad" required class="form-input mt-1 w-full">
                                </div>
                                <div>
                                    <label for="numPiezas" class="block text-sm font-medium text-gray-700">Nº Piezas (Ref)</label>
                                    <input type="number" id="numPiezas" name="numPiezas" class="form-input mt-1 w-full" readonly>
                                </div>
                                <div>
                                    <label for="numBanos" class="block text-sm font-medium text-gray-700">Nº Baños (Ref)</label>
                                    <input type="number" id="numBanos" name="numBanos" class="form-input mt-1 w-full" readonly>
                                </div>
                            </div>
                            <div class="mt-4">
                                <label for="descripcion" class="block text-sm font-medium text-gray-700">Descripción</label>
                                <textarea id="descripcion" name="descripcion" rows="3" class="form-input w-full mt-1" placeholder="Describe tu propiedad (ej: 3 dormitorios, uno en suite...)"></textarea>
                                <button type="button" id="btn-generar-ia" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium">
                                    ✨ Generar estructura con IA
                                </button>
                            </div>
                        </div>

                        <!-- SECCIÓN 2: CONSTRUCTOR DE ESPACIOS (CORE) -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border border-indigo-100">
                            <div class="flex justify-between items-center mb-4 border-b pb-2">
                                <div>
                                    <h4 class="text-lg font-semibold text-indigo-700">Distribución y Contenido</h4>
                                    <p class="text-sm text-gray-500">Define los espacios (dormitorios, baños) y qué hay dentro de ellos.</p>
                                </div>
                            </div>
                            
                            <!-- Formulario Agregar Componente -->
                            <div class="bg-indigo-50 p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-4 items-end border border-indigo-100">
                                <div class="flex-grow">
                                    <label class="block text-xs font-medium text-indigo-800 uppercase mb-1">Nombre del Espacio</label>
                                    <input type="text" id="nuevo-componente-nombre" placeholder="Ej: Dormitorio Principal" class="form-input w-full">
                                </div>
                                <div class="md:w-1/3">
                                    <label class="block text-xs font-medium text-indigo-800 uppercase mb-1">Tipo</label>
                                    <select id="nuevo-componente-tipo" class="form-select w-full">
                                        <option value="">Cargando...</option>
                                    </select>
                                </div>
                                <button type="button" id="agregar-componente-btn" class="btn-primary whitespace-nowrap">
                                    + Agregar Espacio
                                </button>
                            </div>

                            <!-- Lista de Componentes -->
                            <div id="lista-componentes" class="space-y-4"></div>
                        </div>

                        <!-- SECCIÓN 3: CONFIGURACIÓN AVANZADA -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border">
                            <h4 class="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Configuración Avanzada</h4>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Google Hotels & SEO</label>
                                    <div class="space-y-3">
                                        <div><label class="text-xs text-gray-500">ID Alojamiento</label><input type="text" id="googleHotelId" class="form-input w-full mt-1"></div>
                                        <div><label class="flex items-center space-x-2"><input type="checkbox" id="googleHotelIsListed" class="rounded text-indigo-600"><span>Publicar en Web/Google</span></label></div>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
                                    <div class="space-y-3">
                                        <input type="text" id="googleHotelStreet" placeholder="Calle y Número" class="form-input w-full">
                                        <input type="text" id="googleHotelCity" placeholder="Ciudad" class="form-input w-full">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="ical-fields-container" class="hidden"></div>
                    </form>
                </div>
                <div class="p-5 border-t bg-white rounded-b-lg flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                    <button type="button" id="cancel-btn" class="btn-secondary">Cancelar</button>
                    <button type="submit" form="propiedad-form" class="btn-primary px-8">Guardar Todo</button>
                </div>
            </div>
        </div>
    `;
};

export const abrirModalAlojamiento = async (propiedad = null, canales = []) => {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const modalTitle = document.getElementById('modal-title');
    const icalContainer = document.getElementById('ical-fields-container');
    const tipoSelect = document.getElementById('nuevo-componente-tipo');

    canalesCache = canales;

    if (!modal || !form) return;

    // 1. Cargar Tipos de Componente y Elemento en paralelo
    try {
        const [tiposComp, tiposElem] = await Promise.all([
            fetchAPI('/componentes'),
            fetchAPI('/tipos-elemento')
        ]);

        tiposComponenteCache = tiposComp;
        tiposElementoCache = tiposElem;

        if (tiposComponenteCache.length === 0) {
            tipoSelect.innerHTML = '<option value="">Sin tipos definidos</option>';
            tipoSelect.disabled = true;
        } else {
            tipoSelect.disabled = false;
            tipoSelect.innerHTML = tiposComponenteCache.map(t =>
                `<option value="${t.id}">${t.icono || ''} ${t.nombreNormalizado}</option>`
            ).join('');
        }
    } catch (error) {
        console.error("Error cargando metadatos:", error);
        alert("Error cargando configuraciones. Revisa la consola.");
    }

    // 2. Renderizar campos iCal (Oculto pero funcional)
    icalContainer.innerHTML = canales
        .filter(canal => canal.nombre.toLowerCase() !== 'app')
        .map(canal => `
            <input type="url" id="ical-${canal.id}" data-canal-key="${canal.nombre.toLowerCase()}" class="ical-input">
        `).join('');

    if (propiedad) {
        editandoPropiedad = propiedad;
        modalTitle.textContent = `Editar: ${propiedad.nombre}`;

        form.nombre.value = propiedad.nombre || '';
        form.numPiezas.value = propiedad.numPiezas || 0;
        form.numBanos.value = propiedad.numBanos || 0;
        form.descripcion.value = propiedad.descripcion || '';
        form.capacidad.value = propiedad.capacidad || 0;

        // Deep copy de componentes para no mutar el original hasta guardar
        componentesTemporales = Array.isArray(propiedad.componentes) ? JSON.parse(JSON.stringify(propiedad.componentes)) : [];

        icalContainer.querySelectorAll('.ical-input').forEach(input => {
            const canalKey = input.dataset.canalKey;
            if (propiedad.sincronizacionIcal && propiedad.sincronizacionIcal[canalKey]) {
                input.value = propiedad.sincronizacionIcal[canalKey];
            } else {
                input.value = '';
            }
        });

        form.googleHotelId.value = propiedad.googleHotelData?.hotelId || '';
        form.googleHotelIsListed.checked = propiedad.googleHotelData?.isListed || false;
        form.googleHotelStreet.value = propiedad.googleHotelData?.address?.street || '';
        form.googleHotelCity.value = propiedad.googleHotelData?.address?.city || '';
    } else {
        editandoPropiedad = null;
        modalTitle.textContent = 'Crear Nuevo Alojamiento';
        form.reset();
        componentesTemporales = [];
        icalContainer.querySelectorAll('.ical-input').forEach(input => input.value = '');
    }

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
    document.getElementById('btn-generar-ia').addEventListener('click', handleGenerarEstructuraIA);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const icalInputs = newForm.querySelectorAll('.ical-input');
        const sincronizacionIcal = {};
        icalInputs.forEach(input => {
            if (input.value) sincronizacionIcal[input.dataset.canalKey.toLowerCase()] = input.value;
        });

        const datos = {
            nombre: newForm.nombre.value,
            capacidad: parseInt(newForm.capacidad.value),
            numPiezas: parseInt(newForm.numPiezas.value) || 0,
            numBanos: parseInt(newForm.numBanos.value) || 0,
            descripcion: newForm.descripcion.value,
            // Legacy fields vacíos, ahora todo vive en componentes
            camas: {},
            equipamiento: {},
            amenidades: [],
            componentes: componentesTemporales, // Aquí va toda la estructura jerárquica
            sincronizacionIcal,
            googleHotelData: {
                hotelId: document.getElementById('googleHotelId').value.trim(),
                isListed: document.getElementById('googleHotelIsListed').checked,
                address: {
                    street: document.getElementById('googleHotelStreet').value.trim(),
                    city: document.getElementById('googleHotelCity').value.trim(),
                    countryCode: 'CL'
                }
            },
            websiteData: editandoPropiedad?.websiteData || { aiDescription: '', images: {}, cardImage: null }
        };

        try {
            const endpoint = editandoPropiedad ? `/propiedades/${editandoPropiedad.id}` : '/propiedades';
            const method = editandoPropiedad ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method: method, body: datos });
            cerrarModalAlojamiento();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });
};