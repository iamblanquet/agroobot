### Plan Maestro de Implementación y Especificación Técnica: Sistema AGROK

#### 1\. Visión Estratégica y Arquitectura del Ecosistema

##### 1.1. Contexto y Propósito del Sistema

El sistema AGROK se define como el puente estratégico obligatorio entre la operación táctica de campo y la inteligencia de datos institucional. Su misión es la transformación de la narrativa operativa en activos de información estructurada para la toma de decisiones financieras. La selección de Telegram como interfaz de entrada no representa una simplificación, sino una decisión de diseño de ingeniería para garantizar la captura de datos en condiciones de conectividad crítica (2G/intermitente), priorizando la adopción del usuario sin sacrificar la integridad del dato posterior.

##### 1.2. El Ecosistema de Entrada (Telegram)

La captura se centralizará en el Supergrupo  **"AGROK · Operación"** , configurado en "Modo Foro" para organizar la información mediante temas específicos:

* **Temas por Obra Activa:**  (\#Guayeme · Maíz, \#Sta Teresita · Desmonte, \#Clúster Mangos · Siembra, \#San Alberto · Maíz). El bot deduce automáticamente el obra\_id mediante el message\_thread\_id.  
* **Tema \#Maquinaria:**  Registro exclusivo de horómetros, consumo de diesel y alertas de servicio.  
* **Tema \#Incidencias:**  Canal de notificación de folios y gestión de resolución de eventos críticos.  
* **Tema \#Compras:**  Seguimiento de requerimientos, materiales y estatus de pedidos.  
* **Tema \#General:**  Espacio para coordinación no estructurada sin comandos del bot.  
* **Canal "AGROK · Tablero":**  Repositorio de solo lectura donde el bot edita y fija el pulso operativo consolidado.

##### 1.3. Lógica de Procesamiento y Automatización

El bot parser es el garante de la integridad del ecosistema. El sistema ejecutará un sellado automático de metadatos de cumplimiento obligatorio: autor\_id (mapeado desde el ID de Telegram), obra\_id (derivado del hilo) y la marca de tiempo recibido\_en. La fecha\_operativa no quedará al arbitrio del usuario; el sistema la derivará automáticamente siguiendo una lógica fija, solicitando validación humana solo en casos de ambigüedad horaria.

##### 1.4. Continuidad en Condiciones de Baja Conectividad

El sistema operará bajo el protocolo "Sin Señal", aprovechando la cola de envío nativa de Telegram. El procesamiento distinguirá entre el momento de escritura y el de recepción. Para reportes recibidos en la ventana de 00:00 a 06:00 horas, el bot activará un flujo interactivo de validación de fecha.  **Es imperativo notar que la ventana de 30 minutos para la autoconfirmación de reportes iniciará a partir de la hora de recepción en el servidor, no de la creación del mensaje.**Esta arquitectura de captura ligera es el front-end necesario para alimentar la rigurosa estructura de datos que se detalla a continuación.

#### 2\. Gobernanza de Datos: Reglas e Integración

##### 2.1. Fundamentos de Integridad

La normalización de datos es el pilar de la escalabilidad de AGROK. El sistema mandata la transición de "prosa libre" a "datos tabulares" para habilitar el cálculo de costos por hectárea y la integración futura con modelos financieros avanzados.

##### 2.2. Las 5 Reglas Innegociables del Modelo

1. **Identificadores Estables:**  Los IDs de Proyecto, Obra y Predio son permanentes; queda prohibido su reciclaje o renombramiento.  
2. **Derivación de Metadatos:**  Los campos de autor, obra y sello de tiempo son sellados por el bot; el sistema no aceptará estos datos mediante entrada manual.  
3. **Ubicación del Cultivo:**  El tipo de cultivo reside exclusivamente en la entidad "Proyecto". Ningún reporte individual debe especificar el cultivo.  
4. **Normalización a Hectáreas:**  Todo avance se almacenará en su unidad original pero el sistema deberá normalizarlo automáticamente a hectáreas para su visualización.  
5. **Bloqueo de Cierre:**  Es técnicamente imposible transicionar una incidencia al estado "Cerrada" sin documentar la causa raíz.

##### 2.3. Entidades Principales y Relaciones

El modelo de datos se rige por la siguiente jerarquía y relaciones (ERD):

* **Proyecto:**  Define el ciclo (ej. Maíz 2026), el tipo de cultivo y la superficie meta.  
* **Obra:**  Unidad de ejecución vinculada a un hilo de Telegram. Mantiene una relación de muchos-a-muchos con predios (obra\_predio).  
* **Predio:**  Unidad geográfica con polígono definido (UTM 15N/WGS84).  
* **Reporte:**  Documento maestro que sella la jornada operativa.  
* **Línea de Reporte:**  Detalle de actividad (actividad\_id) y avance.  
* **Cuadrilla:**  Registro de roles y headcount.  
* **Incidencia:**  Entidad transversal vinculada a Obras, Maquinaria o Activos, con flujo de estados obligatorio.  
* **Maquinaria:**  Catálogo de activos móviles (Puma, Retro, Dron) con registros de horómetros vinculados.

##### 2.4. Estrategia de Interoperabilidad con Odoo

La autoridad de catálogos reside en la tabla local  **"Entidad"**  (7 filas semilla: ITZ, McClick, Aspromex, Balam, Aquario Transportes, AQR Services, Agrokool). La dependencia con Odoo (itz\_erp1) es referencial y no bloqueante para la autonomía del sistema.| Campo AGROK | Modelo Odoo Referenciado | Nivel de Dependencia || \------ | \------ | \------ || entidad.odoo\_company\_id | res.company | Referencial (Opcional) || predio.odoo\_partner\_id | res.partner | Referencial (Opcional) || maquina.odoo\_fleet\_id | fleet.vehicle | Referencial (Opcional) || material.odoo\_po\_id | purchase.order | Referencial (Opcional) || usuario.odoo\_user\_id | res.users | Referencial (Opcional) |  
La solidez de esta estructura garantiza que el flujo operativo diario, descrito a continuación, alimente un motor de datos confiable.

#### 3\. Protocolos Operativos de Captura y Reporte

##### 3.1. Estandarización del Reporte Diario

El sistema implementará un motor de procesamiento de lenguaje natural simplificado (parser) para extraer datos de los mensajes enviados por las cuadrillas, eliminando la necesidad de formularios rígidos.

##### 3.2. Anatomía del Parser de Reportes

El parser operará bajo los siguientes parámetros técnicos:

* **Cuadrilla:**  Regex para detectar headcount (^-•\*?\\s\*(\\d+)?\\s\*(.+?)$). Si no hay número al inicio/fin, se asume 1\.  
* **Actividades:**  Mapeo mediante diccionario de alias: (rastre \-\> rastreo, siembr/sembr \-\> siembra, fumig \-\> fumigacion, despalm \-\> despalme).  
* **Avance:**  Detección de cifras vinculadas a unidades (ha, m2) y match con predios registrados en la obra.

##### 3.3. Diccionario de Comandos y Flujos de Confirmación

Se habilitarán  **Formas Cortas**  para operación con baja señal:

* **/reporte:**  Captura del bloque de actividades.  
* **/sin\_actividad motivo:**  (Ej: /sin\_actividad lluvia).  
* **/incidencia tipo descripción:**  (Ej: /incidencia falla\_mecanica Motor sobrecalentado).  
* **/horometro maquina inicio fin litros:**  (Ej: /horometro Puma 1280.5 1288.2 60).**Confirmación:**  El bot emitirá un resumen. El usuario tiene 30 minutos para confirmar.  **Tras este lapso, el sistema ejecutará una autoconfirmación automática (marca 'auto').**

##### 3.4. Sistema de Alertas y Notificaciones

* **21:00:**  Alerta en el tema de obra si no hay reporte o /sin\_actividad.  
* **21:30:**  Publicación del pulso operativo en "AGROK · Tablero".  
* **08:00:**  Reporte de incidencias en "Verificación" por más de 7 días y alerta de activos fijos (Veleta, Bomba) sin lectura por más de 30 días.La gestión de activos críticos y eventos imprevistos se integra directamente en este flujo de comunicación.

#### 4\. Gestión de Incidencias y Mantenimiento de Maquinaria

##### 4.1. Ciclo de Vida de Activos

La disponibilidad de maquinaria es crítica para la rentabilidad. AGROK automatiza el seguimiento preventivo basado en el uso real reportado en campo.

##### 4.2. Protocolo de Incidencias

El flujo es mandatorio:  **Abierta \-\> Diagnóstico \-\> Reparación \-\> Verificación \-\> Cerrada** . No se permitirá el cierre de folios sin el campo causa\_raiz documentado.

##### 4.3. Control de Maquinaria y Horómetros

El sistema monitoreará la flota crítica:  **Puma CASE IH, Retroexcavadora New Holland y Dron DJI Agras T70P** . Para el Puma, el sistema aplicará un umbral de servicio de 300h, disparando alertas preventivas en el tema \#Maquinaria al restar 20h para el mantenimiento.

##### 4.4. Monitoreo de Activos Fijos

Se establece un seguimiento para:  **Veleta (Parque Jabin), Bomba (San Alberto), Cisterna y Cabaña/Bodega** . El bot generará alertas de supervisión si estos activos superan los 30 días sin una lectura de estado.La operatividad de estos activos está sujeta a los plazos de despliegue definidos en el Plan Maestro.

#### 5\. Plan Maestro de Implementación (Fases F0 a F3)

##### 5.1. Estrategia de Despliegue Gradual

Se ejecutará un despliegue por fases para asegurar la limpieza de catálogos antes de la automatización total, mitigando el riesgo de "basura entra, basura sale".

##### 5.2. Fase 0 · Consolidación del Catálogo (Semanas 1-2)

* **Karen:**  Marcar cobertura de señal por predio; definir ubicación de envío de reportes; resolver ambigüedades de predios (Santa Teresita/Magdalena).  
* **Luis:**  Recalcular avance histórico de Santa Teresita corrigiendo etiquetas erróneas de "San Alberto".  
* **Julio:**  Configuración de Supergrupo, Canal y Bot; carga de semillas de usuarios y catálogos.

##### 5.3. Fase 1 · Desarrollo del Núcleo y Piloto (Semanas 3-6)

Desarrollo del parser y comandos básicos.  **Piloto oficial: Obra Guayeme.**

* **Criterio de Éxito:**  10 días hábiles continuos de reporte sin fallos técnicos y menos del 10% de líneas clasificadas como "otro".

##### 5.4. Fase 2 · Extensión de Capacidades (Semanas 7-10)

Comandos extendidos y migración del  **Clúster Mangos**  (prueba de múltiples predios por reporte). Lanzamiento del Panel de Escritorio v1 con widgets de: Obras sin reporte, Avance contra meta, Incidencias abiertas y Material bloqueante.

##### 5.5. Fase 3 · Optimización Avanzada

Integración con Fleet Odoo, carga de polígonos finales mediante  **DJI Agras T70P**  y despliegue de la Mini App de Telegram.Se requiere la resolución inmediata de los siguientes bloqueos para iniciar la Fase 0\.

#### 6\. Matriz de Decisiones Críticas y Definiciones Pendientes

##### 6.1. Gobernanza y Bloqueos

La Dirección debe oficializar las siguientes definiciones. Cualquier demora impactará directamente en el cronograma de la Fase 0\.  
