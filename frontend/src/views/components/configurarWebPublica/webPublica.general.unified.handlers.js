// Eventos del formulario unificado (extraído de setupUnifiedEvents).

import { collectHeatmapEventosForSave } from './webPublica.general.unified.heatmapEventosRows.js';

export function bindUnifiedRegen({ attach, fetchAPI, updateGeneratedContent }) {
    attach('btn-regen', async () => {
        const historia = document.getElementById('historia')?.value?.trim();
        if (!historia || historia.length < 20) {
            alert('Por favor, escribe una descripción del negocio de al menos 20 caracteres.');
            return;
        }

        const btn = document.getElementById('btn-regen');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

        try {
            const strategy = await fetchAPI('/website/optimize-profile', {
                method: 'POST',
                body: { historia },
            });

            if (document.getElementById('slogan')) document.getElementById('slogan').value = strategy.slogan || '';
            if (document.getElementById('tipo')) document.getElementById('tipo').value = strategy.tipoAlojamientoPrincipal || '';
            if (document.getElementById('enfoque')) document.getElementById('enfoque').value = strategy.enfoqueMarketing || '';
            if (document.getElementById('keywords')) document.getElementById('keywords').value = strategy.palabrasClaveAdicionales || '';

            updateGeneratedContent(strategy);

            alert('¡Estrategia regenerada con éxito! Revisa los campos actualizados.');
        } catch (error) {
            console.error('Error regenerando estrategia:', error);
            alert('Error al regenerar la estrategia. Intenta de nuevo.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

export function bindUnifiedTestIa({ attach, fetchAPI, updateGeneratedContent }) {
    attach('btn-test-ia', async () => {
        const historia = document.getElementById('historia')?.value?.trim();
        if (!historia || historia.length < 20) {
            alert('Por favor, escribe una descripción del negocio de al menos 20 caracteres.');
            return;
        }

        const btn = document.getElementById('btn-test-ia');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Probando IA...';

        try {
            const strategy = await fetchAPI('/website/optimize-profile', {
                method: 'POST',
                body: { historia },
            });

            const preview = `
            ✅ IA generó exitosamente:

            📝 Slogan: ${strategy.slogan || '(no generado)'}
            🏠 Tipo: ${strategy.tipoAlojamientoPrincipal || '(no generado)'}
            🎯 Enfoque: ${strategy.enfoqueMarketing || '(no generado)'}
            🔍 Keywords: ${strategy.palabrasClaveAdicionales || '(no generado)'}
            📄 Título H1: ${strategy.homeH1 || '(no generado)'}

            ¿Quieres aplicar estos cambios?`;

            if (confirm(preview)) {
                if (document.getElementById('slogan')) document.getElementById('slogan').value = strategy.slogan || '';
                if (document.getElementById('tipo')) document.getElementById('tipo').value = strategy.tipoAlojamientoPrincipal || '';
                if (document.getElementById('enfoque')) document.getElementById('enfoque').value = strategy.enfoqueMarketing || '';
                if (document.getElementById('keywords')) document.getElementById('keywords').value = strategy.palabrasClaveAdicionales || '';

                updateGeneratedContent(strategy);

                alert('¡Cambios aplicados! Revisa los campos actualizados.');
            }
        } catch (error) {
            console.error('Error probando IA:', error);
            alert('Error al probar la IA. Intenta de nuevo.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

export function bindUnifiedSave({
    attach, fetchAPI, empresa, onComplete, updateDomainPanel,
}) {
    const normalizeSubdomain = (raw) => String(raw || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63);

    attach('btn-save', async () => {
        const btn = document.getElementById('btn-save');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

        try {
            const subdomainRaw = document.getElementById('subdomain')?.value?.trim() || '';
            const subdomain = normalizeSubdomain(subdomainRaw);
            const customDomain = document.getElementById('domain')?.value?.trim() || '';

            // Mantener el input visible alineado con el valor canónico persistido.
            const subInput = document.getElementById('subdomain');
            if (subInput && subInput.value !== subdomain) subInput.value = subdomain;

            const heatmapEventos = collectHeatmapEventosForSave();
            if (!heatmapEventos.ok) {
                alert(heatmapEventos.message);
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }

            const payload = {
                historiaEmpresa: document.getElementById('historia')?.value || '',
                slogan: document.getElementById('slogan')?.value || '',
                tipoAlojamientoPrincipal: document.getElementById('tipo')?.value || '',
                enfoqueMarketing: document.getElementById('enfoque')?.value || '',
                palabrasClaveAdicionales: document.getElementById('keywords')?.value || '',
                strategy: {
                    slogan: document.getElementById('slogan')?.value || '',
                    tipoAlojamientoPrincipal: document.getElementById('tipo')?.value || '',
                    enfoqueMarketing: document.getElementById('enfoque')?.value || '',
                    palabrasClaveAdicionales: document.getElementById('keywords')?.value || '',
                    homeH1: document.querySelector('#content-h1')?.textContent || empresa.strategy?.homeH1 || '',
                    homeIntro: document.querySelector('#content-intro')?.textContent || empresa.strategy?.homeIntro || '',
                    homeSeoTitle: document.querySelector('#content-seo-title')?.textContent || empresa.strategy?.homeSeoTitle || '',
                    homeSeoDesc: document.querySelector('#content-seo-desc')?.textContent || empresa.strategy?.homeSeoDesc || '',
                },
            };

            const datosAEnviar = {
                general: {
                    subdomain,
                    domain: customDomain,
                    whatsapp: document.getElementById('whatsapp')?.value || '',
                    googleMapsUrl: document.getElementById('maps-url')?.value || '',
                    gaTrackingId: document.getElementById('ga-id')?.value || '',
                    wizardCompleted: true,
                },
                booking: {
                    depositoActivo: !!document.getElementById('deposito-activo')?.checked,
                    depositoTipo: document.getElementById('deposito-tipo')?.value === 'monto_fijo' ? 'monto_fijo' : 'porcentaje',
                    depositoPorcentaje: parseInt(document.getElementById('deposito-porcentaje')?.value || '10', 10) || 10,
                    depositoMontoSugeridoCLP: parseInt(document.getElementById('deposito-monto')?.value || '0', 10) || 0,
                    depositoHorasLimite: parseInt(document.getElementById('deposito-horas')?.value || '48', 10) || 48,
                    depositoNotaHtml: document.getElementById('deposito-nota-html')?.value || '',
                    garantiaModo: document.getElementById('garantia-modo')?.value || 'abono_manual',
                    garantiaDetalleOperacion: document.getElementById('garantia-detalle-operacion')?.value || '',
                    chatgptMascotasPolicyMode: document.getElementById('chatgpt-mascotas-policy-mode')?.value || 'auto',
                    chatgptMascotasCondicion: document.getElementById('chatgpt-mascotas-condicion')?.value || '',
                    eventosDemandaMapaCalor: heatmapEventos.items,
                },
                theme: {
                    logoUrl: document.getElementById('logo-url')?.value || '',
                    heroImageUrl: document.getElementById('hero-url')?.value || '',
                    heroImageAlt: document.querySelector('#content-hero-alt')?.textContent || document.getElementById('hero-alt')?.value || '',
                    heroImageTitle: document.querySelector('#content-hero-title')?.textContent || document.getElementById('hero-title')?.value || '',
                },
                content: {
                    homeH1: payload.strategy.homeH1,
                    homeIntro: payload.strategy.homeIntro,
                },
                seo: {
                    title: payload.strategy.homeSeoTitle,
                    description: payload.strategy.homeSeoDesc,
                    keywords: payload.strategy.palabrasClaveAdicionales,
                },
                integrations: {
                    ariFeedToken: (document.getElementById('integration-ari-token')?.value || '').trim(),
                    googleHotelsContentToken: (document.getElementById('integration-google-hotels-token')?.value || '').trim(),
                },
            };

            const responseHomeSettings = await fetchAPI('/website/home-settings', {
                method: 'PUT',
                body: datosAEnviar,
            });

            const responseEmpresa = await fetchAPI('/empresa', {
                method: 'PUT',
                body: {
                    historiaEmpresa: payload.historiaEmpresa,
                    slogan: payload.slogan,
                    tipoAlojamientoPrincipal: payload.tipoAlojamientoPrincipal,
                    enfoqueMarketing: payload.enfoqueMarketing,
                    palabrasClaveAdicionales: payload.palabrasClaveAdicionales,
                    strategy: payload.strategy,
                },
            });

            updateDomainPanel(responseHomeSettings?.domainInfo, subdomain, customDomain);

            if (onComplete && typeof onComplete === 'function') {
                onComplete(responseHomeSettings, responseEmpresa);
            } else {
                window.dispatchEvent(new CustomEvent('empresa-data-changed', {
                    detail: { empresa: responseEmpresa?.empresa || responseHomeSettings?.empresa },
                }));
            }
        } catch (error) {
            console.error('Error guardando configuración:', error);

            let mensajeError = '❌ Error al guardar la configuración. Intenta de nuevo.';

            if (error.message?.includes('website/home-settings')) {
                mensajeError = '❌ Error al guardar la configuración del website, pero los datos de empresa se guardaron correctamente.';
            } else if (error.message?.includes('/empresa')) {
                mensajeError = '✅ Configuración del website guardada, pero hubo un error al guardar algunos datos de empresa.';
            }

            alert(`${mensajeError}\n\nDetalle técnico: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

export function bindUnifiedPreview({ attach, empresa }) {
    attach('btn-preview', () => {
        const subdomainRaw = empresa.websiteSettings?.general?.subdomain
            || empresa.subdominio
            || (empresa.nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const subdomainConfigurado = (subdomainRaw || '').toLowerCase().replace(/[^a-z0-9-]/g, '');

        if (subdomainConfigurado) {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocal) {
                const url = `http://localhost:3001/?force_host=${subdomainConfigurado}.onrender.com`;
                console.log(`[Vista Previa] Abriendo: ${url}`);
                window.open(url, '_blank');
            } else {
                const url = `https://${subdomainConfigurado}.onrender.com`;
                console.log(`[Vista Previa] Abriendo: ${url}`);
                window.open(url, '_blank');
            }
        } else {
            alert('Primero guarda la configuración para generar el sitio.');
        }
    });
}

export function bindUnifiedLogoUpload({ fetchAPI, setStatus }) {
    const logoFileInput = document.getElementById('logoFile');
    if (!logoFileInput) return;

    logoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('logo-upload-status');
        setStatus(statusEl, 'Subiendo...', 'primary');

        const fd = new FormData();
        fd.append('logoFile', file);

        try {
            const r = await fetchAPI('/empresa/upload-logo', {
                method: 'POST',
                body: fd,
            });

            const preview = document.getElementById('logo-preview');
            const hidden = document.getElementById('logo-url');
            if (preview) preview.src = r.logoUrl;
            if (hidden) hidden.value = r.logoUrl;

            setStatus(statusEl, '¡Logo actualizado!', 'success');
        } catch (err) {
            setStatus(statusEl, `Error: ${err.message}`, 'danger');
        }
    });
}

export function bindUnifiedHeroUpload({ fetchAPI, setStatus }) {
    const heroFileInput = document.getElementById('heroFile');
    if (!heroFileInput) return;

    heroFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('hero-upload-status');
        setStatus(statusEl, 'Subiendo imagen de portada...', 'primary');

        const fd = new FormData();
        fd.append('heroImage', file);

        const altText = document.getElementById('hero-alt')?.value || '';
        const titleText = document.getElementById('hero-title')?.value || '';
        if (altText) fd.append('altText', altText);
        if (titleText) fd.append('titleText', titleText);

        try {
            console.log('[FRONTEND DEBUG] Enviando imagen hero...');
            const r = await fetchAPI('/website/upload-hero-image', {
                method: 'POST',
                body: fd,
            });

            console.log('[FRONTEND DEBUG] Respuesta recibida:', r);

            const preview = document.getElementById('hero-preview');
            const hidden = document.getElementById('hero-url');
            if (preview) preview.src = r['websiteSettings.theme.heroImageUrl'];
            if (hidden) hidden.value = r['websiteSettings.theme.heroImageUrl'];

            if (r['websiteSettings.theme.heroImageAlt']) {
                const altElement = document.querySelector('#content-hero-alt');
                const altInput = document.getElementById('hero-alt');
                if (altElement) altElement.textContent = r['websiteSettings.theme.heroImageAlt'];
                if (altInput) altInput.value = r['websiteSettings.theme.heroImageAlt'];
            }

            if (r['websiteSettings.theme.heroImageTitle']) {
                const titleElement = document.querySelector('#content-hero-title');
                const titleInput = document.getElementById('hero-title');
                if (titleElement) titleElement.textContent = r['websiteSettings.theme.heroImageTitle'];
                if (titleInput) titleInput.value = r['websiteSettings.theme.heroImageTitle'];
            }

            setStatus(statusEl, '¡Imagen de portada actualizada!', 'success');
        } catch (err) {
            setStatus(statusEl, `Error: ${err.message}`, 'danger');
        }
    });
}

function _badgeClass(semaforo) {
    if (semaforo === 'green') return 'bg-success-100 text-success-800 border-success-200';
    if (semaforo === 'yellow') return 'bg-warning-100 text-warning-800 border-warning-200';
    return 'bg-danger-100 text-danger-800 border-danger-200';
}

export async function loadGoogleHotelsHealth({ fetchAPI }) {
    const summary = document.getElementById('google-hotels-health-summary');
    const errorsRoot = document.getElementById('google-hotels-health-errors');
    const btn = document.getElementById('btn-google-hotels-health-refresh');
    const originalText = btn ? btn.innerHTML : '';
    if (!summary || !errorsRoot) return;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Actualizando...';
    }
    try {
        const r = await fetchAPI('/website/google-hotels-health');
        const sem = String(r?.semaforo || 'red');
        const listed = Number(r?.inventario?.listadas || 0);
        const missingHotelId = Number(r?.inventario?.missingHotelId || 0);
        const missingAddress = Number(r?.inventario?.missingAddress || 0);
        const jsonLdErrors = Array.isArray(r?.jsonLdStrict?.errores) ? r.jsonLdStrict.errores : [];
        const contentFeed = r?.feeds?.content || '-';
        const ariFeed = r?.feeds?.ari || '-';
        summary.innerHTML = `
            <div class="flex items-center justify-between gap-3">
                <span class="inline-flex items-center px-2 py-1 rounded border text-xs font-semibold ${_badgeClass(sem)}">
                    ${sem.toUpperCase()}
                </span>
                <span class="text-xs text-gray-500">Listadas: <strong>${listed}</strong></span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                <div class="bg-white border border-gray-200 rounded p-2">
                    <p class="font-semibold text-gray-700 mb-1">Feeds</p>
                    <p class="truncate"><span class="text-gray-500">Content:</span> ${contentFeed}</p>
                    <p class="truncate"><span class="text-gray-500">ARI:</span> ${ariFeed}</p>
                </div>
                <div class="bg-white border border-gray-200 rounded p-2">
                    <p class="font-semibold text-gray-700 mb-1">Issues críticos</p>
                    <p><span class="text-gray-500">Sin hotelId:</span> ${missingHotelId}</p>
                    <p><span class="text-gray-500">Sin dirección:</span> ${missingAddress}</p>
                    <p><span class="text-gray-500">JSON-LD:</span> ${jsonLdErrors.length}</p>
                </div>
            </div>
        `;
        if (!jsonLdErrors.length) {
            errorsRoot.innerHTML = `<div class="text-xs text-success-700 bg-success-50 border border-success-200 rounded p-2">JSON-LD strict OK en propiedades listadas.</div>`;
        } else {
            errorsRoot.innerHTML = jsonLdErrors.slice(0, 8).map((item) => `
                <div class="text-xs bg-warning-50 border border-warning-200 rounded p-2">
                    <p class="font-semibold text-warning-800">${item.nombre || item.propiedadId}</p>
                    <p class="text-warning-700">${(item.errores || []).join(' · ')}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        summary.innerHTML = `<div class="text-xs text-danger-700">No se pudo cargar el semáforo Google Hotels: ${error.message}</div>`;
        errorsRoot.innerHTML = '';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

export function bindGoogleHotelsHealthRefresh({ attach, fetchAPI }) {
    attach('btn-google-hotels-health-refresh', () => loadGoogleHotelsHealth({ fetchAPI }));
}
