const fs = require('fs');

try {
    let content = fs.readFileSync('property_detail_seeded.json', 'utf8');
    // Strip BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    // Also try to find the first '{' in case of garbage
    const firstBrace = content.indexOf('{');
    if (firstBrace !== -1) {
        content = content.substring(firstBrace);
    }

    const data = JSON.parse(content);
    console.log(JSON.stringify(data.data.images, null, 2));
} catch (error) {
    console.error('Error:', error.message);
}
