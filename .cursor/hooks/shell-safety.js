#!/usr/bin/env node

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const command = String(payload.command || '');

    const denyPatterns = [
      /\bgit\s+reset\s+--hard\b/i,
      /\brm\s+-rf\s+\/\b/i,
      /\brm\s+-rf\s+\.\b/i,
      /\bgit\s+push\s+--force(?:-with-lease)?\b/i
    ];

    const askPatterns = [
      /\brm\s+-rf\b/i,
      /\bgit\s+checkout\s+--\b/i,
      /\bgit\s+clean\s+-fd\b/i,
      /\bdrop\s+table\b/i
    ];

    if (denyPatterns.some((p) => p.test(command))) {
      process.stdout.write(JSON.stringify({
        permission: 'deny',
        user_message: 'Comando bloqueado por politica de seguridad del proyecto.',
        agent_message: 'Accion destructiva detectada (hard reset/force push o equivalente).'
      }));
      return;
    }

    if (askPatterns.some((p) => p.test(command))) {
      process.stdout.write(JSON.stringify({
        permission: 'ask',
        user_message: 'Comando potencialmente destructivo detectado. Confirma antes de continuar.',
        agent_message: 'Se requiere confirmacion por riesgo de perdida de datos o historial.'
      }));
      return;
    }

    process.stdout.write(JSON.stringify({ permission: 'allow' }));
  } catch (_err) {
    process.stdout.write(JSON.stringify({ permission: 'allow' }));
  }
});
