#!/usr/bin/env node
/**
 * Prueba de conectividad y validez de claves de proveedores IA.
 * Carga variables desde backend/.env o, si no existe, .env en la raíz del repo.
 * No imprime claves completas.
 *
 * Uso:
 *   node scripts/test-ai-provider-keys.js
 *   node scripts/test-ai-provider-keys.js --strict   → exit 1 si alguna clave definida falla (401/404/error)
 */
/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');
const backendEnv = path.join(repoRoot, 'backend', '.env');
const rootEnv = path.join(repoRoot, '.env');

try {
    const dotenv = require(path.join(repoRoot, 'backend', 'node_modules', 'dotenv'));
    const envPath = fs.existsSync(backendEnv) ? backendEnv : fs.existsSync(rootEnv) ? rootEnv : undefined;
    if (envPath) {
        dotenv.config({ path: envPath });
    }
} catch (e) {
    console.error(
        'No se pudo cargar dotenv desde backend/node_modules. Ejecuta: cd backend && npm install\n',
        e.message
    );
    process.exit(1);
}

const aiConfig = require('../backend/config/aiConfig');

const strict = process.argv.includes('--strict');

function maskKey(raw) {
    if (!raw) return '(no definida)';
    const s = String(raw).trim();
    if (!s) return '(vacía)';
    return `[definida, ${s.length} caracteres]`;
}

async function postChat({ apiKey, baseUrl, model, maxTokens = 100 }) {
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Responde solo: OK' }],
            temperature: 0,
            max_tokens: maxTokens,
        }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
}

function classifyOpenAICompat({ ok, status, text }) {
    if (ok) return { kind: 'ok', detail: `HTTP ${status}` };
    if (status === 401 || /invalid.*key|incorrect.*api|unauthorized/i.test(text)) {
        return { kind: 'auth', detail: text.slice(0, 180) };
    }
    if (status === 404) return { kind: 'notfound', detail: text.slice(0, 200) };
    if (status === 429) return { kind: 'ratelimit', detail: text.slice(0, 200) };
    return { kind: 'err', detail: `HTTP ${status} ${text.slice(0, 220)}` };
}

async function testGroq() {
    const k = aiConfig.groq.apiKey;
    if (!k) return { kind: 'skip' };
    const r = await postChat({
        apiKey: k,
        baseUrl: aiConfig.groq.baseUrl,
        model: aiConfig.groq.model,
        maxTokens: 40,
    });
    return classifyOpenAICompat(r);
}

async function testOpenRouter() {
    const k = aiConfig.openrouter.apiKey;
    if (!k) return { kind: 'skip' };
    const r = await postChat({
        apiKey: k,
        baseUrl: aiConfig.openrouter.baseUrl,
        model: aiConfig.openrouter.model,
        maxTokens: 60,
    });
    return classifyOpenAICompat(r);
}

async function testSiliconFlow() {
    const k = aiConfig.siliconflow.apiKey;
    if (!k) return { kind: 'skip' };
    const r = await postChat({
        apiKey: k,
        baseUrl: aiConfig.siliconflow.baseUrl,
        model: aiConfig.siliconflow.model,
        maxTokens: 60,
    });
    return classifyOpenAICompat(r);
}

async function testMoonshot() {
    const k = aiConfig.moonshot.apiKey;
    if (!k) return { kind: 'skip' };
    const r = await postChat({
        apiKey: k,
        baseUrl: aiConfig.moonshot.baseUrl,
        model: aiConfig.moonshot.model,
        maxTokens: 60,
    });
    return classifyOpenAICompat(r);
}

async function testDeepSeek() {
    const k = aiConfig.deepseek.apiKey;
    if (!k) return { kind: 'skip' };
    const r = await postChat({
        apiKey: k,
        baseUrl: 'https://api.deepseek.com/v1/chat/completions',
        model: aiConfig.deepseek.model,
        maxTokens: 60,
    });
    return classifyOpenAICompat(r);
}

async function testOpenAI() {
    const k = aiConfig.openai.apiKey;
    if (!k) return { kind: 'skip' };
    const r = await postChat({
        apiKey: k,
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        model: aiConfig.openai.model,
        maxTokens: 40,
    });
    return classifyOpenAICompat(r);
}

async function testGemini() {
    const k = aiConfig.gemini.apiKey;
    const model = aiConfig.gemini.model || 'gemini-2.0-flash';
    if (!k) return { kind: 'skip' };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
    )}:generateContent?key=${encodeURIComponent(k)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Di solo: OK' }] }],
        }),
    });
    const text = await res.text();
    if (res.ok) return { kind: 'ok', detail: `HTTP ${res.status}` };
    if (res.status === 429 || /RESOURCE_EXHAUSTED|Too Many Requests|depleted|quota/i.test(text)) {
        return { kind: 'quota', detail: text.slice(0, 200) };
    }
    if (res.status === 400 && /API key|invalid/i.test(text)) return { kind: 'auth', detail: text.slice(0, 200) };
    return { kind: 'err', detail: `HTTP ${res.status} ${text.slice(0, 220)}` };
}

async function testClaude() {
    const k = aiConfig.claude.apiKey;
    if (!k) return { kind: 'skip' };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': k,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: aiConfig.claude.model,
            max_tokens: 30,
            messages: [{ role: 'user', content: 'Reply only: OK' }],
        }),
    });
    const text = await res.text();
    if (res.ok) return { kind: 'ok', detail: `HTTP ${res.status}` };
    if (res.status === 401) return { kind: 'auth', detail: text.slice(0, 180) };
    if (res.status === 400 && /credit|balance/i.test(text)) return { kind: 'quota', detail: text.slice(0, 200) };
    if (res.status === 429) return { kind: 'ratelimit', detail: text.slice(0, 160) };
    return { kind: 'err', detail: `HTTP ${res.status} ${text.slice(0, 220)}` };
}

const ROWS = [
    { id: 'groq', name: 'Groq', env: 'GROQ_API_KEY', fn: testGroq },
    { id: 'gemini', name: 'Gemini', env: 'GEMINI_API_KEY', fn: testGemini },
    { id: 'openrouter', name: 'OpenRouter', env: 'OPENROUTER_API_KEY', fn: testOpenRouter },
    { id: 'siliconflow', name: 'SiliconFlow', env: 'SILICONFLOW_API_KEY', fn: testSiliconFlow },
    { id: 'moonshot', name: 'Moonshot', env: 'MOONSHOT_API_KEY', fn: testMoonshot },
    { id: 'deepseek', name: 'DeepSeek', env: 'DEEPSEEK_API_KEY', fn: testDeepSeek },
    { id: 'openai', name: 'OpenAI', env: 'OPENAI_API_KEY', fn: testOpenAI },
    { id: 'claude', name: 'Anthropic', env: 'CLAUDE_API_KEY', fn: testClaude },
];

function labelFor(kind) {
    const m = {
        ok: 'OK — clave aceptada',
        skip: '— (sin clave)',
        auth: 'FALLO — 401 / clave inválida',
        notfound: 'FALLO — 404 modelo o URL (revisa OPENROUTER_MODEL, etc.)',
        ratelimit: 'Límite temporal (429) — clave suele ser válida; espera o sube tier',
        quota: 'Sin crédito / cuota (facturación)',
        err: 'Error HTTP / red',
    };
    return m[kind] || kind;
}

async function main() {
    console.log('SuiteManager — test-ai-provider-keys.js');
    console.log('Origen env:', fs.existsSync(backendEnv) ? backendEnv : fs.existsSync(rootEnv) ? rootEnv : '(dotenv por defecto)');
    console.log('OpenRouter model configurado:', aiConfig.openrouter.model);
    console.log('Groq model configurado:', aiConfig.groq.model);
    console.log('—'.repeat(72));

    let strictFailed = false;

    for (const row of ROWS) {
        const rawEnv = process.env[row.env];
        const masked = maskKey(rawEnv);
        let result;
        try {
            result = await row.fn();
        } catch (e) {
            result = { kind: 'err', detail: e.message || String(e) };
        }
        const kind = result.kind || 'err';
        const line = `${row.name.padEnd(14)} ${row.env.padEnd(22)} ${masked.padEnd(22)} → ${labelFor(kind)}`;
        console.log(line);
        if (result.detail && kind !== 'skip' && kind !== 'ok') {
            console.log(`    ${result.detail.replace(/\s+/g, ' ').trim()}`);
        }
        const keyPresent = Boolean(rawEnv && String(rawEnv).trim());
        if (strict && keyPresent && ['auth', 'notfound', 'err'].includes(kind)) {
            strictFailed = true;
        }
    }

    console.log('—'.repeat(72));
    console.log(
        'Notas: 401 en SiliconFlow/Moonshot suele ser clave errónea o cuenta distinta. ' +
            'Groq 429 TPM en plan fotos: prueba GROQ_MODEL=llama-3.1-8b-instant. ' +
            'Gemini "depleted": recarga créditos en AI Studio.'
    );

    if (strict && strictFailed) {
        console.error('\n[strict] Al menos una clave configurada falló o está sin crédito.');
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
