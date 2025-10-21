// frontend/src/views/empresa.js
import { fetchAPI } from '../api.js';

let empresaInfo = {};

// Esta función se moverá dentro de afterRender para que tenga acceso a empresaInfo
async function handleSubirLogo(file) {
    const statusDiv = document.getElementById('logo-upload-status');
    const previewImg = document.getElementById('logo-preview');
    statusDiv.textContent = 'Subiendo logo...';
    statusDiv.className = 'text-xs mt-1 text-blue-600';

    const formData = new FormData();
    // 'logoFile' debe coincidir con upload.single('logoFile') en el backend
    formData.append('logoFile', file); 

    try {
        // Llamar al nuevo endpoint
        const resultado = await fetchAPI('/empresa/upload-logo', {
            method: 'POST',
            body: formData 
        });

        // Actualizar el estado local
        if (!empresaInfo.websiteSettings) empresaInfo.websiteSettings = { theme: {} };
        if (!empresaInfo.websiteSettings.theme) empresaInfo.websiteSettings.theme = {};
        empresaInfo.websiteSettings.theme.logoUrl = resultado.logoUrl;

        // Actualizar la UI
        previewImg.src = resultado.logoUrl;
        statusDiv.textContent = '¡Logo actualizado!';
        statusDiv.className = 'text-xs mt-1 text-green-600';

    } catch (error) {
        statusDiv.textContent = `Error al subir: ${error.message}`;
        statusDiv.className = 'text-xs mt-1 text-red-600';
    } finally {
        // Limpiar el input de archivo
        document.getElementById('logoFile').value = ''; 
    }
}


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

    // Opciones para Enfoque de Marketing
    const enfoquesMarketing = ['Familiar', 'Parejas', 'Negocios', 'Aventura', 'Relax', 'Económico', 'Lujo', 'Otro'];
    const enfoqueOptions = enfoquesMarketing.map(e =>
        `<option value="${e}" ${empresaInfo.enfoqueMarketing === e ? 'selected' : ''}>${e}</option>`
    ).join('');

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
                        <label for="ubicacionTexto" class="block text-sm font-medium text-gray-700">Ubicación Principal (Ciudad, Región)</label>
                        <input type="text" id="ubicacionTexto" name="ubicacionTexto" value="${empresaInfo.ubicacionTexto || ''}" class="mt-1 form-input" placeholder="Ej: Pucón, Araucanía, Chile">
                    </div>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md">
                <legend class="px-2 font-semibold text-gray-700">Información para IA y SEO</legend>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <div>
                        <label for="tipoAlojamientoPrincipal" class="block text-sm font-medium text-gray-700">Tipo Principal Alojamiento</label>
                        <input type="text" id="tipoAlojamientoPrincipal" name="tipoAlojamientoPrincipal" value="${empresaInfo.tipoAlojamientoPrincipal || ''}" class="mt-1 form-input" placeholder="Ej: Cabañas con tinaja">
                    </div>
                    <div>
                        <label for="enfoqueMarketing" class="block text-sm font-medium text-gray-700">Enfoque de Marketing</label>
                        <select id="enfoqueMarketing" name="enfoqueMarketing" class="mt-1 form-select">
                            <option value="">-- Selecciona --</option>
                            ${enfoqueOptions}
                        </select>
                    </div>
                    <div class="md:col-span-3">
                        <label for="palabrasClaveAdicionales" class="block text-sm font-medium text-gray-700">Palabras Clave Adicionales (separadas por coma)</label>
                        <input type="text" id="palabrasClaveAdicionales" name="palabrasClaveAdicionales" value="${empresaInfo.palabrasClaveAdicionales || ''}" class="mt-1 form-input" placeholder="Ej: turismo aventura, cerca del lago, pet friendly">
                    </div>
                </div>
            </fieldset>

             <fieldset class="border p-4 rounded-md">
                <legend class="px-2 font-semibold text-gray-700">Configuración Sitio Web Público</legend>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <label for="websiteDomain" class="block text-sm font-medium text-gray-700">Dominio Principal</label>
                        <input type="text" id="websiteDomain" name="websiteDomain" value="${empresaInfo.websiteSettings?.domain || ''}" class="mt-1 form-input" placeholder="www.miempresa.com">
                    </div>
                    <div>
                        <label for="websiteSubdomain" class="block text-sm font-medium text-gray-700">Subdominio (para pruebas)</label>
                        <div class="flex items-center">
                            <input type="text" id="websiteSubdomain" name="websiteSubdomain" value="${empresaInfo.websiteSettings?.subdomain || ''}" class="mt-1 form-input rounded-r-none" placeholder="miempresa">
                            <span class="inline-flex items-center px-3 mt-1 text-sm text-gray-500 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md h-10">.onrender.com</span>
                        </div>
                    </div>
                    <div>
                        <label for="website" class="block text-sm font-medium text-gray-700">Sitio Web (Informativo)</label>
                        <input type="url" id="website" name="website" value="${empresaInfo.website || ''}" class="mt-1 form-input">
                    </div>
                     <div>
                        <label for="googleMapsLink" class="block text-sm font-medium text-gray-700">Link a Google Maps</label>
                        <input type="url" id="googleMapsLink" name="googleMapsLink" value="${empresaInfo.googleMapsLink || ''}" class="mt-1 form-input">
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Logo de la Empresa</label>
                        <div class="mt-2 flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                             <img id="logo-preview" 
                                 src="${empresaInfo.websiteSettings?.theme?.logoUrl || 'https://via.placeholder.com/100x50.png?text=Sin+Logo'}" 
                                 alt="Logo actual" 
                                 class="h-12 w-auto max-w-[150px] object-contain bg-gray-100 rounded border p-1 mb-2 sm:mb-0">
                             
                             <input type="file" id="logoFile" accept="image/png, image/jpeg, image/webp" class="form-input-file text-sm max-w-xs">
                        </div>
                        <div id="logo-upload-status" class="text-xs mt-1"></div>
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
            <p class="text-gray-600 mb-6">Esta información se usará para personalizar los presupuestos, la web pública y otros documentos.</p>

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

        // *** AÑADIR LISTENER PARA LA SUBIDA DEL LOGO ***
        document.getElementById('logoFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Llamamos a la función definida fuera de renderFormulario
                handleSubirLogo(file);
            }
        });

        // --- Listener existente para el formulario principal (guardar datos de texto) ---
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
                googleMapsLink: form.googleMapsLink.value,
                
                // Nuevos campos para IA
                tipoAlojamientoPrincipal: form.tipoAlojamientoPrincipal.value,
                palabrasClaveAdicionales: form.palabrasClaveAdicionales.value,
                enfoqueMarketing: form.enfoqueMarketing.value,
                
                // Campos de websiteSettings
                websiteSettings: {
                    // Aseguramos mantener otros settings si existen
                    ...(empresaInfo.websiteSettings || {}),
                    domain: form.websiteDomain.value,
                    subdomain: form.websiteSubdomain.value,
                    // El theme se actualiza, pero el logoUrl se maneja por separado
                    theme: {
                        ...(empresaInfo.websiteSettings?.theme || {}),
                        // No enviamos logoUrl aquí
                    }
                }
            };
            
            // Limpiamos el logoUrl del theme para que este formulario no lo sobrescriba
            delete datos.websiteSettings.theme.logoUrl;

            try {
                await fetchAPI('/empresa', { method: 'PUT', body: datos });
                
                alert('¡Datos de la empresa actualizados con éxito!');
                
                // Recargamos los datos (excepto el logo que ya está actualizado localmente)
                const nuevosDatos = await fetchAPI('/empresa');
                // Preservamos el logoUrl local por si la recarga es más lenta que la subida
                const logoActual = empresaInfo.websiteSettings?.theme?.logoUrl;
                empresaInfo = nuevosDatos;
                if (logoActual && !empresaInfo.websiteSettings?.theme?.logoUrl) {
                    if (!empresaInfo.websiteSettings) empresaInfo.websiteSettings = {};
                    if (!empresaInfo.websiteSettings.theme) empresaInfo.websiteSettings.theme = {};
                    empresaInfo.websiteSettings.theme.logoUrl = logoActual;
                }

                renderFormulario(); // Re-renderizar con los datos actualizados
                
                // Volver a añadir el listener de subida de logo después de re-renderizar
                document.getElementById('logoFile').addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) handleSubirLogo(file);
                });

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