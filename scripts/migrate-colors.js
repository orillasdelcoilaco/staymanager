#!/usr/bin/env node
/**
 * migrate-colors.js — Migración masiva de colores Tailwind hardcodeados a tokens del design system
 *
 * Reemplaza:
 *   blue-N/indigo-N  -> primary-N
 *   red-N            -> danger-N
 *   green-N          -> success-N
 *   yellow-N         -> warning-N
 *
 * Uso: node scripts/migrate-colors.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend', 'src');
const VIEWS_DIR    = path.join(__dirname, '..', 'backend', 'views');

// ─── Mapa de reemplazos (orden importa: más específico primero) ────────────
const REPLACEMENTS = [
    // Azul/Índigo → primary
    [/\bbg-blue-(\d+)\b/g,       'bg-primary-$1'],
    [/\btext-blue-(\d+)\b/g,     'text-primary-$1'],
    [/\bborder-blue-(\d+)\b/g,   'border-primary-$1'],
    [/\bring-blue-(\d+)\b/g,     'ring-primary-$1'],
    [/\bdivide-blue-(\d+)\b/g,   'divide-primary-$1'],
    [/\bbg-indigo-(\d+)\b/g,     'bg-primary-$1'],
    [/\btext-indigo-(\d+)\b/g,   'text-primary-$1'],
    [/\bborder-indigo-(\d+)\b/g, 'border-primary-$1'],
    [/\bring-indigo-(\d+)\b/g,   'ring-primary-$1'],
    [/\bdivide-indigo-(\d+)\b/g, 'divide-primary-$1'],
    // hover/focus variantes azul/índigo
    [/\bhover:bg-blue-(\d+)\b/g,       'hover:bg-primary-$1'],
    [/\bhover:text-blue-(\d+)\b/g,     'hover:text-primary-$1'],
    [/\bhover:border-blue-(\d+)\b/g,   'hover:border-primary-$1'],
    [/\bhover:bg-indigo-(\d+)\b/g,     'hover:bg-primary-$1'],
    [/\bhover:text-indigo-(\d+)\b/g,   'hover:text-primary-$1'],
    [/\bhover:border-indigo-(\d+)\b/g, 'hover:border-primary-$1'],
    [/\bfocus:ring-blue-(\d+)\b/g,     'focus:ring-primary-$1'],
    [/\bfocus:ring-indigo-(\d+)\b/g,   'focus:ring-primary-$1'],
    [/\bfocus:border-blue-(\d+)\b/g,   'focus:border-primary-$1'],
    [/\bfocus:border-indigo-(\d+)\b/g, 'focus:border-primary-$1'],

    // Rojo → danger
    [/\bbg-red-(\d+)\b/g,       'bg-danger-$1'],
    [/\btext-red-(\d+)\b/g,     'text-danger-$1'],
    [/\bborder-red-(\d+)\b/g,   'border-danger-$1'],
    [/\bring-red-(\d+)\b/g,     'ring-danger-$1'],
    [/\bhover:bg-red-(\d+)\b/g,   'hover:bg-danger-$1'],
    [/\bhover:text-red-(\d+)\b/g, 'hover:text-danger-$1'],
    [/\bfocus:ring-red-(\d+)\b/g, 'focus:ring-danger-$1'],

    // Verde → success
    [/\bbg-green-(\d+)\b/g,       'bg-success-$1'],
    [/\btext-green-(\d+)\b/g,     'text-success-$1'],
    [/\bborder-green-(\d+)\b/g,   'border-success-$1'],
    [/\bring-green-(\d+)\b/g,     'ring-success-$1'],
    [/\bhover:bg-green-(\d+)\b/g,   'hover:bg-success-$1'],
    [/\bhover:text-green-(\d+)\b/g, 'hover:text-success-$1'],
    [/\bfocus:ring-green-(\d+)\b/g, 'focus:ring-success-$1'],

    // Amarillo → warning
    [/\bbg-yellow-(\d+)\b/g,       'bg-warning-$1'],
    [/\btext-yellow-(\d+)\b/g,     'text-warning-$1'],
    [/\bborder-yellow-(\d+)\b/g,   'border-warning-$1'],
    [/\bring-yellow-(\d+)\b/g,     'ring-warning-$1'],
    [/\bhover:bg-yellow-(\d+)\b/g,   'hover:bg-warning-$1'],
    [/\bhover:text-yellow-(\d+)\b/g, 'hover:text-warning-$1'],
    [/\bfocus:ring-yellow-(\d+)\b/g, 'focus:ring-warning-$1'],
];

// ─── Utilidades ────────────────────────────────────────────────────────────

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

const files = [
    ...collectFiles(FRONTEND_DIR, ['.js']),
    ...collectFiles(VIEWS_DIR,    ['.ejs']),
];

let totalFiles = 0;
let totalReplacements = 0;

for (const filePath of files) {
    let src = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    let fileReplacements = 0;

    for (const [regex, replacement] of REPLACEMENTS) {
        const next = src.replace(regex, replacement);
        if (next !== src) {
            const count = (src.match(regex) || []).length;
            fileReplacements += count;
            src = next;
            changed = true;
        }
    }

    if (changed) {
        totalFiles++;
        totalReplacements += fileReplacements;
        const rel = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
        console.log(`  ✏️  ${rel} (${fileReplacements} reemplazos)`);
        if (!DRY_RUN) fs.writeFileSync(filePath, src, 'utf8');
    }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}✅ ${totalReplacements} reemplazos en ${totalFiles} archivos.`);
if (DRY_RUN) console.log('Para aplicar los cambios: node scripts/migrate-colors.js');
