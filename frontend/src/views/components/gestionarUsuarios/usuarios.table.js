// frontend/src/views/components/gestionarUsuarios/usuarios.table.js

export const renderFilasTabla = (usuarios) => {
    if (usuarios.length === 0) {
        return '<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay usuarios registrados.</td></tr>';
    }

    return usuarios.map((u, index) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${u.email}</td>
            <td class="py-3 px-4 text-center">
                <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    ${u.rol || 'Admin'}
                </span>
            </td>
            <td class="py-3 px-4 text-center">
                <button data-uid="${u.uid}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-uid="${u.uid}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
};