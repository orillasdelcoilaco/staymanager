import { fetchAPI } from '../../../../api.js';
import { formatCurrency, formatDate, formatUSD } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};
let plantillasDisponibles = [];

function generarMensajePreview() {
    const plantillaSelect = document.getElementById('plantilla-select');
    const mensajeTextarea = document.getElementById('mensaje-textarea');
    const plantillaId = plantillaSelect.value;
    const plantilla = plantillasDisponibles.find(p => p.id === plantillaId);

    if (!plantilla) {
        mensajeTextarea.value = '';
        return;
    }

    let texto = plantilla.texto;
    const saldoPendiente = currentGrupo.valorTotalHuesped - currentGrupo.abonoTotal;
    const totalNoches = currentGrupo.totalNoches || 'N/A';
    const totalHuespedes = currentGrupo.reservasIndividuales.reduce((sum, r) => sum + (r.cantidadHuespedes || 0), 0) || 'N/A';

    let cobroTexto;
    if (currentGrupo.esUSD) {
        const valorDolar = currentGrupo.reservasIndividuales[0]?.valorDolarDia || 0;
        cobroTexto = `
Resumen de tu Estadía (Valores en USD):
------------------------------------
Total Cliente: ${formatUSD(currentGrupo.valoresUSD.totalCliente)}
IVA (incluido): ${formatUSD(currentGrupo.valoresUSD.iva)}
Payout Anfitrión: ${formatUSD(currentGrupo.valoresUSD.payout)}
------------------------------------
Valor Dólar del día: ${formatCurrency(valorDolar)}
------------------------------------
Total en Pesos Chilenos: ${formatCurrency(currentGrupo.valorTotalHuesped)}
Abonado: ${formatCurrency(currentGrupo.abonoTotal)}
Saldo Pendiente: ${formatCurrency(saldoPendiente)}
------------------------------------
        `;
    } else {
        cobroTexto = `
Resumen de tu Estadía:
------------------------------------
Total a Pagar: ${formatCurrency(currentGrupo.valorTotalHuesped)}
Abonado: ${formatCurrency(currentGrupo.abonoTotal)}
Saldo Pendiente: ${formatCurrency(saldoPendiente)}
------------------------------------
        `;
    }

    const reemplazos = {
        '[CLIENTE_NOMBRE]': currentGrupo.clienteNombre,
        '[RESERVA_ID_CANAL]': currentGrupo.reservaIdOriginal,
        '[FECHA_LLEGADA]': formatDate(currentGrupo.fechaLlegada),
        '[FECHA_SALIDA]': formatDate(currentGrupo.fechaSalida),
        '[ALOJAMIENTO_NOMBRE]': currentGrupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', '),
        '[TOTAL_NOCHES]': totalNoches,
        '[CANTIDAD_HUESPEDES]': totalHuespedes,
        '[SALDO_PENDIENTE]': formatCurrency(saldoPendiente),
        '[COBRO]': cobroTexto,
    };
    
    for (const [etiqueta, valor] of Object.entries(reemplazos)) {
        texto = texto.replace(new RegExp(etiqueta.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), valor);
    }

    mensajeTextarea.value = texto;
}

async function handleAvanzarEstado() {
    const btn = document.getElementById('avanzar-estado-btn');
    btn.disabled = true;
    btn.textContent = 'Avanzando...';

    let nuevoEstado = '';
    switch(currentGrupo.estadoGestion) {
        case 'Pendiente Bienvenida':
            nuevoEstado = 'Pendiente Cobro';
            break;
        case 'Pendiente Cobro':
            nuevoEstado = 'Pendiente Pago';
            break;
    }

    if (!nuevoEstado) {
        alert('No hay un estado siguiente definido para esta acción.');
        btn.disabled = false;
        btn.textContent = 'Marcar como Enviado y Avanzar';
        return;
    }

    try {
        await fetchAPI('/gestion/actualizar-estado', {
            method: 'POST',
            body: {
                idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
                nuevoEstado
            }
        });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        alert(`Error al avanzar estado: ${error.message}`);
        btn.disabled = false;
        btn.textContent = 'Marcar como Enviado y Avanzar';
    }
}


export async function renderMensajeModal(grupo, tipoMensaje, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;
    const contentContainer = document.getElementById('modal-content-container');
    contentContainer.innerHTML = `<p class="text-center text-gray-500">Cargando plantillas...</p>`;

    try {
        const data = await fetchAPI('/mensajes/preparar', {
            method: 'POST',
            body: { reservaIdOriginal: grupo.reservaIdOriginal, tipoMensaje }
        });
        
        plantillasDisponibles = data.plantillas;

        if (plantillasDisponibles.length === 0) {
            contentContainer.innerHTML = `<p class="text-center text-red-500">No se encontraron plantillas de tipo "${tipoMensaje}". Por favor, créalas en la sección de gestión de plantillas.</p>`;
            return;
        }

        contentContainer.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label for="plantilla-select" class="block text-sm font-medium text-gray-700">Seleccionar Plantilla</label>
                    <select id="plantilla-select" class="mt-1 form-select">
                        <option value="">-- Elige una plantilla para empezar --</option>
                        ${plantillasDisponibles.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="mensaje-textarea" class="block text-sm font-medium text-gray-700">Mensaje Generado</label>
                    <textarea id="mensaje-textarea" rows="10" class="mt-1 form-input w-full"></textarea>
                </div>
                <div class="flex flex-col md:flex-row justify-between items-center gap-3 pt-4 border-t">
                    <div class="flex gap-2">
                        <button id="copy-btn" class="btn-secondary">Copiar Mensaje</button>
                        <button id="whatsapp-btn" class="btn-primary bg-green-600 hover:bg-green-700">Enviar por WhatsApp</button>
                    </div>
                    <button id="avanzar-estado-btn" class="btn-primary w-full md:w-auto">Marcar como Enviado y Avanzar</button>
                </div>
            </div>
        `;

        document.getElementById('plantilla-select').addEventListener('change', generarMensajePreview);
        document.getElementById('avanzar-estado-btn').addEventListener('click', handleAvanzarEstado);
        
        document.getElementById('copy-btn').addEventListener('click', () => {
            const mensaje = document.getElementById('mensaje-textarea').value;
            if (mensaje) {
                navigator.clipboard.writeText(mensaje)
                    .then(() => alert('¡Mensaje copiado!'))
                    .catch(err => alert('Error al copiar.'));
            }
        });

        document.getElementById('whatsapp-btn').addEventListener('click', () => {
            const mensaje = document.getElementById('mensaje-textarea').value;
            if (mensaje && currentGrupo.telefono) {
                const fonoLimpio = currentGrupo.telefono.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${fonoLimpio}?text=${encodeURIComponent(mensaje)}`;
                window.open(whatsappUrl, '_blank');
            } else {
                alert('No se pudo generar el mensaje o el cliente no tiene un teléfono registrado.');
            }
        });

    } catch (error) {
        contentContainer.innerHTML = `<p class="text-center text-red-500">Error al cargar datos del mensaje: ${error.message}</p>`;
    }
}