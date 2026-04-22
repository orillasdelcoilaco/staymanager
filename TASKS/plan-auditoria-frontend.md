# Plan: Auditoría y Estandarización Frontend
**Objetivo:** Aplicar `.claude/skills/frontend.md` a todo el SPA — consistente, moderno, profesional, no parece hecho por IA  
**Fecha:** 2026-04-02  
**Estimado:** 3-4 sesiones

---

## Estado Actual (diagnóstico)

| Métrica | Valor |
|---|---|
| Archivos JS de vistas | ~100 |
| Usos de Font Awesome | 7 |
| Emojis como íconos funcionales | ~200 instancias, 20+ archivos |
| Botones con Tailwind raw (no btn-*) | 19 |
| `style.display` ilegítimos | 4 |
| Archivos webPublica.* 100% emoji | 6 |

---

## Correcciones al Skill (hacer primero, antes de auditar)

El skill tiene 3 reglas que necesitan matiz. Actualizar `.claude/skills/frontend.md`:

### 1. Patrón dual de modales
```
PATRÓN A — Modal estático (reutilizable):
Pre-existe en HTML, se muestra/oculta con .classList.toggle('hidden').
Usar cuando el modal se abre/cierra múltiples veces en la misma sesión.

PATRÓN B — Modal dinámico (de un solo uso):
Se crea con insertAdjacentHTML('beforeend', html) y se destruye con .remove().
Válido para: wizards, pickers de fotos, lightboxes, confirmaciones.
NO usar .hidden en estos — no tiene sentido pre-renderizarlos en el DOM.
```

### 2. Aclaración gap y rounded
```
gap-2 / gap-3: CORRECTO para grupos de botones, chips, inline elements.
              INCORRECTO entre secciones/cards principales → usar gap-6 o gap-8.

rounded-md: CORRECTO para chips, badges, inputs, botones pequeños.
            INCORRECTO para contenedores principales → usar rounded-xl o rounded-2xl.
```

### 3. Excepción style.display
```
EXCEPCIÓN VÁLIDA: style.display cuando se necesita 'grid', 'flex' o 'inline-flex'
específico que .hidden (que solo hace display:none) no puede restaurar correctamente.
Ejemplo válido: togglear entre display:grid y display:none.
```

---

## Fase 1 — Íconos: Migrar Emojis → Font Awesome
**Impacto:** El cambio más visible. Unifica el lenguaje visual, controla tamaño, mejora accesibilidad, elimina rendering inconsistente cross-platform.

### Mapa de conversión (emojis → FA)

| Emoji actual | FA replacement | Contexto |
|---|---|---|
| 📸 | `fa-camera` | Foto requerida, subir foto |
| 🖼️ | `fa-images` | Galería |
| 📤 | `fa-upload` | Subir |
| 🗑️ | `fa-trash` | Eliminar |
| ⚡ | `fa-bolt` | Generar con IA (acción rápida) |
| ⚙️ | `fa-gear` | Configuración |
| 📝 | `fa-pen-to-square` | Editar contenido |
| ✓ / ✅ | `fa-check` | Aprobado, seleccionado |
| ✕ / × | `fa-xmark` | Cerrar |
| → | `fa-arrow-right` | Continuar, siguiente |
| ← | `fa-arrow-left` | Volver, anterior |
| 🎬 / 📹 | `fa-video` | Video |
| ⚠️ | `fa-triangle-exclamation` | Alerta |
| 🤖 | `fa-robot` | IA |
| 🎉 | `fa-party-horn` | Éxito final |
| 🔄 | `fa-rotate` | Reintentar, sincronizar |
| 🛑 | `fa-ban` | Rechazado |
| 💡 | `fa-lightbulb` | Sugerencia, guía |
| 🔍 | `fa-magnifying-glass` | Ampliar, buscar |
| ✏️ | `fa-pen` | Editar |
| ★ | `fa-star` | Portada |
| 🏠 | `fa-house` | Alojamiento |
| 📦 | `fa-box` | Componente/espacio |

### Archivos a modificar (por prioridad)

**Prioridad 1 — Módulos nuevos (100% emoji):**
- `webPublica.galeria.js` — wizard slots, botones Asistente IA / Subir / Galería
- `webPublica.galeria.helpers.js` — estados wizard (upload, success, error, finish)
- `webPublica.paso1.identidad.js` — botón Generar con IA
- `webPublica.paso2.fotos.js` — banner info
- `webPublica.paso3.seo.js` — botones IA, ícono portada
- `webPublica.wizard.js` — tabs de pasos con íconos
- `websiteAlojamientos.js` — header, badges, botones
- `galeriaPropiedad.js` — cards de propiedad, botones foto

**Prioridad 2 — Módulos existentes con mezcla:**
- `galeria.editor.js` — botones del editor canvas
- `crm.campaigns.js` / `crm.coupons.js` / `crm.pipeline.js`
- `propuesta.ui.js`
- `componentEditor.js`

**Nota técnica:** Los emojis en texto descriptivo (mensajes de estado, placeholders de texto) son aceptables. Solo migrar emojis usados como íconos en botones, labels y acciones de UI.

---

## Fase 2 — Botones: Eliminar Tailwind Raw
**19 instancias** de botones construidos con utilidades sueltas (`bg-primary-600 text-white px-2 py-1 rounded`) en lugar de clases `btn-*`.

### Archivos identificados
- `webPublica.galeria.js` — slot buttons ("Subir foto", "Desde Galería")
- `webPublica.galeria.helpers.js` — wizard action buttons
- `websiteAlojamientos.js` — card buttons varios
- `galeriaPropiedad.js` — action buttons en hover overlay

### Regla de decisión para clase correcta
```
¿Es la acción principal de una sección?          → btn-primary
¿Es acción secundaria o alternativa?             → btn-outline
¿Es acción neutral sin énfasis?                  → btn-secondary
¿Es eliminar / acción destructiva?               → btn-danger
¿Es cancelar / cerrar / volver?                  → btn-ghost
¿Es confirmar pago / estado positivo?            → btn-success
¿Está en tabla, compacto text-xs?                → btn-table-edit / btn-table-delete / btn-table-view
```

**Regla de jerarquía por sección:**
- Máximo 1 `btn-primary` por card o sección
- Si hay dos acciones importantes: primera = `btn-primary`, segunda = `btn-outline`
- Los slots del galeria wizard: "Subir foto" = `btn-outline`, "Desde Galería" = `btn-secondary`

---

## Fase 3 — Visibilidad: Migrar style.display ilegítimos

### Casos a corregir

**`imageEditorModal.js`**
```javascript
// ❌ Actual
modalContainer.style.display = 'block';
modalContainer.style.display = 'none';

// ✅ Correcto
modalContainer.classList.remove('hidden');
modalContainer.classList.add('hidden');
```

**`galeria.helpers.js` — wizard next button**
El botón alterna entre visible/oculto. Usar `.hidden` es correcto aquí porque el botón ya tiene `display:block` por defecto.
```javascript
// ❌ Actual
newNextBtn.style.display = 'block';
newNextBtn.style.display = 'none';

// ✅ Correcto  
newNextBtn.classList.remove('hidden');
newNextBtn.classList.add('hidden');
```

### Casos que SON válidos (no tocar)
- `router.js` badge: alterna entre `display:flex` y `display:none` → válido
- `reservas.modals.edit.js` contenedor USD: alterna entre `display:grid` y `display:none` → válido
- `alojamientos.modals.js` label visibility: caso específico de toggle condicional → evaluar caso a caso
- `onerror` en img tags: `this.style.display='none'` — única forma desde atributo inline → válido

---

## Fase 4 — Empty States: Elevar a Premium

### Patrón actual (inaceptable)
```html
<p class="text-xs text-gray-400">Sin puntos fuertes aún.</p>
```

### Patrón correcto (del skill)
```html
<div class="py-8 text-center">
    <i class="fa-solid fa-star text-3xl text-gray-200 mb-3"></i>
    <p class="text-gray-700 font-medium text-sm mb-1">Sin puntos fuertes aún</p>
    <p class="text-xs text-gray-400">Genera con IA o agrega manualmente.</p>
</div>
```

### Archivos con empty states deficientes
- `webPublica.paso1.identidad.js` — chips vacíos
- `webPublica.paso3.seo.js` — sin fotos disponibles
- `webPublica.galeria.js` — sin componentes, sin imágenes
- `websiteAlojamientos.js` — sin alojamientos
- `galeriaPropiedad.js` — sin fotos en propiedad

---

## Fase 5 — Audit de Módulos Legacy (verificar, no reescribir)

Estos módulos son más antiguos y generalmente más consistentes. Verificar rápidamente:

### Checklist por módulo
```
[ ] crm.js + crm.table.js + crm.campaigns.js + crm.coupons.js + crm.pipeline.js
[ ] gestionarReservas.js + reservas.modals.js + reservas.cards.js
[ ] gestionarClientes.js + clientes.table.js + clientes.modals.js
[ ] gestionarAlojamientos.js + alojamientos.modals.js + componentEditor.js
[ ] gestionarTarifas.js + temporadas.js + matriz.js
[ ] gestionarCanales.js + canales.modals.js
[ ] gestionarPlantillas.js + plantillas.modals.js
[ ] dashboard.js + gestionDiaria.js + gestionDiaria.cards.js
[ ] calendario.js + calendario.gantt.js
[ ] perfilCliente.js + agregarPropuesta.js
```

**Criterio de revisión por módulo:**
1. ¿Botones usan btn-* o Tailwind raw?
2. ¿Íconos son FA o emoji?
3. ¿Empty states son premium o texto plano?
4. ¿Modales usan .hidden o style.display?
5. ¿Hay un solo btn-primary por sección?

**Si pasa los 5 criterios → sin cambios.**
**Si falla alguno → anotar y corregir en batch.**

---

## Fase 6 — Tipografía: Custom Scale

El skill define `text-display`, `text-heading`, `text-subhead`, `text-body`, `text-caption`.  
Verificar que estén definidos en `backend/tailwind.config.js` y aplicar progresivamente en las vistas que se toquen.

```javascript
// tailwind.config.js — verificar que existan:
fontSize: {
    'display':  ['2rem',   { lineHeight: '2.5rem', fontWeight: '700' }],
    'heading':  ['1.5rem', { lineHeight: '2rem',   fontWeight: '600' }],
    'subhead':  ['1.125rem',{ lineHeight: '1.75rem',fontWeight: '500' }],
    'body':     ['0.875rem',{ lineHeight: '1.5rem', fontWeight: '400' }],
    'caption':  ['0.75rem', { lineHeight: '1rem',   fontWeight: '400' }],
}
```

**Estrategia:** No hacer un reemplazo masivo. Aplicar la escala custom en archivos que ya se tocan por otros motivos. Los `text-2xl`, `text-lg`, `text-sm` existentes son funcionales — el beneficio de migrar todos es bajo vs el riesgo de regressions.

---

## Orden de Ejecución

```
Sesión 1: ✅ COMPLETADA
  ✅ Actualizar skill (gaps: modal dual, gap/rounded, display:grid)
  ✅ Fase 1 — Íconos webPublica.* (6 archivos, mayor impacto)
  ✅ Fase 1 — Íconos galeriaPropiedad.js + websiteAlojamientos.js
  ✅ Fase 2 — Botones raw en los mismos archivos

Sesión 2: ✅ COMPLETADA
  ✅ Fase 1 — Íconos módulos legacy (crm, galeria.editor, propuesta)
  ✅ Fase 3 — style.display ilegítimos
  ✅ Fase 4 — Empty states premium en webPublica.* y galeria

Sesión 3: ✅ COMPLETADA
  ✅ Fase 5 — Audit módulos legacy (clientes, tarifas, plantillas, alojamientos, crm, calendario, perfil)
  ✅ Fase 6 — Verificar tailwind.config custom type scale ✓ (display/heading/subhead/body/caption)
  ✅ audit-ui final → 0 alta prioridad
  ✅ npm run build
```

---

## Criterio de Éxito

- [ ] `node scripts/audit-ui-monitored.js` → 0 problemas alta prioridad
- [ ] `node scripts/audit-complexity-monitored.js` → 0 críticos
- [ ] Ningún emoji como ícono funcional en webPublica.* ni websiteAlojamientos.*
- [ ] Todos los botones usan clase `btn-*`
- [ ] Ningún `style.display` ilegítimo
- [ ] Empty states con ícono FA + título + descripción en las vistas principales

---

## Lo que NO se toca

- Lógica de negocio — cero cambios funcionales
- Módulos de backend — solo frontend SPA
- CSS/Tailwind tokens — el design system ya es correcto
- Textos descriptivos con emojis (placeholders, mensajes) — aceptable
- Patrón insert/remove DOM para modales dinámicos — es arquitectónicamente correcto
- `display:grid` toggles via style.display — excepción válida
