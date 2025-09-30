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

export function getStatusInfo(status) {
    switch (status) {
        case 'Pendiente Bienvenida': return { level: 1, text: 'PENDIENTE BIENVENIDA', color: 'bg-yellow-500', gestionType: 'enviar_bienvenida' };
        case 'Pendiente Cobro': return { level: 2, text: 'PENDIENTE COBRO', color: 'bg-orange-500', gestionType: 'enviar_cobro' };
        case 'Pendiente Pago': return { level: 3, text: 'PENDIENTE PAGO', color: 'bg-red-600', gestionType: null };
        case 'Pendiente Boleta': return { level: 4, text: 'PENDIENTE BOLETA', color: 'bg-purple-600', gestionType: null };
        case 'Pendiente Cliente': return { level: 5, text: 'PENDIENTE CLIENTE', color: 'bg-teal-600', gestionType: 'gestionar_cliente' };
        case 'Desconocido': return { level: 0, text: 'ESTADO DESCONOCIDO', color: 'bg-amber-500', gestionType: 'corregir_estado' };
        default: return { level: 99, text: status ? status.toUpperCase() : 'DESCONOCIDO', color: 'bg-gray-400', gestionType: null };
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