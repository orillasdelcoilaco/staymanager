// frontend/src/views/empresa.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let empresaInfo = {};

function renderFormulario() {
    const formContainer = document.getElementById('form-container');
    if (!formContainer) return;

    // --- Lógica para el estado de Google Auth ---
    const authStatusHtml = empresaInfo.googleRefreshToken
        ? `<div class="p-4 bg-green-100 border border-green-300 rounded-md">
               <p class="font-semibold text-green-800">Estado: Activa</p>
               <p class="text-sm text-green-700 mt-1">La sincronización con Google Contacts está configurada.</p>
           </div>`
        : `<div class="p-4 bg-yellow-100 border border-yellow-300 rounded-md">
               <p class="font-semibold text-yellow-800">Estado: Inactiva</p>
               <p class="text-sm text-yellow-700 mt-1">Autoriza la conexión en 'Configuración' para sincronizar contactos.</p>
           </div>`;

    formContainer.innerHTML = `
        <form id="empresa-form" class="space-y-6">
             <fieldset class="border p-4 rounded-md">
                <legend class="px-2 font-semibold text-gray-700">Información General y de Contacto</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                        <input type="text" id="nombre" name="nombre" value="${empresaInfo.nombre || ''}" class="mt-1 form-input">
                    </div>
                     <div>
                        <label for="contactoNombre" class="block text-sm font-medium text-gray-700">Nombre de Contacto (para presupuestos)</label>
                        <input type="text" id="contactoNombre" name="contactoNombre" value="${empresaInfo.contactoNombre || ''}" class="mt-1 form-input">
                    </div>
                    <div>
                        <label for="contactoEmail" class="block text-sm font-medium text-gray-700">Email de Contacto</label>
                        <input type="email" id="contactoEmail" name="contactoEmail" value="${empresaInfo.contactoEmail || ''}" class="mt-1 form-input">
                    </div>
                    <div>
                        <label for="contactoTelefono" class="block text-sm font-medium text-gray-700">Teléfono de Contacto</label>
                        <input type="tel" id="contactoTelefono" name="contactoTelefono" value="${empresaInfo.contactoTelefono || ''}" class="mt-1 form-input">
                    </div>
                    <div>
                        <label for="ubicacionTexto" class="block text-sm font-medium text-gray-700">Ubicación Principal (Ciudad, Región)</label>
                        <input type="text" id="ubicacionTexto" name="ubicacionTexto" value="${empresaInfo.ubicacionTexto || ''}" class="mt-1 form-input" placeholder="Ej: Pucón, Araucanía, Chile">
                    </div>
                    <div>
                        <label for="website" class="block text-sm font-medium text-gray-700">Sitio Web (Informativo)</label>
                        <input type="url" id="website" name="website" value="${empresaInfo.website || ''}" class="mt-1 form-input">
                    </div>
                     <div>
                        <label for="googleMapsLink" class="block text-sm font-medium text-gray-700">Link a Google Maps</label>
                        <input type="url" id="googleMapsLink" name="googleMapsLink" value="${empresaInfo.googleMapsLink || ''}" class="mt-1 form-input">
                    </div>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md bg-gray-50">
                <legend class="px-2 font-semibold text-gray-700">Logo de la Empresa</legend>
                <div class="flex items-center gap-6 mt-2">
                    <img src="${empresaInfo.websiteSettings?.theme?.logoUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='50' viewBox='0 0 100 50'%3E%3Crect width='100' height='50' fill='%23eee'/%3E%3Ctext x='50' y='25' font-family='Arial' font-size='12' fill='%23aaa' text-anchor='middle' dy='.3em'%3ESin Logo%3C/text%3E%3C/svg%3E"}" 
                         alt="Logo actual" 
                         class="h-16 w-auto max-w-[200px] object-contain bg-white rounded border p-2">
                    
                    <div>
                        <p class="text-sm text-gray-600 mb-2">El logo se gestiona ahora desde la configuración del Sitio Web.</p>
                        <button type="button" id="btn-ir-website" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline">
                            Ir a Configuración de Sitio Web &rarr;
                        </button>
                    </div>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md">
                <legend class="px-2 font-semibold text-gray-700">Contenido para Presupuestos</legend>
                <div class="space-y-4 mt-4">
                    <div>
                        <label for="serviciosGenerales" class="block text-sm font-medium text-gray-700">Servicios Generales Incluidos</label>
                        <textarea id="serviciosGenerales" name="serviciosGenerales" rows="4" class="mt-1 form-input">${empresaInfo.serviciosGenerales || ''}</textarea>
                    </div>
                    <div>
                        <label for="condicionesReserva" class="block text-sm font-medium text-gray-700">Condiciones de Reserva</label>
                        <textarea id="condicionesReserva" name="condicionesReserva" rows="4" class="mt-1 form-input">${empresaInfo.condicionesReserva || ''}</textarea>
                    </div>
                </div>
            </fieldset>

            <div class="border-t pt-6">
                <h3 class="text-base font-semibold text-gray-800 mb-2">Sincronización con Google Contacts</h3>
                ${authStatusHtml}
            </div>

            <div class="flex justify-end pt-6 border-t">
                <button type="submit" class="btn-primary">Guardar Cambios</button>
            </div>
        </form>
    `;
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Configuración de la Empresa</h2>
            <p class="text-gray-600 mb-6">Esta información se usará para personalizar los presupuestos, documentos y datos de contacto.</p>

            <div id="form-container" class="border-t pt-6">
                <p class="text-center text-gray-500">Cargando datos de la empresa...</p>
            </div>
        </div>
    `;
}

export async function afterRender() {
    try {
        empresaInfo = await fetchAPI('/empresa');
        renderFormulario();

        // Listener para redirección
        const btnIrWeb = document.getElementById('btn-ir-website');
        if (btnIrWeb) {
            btnIrWeb.addEventListener('click', () => handleNavigation('/website-general'));
        }

        // --- Listener para el formulario principal (guardar datos de texto) ---
        const form = document.getElementById('empresa-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Guardando...';

                const datos = {
                    nombre: form.nombre.value,
                    contactoNombre: form.contactoNombre.value,
                    contactoEmail: form.contactoEmail.value,
                    contactoTelefono: form.contactoTelefono.value,
                    website: form.website.value,
                    serviciosGenerales: form.serviciosGenerales.value,
                    condicionesReserva: form.condicionesReserva.value,
                    ubicacionTexto: form.ubicacionTexto.value,
                    googleMapsLink: form.googleMapsLink.value,

                    // Preservamos websiteSettings sin tocarlo desde aquí
                    websiteSettings: empresaInfo.websiteSettings || {}
                };

                try {
                    await fetchAPI('/empresa', { method: 'PUT', body: datos });

                    alert('¡Datos de la empresa actualizados con éxito!');
                    empresaInfo = await fetchAPI('/empresa');
                    renderFormulario();

                } catch (error) {
                    alert(`Error al guardar: ${error.message}`);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Guardar Cambios';
                }
            });
        }

    } catch (error) {
        const container = document.getElementById('form-container');
        if (container) container.innerHTML = `<p class="text-red-500">Error al cargar la información: ${error.message}</p>`;
    }
}