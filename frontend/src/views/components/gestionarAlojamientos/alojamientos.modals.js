// frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js
import { fetchAPI } from '../../../api.js';
import { generarIdComponente, renderCheckbox } from './alojamientos.utils.js';

let onSaveCallback = null;
let editandoPropiedad = null;
let componentesTemporales = [];
let canalesCache = []; // Necesitamos los canales para los campos iCal

// --- Lógica Interna de Componentes ---

function renderizarListaComponentes() {
    const container = document.getElementById('lista-componentes');
    if (!container) return;
    
    container.innerHTML = componentesTemporales.map((comp, index) => `
        <div class="flex items-center justify-between p-2 border rounded bg-gray-50">
            <span class="text-sm font-medium">${comp.nombre} (Tipo: ${comp.tipo})</span>
            <button type="button" data-index="${index}" class="eliminar-componente-btn text-red-500 hover:text-red-700 text-xs">Eliminar</button>
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
    const tipo = tipoSelect.value;

    if (nombre && tipo) {
        componentesTemporales.push({
            id: generarIdComponente(nombre),
            nombre: nombre,
            tipo: tipo
        });
        nombreInput.value = '';
        tipoSelect.value = 'Dormitorio';
        renderizarListaComponentes();
    } else {
        alert('Por favor, ingresa un nombre y selecciona un tipo para el componente.');
    }
}

// --- Renderizado del Modal ---

export const renderModalAlojamiento = () => {
    const tiposComponente = ['Dormitorio', 'Baño', 'Cocina', 'Living', 'Comedor', 'Terraza', 'Tina', 'Otro'];
    const opcionesTipo = tiposComponente.map(t => `<option value="${t}">${t}</option>`).join('');

    return `
        <div id="propiedad-modal" class="modal hidden">
             <div class="modal-content !max-w-4xl max-h-[90vh] overflow-y-auto pr-4">
                 <div class="flex justify-between items-center pb-3 border-b mb-4">
                    <h3 id="modal-title" class="text-xl font-semibold"></h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
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
                            <div><label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad Calculada</label><input type="number" id="capacidad" name="capacidad" required class="form-input mt-1"></div>
                        </div>
                    </fieldset>
                    
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Descripción</legend>
                        <div class="mt-4"><textarea id="descripcion" name="descripcion" rows="6" class="form-input w-full" style="min-height: 150px;"></textarea></div>
                    </fieldset>
                    
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Equipamiento</legend>
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                            ${renderCheckbox('tinaja', 'Tinaja')} ${renderCheckbox('parrilla', 'Parrilla')} ${renderCheckbox('terrazaTechada', 'Terraza Techada')}
                            ${renderCheckbox('juegoDeTerraza', 'Juego de Terraza')} ${renderCheckbox('piezaEnSuite', 'Pieza en Suite')} ${renderCheckbox('dosPisos', 'Dos Pisos')}
                        </div>
                    </fieldset>

                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Componentes Adicionales</legend>
                        <p class="text-xs text-gray-500 mt-1 mb-3">Define partes adicionales (dormitorios, baños, etc.) para subir fotos específicas en "Configurar Web Pública". La imagen principal se gestiona allí.</p>
                        <div class="mt-4 space-y-3 max-h-48 overflow-y-auto border-b pb-4 mb-4" id="lista-componentes"></div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div class="md:col-span-1"><label for="nuevo-componente-nombre" class="block text-sm font-medium">Nombre Componente</label><input type="text" id="nuevo-componente-nombre" placeholder="Ej: Baño Principal" class="form-input mt-1"></div>
                            <div class="md:col-span-1"><label for="nuevo-componente-tipo" class="block text-sm font-medium">Tipo</label><select id="nuevo-componente-tipo" class="form-select mt-1">${opcionesTipo}</select></div>
                            <div class="md:col-span-1"><button type="button" id="agregar-componente-btn" class="btn-secondary w-full">Agregar Componente</button></div>
                        </div>
                    </fieldset>

                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Sincronización iCal (Importar)</legend>
                        <div id="ical-fields-container" class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4"></div>
                    </fieldset>
                    
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Integración Web Pública y Google Hotels</legend>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div><label for="googleHotelId" class="block text-sm font-medium">ID del Alojamiento (Único)</label><input type="text" id="googleHotelId" name="googleHotelId" class="form-input mt-1" placeholder="Ej: PROPIEDAD_01"></div>
                            <div class="pt-6"><label for="googleHotelIsListed" class="flex items-center space-x-2 text-sm"><input type="checkbox" id="googleHotelIsListed" name="googleHotelIsListed" class="rounded border-gray-300"><span>Listar esta propiedad en Google Hotels y Web Pública</span></label><p id="listado-warning" class="text-xs text-amber-600 mt-1 hidden">Recuerda subir la "Imagen Principal (Tarjeta/Home)" en 'Configurar Web Pública'.</p></div>
                            <div><label for="googleHotelStreet" class="block text-sm font-medium">Dirección (Calle y Número)</label><input type="text" id="googleHotelStreet" name="googleHotelStreet" class="form-input mt-1"></div>
                            <div><label for="googleHotelCity" class="block text-sm font-medium">Ciudad</label><input type="text" id="googleHotelCity" name="googleHotelCity" class="form-input mt-1"></div>
                            <div><label for="googleHotelCountry" class="block text-sm font-medium">País (Código 2 letras)</label><input type="text" id="googleHotelCountry" name="googleHotelCountry" class="form-input mt-1" value="CL" maxlength="2"></div>
                        </div>
                    </fieldset>

                    <div class="flex justify-end pt-6 border-t mt-6">
                        <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

// --- Gestión del Modal ---

export const abrirModalAlojamiento = (propiedad = null, canales = []) => {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const modalTitle = document.getElementById('modal-title');
    const icalContainer = document.getElementById('ical-fields-container');
    
    // Guardamos canales en caché para usarlos al guardar
    canalesCache = canales; 

    if (!modal || !form) return;

    // Renderizar campos iCal dinámicos
    icalContainer.innerHTML = canales
        .filter(canal => canal.nombre.toLowerCase() !== 'app')
        .map(canal => `
            <div>
                <label for="ical-${canal.id}" class="block text-sm font-medium text-gray-700">URL iCal de ${canal.nombre}</label>
                <input type="url" id="ical-${canal.id}" data-canal-key="${canal.nombre.toLowerCase()}" class="form-input mt-1 ical-input">
            </div>
        `).join('');

    if (propiedad) {
        editandoPropiedad = propiedad;
        modalTitle.textContent = `Editar Alojamiento: ${propiedad.nombre}`;
        
        // Rellenar formulario
        form.nombre.value = propiedad.nombre || '';
        form.numPiezas.value = propiedad.numPiezas || 0;
        form.numBanos.value = propiedad.numBanos || 0;
        form.descripcion.value = propiedad.descripcion || '';
        form.capacidad.value = propiedad.capacidad || 0;
        
        // Camas
        form.matrimoniales.value = propiedad.camas?.matrimoniales || 0;
        form.plazaYMedia.value = propiedad.camas?.plazaYMedia || 0;
        form.camarotes.value = propiedad.camas?.camarotes || 0;
        
        // Equipamiento
        form.tinaja.checked = propiedad.equipamiento?.tinaja || false;
        form.parrilla.checked = propiedad.equipamiento?.parrilla || false;
        form.terrazaTechada.checked = propiedad.equipamiento?.terrazaTechada || false;
        form.juegoDeTerraza.checked = propiedad.equipamiento?.juegoDeTerraza || false;
        form.piezaEnSuite.checked = propiedad.equipamiento?.piezaEnSuite || false;
        form.dosPisos.checked = propiedad.equipamiento?.dosPisos || false;

        // Componentes
        componentesTemporales = Array.isArray(propiedad.componentes) ? [...propiedad.componentes] : [];

        // iCal
        icalContainer.querySelectorAll('.ical-input').forEach(input => {
            const canalKey = input.dataset.canalKey;
            if (propiedad.sincronizacionIcal && propiedad.sincronizacionIcal[canalKey]) {
                input.value = propiedad.sincronizacionIcal[canalKey];
            } else {
                input.value = '';
            }
        });

        // Google Hotels
        form.googleHotelId.value = propiedad.googleHotelData?.hotelId || '';
        form.googleHotelIsListed.checked = propiedad.googleHotelData?.isListed || false;
        form.googleHotelStreet.value = propiedad.googleHotelData?.address?.street || '';
        form.googleHotelCity.value = propiedad.googleHotelData?.address?.city || '';
        form.googleHotelCountry.value = propiedad.googleHotelData?.address?.countryCode || 'CL';

    } else {
        editandoPropiedad = null;
        modalTitle.textContent = 'Nuevo Alojamiento';
        form.reset();
        componentesTemporales = [];
        form.googleHotelCountry.value = 'CL';
        icalContainer.querySelectorAll('.ical-input').forEach(input => input.value = '');
    }

    renderizarListaComponentes();
    
    // Manejo visual del warning
    const isListedCheckbox = document.getElementById('googleHotelIsListed');
    const warningElement = document.getElementById('listado-warning');
    if (warningElement) {
        warningElement.classList.toggle('hidden', !isListedCheckbox.checked);
    }

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

    // Clonar para limpiar eventos previos
    const form = document.getElementById('propiedad-form');
    if (!form) return;
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Listeners de cierre
    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalAlojamiento);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalAlojamiento);

    // Listener de componentes
    const btnAgregar = document.getElementById('agregar-componente-btn');
    // Removemos listener previo si existe (truco simple: clonar el botón también)
    const newBtnAgregar = btnAgregar.cloneNode(true);
    btnAgregar.parentNode.replaceChild(newBtnAgregar, btnAgregar);
    newBtnAgregar.addEventListener('click', handleAgregarComponente);

    // Listener del Checkbox Google
    const isListedCheckbox = document.getElementById('googleHotelIsListed');
    const warningElement = document.getElementById('listado-warning');
    if (isListedCheckbox && warningElement) {
        isListedCheckbox.addEventListener('change', () => {
             warningElement.classList.toggle('hidden', !isListedCheckbox.checked);
        });
    }

    // Listener de Submit
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
                    countryCode: newForm.googleHotelCountry.value.trim().toUpperCase()
                }
            },
            // IMPORTANTE: Preservar websiteData existente para no romper la web pública
            websiteData: editandoPropiedad?.websiteData || { aiDescription: '', images: {}, cardImage: null }
        };

        // Validaciones
        if (datos.googleHotelData.isListed) {
            if (!datos.googleHotelData.hotelId) {
                alert('El "ID del Alojamiento (Único)" es obligatorio si marcas "Listar esta propiedad...".');
                return;
            }
            if (!datos.googleHotelData.address.street || !datos.googleHotelData.address.city || !datos.googleHotelData.address.countryCode) {
                alert('La Dirección completa es obligatoria si marcas "Listar esta propiedad...".');
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