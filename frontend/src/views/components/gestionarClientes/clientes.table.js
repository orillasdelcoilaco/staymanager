// frontend/src/views/components/gestionarClientes/clientes.table.js

export const renderFilasTabla = (clientes) => {
    if (clientes.length === 0) {
        return '<tr><td colspan="7" class="text-center text-gray-500 py-4">No se encontraron clientes.</td></tr>';
    }

    return clientes.map((c, index) => {
        const syncStatusHtml = c.googleContactSynced
            ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800" title="Sincronizado con Google Contacts">Sincronizado</span>'
            : `<button data-id="${c.id}" class="sync-btn btn-table-sync">Sincronizar</button>`;

        return `
        <tr class="border-b hover:bg-gray-50 text-sm">
            <td class="py-2 px-3 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-2 px-3 font-medium">${c.nombre}</td>
            <td class="py-2 px-3">${c.telefono}</td>
            <td class="py-2 px-3">${c.email || '-'}</td>
            <td class="py-2 px-3"><span class="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">${c.tipoCliente || 'N/A'} (${c.numeroDeReservas || 0})</span></td>
            <td class="py-2 px-3">${c.pais || '-'}</td>
            <td class="py-2 px-3 whitespace-nowrap space-x-2">
                <button data-id="${c.id}" class="view-btn btn-table-view" title="Ver Perfil">📄</button>
                <button data-id="${c.id}" class="edit-btn btn-table-edit text-blue-600 hover:text-blue-800" title="Editar">✏️</button>
                ${syncStatusHtml}
                <button data-id="${c.id}" class="delete-btn btn-table-delete text-red-600 hover:text-red-800" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `}).join('');
};