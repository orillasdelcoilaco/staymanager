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