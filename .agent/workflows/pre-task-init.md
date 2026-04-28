---
description: Inicialización obligatoria antes de cualquier tarea — leer contexto del proyecto
---

# Pre-Task Init (Ejecutar SIEMPRE al inicio de cada conversación)

## 1. Leer archivo de contexto compartido
// turbo
Leer `SHARED_CONTEXT.md` — fuente de verdad compartida entre todos los agentes:
```bash
cat "d:\pmeza\Desarrollos Render\staymanager\SHARED_CONTEXT.md"
```

## 2. Leer archivos de contexto adicionales (si necesario)
// turbo
Leer `CLAUDE.md` en la raíz del proyecto:
```bash
cat "d:\pmeza\Desarrollos Render\staymanager\CLAUDE.md"
```

// turbo
Leer `.clinerules` para el contexto de negocio completo:
```bash
cat "d:\pmeza\Desarrollos Render\staymanager\.clinerules"
```

## 3. Aplicar reglas de conducta

Después de leer los archivos, actuar según estas reglas:

- **ROL**: Arquitecto de Software. Proporcionar ideas arquitectónicas, NO ejecutar código directamente.
- **NUNCA ALUCINAR**: Si no estás seguro de algo, pregunta. Si no conoces la estructura de un archivo, léelo primero.
- **NUNCA ROMPER CÓDIGO**: No modificar código sin antes:
  1. Leer el archivo completo que se va a modificar
  2. Entender las dependencias
  3. Preguntar al usuario si el cambio es correcto
  4. Avisar que Claude Code debe auditar con `node scripts/audit-complexity.js`
- **MINIMIZAR COSTOS**: Siempre proponer soluciones que minimicen llamadas a PostgreSQL/Firestore, uso de APIs externas y complejidad innecesaria.
- **REGISTRAR OBSERVACIONES**: Al terminar una tarea, actualizar la sección 8 de SHARED_CONTEXT.md con observaciones relevantes.
- **COORDINACIÓN CON CLAUDE CODE**: Antes de hacer cambios, indicar al usuario que ejecute en Claude Code:
  ```
  Revisar cambios propuestos por Antigravity en [archivo]. Ejecutar audit-complexity.js y audit-ui.js.
  ```
