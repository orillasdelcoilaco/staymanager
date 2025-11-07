// frontend/src/views/components/gestionarComentarios/tabla.js

/**
 * Renderiza la tabla de historial de comentarios en el contenedor provisto.
 */
export function renderComentariosTabla(comentarios, container) {
    if (!container) return;

    if (comentarios.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-4">No hay comentarios registrados.</p>`;
        return;
    }

    const formatNota = (nota) => '⭐'.repeat(Math.round(nota)) + '☆'.repeat(5 - Math.round(nota));

    container.innerHTML = `
        <table class="min-w-full bg-white">
            <thead>
                <tr>
                    <th class="th">Cliente</th>
                    <th class="th">Fecha</th>
                    <th class="th">Nota</th>
                    <th class="th">Comentario</th>
                    <th class="th">Fotos</th>
                    <th class="th">Acciones</th>
                </tr>
            </thead>
            <tbody id="comentarios-tbody">
                ${comentarios.map(c => `
                    <tr class="border-b">
                        <td class="py-3 px-4">
                            <p class="font-medium">${c.clienteNombre}</p>
                            <p class="text-sm text-gray-600">${c.alojamientoNombre}</p>
                        </td>
                        <td class="py-3 px-4">${c.fecha}</td>
                        <td class="py-3 px-4 whitespace-nowrap" title="${c.nota} / 5">
                            ${formatNota(c.nota)}
                        </td>
                        <td class="py-3 px-4 max-w-sm">
                            <p class="truncate ...">${c.comentario}</p>
                        </td>
                        <td class="py-3 px-4">
                            ${c.foto1Url ? `<a href="${c.foto1Url}" target="_blank" class="text-blue-500 hover:underline">Img 1</a>` : ''}
                            ${c.foto2Url ? `<a href="${c.foto2Url}" target="_blank" class="text-blue-500 hover:underline ml-2">Img 2</a>` : ''}
                        </td>
                        <td class="py-3 px-4 whitespace-nowrap">
                            <button data-id="${c.id}" class="delete-btn btn-table-delete">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}