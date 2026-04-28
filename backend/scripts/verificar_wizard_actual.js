/**
 * Verificación rápida de la configuración web pública **unificada** (§3.1).
 * Antes leía `webPublica.general.wizard.js` (flujo legacy retirado); ahora comprueba
 * que existan los módulos activos y marcas DNS en el markup unificado.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', 'frontend', 'src', 'views', 'components', 'configurarWebPublica');
const paths = {
    general: path.join(root, 'webPublica.general.js'),
    unified: path.join(root, 'webPublica.general.unified.js'),
    markup: path.join(root, 'webPublica.general.unified.markup.js'),
    handlers: path.join(root, 'webPublica.general.unified.handlers.js'),
};

console.log('=== Verificación configuración web pública (unificada) ===\n');

let ok = true;
for (const [name, p] of Object.entries(paths)) {
    const exists = fs.existsSync(p);
    console.log(`${exists ? 'OK ' : 'FALTA'} ${name}: ${p}`);
    if (!exists) ok = false;
}

const markup = fs.existsSync(paths.markup) ? fs.readFileSync(paths.markup, 'utf8') : '';
const handlers = fs.existsSync(paths.handlers) ? fs.readFileSync(paths.handlers, 'utf8') : '';
const checksMarkup = [
    ['id="dns-sync-error"', 'Bloque de error API / dominio (dns-sync-error)'],
    ['id="dns-instructions"', 'Panel instrucciones DNS'],
];
console.log('\n--- Marcas en markup ---');
for (const [needle, label] of checksMarkup) {
    const hit = markup.includes(needle);
    console.log(`${hit ? 'OK ' : 'FALTA'} ${label} (${needle})`);
    if (!hit) ok = false;
}
const apiNeedle = "'/website/home-settings'";
console.log('\n--- Guardado (handlers) ---');
if (!handlers.includes(apiNeedle)) {
    console.log(`FALTA PUT ${apiNeedle} en webPublica.general.unified.handlers.js`);
    ok = false;
} else {
    console.log(`OK  PUT /website/home-settings en handlers`);
}

const legacyWizard = path.join(root, 'webPublica.general.wizard.js');
const legacyView = path.join(root, 'webPublica.general.view.js');
console.log('\n--- Legacy retirado ---');
for (const p of [legacyWizard, legacyView]) {
    const still = fs.existsSync(p);
    if (still) {
        console.log(`WARN  Aún existe archivo legacy (debería eliminarse): ${p}`);
        ok = false;
    } else {
        console.log(`OK  No existe ${path.basename(p)}`);
    }
}

console.log(`\n=== Resultado: ${ok ? 'OK' : 'REVISAR'} ===`);
process.exit(ok ? 0 : 1);
