// frontend/src/views/components/configurarWebPublica/webPublica.general.unified.js
// Formulario único para configuración web pública - Reemplaza wizard + vista
import { fetchAPI } from '../../../api.js';
import { buildUnifiedMarkup } from './webPublica.general.unified.markup.js';
import {
    bindUnifiedRegen,
    bindUnifiedTestIa,
    bindUnifiedSave,
    bindUnifiedPreview,
    bindUnifiedLogoUpload,
    bindUnifiedHeroUpload,
    bindGoogleHotelsHealthRefresh,
    loadGoogleHotelsHealth,
} from './webPublica.general.unified.handlers.js';
import { initHeatmapEventosRowsEditor } from './webPublica.general.unified.heatmapEventosRows.js';

// --- Helpers ---
const setStatus = (el, text, type = 'primary') => {
    if (!el) return;
    el.textContent = text;
    el.className = `text-xs mt-1 text-${type}-600`;
};
const attach = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ne = el.cloneNode(true);
    el.parentNode.replaceChild(ne, el);
    ne.addEventListener('click', fn);
};

// --- Helper para actualizar contenido generado por IA ---
function _updateGeneratedContent(strategy) {
    const updateElement = (selector, text) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = text || 'Se generará automáticamente';
    };

    updateElement('#content-historia-opt', strategy.historiaOptimizada);
    updateElement('#content-h1', strategy.homeH1);
    updateElement('#content-intro', strategy.homeIntro);
    updateElement('#content-seo-title', strategy.homeSeoTitle);
    updateElement('#content-seo-desc', strategy.homeSeoDesc);

    if (strategy.heroImageAlt) {
        updateElement('#content-hero-alt', strategy.heroImageAlt);
        const altInput = document.getElementById('hero-alt');
        if (altInput) altInput.value = strategy.heroImageAlt;
    }
    if (strategy.heroImageTitle) {
        updateElement('#content-hero-title', strategy.heroImageTitle);
        const titleInput = document.getElementById('hero-title');
        if (titleInput) titleInput.value = strategy.heroImageTitle;
    }
}

// --- Render único ---
export function renderUnified(empresaData) {
    console.log('[FRONTEND DEBUG] renderUnified llamado con empresaData:', empresaData);
    const theme = (empresaData || {}).websiteSettings?.theme || {};
    const strategy = (empresaData || {}).strategy || {};

    console.log('[FRONTEND DEBUG] Datos para render:');
    console.log('  - theme.heroImageAlt:', theme.heroImageAlt);
    console.log('  - theme.heroImageTitle:', theme.heroImageTitle);
    console.log('  - strategy.heroImageAlt:', strategy.heroImageAlt);
    console.log('  - strategy.heroImageTitle:', strategy.heroImageTitle);

    return buildUnifiedMarkup(empresaData);
}

// --- Actualiza el panel de dominio tras guardar ---
function _updateDomainPanel(domainInfo, subdomain, customDomain) {
    const subEl = document.getElementById('subdomain-display');
    const subLink = document.getElementById('subdomain-link');
    if (subEl && subdomain) {
        subEl.textContent = `${subdomain}.suitemanagers.com`;
    }
    if (subLink && subdomain) {
        subLink.href = `https://${subdomain}.suitemanagers.com`;
        subLink.classList.remove('opacity-40', 'pointer-events-none');
    }

    const customEl = document.getElementById('custom-domain-status');
    const customDisplay = document.getElementById('custom-domain-display');
    if (customDomain && customEl && customDisplay) {
        customDisplay.textContent = customDomain;
        customEl.classList.remove('hidden');
    } else if (!customDomain && customEl) {
        customEl.classList.add('hidden');
    }

    const dnsPanel = document.getElementById('dns-instructions');
    if (!dnsPanel) return;

    if (domainInfo?.instructions && !domainInfo?.error) {
        const ins = domainInfo.instructions;
        document.getElementById('dns-type').textContent = ins.type || 'CNAME';
        document.getElementById('dns-host').textContent = ins.host || 'www';
        document.getElementById('dns-value').textContent = ins.value || '-';
        document.getElementById('dns-note').textContent = ins.note || '';
        dnsPanel.classList.remove('hidden');
    } else {
        dnsPanel.classList.add('hidden');
    }
}

// --- Setup de eventos ---
export function setupUnifiedEvents(empresaData, onComplete = null) {
    const empresa = empresaData || {};

    bindUnifiedRegen({
        attach,
        fetchAPI,
        updateGeneratedContent: _updateGeneratedContent,
    });
    bindUnifiedTestIa({
        attach,
        fetchAPI,
        updateGeneratedContent: _updateGeneratedContent,
    });
    bindUnifiedSave({
        attach,
        fetchAPI,
        empresa,
        onComplete,
        updateDomainPanel: _updateDomainPanel,
    });
    bindUnifiedPreview({ attach, empresa });
    bindUnifiedLogoUpload({ fetchAPI, setStatus });
    bindUnifiedHeroUpload({ fetchAPI, setStatus });
    bindGoogleHotelsHealthRefresh({ attach, fetchAPI });
    loadGoogleHotelsHealth({ fetchAPI }).catch((e) => console.warn('[google-hotels-health]', e.message));

    initHeatmapEventosRowsEditor(empresa.websiteSettings?.booking || {});
}

// --- Reset (para reconfigurar) ---
export function resetUnified() {
    console.log('Formulario unificado listo para usar');
}
