const { db } = require('../db/database');
const supabase = require('../db/supabase');
const projectRepository = require('./projectRepository');
const machineRepository = require('./machineRepository');
const issueRepository = require('./issueRepository');
const materialRepository = require('./materialRepository');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const statsRepository = {
  async getSupervisorStats(todayStr) {
    if (useSupabase()) {
      // 1. Obras sin reporte hoy
      const activeObras = await supabase.selectRows('obra', {
        select: '*,proyecto:proyecto_id(id,nombre)',
        filters: { estado: 'eq.operacion', order: 'id.asc' }
      });

      const obrasSinReporte = [];
      for (const obra of activeObras) {
        const reps = await supabase.selectRows('reporte', {
          select: 'id',
          filters: { obra_id: `eq.${obra.id}`, fecha_operativa: `eq.${todayStr}`, limit: '1' }
        });

        if (!reps || reps.length === 0) {
          const lastReps = await supabase.selectRows('reporte', {
            select: 'fecha_operativa',
            filters: { obra_id: `eq.${obra.id}`, order: 'fecha_operativa.desc', limit: '1' }
          });
          const lastRep = lastReps[0];

          let diasAtraso = 1;
          if (lastRep && lastRep.fecha_operativa) {
            const diffTime = Math.abs(new Date(todayStr) - new Date(lastRep.fecha_operativa));
            diasAtraso = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          }

          obrasSinReporte.push({
            id: obra.id,
            nombre: obra.nombre,
            fase_actual: obra.fase_actual,
            estado: obra.estado,
            proyecto_nombre: obra.proyecto ? obra.proyecto.nombre : null,
            ultimo_reporte_fecha: lastRep ? lastRep.fecha_operativa : 'Sin reportes previos',
            dias_atraso: diasAtraso
          });
        }
      }

      // 2. Avance contra meta
      const proyectos = await projectRepository.findAllProjects();
      const comparativaAvance = [];

      for (const p of proyectos) {
        const tareas = await supabase.selectRows('tarea', {
          select: 'cantidad_acumulada,cantidad_meta',
          filters: { proyecto_id: `eq.${p.id}` }
        });
        const haCampo = tareas.reduce((acc, t) => acc + (parseFloat(t.cantidad_acumulada) || 0), 0);

        const dronMediciones = await supabase.selectRows('medicion', {
          select: 'hectareas,fecha',
          filters: { proyecto_id: `eq.${p.id}`, fuente: 'eq.dron', order: 'fecha.desc', limit: '1' }
        });
        const dronRes = dronMediciones[0] || null;
        const haDron = dronRes ? parseFloat(dronRes.hectareas) : null;
        const haMeta = parseFloat(p.superficie_meta_ha) || 1;

        comparativaAvance.push({
          proyecto_id: p.id,
          proyecto_nombre: p.nombre,
          tipo: p.tipo,
          meta_ha: haMeta,
          campo_ha: haCampo,
          dron_ha: haDron,
          dron_fecha: dronRes?.fecha || null,
          porcentaje_campo: Math.min(100, Math.round((haCampo / haMeta) * 100)),
          porcentaje_dron: haDron ? Math.min(100, Math.round((haDron / haMeta) * 100)) : null,
          discrepancia_ha: haDron !== null ? parseFloat((haCampo - haDron).toFixed(2)) : 0
        });
      }

      // 3. Incidencias abiertas
      const incidenciasAbiertas = await supabase.selectRows('incidencia', {
        select: '*,obra:obra_id(id,nombre,proyecto:proyecto_id(id,nombre))',
        filters: { estado: 'neq.cerrada', order: 'abierta_en.desc' }
      });
      const mappedIncidencias = incidenciasAbiertas.map(i => ({
        ...i,
        obra_nombre: i.obra ? i.obra.nombre : null,
        proyecto_nombre: i.obra && i.obra.proyecto ? i.obra.proyecto.nombre : null
      }));

      // 4. Bloqueado por material
      const allMaterials = await materialRepository.findAll();
      const materialesBloqueados = allMaterials
        .filter(m => (m.requerido - m.en_sitio) > 0)
        .map(m => ({
          ...m,
          deficit: m.requerido - m.en_sitio,
          eta_vencido: m.eta && m.eta < todayStr ? 1 : 0
        }))
        .sort((a, b) => b.eta_vencido - a.eta_vencido);

      // Maquinaria
      const machines = await machineRepository.findAllMachines();
      const maquinasCalculadas = machines.map(m => {
        const hrsDesdeServicio = m.horometro_actual - (m.ultimo_servicio_hr || 0);
        const umbral = Number(m.umbral_servicio_hrs) || 300;
        const hrsRestantes = Math.max(0, umbral - hrsDesdeServicio);
        return {
          ...m,
          horas_desde_servicio: hrsDesdeServicio,
          horas_restantes: hrsRestantes,
          alerta_activa: hrsDesdeServicio >= Math.max(0, umbral - 20)
        };
      });

      return {
        widgets: {
          obras_sin_reporte_hoy: obrasSinReporte,
          avance_contra_meta: comparativaAvance,
          incidencias_abiertas: mappedIncidencias,
          bloqueado_por_material: materialesBloqueados
        },
        maquinaria: maquinasCalculadas
      };
    }

    // Modo SQLite
    const activeObras = await db.all(`
      SELECT o.id, o.nombre, o.fase_actual, o.estado, p.nombre AS proyecto_nombre
      FROM obra o
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.estado = 'operacion'
      ORDER BY o.id ASC
    `);

    const obrasSinReporte = [];
    for (const obra of activeObras) {
      const hoyRep = await db.get(
        'SELECT id FROM reporte WHERE obra_id = ? AND fecha_operativa = ?',
        [obra.id, todayStr]
      );

      if (!hoyRep) {
        const lastRep = await db.get(
          'SELECT fecha_operativa FROM reporte WHERE obra_id = ? ORDER BY fecha_operativa DESC LIMIT 1',
          [obra.id]
        );

        let diasAtraso = 1;
        if (lastRep && lastRep.fecha_operativa) {
          const diffTime = Math.abs(new Date(todayStr) - new Date(lastRep.fecha_operativa));
          diasAtraso = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        obrasSinReporte.push({
          ...obra,
          ultimo_reporte_fecha: lastRep ? lastRep.fecha_operativa : 'Sin reportes previos',
          dias_atraso: diasAtraso
        });
      }
    }

    const proyectosAvance = await db.all('SELECT id, nombre, tipo, superficie_meta_ha FROM proyecto ORDER BY id ASC');
    const comparativaAvance = [];

    for (const p of proyectosAvance) {
      const campoRes = await db.get(`
        SELECT COALESCE(SUM(rl.cantidad_ha), 0) AS total_ha_campo
        FROM reporte_linea rl
        JOIN reporte r ON rl.reporte_id = r.id
        WHERE r.proyecto_id = ? AND rl.fuente = 'campo'
      `, [p.id]);

      const tareasRes = await db.get(`
        SELECT COALESCE(SUM(cantidad_acumulada), 0) AS acum_tareas,
               COALESCE(SUM(cantidad_meta), 0) AS meta_tareas
        FROM tarea
        WHERE proyecto_id = ?
      `, [p.id]);

      const dronRes = await db.get(`
        SELECT hectareas, fecha
        FROM medicion
        WHERE proyecto_id = ? AND fuente = 'dron'
        ORDER BY fecha DESC LIMIT 1
      `, [p.id]);

      const haCampo = parseFloat(tareasRes?.acum_tareas || campoRes?.total_ha_campo || 0);
      const haDron = dronRes ? parseFloat(dronRes.hectareas) : null;
      const haMeta = parseFloat(p.superficie_meta_ha) || 1;

      comparativaAvance.push({
        proyecto_id: p.id,
        proyecto_nombre: p.nombre,
        tipo: p.tipo,
        meta_ha: haMeta,
        campo_ha: haCampo,
        dron_ha: haDron,
        dron_fecha: dronRes?.fecha || null,
        porcentaje_campo: Math.min(100, Math.round((haCampo / haMeta) * 100)),
        porcentaje_dron: haDron ? Math.min(100, Math.round((haDron / haMeta) * 100)) : null,
        discrepancia_ha: haDron !== null ? parseFloat((haCampo - haDron).toFixed(2)) : 0
      });
    }

    const incidenciasAbiertas = await db.all(`
      SELECT i.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM incidencia i
      JOIN obra o ON i.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE i.estado != 'cerrada'
      ORDER BY i.abierta_en DESC
    `);

    const materialesBloqueados = await db.all(`
      SELECT m.*, (m.requerido - m.en_sitio) AS deficit,
             o.nombre AS obra_nombre, p.nombre AS proyecto_nombre,
             CASE WHEN m.eta IS NOT NULL AND m.eta < date('now') THEN 1 ELSE 0 END AS eta_vencido
      FROM material m
      JOIN obra o ON m.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE (m.requerido - m.en_sitio) > 0
      ORDER BY eta_vencido DESC, m.eta ASC
    `);

    const maquinas = await db.all('SELECT * FROM maquina ORDER BY alerta_mantenimiento DESC, codigo ASC');
    const maquinasCalculadas = maquinas.map((m) => {
      const hrsDesdeServicio = m.horometro_actual - (m.ultimo_servicio_hr || 0);
      const umbral = Number(m.umbral_servicio_hrs) || 300;
      const hrsRestantes = Math.max(0, umbral - hrsDesdeServicio);
      return {
        ...m,
        horas_desde_servicio: hrsDesdeServicio,
        horas_restantes: hrsRestantes,
        alerta_activa: hrsDesdeServicio >= Math.max(0, umbral - 20)
      };
    });

    return {
      widgets: {
        obras_sin_reporte_hoy: obrasSinReporte,
        avance_contra_meta: comparativaAvance,
        incidencias_abiertas: incidenciasAbiertas,
        bloqueado_por_material: materialesBloqueados
      },
      maquinaria: maquinasCalculadas
    };
  },

  async getDirectionKPIs() {
    if (useSupabase()) {
      const proyectos = await projectRepository.findAllProjects();
      const totalMetaHa = proyectos.reduce((acc, p) => acc + (parseFloat(p.superficie_meta_ha) || 0), 0);

      const tareas = await supabase.selectRows('tarea', { select: 'cantidad_acumulada' });
      const totalCampoHa = tareas.reduce((acc, t) => acc + (parseFloat(t.cantidad_acumulada) || 0), 0);

      const mediciones = await supabase.selectRows('medicion', { select: 'proyecto_id,hectareas,fecha', filters: { fuente: 'eq.dron' } });
      const dronMap = {};
      for (const m of mediciones) {
        if (!dronMap[m.proyecto_id] || new Date(m.fecha) > new Date(dronMap[m.proyecto_id].fecha)) {
          dronMap[m.proyecto_id] = m;
        }
      }
      const totalDronHa = Object.values(dronMap).reduce((acc, m) => acc + (parseFloat(m.hectareas) || 0), 0);

      const lecturas = await supabase.selectRows('lectura_maquina', { select: 'litros_diesel,horas_trabajadas' });
      const totalDiesel = lecturas.reduce((acc, l) => acc + (parseFloat(l.litros_diesel) || 0), 0);
      const totalHoras = lecturas.reduce((acc, l) => acc + (parseFloat(l.horas_trabajadas) || 0), 0);

      const incidencias = await supabase.selectRows('incidencia', { select: 'id,estado' });
      const cerradas = incidencias.filter(i => i.estado === 'cerrada').length;
      const activas = incidencias.filter(i => i.estado !== 'cerrada').length;

      const discrepanciaGeneralHa = parseFloat((totalCampoHa - totalDronHa).toFixed(2));

      return {
        kpis: {
          total_proyectos: proyectos.length,
          total_meta_ha: totalMetaHa,
          total_campo_ha: totalCampoHa,
          total_dron_ha: totalDronHa,
          porcentaje_avance_global: totalMetaHa > 0 ? Math.min(100, Math.round((totalCampoHa / totalMetaHa) * 100)) : 0,
          discrepancia_ha: discrepanciaGeneralHa,
          porcentaje_discrepancia: totalDronHa > 0 ? parseFloat((((totalCampoHa - totalDronHa) / totalDronHa) * 100).toFixed(1)) : 0,
          total_diesel_litros: totalDiesel,
          total_horas_maquina: totalHoras,
          incidencias_activas: activas,
          incidencias_cerradas: cerradas
        },
        proyectos
      };
    }

    // Modo SQLite
    const metas = await db.get(`
      SELECT COUNT(*) AS total_proyectos,
             COALESCE(SUM(superficie_meta_ha), 0) AS total_meta_ha
      FROM proyecto
    `);

    const tareasConsolidadas = await db.get(`
      SELECT COALESCE(SUM(cantidad_acumulada), 0) AS total_habilitadas_ha,
             COALESCE(SUM(cantidad_meta), 0) AS total_planificadas_ha
      FROM tarea
    `);

    const dronTotal = await db.get(`
      SELECT COALESCE(SUM(hectareas), 0) AS total_dron_ha
      FROM (
        SELECT proyecto_id, hectareas, MAX(fecha)
        FROM medicion
        WHERE fuente = 'dron'
        GROUP BY proyecto_id
      )
    `);

    const dieselHours = await db.get(`
      SELECT COALESCE(SUM(litros_diesel), 0) AS total_diesel_litros,
             COALESCE(SUM(horas_trabajadas), 0) AS total_horas_maquina
      FROM lectura_maquina
    `);

    const incidenciasSummary = await db.get(`
      SELECT
        COUNT(*) AS total_historico,
        SUM(CASE WHEN estado = 'cerrada' THEN 1 ELSE 0 END) AS cerradas,
        SUM(CASE WHEN estado != 'cerrada' THEN 1 ELSE 0 END) AS activas
      FROM incidencia
    `);

    const proyectosList = await db.all(`
      SELECT p.*,
             (SELECT COALESCE(SUM(cantidad_acumulada), 0) FROM tarea WHERE proyecto_id = p.id) AS ha_campo,
             (SELECT hectareas FROM medicion WHERE proyecto_id = p.id AND fuente = 'dron' ORDER BY fecha DESC LIMIT 1) AS ha_dron,
             (SELECT COUNT(*) FROM obra WHERE proyecto_id = p.id) AS num_obras,
             (SELECT COUNT(*) FROM incidencia i JOIN obra o ON i.obra_id = o.id WHERE o.proyecto_id = p.id AND i.estado != 'cerrada') AS incidencias_activas
      FROM proyecto p
    `);

    const totalMetaHa = metas?.total_meta_ha || 0;
    const totalCampoHa = tareasConsolidadas?.total_habilitadas_ha || 0;
    const totalDronHa = dronTotal?.total_dron_ha || 0;
    const discrepanciaGeneralHa = parseFloat((totalCampoHa - totalDronHa).toFixed(2));

    return {
      kpis: {
        total_proyectos: metas?.total_proyectos || 0,
        total_meta_ha: totalMetaHa,
        total_campo_ha: totalCampoHa,
        total_dron_ha: totalDronHa,
        porcentaje_avance_global: totalMetaHa > 0 ? Math.min(100, Math.round((totalCampoHa / totalMetaHa) * 100)) : 0,
        discrepancia_ha: discrepanciaGeneralHa,
        porcentaje_discrepancia: totalDronHa > 0 ? parseFloat((((totalCampoHa - totalDronHa) / totalDronHa) * 100).toFixed(1)) : 0,
        total_diesel_litros: dieselHours?.total_diesel_litros || 0,
        total_horas_maquina: dieselHours?.total_horas_maquina || 0,
        incidencias_activas: incidenciasSummary?.activas || 0,
        incidencias_cerradas: incidenciasSummary?.cerradas || 0
      },
      proyectos: proyectosList
    };
  }
};

module.exports = statsRepository;
