/**
 * Parser de Reportes de Campo AGROK (docs/2 — Telegram.md §2)
 * Soporta formato de bloques pegados, viñetas multi-predio y formato en una línea con pipes (|).
 */

const { getOperationalDate } = require('../utils/operationalDate');

const ROLE_KEYWORDS = [
  { key: 'operador_tractor', regex: /tractor(?:ista)?|operador\s*de\s*tractor/i },
  { key: 'operador_retro', regex: /retro(?:excavadora)?|operador\s*de\s*retro/i },
  { key: 'operador_bulldozer', regex: /bulldozer|d6|operador\s*de\s*d6/i },
  { key: 'lider_posteo', regex: /posteo|l[ií]der\s*de\s*posteo/i },
  { key: 'tecnico', regex: /t[eé]cnico|ing(?:eniero)?|agronomo/i },
  { key: 'auxiliar', regex: /auxiliar(?:es)?|peon(?:es)?|jornalero(?:s)?|general(?:es)?/i },
  { key: 'encargada', regex: /encargad[ao]|supervisor[a]?/i }
];

const ACTIVITY_KEYWORDS = [
  { key: 'siembra', regex: /siembr|sembr/i },
  { key: 'rastreo', regex: /rastr/i },
  { key: 'despalme', regex: /despalm/i },
  { key: 'desmonte', regex: /desmont/i },
  { key: 'desenraizado', regex: /desenraiz|destronq/i },
  { key: 'subsoleo', regex: /subsol/i },
  { key: 'fumigacion', regex: /fumig|plaguicid|insecticid/i },
  { key: 'fertilizacion', regex: /fertiliz|abono|carga\s*de\s*fertilizante/i },
  { key: 'cercado', regex: /cerc|post|vareng/i },
  { key: 'acarreo', regex: /acarr|traslado|flete/i },
  { key: 'mantenimiento_maquinaria', regex: /limpieza\s*de\s*disco|mantenimiento|reparac|engras/i },
  { key: 'monitoreo', regex: /monitoreo|revision|muestreo/i }
];

const KNOWN_PREDIOS = [
  'Guayeme', 'San Alberto', 'Los Mangos', 'Mangos', 'Rach', 'Cristina',
  'Santa Teresita', 'Teresita', 'San Luis', 'La Asunción', 'Asunción',
  'San Pedro', 'Parque Jabin', 'Jabin', 'Potrero Yeguas', 'Potrero'
];

/**
 * Parsea el texto del reporte de campo
 * @param {string} text - Texto del mensaje
 * @param {Date} [messageDate] - Fecha del mensaje en Telegram
 */
function parseFreeTextReport(text, messageDate = new Date()) {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Texto vacío o inválido.' };
  }

  const raw = text.trim();

  // 1. Detectar Día Sin Actividad / Paro por Lluvia
  const sinActividadRegex = /(?:sin\s*actividad|paro|suspensi[oó]n|lluvia)\s*[:=-]?\s*(.*)/i;
  const isSinActCmd = raw.toLowerCase().startsWith('/sin_actividad');
  const sinActMatch = raw.match(sinActividadRegex);

  if (isSinActCmd || (sinActMatch && (raw.length < 80 || raw.toLowerCase().startsWith('sin actividad')))) {
    let motivo = isSinActCmd ? raw.replace(/^\/sin_actividad\s*/i, '').trim() : (sinActMatch[1] || 'Lluvia / Paro operativo').trim();
    if (!motivo) motivo = 'Lluvia / Paro operativo declarado por el operador';
    return {
      isValid: true,
      es_sin_actividad: true,
      motivo_sin_actividad: motivo,
      raw_text: raw
    };
  }

  // 2. Extraer Fecha escrita y calcular fecha operativa (Regla ±1 día)
  let fechaOperativa = getOperationalDate(messageDate);
  const fechaRegex = /(?:fecha|hora)\s*[:=-]\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i;
  const fechaMatch = raw.match(fechaRegex);
  if (fechaMatch) {
    const day = parseInt(fechaMatch[1], 10);
    const month = parseInt(fechaMatch[2], 10) - 1;
    let year = parseInt(fechaMatch[3], 10);
    if (year < 100) year += 2000;
    const parsedDate = new Date(year, month, day);
    if (!isNaN(parsedDate.getTime())) {
      const diffDays = Math.abs((parsedDate - messageDate) / (1000 * 60 * 60 * 24));
      // Si la fecha escrita está a ±1 día de la hora del mensaje, usar la escrita
      if (diffDays <= 1.5) {
        fechaOperativa = getOperationalDate(parsedDate);
      }
    }
  }

  // 3. Extraer Obra / Frente
  let obraNombre = null;
  const obraRegex = /(?:obra|frente|sitio|lote)\s*[:=-]\s*([^\n\r|]+)/i;
  const obraMatch = raw.match(obraRegex);
  if (obraMatch) {
    obraNombre = obraMatch[1].replace(/\*|_/g, '').trim();
  }

  // 4. Extraer Cuadrilla (roles y conteo)
  const cuadrilla = [];
  const cuadrillaSectionRegex = /(?:\*?(?:fuerza\s*de\s*trabajo|cuadrilla|personal)\s*\*?)\s*[:=-]?([\s\S]*?)(?=\*?(?:operaci[oó]n|actividad|avance|nota|maquinaria|hor[oó]metro|$)\*?)/i;
  const cuadSecMatch = raw.match(cuadrillaSectionRegex);

  if (cuadSecMatch && cuadSecMatch[1]) {
    const lines = cuadSecMatch[1].split(/[\n\r]+/);
    for (const l of lines) {
      const trimmed = l.replace(/^[-•*]\s*/, '').trim();
      if (!trimmed) continue;

      // Buscar número de personas: "2 auxiliares", "Operador de tractor", "1 técnico", "auxiliares x 3"
      const numMatch = trimmed.match(/^(\d+)\s*(.+)$/) || trimmed.match(/^(.+?)\s*[x×]\s*(\d+)$/);
      let count = 1;
      let roleText = trimmed;

      if (numMatch) {
        if (/^\d+$/.test(numMatch[1])) {
          count = parseInt(numMatch[1], 10);
          roleText = numMatch[2].trim();
        } else {
          roleText = numMatch[1].trim();
          count = parseInt(numMatch[2], 10);
        }
      }

      // Clasificar rol
      let matchedRol = 'auxiliar';
      for (const rk of ROLE_KEYWORDS) {
        if (rk.regex.test(roleText)) {
          matchedRol = rk.key;
          break;
        }
      }

      cuadrilla.push({ rol_id: matchedRol, headcount: count, role_text: roleText });
    }
  }

  // Fallback para cuadrilla en formato una línea "Cuadrilla: 4 op"
  if (cuadrilla.length === 0) {
    const inlineCuad = raw.match(/(?:cuadrilla|personal|gente)\s*[:=-]\s*(\d+)\s*(?:op|personas|aux)?/i);
    if (inlineCuad) {
      cuadrilla.push({ rol_id: 'operador_tractor', headcount: parseInt(inlineCuad[1], 10), role_text: 'Operadores' });
    }
  }

  // 5. Extraer Actividades
  const actividades = [];
  const actSectionRegex = /(?:\*?(?:operaci[oó]n\s*actual|actividades|labor)\s*\*?)\s*[:=-]?([\s\S]*?)(?=\*?(?:avance|fuerza|cuadrilla|nota|se\s*han\s*sembrado|maquinaria|$)\*?)/i;
  const actSecMatch = raw.match(actSectionRegex);

  if (actSecMatch && actSecMatch[1]) {
    const lines = actSecMatch[1].split(/[\n\r]+/);
    for (const l of lines) {
      const trimmed = l.replace(/^[-•*]\s*/, '').trim();
      if (!trimmed) continue;

      let matchedAct = 'otro';
      for (const ak of ACTIVITY_KEYWORDS) {
        if (ak.regex.test(trimmed)) {
          matchedAct = ak.key;
          break;
        }
      }
      actividades.push({ actividad_id: matchedAct, texto: trimmed });
    }
  }

  // Actividad general por defecto si no se listaron viñetas
  const primaryActividad = actividades.length > 0 ? actividades[0].actividad_id : 'siembra';

  // 6. Extraer Avances Multi-Predio
  // Ejemplos soportados:
  // "Se han sembrado un aproximado de 6.5 ha del predio cristina, 7 ha del predio rach y 8 ha del predio los mangos"
  // "Avance: Cristina 5.5 ha, Rach 1.8 ha, Los Mangos 10.47 ha"
  // "Avance: 8.5 ha en Guayeme"
  const lineasAvance = [];
  const avanceMentionRegex = /(\d+[.,]?\d*)\s*(ha|hect[aá]reas?|has|m2|m²|ml|%)\s*(?:del?\s*(?:predio|lote)?)?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)(?=[,.;\n\r]|\sy\s|\s*$)/gi;
  
  let match;
  while ((match = avanceMentionRegex.exec(raw)) !== null) {
    const rawVal = match[1].replace(',', '.');
    const unidad = match[2].toLowerCase().startsWith('ha') ? 'ha' : match[2].toLowerCase();
    const candidatePredio = match[3].trim();
    const num = parseFloat(rawVal);

    // Buscar predio conocido en el fragmento capturado
    let matchedPredio = null;
    for (const kp of KNOWN_PREDIOS) {
      if (new RegExp(`\\b${kp}\\b`, 'i').test(candidatePredio)) {
        matchedPredio = kp === 'Mangos' ? 'Los Mangos' : kp === 'Teresita' ? 'Santa Teresita' : kp === 'Asunción' ? 'La Asunción' : kp === 'Jabin' ? 'Parque Jabin' : kp === 'Potrero' ? 'Potrero Yeguas' : kp;
        break;
      }
    }

    if (num > 0) {
      lineasAvance.push({
        predio_nombre: matchedPredio,
        cantidad: num,
        unidad: unidad,
        cantidad_ha: unidad === 'ha' ? num : unidad === 'm2' ? num / 10000 : null,
        actividad_id: primaryActividad
      });
    }
  }

  // Fallback para avance simple: "Avance: 8.5 ha"
  if (lineasAvance.length === 0) {
    const simpleAvance = raw.match(/(?:avance|superficie|ha)\s*[:=-]\s*([\d.,]+)\s*(ha|hect[aá]reas?)?/i);
    if (simpleAvance) {
      const num = parseFloat(simpleAvance[1].replace(',', '.'));
      if (num > 0) {
        lineasAvance.push({
          predio_nombre: null,
          cantidad: num,
          unidad: 'ha',
          cantidad_ha: num,
          actividad_id: primaryActividad
        });
      }
    }
  }

  // 7. Extraer Maquinaria / Horómetro
  const maqRegex = /(?:maquinaria|m[aá]quina|maq|hor[oó]metro|diesel)\s*[:=-]?\s*([A-Za-z0-9_-]+)?(?:\s+([\d.,]+)\s+([\d.,]+))?(?:\s+([\d.,]+)\s*(?:l|litros)?)?/i;
  const maqMatch = raw.match(maqRegex);
  let maquinariaData = null;

  if (maqMatch && (maqMatch[1] || maqMatch[2])) {
    const codigo = maqMatch[1] || 'PUMA';
    const inicio = maqMatch[2] ? parseFloat(maqMatch[2].replace(',', '.')) : null;
    const fin = maqMatch[3] ? parseFloat(maqMatch[3].replace(',', '.')) : null;
    const litros = maqMatch[4] ? parseFloat(maqMatch[4].replace(',', '.')) : 0;

    maquinariaData = {
      codigo,
      horometro_inicio: inicio,
      horometro_fin: fin,
      horas_trabajadas: (inicio !== null && fin !== null) ? Math.max(0, fin - inicio) : 0,
      litros_diesel: litros
    };
  }

  // 8. Extraer Nota
  let nota = null;
  const notaMatch = raw.match(/(?:nota|observaci[oó]n|comentario)\s*[:=-]\s*([^\n\r]+)/i);
  if (notaMatch) {
    nota = notaMatch[1].trim();
  }

  // Validación: Debe tener al menos líneas de avance, obra, o cuadrilla
  if (lineasAvance.length === 0 && !obraNombre && cuadrilla.length === 0 && !maquinariaData) {
    return {
      isValid: false,
      error: 'No se reconocieron datos suficientes en el reporte. Incluye al menos la Obra, Avance en ha o Cuadrilla.'
    };
  }

  const totalAvanceHa = lineasAvance.reduce((acc, l) => acc + (l.cantidad_ha || 0), 0);

  return {
    isValid: true,
    es_sin_actividad: false,
    fecha_operativa: fechaOperativa,
    obra_nombre: obraNombre,
    avance_ha: totalAvanceHa,
    lineas: lineasAvance,
    cuadrilla: cuadrilla.length > 0 ? cuadrilla : [{ rol_id: 'operador_tractor', headcount: 1 }],
    actividades,
    maquinaria: maquinariaData,
    nota,
    raw_text: raw
  };
}

module.exports = {
  parseFreeTextReport,
  ROLE_KEYWORDS,
  ACTIVITY_KEYWORDS,
  KNOWN_PREDIOS
};
