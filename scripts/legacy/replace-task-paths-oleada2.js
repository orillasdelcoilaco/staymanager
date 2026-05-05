#!/usr/bin/env node
/**
 * Reemplaza rutas TASKS/*.md movidas en oleada 2 (2026-05-05).
 * Ejecutar desde la raíz del repo: node scripts/legacy/replace-task-paths-oleada2.js
 */
const fs = require('fs');
const path = require('path');

const repl = [
  ['TASKS/plan-reorganizacion-menu-spa.md', 'TASKS/tema/SM-spa-menu/plan-reorganizacion-menu-spa.md'],
  ['TASKS/plan-ssr-arquitectura-dos-capas.md', 'TASKS/tema/SM-ssr-sitio-publico/plan-ssr-arquitectura-dos-capas.md'],
  ['TASKS/plan-accion-ssr-empresa.md', 'TASKS/tema/SM-ssr-sitio-publico/plan-accion-ssr-empresa.md'],
  ['TASKS/plan-contenido-web-wizard.md', 'TASKS/tema/SM-ssr-sitio-publico/plan-contenido-web-wizard.md'],
  ['TASKS/plan-accion-fotos-cabana10.md', 'TASKS/tema/SM-fotos-galeria/plan-accion-fotos-cabana10.md'],
  ['TASKS/guia-prueba-img-001.md', 'TASKS/tema/SM-fotos-galeria/guia-prueba-img-001.md'],
  ['TASKS/verificacion-flujo-ia-fotos.md', 'TASKS/tema/SM-fotos-galeria/verificacion-flujo-ia-fotos.md'],
  ['TASKS/solucion-unificada-fotos.md', 'TASKS/tema/SM-fotos-galeria/solucion-unificada-fotos.md'],
  ['TASKS/resumen-correccion-banos.md', 'TASKS/tema/SM-fotos-galeria/resumen-correccion-banos.md'],
  ['TASKS/plan-accion-problemas.md', 'TASKS/tema/SM-dev-historial/plan-accion-problemas.md'],
  ['TASKS/plan-accion-clientes-sin-reserva.md', 'TASKS/tema/SM-clientes-crm/plan-accion-clientes-sin-reserva.md'],
  ['TASKS/plan-gestion-propiedades.md', 'TASKS/tema/SM-propiedades/plan-gestion-propiedades.md'],
  ['TASKS/acuerdo-arquitectura-ia.md', 'TASKS/tema/SM-ia-arquitectura/acuerdo-arquitectura-ia.md'],
  ['TASKS/plan-gemma4-omnipresente.md', 'TASKS/tema/SM-ia-arquitectura/plan-gemma4-omnipresente.md'],
  ['TASKS/audit-report.md', 'TASKS/tema/SM-auditoria-calidad/audit-report.md'],
  ['TASKS/complexity-report.md', 'TASKS/tema/SM-auditoria-calidad/complexity-report.md'],
  ['TASKS/plan-auditoria-frontend.md', 'TASKS/tema/SM-auditoria-calidad/plan-auditoria-frontend.md'],
  ['TASKS/performance-optimization-report.md', 'TASKS/tema/SM-auditoria-calidad/performance-optimization-report.md'],
  ['TASKS/solo-ui.md', 'TASKS/tema/SM-auditoria-calidad/solo-ui.md'],
  ['TASKS/plan-video-onboarding.md', 'TASKS/tema/SM-onboarding-ux/plan-video-onboarding.md'],
  ['TASKS/migration-plan-postgres.md', 'TASKS/tema/SM-migracion-postgres/migration-plan-postgres.md'],
  ['TASKS/alertas-creditos.md', 'TASKS/tema/SM-operacion-agentes/alertas-creditos.md'],
  ['TASKS/pending.md', 'TASKS/tema/SM-operacion-agentes/pending.md'],
  ['TASKS/completed.md', 'TASKS/tema/SM-operacion-agentes/completed.md'],
  ['TASKS/definition-of-done.md', 'TASKS/tema/SM-operacion-agentes/definition-of-done.md'],
  ['TASKS/leer-primero.md', 'TASKS/coordinacion-cursor-paralelo.md'],
  ['TASKS/complexity-baseline.json', 'TASKS/tema/SM-auditoria-calidad/complexity-baseline.json'],
  ['chatgpt_integration_summary.md', 'TASKS/tema/SM-venta-ia/chatgpt_integration_summary.md'],
  ['plan_gpt_global_suitemanager.md', 'TASKS/tema/SM-ia-arquitectura/plan_gpt_global_suitemanager.md'],
  ['TEAM_CONFIG.md', 'TASKS/tema/SM-operacion-agentes/TEAM_CONFIG.md'],
  ['REVISION_COLABORADOR.md', 'TASKS/tema/SM-operacion-agentes/REVISION_COLABORADOR.md'],
  ['docs/INSTRUCCIONES_INDICES_FIRESTORE.md', 'TASKS/tema/SM-migracion-postgres/INSTRUCCIONES_INDICES_FIRESTORE.md'],
  ['docs/INSTRUCCIONES_REFACTORIZACION.md', 'TASKS/tema/SM-auditoria-calidad/INSTRUCCIONES_REFACTORIZACION.md'],
  ['docs/ARCHITECTURE_v2.md', 'TASKS/tema/SM-auditoria-calidad/ARCHITECTURE_v2.md'],
  ['docs/suitemanager-gpt-config.md', 'TASKS/tema/SM-venta-ia/suitemanager-gpt-config.md'],
  ['INSTRUCCIONES_INDICES_FIRESTORE.md', 'TASKS/tema/SM-migracion-postgres/INSTRUCCIONES_INDICES_FIRESTORE.md'],
  ['INSTRUCCIONES_REFACTORIZACION.md', 'TASKS/tema/SM-auditoria-calidad/INSTRUCCIONES_REFACTORIZACION.md'],
];

const SKIP = new Set(['node_modules', '.git', 'dist', 'build']);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(p, acc);
    } else if (/\.(md|mdc|js|json|yml|yaml|ejs)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

let nFiles = 0;
for (const file of walk(process.cwd())) {
  let c = fs.readFileSync(file, 'utf8');
  let n = c;
  for (const [a, b] of repl) {
    if (n.includes(a)) n = n.split(a).join(b);
  }
  if (n !== c) {
    fs.writeFileSync(file, n);
    console.log(file);
    nFiles++;
  }
}
console.error(`Updated ${nFiles} files.`);
