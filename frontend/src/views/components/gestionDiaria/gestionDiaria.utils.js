export function formatCurrency(value) { return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`; }
export function formatDate(dateString) { return dateString ? new Date(dateString).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'; }

export function formatUSD(value, { includeSymbol = true } = {}) {
    const numberValue = Number(value) || 0;
    const formattedValue = numberValue.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return includeSymbol ? `$${formattedValue}` : formattedValue;
}

export function getStatusInfo(statusName, allEstados = []) {
    const estado = allEstados.find(e => e.nombre === statusName);
    if (estado) {
        return {
            text: estado.nombre.toUpperCase(),
            color: estado.color || 'bg-gray-400',
            // Puedes añadir más lógica aquí si necesitas `level` o `gestionType` dinámicamente
        };
    }
    // Fallback para estados no encontrados o especiales
    switch (statusName) {
        case 'Desconocido': return { text: 'ESTADO DESCONOCIDO', color: 'bg-amber-500' };
        default: return { text: statusName ? statusName.toUpperCase() : 'DESCONOCIDO', color: 'bg-gray-400' };
    }
}


export function showPreview(file, thumb, container) {
    if (file && file.type.startsWith('image/')) {
        thumb.src = URL.createObjectURL(file);
        container.classList.remove('hidden');
    }
}

export function handlePaste(e, docInput, thumb, container) {
    if (!document.getElementById('gestion-modal').contains(e.target)) return;
    const items = (e.clipboardData || window.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            const file = new File([blob], "captura.png", { type: blob.type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            docInput.files = dataTransfer.files;
            showPreview(file, thumb, container);
            break;
        }
    }
}

export function openImageViewer(src) {
    document.getElementById('image-viewer-src').src = src;
    document.getElementById('image-viewer-modal').classList.remove('hidden');
}