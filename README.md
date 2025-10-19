# Instrucciones

Asume el rol de arquitecto de software experto en las tecnologías usadas en este proyecto.  
Recibirás un repositorio de GitHub. Primero analiza su estructura y el archivo README para entender objetivos, dependencias y flujo general.  

Asume el rol de arquitecto de software experto en las tecnologías usadas en este proyecto.  
Recibirás un repositorio de GitHub. Primero analiza su estructura y el archivo README para entender objetivos, dependencias y flujo general.  
Cuando te pida realizar modificaciones, deberás:  

1. Siempre devolver los archivos completos, nunca fragmentos.  
2. No agregar comentarios ni dentro de las funciones ni en el código ya existente.  
3. Mantener el estilo de código, convenciones y arquitectura ya usadas en el repositorio.  
4. Si hay múltiples formas de resolverlo, prioriza la más simple, clara y mantenible.  
5. Si debo modificar más de un archivo para que el cambio funcione, incluye todos los archivos necesarios en la respuesta.  
6. Si es necesario crear nuevos archivos, entrégalos completos.  
7. Antes de dar el código, explícame brevemente los cambios y por qué son necesarios.  
Cuando modifiques archivos existentes:
9. Si una función no requiere cambios, mantenla exactamente igual como en la versión anterior.  
   Nunca la reemplaces con “// ... (código existente)”.  
10. Si una función requiere cambios, entrégala completa con los cambios aplicados.  
11. Nunca borres lógica previa ni la resumas con comentarios de relleno.  
12. Mantén el estilo y la coherencia del código ya presente.

Mi objetivo es evolucionar el proyecto paso a paso, así que actúa como un **socio técnico** que me guía en decisiones de arquitectura y en la implementación.

Plan de Desarrollo: SuiteManager
Última actualización: 16 de Septiembre de 2025

1. Resumen Ejecutivo
SuiteManager es una aplicación web de software como servicio (SaaS) diseñada para la gestión integral de propiedades de arriendo a corto plazo (cabañas, apartamentos, etc.). El objetivo es transformar una herramienta interna en un producto comercial robusto, seguro y escalable, capaz de dar servicio a múltiples empresas (arquitectura multi-inquilino o multi-tenant).

El sistema está construido con una arquitectura moderna que separa el backend (Node.js/Express) del frontend (JavaScript puro en formato SPA), garantizando un mantenimiento sencillo y una experiencia de usuario fluida.

2. Estado Actual del Proyecto: ¡Base Funcional Establecida!
Tras un reinicio estratégico ("Plan Renacer"), hemos superado con éxito la fase de configuración y depuración de la infraestructura. El proyecto se encuentra ahora en un estado estable y funcional.

Hitos Alcanzados:

✅ Infraestructura Limpia: Se han creado desde cero nuevos servicios en la nube para eliminar cualquier configuración conflictiva.

✅ Despliegue Automatizado: El proyecto está configurado con un flujo de CI/CD. Cualquier cambio subido al repositorio de GitHub se despliega automáticamente en el servidor de producción.

✅ Arquitectura SPA Validada: La base de la aplicación de una sola página (SPA), con su enrutador y carga dinámica de vistas, está funcionando correctamente en el servidor de producción.

✅ Autenticación Multi-inquilino Funcional: El bloque de registro de nuevas empresas e inicio de sesión de usuarios está 100% operativo. El sistema crea correctamente las empresas y los usuarios en colecciones separadas en Firestore y protege las rutas de la API con tokens de autenticación.

Log de la última prueba exitosa en Render:
[DEBUG] Iniciando Firebase Admin SDK para el proyecto: suite-manager-app
Nueva empresa "Prueba 1" y usuario admin "orillasdelcoilaco@gmail.com" creados con éxito.

3. Infraestructura y Servicios
Nombre del Proyecto: SuiteManager (anteriormente StayManager).

Repositorio de Código: https://github.com/orillasdelcoilaco/staymanager

Proyecto de Firebase:

Nombre: suite-manager-app

ID Único (para configuración): El que se genera automáticamente (ej. suite-manager-app-a1b2c)

Servidor de Despliegue:

Servicio: Render

Nombre del Servicio: suite-manager

URL de Producción: https://suite-manager.onrender.com (o la que Render asigne en el despliegue).

4. Arquitectura Técnica
Backend (Node.js + Express)
Función: Actúa como el cerebro de la aplicación. Gestiona la lógica de negocio, la seguridad y la comunicación con la base de datos.

Estructura: Modular y organizada por responsabilidades:

routes/: Define las rutas de la API (ej. /auth/register).

services/: Contiene la lógica de negocio pura (ej. cómo crear un usuario en la base de datos).

middleware/: "Guardias de seguridad" que protegen las rutas (ej. authMiddleware).

Servicio: Sirve tanto la API (/api/*, /auth/*) como los archivos estáticos del frontend, eliminando por completo los problemas de CORS.

Frontend (JavaScript Puro - SPA)
Función: Es la interfaz con la que interactúa el usuario. Es rápida y fluida, ya que no necesita recargar la página para navegar entre secciones.

Estructura:

index.html: Un "caparazón" simple que carga la aplicación.

src/router.js: El punto de entrada principal. Gestiona las URLs limpias (sin #), verifica la autenticación y carga la vista correspondiente.

src/views/: Cada sección (Dashboard, Clientes, etc.) es un módulo independiente que se carga bajo demanda.

Base de Datos (Cloud Firestore)
Arquitectura Multi-Inquilino: La base de datos está diseñada para aislar completamente los datos de cada empresa cliente.

empresas/ (colección)
└── {empresaId}/ (documento)
    ├── nombre: "Nombre de la Empresa"
    ├── propietarioUid: "uid-del-dueño"
    │
    ├── users/ (sub-colección)
    │   └── {userId}: { rol: "admin", email: "..." }
    │
    ├── clientes/ (sub-colección)
    │   └── {clienteId}: { nombre: "...", telefono: "..." }
    │
    ├── reservas/ (sub-colección)
    │   └── {reservaId}: { ... }
    │
    └── propiedades/ (sub-colección)
        └── {propiedadId}: { nombre: "Cabaña 1", capacidad: 4 }

5. Hoja de Ruta del Desarrollo (Roadmap por Bloques)
Ahora que la base está sólida, construiremos las funcionalidades en bloques manejables.

Bloque 0: Reinicio y Base Sólida - ✅ Completado

Bloque 1: Autenticación y Arquitectura SPA - ✅ Completado

Bloque 2: Gestión de Propiedades (Próximo Paso)

Objetivo: Permitir que un usuario "admin" pueda crear, ver, editar y eliminar las propiedades de su empresa (cabañas, apartamentos, etc.).

Backend:

Crear propiedadesService.js con la lógica para interactuar con la subcolección propiedades.

Crear propiedades.js en routes/ con los endpoints GET, POST, PUT, DELETE, todos protegidos por el authMiddleware.

Frontend:

Crear una nueva vista propiedades.js en src/views/.

Diseñar una tabla para listar las propiedades y un modal para crear/editar.

Añadir el enlace "Gestionar Propiedades" al menú en router.js.

Bloque 3: Gestión de Clientes (CRM)

Objetivo: Replicar la funcionalidad de gestión de clientes, pero ahora vinculada a cada empresa.

Backend: Lógica para el CRUD de clientes en la subcolección empresas/{empresaId}/clientes.

Frontend: Desarrollar la vista clientes.js con una tabla de clientes y un modal de edición.

Bloque 4: Creación y Gestión de Reservas

Objetivo: Re-implementar el flujo de creación de propuestas, confirmación y gestión de reservas.

Backend: Desarrollar los servicios y rutas para reservas.

Frontend: Crear las vistas para el generador de propuestas y el listado de reservas.

Bloques Posteriores (en orden de prioridad):

Bloque 5: Gestión Operativa Diaria.

Bloque 6: Calendario de Ocupación con FullCalendar.js.

Bloque 7: Dashboard y KPIs.

Bloque 8: Sincronización de datos (iCal, reportes, etc.).

Bloque 9: Generación de reportes y mensajes.

# SuiteManager: Plan de Desarrollo y Arquitectura
Última actualización: 26 de Septiembre de 2025

## 1. Resumen Ejecutivo
SuiteManager es una aplicación web de Software como Servicio (SaaS) diseñada para la gestión integral y multi-empresa de propiedades de arriendo a corto plazo. El sistema centraliza la operación, automatiza flujos de trabajo y proporciona herramientas de auditoría y gestión, permitiendo a cada empresa cliente administrar sus propiedades, clientes y reservas de forma aislada y segura.

Construido sobre una arquitectura moderna que separa un backend robusto (Node.js/Express) de un frontend modular (JavaScript Vainilla - SPA), SuiteManager está diseñado para ser escalable, mantenible y ofrecer una experiencia de usuario fluida y eficiente.

## 2. Estado Actual: Plataforma Operativa y Modular
El proyecto ha superado la fase de desarrollo inicial y se encuentra en un estado funcionalmente completo y estable. Las principales funcionalidades operativas han sido implementadas y probadas, y la arquitectura del frontend ha sido refactorizada hacia un modelo de componentes modulares para garantizar la escalabilidad y facilidad de mantenimiento a largo plazo.

### Funcionalidades Clave Implementadas:
✅ **Arquitectura Multi-Empresa:** El sistema soporta múltiples empresas, aislando completamente los datos (reservas, clientes, propiedades) de cada una.
✅ **Gestión de Usuarios:** Cada empresa puede gestionar sus propios usuarios administradores, incluyendo la creación y eliminación de cuentas.
✅ **Panel de Gestión Diaria:** Un "To-Do List" inteligente que prioriza reservas según su urgencia y guía al usuario a través de un flujo de estados (Bienvenida, Cobro, Pago, Boleta).
✅ **Sincronización de Reportes:** Módulo para procesar y consolidar reportes de reservas de diferentes canales (SODC, Booking, Airbnb, etc.).
✅ **CRM y Gestión de Clientes:** Base de datos de clientes centralizada con perfiles detallados e historial de reservas.
✅ **Integración con Google Contacts:** Sincronización automática de nuevos clientes con la cuenta de Google de la empresa, incluyendo herramientas de verificación y reparación masiva.
✅ **Gestión de Propiedades, Canales y Tarifas:** Módulos completos para configurar los activos y la lógica de negocio de cada empresa.
✅ **Auditoría de Cargas:** Cada reserva está vinculada al reporte de origen, permitiendo un seguimiento y auditoría precisos.

## 3. Arquitectura Técnica

### Backend (Node.js + Express)
Actúa como el cerebro de la aplicación, gestionando la lógica de negocio, la seguridad (autenticación y autorización por empresa) y la comunicación con la base de datos. Su estructura es modular:
- **`routes/`**: Define los endpoints de la API.
- **`services/`**: Contiene la lógica de negocio pura, aislada de las rutas.
- **`middleware/`**: Protege las rutas, asegurando que un usuario solo pueda acceder a los datos de su propia empresa.

### Frontend (JavaScript Vainilla - SPA Modular)
Es la interfaz con la que interactúa el usuario. Tras una importante refactorización, ahora sigue una arquitectura de componentes modulares para mejorar la manenibilidad.
- **`router.js`**: El punto de entrada que gestiona las URLs y carga las vistas principales.
- **`views/`**: Contiene los archivos principales de cada "página" o vista (ej. `gestionDiaria.js`, `gestionarClientes.js`). Estos archivos actúan como **orquestadores**.
- **`views/components/`**: **(Nueva Arquitectura)** Esta carpeta contiene subcarpetas para componentes reutilizables específicos de una vista. Por ejemplo, `gestionDiaria/` contiene:
    - **`gestionDiaria.cards.js`**: Módulo responsable únicamente de renderizar las "tarjetas" de reserva.
    - **`gestionDiaria.modals.js`**: Módulo que actúa como "controlador" para todos los modales de esa vista.
    - **`gestionDiaria.utils.js`**: Módulo con funciones de ayuda específicas para esa vista.

Esta separación de responsabilidades nos permite modificar o añadir funcionalidades a una parte específica (ej. un modal) sin afectar el resto de la aplicación.

### Base de Datos (Cloud Firestore)
La arquitectura multi-empresa es el núcleo del diseño de la base de datos:
empresas/ (colección)
└── {empresaId}/ (documento)
├── nombre: "Nombre de la Empresa"
│
├── users/ (sub-colección de usuarios)
├── clientes/ (sub-colección de clientes)
├── reservas/ (sub-colección de reservas)
├── propiedades/ (sub-colección de propiedades)
└── historialCargas/ (sub-colección para auditoría)

## 4. Hoja de Ruta del Desarrollo

El plan de desarrollo inicial se ha completado con éxito. Los próximos pasos se centrarán en enriquecer la plataforma con herramientas de análisis y mejorar la experiencia del usuario.

### Bloques de Desarrollo
- **Bloque 0: Reinicio y Base Sólida** - ✅ **Completado**
- **Bloque 1: Autenticación y Arquitectura SPA** - ✅ **Completado**
- **Bloque 2: Gestión de Propiedades** - ✅ **Completado**
- **Bloque 3: Gestión de Clientes (CRM)** - ✅ **Completado**
- **Bloque 4: Creación y Gestión de Reservas** - ✅ **Completado**
- **Bloque 5: Gestión Operativa Diaria** - ✅ **Completado**
- **Bloque 6: Calendario de Ocupación** - ✅ **Completado**
- **Bloque 7: Sincronización y Auditoría de Datos** - ✅ **Completado**
- **Bloque 8: Gestión de Usuarios y Empresa** - ✅ **Completado**

### Próximos Pasos
- **Dashboard y KPIs:** Implementar un panel de control con indicadores clave de rendimiento (KPIs) como tasa de ocupación, ADR (Average Daily Rate), RevPAR (Revenue Per Available Room), etc.
- **Generador de Presupuestos:** Crear una herramienta para generar cotizaciones y propuestas de reserva de forma rápida.
- **Sincronización iCal:** Implementar la exportación de calendarios en formato iCal para sincronizar la disponibilidad con plataformas externas.

# SuiteManager: Plan de Desarrollo y Arquitectura
Última actualización: 27 de Septiembre de 2025

## 1. Resumen Ejecutivo
SuiteManager es una aplicación web de Software como Servicio (SaaS) diseñada para la gestión integral y multi-empresa de propiedades de arriendo a corto plazo. El sistema centraliza la operación, automatiza flujos de trabajo y proporciona herramientas de auditoría y gestión, permitiendo a cada empresa cliente administrar sus propiedades, clientes y reservas de forma aislada y segura.

Construido sobre una arquitectura moderna que separa un backend robusto (Node.js/Express) de un frontend modular (JavaScript Vainilla - SPA), SuiteManager está diseñado para ser escalable, mantenible y ofrecer una experiencia de usuario fluida y eficiente.

## 2. Estado Actual: Plataforma Operativa y Modular
El proyecto ha superado la fase de desarrollo inicial y se encuentra en un estado funcionalmente completo y estable. Las principales funcionalidades operativas han sido implementadas y probadas, y la arquitectura del frontend ha sido refactorizada hacia un modelo de componentes modulares para garantizar la escalabilidad y facilidad de mantenimiento a largo plazo.

### Funcionalidades Clave Implementadas:
✅ **Arquitectura Multi-Empresa:** El sistema soporta múltiples empresas, aislando completamente los datos (reservas, clientes, propiedades) de cada una.
✅ **Gestión de Usuarios:** Cada empresa puede gestionar sus propios usuarios administradores, incluyendo la creación y eliminación de cuentas.
✅ **Panel de Gestión Diaria:** Un "To-Do List" inteligente que prioriza reservas según su urgencia y guía al usuario a través de un flujo de estados (Bienvenida, Cobro, Pago, Boleta).
✅ **Sincronización de Reportes:** Módulo para procesar y consolidar reportes de reservas de diferentes canales (SODC, Booking, Airbnb, etc.), con un motor de cálculo financiero para estandarizar los ingresos.
✅ **CRM y Gestión de Clientes:** Base de datos de clientes centralizada con perfiles detallados e historial de reservas.
✅ **Integración con Google Contacts:** Sincronización automática de nuevos clientes con la cuenta de Google de la empresa.
✅ **Gestión de Propiedades, Canales y Tarifas:** Módulos completos para configurar los activos y la lógica de negocio de cada empresa.
✅ **Auditoría de Cargas:** Cada reserva está vinculada al reporte de origen, permitiendo un seguimiento y borrado masivo de cargas.

## 3. Arquitectura Técnica

### Backend (Node.js + Express)
Actúa como el cerebro de la aplicación, gestionando la lógica de negocio, la seguridad (autenticación y autorización por empresa) y la comunicación con la base de datos. Su estructura es modular:
- **`routes/`**: Define los endpoints de la API.
- **`services/`**: Contiene la lógica de negocio pura, aislada de las rutas.
- **`middleware/`**: Protege las rutas, asegurando que un usuario solo pueda acceder a los datos de su propia empresa.

#### Modularización de Servicios
Siguiendo la misma filosofía del frontend, los servicios del backend se están refactorizando en módulos con responsabilidades únicas. Por ejemplo, la lógica de negocio para la "Gestión Diaria" se divide en:
- **`gestionDiariaService.js`**: Orquesta la obtención de datos para la vista principal.
- **`bitacoraService.js`**: Maneja exclusivamente la lógica de la bitácora de notas.
- **`analisisFinancieroService.js`**: Contiene la lógica para los cálculos de rentabilidad y costos de canal.
- **`transaccionesService.js`**: Gestiona la obtención de transacciones y pagos.

Esta separación mejora la mantenibilidad y reduce la complejidad de cada archivo individual.

### Frontend (JavaScript Vainilla - SPA Modular)
Es la interfaz con la que interactúa el usuario. Sigue una arquitectura de componentes modulares para mejorar la manenibilidad.
- **`router.js`**: El punto de entrada que gestiona las URLs y carga las vistas principales.
- **`views/`**: Contiene los archivos principales de cada "página" o vista (ej. `gestionDiaria.js`). Estos archivos actúan como **orquestadores**.
- **`views/components/`**: Esta carpeta contiene subcarpetas para componentes reutilizables específicos de una vista. Por ejemplo, `gestionDiaria/` contiene:
    - **`gestionDiaria.cards.js`**: Módulo responsable únicamente de renderizar las "tarjetas" de reserva.
    - **`gestionDiaria.modals.js`**: Módulo que actúa como "controlador" para todos los modales de esa vista.
    - **`gestionDiaria.utils.js`**: Módulo con funciones de ayuda específicas para esa vista.

### Base de Datos (Cloud Firestore)
La arquitectura multi-empresa es el núcleo del diseño de la base de datos:
`empresas/{empresaId}`
- `users/`

SuiteManager: Plan de Desarrollo y Arquitectura
Última actualización: 26 de Septiembre de 2025

1. Resumen Ejecutivo
SuiteManager es una aplicación web de Software como Servicio (SaaS) diseñada para la gestión integral y multi-empresa de propiedades de arriendo a corto plazo. El sistema centraliza la operación, automatiza flujos de trabajo y proporciona herramientas de auditoría y gestión, permitiendo a cada empresa cliente administrar sus propiedades, clientes y reservas de forma aislada y segura.

Construido sobre una arquitectura moderna que separa un backend robusto (Node.js/Express) de un frontend modular (JavaScript Vainilla - SPA), SuiteManager está diseñado para ser escalable, mantenible y ofrecer una experiencia de usuario fluida y eficiente.

2. Estado Actual: Plataforma Operativa y Modular
El proyecto ha superado la fase de desarrollo inicial y se encuentra en un estado funcionalmente completo y estable. Las principales funcionalidades operativas han sido implementadas y probadas, y la arquitectura del frontend ha sido refactorizada hacia un modelo de componentes modulares para garantizar la escalabilidad y facilidad de mantenimiento a largo plazo.

Funcionalidades Clave Implementadas:
✅ Arquitectura Multi-Empresa: El sistema soporta múltiples empresas, aislando completamente los datos (reservas, clientes, propiedades) de cada una.
✅ Gestión de Usuarios: Cada empresa puede gestionar sus propios usuarios administradores, incluyendo la creación y eliminación de cuentas.
✅ Panel de Gestión Diaria: Un "To-Do List" inteligente que prioriza reservas según su urgencia y guía al usuario a través de un flujo de estados (Bienvenida, Cobro, Pago, Boleta).
✅ Sincronización de Reportes: Módulo para procesar y consolidar reportes de reservas de diferentes canales (SODC, Booking, Airbnb, etc.).
✅ CRM y Gestión de Clientes: Base de datos de clientes centralizada con perfiles detallados e historial de reservas.
✅ Integración con Google Contacts: Sincronización automática de nuevos clientes con la cuenta de Google de la empresa, incluyendo herramientas de verificación y reparación masiva.
✅ Gestión de Propiedades, Canales y Tarifas: Módulos completos para configurar los activos y la lógica de negocio de cada empresa.
✅ Auditoría de Cargas: Cada reserva está vinculada al reporte de origen, permitiendo un seguimiento y auditoría precisos.

3. Arquitectura Técnica
Backend (Node.js + Express)
Actúa como el cerebro de la aplicación, gestionando la lógica de negocio, la seguridad (autenticación y autorización por empresa) y la comunicación con la base de datos. Su estructura es modular:

routes/: Define los endpoints de la API.

services/: Contiene la lógica de negocio pura, aislada de las rutas.

middleware/: Protege las rutas, asegurando que un usuario solo pueda acceder a los datos de su propia empresa.

Frontend (JavaScript Vainilla - SPA Modular)
Es la interfaz con la que interactúa el usuario. Tras una importante refactorización, ahora sigue una arquitectura de componentes modulares para mejorar la manenibilidad.

router.js: El punto de entrada que gestiona las URLs y carga las vistas principales.

views/: Contiene los archivos principales de cada "página" o vista (ej. gestionDiaria.js, gestionarClientes.js). Estos archivos actúan como orquestadores.

views/components/: (Nueva Arquitectura) Esta carpeta contiene subcarpetas para componentes reutilizables específicos de una vista. Por ejemplo, gestionDiaria/ contiene:

gestionDiaria.cards.js: Módulo responsable únicamente de renderizar las "tarjetas" de reserva.

gestionDiaria.modals.js: Módulo que actúa como "controlador" para todos los modales de esa vista.

gestionDiaria.utils.js: Módulo con funciones de ayuda específicas para esa vista.

Esta separación de responsabilidades nos permite modificar o añadir funcionalidades a una parte específica (ej. un modal) sin afectar el resto de la aplicación.

Base de Datos (Cloud Firestore)
La arquitectura multi-empresa es el núcleo del diseño de la base de datos:
empresas/ (colección)
└── {empresaId}/ (documento)
├── nombre: "Nombre de la Empresa"
│
├── users/ (sub-colección de usuarios)
├── clientes/ (sub-colección de clientes)
├── reservas/ (sub-colección de reservas)
├── propiedades/ (sub-colección de propiedades)
└── historialCargas/ (sub-colección para auditoría)

Nota de Arquitectura - 28 de Septiembre de 2025
Estado Actual del Código
El sistema financiero actual opera con un conjunto de variables consolidadas en el panel de "Gestión Diaria". El valorTotalHuesped funciona como el monto principal de cara al cliente, y el valorTotalPayout como el ingreso neto para el anfitrión. La herramienta "Ajustar Tarifa" permite modificar estos valores, pero la lógica necesita ser refinada para separar claramente la gestión de cobros de los análisis de rentabilidad (KPIs).

Definiciones Financieras Acordadas
Para mejorar la claridad y la toma de decisiones, se establecen las siguientes definiciones para las variables financieras clave:

FINANZAS: Total Pagado por Huésped:

Definición: Es el monto principal y de cara al cliente. Sobre este valor se calculan los abonos, saldos y la facturación.

Modificable: Sí, a través de la pestaña "Ajustar Cobro" en Gestión Diaria, lo que permite flexibilidad en la negociación.

FINANZAS: Valor de Lista / Subtotal:

Definición: Es el precio base de la reserva, extraído de la configuración de "Tarifas" para la fecha y propiedad correspondientes.

Modificable: No. Se guarda como un antecedente inmutable en la reserva para garantizar la consistencia en los cálculos de KPIs.

FINANZAS: Descuento Manual (%):

Definición: Un porcentaje de descuento (ej. Genius, oferta de última hora) que se aplica manualmente en la pestaña "Ajustar Payout (KPI)" para justificar por qué el Payout final es menor que el Valor de Lista.

Propósito: Auditoría y análisis de rentabilidad.

FINANZAS: Pago Recibido por Anfitrión (Payout):

Definición: El KPI de rentabilidad final.

Fórmula de Cálculo: Payout = Valor de Lista - (Costos del Canal + Monto del Descuento Manual).

Importante: Todos los cálculos deben ser conscientes de la moneda del canal y usar el valorDolarDia para convertir a CLP cuando sea necesario.

FINANZAS: Comisión del Canal y FINANZAS: Tarifa de Servicio:

Definición: Representan los costos directos de operar a través de un canal de venta.

FINANZAS: Impuestos (ej. IVA):

Definición: Un impuesto que se calcula a partir del Total Pagado por Huésped. El porcentaje será configurable a nivel de empresa.

FINANZAS: Abono o Pago Parcial:

Definición: Representa los pagos parciales registrados en "Gestionar Pagos". La suma de estos se resta del Total Pagado por Huésped para obtener el saldo.

Modificaciones Acordadas en "Ajuste de Tarifa"
El modal "Ajuste de Tarifa" en Gestión Diaria será reestructurado con tres pestañas:

Ajustar Payout (KPI): (Anteriormente "Calcular Potencial")

Permitirá al usuario ingresar un Descuento Manual (%) para registrar descuentos no reflejados en el reporte y recalcular el Payout real de la reserva. Esta acción afecta los KPIs internos, no el cobro al cliente.

Ajustar Cobro:

Mantiene su funcionalidad actual. Permite modificar el Total Pagado por Huésped, afectando directamente el monto a cobrar y facturar.

Simulador Venta Directa (Nueva):

Una herramienta de solo lectura para análisis estratégico.

Mostrará un desglose claro de la rentabilidad de la reserva actual (considerando moneda y valorDolarDia).

Sugerirá el descuento máximo que se podría ofrecer en una venta directa para seguir siendo más rentable que el canal original.

4. Hoja de Ruta del Desarrollo
El plan de desarrollo inicial se ha completado con éxito. Los próximos pasos se centrarán en enriquecer la plataforma con herramientas de análisis y mejorar la experiencia del usuario.

Bloques de Desarrollo
Bloque 0: Reinicio y Base Sólida - ✅ Completado

Bloque 1: Autenticación y Arquitectura SPA - ✅ Completado

Bloque 2: Gestión de Propiedades - ✅ Completado

Bloque 3: Gestión de Clientes (CRM) - ✅ Completado

Bloque 4: Creación y Gestión de Reservas - ✅ Completado

Bloque 5: Gestión Operativa Diaria - ✅ Completado

Bloque 6: Calendario de Ocupación - ✅ Completado

Bloque 7: Sincronización y Auditoría de Datos - ✅ Completado

Bloque 8: Gestión de Usuarios y Empresa - ✅ Completado

Próximos Pasos
Dashboard y KPIs: Implementar un panel de control con indicadores clave de rendimiento (KPIs) como tasa de ocupación, ADR (Average Daily Rate), RevPAR (Revenue Per Available Room), etc.

Generador de Presupuestos: Crear una herramienta para generar cotizaciones y propuestas de reserva de forma rápida.

Sincronización iCal: Implementar la exportación de calendarios en formato iCal para sincronizar la disponibilidad con plataformas externas.

### Arquitectura de Actualización en Cascada (Manifiesto)
Para manejar de forma robusta y escalable la actualización de identificadores clave, como el `idReservaCanal`, el sistema utiliza un "Manifiesto de Actualización".

- **Ubicación:** `backend/config/idUpdateManifest.js`
- **Propósito:** Este archivo actúa como un registro centralizado que define todas las colecciones y campos en la base de datos que dependen del ID de una reserva.
- **Funcionamiento:** Cuando un usuario modifica un `idReservaCanal` a través de la interfaz, una función especializada en el backend (`actualizarIdReservaCanalEnCascada`) lee este manifiesto y recorre cada entrada. Para cada una, ejecuta una operación de actualización en la base de datos, asegurando que el cambio se propague a todos los rincones del sistema de forma automática.
- **Ventaja a Futuro:** Si una nueva funcionalidad (ej. "Encuestas") necesita guardar el ID de la reserva, solo es necesario añadir una nueva línea al manifiesto. La lógica de actualización en cascada funcionará para esta nueva funcionalidad sin necesidad de modificar el código principal, garantizando la mantenibilidad y reduciendo la posibilidad de errores.

## 4. Hoja de Ruta del Desarrollo
- **Dashboard y KPIs:** Implementar un panel de control con indicadores clave de rendimiento (KPIs).
- **Generador de Presupuestos:** Mejorar la herramienta para generar cotizaciones y propuestas de reserva.
- **Sincronización iCal:** Implementar la exportación de calendarios en formato iCal.
- **Reportes Avanzados:** Crear un módulo para generar reportes financieros y de ocupación personalizables.

Anexo de Arquitectura: Definiciones Financieras Clave
Para garantizar la precisión y consistencia de los datos en toda la aplicación, especialmente en el Dashboard y los reportes, se establecen las siguientes definiciones para las variables financieras principales:

Ingreso Proyectado (Total Cliente):

Definición: Es el monto total que se espera cobrar a un cliente por una reserva. Se calcula a partir de las tarifas base y se le pueden aplicar descuentos.

Fuente: Campo valores.valorHuesped en los documentos de reserva.

Estado de Reserva: Se considera para todas las reservas con estado: 'Confirmada'.

Ingreso Facturado (Real):

Definición: Es el ingreso que ya ha completado su ciclo de gestión y se considera "cerrado" o facturado. Representa el dinero real que ha ingresado o está asegurado.

Fuente: Campo valores.valorHuesped de las reservas cuyo estadoGestion es 'Facturado'.

Payout (Ingreso Neto):

Definición: Es la ganancia neta para el anfitrión después de descontar los costos asociados al canal de venta (comisiones, tarifas de servicio, etc.). Este es el KPI de rentabilidad más importante.

Fuente: Campo payoutFinalReal en los datos agrupados que se calculan en el backend (gestionService.js). Su fórmula es: valorTotalHuesped - costoCanal.

Contexto: Se calcula tanto para ingresos proyectados como para facturados.

Costo del Canal:

Definición: Representa todos los costos directos deducidos por el canal de venta (ej. comisión de Booking, tarifa de servicio de Airbnb).

Fuente: Campo costoCanal en los datos agrupados (gestionService.js), que a su vez suma los campos valores.comision o valores.costoCanal de las reservas individuales.

Valor Potencial (Precio de Lista):

Definición: Es el precio teórico de una reserva antes de cualquier descuento aplicado por el canal o manualmente. Se utiliza para medir la efectividad de las estrategias de precios y descuentos.

Fuente: Campo valores.valorPotencial en los documentos de reserva. Este valor se calcula y guarda a través de la herramienta "Ajustar Tarifa" en la Gestión Diaria.

Descuento Real:

Definición: Es la diferencia entre el Valor Potencial y el Ingreso Proyectado. Cuantifica el valor "perdido" debido a descuentos y comisiones para asegurar una reserva.

Fórmula: Valor Potencial - Ingreso Proyectado.

Esta distinción clara entre lo proyectado y lo facturado es la piedra angular del nuevo Dashboard y permitirá un análisis financiero detallado y preciso del negocio.

## 5. Hoja de Ruta - Etapa 2: Módulo de CRM y Marketing (Próximo Paso)

### Objetivo Principal
Implementar un sistema de Customer Relationship Management (CRM) enfocado en la fidelización y el marketing directo, permitiendo a los usuarios enviar promociones personalizadas y realizar un seguimiento de su efectividad.

### Modelo Estratégico: Híbrido (RFM + Triggers de Eventos)

1.  **Segmentación RFM (Recencia, Frecuencia, Valor Monetario):**
    * **Concepto:** Clasificar a todos los clientes en segmentos dinámicos basados en su comportamiento de compra. El sistema analizará el historial de reservas para calcular:
        * **Recencia:** Cuándo fue su última estadía.
        * **Frecuencia:** Cuántas veces ha reservado.
        * **Monetario:** Cuánto ha gastado en total.
    * **Segmentos a Crear:**
        * **🏆 Campeones:** Clientes de alto valor, recientes y frecuentes.
        * **❤️ Leales:** Clientes recurrentes que forman la base del negocio.
        * **😟 En Riesgo:** Clientes valiosos que no han regresado en mucho tiempo.
        * **🌱 Nuevos:** Clientes con una sola estadía, objetivo de fidelización.

2.  **Marketing por Eventos (Triggers):**
    * **Concepto:** Enviar mensajes automáticos basados en acciones o fechas específicas para mantener el contacto con el cliente.
    * **Triggers a Implementar:**
        * **Post-Estadía:** Mensaje de agradecimiento y solicitud de reseña.
        * **Aniversario de Estadía:** Recordatorio y oferta especial al cumplirse un año de una visita.

### Canal de Comunicación y Seguimiento

* **Canal Principal:** **WhatsApp**, aprovechando que el número de teléfono es el dato de contacto primario. El sistema generará enlaces "Click-to-Chat" para facilitar el envío.
* **Mecánica de Seguimiento:**
    1.  **Envío:** El sistema ayuda a seleccionar un segmento y a redactar el mensaje. El envío final se realiza manualmente a través de los enlaces generados.
    2.  **Conversación:** La interacción directa (respuestas, preguntas) se maneja fuera del sistema, en el WhatsApp del usuario.
    3.  **Medición (Cierre del Círculo):** El éxito se medirá de forma automática. Cuando un cliente perteneciente a una campaña realice una nueva reserva, el sistema podrá vincularla y así medir la efectividad de la promoción.

### Plan de Implementación

#### Backend

* Crear un nuevo `crmService.js` para contener la lógica de negocio del CRM.
* Desarrollar una función que lea todas las reservas de una empresa para calcular los valores R, F y M de cada cliente y guardarlos en sus respectivos perfiles.
* Crear una nueva ruta en `crm.js` (ej. `GET /api/crm/segmento/:nombreSegmento`) que devuelva la lista de clientes pertenecientes a un segmento específico.

#### Frontend

* Crear una nueva vista `crmPromociones.js`.
* **Interfaz de la Vista:**
    * Un selector de segmentos (Dropdown con "Campeones", "Leales", etc.).
    * Una tabla para listar los clientes del segmento seleccionado.
    * Un área para redactar el mensaje de la promoción, utilizando plantillas y etiquetas (ej. `[NOMBRE_CLIENTE]`).
    * Un botón "Generar Campaña" que, al presionarlo, muestre una lista de los mensajes personalizados con sus respectivos botones "Enviar por WhatsApp".

    Anexo de Arquitectura: Refactorización del Motor de Tarifas (Octubre 2025)
Se ha llevado a cabo una refactorización integral del sistema de gestión de tarifas para reemplazar un modelo manual y propenso a errores por una arquitectura de "Tarifa Base + Modificadores", que es más flexible, potente y fácil de mantener.

Objetivo de la Modificación
El objetivo principal fue simplificar drásticamente la creación y gestión de precios. En lugar de que el usuario deba introducir manualmente el precio para cada propiedad en cada canal y para cada temporada, ahora solo necesita definir un único Precio Base. El sistema se encarga de calcular automáticamente el precio final para los demás canales aplicando reglas predefinidas.

Principio Arquitectónico Clave: La Fuente de la Verdad
Un principio fundamental de esta nueva arquitectura es la integridad de los datos financieros existentes:

La Verdad Absoluta: El valor financiero de una reserva (valorHuesped, valorTotal) que proviene de un reporte externo (CSV de Booking, Airbnb, etc.) o que ha sido ajustado manualmente por un usuario es siempre la fuente de la verdad y NUNCA se sobreescribe por el nuevo motor de cálculo de tarifas.

El Rol del Nuevo Motor de Tarifas: Este sistema tiene dos propósitos claros:

Para Nuevas Reservas Manuales: Calcular precios de forma automática y consistente al usar herramientas como "Agregar Propuesta" o "Generador de Presupuestos".

Como Herramienta de KPI: Para las reservas importadas o existentes, el motor calcula el precio teórico según las tarifas configuradas y lo guarda como un valor de referencia (valores.valorOriginal). Esto permite realizar análisis de rentabilidad comparando el ingreso real contra el esperado.
se modificaron todos estos arhcivos  gestionarReservas, gestionarTarifas, gestionarCanales, agregarPropuesta,gestionDiaria.cards, ajusteTarifaModal, gestionDiaria, tarifasService, propuestaService, sincronizacinSErvice, canalesService

Resumen de Modificaciones por Módulo
Backend (Lógica de Negocio)
services/canalesService.js:

Se ha enriquecido el modelo de canales. Ahora cada canal puede tener un modificadorTipo (porcentaje o fijo) y un modificadorValor.

Se gestiona la bandera esCanalPorDefecto para asegurar que siempre exista un único canal de referencia para los precios base.

services/tarifasService.js:

Creación/Actualización: Las funciones crearTarifa y actualizarTarifa fueron refactorizadas. Ahora solo guardan un único precioBase, vinculándolo al ID del canal por defecto en la base de datos (ej. precios: { id_canal_defecto: 100000 }).

Lectura y Cálculo: La función obtenerTarifasPorEmpresa fue rediseñada. Lee el precioBase y, al momento de la consulta, calcula dinámicamente los precios para todos los demás canales aplicando los modificadores configurados en cada uno.

services/propuestasService.js:

La función calculatePrice se ha convertido en el nuevo motor de precios centralizado. Es responsable de obtener la tarifa base, aplicar los modificadores del canal solicitado y gestionar la conversión de moneda (ej. de CLP a USD) utilizando el dolarService y la fecha de check-in.

services/sincronizacionService.js:

Se modificó para respetar el principio de la "fuente de la verdad". Durante la importación de un reporte, el servicio guarda los valores financieros reales del archivo.

Posteriormente, utiliza el nuevo calculatePrice únicamente para obtener el precio base teórico (para KPI) y lo almacena en valores.valorOriginal sin alterar los montos reales de la reserva.

services/gestionService.js:

Se actualizó para que, al obtener los datos para la "Gestión Diaria", también calcule y provea el valorListaBaseTotal (el precio de lista teórico), permitiendo comparativas de rentabilidad en el frontend.

Frontend (Interfaz de Usuario)
views/gestionarCanales.js:

El modal de edición fue actualizado para permitir la configuración de los nuevos campos modificadorTipo y modificadorValor, además de la bandera esCanalPorDefecto.

views/gestionarTarifas.js:

La interfaz de creación y edición de tarifas fue drásticamente simplificada. El usuario ahora solo necesita gestionar un único campo de "Precio Base".

La tabla del historial, aunque los datos se guardan de forma simple, ahora muestra una columna de "Tarifas Calculadas" que presenta los precios finales para todos los canales, aplicando los modificadores automáticamente para una visualización completa.

views/agregarPropuesta.js:

La lógica de precios y descuentos fue reconstruida para consumir el nuevo calculatePrice.

El resumen de precios ahora maneja escenarios multi-moneda de forma transparente, mostrando desgloses en la moneda original (ej. USD) y su equivalente final en CLP.

views/components/gestionDiaria/:

gestionDiaria.cards.js: Las tarjetas de reserva ahora muestran un desglose financiero detallado para reservas en moneda extranjera, indicando los valores en USD y su conversión a CLP.

ajusteTarifaModal.js: La pestaña "Simulador de Rentabilidad" fue completamente rediseñada. Ahora compara el ingreso real (payoutFinalReal) contra la tarifa base teórica (valorListaBaseTotal) para calcular y mostrar la rentabilidad precisa de la reserva y ofrecer recomendaciones estratégicas.

views/gestionarReservas.js:

El modal de edición fue ajustado para reflejar la nueva lógica. Los campos de precios ahora son editables para permitir correcciones manuales, consolidando que el valor almacenado en la reserva es la "verdad absoluta", mientras el sistema asiste con cálculos de conversión de moneda si es necesario.

Modulo CRM y Promociones 

- **Bloque 10: Segmentación de Clientes:** Implementación del modelo RFM (Recencia, Frecuencia, Valor Monetario) para clasificar a los clientes en segmentos de valor (Campeones, Leales, etc.) y creación de la vista inicial de CRM. - ✅ **Completado**

### Etapa 3: Sistema de Campañas y Cupones (Próximo Paso)

#### Objetivo
Evolucionar el CRM desde una herramienta de segmentación a una plataforma completa de marketing directo con seguimiento de interacciones y un sistema de cupones de un solo uso para incentivar la recurrencia y los referidos.

#### Bloque 11: Backend - Estructura de Campañas y Cupones

**Objetivo:** Crear la base de datos y la lógica de servidor para gestionar campañas y cupones.

1.  **Definir Modelos de Datos (Firestore):**
    * Crear una nueva sub-colección `empresas/{empresaId}/campanas`. Cada documento representará una campaña con su nombre, fecha, segmento objetivo y el mensaje enviado.
    * Crear una nueva sub-colección `empresas/{empresaId}/interacciones`. Cada documento vinculará a un cliente con una campaña y registrará su estado (Enviado, Respondió, No Interesado, Reservó).
    * Crear una nueva sub-colección `empresas/{empresaId}/cupones` para almacenar los cupones de un solo uso con su código, estado (disponible, utilizado), valor y cliente propietario.

2.  **Desarrollar Servicios de Backend:**
    * Crear `campanasService.js` con funciones para `crearCampana` y `registrarInteraccion`.
    * Crear `cuponesService.js` con lógica para `generarCuponParaCliente`, `validarCupon` y `marcarCuponComoUtilizado`.

3.  **Ampliar Rutas de la API (`crm.js`):**
    * Añadir nuevos endpoints para gestionar las campañas y los cupones (crear, validar, etc.).

#### Bloque 12: Frontend - Interfaz de Gestión de Campañas

**Objetivo:** Actualizar la vista de CRM para que el usuario pueda crear y dar seguimiento a las campañas.

1.  **Modificar la vista `crmPromociones.js`:**
    * Transformar la sección "Crear Campaña" en un formulario que pida un **nombre para la campaña**.
    * Al "Generar Campaña", el sistema primero creará el registro de la campaña en el backend y luego generará los mensajes.
    * Debajo de la lista de mensajes a enviar, mostrará una nueva tabla de **"Seguimiento de Interacciones"**.
    * Esta tabla mostrará cada cliente de la campaña con su estado inicial "📬 Enviado" y permitirá al usuario cambiarlo manualmente (a "💬 Respondió", "🚫 No Interesado", etc.).

#### Bloque 13: Integración del Sistema de Cupones

**Objetivo:** Conectar la generación y el uso de cupones en el flujo de trabajo del usuario.

1.  **Actualizar la vista `crmPromociones.js`:**
    * Añadir una acción en la lista de clientes para "Generar Cupón de Descuento".
    * Añadir la etiqueta `[CUPON_DESCUENTO]` al editor de mensajes para incluir el código del cupón en las promociones.

2.  **Modificar la vista `agregarPropuesta.js`:**
    * Añadir un campo de texto para "Aplicar Código de Descuento".
    * Implementar la lógica para que, al ingresar un código, se llame al backend para validarlo y, si es correcto, se aplique el descuento al total de la propuesta.

3.  **Actualizar el Proceso de Aprobación (`gestionPropuestasService.js`):**
    * Modificar la función `aprobarPropuesta` para que, si se usó un cupón, este se marque automáticamente como "utilizado" en la misma transacción en que se confirma la reserva, garantizando así su uso único.

6. Hoja de Ruta - Etapa 4: Ecosistema de Venta Directa y Metabuscadores
Con el núcleo de gestión operativa consolidado, la siguiente fase se centra en transformar SuiteManager en un motor de crecimiento para sus clientes. Se construirá un ecosistema de canales de venta directa que reduce la dependencia de las OTAs (Online Travel Agencies) y se conecta con metabuscadores globales para captar tráfico de alta intención de compra.

Este ecosistema se apoya en tres pilares técnicos fundamentales:

Motor de Reservas SSR: El corazón del sistema, un sitio web de reservas directas para cada cliente.

Integración con Metabuscadores: El puente hacia una visibilidad masiva en plataformas como Google Hotels, TripAdvisor y Trivago.

Red de Marketing Directo: Herramientas para captar y convertir tráfico desde campañas de pago y canales de mensajería.

Pilar 1: Motor de Reservas SSR Multi-Inquilino (El Núcleo)
Objetivo: Proveer a cada empresa de un sitio web de reservas de alto rendimiento, optimizado para SEO, personalizable y servido desde su propio dominio.

Arquitectura Técnica: Renderizado en el Servidor (SSR)
Se desarrollará como una aplicación de Renderizado en el Servidor (SSR) integrada en el backend de Express.js, utilizando EJS como motor de plantillas.

Justificación: Esta arquitectura es la elección óptima para:

Máximo Rendimiento (FCP): El servidor entrega un HTML completo, logrando un First Contentful Paint casi instantáneo, métrica clave para las Core Web Vitals de Google.

SEO Infalible: Los crawlers de búsqueda reciben un documento HTML estático y rico en contenido, garantizando una indexación rápida y completa.

Componentes Clave y Fases de Implementación
Fase 1: Implementación del Motor SSR Multi-Inquilino

Middleware de Resolución de Inquilino: Un middleware en Express.js detectará el hostname de la petición, buscará en Firestore la empresaId asociada al websiteSettings.domain y cargará la configuración del cliente en el objeto req.

Motor de Renderizado con EJS: Se crearán rutas (/, /propiedad/:slug) que usarán los datos del inquilino para consultar Firestore y renderizar las plantillas EJS con la información específica de la empresa (propiedades, textos, tarifas).

Optimización SEO Avanzada:

Generación dinámica de metadatos (<title>, <meta description>, og:tags).

Inclusión de JSON-LD con Schema.org (Hotel, HotelRoom, Offer) para resultados enriquecidos.

Generación de sitemap.xml dinámico por inquilino.

Optimización de Imágenes: Se integrará la librería sharp para crear un endpoint que redimensione, comprima y sirva imágenes en formato WebP bajo demanda.

Widget Embebible: Se diseñará una vista especial que pueda ser incrustada como un iframe o script en sitios de terceros, ampliando el alcance del motor de reservas.

Pilar 2: Integración con Metabuscadores
Objetivo: Conectar el inventario de SuiteManager con Google Hotels, TripAdvisor y Trivago, reutilizando la misma lógica de negocio central.

Arquitectura de Integración: API Pull con Feeds ARI (Availability, Rates, and Inventory)
Se expondrán endpoints públicos XML/JSON que los metabuscadores consultarán para obtener datos de disponibilidad, tarifas e inventario.

Fases de Implementación
Fase 2: Feed ARI para Google Hotels

Servicio Central (googleHotelsService.js): Contendrá la lógica para generar los feeds.

Feed de Listado de Propiedades: Un endpoint GET /integrations/google/properties/{empresaId} que devolverá un XML con los datos estáticos de las propiedades (nombre, dirección, fotos) según la especificación de Transaction (Property Data).

Feed ARI: Un endpoint GET /integrations/google/ari/{empresaId} que responderá a las peticiones de Google con precios y disponibilidad en tiempo real, consultando las colecciones reservas y tarifas.

Fase 3: Deep Linking y Reservas Pre-seleccionadas

Página de Aterrizaje Inteligente: El motor SSR se adaptará para procesar parámetros de URL provenientes de Google (ID de hotel, fechas, duración de la estancia).

Flujo de Conversión Directa: Cuando un usuario haga clic en un resultado de Google Hotels, será redirigido al sitio SSR, que pre-cargará la propiedad y las fechas, mostrando el precio final y simplificando drásticamente el proceso de reserva.

Fase 4: Adaptación para Trivago y TripAdvisor

Reutilización del Servicio ARI: Se extenderá el googleHotelsService.js para soportar las variaciones en los formatos XML/JSON de Trivago y TripAdvisor.

Nuevos Endpoints: Se crearán endpoints específicos para cada metabuscador (ej. /integrations/trivago/ari/{empresaId}), pero reutilizando el 90% de la lógica de negocio ya construida.

Pilar 3: Red de Marketing Directo
Objetivo: Complementar el tráfico de los metabuscadores con herramientas para campañas de pago y canales de mensajería.

Fases de Implementación
Fase 5: Campañas de Ads y Tracking Avanzado

Integración de Pixels: El motor SSR insertará dinámicamente los códigos de seguimiento (ej. Meta Pixel, Google Analytics 4) basándose en el googleAnalyticsId guardado en websiteSettings de cada empresa.

Landing Pages Dinámicas: El sistema permitirá crear páginas de aterrizaje optimizadas para SEO local (ej. "cabañas con tinaja en pucón"), asociadas a propiedades específicas para campañas de Google Ads.

Fase 6: Integración con WhatsApp API y Asistente de Ventas

Cierre de Ventas Asistido: Se añadirá un botón "Reservar por WhatsApp" en el motor SSR. Al hacer clic, se abrirá una conversación con un mensaje pre-cargado que incluye la propiedad, las fechas y el precio, facilitando el cierre de la venta.

Futura Evolución (Chatbot Concierge): Esta integración sentará las bases para un futuro chatbot impulsado por IA que pueda responder preguntas frecuentes y guiar a los usuarios en el proceso de reserva.

# SuiteManager: Plan de Desarrollo y Arquitectura
Última actualización: 18 de Octubre de 2025

## 1. Resumen Ejecutivo
SuiteManager es una aplicación web de Software como Servicio (SaaS) diseñada para la gestión integral y multi-empresa de propiedades de arriendo a corto plazo. El sistema centraliza la operación, automatiza flujos de trabajo y proporciona herramientas de auditoría y gestión, permitiendo a cada empresa cliente administrar sus propiedades, clientes y reservas de forma aislada y segura.

Construido sobre una arquitectura moderna que separa un backend robusto (Node.js/Express) de un frontend modular (JavaScript Vainilla - SPA), SuiteManager está diseñado para ser escalable, mantenible y ofrecer una experiencia de usuario fluida y eficiente, complementado ahora con un **motor de reservas público de alto rendimiento (SSR)** para cada cliente y la base para la **integración con metabuscadores**.

## 2. Estado Actual: Plataforma Operativa con Canal de Venta Directa Funcional
El proyecto ha superado las fases de desarrollo inicial y la implementación del núcleo de gestión. Se encuentra en un estado funcionalmente completo y estable, con una arquitectura refactorizada y modular. Se ha implementado con éxito un **motor de reservas web (SSR) multi-inquilino** que permite a cada empresa tener su propio sitio público identificable por dominio/subdominio, incluyendo búsqueda de disponibilidad, cálculo de precios y flujo de reserva completo. Además, se han sentado las bases técnicas para la **integración con Google Hotels**, generando los feeds de propiedades y ARI necesarios.

### Funcionalidades Clave Implementadas:
✅ **Arquitectura Multi-Empresa:** Soporte completo con aislamiento de datos.
✅ **Gestión de Usuarios:** Administración de usuarios por empresa.
✅ **Panel de Gestión Diaria (SPA):** Flujo de trabajo basado en estados para la operación.
✅ **Sincronización de Reportes:** Procesamiento y consolidación de reportes de OTAs.
✅ **CRM y Gestión de Clientes:** Base de datos con perfiles, historial y segmentación RFM.
✅ **Integración con Google Contacts:** Sincronización automática y herramientas de reparación.
✅ **Gestión de Activos:** Módulos para Propiedades, Canales y Tarifas Base + Modificadores.
✅ **Auditoría de Cargas:** Trazabilidad de reservas a reportes de origen.
✅ **Refactorización de Servicios Backend:** Lógica modularizada (`reservasService`, `transaccionesService`, `documentosService`, etc.).
✅ **Motor de Reservas Web (SSR):** Implementado con EJS y Express:
    * Identificación de empresa por dominio/subdominio (`tenantResolver`).
    * Páginas renderizadas en servidor (Home, Detalle Propiedad, Checkout, Confirmación).
    * Buscador de disponibilidad funcional.
    * Cálculo de precios en tiempo real en página de propiedad.
    * Flujo de reserva completo con creación de cliente/reserva.
    * Base para optimización SEO (metadatos dinámicos).
✅ **Integración Google Hotels (Fases 1-3 Completadas):**
    * Configuración de datos específicos (ID, dirección) por propiedad.
    * Generación del **Feed de Listado de Propiedades** (XML) vía `endpoint` público.
    * Generación del **Feed ARI** (XML) con disponibilidad y precios base en tiempo real vía `endpoint` público.
    * Implementación de **Deep Linking** en la página de propiedad para pre-rellenar formulario desde URL.

## 3. Arquitectura Técnica

### Backend (Node.js + Express)
Gestiona lógica de negocio, seguridad multi-inquilino y comunicación con la base de datos. Estructura modular:
- **`routes/`**: Endpoints API (`/api/*`), Integraciones (`/integrations/*`), iCal (`/ical/*`), Sitio Web SSR (`/`).
- **`services/`**: Lógica de negocio pura (modularizada por funcionalidad).
- **`middleware/`**: `authMiddleware` (protege API), `tenantResolver` (identifica empresa para SSR).
- **`views/`**: Plantillas EJS para el sitio web público SSR.

### Frontend (JavaScript Vainilla - SPA Modular)
Interfaz para el panel de administración.
- **`router.js`**: Gestiona URLs del panel (`/gestion-diaria`, `/clientes`, etc.) y carga vistas.
- **`views/`**: Módulos JS que actúan como orquestadores de cada sección del panel.
- **`views/components/`**: Componentes reutilizables específicos de cada vista del panel.
- **`public/`**: Archivos estáticos (CSS compilado, imágenes). Servidos bajo `/admin-assets`.

### Base de Datos (Cloud Firestore)
Arquitectura multi-empresa con aislamiento total:
`empresas/{empresaId}`
- `users/`
- `clientes/`
- `reservas/`
- `propiedades/` (ahora incluye `googleHotelData`)
- `historialCargas/`
- `canales/`
- `tarifas/`
- `tiposPlantilla/`
- `plantillasMensajes/`
- `campanas/`
- `interacciones/`
- `cupones/`
- `valoresDolar/`
- `(documento empresa)`: `nombre`, `websiteSettings` (incluye `domain`, `subdomain`), etc.

## 4. Hoja de Ruta - Etapa 4: Ecosistema de Venta Directa y Metabuscadores

Hemos completado las fases iniciales de esta etapa.

### Pilares del Ecosistema:
1.  **Motor de Reservas SSR (✅ Implementado)**
2.  **Integración con Metabuscadores**
3.  **Red de Marketing Directo**

### Fases de Implementación (Actualizado):

- **Fase 1: Motor SSR Multi-Inquilino
#### Fase 1.a: Configuración Web Pública por Alojamiento (Detalle)

Esta fase implementa la personalización detallada del contenido y las imágenes para cada propiedad dentro del sitio web público SSR.

1.  **Definir Componentes (Backend y Admin):**
    * **Firestore:** Añadir campo `componentes` (array de objetos `{ id: string, nombre: string, tipo: string }`) al modelo `propiedades`. El `id` será único dentro de la propiedad (ej. `nombre-normalizado-timestamp`).
    * **Frontend (Admin - `gestionarAlojamientos.js`):** Modificar el modal de edición de propiedades para permitir al usuario definir/añadir/eliminar estos componentes (ej. "Dormitorio Principal", "Baño en Suite", "Terraza con Parrilla").

2.  **Nueva Vista "Configurar Web Pública" (Frontend - Admin):**
    * **Crear:** Vista `configurarWebPublica.js` y añadir ruta `/configurar-web-publica` (bajo "Herramientas").
    * **UI:**
        * Selector de Alojamiento por `propiedadId`.
        * **Textos SEO (IA):** Mostrar descripción actual (lectura), botón "Generar Texto SEO con IA", `<textarea>` para texto generado (editable), botón "Guardar Texto".
        * **Imágenes por Componente:**
            * Al seleccionar alojamiento, listar sus `componentes` definidos.
            * Para cada `componente`:
                * Botón "Subir Imágenes" (`<input type="file" multiple>`).
                * Galería/lista de miniaturas de imágenes subidas para ese componente.
                * Mostrar `altText` y `title` (generados por IA, solo lectura) bajo cada miniatura.
                * Botón "Eliminar" en cada imagen (usa `imageId`).

3.  **Backend - API y Lógica:**
    * **Modelo Firestore:** En `propiedades/{propiedadId}/websiteData/images`, cada clave será un `componentId` y su valor será un **ARRAY** de objetos: `{ imageId: "uuid", storagePath: "...", altText: "...", title: "..." }`.
    * **Servicios:**
        * `storageService.js`: Funciones `uploadFile` (devuelve `storagePath`), `deleteFileByPath`.
        * `propiedadesService.js`: Adaptar CRUD para `componentes` y operaciones `FieldValue.arrayUnion`/`arrayRemove` en `websiteData.images[componentId]`.
        * `aiContentService.js` (Nuevo): Función `generarMetadataImagen(nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente)` que retorna `{ altText, title }`.
    * **Rutas API (`websiteConfigRoutes.js` - Nuevo):**
        * `GET /api/website-config/propiedad/:propiedadId`: Obtiene `websiteData`.
        * `PUT /api/website-config/propiedad/:propiedadId`: Guarda `aiDescription`.
        * `POST /api/website-config/propiedad/:propiedadId/upload-image/:componentId`:
            * Recibe múltiples archivos (`multer`).
            * **Para cada archivo:** genera `imageId`, optimiza (`sharp`), sube a Storage (`empresas/{empresaId}/propiedades/{propiedadId}/images/{componentId}/{imageId}.webp`), llama a `generarMetadataImagen`, **añade** objeto al array en Firestore.
            * Devuelve lista de objetos de imagen creados.
        * `DELETE /api/website-config/propiedad/:propiedadId/delete-image/:componentId/:imageId`: Busca por `imageId` en el array, obtiene `storagePath`, borra de Storage, **elimina** del array en Firestore.
        * `POST /api/website-config/propiedad/:propiedadId/generate-ai-text`: Llama a IA para generar `aiDescription`, devuelve el texto (sin guardar).
    * **Firebase Storage:** Configurar el bucket (o el directorio `empresas/`) como **público** para lectura simplificada de imágenes.

4.  **Actualización Sitio Público SSR (EJS):**
    * **Backend (`website.js`):** Pasar `propiedad.componentes` y `propiedad.websiteData.images` a `propiedad.ejs`.
    * **Plantillas EJS (`propiedad.ejs`, `home.ejs`, etc.):**
        * Iterar sobre `componentes` y `websiteData.images[componente.id]` para mostrar galerías o imágenes específicas.
        * Usar URLs públicas de Storage (construidas desde `storagePath`), `altText`, y `title` guardados en Firestore.
        * Implementar `<picture>` para WebP y `loading="lazy"`.

- **Fase 2: Feed ARI Google Hotels - Listado Propiedades** - ✅ **Completado**
- **Fase 3: Feed ARI Google Hotels - ARI Feed y Deep Linking** - ✅ **Completado**
- **Fase 4: Adaptar feeds para Trivago / TripAdvisor** - ⏳ **Próximo Paso**
- **Fase 5: Campañas Ads + tracking (GA4, Meta Pixel)** - ⏳ Pendiente
- **Fase 6: WhatsApp API / chatbot IA Concierge** - ⏳ Pendiente

---