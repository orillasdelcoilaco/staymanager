/**
 * Bloque UI "operación plataforma" para feeds Google partner globales.
 * Provisional: visible para cualquier admin autenticado hasta rol superadmin (venta-ia §8).
 */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderGooglePartnerOperatorSection() {
    return `
        <div class="bg-warning-50 border border-warning-200 rounded-2xl shadow-sm p-5 mb-6">
            <h2 class="font-semibold text-gray-800 mb-1">Feeds globales Google (vista operación plataforma)</h2>
            <p class="text-xs text-gray-700 mb-3">
                <strong>Provisional:</strong> esta sección replica lo que verá un <strong>superadministrador / operador de plataforma</strong> cuando exista ese rol.
                Hoy cualquier administrador de empresa autenticado puede ejecutar la prueba HTTP (el token del feed <strong>nunca</strong> sale del servidor).
                Tras cerrar Google Hotels + rol plataforma, se restringirá por permisos y auditoría (<code class="text-xs">venta-ia.md</code> §8).
            </p>
            <div id="google-partner-operator-meta" class="text-sm text-gray-700 space-y-2 mb-4 font-mono text-xs break-all">
                <p class="text-gray-500 font-sans text-sm">Cargando URLs de referencia…</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                <button type="button" id="btn-google-partner-feed-selftest" class="btn-primary btn-sm gap-1">
                    <i class="fa-solid fa-plug-circle-check"></i>
                    Probar feeds HTTP (desde servidor)
                </button>
                <span class="text-xs text-gray-500">Equivale a <span class="font-mono">node backend/scripts/smoke-google-partner-feeds-http.js</span></span>
            </div>
            <pre id="google-partner-selftest-result" class="mt-4 hidden text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto max-h-64"></pre>
        </div>`;
}

function renderOperatorMeta(data) {
    const tokenOk = data.tokenConfigured ? 'sí' : 'no';
    return `
        <p><span class="font-sans font-semibold text-gray-800">Base usada para la prueba:</span> ${esc(data.selftestBaseUrl || '—')}</p>
        <p><span class="font-sans font-semibold text-gray-800">Token en servidor (GOOGLE_PARTNER_FEED_AUTH_TOKEN):</span> configurado = ${esc(tokenOk)}</p>
        <p><span class="font-sans font-semibold text-gray-800">properties.xml</span><br>${esc(data.propertiesUrlTemplate || '')}</p>
        <p><span class="font-sans font-semibold text-gray-800">ari.xml</span><br>${esc(data.ariUrlTemplate || '')}</p>
        ${data.hint ? `<p class="font-sans text-warning-800 text-xs">${esc(data.hint)}</p>` : ''}`;
}

export async function setupGooglePartnerOperatorUi(fetchAPI) {
    const meta = document.getElementById('google-partner-operator-meta');
    const pre = document.getElementById('google-partner-selftest-result');
    const btn = document.getElementById('btn-google-partner-feed-selftest');
    if (!meta || !btn) return;

    try {
        const data = await fetchAPI('/website/google-partner-feed-operator');
        meta.innerHTML = renderOperatorMeta(data);
    } catch (e) {
        meta.innerHTML = `<p class="text-danger-600 font-sans text-sm">${esc(e.message)}</p>`;
    }

    btn.addEventListener('click', async () => {
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Probando…';
        if (pre) {
            pre.classList.remove('hidden');
            pre.textContent = '…';
        }
        try {
            const out = await fetchAPI('/website/google-partner-feed-selftest', { method: 'POST', body: {} });
            if (pre) pre.textContent = JSON.stringify(out, null, 2);
            if (!out.ok) {
                alert(out.skipped ? (out.reason || 'No configurado') : (out.lastError || 'La prueba no pasó; revisa el recuadro.'));
            }
        } catch (e) {
            if (pre) pre.textContent = esc(e.message);
            alert(e.message || 'Error en la prueba');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });
}
