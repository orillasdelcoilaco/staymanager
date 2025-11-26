// frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js
import { fetchAPI } from '../../../api.js';
import { generarIdComponente, renderCheckbox } from './alojamientos.utils.js';

let onSaveCallback = null;
let editandoPropiedad = null;
let componentesTemporales = [];
let canalesCache = []; 
let tiposComponenteCache = []; // Cache para no llamar a la API cada vez que se abre el modal

// --- Lógica Interna de Componentes ---

function renderizarListaComponentes() {
    const container = document.getElementById('lista-componentes');
    if (!container) return;
    
    if (componentesTemporales.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">No hay componentes adicionales definidos.</p>';
        return;
    }
    
    container.innerHTML = componentesTemporales.map((comp, index) => `
        <div class="flex items-center justify-between p-2 border rounded bg-gray-50 mb-2">
            <div class="flex items-center gap-2">
                <span class="text-xl">${comp.icono || '📦'}</span>
                <div>
                    <span class="text-sm font-medium block">${comp.nombre}</span>
                    <span class="text-xs text-gray-500 capitalize">${comp.tipo}</span>
                </div>
            </div>
            <button type="button" data-index="${index}" class="eliminar-componente-btn text-red-500 hover:text-red-700 text-xs font-medium px-2">Eliminar</button>
        </div>
    `).join('');

    container.querySelectorAll('.eliminar-componente-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            componentesTemporales.splice(index, 1);
            renderizarListaComponentes();
        });
    });
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

    // Buscar metadata del tipo seleccionado para guardar el icono y nombre normalizado
    const tipoData = tiposComponenteCache.find(t => t.id === tipoId) || {};

    componentesTemporales.push({
        id: generarIdComponente(nombre),
        nombre: nombre, // Ej: "Quincho del Sur"
        tipo: tipoData.nombreNormalizado || 'Otro', // Ej: "Zona de Barbacoa"
        tipoId: tipoId,
        icono: tipoData.icono || '📦'
    });

    nombreInput.value = '';
    // No reseteamos el select para facilitar agregar varios del mismo tipo
    renderizarListaComponentes();
}

// --- Renderizado del Modal ---

export const renderModalAlojamiento = () => {
    // El select se llenará dinámicamente al abrir el modal
    return `
        <div id="propiedad-modal" class="modal hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40 flex items-center justify-center">
             <div class="modal-content relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 md:mx-auto my-10 flex flex-col max-h-[90vh]">
                 
                 <div class="flex justify-between items-center p-5 border-b">
                    <h3 id="modal-title" class="text-xl font-semibold text-gray-800"></h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                </div>

                <div class="p-6 overflow-y-auto">
                    <form id="propiedad-form">
                        <fieldset class="border p-4 rounded-md mb-6">
                            <legend class="px-2 font-semibold text-gray-700">Información General</legend>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                <div class="lg:col-span-1"><label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Alojamiento</label><input type="text" id="nombre" name="nombre" required class="form-input mt-1"></div>
                                <div class="lg:col-span-1"><label for="numPiezas" class="block text-sm font-medium text-gray-700">Nº Piezas</label><input type="number" id="numPiezas" name="numPiezas" class="form-input mt-1"></div>
                                <div class="lg:col-span-1"><label for="numBanos" class="block text-sm font-medium text-gray-700">Nº Baños</label><input type="number" id="numBanos" name="numBanos" class="form-input mt-1"></div>
                            </div>
                        </fieldset>
                        
                        <fieldset class="border p-4 rounded-md mb-6">
                             <legend class="px-2 font-semibold text-gray-700">Distribución y Capacidad</legend>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
                                <div><label for="matrimoniales" class="block text-sm font-medium text-gray-700">Matrimoniales</label><input type="number" id="matrimoniales" name="matrimoniales" class="form-input mt-1"></div>
                                <div><label for="plazaYMedia" class="block text-sm font-medium text-gray-700">1.5 Plazas</label><input type="number" id="plazaYMedia" name="plazaYMedia" class="form-input mt-1"></div>
                                <div><label for="camarotes" class="block text-sm font-medium text-gray-700">Camarotes</label><input type="number" id="camarotes" name="camarotes" class="form-input mt-1"></div>
                                <div><label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad Max</label><input type="number" id="capacidad" name="capacidad" required class="form-input mt-1"></div>
                            </div>
                        </fieldset>
                        
                        <fieldset class="border p-4 rounded-md mb-6">
                            <legend class="px-2 font-semibold text-gray-700">Descripción</legend>
                            <div class="mt-4"><textarea id="descripcion" name="descripcion" rows="4" class="form-input w-full"></textarea></div>
                        </fieldset>
                        
                        <fieldset class="border p-4 rounded-md mb-6">
                            <legend class="px-2 font-semibold text-gray-700">Equipamiento</legend>
                            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                                ${renderCheckbox('tinaja', 'Tinaja')} ${renderCheckbox('parrilla', 'Parrilla')} ${renderCheckbox('terrazaTechada', 'Terraza Techada')}
                                ${renderCheckbox('juegoDeTerraza', 'Juego de Terraza')} ${renderCheckbox('piezaEnSuite', 'Pieza en Suite')} ${renderCheckbox('dosPisos', 'Dos Pisos')}
                            </div>
                        </fieldset>

                        <fieldset class="border p-4 rounded-md mb-6 bg-indigo-50 border-indigo-100">
                            <legend class="px-2 font-semibold text-indigo-700 bg-white border border-indigo-100 rounded shadow-sm">Componentes (Espacios)</legend>
                            <p class="text-xs text-gray-600 mt-2 mb-4">
                                Define las áreas específicas para generar una galería de fotos organizada y optimizada para SEO.
                                <br><em>(Ej: Agrega "Quincho", "Habitación Principal", "Terraza Norte")</em>
                            </p>
                            
                            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4">
                                <div class="md:col-span-5">
                                    <label for="nuevo-componente-nombre" class="block text-xs font-medium text-gray-700 uppercase">Nombre Personalizado</label>
                                    <input type="text" id="nuevo-componente-nombre" placeholder="Ej: Quincho del Bosque" class="form-input mt-1 w-full">
                                </div>
                                <div class="md:col-span-4">
                                    <label for="nuevo-componente-tipo" class="block text-xs font-medium text-gray-700 uppercase">Tipo de Espacio</label>
                                    <select id="nuevo-componente-tipo" class="form-select mt-1 w-full">
                                        <option value="">Cargando tipos...</option>
                                    </select>
                                </div>
                                <div class="md:col-span-3">
                                    <button type="button" id="agregar-componente-btn" class="btn-secondary w-full flex justify-center items-center gap-2">
                                        <span class="text-lg">+</span> Agregar
                                    </button>
                                </div>
                            </div>

                            <div class="mt-2 border-t border-indigo-100 pt-4" id="lista-componentes"></div>
                            
                            <div id="hint-tipos-vacios" class="hidden mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                ⚠️ No hay tipos de espacios definidos. Ve a "Configuración > Tipos de Componentes" para crearlos con IA.
                            </div>
                        </fieldset>

                        <fieldset class="border p-4 rounded-md mb-6">
                            <legend class="px-2 font-semibold text-gray-700">Sincronización iCal</legend>
                            <div id="ical-fields-container" class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4"></div>
                        </fieldset>
                        
                        <fieldset class="border p-4 rounded-md mb-6">
                            <legend class="px-2 font-semibold text-gray-700">Google Hotels & Web Pública</legend>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div><label class="block text-sm font-medium">ID Alojamiento (Único)</label><input type="text" id="googleHotelId" name="googleHotelId" class="form-input mt-1" placeholder="Ej: CAB_01"></div>
                                <div class="pt-6"><label class="flex items-center space-x-2 text-sm"><input type="checkbox" id="googleHotelIsListed" name="googleHotelIsListed" class="rounded border-gray-300"><span>Publicar en Google Hotels / Web</span></label></div>
                                <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div class="md:col-span-2"><label class="block text-sm font-medium">Dirección (Calle y N°)</label><input type="text" id="googleHotelStreet" name="googleHotelStreet" class="form-input mt-1"></div>
                                    <div><label class="block text-sm font-medium">Ciudad</label><input type="text" id="googleHotelCity" name="googleHotelCity" class="form-input mt-1"></div>
                                </div>
                                <input type="hidden" id="googleHotelCountry" value="CL">
                            </div>
                        </fieldset>

                    </form>
                </div>

                <div class="p-5 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button type="button" id="cancel-btn" class="btn-secondary">Cancelar</button>
                    <button type="submit" form="propiedad-form" class="btn-primary">Guardar Propiedad</button>
                </div>
            </div>
        </div>
    `;
};

// --- Gestión del Modal ---

export const abrirModalAlojamiento = async (propiedad = null, canales = []) => {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const modalTitle = document.getElementById('modal-title');
    const icalContainer = document.getElementById('ical-fields-container');
    const tipoSelect = document.getElementById('nuevo-componente-tipo');
    const hintVacios = document.getElementById('hint-tipos-vacios');
    
    canalesCache = canales; 

    if (!modal || !form) return;

    // 1. Cargar Tipos Dinámicos
    try {
        tiposComponenteCache = await fetchAPI('/componentes');
        
        if (tiposComponenteCache.length === 0) {
            tipoSelect.innerHTML = '<option value="">Sin tipos definidos</option>';
            tipoSelect.disabled = true;
            if(hintVacios) hintVacios.classList.remove('hidden');
        } else {
            tipoSelect.disabled = false;
            if(hintVacios) hintVacios.classList.add('hidden');
            tipoSelect.innerHTML = tiposComponenteCache.map(t => 
                `<option value="${t.id}">${t.icono || ''} ${t.nombreNormalizado}</option>`
            ).join('');
        }
    } catch (error) {
        console.error("Error cargando tipos:", error);
        tipoSelect.innerHTML = '<option value="">Error al cargar</option>';
    }

    // 2. Renderizar campos iCal
    icalContainer.innerHTML = canales
        .filter(canal => canal.nombre.toLowerCase() !== 'app')
        .map(canal => `
            <div>
                <label for="ical-${canal.id}" class="block text-sm font-medium text-gray-700">iCal ${canal.nombre}</label>
                <input type="url" id="ical-${canal.id}" data-canal-key="${canal.nombre.toLowerCase()}" class="form-input mt-1 ical-input text-xs">
            </div>
        `).join('');

    if (propiedad) {
        editandoPropiedad = propiedad;
        modalTitle.textContent = `Editar: ${propiedad.nombre}`;
        
        form.nombre.value = propiedad.nombre || '';
        form.numPiezas.value = propiedad.numPiezas || 0;
        form.numBanos.value = propiedad.numBanos || 0;
        form.descripcion.value = propiedad.descripcion || '';
        form.capacidad.value = propiedad.capacidad || 0;
        
        form.matrimoniales.value = propiedad.camas?.matrimoniales || 0;
        form.plazaYMedia.value = propiedad.camas?.plazaYMedia || 0;
        form.camarotes.value = propiedad.camas?.camarotes || 0;
        
        form.tinaja.checked = propiedad.equipamiento?.tinaja || false;
        form.parrilla.checked = propiedad.equipamiento?.parrilla || false;
        form.terrazaTechada.checked = propiedad.equipamiento?.terrazaTechada || false;
        form.juegoDeTerraza.checked = propiedad.equipamiento?.juegoDeTerraza || false;
        form.piezaEnSuite.checked = propiedad.equipamiento?.piezaEnSuite || false;
        form.dosPisos.checked = propiedad.equipamiento?.dosPisos || false;

        componentesTemporales = Array.isArray(propiedad.componentes) ? [...propiedad.componentes] : [];

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
        // País hardcodeado por ahora
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

// --- Configuración de Eventos ---

export const setupModalAlojamiento = (callback) => {
    onSaveCallback = callback;

    const form = document.getElementById('propiedad-form');
    if (!form) return;
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalAlojamiento);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalAlojamiento);

    const btnAgregar = document.getElementById('agregar-componente-btn');
    const newBtnAgregar = btnAgregar.cloneNode(true);
    btnAgregar.parentNode.replaceChild(newBtnAgregar, btnAgregar);
    newBtnAgregar.addEventListener('click', handleAgregarComponente);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const icalInputs = newForm.querySelectorAll('.ical-input');
        const sincronizacionIcal = {};
        icalInputs.forEach(input => {
            if (input.value) {
                sincronizacionIcal[input.dataset.canalKey.toLowerCase()] = input.value;
            }
        });

        const datos = {
            nombre: newForm.nombre.value,
            capacidad: parseInt(newForm.capacidad.value),
            numPiezas: parseInt(newForm.numPiezas.value) || 0,
            numBanos: parseInt(newForm.numBanos.value) || 0,
            descripcion: newForm.descripcion.value,
            camas: {
                matrimoniales: parseInt(newForm.matrimoniales.value) || 0,
                plazaYMedia: parseInt(newForm.plazaYMedia.value) || 0,
                camarotes: parseInt(newForm.camarotes.value) || 0,
            },
            equipamiento: {
                tinaja: newForm.tinaja.checked,
                parrilla: newForm.parrilla.checked,
                terrazaTechada: newForm.terrazaTechada.checked,
                juegoDeTerraza: newForm.juegoDeTerraza.checked,
                piezaEnSuite: newForm.piezaEnSuite.checked,
                dosPisos: newForm.dosPisos.checked,
            },
            componentes: componentesTemporales,
            sincronizacionIcal,
            googleHotelData: {
                hotelId: newForm.googleHotelId.value.trim(),
                isListed: newForm.googleHotelIsListed.checked,
                address: {
                    street: newForm.googleHotelStreet.value.trim(),
                    city: newForm.googleHotelCity.value.trim(),
                    countryCode: 'CL' // Hardcodeado por simplicidad momentánea
                }
            },
            websiteData: editandoPropiedad?.websiteData || { aiDescription: '', images: {}, cardImage: null }
        };

        // Validaciones mínimas
        if (datos.googleHotelData.isListed) {
            if (!datos.googleHotelData.hotelId || !datos.googleHotelData.address.street) {
                alert('Si publicas en Google Hotels, el ID y la Dirección son obligatorios.');
                return;
            }
        }

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