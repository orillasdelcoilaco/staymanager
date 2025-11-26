// frontend/src/views/components/gestionarTiposComponente/tipos.list.js

export const renderTablaTipos = (tipos) => {
    if (!tipos || tipos.length === 0) {
        return `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-500">
                    <div class="flex flex-col items-center justify-center">
                        <p class="text-lg mb-2">No hay tipos de espacios definidos.</p>
                        <button id="btn-init-defaults" class="text-indigo-600 hover:text-indigo-800 font-medium underline">
                            ✨ Cargar tipos básicos (Dormitorio, Baño, Cocina...)
                        </button>
                    </div>
                </td>
            </tr>`;
    }

    return tipos.map((t, index) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 text-center text-2xl">${t.icono || '📦'}</td>
            <td class="py-3 px-4">
                <div class="font-medium text-gray-900">${t.nombreNormalizado}</div>
                <div class="text-xs text-gray-500">Original: "${t.nombreUsuario}"</div>
            </td>
            <td class="py-3 px-4 text-sm text-gray-600 max-w-xs truncate" title="${t.descripcionBase || ''}">
                ${t.descripcionBase || '-'}
            </td>
            <td class="py-3 px-4">
                <div class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 inline-block">
                    📸 <strong>${t.shotList?.length || 0}</strong> fotos requeridas
                </div>
            </td>
            <td class="py-3 px-4 text-right">
                <button data-id="${t.id}" class="btn-delete-tipo text-red-500 hover:text-red-700 p-1" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        </tr>
    `).join('');
};