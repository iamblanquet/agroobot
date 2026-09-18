function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${label} es obligatorio.`);
  return value.trim();
}

function number(value, label, minimum = 0) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') invalid(`${label} debe ser un número.`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum) invalid(`${label} debe ser mayor o igual a ${minimum}.`);
  return result;
}

function id(value, label = 'El identificador') {
  const result = number(value, label, 1);
  if (!Number.isSafeInteger(result)) invalid(`${label} debe ser un entero positivo.`);
  return result;
}

function predio(body, current = {}) {
  const merged = { superficie_legal_ha: 0, superficie_util_ha: 0, regimen: 'Propiedad Privada', ...current, ...body };
  const fields = {
    nombre: text(merged.nombre, 'El nombre del predio'),
    superficie_legal_ha: number(merged.superficie_legal_ha, 'La superficie legal'),
    superficie_util_ha: number(merged.superficie_util_ha, 'La superficie útil'),
    regimen: text(merged.regimen, 'El régimen')
  };
  if (fields.superficie_util_ha > fields.superficie_legal_ha) invalid('La superficie útil no puede superar la superficie legal.');
  if (body.tg_thread_id !== undefined) fields.tg_thread_id = body.tg_thread_id === '' || body.tg_thread_id === null ? null : String(id(body.tg_thread_id, 'El tema de Telegram'));
  if (body.poligono_geojson !== undefined) fields.poligono_geojson = body.poligono_geojson;
  return fields;
}

function obra(body, current = {}) {
  const merged = { fase_actual: 'Operación', estado: 'operacion', tg_thread_id: null, ...current, ...body };
  const fields = {
    nombre: text(merged.nombre, 'El nombre del frente'),
    proyecto_id: id(merged.proyecto_id, 'El proyecto'),
    fase_actual: text(merged.fase_actual, 'La fase'),
    estado: merged.estado
  };
  if (!['prospeccion', 'habilitacion', 'operacion', 'mantenimiento', 'standby', 'cerrada'].includes(fields.estado)) invalid('Estado del frente inválido.');
  return fields;
}

function predioIds(value) {
  if (!Array.isArray(value)) invalid('Los predios deben enviarse como una lista.');
  return [...new Set(value.map(value => id(value, 'El predio')))];
}

function machine(body, current = {}) {
  const merged = { tipo: 'tractor', modelo: '', propietaria_id: null, operadora_id: null, umbral_servicio_hrs: 300, horometro_actual: 0, ultimo_servicio_hr: 0, ...current, ...body };
  const fields = {
    codigo: text(merged.codigo, 'El código de la máquina').toUpperCase(),
    nombre: text(merged.nombre, 'El nombre de la máquina'),
    tipo: text(merged.tipo, 'El tipo'),
    modelo: typeof merged.modelo === 'string' ? merged.modelo.trim() : '',
    umbral_servicio_hrs: number(merged.umbral_servicio_hrs, 'El umbral de servicio', 10),
    horometro_actual: number(merged.horometro_actual, 'El horómetro actual'),
    ultimo_servicio_hr: number(merged.ultimo_servicio_hr, 'El último servicio')
  };
  for (const key of ['propietaria_id', 'operadora_id']) {
    fields[key] = merged[key] === '' || merged[key] == null ? null : id(merged[key], 'La entidad');
  }
  if (fields.ultimo_servicio_hr > fields.horometro_actual) invalid('El último servicio no puede superar el horómetro actual.');
  if (!['tractor', 'bulldozer', 'retroexcavadora', 'dron', 'sembradora', 'rastra'].includes(fields.tipo)) invalid('Tipo de maquinaria inválido.');
  fields.modelo ||= fields.nombre;
  fields.alerta_mantenimiento = fields.horometro_actual - fields.ultimo_servicio_hr >= fields.umbral_servicio_hrs - 20;
  return fields;
}

module.exports = { invalid, id, predio, obra, predioIds, machine };
