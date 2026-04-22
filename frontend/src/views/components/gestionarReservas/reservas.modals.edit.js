// reservas.modals.edit.js — Modal de edición de reserva y gestión de documentos/transacciones

import { fetchAPI } from '../../../api.js';
import { formatDate, formatCurrency } from './reservas.utils.js';
import { renderDocumentoLink } from './reservas.modals.view.js';

export function toggleDolarFields(form) {
    const moneda = form.moneda.value;
    const dolarContainer = form.querySelector('#dolar-container');
    dolarContainer.style.display = moneda === 'USD' ? 'grid' : 'none';
}

export function calcularValorFinal(form, source) {
    const valorDolar = parseFloat(form.valorDolarDia.value) || 0;
    const valorOriginalInput = form.querySelector('[name="valorOriginal"]');
    const valorTotalInput = form.querySelector('[name="valorTotal"]');

    if (form.moneda.value === 'USD' && valorDolar > 0) {
        if (source === 'original') {
            valorTotalInput.value = Math.round((parseFloat(valorOriginalInput.value) || 0) * valorDolar);
        } else {
            valorOriginalInput.value = ((parseFloat(valorTotalInput.value) || 0) / valorDolar).toFixed(2);
        }
    }
}

export function renderizarGestorDocumento(form, tipo, docUrl) {
    const container = form.querySelector(`#documento-${tipo}-container`);
    let html = '';

    if (docUrl) {
        html = docUrl === 'SIN_DOCUMENTO'
            ? '<p class="text-sm font-semibold">Declarado sin documento.</p>'
            : `<a href="${docUrl}" target="_blank" class="text-primary-600 hover:underline text-sm">Ver Documento Actual</a>`;
        html += `<button type="button" data-tipo="${tipo}" class="delete-doc-btn text-danger-600 text-xs ml-4">Eliminar</button>`;
    }

    html += `<input type="file" data-tipo="${tipo}" class="doc-input mt-2 text-sm">`;
    container.innerHTML = html;
}

export async function handleGestionarDocumento(reservaId, tipo, archivo, accion, editandoReservaRef) {
    const formData = new FormData();
    formData.append('tipoDocumento', tipo);
    formData.append('accion', accion);
    if (archivo) formData.append('documento', archivo);

    try {
        const updatedReserva = await fetchAPI(`/reservas/${reservaId}/documento`, { method: 'POST', body: formData });
        const form = document.getElementById('reserva-form-edit');
        renderizarGestorDocumento(form, 'reserva', updatedReserva.documentos?.enlaceReserva);
        renderizarGestorDocumento(form, 'boleta', updatedReserva.documentos?.enlaceBoleta);
        return updatedReserva;
    } catch (error) {
        alert(`Error al gestionar el documento: ${error.message}`);
        throw error;
    }
}

export function renderizarListaTransacciones(form, transacciones) {
    const container = form.querySelector('#lista-transacciones-edit');
    container.innerHTML = transacciones.length === 0
        ? '<p class="text-gray-500 text-center">No hay pagos registrados.</p>'
        : transacciones.map(t => `
            <div class="bg-gray-50 p-2 rounded grid grid-cols-4 gap-2 items-center">
                <span>${t.tipo}</span>
                <span class="font-semibold">${formatCurrency(t.monto)}</span>
                <span>${renderDocumentoLink(t.enlaceComprobante, 'Sin Comp.')}</span>
                <button type="button" data-id="${t.id}" class="delete-pago-btn text-danger-600 text-xs justify-self-end">Eliminar</button>
            </div>`).join('');
}

export async function abrirModalEditar(reservaId, alojamientos, clientes) {
    const modal = document.getElementById('reserva-modal-edit');
    const form  = document.getElementById('reserva-form-edit');
    if (!modal || !form) return null;

    try {
        const editandoReserva = await fetchAPI(`/reservas/${reservaId}`);

        document.getElementById('modal-title-edit').textContent = `Editar Reserva`;
        const editSubtitle = document.getElementById('modal-edit-subtitle');
        if (editSubtitle) editSubtitle.textContent = `${editandoReserva.idReservaCanal} — ${editandoReserva.alojamientoNombre || ''}`;

        const resumenGrupoEl = document.getElementById('resumen-grupo-container');
        if (editandoReserva.datosGrupo.propiedades.length > 1) {
            resumenGrupoEl.innerHTML = `
                <div class="p-3 bg-primary-50 border border-primary-200 rounded-md text-sm">
                    <p>Esta reserva es parte de un grupo de <strong>${editandoReserva.datosGrupo.propiedades.length} propiedades</strong> (${editandoReserva.datosGrupo.propiedades.join(', ')}).</p>
                    <p>Valor Total del Grupo: <strong>${formatCurrency(editandoReserva.datosGrupo.valorTotal)}</strong></p>
                </div>`;
            resumenGrupoEl.classList.remove('hidden');
        } else {
            resumenGrupoEl.classList.add('hidden');
        }

        document.getElementById('alojamiento-select').innerHTML =
            alojamientos.map(a => `<option value="${a.id}" ${a.id === editandoReserva.alojamientoId ? 'selected' : ''}>${a.nombre}</option>`).join('');

        document.getElementById('cliente-select').innerHTML =
            clientes.map(c => `<option value="${c.id}" ${c.id === editandoReserva.clienteId ? 'selected' : ''}>${c.nombre}</option>`).join('');

        form.idReservaCanal.value    = editandoReserva.idReservaCanal || '';
        form.estado.value            = editandoReserva.estado;
        form.estadoGestion.value     = editandoReserva.estadoGestion || '';
        form.fechaLlegada.value      = editandoReserva.fechaLlegada;
        form.fechaSalida.value       = editandoReserva.fechaSalida;
        form.moneda.value            = editandoReserva.moneda || 'CLP';
        form.valorOriginal.value     = editandoReserva.valores?.valorOriginal || 0;
        form.valorTotal.value        = editandoReserva.datosIndividuales?.valorTotalHuesped || 0;
        form.valorDolarDia.value     = editandoReserva.datosIndividuales?.valorDolarUsado || '';
        form.cantidadHuespedes.value = editandoReserva.cantidadHuespedes || 0;

        renderizarGestorDocumento(form, 'reserva', editandoReserva.documentos?.enlaceReserva);
        renderizarGestorDocumento(form, 'boleta',  editandoReserva.documentos?.enlaceBoleta);
        renderizarListaTransacciones(form, editandoReserva.transacciones);
        toggleDolarFields(form);

        modal.classList.remove('hidden');
        return editandoReserva;
    } catch (error) {
        alert(`Error al cargar los detalles de la reserva: ${error.message}`);
        return null;
    }
}

export function cerrarModalEditar() {
    document.getElementById('reserva-modal-edit').classList.add('hidden');
}
