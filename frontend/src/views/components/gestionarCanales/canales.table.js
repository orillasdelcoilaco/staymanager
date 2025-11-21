// frontend/src/views/components/gestionarCanales/canales.table.js

export const renderFilasTabla = (canales) => {
    if (canales.length === 0) {
        return '<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay canales registrados.</td></tr>';
    }

    return canales.map((c, index) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${c.nombre} ${c.esCanalPorDefecto ? '⭐' : ''} ${c.esCanalIcal ? '🗓️' : ''}</td>
            <td class="py-3 px-4">${c.moneda}</td>
            <td class="py-3 px-4">${c.separadorDecimal === ',' ? 'Coma (,)' : 'Punto (.)'}</td>
            <td class="py-3 px-4 truncate max-w-sm">${c.descripcion || '-'}</td>
            <td class="py-3 px-4">
                <button data-id="${c.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${c.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
};