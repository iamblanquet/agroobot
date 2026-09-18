# Grupos por predio

El destino de Telegram es `predio.tg_thread_id`: un tema dentro del supergrupo
configurado. Los proyectos y frentes ya no crean temas ni deciden el destino por
nombre. Un predio admite varios proyectos mediante `proyecto_predio`; un proyecto
puede asignarse a varios predios. Los frentes solo pueden usar predios asignados
a su proyecto.

En Supervisión:

1. Registrar el predio y crear o vincular su grupo de Telegram.
2. Crear o editar el proyecto y seleccionar sus predios.
3. Crear sus frentes seleccionando uno o más predios de ese proyecto.

En Campo se elige predio, proyecto y frente. Cada reporte corresponde a un predio
y se envía exclusivamente a su tema; el texto incluye predio, proyecto y frente.
Esto también aplica a días sin actividad y reportes capturados sin conexión.
Los clientes anteriores pueden omitir `predio_id` únicamente si las líneas o el
frente identifican un solo predio. Se rechazan reportes sin frente o con destinos
ambiguos. En Telegram, escribir `Frente: #ID` en una línea; si hay un solo frente
en el predio se puede inferir, pero nunca se toma el primer frente de otro lugar.

## Despliegue

En Supabase ejecutar, en este orden:

1. `20260918_catalogs.sql`, si aún no se aplicó.
2. `20260918_predio_groups.sql`.
3. Desplegar backend y frontend juntos y actualizar el catálogo en dispositivos
   que tenían datos guardados sin conexión.

SQLite migra automáticamente al iniciar. La migración crea las asignaciones a
partir de los frentes existentes. Copia el tema antiguo al predio solo si existe
un único destino y no se comparte con otro predio. Si había varios temas para el
mismo predio, o un tema compartido entre predios, se debe elegir o crear el grupo
desde Editar Predio. No se borran ni renombran temas de Telegram ni frentes. Los
reportes históricos reciben `predio_id` únicamente cuando puede deducirse sin
ambigüedad. Se conserva `obra.tg_thread_id` como dato histórico.

Los grupos pendientes de creación se reintentan desde Catálogos. Las notificaciones
no se desvían al tema general cuando falta el grupo del predio. No se implementa
una cola persistente para reenviar automáticamente notificaciones fallidas.

Pruebas: `npm run test:catalogs`, `node server/test_report_crew.js`,
`node server/test_telegram_crew.js` y `npm --prefix client run build`.
Las pruebas usan SQLite en memoria y Telegram/Supabase simulados; no envían
mensajes reales ni ejecutan SQL en la base productiva.
