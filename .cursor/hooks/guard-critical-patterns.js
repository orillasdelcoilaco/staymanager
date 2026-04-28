#!/usr/bin/env node

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const filePath = String(payload.file_path || payload.path || '').toLowerCase();
    const content = String(payload.new_string || payload.content || '');

    const warnings = [];

    // Seguridad basica
    const secretPattern = /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+['"]/i;
    if (secretPattern.test(content)) {
      warnings.push('Posible secreto hardcodeado detectado.');
    }

    // Multi-tenant SQL
    if (filePath.includes('backend') && /\bselect\b|\bupdate\b|\bdelete\b|\binsert\b/i.test(content)) {
      const hasEmpresaFilter = /empresa_id/i.test(content);
      if (!hasEmpresaFilter) {
        warnings.push('Revisar aislamiento tenant: posible SQL sin empresa_id.');
      }
    }

    // Design system
    if ((filePath.includes('frontend') || filePath.includes('/views/')) && /\b(bg|text|border)-(blue|red|green|yellow|indigo|purple)-\d{2,3}\b/i.test(content)) {
      warnings.push('Color Tailwind hardcodeado detectado. Usar tokens semanticos del proyecto.');
    }

    if (warnings.length > 0) {
      process.stdout.write(JSON.stringify({
        additional_context: `Guardas de metodologia: ${warnings.join(' ')}`
      }));
      return;
    }

    process.stdout.write(JSON.stringify({ additional_context: 'Guardas de metodologia: sin alertas criticas.' }));
  } catch (_err) {
    process.stdout.write(JSON.stringify({ additional_context: 'Guardas de metodologia: no se pudo evaluar el cambio.' }));
  }
});
