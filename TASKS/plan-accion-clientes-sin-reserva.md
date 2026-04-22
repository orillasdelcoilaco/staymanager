# Plan de Acción: Captura de Demanda y Cierre de Ventas con IA (Waitlist)

Este documento detalla la especificación técnica para implementar el sistema de gestión de clientes sin reserva inmediata en SuiteManager.

## 1. Contexto y Objetivos
SuiteManager actúa como un ecosistema/OTA. Cuando un cliente consulta disponibilidad (ya sea por el buscador global o por llamada directa a una propiedad llena), el sistema debe capturar esa demanda insatisfecha para reconectarla proactivamente cuando surja una oportunidad.

## 2. Definición del Ecosistema (Cross-Company)
Para permitir sugerencias entre empresas (Holding/Ecosistema), se requiere una nueva estructura de datos:
- **Tabla `empresa_relaciones`**: Define qué empresas pueden compartirse disponibilidad.
- **Lógica de Matching**: Al fallar una búsqueda en Empresa A, el sistema escanea automáticamente las empresas relacionadas en el mismo "Holding".

## 3. Especificaciones de Base de Datos (PostgreSQL)

### Tabla `waitlist` (Demanda)
```sql
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_origen_id UUID REFERENCES empresas(id),
    nombre_cliente TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    pax INTEGER NOT NULL,
    preferencias JSONB DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'notificado', 'convertido', 'expirado'
    modo_notificacion TEXT DEFAULT 'manual', -- 'auto' o 'manual'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla `analytics_waitlist` (Trazabilidad)
```sql
CREATE TABLE analytics_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waitlist_id UUID REFERENCES waitlist(id),
    evento TEXT, -- 'notificacion_enviada', 'clic_ia', 'reserva_completada'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. Motor de IA (AI Sales Closer)
El sistema generará un enlace único para el cliente que lo llevará a un chat con una IA especializada.

### Requerimientos del Prompt (AI_TASK.SALES_CLOSER):
1. **Inyección de Contexto**: La IA recibe los `sales_context` de las cabañas disponibles y las tarifas vigentes (`tarifasService`).
2. **Neuro-ventas**: Instrucción de resaltar beneficios ("Value over price") y manejo de objeciones por cambio de fechas o propiedad.
3. **Cierre Dinámico**: La IA debe presentar un botón de pago/reserva JSON cuando detecte intención de compra.

## 5. Automatización y Hooks
- **Trigger**: Se integra en `reservas.delete.js` tras una cancelación exitosa.
- **Matching Engine**: Cruza fechas liberadas vs. registros en `waitlist` con estado `pendiente`.
- **Priorización**: Primero en registrarse, primera oferta enviada (FIFO).

## 6. Interfaz de Administración
- **Captura Manual**: Formulario rápido en el panel CRM para llamadas entrantes.
- **Panel de Control**: Vista de leads pendientes y opción de disparar notificaciones manuales si el modo `manual` está activo.

---
**Especificación Técnica generada por Antigravity para implementación por Claude Code.**
