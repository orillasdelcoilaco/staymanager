// backend/public/js/checkout.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    if (!form) return;
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    const loadingSpinner = document.getElementById('loading-spinner');
    const buttonMainText = submitButton.querySelector('span:not(#loading-spinner)');
    // Support both IDs just in case
    const statusMessage = document.getElementById('status-message') || document.getElementById('error-message');
    let submitting = false;
    const lang = window.StayWebI18n?.getLang ? window.StayWebI18n.getLang() : (String(document.documentElement.lang || 'es').toLowerCase().startsWith('en') ? 'en' : 'es');
    const i18n = window.StayWebI18n?.dictionaries?.checkout || {};
    const tBase = window.StayWebI18n?.createTranslator
        ? window.StayWebI18n.createTranslator(i18n, lang)
        : ((key) => i18n[lang]?.[key] || i18n.es[key]);
    const t = (key, fallback = '') => tBase(key) || fallback;

    const setStatus = (message, kind = 'info') => {
        if (!statusMessage) return;
        statusMessage.classList.remove('hidden', 'text-danger-600', 'text-success-700', 'text-gray-600');
        if (!message) {
            statusMessage.textContent = '';
            statusMessage.classList.add('hidden');
            return;
        }
        statusMessage.textContent = String(message);
        if (kind === 'error') statusMessage.classList.add('text-danger-600');
        else if (kind === 'success') statusMessage.classList.add('text-success-700');
        else statusMessage.classList.add('text-gray-600');
    };

    const setSubmittingUI = (isSubmitting) => {
        submitting = !!isSubmitting;
        submitButton.disabled = submitting;
        submitButton.setAttribute('aria-busy', submitting ? 'true' : 'false');
        if (buttonMainText) buttonMainText.classList.toggle('hidden', submitting);
        if (loadingSpinner) loadingSpinner.classList.toggle('hidden', !submitting);
        if (!buttonMainText && !loadingSpinner) {
            submitButton.textContent = submitting ? t('processingFallback') : (submitButton.dataset.originalText || submitButton.textContent);
        }
    };

    const friendlyMessageByCode = (code, fallbackMsg) => {
        const c = String(code || '').trim();
        if (!c) return fallbackMsg;
        if (c === 'minimo_noches') return t('minimo_noches');
        if (c === 'dia_llegada_no_permitido') return t('dia_llegada_no_permitido');
        if (c === 'anticipacion_minima') return t('anticipacion_minima');
        if (c === 'ventana_reserva_meses') return t('ventana_reserva_meses');
        if (c === 'maximo_noches') return t('maximo_noches');
        if (c === 'fechas_invalidas') return t('fechas_invalidas');
        if (c === 'precio_desalineado') return t('precio_desalineado');
        if (c === 'terminos_no_aceptados') return t('terminos_no_aceptados');
        if (c === 'telefono_invalido') return t('telefono_invalido');
        if (c === 'rut_invalido') return t('rut_invalido');
        return fallbackMsg;
    };

    submitButton.dataset.originalText = submitButton.textContent;

    function normalizarTelefonoCL(raw) {
        const val = String(raw || '').trim().replace(/\s+/g, '');
        if (!val) return '';
        const clean = val.replace(/[^\d+]/g, '');
        if (/^\+569\d{8}$/.test(clean)) return clean;
        if (/^569\d{8}$/.test(clean)) return `+${clean}`;
        if (/^9\d{8}$/.test(clean)) return `+56${clean}`;
        return '';
    }

    function calcularDvRut(cuerpo) {
        let suma = 0;
        let multiplicador = 2;
        for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
            suma += Number(cuerpo[i]) * multiplicador;
            multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
        }
        const resto = 11 - (suma % 11);
        if (resto === 11) return '0';
        if (resto === 10) return 'K';
        return String(resto);
    }

    function normalizarRut(raw) {
        const val = String(raw || '').trim().toUpperCase();
        if (!val) return '';
        // Regla explícita producto: no se aceptan puntos.
        if (val.includes('.')) return null;
        if (!/^\d{7,8}-[\dK]$/.test(val)) return null;
        const [cuerpo, dv] = val.split('-');
        if (calcularDvRut(cuerpo) !== dv) return null;
        return `${cuerpo}-${dv}`;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitting) return;

        const telefonoInput = document.getElementById('telefono');
        const rutInput = document.getElementById('rut');
        const telefonoNormalizado = normalizarTelefonoCL(telefonoInput?.value || '');
        if (!telefonoNormalizado) {
            setStatus(t('phoneInvalid'), 'error');
            return;
        }
        if (telefonoInput) telefonoInput.value = telefonoNormalizado;

        const rutValue = rutInput?.value || '';
        const rutNormalizado = normalizarRut(rutValue);
        if (String(rutValue).trim() && !rutNormalizado) {
            setStatus(t('rutInvalid'), 'error');
            return;
        }
        if (rutInput) rutInput.value = rutNormalizado || '';

        // 1. Deshabilitar botón y mostrar carga
        setSubmittingUI(true);
        setStatus('');

        // 2. Obtener los datos del formulario
        const formData = new FormData(form);
        const formEntries = Object.fromEntries(formData.entries());

        // 3. Combinar con los datos de la reserva inyectados desde EJS (window.checkoutData)
        // Esto es CRÍTICO porque el formulario visual solo tiene datos de contacto,
        // pero necesitamos enviar propiedadId, fechas, precios, etc.
        const datosReserva = {
            ...window.checkoutData,
            ...formEntries
        };

        console.log("Enviando reserva:", datosReserva);

        // 4. Enviar al endpoint
        try {
            const response = await fetch('/crear-reserva-publica', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(datosReserva),
            });

            const resultado = await response.json().catch(() => ({}));

            if (!response.ok) {
                const err = new Error(resultado.error || t('genericError'));
                err.details = Array.isArray(resultado.details) ? resultado.details : [];
                err.code = resultado.code || '';
                throw err;
            }

            // 5. Éxito: Redirigir a confirmación
            setStatus(t('successRedirecting'), 'success');
            window.location.href = `/confirmacion?reservaId=${resultado.reservaId}`;

        } catch (error) {
            console.error("Error en reserva:", error);
            // 6. Error: Reactivar botón
            setSubmittingUI(false);
            const details = Array.isArray(error.details) ? error.details.filter(Boolean) : [];
            const primary = friendlyMessageByCode(error.code, error.message);
            const msg = details.length
                ? `${primary} ${t('detailPrefix')}: ${details.join(' · ')}`
                : primary;
            setStatus(`${t('errorPrefix')}: ${msg}`, 'error');
            if (statusMessage) {
                statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
});