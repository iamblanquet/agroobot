# 🌾 AGROK · Sistema de Operación de Campo y Tablero de Control
## Documentación de Funciones Actuales (Patrón TESA)

> **Versión:** 2.0 (Rama `main`)  
> **Arquitectura:** **TESA** (*Telegram Entry • Standalone API • Offline Storage*)  
> **Base de Datos:** SQLite Relacional (15 tablas)  
> **Frontend:** React 18 + Vite + Tailwind CSS + PWA Service Worker  
> **Backend:** Node.js + Express + node-telegram-bot-api + node-cron  

---

## 📑 Tabla de Contenidos
1. [Arquitectura General](#1-arquitectura-general)
2. [Canal de Entrada: Bot de Telegram y Supergrupo](#2-canal-de-entrada-bot-de-telegram-y-supergrupo)
3. [Parser de Texto Libre y Confirmación Interactiva](#3-parser-de-texto-libre-y-confirmación-interactiva)
4. [Automatización y Alertas Programadas (Cron Jobs)](#4-automatización-y-alertas-programadas-cron-jobs)
5. [Mini App Web y Modos por Rol](#5-mini-app-web-y-modos-por-rol)
6. [Autenticación y Modo Sin Conexión (Offline-First)](#6-autenticación-y-modo-sin-conexión-offline-first)
7. [Catálogo Oficial de Datos de AGROK](#7-catálogo-oficial-de-datos-de-agrok)
8. [Matriz de Endpoints de la API Standalone](#8-matriz-de-endpoints-de-la-api-standalone)

---

## 1. Arquitectura General

El sistema implementa el **Patrón TESA**:
* **Telegram Entry:** Entrada de datos por mensajería en supergrupo con temas, comandos rápidos y notificaciones automáticas.
* **Standalone API:** Núcleo de servicios RESTful independientes y desacoplados con SQLite relacional y control de concurrencia.
* **Offline Storage:** Aplicación Web Progresiva (PWA) con almacenamiento local en IndexedDB y validación de PIN en memoria, garantizando operación completa en zonas sin señal de internet.

```mermaid
flowchart TD
    TG["Telegram Supergrupo<br/>#Reportes · #Incidencias · #Tablero"] <-->|"Bot API / Webhook"| BOT["Bot & Cron Service<br/>Parser + Scheduler"]
    BOT <--> API["Express Standalone API<br/>JWT + Middlewares"]
    PWA["Mini App Web (PWA)<br/>React 18 + IndexedDB"] <-->|"Sync Idempotente"| API
    API <--> DB[("Base de Datos SQLite<br/>15 tablas relacionales")]
```

---

## 2. Canal de Entrada: Bot de Telegram y Supergrupo

### 📌 Enrutamiento Automático por Temas (`message_thread_id`)
El bot canaliza automáticamente cada evento hacia su tema correspondiente dentro del Supergrupo:
* 📋 **Tema `#Reportes`:** Publicación de fichas estructuradas de nuevos reportes operativos y declaraciones de días sin actividad.
* ⚠️ **Tema `#Incidencias`:** Publicación de alertas con folios únicos (`F-14`, `F-21`, `INC-2026-XXX`). Quien responde (*reply*) a este mensaje añade notas automáticas a la bitácora de seguimiento.
* 📊 **Tema `#Tablero`:** Publicación del corte diario ejecutivo de las 21:30 hrs y alertas preventivas de maquinaria (300h).

### ⌨️ Comandos Disponibles en Telegram

| Comando | Nivel de Acceso | Descripción |
| :--- | :--- | :--- |
| `/start` o `/menu` | Todos | Menú principal de bienvenida con botones inline a la Mini App y teclado rápido. |
| `/id` o `/tema` | Administradores | Devuelve el `Chat ID` del grupo y el `message_thread_id` del tema actual para configurar `.env`. |
| `/sin_actividad [motivo]` | Campo | Registra un día de paro operativo (ej. por lluvia torrencial o falta de insumos). |
| `/cerrar [folio] [causa]`| Supervisión | Cierre formal de incidencia con validación estricta de causa raíz ($\ge 10$ caracteres). |
| `/avance` | Consulta | Muestra el resumen de hectáreas habilitadas vs meta por obra activa. |
| `/pendientes` o `/incidencias` | Consulta | Lista todas las incidencias abiertas con sus días de antigüedad. |
| `/maquina` o `/horometro` | Consulta | Muestra el listado de maquinaria, horómetros actuales y alertas de servicio de 300 hrs. |
| `/hoy` o `/tablero` | Consulta | Genera en tiempo real el corte del Tablero de Control del día. |

---

## 3. Parser de Texto Libre y Confirmación Interactiva

El bot procesa mensajes pegados en lenguaje natural con el formato histórico que las cuadrillas ya utilizan en campo:

### 📥 Ejemplo de Entrada:
```
*Obra:* Siembra clúster Mangos
*Fecha:* 20/08/2026

*Fuerza de trabajo :*
- Operador de tractor
- Técnico
- 2 auxiliares

*Operacion actual:*
- Carga de fertilizante de la bodega San Alberto hacia el predio.
- Siembra del predio
- Limpieza de discos del tractor

Se han sembrado un aproximado de 6.5 ha del predio cristina, 7 ha del predio rach y 8 ha del predio los mangos.
```

### ⚙️ Capacidades del Parser:
1. **Despiece Multi-predio Automático:** Separa las menciones de superficies y las asocia a sus respectivos predios (`Cristina: 6.5 ha`, `Rach: 7.0 ha`, `Los Mangos: 8.0 ha`), calculando la sumatoria total (`21.5 ha`).
2. **Cálculo de Fecha Operativa (Tolerancia $\pm 1$ día):** Si el reporte se redactó sin señal y llega pasada la medianoche, respeta la fecha escrita si se encuentra dentro de $\pm 1$ día respecto a la hora del mensaje.
3. **Clasificación de Cuadrilla y Roles:** Mapeo automático de roles (`operador_tractor`, `tecnico`, `auxiliar`, `operador_retro`, etc.) y headcount.
4. **Ficha de Confirmación Interactiva:**
   El bot responde con una tarjeta estructurada en estado **Borrador** con dos botones en línea:
   * **`[ ✅ Confirmar ]`**: Pasa el registro a `confirmado`, actualiza las hectáreas en el sistema y notifica al tema `#Reportes`.
   * **`[ ✏️ Corregir ]`**: Permite al operador enviar una corrección sin generar registros duplicados.

---

## 4. Automatización y Alertas Programadas (Cron Jobs)

El backend incorpora un motor de tareas programadas (`node-cron`) configurado en la zona horaria operativa (`America/Merida` / UTC-6):

* 🔴 **21:00 hrs — Reclamo de Obras Sin Reporte:**
  Evalúa todas las obras activas en estado de `operacion`. Si no registran reporte ni `/sin_actividad`, envía un aviso automático al tema de la obra reclamando el reporte de jornada.
* 📊 **21:30 hrs — Corte Oficial del Tablero:**
  Genera el corte diario consolidado (obras sin reporte, avance vs meta, incidencias abiertas, materiales con déficit y maquinaria en alerta) y lo publica y fija en el canal/tema `#Tablero`.
* 🌅 **08:00 hrs — Alertas Matutinas:**
  Notifica incidencias abiertas por más de 3 días o en verificación por 7 días en `#Incidencias`, y alerta si alguna máquina tiene $\ge 280$ hrs (a menos de 20 hrs del servicio obligatorio de 300 hrs).
* 🧪 **Disparador Manual de Pruebas:**
  Endpoint `POST /api/stats/cron-trigger` para probar cualquiera de los tres ciclos en cualquier momento.

---

## 5. Mini App Web y Modos por Rol

La interfaz web (PWA) adapta su navegación y funciones según el rol del usuario autenticado:

### 🚜 1. Vista de Campo (`campo_user` · PIN `1234`)
* Formulario táctil de reporte diario con selector de obra y predio.
* Registro de avance en hectáreas y actividad realizada.
* Desglose de cuadrilla (conteo por puesto).
* Lectura de horómetros de maquinaria (inicio, fin, horas y litros de diésel consumidos).
* Botón de emergencia **"🌧️ Declarar Día Sin Actividad"** en 1 solo toque.
* Cola de sincronización local (IndexedDB) con indicador visual de reportes pendientes de envío.

### 👷 2. Vista de Supervisor (`sup_user` · PIN `2345`)
* **4 Widgets Canónicos de Control:**
  1. *Obras sin reporte hoy* (con cálculo de días de atraso).
  2. *Avance contra meta* (porcentaje ejecutado vs programado).
  3. *Incidencias abiertas* (tipo, días y frente).
  4. *Bloqueado por material* (déficit de insumos y fecha ETA).
* Gestión de Estructura de Desglose de Trabajo (**WBS**): Proyectos, Hitos y Tareas.
* **Cierre Formal de Incidencias:** Modal con validación estricta de causa raíz ($\ge 10$ caracteres).
* Semáforo de mantenimiento preventivo de maquinaria (alerta 300h).

### 📊 3. Vista de Dirección (`dir_user` · PIN `3456`)
* Tablero de KPIs consolidados del ciclo agrícola.
* **Comparativa Dron vs Campo:** Hectáreas estimadas en campo vs hectáreas oficiales medidas por ortofoto de Dron, calculando la discrepancia neta.
* Consumo total de diésel acumulado y horas efectivas de maquinaria.
* Resumen ejecutivo de avance global contra la meta de 230 ha de Maíz.

### 🛡️ 4. Vista de Administrador IT (`admin_user` · PIN `9999`)
* Monitor de salud del servidor (`/api/health`), base de datos SQLite y memoria.
* Diagnóstico de conexión del Bot de Telegram y Webhooks.
* Control de usuarios, roles y asignación de códigos PIN.
* Disparadores manuales para simular los Cron Jobs de las 21:00, 21:30 y 08:00 hrs.

---

## 6. Autenticación y Modo Sin Conexión (Offline-First)

* **PIN Numérico de 4 Dígitos:** Teclado táctil optimizado para pantallas bajo el sol o uso con guantes. En cuanto se digitan los 4 números, valida en **0.2 segundos**.
* **Sesión Persistente:** El navegador recuerda al operador; al reabrir la app no vuelve a pedir el PIN salvo que se pulse *"Cerrar Sesión / Cambiar Operador"*.
* **100% Offline:** El catálogo de operadores y predios se almacena en `localStorage` / `IndexedDB`, permitiendo validar el PIN y guardar reportes sin señal de red.
* **Idempotencia Criptográfica:** Cada reporte genera un `client_uuid` único; el servidor descarta reenvíos duplicados automáticamente al recuperar la señal.

---

## 7. Catálogo Oficial de Datos de AGROK

### 🗺️ Predios Reales de Campeche (con GeoJSON):
1. **Guayeme:** 37.67 ha legales · Propiedad Privada · 12 vértices.
2. **San Alberto:** 11.04 ha legales · Propiedad Privada · 10 vértices.
3. **Los Mangos:** 12.47 ha legales · Tubería CAPAE y triángulo de 2 ha.
4. **Rach:** 1.83 ha legales.
5. **Cristina:** 5.51 ha legales.
6. **Santa Teresita:** 521.00 ha legales · 450.0 ha útiles mecanizables.
7. **San Luis:** 16.03 ha legales · 5 postes CFE.
8. **La Asunción:** 146.48 ha legales.
9. **San Pedro:** 180.41 ha legales · En trámite RPP.
10. **Parque Jabin:** 80.00 ha legales · Régimen Patrimonial.
11. **Potrero Yeguas:** 120.00 ha legales · Infraestructura Ganadera.

### 🏢 Obras de Operación:
* `Maíz Guayeme` (Tema `#Guayeme · Maíz`)
* `Desmonte Santa Teresita` (Tema `#Sta Teresita · Desmonte`)
* `Siembra clúster Mangos` (Tema `#Clúster Mangos · Siembra`)
* `Maíz San Alberto` (Tema `#San Alberto · Maíz`)
* `San Luis` (Standby por lluvia)
* `Reforestación Jabin` (Mantenimiento)
* `Cercado Potrero Yeguas` (Cercado y corrales)

### 🚜 Parque de Maquinaria:
* **Tractor CASE IH Puma 155 (Aspromex):** `TRACTOR-PUMA-01` · Horómetro: 288.5 hrs ➔ **🚨 Alerta Preventiva 300H**.
* **Bulldozer Caterpillar D6:** `BULLDOZER-CAT-D6` · Horómetro: 1,420.0 hrs.
* **Retroexcavadora New Holland (Alfredo):** `RETRO-NEW-HOLLAND` · Horómetro: 286.5 hrs ➔ **🚨 Alerta Preventiva 300H**.
* **Dron DJI Agras T70P (Abner):** `DRON-AGRAS-T70P` · Horómetro: 45.0 hrs.
* **Sembradora Case PRO 6 Hileras:** `SEMBRADORA-CASE-PRO6` · Horómetro: 62.0 hrs.

---

## 8. Matriz de Endpoints de la API Standalone

| Método | Ruta | Rol Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | Público | Estado de salud del backend y base de datos. |
| `POST` | `/api/auth/pin-login` | Público | Autenticación rápida por PIN de 4 dígitos. |
| `POST` | `/api/auth/login` | Público | Autenticación tradicional por usuario y password. |
| `GET` | `/api/auth/operators` | Público | Catálogo de operadores para caché offline. |
| `POST` | `/api/reports/sync` | Autenticado | Sincronización masiva e idempotente de reportes. |
| `GET` | `/api/reports` | Autenticado | Consulta de bitácora de reportes con filtros. |
| `GET` | `/api/stats/supervisor` | Supervisor / IT | Retorna los 4 widgets canónicos y estado de maquinaria. |
| `GET` | `/api/stats/direction` | Dirección / IT | Retorna KPIs ejecutivos y comparativa Dron vs Campo. |
| `POST` | `/api/stats/cron-trigger`| Supervisor / IT | Disparo manual de pruebas para alertas de las 21:00, 21:30 y 08:00 hrs. |
| `GET` | `/api/issues` | Autenticado | Listado de incidencias activas con cálculo de días. |
| `POST` | `/api/issues` | Autenticado | Registro de nueva incidencia con folio automático. |
| `POST` | `/api/issues/:id/close` | Supervisor / IT | Cierre con validación estricta de causa raíz ($\ge 10$ chars). |
| `GET` | `/api/machines` | Autenticado | Catálogo de maquinaria y estado de servicio preventivo. |
| `GET` | `/api/materials` | Autenticado | Listado de insumos con cálculo de déficit y alertas ETA. |
| `GET` | `/api/projects` | Autenticado | Árbol WBS de Proyectos, Hitos, Tareas y Predios. |

---

*Documento generado y validado automáticamente contra el código base en producción.*
