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
    
    const baseInfo = {
        text: estado ? estado.nombre.toUpperCase() : (statusName ? statusName.toUpperCase() : 'DESCONOCIDO'),
        color: estado ? estado.color : '#9ca3af' // bg-gray-400
    };

    // La lógica de negocio (qué acción dispara cada estado) se mantiene aquí
    switch (statusName) {
        case 'Pendiente Bienvenida': return { ...baseInfo, level: 1, gestionType: 'enviar_bienvenida' };
        case 'Pendiente Cobro': return { ...baseInfo, level: 2, gestionType: 'enviar_cobro' };
        case 'Pendiente Cliente': return { ...baseInfo, level: 5, gestionType: 'gestionar_cliente' };
        case 'Desconocido': return { ...baseInfo, level: 0, gestionType: 'corregir_estado', color: '#f59e0b' }; // bg-amber-500
        
        // Estados sin acción directa en el tag
        case 'Pendiente Pago': return { ...baseInfo, level: 3, gestionType: null };
        case 'Pendiente Boleta': return { ...baseInfo, level: 4, gestionType: null };
        case 'No Presentado': return { ...baseInfo, level: 100, gestionType: null };
        default: return { ...baseInfo, level: 99, gestionType: null };
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