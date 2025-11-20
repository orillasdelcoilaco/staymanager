/**
 * Servicio de Plantillas
 * Procesa plantillas y reemplaza etiquetas con datos reales
 */

class PlantillasService {
    
    async obtenerPlantilla(db, empresaId, plantillaId) {
        const doc = await db
            .collection('empresas').doc(empresaId)
            .collection('plantillas').doc(plantillaId)
            .get();
        
        if (!doc.exists) {
            throw new Error(`Plantilla ${plantillaId} no encontrada`);
        }
        
        return {
            id: doc.id,
            ...doc.data()
        };
    }

    reemplazarEtiquetas(texto, datos) {
        let resultado = texto;
        
        const etiquetas = {
            '[CLIENTE_NOMBRE]': datos.nombreCliente || '',
            '[RESERVA_ID_CANAL]': datos.reservaId || '',
            '[FECHA_LLEGADA]': datos.fechaLlegada || '',
            '[FECHA_SALIDA]': datos.fechaSalida || '',
            '[ALOJAMIENTO_NOMBRE]': datos.nombrePropiedad || '',
            '[TOTAL_NOCHES]': datos.totalNoches || '',
            '[CANTIDAD_HUESPEDES]': datos.numeroHuespedes || '',
            '[SALDO_PENDIENTE]': datos.saldoPendiente || '',
            '[PROPUESTA_ID]': datos.propuestaId || '',
            '[EMPRESA_NOMBRE]': datos.empresaNombre || '',
            '[USUARIO_NOMBRE]': datos.contactoNombre || '',
            '[USUARIO_EMAIL]': datos.contactoEmail || '',
            '[USUARIO_TELEFONO]': datos.contactoTelefono || '',
        };
        
        Object.keys(etiquetas).forEach(etiqueta => {
            const regex = new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            resultado = resultado.replace(regex, etiquetas[etiqueta]);
        });
        
        return resultado;
    }

    async procesarPlantilla(db, empresaId, plantillaId, datos) {
        const plantilla = await this.obtenerPlantilla(db, empresaId, plantillaId);
        
        const textoFinal = this.reemplazarEtiquetas(plantilla.texto, datos);
        
        return {
            plantilla,
            contenido: textoFinal,
            asunto: plantilla.nombre
        };
    }

    async verificarEnvioAutomatico(db, empresaId, plantillaId) {
        const plantilla = await this.obtenerPlantilla(db, empresaId, plantillaId);
        return plantilla.enviarPorEmail === true;
    }
}

module.exports = new PlantillasService();