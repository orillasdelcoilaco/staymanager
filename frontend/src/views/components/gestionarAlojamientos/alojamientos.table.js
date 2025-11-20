// frontend/src/views/components/gestionarAlojamientos/alojamientos.table.js
import { ordenarPropiedades } from './alojamientos.utils.js';

/**
 * Genera el HTML para las filas de la tabla de alojamientos.
 */
export const renderFilasTabla = (propiedades) => {
    if (propiedades.length === 0) {
        return '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay alojamientos registrados.</td></tr>';
    }

    const propiedadesOrdenadas = ordenarPropiedades(propiedades);

    return propiedadesOrdenadas.map((p, index) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-mono text-xs text-gray-600">${p.id}</td>
            <td class="py-3 px-4 font-medium text-gray-800">${p.nombre}</td>
            <td class="py-3 px-4 text-center">${p.capacidad}</td>
            <td class="py-3 px-4 text-center">${p.numPiezas || 0}</td>
            <td class="py-3 px-4 text-center">${p.numBanos || 0}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${p.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
};