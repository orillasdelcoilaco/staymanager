export function renderTabla(tarifas, canales, canalPorDefecto) {
  const tbody = document.getElementById('tarifas-tbody');
  if (!tbody) return;

  if (tarifas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">No hay tarifas registradas.</td></tr>`;
    return;
  }

  const extraerNumero = (texto) => {
    const match = texto.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const tarifasOrdenadas = [...tarifas].sort((a, b) => {
    const numA = extraerNumero(a.alojamientoNombre);
    const numB = extraerNumero(b.alojamientoNombre);

    if (numA !== numB) return numA - numB;
    const nombreA = a.alojamientoNombre.toLowerCase();
    const nombreB = b.alojamientoNombre.toLowerCase();
    if (nombreA !== nombreB) return nombreA.localeCompare(nombreB);
    return new Date(b.fechaInicio) - new Date(a.fechaInicio);
  });

  const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

  tbody.innerHTML = tarifasOrdenadas.map((t, index) => {
    const preciosHtml = canales.map(c => {
      const precio = t.precios[c.id];
      if (!precio) {
        return `<li><strong>${c.nombre}:</strong> No definido</li>`;
      }
      if (precio.moneda === 'USD') {
        const valorUSDFormatted = (precio.valorUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `<li><strong>${c.nombre}:</strong> ${formatCurrency(precio.valorCLP)} CLP (${valorUSDFormatted} USD)</li>`;
      } else {
        return `<li><strong>${c.nombre}:</strong> ${formatCurrency(precio.valorCLP)} ${c.moneda}</li>`;
      }
    }).join('');

    return `
      <tr class="border-b">
        <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
        <td class="py-3 px-4">${t.alojamientoNombre}</td>
        <td class="py-3 px-4">${t.temporada}</td>
        <td class="py-3 px-4">${t.fechaInicio}</td>
        <td class="py-3 px-4">${t.fechaTermino}</td>
        <td class="py-3 px-4 text-center">${t.valorDolarDia ? formatCurrency(t.valorDolarDia) : '-'}</td>
        <td class="py-3 px-4 text-xs"><ul>${preciosHtml}</ul></td>
        <td class="py-3 px-4 whitespace-nowrap">
          <button data-id="${t.id}" class="copy-btn btn-table-copy mr-2">Copiar</button>
          <button data-id="${t.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
          <button data-id="${t.id}" class="delete-btn btn-table-delete">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}