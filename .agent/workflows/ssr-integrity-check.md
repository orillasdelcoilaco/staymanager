---
description: Verify SSR Integrity (Booking Widget, CSS, Data)
---

# SSR Integrity Check Protocol

Run this workflow after making changes to:
- `backend/views/propiedad.ejs` (Property Details Template)
- `backend/public/js/booking.js` (Booking Logic)
- `backend/routes/websiteConfigRoutes.js` (Image Uploads)
- `backend/services/publicWebsiteService.js` (Data Fetching)

## Steps

1. **Run the Integrity Script**
   Execute the automated guardian script.
   
   ```bash
   npm run test:ssr
   ```

2. **Analyze Output**
   - **PASS**: All systems are healthy (CSS class present, Widget container present, Data JSON valid).
   - **FAIL**: Immediate action required. Undo recent changes or fix the specific error reported.

3. **Manual Verification (Optional but Recommended)**
   - Open `http://localhost:3001` in Incognito.
   - Click a property.
   - Verify image stability (no jump).
   - Verify "Reservar" button is clickable.

## Configuration Rules (Guardian)
Any changes to "Configuración Web" must adhere to:
1.  **Domain Generation**:
    - Default domain MUST be `[subdomain].suitemanagers.com` (Plural).
    - Logic located in `backend/services/empresaService.js`.
2.  **Visual Identity**:
    - `propiedad.ejs` must define `--primary-color` and `--secondary-color`.
    - Buttons must use `.btn-primary` or `.btn-secondary` classes, NOT hardcoded Tailwind colors (e.g., `bg-pink-600`).
3.  **AI Image Pipeline**:
    - All image uploads (Hero, Cards, Gallery) MUST go through `optimizeImage` (Sharp) + `generarMetadataImagen` (Gemini).

