/**
 * Toast global ligero para el SPA (sin dependencia de una vista concreta).
 */
let toastEl = null;
let hideTimer = null;

const VARIANT = {
    success: 'bg-success-50 border-success-200 text-success-900',
    danger: 'bg-danger-50 border-danger-200 text-danger-900',
    warning: 'bg-warning-50 border-warning-200 text-warning-900',
    info: 'bg-primary-50 border-primary-100 text-primary-900',
};

/**
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} [variant='info']
 * @param {number} [durationMs=5200]
 */
export function showAppToast(message, variant = 'info', durationMs = 5200) {
    if (typeof document === 'undefined') return;
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'app-toast-global';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        toastEl.className =
            'hidden fixed bottom-6 right-6 z-[100] max-w-md rounded-lg shadow-lg border px-4 py-3 text-sm';
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    const vc = VARIANT[variant] || VARIANT.info;
    toastEl.className = `fixed bottom-6 right-6 z-[100] max-w-md rounded-lg shadow-lg border px-4 py-3 text-sm ${vc}`;
    toastEl.classList.remove('hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        toastEl?.classList.add('hidden');
    }, durationMs);
}
