// backend/services/mensajeService.js
const { obtenerPlantillaPorId } = require('./plantillasService');
const { obtenerPropiedadPorId } = require('./propiedadesService');
const { obtenerClientePorId } = require('./clientesService');
const { obtenerReservaPorId } = require('./reservasService');
const { obtenerPropuestaPorId } = require('./propuestasService'); // Importar
const { obtenerPresupuestoPorId } = require('./presupuestosService'); // Importar
const { format } = require('date-fns');
const es = require('date-fns/locale/es');

// Función auxiliar para obtener la imagen principal de una propiedad
function obtenerImagenPrincipal(propiedad) {
    if (propiedad.websiteData && propiedad.websiteData.images) {
        const imagenes = propiedad.websiteData.images;
        // Priorizar categorías específicas
        const portada = imagenes['portadaRecinto']?.[0] || imagenes['exteriorAlojamiento']?.[0];
        if (portada) return portada.storagePath;

        // Fallback: tomar la primera imagen de cualquier componente
        const allImages = Object.values(imagenes).flat();
        if (allImages.length > 0) return allImages[0].storagePath;
    }
    // Si no hay nada, placeholder
    return 'https://via.placeholder.com/400x300.png?text=Imagen+no+disponible';
}


// Función genérica para reemplazar placeholders
function reemplazarPlaceholders(texto, datos) {
    // Expresión regular para encontrar {{objeto.campo}}
    const regex = /{{\s*([\w\.]+)\s*}}/g;

    return texto.replace(regex, (match, placeholder) => {
        // Dividir el placeholder (ej. "cliente.nombre")
        const keys = placeholder.split('.');
        let valor = datos;

        // Navegar por el objeto
        for (const key of keys) {
            if (valor && typeof valor === 'object' && key in valor) {
                valor = valor[key];
            } else {
                return match; // Dejar el placeholder si no se encuentra
            }
        }

        // Manejar fechas
        if (valor instanceof Date) {
            // Formato simple por defecto, se puede mejorar
            try {
                // Asumir que si es 'fechaLlegada' o 'fechaSalida' queremos formato específico
                if (keys.includes('fechaLlegada') || keys.includes('fechaSalida')) {
                    return format(valor, "EEEE dd 'de' MMMM yyyy", { locale: es });
                }
                return format(valor, 'dd/MM/yyyy HH:mm', { locale: es });
            } catch (e) {
                return valor.toString(); // Fallback si la fecha es inválida
            }
        }

        return (valor !== null && valor !== undefined) ? valor : match;
    });
}


async function generarMensajePropuesta(db, empresaId, tipoMensaje, propuestaId, plantillaId) {
    try {
        // 1. Obtener datos
        const propuesta = await obtenerPropuestaPorId(db, empresaId, propuestaId);
        if (!propuesta) throw new Error('Propuesta no encontrada');

        const cliente = await obtenerClientePorId(db, empresaId, propuesta.clienteId);
        if (!cliente) throw new Error('Cliente no encontrado');

        const plantilla = await obtenerPlantillaPorId(db, empresaId, plantillaId);
        if (!plantilla) throw new Error('Plantilla no encontrada');

        // 2. Preparar datos para reemplazo
        let datos = {
            cliente: { ...cliente },
            propuesta: { ...propuesta },
            empresa: {
                // TODO: Obtener datos de la empresa (ej. nombre, contacto)
                nombre: "Nombre de tu Empresa",
                telefono: "+56912345678"
            },
            alojamientos: []
        };

        // Formatear fechas de la propuesta
        datos.propuesta.fechaLlegada = new Date(propuesta.fechaLlegada);
        datos.propuesta.fechaSalida = new Date(propuesta.fechaSalida);

        // 3. Procesar alojamientos (para mensajes que listan propiedades)
        for (const aloj of propuesta.alojamientos) {
            const propiedad = await obtenerPropiedadPorId(db, empresaId, aloj.id);
            if (propiedad) {
                
                // *** INICIO DE LA CORRECCIÓN ***
                const imagenUrl = obtenerImagenPrincipal(propiedad);
                // *** FIN DE LA CORRECCIÓN ***
                
                datos.alojamientos.push({
                    nombre: propiedad.nombre,
                    // linkFotos: propiedad.linkFotos, // Campo antiguo eliminado
                    linkFotos: imagenUrl, // Usar la nueva URL
                    descripcion: propiedad.descripcion
                });
            }
        }

        // 4. Generar texto
        let textoMensaje = reemplazarPlaceholders(plantilla.contenido, datos);

        // 5. Generar un resumen de alojamientos si se usa el placeholder específico
        if (textoMensaje.includes('{{lista_alojamientos}}')) {
            const listaTexto = datos.alojamientos.map(a =>
                `*${a.nombre}*\n_${a.descripcion.substring(0, 50)}..._\n${a.linkFotos}\n`
            ).join('\n');
            textoMensaje = textoMensaje.replace('{{lista_alojamientos}}', listaTexto);
        }

        return {
            telefonoCliente: cliente.telefono,
            mensaje: textoMensaje
        };

    } catch (error) {
        console.error("Error al generar mensaje para propuesta:", error);
        throw error;
    }
}

async function generarMensajeDocumento(db, empresaId, tipoMensaje, documentoId, plantillaId) {
     try {
        // 1. Obtener datos
        const presupuesto = await obtenerPresupuestoPorId(db, empresaId, documentoId);
        if (!presupuesto) throw new Error('Presupuesto no encontrado');

        const cliente = await obtenerClientePorId(db, empresaId, presupuesto.clienteId);
        if (!cliente) throw new Error('Cliente no encontrado');

        const plantilla = await obtenerPlantillaPorId(db, empresaId, plantillaId);
        if (!plantilla) throw new Error('Plantilla no encontrada');

        // 2. Preparar datos
        let datos = {
            cliente: { ...cliente },
            documento: { ...presupuesto },
            empresa: { /*... (datos empresa) ...*/ },
            alojamientos: []
        };
        datos.documento.fechaLlegada = new Date(presupuesto.fechaLlegada);
        datos.documento.fechaSalida = new Date(presupuesto.fechaSalida);

        // 3. Procesar alojamientos
         for (const aloj of presupuesto.propiedades) {
            const propiedad = await obtenerPropiedadPorId(db, empresaId, aloj.id);
            if (propiedad) {
                
                // *** INICIO DE LA CORRECCIÓN ***
                const imagenUrl = obtenerImagenPrincipal(propiedad);
                // *** FIN DE LA CORRECCIÓN ***

                datos.alojamientos.push({
                    nombre: propiedad.nombre,
                    // linkFotos: propiedad.linkFotos, // Campo antiguo eliminado
                    linkFotos: imagenUrl, // Usar la nueva URL
                    descripcion: propiedad.descripcion,
                    precioTotalCLP: aloj.precioTotalCLP
                });
            }
        }

        // 4. Generar texto
        let textoMensaje = reemplazarPlaceholders(plantilla.contenido, datos);

        // 5. Generar resumen de alojamientos
         if (textoMensaje.includes('{{lista_alojamientos_presupuesto}}')) {
            const listaTexto = datos.alojamientos.map(a =>
                `*${a.nombre}*\nPrecio Total: $${a.precioTotalCLP.toLocaleString('es-CL')}\n${a.linkFotos}\n`
            ).join('\n');
            textoMensaje = textoMensaje.replace('{{lista_alojamientos_presupuesto}}', listaTexto);
        }

        return {
            telefonoCliente: cliente.telefono,
            mensaje: textoMensaje
        };

     } catch (error) {
         console.error("Error al generar mensaje para documento:", error);
         throw error;
     }
}


async function generarMensajeReserva(db, empresaId, tipoMensaje, reservaId, plantillaId) {
    try {
        // 1. Obtener datos
        const reserva = await obtenerReservaPorId(db, empresaId, reservaId);
        if (!reserva) throw new Error('Reserva no encontrada');

        const cliente = await obtenerClientePorId(db, empresaId, reserva.clienteId);
        if (!cliente) throw new Error('Cliente no encontrado');

        const propiedad = await obtenerPropiedadPorId(db, empresaId, reserva.propiedadId);
        if (!propiedad) throw new Error('Propiedad no encontrada');

        const plantilla = await obtenerPlantillaPorId(db, empresaId, plantillaId);
        if (!plantilla) throw new Error('Plantilla no encontrada');

        // 2. Preparar datos para reemplazo
        let datos = {
            cliente: { ...cliente },
            reserva: { ...reserva },
            propiedad: { ...propiedad },
            empresa: {
                // TODO: Obtener datos de la empresa (ej. nombre, contacto)
                nombre: "Nombre de tu Empresa",
                telefono: "+56912345678",
                email: "contacto@empresa.com"
            }
        };
        
        // 3. Formatear valores
        datos.reserva.fechaLlegada = new Date(reserva.fechaLlegada);
        datos.reserva.fechaSalida = new Date(reserva.fechaSalida);
        datos.reserva.precioFinal = reserva.precioFinal?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
        datos.reserva.abono = reserva.abono?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
        datos.reserva.saldoPendiente = (reserva.precioFinal - reserva.abono)?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

        // 4. Generar texto
        const textoMensaje = reemplazarPlaceholders(plantilla.contenido, datos);

        return {
            telefonoCliente: cliente.telefono,
            mensaje: textoMensaje
        };

    } catch (error) {
        console.error("Error al generar mensaje para reserva:", error);
        throw error;
    }
}


module.exports = {
    generarMensajePropuesta,
    generarMensajeDocumento,
    generarMensajeReserva
};