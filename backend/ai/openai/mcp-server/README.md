# MCP server (Model Context Protocol)

Ubicación en el repo: `backend/ai/openai/mcp-server/`.

## Importante — nombre del paquete npm (rebrand 2026-05)

El campo **`name`** en `package.json` es **`rezerva-mcp-server`**.

El nombre anterior era **`suitemanager-mcp-server`**. Si tu **Claude Desktop**, **Cursor**, otro cliente MCP o un script de automatización siguen usando el nombre antiguo, **actualiza la configuración** o el comando de arranque para que coincida con `rezerva-mcp-server` y con la ruta actual de esta carpeta.

- Referencia canónica en la raíz del proyecto: **`LEER-PRIMERO.md`** → sección *Referencias de entorno* → fila *Paquete npm del MCP local*.
- Tema de producto: **`TASKS/tema/SM-rebrand-dominio/pendientes-y-registro.md`**.

### Comprobar en local

Desde esta carpeta:

```bash
npm pack --dry-run
```

Debe listar el nombre `rezerva-mcp-server` (no el antiguo).

## Uso

Ver `index.js`, `package.json` y el resumen de integración en **`TASKS/tema/SM-venta-ia/chatgpt_integration_summary.md`**.
