# Carpeta `local/` (solo tu máquina)

Aquí van **artefactos de entorno** que no deben versionarse: logs sueltos, salidas de scripts de diagnóstico, instaladores (p. ej. `OllamaSetup.exe` en esta carpeta en lugar de la raíz), dumps temporales, resultados de pruebas manuales, `firestore_check_result.txt` (lo escribe `backend/verify_firestore_structure.js` aquí), etc.

Todo el contenido de `local/` está en `.gitignore` **excepto** este `README.md`.

**Subcarpeta:** `local/backend/` — salidas de scripts y diagnósticos del backend (ver `local/backend/README.md`).

**Sugerencia:** si algo aparece en la raíz del repo o en `backend/` y está ignorado (`.log`, `.txt` de debug), movélo bajo `local/`.
