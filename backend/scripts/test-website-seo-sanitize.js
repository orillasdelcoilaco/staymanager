const assert = require('assert');
const {
    sanitizeGoogleSiteVerificationToken,
    sanitizeGoogleSearchConsoleHtmlVerification,
    sanitizeSeoSettingsIncoming,
} = require('../services/websiteSeoSettingsSanitize');

assert.strictEqual(sanitizeGoogleSiteVerificationToken(''), '');
assert.strictEqual(sanitizeGoogleSiteVerificationToken('  '), '');
assert.strictEqual(sanitizeGoogleSiteVerificationToken('abc123_XYZ'), 'abc123_XYZ');
assert.strictEqual(sanitizeGoogleSiteVerificationToken('<script>'), '');
assert.strictEqual(sanitizeGoogleSiteVerificationToken('ab cd'), '');

const merged = sanitizeSeoSettingsIncoming({
    title: 'x',
    googleSiteVerification: '  tok_en1  ',
});
assert.strictEqual(merged.googleSiteVerification, 'tok_en1');
assert.strictEqual(merged.title, 'x');

const htmlOk = sanitizeGoogleSearchConsoleHtmlVerification({
    filename: 'GoogleC1387A55E90AA059.HTML',
    htmlBody: 'google-site-verification: googlec1387a55e90aa059.html',
});
assert.strictEqual(htmlOk.filename, 'googlec1387a55e90aa059.html');
assert.strictEqual(htmlOk.htmlBody, 'google-site-verification: googlec1387a55e90aa059.html');

assert.deepStrictEqual(
    sanitizeGoogleSearchConsoleHtmlVerification({ filename: 'bad.html', htmlBody: 'x' }),
    { filename: '', htmlBody: '' }
);
assert.deepStrictEqual(
    sanitizeGoogleSearchConsoleHtmlVerification({ filename: 'googlec1.html', htmlBody: '<script>' }),
    { filename: '', htmlBody: '' }
);

const mergedHtml = sanitizeSeoSettingsIncoming({
    googleSearchConsoleHtmlVerification: {
        filename: 'googlec1.html',
        htmlBody: 'google-site-verification: googlec1.html',
    },
});
assert.strictEqual(mergedHtml.googleSearchConsoleHtmlVerification.filename, 'googlec1.html');

console.log('test-website-seo-sanitize: OK');
