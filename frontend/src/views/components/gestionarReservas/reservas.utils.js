// frontend/src/views/components/gestionarReservas/reservas.utils.js

export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const datePart = dateString.split('T')[0];
    return new Date(datePart + 'T00:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL');
};

export const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

export const formatStars = (rating) => '⭐'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0));

export const formatForeign = (value, currency) => {
    if (!currency || currency === 'CLP') return formatCurrency(value);
    return `${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

export const formatPercent = (value) => {
    if (!value || value === 0) return '0%';
    return `${value.toFixed(1)}%`;
};