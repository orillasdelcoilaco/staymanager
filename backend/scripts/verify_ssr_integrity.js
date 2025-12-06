// backend/scripts/verify_ssr_integrity.js
const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3001';
const TEST_PROPERTY_ID = '7lzqGKUxuQK0cttYeH0y'; // ID conocido para pruebas
const FORCE_HOST = 'prueba1.suitemanagers.com';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

console.log(`${GREEN}=== SSR INTEGRITY GUARDIAN ===${RESET}`);
console.log(`Target: ${BASE_URL}/propiedad/${TEST_PROPERTY_ID}`);

function checkIntegrity() {
    const url = `${BASE_URL}/propiedad/${TEST_PROPERTY_ID}?force_host=${FORCE_HOST}`;

    http.get(url, (res) => {
        let authHeader = res.headers['www-authenticate'];

        if (res.statusCode !== 200) {
            console.error(`${RED}[FAIL] HTTP Status: ${res.statusCode}${RESET}`);
            process.exit(1);
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            let errors = [];
            let warnings = [];

            // 1. Check for CSS Fix (Image Sizing)
            if (!data.includes('custom-gallery-height')) {
                errors.push("Missing critical CSS class '.custom-gallery-height' for image sizing.");
            } else {
                console.log(`${GREEN}[PASS] CSS Fix (.custom-gallery-height) found.${RESET}`);
            }

            // 2. Check for Booking Widget Container
            if (!data.includes('id="booking-widget-container"')) {
                errors.push("Missing '#booking-widget-container'. Booking widget may not render.");
            } else {
                console.log(`${GREEN}[PASS] Booking Widget container found.${RESET}`);
            }

            // 3. Check for Data Attribute Injection
            if (!data.includes('data-booking-config=')) {
                errors.push("Missing 'data-booking-config' attribute. Widget data injection failed.");
            } else {
                // Validate JSON integrity within attribute
                try {
                    const match = data.match(/data-booking-config='([^']+)'/);
                    if (match && match[1]) {
                        JSON.parse(match[1]); // Attempt parse
                        console.log(`${GREEN}[PASS] Data Attribute JSON is valid.${RESET}`);
                    } else {
                        // Try double quotes check just in case
                        const matchD = data.match(/data-booking-config="([^"]+)"/);
                        if (matchD && matchD[1]) {
                            JSON.parse(matchD[1].replace(/&quot;/g, '"'));
                            console.log(`${GREEN}[PASS] Data Attribute JSON (escaped) is valid.${RESET}`);
                        } else {
                            warnings.push("Could not extract data-booking-config value for validation, but attribute exists.");
                        }
                    }
                } catch (e) {
                    errors.push("Invalid JSON in 'data-booking-config'.");
                }
            }

            // 4. Negative Checks (Errors)
            if (data.includes('Error al cargar (B01)')) {
                errors.push("Found 'Error al cargar (B01)' in HTML output.");
            }
            if (data.includes('ReferenceError')) {
                errors.push("Found 'ReferenceError' stack trace in HTML.");
            }

            // Report
            if (errors.length > 0) {
                console.error(`\n${RED}!!! INTEGRITY CHECK FAILED !!!${RESET}`);
                errors.forEach(e => console.error(`- ${e}`));
                process.exit(1);
            } else {
                console.log(`\n${GREEN}*** ALL SYSTEMS GO. SSR IS HEALTHY. ***${RESET}`);
                process.exit(0);
            }
        });

    }).on('error', (err) => {
        console.error(`${RED}[FATAL] Could not connect to server: ${err.message}${RESET}`);
        process.exit(1);
    });
}

// Run
checkIntegrity();
