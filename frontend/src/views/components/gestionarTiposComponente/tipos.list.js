// frontend/src/views/components/gestionarTiposComponente/tipos.list.js

export const renderTablaTipos = (tipos) => {
    if (!tipos || tipos.length === 0) {
        return `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-500">
                    <div class="flex flex-col items-center justify-center">
                        <p class="text-lg mb-2">No se encontraron activos.</p>
                        <button id="btn-init-defaults" class="text-primary-600 hover:text-primary-800 font-medium underline">
                            ✨ Cargar tipos básicos (Dormitorio, Baño, Cocina...)
                        </button>
                    </div>
                </td>
            </tr>`;
    }

    // Utility to safe-escape HTML attributes
    const escapeHtml = (unsafe) => {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // 1. Agrupar por Categoría
    const grupos = {};
    tipos.forEach(t => {
        const cat = t.categoria || 'Otros'; // Fallback
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(t);
    });

    // 2. Ordenar Categorías y construir HTML
    const categoriasOrdenadas = Object.keys(grupos).sort();

    return categoriasOrdenadas.map((categoria, index) => {
        const items = grupos[categoria].sort((a, b) =>
            (a.nombreNormalizado || '').localeCompare(b.nombreNormalizado || '')
        );

        // Professional, data-independent ID
        const groupId = `cat-group-${index}`;
        const count = items.length;

        // Header de Categoría (Clickable para colapsar)
        const headerRow = `
            <tr class="bg-gray-100 border-b border-gray-200 cursor-pointer btn-toggle-categoria hover:bg-gray-200 transition-colors" data-target-group="${groupId}">
                <td colspan="5" class="py-2 px-4">
                    <div class="flex items-center gap-2 font-semibold text-gray-700">
                        <svg class="w-4 h-4 transform transition-transform duration-200 icon-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        <span class="uppercase text-xs tracking-wider">${categoria}</span>
                        <span class="ml-auto bg-gray-300 text-gray-700 text-[10px] px-2 py-0.5 rounded-full">${count}</span>
                    </div>
                </td>
            </tr>
        `;

        // Filas de Items
        const itemRows = items.map(t => {
            const nombre = t.nombreNormalizado || '<span class="text-danger-400 italic">Sin Nombre</span>';
            const icono = t.icono || '📦';
            const descripcion = escapeHtml(t.descripcionBase || '-');
            const original = escapeHtml(t.nombreUsuario || '?');
            const numFotos = t.shotList?.length || 0;

            return `
            <tr class="border-b hover:bg-gray-50 transition-colors group-item-${groupId}">
                <td class="py-3 px-4 text-center text-2xl">${icono}</td>
                <td class="py-3 px-4">
                    <div class="font-medium text-gray-900">${nombre}</div>
                    <div class="text-xs text-gray-500">Original: "${original}"</div>
                </td>
                <td class="py-3 px-4 text-sm text-gray-600 max-w-xs truncate" title="${descripcion}">
                    ${descripcion}
                </td>
                <td class="py-3 px-4">
                    <div class="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded border border-primary-100 inline-block">
                        📸 <strong>${numFotos}</strong> fotos requeridas
                    </div>
                </td>
                <td class="py-3 px-4 text-right">
                    <button data-id="${t.id}" class="btn-edit-tipo text-primary-600 hover:text-primary-800 p-2 rounded hover:bg-primary-50 mr-1" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button data-id="${t.id}" class="btn-delete-tipo text-danger-500 hover:text-danger-700 p-2 rounded hover:bg-danger-50" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        return headerRow + itemRows;
    }).join('');
};