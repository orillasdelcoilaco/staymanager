// frontend/src/views/components/gestionarAlojamientos/alojamientos.utils.js

/**
 * Genera un ID único para componentes basado en el nombre y timestamp.
 */
export const generarIdComponente = (nombre) => {
    const nombreNormalizado = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${nombreNormalizado}-${Date.now().toString(36)}`;
};

/**
 * Ordena las propiedades numéricamente si el nombre contiene números (ej: "Cabaña 1", "Cabaña 10").
 */
export const ordenarPropiedades = (propiedades) => {
    const extraerNumero = (texto) => {
        const match = texto.match(/\d+/);
        return match ? parseInt(match[0], 10) : Infinity;
    };

    return [...propiedades].sort((a, b) => {
        const numA = extraerNumero(a.nombre);
        const numB = extraerNumero(b.nombre);
        if (numA !== numB) return numA - numB;
        return a.nombre.localeCompare(b.nombre);
    });
};

/**
 * Helper para generar HTML de checkboxes consistente.
 */
export const renderCheckbox = (id, label) => {
    return `
        <label for="${id}" class="flex items-center space-x-2 text-sm">
            <input type="checkbox" id="${id}" name="${id}" class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
            <span>${label}</span>
        </label>
    `;
};