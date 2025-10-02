import { fetchAPI } from '../api.js';

let empresaInfo = {};

function renderFormulario() {
    const formContainer = document.getElementById('form-container');
    if (!formContainer) return;

    formContainer.innerHTML = `
        <form id="empresa-form" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                    <input type="text" id="nombre" name="nombre" value="${empresaInfo.nombre || ''}" class="mt-1 form-input">
                </div>
                <div>
                    <label for="slogan" class="block text-sm font-medium text-gray-700">Slogan o Bajada de Título</label>
                    <input type="text" id="slogan" name="slogan" value="${empresaInfo.slogan || ''}" class="mt-1 form-input">
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
                    <label for="website" class="block text-sm font-medium text-gray-700">Sitio Web</label>
                    <input type="url" id="website" name="website" value="${empresaInfo.website || ''}" class="mt-1 form-input">
                </div>
            </div>
            
            <div class="border-t pt-6">
                <label for="serviciosGenerales" class="block text-sm font-medium text-gray-700">Servicios Generales Incluidos (para presupuestos)</label>
                <textarea id="serviciosGenerales" name="serviciosGenerales" rows="4" class="mt-1 form-input">${empresaInfo.serviciosGenerales || ''}</textarea>
            </div>
            <div>
                <label for="condicionesReserva" class="block text-sm font-medium text-gray-700">Condiciones de Reserva (para presupuestos)</label>
                <textarea id="condicionesReserva" name="condicionesReserva" rows="4" class="mt-1 form-input">${empresaInfo.condicionesReserva || ''}</textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label for="ubicacionTexto" class="block text-sm font-medium text-gray-700">Texto de Ubicación</label>
                    <input type="text" id="ubicacionTexto" name="ubicacionTexto" value="${empresaInfo.ubicacionTexto || ''}" class="mt-1 form-input">
                </div>
                <div>
                    <label for="googleMapsLink" class="block text-sm font-medium text-gray-700">Link a Google Maps</label>
                    <input type="url" id="googleMapsLink" name="googleMapsLink" value="${empresaInfo.googleMapsLink || ''}" class="mt-1 form-input">
                </div>
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
            <p class="text-gray-600 mb-6">Esta información se usará para personalizar los presupuestos y otros documentos.</p>
            
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

        const form = document.getElementById('empresa-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            const datos = {
                nombre: form.nombre.value,
                slogan: form.slogan.value,
                contactoNombre: form.contactoNombre.value,
                contactoEmail: form.contactoEmail.value,
                contactoTelefono: form.contactoTelefono.value,
                website: form.website.value,
                serviciosGenerales: form.serviciosGenerales.value,
                condicionesReserva: form.condicionesReserva.value,
                ubicacionTexto: form.ubicacionTexto.value,
                googleMapsLink: form.googleMapsLink.value
            };

            try {
                await fetchAPI('/empresa', { method: 'PUT', body: datos });
                alert('¡Datos de la empresa actualizados con éxito!');
                empresaInfo = datos; // Actualizamos la data local
            } catch (error) {
                alert(`Error al guardar: ${error.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Cambios';
            }
        });

    } catch (error) {
        document.getElementById('form-container').innerHTML = `<p class="text-red-500">Error al cargar la información: ${error.message}</p>`;
    }
}