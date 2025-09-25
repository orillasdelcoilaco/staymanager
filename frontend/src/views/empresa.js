import { fetchAPI } from '../api.js';

export async function render() {
    let empresaInfo = {};
    try {
        empresaInfo = await fetchAPI('/empresa');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar la información de la empresa: ${error.message}</p>`;
    }

    const authStatusHtml = empresaInfo.googleAuthStatus
        ? `<div class="p-4 bg-green-100 border border-green-300 rounded-md">
               <p class="font-semibold text-green-800">Estado: Activa</p>
               <p class="text-sm text-green-700 mt-1">La sincronización con Google Contacts está configurada y funcionando.</p>
           </div>`
        : `<div class="p-4 bg-yellow-100 border border-yellow-300 rounded-md">
               <p class="font-semibold text-yellow-800">Estado: Inactiva</p>
               <p class="text-sm text-yellow-700 mt-1">Para activar la creación automática de contactos, el administrador de StayManager debe realizar la configuración inicial. Por favor, contacta a soporte.</p>
           </div>`;

    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Información de la Empresa</h2>
            <p class="text-gray-600 mb-6">Aquí se muestra el estado general y las configuraciones de tu empresa en StayManager.</p>
            
            <div class="border-t pt-6 space-y-4">
                <div>
                    <p class="text-sm font-medium text-gray-500">Nombre de la Empresa</p>
                    <p class="text-lg font-semibold text-gray-900">${empresaInfo.nombre}</p>
                </div>
                 <div>
                    <p class="text-sm font-medium text-gray-500">Fecha de Registro</p>
                    <p class="text-lg font-semibold text-gray-900">${empresaInfo.fechaCreacion}</p>
                </div>
                 <div class="border-t pt-4 mt-4">
                    <p class="text-base font-semibold text-gray-800 mb-2">Sincronización con Google Contacts</p>
                    ${authStatusHtml}
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    // No se necesita JS adicional para esta vista
}