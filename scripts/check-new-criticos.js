#!/usr/bin/env node
/**
 * check-new-criticos.js — Detecta críticos de complejidad NUEVOS vs. baseline guardado.
 *
 * Uso:
 *   node scripts/check-new-criticos.js           → compara contra baseline
 *   node scripts/check-new-criticos.js --update  → guarda el estado actual como nuevo baseline
 *
 * Exit codes:
 *   0 = sin críticos nuevos (o actualización exitosa)
 *   1 = hay críticos nuevos → bloquea el pre-push hook
 *
 * El baseline se guarda en TASKS/complexity-baseline.json
 */

const fs   = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, '..', 'TASKS', 'complexity-baseline.json');
const UPDATE_MODE   = process.argv.includes('--update');

// ─── Reutilizamos la lógica de audit-complexity ────────────────────────────

const DIRS = [
    { dir: path.join(__dirname, '..', 'frontend', 'src'),     exts: ['.js'] },
    { dir: path.join(__dirname, '..', 'backend', 'services'), exts: ['.js'] },
    { dir: path.join(__dirname, '..', 'backend', 'routes'),   exts: ['.js'] },
];

const THRESHOLDS = {
    file:    { critical: 700  },
    fn:      { critical: 120  },
    exports: { critical: 15   },
};

function collectFiles(dir, exts) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...collectFiles(full, exts));
        else if (exts.some(e => entry.name.endsWith(e))) results.push(full);
    }
    return results;
}

function relPath(p) {
    return path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/');
}

function extractFunctions(src, lines) {
    const fns = [];
    const re  = /(?:async\s+)?function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s+)?function\s*\(/gm;
    let match;
    while ((match = re.exec(src)) !== null) {
        const name = match[1] || match[2] || match[3] || '(anónima)';
        const startLine = src.slice(0, match.index).split('\n').length;
        let depth = 0, endLine = startLine, inFn = false;
        for (let i = startLine - 1; i < lines.length; i++) {
            for (const ch of lines[i]) {
                if (ch === '{') { depth++; inFn = true; }
                if (ch === '}') depth--;
            }
            if (inFn && depth === 0) { endLine = i + 1; break; }
        }
        const length = endLine - startLine + 1;
        if (length >= THRESHOLDS.fn.critical) fns.push({ name, startLine, length });
    }
    return fns;
}

function countExports(src) {
    const objExport = src.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (objExport) return (objExport[1].match(/\w+/g) || []).length;
    const matches = src.match(/\bmodule\.exports\b|\bexport\s+(?:default\s+)?(?:function|const|class|async)/g);
    return matches ? matches.length : 0;
}

// ─── Escaneo ───────────────────────────────────────────────────────────────

function escanear() {
    const criticos = [];

    for (const { dir, exts } of DIRS) {
        for (const filePath of collectFiles(dir, exts)) {
            const src   = fs.readFileSync(filePath, 'utf8');
            const lines = src.split('\n');
            const rel   = relPath(filePath);

            if (lines.length >= THRESHOLDS.file.critical) {
                criticos.push({ file: rel, type: 'file-size', detail: `${lines.length} líneas` });
            }

            for (const fn of extractFunctions(src, lines)) {
                criticos.push({ file: rel, type: 'function-size', detail: `${fn.name} — ${fn.length} líneas (línea ${fn.startLine})` });
            }

            if (countExports(src) >= THRESHOLDS.exports.critical) {
                criticos.push({ file: rel, type: 'too-many-exports', detail: `${countExports(src)} exports` });
            }
        }
    }

    return criticos;
}

// ─── Clave única por crítico ───────────────────────────────────────────────
// Usa archivo + tipo + nombre (sin conteo de líneas) para que cambios de tamaño
// en un crítico ya conocido no se detecten falsamente como "nuevo".

function clave(c) {
    // Para function-size y too-many-exports, extraer solo el nombre de la función/archivo
    // Ej: "afterRender — 239 líneas (línea 239)" → "afterRender"
    const nombre = c.detail.split(/\s+[—–-]/)[0].trim();
    return `${c.file}::${c.type}::${nombre}`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const actuales = escanear();

if (UPDATE_MODE) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({
        fecha: new Date().toISOString(),
        total: actuales.length,
        criticos: actuales
    }, null, 2));
    console.log(`\n✅ Baseline actualizado: ${actuales.length} críticos guardados en TASKS/complexity-baseline.json\n`);
    process.exit(0);
}

// ─── Comparar contra baseline ──────────────────────────────────────────────

if (!fs.existsSync(BASELINE_PATH)) {
    console.log('\n⚠️  No existe baseline. Ejecuta primero:\n   node scripts/check-new-criticos.js --update\n');
    process.exit(0);
}

const baseline  = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const claveBase = new Set(baseline.criticos.map(clave));

const nuevos = actuales.filter(c => !claveBase.has(clave(c)));

if (nuevos.length === 0) {
    console.log(`\n✅ Sin críticos nuevos. (${actuales.length} críticos totales, ${baseline.total} en baseline)\n`);
    process.exit(0);
}

console.log(`\n🔴 ${nuevos.length} CRÍTICO(S) NUEVO(S) detectado(s):\n`);
for (const c of nuevos) {
    console.log(`  ❌ [${c.type}] ${c.file}`);
    console.log(`      ${c.detail}`);
}
console.log(`\n  Refactoriza antes de hacer push.`);
console.log(`  Si decides aceptar este estado, actualiza el baseline:`);
console.log(`  node scripts/check-new-criticos.js --update\n`);

process.exit(1);
