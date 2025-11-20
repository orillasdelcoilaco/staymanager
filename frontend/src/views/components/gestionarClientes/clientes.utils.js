// frontend/src/views/components/gestionarClientes/clientes.utils.js

/**
 * Filtra la lista de clientes basándose en el texto de búsqueda y el tipo seleccionado.
 * @param {Array} clientes - Lista completa de clientes.
 * @param {string} texto - Texto a buscar (nombre, teléfono, email).
 * @param {string} tipo - Tipo de cliente para filtrar (opcional).
 * @returns {Array} - Lista filtrada de clientes.
 */
export const filtrarClientes = (clientes, texto, tipo) => {
    const filtroTexto = texto ? texto.toLowerCase() : '';
    const filtroTipo = tipo || '';

    return clientes.filter(c => {
        const textoMatch = (c.nombre && c.nombre.toLowerCase().includes(filtroTexto)) ||
                           (c.telefono && c.telefono.includes(filtroTexto)) ||
                           (c.email && c.email.toLowerCase().includes(filtroTexto));
        
        const tipoMatch = !filtroTipo || c.tipoCliente === filtroTipo;

        return textoMatch && tipoMatch;
    });
};