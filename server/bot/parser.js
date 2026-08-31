/**
 * Parser de Texto Libre mediante Expresiones Regulares para Reportes de Campo
 * Interpreta formatos de lenguaje natural enviados por WhatsApp/Telegram
 * Ejemplos:
 * "Obra: Norte | Cuadrilla: 4 op | Avance: 8.5 ha | Actividad: Subsoleo"
 * "Frente: Costa | Maquina: CAT-D6T-01 285.0 293.0 140L | Avance: 6 ha"
 * "Sin actividad: Lluvia torrencial en la zona"
 */

function parseFreeTextReport(text) {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Texto vacío o inválido.' };
  }

  const raw = text.trim();

  // 1. Detectar reporte de "Sin actividad"
  const sinActividadRegex = /(?:sin\s*actividad|inactivo|paro|suspensi[oó]n|lluvia)\s*[:=-]?\s*(.+)/i;
  const sinActMatch = raw.match(sinActividadRegex);

  if (sinActMatch || raw.toLowerCase().startsWith('/sin_actividad')) {
    const motivo = sinActMatch ? sinActMatch[1].trim() : raw.replace(/^\/sin_actividad\s*/i, '').trim();
    return {
      isValid: true,
      es_sin_actividad: true,
      motivo_sin_actividad: motivo || 'Jornada sin actividad operativa reportada',
      raw_text: raw
    };
  }

  // 2. Extraer Obra / Frente
  const obraRegex = /(?:obra|frente|sitio|lote)\s*[:=-]\s*([^|\n,;]+)/i;
  const obraMatch = raw.match(obraRegex);
  const obraNombre = obraMatch ? obraMatch[1].trim() : null;

  // 3. Extraer Avance en Hectáreas / Cantidad
  const avanceRegex = /(?:avance|superficie|ha|hect[aá]reas?)\s*[:=-]\s*([\d.,]+)\s*(?:ha|hect[aá]reas?)?/i;
  const avanceMatch = raw.match(avanceRegex);
  const avanceHa = avanceMatch ? parseFloat(avanceMatch[1].replace(',', '.')) : null;

  // 4. Extraer Actividad
  const actividadRegex = /(?:actividad|labor|tarea)\s*[:=-]\s*([^|\n,;]+)/i;
  const actMatch = raw.match(actividadRegex);
  const actividad = actMatch ? actMatch[1].trim() : 'Labor General de Campo';

  // 5. Extraer Cuadrilla / Personal
  const cuadrillaRegex = /(?:cuadrilla|personal|gente|operadores?|trabajadores?)\s*[:=-]\s*(\d+)\s*(?:op|personas|aux|tec)?/i;
  const cuadMatch = raw.match(cuadrillaRegex);
  const cuadrillaCount = cuadMatch ? parseInt(cuadMatch[1], 10) : 1;

  // 6. Extraer Horómetro / Maquinaria
  // Ejemplo: "Maquina: CAT-D6T-01 285 292 120L" o "Horometro: CAT-D6T-01 285 292"
  const maqRegex = /(?:maq|m[aá]quina|hor[oó]metro)\s*[:=-]\s*([A-Za-z0-9_-]+)(?:\s+([\d.,]+)\s+([\d.,]+))?(?:\s+([\d.,]+)\s*(?:l|litros)?)?/i;
  const maqMatch = raw.match(maqRegex);

  let maquinaData = null;
  if (maqMatch) {
    const codigo = maqMatch[1];
    const inicio = maqMatch[2] ? parseFloat(maqMatch[2].replace(',', '.')) : null;
    const fin = maqMatch[3] ? parseFloat(maqMatch[3].replace(',', '.')) : null;
    const litros = maqMatch[4] ? parseFloat(maqMatch[4].replace(',', '.')) : 0;

    maquinaData = {
      codigo,
      horometro_inicio: inicio,
      horometro_fin: fin,
      horas_trabajadas: (inicio !== null && fin !== null) ? Math.max(0, fin - inicio) : 0,
      litros_diesel: litros
    };
  }

  // Validación mínima: al menos debe tener obra o avance o maquinaria
  if (!obraNombre && avanceHa === null && !maquinaData) {
    return {
      isValid: false,
      error: 'No se pudieron identificar campos clave (Obra, Avance o Maquinaria). Use el formato: "Obra: Norte | Avance: 8.5 ha | Cuadrilla: 4 op"'
    };
  }

  return {
    isValid: true,
    es_sin_actividad: false,
    obra_nombre: obraNombre,
    avance_ha: avanceHa || 0,
    actividad,
    cuadrilla_count: cuadrillaCount,
    maquinaria: maquinaData,
    raw_text: raw
  };
}

module.exports = {
  parseFreeTextReport
};
