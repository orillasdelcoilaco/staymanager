// frontend/src/views/components/gestionarClientes/clientes.utils.js

export const filtrarClientes = (clientes, texto, tipo, pais) => {
    const filtroTexto = texto ? texto.toLowerCase() : '';
    const filtroTipo  = tipo  || '';
    const filtroPais  = pais  || '';

    return clientes.filter(c => {
        const textoMatch = !filtroTexto ||
            (c.nombre   && c.nombre.toLowerCase().includes(filtroTexto)) ||
            (c.telefono && c.telefono.includes(filtroTexto)) ||
            (c.email    && c.email.toLowerCase().includes(filtroTexto));

        const tipoMatch = !filtroTipo || c.tipoCliente === filtroTipo;
        const paisMatch = !filtroPais || (c.pais && c.pais.toLowerCase() === filtroPais.toLowerCase());

        return textoMatch && tipoMatch && paisMatch;
    });
};
