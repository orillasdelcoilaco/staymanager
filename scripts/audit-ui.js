#!/usr/bin/env node
/**
 * audit-ui.js — Auditoría automática de consistencia visual
 *
 * Detecta:
 *  1. Colores Tailwind hardcodeados que deberían usar tokens (.btn-primary, primary-600, etc.)
 *  2. Botones con clases Tailwind directas en vez de .btn-*
 *  3. Sombras y bordes hardcodeados que deberían usar tokens
 *
 * Uso: node scripts/audit-ui.js
 * Output: TASKS/audit-report.md
 */

const fs   = require('fs');
const path = require('path');

const FRONTEND_DIR  = path.join(__dirname, '..', 'frontend', 'src');
const VIEWS_DIR     = path.join(__dirname, '..', 'backend', 'views');
const REPORT_PATH   = path.join(__dirname, '..', 'TASKS', 'audit-report.md');

// ─── Patrones a detectar ───────────────────────────────────────────────────

const PATTERNS = [
    {
        id: 'hardcoded-blue',
        label: 'Azul hardcodeado (debería usar primary-*)',
        regex: /\bbg-(?:blue|indigo)-\d{3}\b|\btext-(?:blue|indigo)-\d{3}\b|\bborder-(?:blue|indigo)-\d{3}\b/g,
        suggestion: 'Usar bg-primary-600 / text-primary-600 / btn-primary',
        severity: 'alta',
    },
    {
        id: 'hardcoded-red',
        label: 'Rojo hardcodeado (debería usar danger-*)',
        regex: /\bbg-red-\d{3}\b|\btext-red-\d{3}\b|\bborder-red-\d{3}\b/g,
        suggestion: 'Usar bg-danger-600 / text-danger-600 / btn-danger',
        severity: 'alta',
    },
    {
        id: 'hardcoded-green',
        label: 'Verde hardcodeado (debería usar success-*)',
        regex: /\bbg-green-\d{3}\b|\btext-green-\d{3}\b|\bborder-green-\d{3}\b/g,
        suggestion: 'Usar bg-success-600 / text-success-600 / btn-success',
        severity: 'alta',
    },
    {
        id: 'hardcoded-yellow',
        label: 'Amarillo hardcodeado (debería usar warning-*)',
        regex: /\bbg-yellow-\d{3}\b|\btext-yellow-\d{3}\b|\bborder-yellow-\d{3}\b/g,
        suggestion: 'Usar bg-warning-600 / text-warning-600',
        severity: 'media',
    },
    {
        id: 'inline-button',
        label: 'Botón con clases Tailwind directas (sin .btn-*)',
        regex: /class="[^"]*\bpx-\d+\s+py-\d+[^"]*rounded[^"]*bg-(?:primary|danger|success|warning|blue|red|green|indigo)-\d{3}[^"]*"/g,
        suggestion: 'Usar btn-primary / btn-danger / btn-success / btn-outline',
        severity: 'media',
    },
    {
        id: 'hex-color',
        label: 'Color hexadecimal hardcodeado',
        regex: /#[0-9a-fA-F]{3,6}\b/g,
        suggestion: 'Usar tokens de color de Tailwind config',
        severity: 'baja',
        // excluir comentarios
        excludeInComments: true,
    },
];

// ─── Recolectar archivos ───────────────────────────────────────────────────

function collectFiles(dir, exts) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(full, exts));
        } else if (exts.some(e => entry.name.endsWith(e))) {
            results.push(full);
        }
    }
    return results;
}

const files = [
    ...collectFiles(FRONTEND_DIR, ['.js']),
    ...collectFiles(VIEWS_DIR,    ['.ejs']),
];

// ─── Ejecutar auditoría ────────────────────────────────────────────────────

const findings = [];   // { file, line, lineNo, pattern, match }
const summary  = {};   // patternId → count

for (const pattern of PATTERNS) {
    summary[pattern.id] = 0;
}

for (const filePath of files) {
    const src   = fs.readFileSync(filePath, 'utf8');
    const lines = src.split('\n');

    for (const pattern of PATTERNS) {
        lines.forEach((line, idx) => {
            // Saltar líneas que parecen solo comentario JS/EJS
            if (pattern.excludeInComments) {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('<%#')) return;
            }

            const matches = [...line.matchAll(pattern.regex)];
            for (const m of matches) {
                findings.push({
                    file:      path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/'),
                    lineNo:    idx + 1,
                    line:      line.trim().slice(0, 120),
                    patternId: pattern.id,
                    label:     pattern.label,
                    match:     m[0],
                    severity:  pattern.severity,
                    suggestion: pattern.suggestion,
                });
                summary[pattern.id]++;
            }
        });
    }
}

// ─── Generar reporte ───────────────────────────────────────────────────────

const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
const totalIssues = findings.length;

const bySeverity = { alta: 0, media: 0, baja: 0 };
for (const f of findings) bySeverity[f.severity]++;

const byPattern = {};
for (const f of findings) {
    if (!byPattern[f.patternId]) byPattern[f.patternId] = [];
    byPattern[f.patternId].push(f);
}

let md = `# Reporte de Auditoría UI
**Generado:** ${date}
**Archivos analizados:** ${files.length}
**Problemas encontrados:** ${totalIssues} (alta: ${bySeverity.alta} / media: ${bySeverity.media} / baja: ${bySeverity.baja})

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
`;

for (const p of PATTERNS) {
    const count = summary[p.id];
    if (count > 0) {
        md += `| ${p.label} | ${p.severity} | ${count} |\n`;
    }
}

if (totalIssues === 0) {
    md += `\n**Sin problemas detectados. La UI está consistente.**\n`;
} else {
    md += `\n---\n\n## Detalle por categoría\n`;

    for (const p of PATTERNS) {
        const group = byPattern[p.id];
        if (!group || group.length === 0) continue;

        md += `\n### ${p.label} (${group.length} ocurrencias)\n`;
        md += `**Sugerencia:** ${p.suggestion}  \n**Severidad:** ${p.severity}\n\n`;
        md += `| Archivo | Línea | Clase detectada |\n`;
        md += `|---------|-------|-----------------|\n`;

        for (const f of group) {
            md += `| \`${f.file}\` | ${f.lineNo} | \`${f.match}\` |\n`;
        }
    }

    md += `\n---\n\n## Vistas con más problemas\n\n`;

    const byFile = {};
    for (const f of findings) {
        byFile[f.file] = (byFile[f.file] || 0) + 1;
    }

    const topFiles = Object.entries(byFile)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    md += `| Archivo | Problemas |\n|---------|----------|\n`;
    for (const [f, count] of topFiles) {
        md += `| \`${f}\` | ${count} |\n`;
    }
}

md += `\n---\n*Generado por scripts/audit-ui.js*\n`;

fs.writeFileSync(REPORT_PATH, md, 'utf8');
console.log(`\n✅ Auditoría completada: ${totalIssues} problemas en ${files.length} archivos.`);
console.log(`📄 Reporte guardado en: TASKS/audit-report.md`);
if (bySeverity.alta > 0) console.log(`🔴 Alta prioridad: ${bySeverity.alta} ocurrencias`);
if (bySeverity.media > 0) console.log(`🟡 Media prioridad: ${bySeverity.media} ocurrencias`);
if (bySeverity.baja > 0) console.log(`⚪ Baja prioridad: ${bySeverity.baja} ocurrencias`);
