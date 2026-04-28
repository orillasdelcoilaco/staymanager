// backend/scripts/verify_ssr_integrity.js
/**
 * Comprueba HTML de ficha pública /propiedad/:id con ?force_host= (plan release 1.0.0 — test:ssr opcional).
 *
 * Variables (backend/.env o entorno), opcionales:
 *   SSR_VERIFY_BASE_URL       default http://localhost:3001
 *   SSR_VERIFY_PROPERTY_ID    UUID Firestore de la propiedad en ese tenant
 *   SSR_VERIFY_FORCE_HOST     host del tenant (ej. midominio.suitemanagers.com o *.onrender.com)
 */
const http = require('http');
const path = require('path');

try {
    // Cargar .env del backend si existe (sin fallar si no hay dotenv)
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {
    /* optional */
}

const BASE_URL = (process.env.SSR_VERIFY_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const TEST_PROPERTY_ID = process.env.SSR_VERIFY_PROPERTY_ID || '7lzqGKUxuQK0cttYeH0y';
const FORCE_HOST = (process.env.SSR_VERIFY_FORCE_HOST || 'prueba1.suitemanagers.com').replace(/^https?:\/\//i, '').split('/')[0];

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function looksLikePanelSpaShell(html) {
    const t = String(html || '');
    if (t.includes('booking-widget-container')) return false;
    if (t.length > 12000) return false;
    return /<title>\s*SuiteManager\s*<\/title>/i.test(t) || /\bid=["']app["']/i.test(t) || /\bid=["']root["']/i.test(t);
}

console.log(`${GREEN}=== SSR INTEGRITY GUARDIAN ===${RESET}`);
console.log(`Target: ${BASE_URL}/propiedad/${TEST_PROPERTY_ID}?force_host=${FORCE_HOST}`);
if (!process.env.SSR_VERIFY_FORCE_HOST || !process.env.SSR_VERIFY_PROPERTY_ID) {
    console.log(`${RESET}(Usando defaults; si falla, define SSR_VERIFY_FORCE_HOST y SSR_VERIFY_PROPERTY_ID en backend/.env)${RESET}`);
}

function checkIntegrity() {
    const url = `${BASE_URL}/propiedad/${TEST_PROPERTY_ID}?force_host=${encodeURIComponent(FORCE_HOST)}`;

    http.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.error(`${RED}[FAIL] HTTP Status: ${res.statusCode}${RESET}`);
            process.exit(1);
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            let errors = [];
            const warnings = [];

            if (looksLikePanelSpaShell(data)) {
                errors.push(
                    'La respuesta parece el shell del panel (SPA), no la ficha SSR: el tenant no resolvió con force_host o el ID no pertenece a esa empresa. '
                    + 'En backend/.env define SSR_VERIFY_FORCE_HOST (host real del tenant en tu BD) y SSR_VERIFY_PROPERTY_ID (UUID de una propiedad de esa empresa).',
                );
            } else {
                // 1. Check for CSS Fix (Image Sizing)
                if (!data.includes('custom-gallery-height')) {
                    errors.push("Missing critical CSS class '.custom-gallery-height' for image sizing.");
                } else {
                    console.log(`${GREEN}[PASS] CSS Fix (.custom-gallery-height) found.${RESET}`);
                }

                // 2. Check for Booking Widget Container
                if (!data.includes('id="booking-widget-container"')) {
                    errors.push("Missing '#booking-widget-container'. Booking widget may not render.");
                } else {
                    console.log(`${GREEN}[PASS] Booking Widget container found.${RESET}`);
                }

                // 3. Check for Data Attribute Injection
                if (!data.includes('data-booking-config=')) {
                    errors.push("Missing 'data-booking-config' attribute. Widget data injection failed.");
                } else {
                    try {
                        const match = data.match(/data-booking-config='([^']+)'/);
                        if (match && match[1]) {
                            JSON.parse(match[1]);
                            console.log(`${GREEN}[PASS] Data Attribute JSON is valid.${RESET}`);
                        } else {
                            const matchD = data.match(/data-booking-config="([^"]+)"/);
                            if (matchD && matchD[1]) {
                                JSON.parse(matchD[1].replace(/&quot;/g, '"'));
                                console.log(`${GREEN}[PASS] Data Attribute JSON (escaped) is valid.${RESET}`);
                            } else {
                                warnings.push("Could not extract data-booking-config value for validation, but attribute exists.");
                            }
                        }
                    } catch (e) {
                        errors.push("Invalid JSON in 'data-booking-config'.");
                    }
                }

                if (data.includes('Error al cargar (B01)')) {
                    errors.push("Found 'Error al cargar (B01)' in HTML output.");
                }
                if (data.includes('ReferenceError')) {
                    errors.push("Found 'ReferenceError' stack trace in HTML.");
                }
            }

            warnings.forEach((w) => console.warn(`${RESET}[WARN] ${w}${RESET}`));

            // Report
            if (errors.length > 0) {
                console.error(`\n${RED}!!! INTEGRITY CHECK FAILED !!!${RESET}`);
                errors.forEach(e => console.error(`- ${e}`));
                process.exit(1);
            } else {
                console.log(`\n${GREEN}*** ALL SYSTEMS GO. SSR IS HEALTHY. ***${RESET}`);
                process.exit(0);
            }
        });

    }).on('error', (err) => {
        console.error(`${RED}[FATAL] Could not connect to server: ${err.message}${RESET}`);
        process.exit(1);
    });
}

// Run
checkIntegrity();
