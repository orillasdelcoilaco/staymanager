// frontend/src/views/empresa.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { renderUbicacionWidget, setupUbicacionWidget, getUbicacionData } from './components/ubicacionWidget.js';

let empresaInfo = {};

const TIPOS_NEGOCIO = [
    { value: 'complejo', label: '🏕️ Complejo Turístico',      desc: 'Múltiples cabañas, bungalows o unidades en un mismo predio.' },
    { value: 'hotel',    label: '🏨 Hotel / Hostal',            desc: 'Habitaciones o piezas bajo un mismo techo y dirección.' },
    { value: 'cartera',  label: '🏢 Cartera de Departamentos',  desc: 'Departamentos o propiedades en distintas ubicaciones.' },
];

function renderTipoNegocio(tipoActual) {
    return `
        <fieldset class="border p-4 rounded-md bg-primary-50 border-primary-200">
            <legend class="px-2 font-semibold text-primary-800">Tipo de Negocio</legend>
            <p class="text-sm text-primary-600 mt-2 mb-4">Define cómo está organizado tu negocio. Esto determina cómo se gestiona la ubicación de tus alojamientos.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                ${TIPOS_NEGOCIO.map(t => `
                    <label class="flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors
                        ${tipoActual === t.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-primary-300'}">
                        <div class="flex items-center gap-2">
                            <input type="radio" name="tipoNegocio" value="${t.value}"
                                ${tipoActual === t.value ? 'checked' : ''} class="accent-primary-600">
                            <span class="font-medium text-sm text-gray-800">${t.label}</span>
                        </div>
                        <p class="text-xs text-gray-500 ml-5">${t.desc}</p>
                    </label>
                `).join('')}
            </div>
        </fieldset>`;
}

function renderInfoGeneral() {
    return `
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
                    <label for="website" class="block text-sm font-medium text-gray-700">Sitio Web (Informativo)</label>
                    <input type="url" id="website" name="website" value="${empresaInfo.website || ''}" class="mt-1 form-input">
                </div>
            </div>
        </fieldset>`;
}

function renderUbicacion(tipoActual, ubicacion) {
    const desc = tipoActual === 'cartera'
        ? 'Dirección de tu oficina o sede administrativa. Cada alojamiento tendrá su propia dirección.'
        : 'Dirección donde están ubicados tus alojamientos.';
    return `
        <fieldset class="border p-4 rounded-md">
            <legend class="px-2 font-semibold text-gray-700">Ubicación Principal</legend>
            <p class="text-sm text-gray-500 mt-2 mb-4">${desc}</p>
            ${renderUbicacionWidget('empresa-ubicacion', ubicacion)}
        </fieldset>`;
}

function renderLogo() {
    const logoUrl = empresaInfo.websiteSettings?.theme?.logoUrl
        || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='50' viewBox='0 0 100 50'%3E%3Crect width='100' height='50' fill='%23eee'/%3E%3Ctext x='50' y='25' font-family='Arial' font-size='12' fill='%23aaa' text-anchor='middle' dy='.3em'%3ESin Logo%3C/text%3E%3C/svg%3E";
    return `
        <fieldset class="border p-4 rounded-md bg-gray-50">
            <legend class="px-2 font-semibold text-gray-700">Logo de la Empresa</legend>
            <div class="flex items-center gap-6 mt-2">
                <img src="${logoUrl}" alt="Logo actual"
                     class="h-16 w-auto max-w-[200px] object-contain bg-white rounded border p-2">
                <div>
                    <p class="text-sm text-gray-600 mb-2">El logo se gestiona desde la configuración del Sitio Web.</p>
                    <button type="button" id="btn-ir-website" class="text-primary-600 hover:text-primary-800 text-sm font-medium underline">
                        Ir a Configuración de Sitio Web &rarr;
                    </button>
                </div>
            </div>
        </fieldset>`;
}

function renderPresupuestos() {
    return `
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
        </fieldset>`;
}

function renderGoogleAuth() {
    return empresaInfo.googleRefreshToken
        ? `<div class="p-4 bg-success-100 border border-success-300 rounded-md">
               <p class="font-semibold text-success-800">Estado: Activa</p>
               <p class="text-sm text-success-700 mt-1">La sincronización con Google Contacts está configurada.</p>
           </div>`
        : `<div class="p-4 bg-warning-100 border border-warning-300 rounded-md">
               <p class="font-semibold text-warning-800">Estado: Inactiva</p>
               <p class="text-sm text-warning-700 mt-1">Autoriza la conexión en 'Configuración' para sincronizar contactos.</p>
           </div>`;
}

function renderFormulario() {
    const formContainer = document.getElementById('form-container');
    if (!formContainer) return;

    const tipoActual = empresaInfo.tipoNegocio || '';
    const ubicacion  = empresaInfo.ubicacion   || {};

    formContainer.innerHTML = `
        <form id="empresa-form" class="space-y-6">
            ${renderTipoNegocio(tipoActual)}
            ${renderInfoGeneral()}
            ${renderUbicacion(tipoActual, ubicacion)}
            ${renderLogo()}
            ${renderPresupuestos()}
            <div class="border-t pt-6">
                <h3 class="text-base font-semibold text-gray-800 mb-2">Sincronización con Google Contacts</h3>
                ${renderGoogleAuth()}
            </div>
            <div class="flex justify-end pt-6 border-t">
                <button type="submit" class="btn-primary">Guardar Cambios</button>
            </div>
        </form>`;

    setupUbicacionWidget('empresa-ubicacion');

    document.querySelectorAll('input[name="tipoNegocio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('input[name="tipoNegocio"]').forEach(r => {
                r.closest('label').classList.toggle('border-primary-500', r.checked);
                r.closest('label').classList.toggle('bg-primary-50', r.checked);
                r.closest('label').classList.toggle('border-gray-200', !r.checked);
                r.closest('label').classList.toggle('bg-white', !r.checked);
            });
        });
    });

    document.getElementById('btn-ir-website')?.addEventListener('click', () => handleNavigation('/website-general'));

    document.getElementById('empresa-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
        const form = e.target;
        const datos = {
            nombre:             form.nombre.value,
            contactoNombre:     form.contactoNombre.value,
            contactoEmail:      form.contactoEmail.value,
            contactoTelefono:   form.contactoTelefono.value,
            website:            form.website.value,
            serviciosGenerales: form.serviciosGenerales.value,
            condicionesReserva: form.condicionesReserva.value,
            tipoNegocio: form.querySelector('input[name="tipoNegocio"]:checked')?.value || '',
            ubicacion:   getUbicacionData('empresa-ubicacion'),
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

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Configuración de la Empresa</h2>
            <p class="text-gray-600 mb-6">Esta información se usará para personalizar los presupuestos, documentos y datos de contacto.</p>
            <div id="form-container" class="border-t pt-6">
                <p class="text-center text-gray-500">Cargando datos de la empresa...</p>
            </div>
        </div>`;
}

export async function afterRender() {
    try {
        empresaInfo = await fetchAPI('/empresa');
        renderFormulario();
    } catch (error) {
        const container = document.getElementById('form-container');
        if (container) container.innerHTML = `<p class="text-danger-500">Error al cargar la información: ${error.message}</p>`;
    }
}
