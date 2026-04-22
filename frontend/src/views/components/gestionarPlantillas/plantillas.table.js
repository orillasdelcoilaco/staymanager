// frontend/src/views/components/gestionarPlantillas/plantillas.table.js

export const renderFilasTabla = (plantillas, tipos) => {
    if (plantillas.length === 0) {
        return '<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay plantillas registradas.</td></tr>';
    }

    return plantillas.map((p, index) => {
        // Buscamos el nombre del tipo para mostrarlo bonito
        const nombreTipo = tipos.find(t => t.id === p.tipoId)?.nombre || p.tipoId || 'Sin Tipo';
        const correoOk = p.emailConfig?.permitirEnvioCorreo !== false;
        const nOn = p.emailConfig?.disparadores
            ? Object.values(p.emailConfig.disparadores).filter(Boolean).length
            : 0;

        return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${p.nombre}</td>
            <td class="py-3 px-4">
                <span class="badge-soft-primary">
                    ${nombreTipo}
                </span>
            </td>
            <td class="py-3 px-4 text-gray-500 text-sm truncate max-w-xs" title="${p.asunto || ''}">${p.asunto || '-'}</td>
            <td class="py-3 px-4 text-center text-xs">
                <span class="${correoOk ? 'text-success-600' : 'text-gray-400'}" title="Envío permitido / disparadores activos">${correoOk ? 'Sí' : 'No'}${nOn ? ` · ${nOn}` : ''}</span>
            </td>
            <td class="py-3 px-4">
                <button type="button" data-id="${p.id}" class="plantilla-email-config-btn btn-outline text-xs py-1 px-2 mr-1" title="Correo y disparadores"><i class="fa-solid fa-envelope"></i></button>
                <button type="button" data-id="${p.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button type="button" data-id="${p.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `}).join('');
};