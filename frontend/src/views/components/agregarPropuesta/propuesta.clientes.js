// frontend/src/views/components/agregarPropuesta/propuesta.clientes.js
import { fetchAPI } from '../../../api.js';
import { state } from './propuesta.state.js';

export function filterClients(e) {
    const searchTerm = e.target.value.toLowerCase();
    const resultsList = document.getElementById('client-results-list');
    resultsList.innerHTML = '';
    resultsList.classList.add('hidden');
    
    if (!searchTerm) {
        clearClientSelection();
        return;
    }
    
    const filtered = state.allClients.filter(c => c.nombre.toLowerCase().includes(searchTerm) || (c.telefono && c.telefono.includes(searchTerm)));
    
    if (filtered.length > 0) {
        resultsList.classList.remove('hidden');
    }
    
    filtered.slice(0, 5).forEach(client => {
        const div = document.createElement('div');
        div.className = 'p-2 cursor-pointer hover:bg-gray-100';
        div.textContent = `${client.nombre} (${client.telefono})`;
        div.onclick = () => selectClient(client);
        resultsList.appendChild(div);
    });
}

export function selectClient(client) {
    state.selectedClient = client;
    document.getElementById('client-form-title').textContent = '... o actualiza los datos del cliente seleccionado';
    document.getElementById('client-search').value = client.nombre;
    document.getElementById('client-results-list').classList.add('hidden');
    document.getElementById('new-client-name').value = client.nombre || '';
    document.getElementById('new-client-phone').value = client.telefono || '';
    document.getElementById('new-client-email').value = client.email || '';
}

export function clearClientSelection() {
    state.selectedClient = null;
    document.getElementById('client-form-title').textContent = '... o añade un cliente nuevo';
    ['new-client-name', 'new-client-phone', 'new-client-email'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

export async function obtenerOcrearCliente() {
    const nombre = document.getElementById('new-client-name').value.trim();
    const telefono = document.getElementById('new-client-phone').value.trim();
    const email = document.getElementById('new-client-email').value.trim();
  
    if (!nombre || !telefono) {
      alert('Nombre y teléfono son obligatorios.');
      return null;
    }
  
    try {
      if (state.selectedClient && state.selectedClient.id) {
        // Verificar cambios
        const datosCargados = { nombre: state.selectedClient.nombre, telefono: state.selectedClient.telefono, email: state.selectedClient.email };
        const datosFormulario = { nombre, telefono, email };
        const hayCambios = JSON.stringify(datosCargados) !== JSON.stringify(datosFormulario);
  
        if (hayCambios) {
          const clienteActualizado = { id: state.selectedClient.id, nombre, telefono, email: email || null };
          const response = await fetchAPI(`/clientes/${state.selectedClient.id}`, { method: 'PUT', body: clienteActualizado });
          state.selectedClient = response;
          return response;
        } else {
          return state.selectedClient;
        }
      } else {
        // Crear nuevo
        const nuevoCliente = { nombre, telefono, email: email || null };
        const response = await fetchAPI('/clientes', { method: 'POST', body: nuevoCliente });
        state.selectedClient = response.cliente;
        return response.cliente;
      }
    } catch (error) {
      console.error('Error al procesar cliente:', error);
      alert(`Error con el cliente: ${error.message}`);
      return null;
    }
}