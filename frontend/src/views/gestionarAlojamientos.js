// frontend/src/views/gestionarAlojamientos.js
import { fetchAPI } from '../api.js';

let propiedades = [];
let canales = [];
let editandoPropiedad = null;
let componentesTemporales = []; // Para manejar la edición de componentes en el modal

// --- Funciones para gestionar componentes en el modal ---
function generarIdComponente(nombre) {
    const nombreNormalizado = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${nombreNormalizado}-${Date.now().toString(36)}`;
}

function renderizarListaComponentes() {
    const container = document.getElementById('lista-componentes');
    if (!container) return;
    container.innerHTML = componentesTemporales.map((comp, index) => `
        <div class="flex items-center justify-between p-2 border rounded bg-gray-50">
            <span class="text-sm font-medium">${comp.nombre} (Tipo: ${comp.tipo})</span>
            <button type="button" data-index="${index}" class="eliminar-componente-btn text-red-500 hover:text-red-700 text-xs">Eliminar</button>
        </div>
    `).join('');

    // Añadir event listeners a los nuevos botones
    container.querySelectorAll('.eliminar-componente-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            componentesTemporales.splice(index, 1);
            renderizarListaComponentes(); // Volver a renderizar la lista actualizada
        });
    });
}

function agregarComponente() {
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
        nombreInput.value = ''; // Limpiar input
        tipoSelect.value = 'Dormitorio'; // Resetear select
        renderizarListaComponentes(); // Actualizar la lista visual
    } else {
        alert('Por favor, ingresa un nombre y selecciona un tipo para el componente.');
    }
}
// --- Fin funciones componentes ---

function abrirModal(propiedad = null) {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const modalTitle = document.getElementById('modal-title');
    const icalContainer = document.getElementById('ical-fields-container');

    // Generar campos de iCal dinámicamente
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
        form.nombre.value = propiedad.nombre || '';
        form.linkFotos.value = propiedad.linkFotos || '';
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

        // Cargar componentes existentes en la variable temporal
        componentesTemporales = Array.isArray(propiedad.componentes) ? [...propiedad.componentes] : [];

        // Poblar los campos de iCal dinámicos
        icalContainer.querySelectorAll('.ical-input').forEach(input => {
            const canalKey = input.dataset.canalKey;
            if (propiedad.sincronizacionIcal && propiedad.sincronizacionIcal[canalKey]) {
                input.value = propiedad.sincronizacionIcal[canalKey];
            } else {
                input.value = '';
            }
        });

        // Cargar datos de Google Hotels
        form.googleHotelId.value = propiedad.googleHotelData?.hotelId || '';
        form.googleHotelIsListed.checked = propiedad.googleHotelData?.isListed || false;
        form.googleHotelStreet.value = propiedad.googleHotelData?.address?.street || '';
        form.googleHotelCity.value = propiedad.googleHotelData?.address?.city || '';
        form.googleHotelCountry.value = propiedad.googleHotelData?.address?.countryCode || 'CL';


    } else {
        editandoPropiedad = null;
        modalTitle.textContent = 'Nuevo Alojamiento';
        form.reset();
        componentesTemporales = []; // Resetear componentes temporales
        form.googleHotelCountry.value = 'CL';
        icalContainer.querySelectorAll('.ical-input').forEach(input => input.value = '');
    }

    renderizarListaComponentes(); // Renderizar componentes al abrir
    modal.classList.remove('hidden');
}


function cerrarModal() {
    const modal = document.getElementById('propiedad-modal');
    modal.classList.add('hidden');
    editandoPropiedad = null;
    componentesTemporales = []; // Limpiar al cerrar
}

function renderTabla() {
    const tbody = document.getElementById('propiedades-tbody');
    if (!tbody) return;

    if (propiedades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay alojamientos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = propiedades.map((p, index) => `
        <tr class="border-b">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-mono text-xs text-gray-600">${p.id}</td>
            <td class="py-3 px-4 font-medium text-gray-800">${p.nombre}</td>
            <td class="py-3 px-4 text-center">${p.capacidad}</td>
            <td class="py-3 px-4 text-center">${p.numPiezas || 0}</td>
            <td class="py-3 px-4 text-center">${p.numBanos || 0}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${p.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
}


export async function render() {
    try {
        [propiedades, canales] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    // Opciones para el tipo de componente
    const tiposComponente = ['Dormitorio', 'Baño', 'Cocina', 'Living', 'Comedor', 'Terraza', 'Exterior', 'Tina', 'Otro'];
    const opcionesTipoComponente = tiposComponente.map(tipo => `<option value="${tipo}">${tipo}</option>`).join('');

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Alojamientos</h2>
                <button id="add-propiedad-btn" class="btn-primary">
                    + Nuevo Alojamiento
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">ID Propiedad</th>
                            <th class="th">Nombre</th>
                            <th class="th text-center">Capacidad</th>
                            <th class="th text-center">Nº Piezas</th>
                            <th class="th text-center">Nº Baños</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="propiedades-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="propiedad-modal" class="modal hidden">
            <div class="modal-content !max-w-4xl max-h-[90vh] overflow-y-auto pr-4"> {/* Añadido pr-4 */}
                <div class="flex justify-between items-center pb-3 border-b mb-4">
                    <h3 id="modal-title" class="text-xl font-semibold"></h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <form id="propiedad-form">
                    {/* Campos Generales */}
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Información General</legend>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Alojamiento</label>
                                <input type="text" id="nombre" name="nombre" required class="form-input mt-1">
                            </div>
                            <div>
                                <label for="linkFotos" class="block text-sm font-medium text-gray-700">Link a Foto Principal</label>
                                <input type="url" id="linkFotos" name="linkFotos" class="form-input mt-1">
                            </div>
                            <div>
                                <label for="numPiezas" class="block text-sm font-medium text-gray-700">Nº Piezas</label>
                                <input type="number" id="numPiezas" name="numPiezas" class="form-input mt-1">
                            </div>
                            <div>
                                <label for="numBanos" class="block text-sm font-medium text-gray-700">Nº Baños</label>
                                <input type="number" id="numBanos" name="numBanos" class="form-input mt-1">
                            </div>
                        </div>
                    </fieldset>
                    {/* Camas y capacidad */}
                    <fieldset class="border p-4 rounded-md mb-6">
                         <legend class="px-2 font-semibold text-gray-700">Distribución y Capacidad</legend>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
                            <div>
                                <label for="matrimoniales" class="block text-sm font-medium text-gray-700">Matrimoniales</label>
                                <input type="number" id="matrimoniales" name="matrimoniales" class="form-input mt-1">
                            </div>
                            <div>
                                <label for="plazaYMedia" class="block text-sm font-medium text-gray-700">1.5 Plazas</label>
                                <input type="number" id="plazaYMedia" name="plazaYMedia" class="form-input mt-1">
                            </div>
                             <div>
                                <label for="camarotes" class="block text-sm font-medium text-gray-700">Camarotes</label>
                                <input type="number" id="camarotes" name="camarotes" class="form-input mt-1">
                            </div>
                            <div>
                                <label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad Calculada</label>
                                <input type="number" id="capacidad" name="capacidad" required class="form-input mt-1">
                            </div>
                        </div>
                    </fieldset>
                    {/* Descripcion */}
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Descripción</legend>
                        <div class="mt-4">
                            <textarea id="descripcion" name="descripcion" rows="6" class="form-input w-full" style="min-height: 150px;"></textarea>
                        </div>
                    </fieldset>
                    {/* Equipamiento */}
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Equipamiento</legend>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            ${checkbox('tinaja', 'Tinaja')}
                            ${checkbox('parrilla', 'Parrilla')}
                            ${checkbox('terrazaTechada', 'Terraza Techada')}
                            ${checkbox('juegoDeTerraza', 'Juego de Terraza')}
                            ${checkbox('piezaEnSuite', 'Pieza en Suite')}
                            ${checkbox('dosPisos', 'Dos Pisos')}
                        </div>
                    </fieldset>
                    {/* Componentes */}
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Componentes del Alojamiento</legend>
                        <div class="mt-4 space-y-3" id="lista-componentes">
                            {/* La lista de componentes se renderizará aquí */}
                        </div>
                        <div class="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div class="md:col-span-1">
                                <label for="nuevo-componente-nombre" class="block text-sm font-medium">Nombre Componente</label>
                                <input type="text" id="nuevo-componente-nombre" placeholder="Ej: Dormitorio Principal" class="form-input mt-1">
                            </div>
                             <div class="md:col-span-1">
                                <label for="nuevo-componente-tipo" class="block text-sm font-medium">Tipo</label>
                                <select id="nuevo-componente-tipo" class="form-select mt-1">
                                    ${opcionesTipoComponente}
                                </select>
                            </div>
                            <div class="md:col-span-1">
                                <button type="button" id="agregar-componente-btn" class="btn-secondary w-full">Agregar Componente</button>
                            </div>
                        </div>
                    </fieldset>
                    {/* Sincronizacion Ical */}
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Sincronización iCal (Importar)</legend>
                        <div id="ical-fields-container" class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                           {/* Los campos de iCal se insertarán aquí dinámicamente */}
                        </div>
                    </fieldset>
                    {/* Integracion Google Hotels */}
                    <fieldset class="border p-4 rounded-md mb-6">
                        <legend class="px-2 font-semibold text-gray-700">Integración con Google Hotels</legend>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label for="googleHotelId" class="block text-sm font-medium">ID del Hotel (Único)</label>
                                <input type="text" id="googleHotelId" name="googleHotelId" class="form-input mt-1" placeholder="Ej: PROPIEDAD_01">
                            </div>
                            <div>
                                <label for="googleHotelIsListed" class="flex items-center pt-6 space-x-2 text-sm">
                                    <input type="checkbox" id="googleHotelIsListed" name="googleHotelIsListed" class="rounded border-gray-300">
                                    <span>Listar esta propiedad en Google Hotels</span>
                                </label>
                            </div>
                            <div>
                                <label for="googleHotelStreet" class="block text-sm font-medium">Dirección (Calle y Número)</label>
                                <input type="text" id="googleHotelStreet" name="googleHotelStreet" class="form-input mt-1">
                            </div>
                            <div>
                                <label for="googleHotelCity" class="block text-sm font-medium">Ciudad</label>
                                <input type="text" id="googleHotelCity" name="googleHotelCity" class="form-input mt-1">
                            </div>
                            <div>
                                <label for="googleHotelCountry" class="block text-sm font-medium">País (Código 2 letras)</label>
                                <input type="text" id="googleHotelCountry" name="googleHotelCountry" class="form-input mt-1" value="CL" maxlength="2">
                            </div>
                        </div>
                    </fieldset>
                    {/* Botones */}
                    <div class="flex justify-end pt-6 border-t mt-6">
                        <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function checkbox(id, label) {
    return `
        <label for="${id}" class="flex items-center space-x-2 text-sm">
            <input type="checkbox" id="${id}" name="${id}" class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
            <span>${label}</span>
        </label>
    `;
}

export function afterRender() {
    renderTabla();

    const form = document.getElementById('propiedad-form');
    const tbody = document.getElementById('propiedades-tbody');

    document.getElementById('add-propiedad-btn').addEventListener('click', () => abrirModal());
    document.getElementById('close-modal-btn').addEventListener('click', cerrarModal);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);
    document.getElementById('agregar-componente-btn').addEventListener('click', agregarComponente);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const icalInputs = form.querySelectorAll('.ical-input');
        const sincronizacionIcal = {};
        icalInputs.forEach(input => {
            if (input.value) {
                sincronizacionIcal[input.dataset.canalKey] = input.value;
            }
        });

        const datos = {
            nombre: form.nombre.value,
            capacidad: parseInt(form.capacidad.value),
            linkFotos: form.linkFotos.value,
            numPiezas: parseInt(form.numPiezas.value) || 0,
            numBanos: parseInt(form.numBanos.value) || 0,
            descripcion: form.descripcion.value,
            camas: {
                matrimoniales: parseInt(form.matrimoniales.value) || 0,
                plazaYMedia: parseInt(form.plazaYMedia.value) || 0,
                camarotes: parseInt(form.camarotes.value) || 0,
            },
            equipamiento: {
                tinaja: form.tinaja.checked,
                parrilla: form.parrilla.checked,
                terrazaTechada: form.terrazaTechada.checked,
                juegoDeTerraza: form.juegoDeTerraza.checked,
                piezaEnSuite: form.piezaEnSuite.checked,
                dosPisos: form.dosPisos.checked,
            },
            componentes: componentesTemporales, // Usar la lista temporal
            sincronizacionIcal,
            googleHotelData: {
                hotelId: form.googleHotelId.value.trim(),
                isListed: form.googleHotelIsListed.checked,
                address: {
                    street: form.googleHotelStreet.value.trim(),
                    city: form.googleHotelCity.value.trim(),
                    countryCode: form.googleHotelCountry.value.trim().toUpperCase()
                }
            }
        };

        if (datos.googleHotelData.isListed && !datos.googleHotelData.hotelId) {
            alert('El "ID del Hotel (Único)" es obligatorio si marcas "Listar esta propiedad en Google Hotels".');
            return;
        }
         if (datos.googleHotelData.isListed && (!datos.googleHotelData.address.street || !datos.googleHotelData.address.city || !datos.googleHotelData.address.countryCode)) {
            alert('La Dirección completa (Calle, Ciudad, País) es obligatoria si marcas "Listar esta propiedad en Google Hotels".');
            return;
        }


        try {
            const endpoint = editandoPropiedad ? `/propiedades/${editandoPropiedad.id}` : '/propiedades';
            const method = editandoPropiedad ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });

            propiedades = await fetchAPI('/propiedades'); // Recargar la lista
            renderTabla(); // Actualizar la tabla
            cerrarModal(); // Cerrar el modal
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target.classList.contains('edit-btn') && !target.classList.contains('delete-btn')) return;

        const id = target.dataset.id;
        if (target.classList.contains('edit-btn')) {
            const propiedadAEditar = propiedades.find(p => p.id === id);
            if (propiedadAEditar) abrirModal(propiedadAEditar);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este alojamiento?')) {
                try {
                    await fetchAPI(`/propiedades/${id}`, { method: 'DELETE' });
                    propiedades = await fetchAPI('/propiedades'); // Recargar la lista
                    renderTabla(); // Actualizar la tabla
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}