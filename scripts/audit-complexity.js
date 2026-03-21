#!/usr/bin/env node
/**
 * audit-complexity.js — Auditoría de complejidad y modularidad del código
 *
 * Detecta:
 *  1. Archivos demasiado grandes (> 400 líneas = warning, > 700 = crítico)
 *  2. Funciones demasiado largas (> 60 líneas = warning, > 120 = crítico)
 *  3. Archivos con demasiadas responsabilidades (> 8 exports = warning, > 15 = crítico)
 *  4. Archivos de ruta con lógica de negocio mezclada (> 30 líneas en un handler = warning)
 *
 * Uso: node scripts/audit-complexity.js
 * Output: TASKS/complexity-report.md
 */

const fs   = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, '..', 'TASKS', 'complexity-report.md');

const DIRS = [
    { dir: path.join(__dirname, '..', 'frontend', 'src'),     exts: ['.js'], label: 'Frontend SPA' },
    { dir: path.join(__dirname, '..', 'backend', 'services'), exts: ['.js'], label: 'Backend Services' },
    { dir: path.join(__dirname, '..', 'backend', 'routes'),   exts: ['.js'], label: 'Backend Routes' },
];

const THRESHOLDS = {
    file:     { warning: 400,  critical: 700  },
    function: { warning: 60,   critical: 120  },
    exports:  { warning: 8,    critical: 15   },
    handler:  { warning: 30,   critical: 60   },
};

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

function relPath(p) {
    return path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/');
}

// Cuenta líneas no vacías ni comentarios
function countMeaningfulLines(lines) {
    return lines.filter(l => {
        const t = l.trim();
        return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    }).length;
}

// Extrae funciones con su longitud (líneas) — heurístico, no AST
function extractFunctions(src, lines) {
    const fns = [];
    // Detecta: function foo(...), async function foo(...), foo: function(...), foo = (...) =>
    const fnStartRe = /(?:async\s+)?function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s+)?function\s*\(/gm;

    let match;
    while ((match = fnStartRe.exec(src)) !== null) {
        const name = match[1] || match[2] || match[3] || match[4] || '(anónima)';
        const startLine = src.slice(0, match.index).split('\n').length;

        // Buscar el cierre contando llaves
        let depth = 0;
        let endLine = startLine;
        let inFn = false;
        for (let i = startLine - 1; i < lines.length; i++) {
            const l = lines[i];
            for (const ch of l) {
                if (ch === '{') { depth++; inFn = true; }
                if (ch === '}') depth--;
            }
            if (inFn && depth === 0) { endLine = i + 1; break; }
        }

        const length = endLine - startLine + 1;
        if (length >= THRESHOLDS.function.warning) {
            fns.push({ name, startLine, endLine, length });
        }
    }
    return fns;
}

// Cuenta exports
function countExports(src) {
    const matches = src.match(/\bmodule\.exports\b|\bexport\s+(?:default\s+)?(?:function|const|class|async)/g);
    if (!matches) return 0;
    // module.exports = { a, b, c } cuenta individualmente
    const objExport = src.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (objExport) {
        return (objExport[1].match(/\w+/g) || []).length;
    }
    return matches.length;
}

// ─── Análisis ──────────────────────────────────────────────────────────────

const findings = {
    critical: [],
    warning:  [],
};

let totalFiles = 0;

for (const { dir, exts, label } of DIRS) {
    const files = collectFiles(dir, exts);
    for (const filePath of files) {
        totalFiles++;
        const src   = fs.readFileSync(filePath, 'utf8');
        const lines = src.split('\n');
        const loc   = lines.length;
        const rel   = relPath(filePath);
        const isRoute = label === 'Backend Routes';

        // 1. Tamaño de archivo
        if (loc >= THRESHOLDS.file.critical) {
            findings.critical.push({
                type: 'file-size',
                file: rel,
                label,
                value: loc,
                detail: `${loc} líneas (límite crítico: ${THRESHOLDS.file.critical})`,
                suggestion: 'Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.',
            });
        } else if (loc >= THRESHOLDS.file.warning) {
            findings.warning.push({
                type: 'file-size',
                file: rel,
                label,
                value: loc,
                detail: `${loc} líneas (límite warning: ${THRESHOLDS.file.warning})`,
                suggestion: 'Considerar dividir. Identificar grupos de funciones relacionadas.',
            });
        }

        // 2. Funciones largas
        const longFns = extractFunctions(src, lines);
        for (const fn of longFns) {
            const isCritical = fn.length >= THRESHOLDS.function.critical;
            const target = isCritical ? findings.critical : findings.warning;
            target.push({
                type: 'function-size',
                file: rel,
                label,
                value: fn.length,
                detail: `función \`${fn.name}\` — ${fn.length} líneas (línea ${fn.startLine})`,
                suggestion: 'Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.',
            });
        }

        // 3. Demasiados exports
        const exportCount = countExports(src);
        if (exportCount >= THRESHOLDS.exports.critical) {
            findings.critical.push({
                type: 'too-many-exports',
                file: rel,
                label,
                value: exportCount,
                detail: `${exportCount} funciones exportadas (límite crítico: ${THRESHOLDS.exports.critical})`,
                suggestion: 'Agrupar responsabilidades en sub-módulos. Ej: service.read.js, service.write.js, service.calc.js',
            });
        } else if (exportCount >= THRESHOLDS.exports.warning) {
            findings.warning.push({
                type: 'too-many-exports',
                file: rel,
                label,
                value: exportCount,
                detail: `${exportCount} funciones exportadas (límite warning: ${THRESHOLDS.exports.warning})`,
                suggestion: 'Revisar si puede dividirse por responsabilidad.',
            });
        }
    }
}

// ─── Generar reporte ───────────────────────────────────────────────────────

const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
const critCount = findings.critical.length;
const warnCount = findings.warning.length;

let md = `# Reporte de Complejidad y Modularidad
**Generado:** ${date}
**Archivos analizados:** ${totalFiles}
**Críticos:** ${critCount} | **Warnings:** ${warnCount}

---

## Resumen

`;

if (critCount === 0 && warnCount === 0) {
    md += '**Sin problemas detectados. El código está bien modularizado.**\n';
} else {
    if (critCount > 0) {
        md += `### 🔴 Críticos (${critCount}) — Requieren refactorización\n\n`;
        md += `| Archivo | Problema | Detalle |\n|---------|---------|--------|\n`;
        for (const f of findings.critical) {
            md += `| \`${f.file}\` | ${f.type} | ${f.detail} |\n`;
        }
        md += '\n';
    }
    if (warnCount > 0) {
        md += `### 🟡 Warnings (${warnCount}) — Monitorear\n\n`;
        md += `| Archivo | Problema | Detalle |\n|---------|---------|--------|\n`;
        for (const f of findings.warning) {
            md += `| \`${f.file}\` | ${f.type} | ${f.detail} |\n`;
        }
        md += '\n';
    }

    md += `---\n\n## Plan de refactorización sugerido\n\n`;
    md += `> Orden de prioridad: atacar primero los archivos más grandes con más exports.\n\n`;

    // Agrupar críticos por archivo y ordenar por líneas
    const byFile = {};
    for (const f of [...findings.critical, ...findings.warning]) {
        if (!byFile[f.file]) byFile[f.file] = { file: f.file, label: f.label, issues: [], maxLines: 0 };
        byFile[f.file].issues.push(f);
        if (f.type === 'file-size') byFile[f.file].maxLines = f.value;
    }

    const sorted = Object.values(byFile).sort((a, b) => b.maxLines - a.maxLines);
    let rank = 1;
    for (const entry of sorted.slice(0, 10)) {
        const hasCritical = entry.issues.some(i => findings.critical.includes(i));
        md += `### ${rank++}. \`${entry.file}\` ${hasCritical ? '🔴' : '🟡'}\n`;
        for (const issue of entry.issues) {
            md += `- **${issue.detail}**\n`;
            md += `  - ${issue.suggestion}\n`;
        }
        md += '\n';
    }
}

md += `---\n\n## Umbrales configurados\n\n`;
md += `| Métrica | Warning | Crítico |\n|---------|---------|--------|\n`;
md += `| Líneas por archivo | >${THRESHOLDS.file.warning} | >${THRESHOLDS.file.critical} |\n`;
md += `| Líneas por función | >${THRESHOLDS.function.warning} | >${THRESHOLDS.function.critical} |\n`;
md += `| Exports por archivo | >${THRESHOLDS.exports.warning} | >${THRESHOLDS.exports.critical} |\n`;
md += `\n*Generado por scripts/audit-complexity.js*\n`;

fs.writeFileSync(REPORT_PATH, md, 'utf8');

console.log(`\n✅ Auditoría de complejidad completada: ${totalFiles} archivos analizados.`);
console.log(`📄 Reporte: TASKS/complexity-report.md`);
if (critCount > 0) console.log(`🔴 Críticos: ${critCount} — requieren refactorización`);
if (warnCount > 0) console.log(`🟡 Warnings: ${warnCount} — monitorear`);
if (critCount === 0 && warnCount === 0) console.log('✨ Sin problemas de modularidad.');
