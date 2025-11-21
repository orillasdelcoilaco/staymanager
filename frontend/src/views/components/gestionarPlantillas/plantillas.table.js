// frontend/src/views/components/gestionarPlantillas/plantillas.table.js

export const renderFilasTabla = (plantillas, tipos) => {
    if (plantillas.length === 0) {
        return '<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay plantillas registradas.</td></tr>';
    }

    return plantillas.map((p, index) => {
        // Buscamos el nombre del tipo para mostrarlo bonito
        const nombreTipo = tipos.find(t => t.id === p.tipoId)?.nombre || p.tipoId || 'Sin Tipo';
        
        return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${p.nombre}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                    ${nombreTipo}
                </span>
            </td>
            <td class="py-3 px-4 text-gray-500 text-sm truncate max-w-xs" title="${p.asunto || ''}">${p.asunto || '-'}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${p.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `}).join('');
};