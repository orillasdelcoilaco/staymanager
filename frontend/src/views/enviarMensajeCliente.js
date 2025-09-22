import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let cliente = null;
let reserva = null;

const plantillas = [
    {
        nombre: "Confirmación de Reserva",
        texto: "Hola {nombreCliente}, te confirmamos tu reserva en {alojamientoNombre} desde el {fechaLlegada} hasta el {fechaSalida}. ¡Te esperamos!"
    },
    {
        nombre: "Instrucciones de Llegada",
        texto: "¡Hola {nombreCliente}! Tu llegada a {alojamientoNombre} es el {fechaLlegada}. La dirección es [DIRECCIÓN]. La clave de acceso es [CLAVE]. ¡Buen viaje!"
    },
    {
        nombre: "Agradecimiento y Despedida",
        texto: "Hola {nombreCliente}, esperamos que hayas disfrutado tu estadía en {alojamientoNombre}. ¡Gracias por preferirnos y esperamos verte pronto!"
    }
];

function generarMensaje() {
    const plantillaSelect = document.getElementById('plantilla-select');
    const mensajeTextarea = document.getElementById('mensaje-textarea');
    const plantillaSeleccionada = plantillas.find(p => p.nombre === plantillaSelect.value);

    if (!plantillaSeleccionada || !cliente || !reserva) {
        mensajeTextarea.value = '';
        return;
    }
    
    const formatDate = (iso) => new Date(iso).toLocaleDateString('es-CL', { timeZone: 'UTC', day: 'numeric', month: 'long' });

    let texto = plantillaSeleccionada.texto;
    texto = texto.replace('{nombreCliente}', cliente.nombre);
    texto = texto.replace('{alojamientoNombre}', reserva.alojamientoNombre);
    texto = texto.replace('{fechaLlegada}', formatDate(reserva.fechaLlegada));
    texto = texto.replace('{fechaSalida}', formatDate(reserva.fechaSalida));
    
    mensajeTextarea.value = texto;
}

export async function render() {
    const pathParts = window.location.pathname.split('/');
    const clienteId = pathParts[2];
    const reservaId = pathParts[4];
    
    try {
        cliente = await fetchAPI(`/clientes/${clienteId}`);
        reserva = cliente.reservas.find(r => r.id === reservaId);
        if (!reserva) throw new Error('Reserva no encontrada para este cliente.');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar datos: ${error.message}</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto">
            <div class="flex justify-between items-center mb-4">
                 <h2 class="text-2xl font-semibold text-gray-900">Enviar Mensaje</h2>
                 <button id="back-btn" class="btn-secondary">Volver al Perfil</button>
            </div>
           
            <div class="bg-gray-50 p-4 rounded-md mb-6">
                <p><strong>Cliente:</strong> ${cliente.nombre}</p>
                <p><strong>Teléfono:</strong> ${cliente.telefono}</p>
                <p><strong>Reserva:</strong> ${reserva.alojamientoNombre} (${new Date(reserva.fechaLlegada).toLocaleDateString('es-CL', { timeZone: 'UTC' })})</p>
            </div>

            <div class="space-y-4">
                <div>
                    <label for="plantilla-select" class="block text-sm font-medium text-gray-700">Seleccionar Plantilla</label>
                    <select id="plantilla-select" class="mt-1 form-select">
                        <option value="">-- Elige una plantilla --</option>
                        ${plantillas.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="mensaje-textarea" class="block text-sm font-medium text-gray-700">Mensaje Generado</label>
                    <textarea id="mensaje-textarea" rows="8" class="mt-1 form-input"></textarea>
                </div>
                <div class="flex justify-end space-x-2">
                    <button id="copy-btn" class="btn-secondary">Generar y Copiar Mensaje</button>
                    <button id="whatsapp-btn" class="btn-primary">Enviar por WhatsApp</button>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const plantillaSelect = document.getElementById('plantilla-select');
    const copyBtn = document.getElementById('copy-btn');
    const whatsappBtn = document.getElementById('whatsapp-btn');
    
    plantillaSelect.addEventListener('change', generarMensaje);

    copyBtn.addEventListener('click', () => {
        generarMensaje();
        const mensajeTextarea = document.getElementById('mensaje-textarea');
        mensajeTextarea.select();
        document.execCommand('copy');
        alert('¡Mensaje copiado al portapapeles!');
    });

    whatsappBtn.addEventListener('click', () => {
        generarMensaje();
        const mensaje = document.getElementById('mensaje-textarea').value;
        if (mensaje && cliente.telefono) {
            const fonoLimpio = cliente.telefono.replace(/\D/g, '');
            const whatsappUrl = `https://wa.me/${fonoLimpio}?text=${encodeURIComponent(mensaje)}`;
            window.open(whatsappUrl, '_blank');
        } else {
            alert('No se pudo generar el mensaje o el cliente no tiene teléfono.');
        }
    });
    
    document.getElementById('back-btn').addEventListener('click', () => {
        handleNavigation(`/cliente/${cliente.id}`);
    });
}