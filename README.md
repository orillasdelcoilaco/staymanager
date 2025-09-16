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