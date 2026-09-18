-- Ejecutar DESPUÉS de 20260918_catalogs.sql, antes de desplegar.
BEGIN;
ALTER TABLE public.predio ADD COLUMN IF NOT EXISTS tg_thread_id text;
ALTER TABLE public.reporte ADD COLUMN IF NOT EXISTS predio_id bigint REFERENCES public.predio(id) ON DELETE SET NULL;
ALTER TABLE public.proyecto ADD COLUMN IF NOT EXISTS fase_catalogo text;
CREATE TABLE IF NOT EXISTS public.proyecto_predio (
  proyecto_id bigint NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  predio_id bigint NOT NULL REFERENCES public.predio(id) ON DELETE CASCADE,
  PRIMARY KEY(proyecto_id,predio_id)
);
ALTER TABLE public.proyecto_predio ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.proyecto_predio TO service_role;
-- Bootstrap the explicit assignments from existing fronts. No fronts or topics
-- are deleted. Ambiguous old topics require manual selection in the plot form.
INSERT INTO public.proyecto_predio
  SELECT DISTINCT o.proyecto_id,op.predio_id FROM public.obra o JOIN public.obra_predio op ON op.obra_id=o.id
  ON CONFLICT DO NOTHING;
WITH candidates AS (
  SELECT op.predio_id, MIN(o.tg_thread_id) AS thread_id FROM public.obra o JOIN public.obra_predio op ON op.obra_id=o.id
  WHERE o.tg_thread_id IS NOT NULL AND o.tg_thread_id != ''
  GROUP BY op.predio_id HAVING COUNT(DISTINCT o.tg_thread_id)=1
), owners AS (
  SELECT o.tg_thread_id, COUNT(DISTINCT op.predio_id) AS n FROM public.obra o JOIN public.obra_predio op ON op.obra_id=o.id GROUP BY o.tg_thread_id
)
UPDATE public.predio p SET tg_thread_id=c.thread_id FROM candidates c JOIN owners x ON x.tg_thread_id=c.thread_id
WHERE p.id=c.predio_id AND p.tg_thread_id IS NULL AND x.n=1;
UPDATE public.reporte r SET predio_id=(SELECT MIN(rl.predio_id) FROM public.reporte_linea rl WHERE rl.reporte_id=r.id HAVING COUNT(DISTINCT rl.predio_id)=1) WHERE r.predio_id IS NULL;
UPDATE public.reporte r SET predio_id=(SELECT MIN(op.predio_id) FROM public.obra_predio op WHERE op.obra_id=r.obra_id HAVING COUNT(DISTINCT op.predio_id)=1)
WHERE r.predio_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.reporte_linea rl WHERE rl.reporte_id=r.id AND rl.predio_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_predio_telegram ON public.predio(tg_thread_id) WHERE tg_thread_id IS NOT NULL AND tg_thread_id != '';
CREATE OR REPLACE FUNCTION public.save_catalog_entry(
  p_kind text, p_id bigint, p_fields jsonb,
  p_predio_ids bigint[] DEFAULT NULL, p_frente jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  saved_project public.proyecto;
  saved_predio public.predio;
  saved_obra public.obra;
BEGIN
  IF p_kind = 'proyecto' THEN
    IF p_id IS NULL THEN
      INSERT INTO public.proyecto(nombre,tipo,ciclo,superficie_meta_ha,fase_catalogo,gerente_id,fecha_inicio,fecha_fin,estado)
      VALUES(p_fields->>'nombre',p_fields->>'tipo',p_fields->>'ciclo',COALESCE((p_fields->>'superficie_meta_ha')::numeric,0),
        p_fields->>'fase_catalogo',(p_fields->>'gerente_id')::bigint,(p_fields->>'fecha_inicio')::date,(p_fields->>'fecha_fin')::date,'activo')
      RETURNING * INTO saved_project;
    ELSE
      SELECT * INTO saved_project FROM public.proyecto WHERE id = p_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Proyecto no encontrado'; END IF;
      saved_project := jsonb_populate_record(saved_project, p_fields);
      UPDATE public.proyecto SET nombre=saved_project.nombre,tipo=saved_project.tipo,ciclo=saved_project.ciclo,
        superficie_meta_ha=saved_project.superficie_meta_ha,fase_catalogo=saved_project.fase_catalogo,
        gerente_id=saved_project.gerente_id,fecha_inicio=saved_project.fecha_inicio,fecha_fin=saved_project.fecha_fin
      WHERE id=p_id RETURNING * INTO saved_project;
    END IF;
    IF p_predio_ids IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.obra o JOIN public.obra_predio op ON op.obra_id=o.id
        WHERE o.proyecto_id=saved_project.id AND NOT (op.predio_id=ANY(p_predio_ids))) THEN
        RAISE EXCEPTION 'No se puede quitar un predio que tiene frentes del proyecto';
      END IF;
      DELETE FROM public.proyecto_predio WHERE proyecto_id=saved_project.id;
      INSERT INTO public.proyecto_predio(proyecto_id,predio_id)
        SELECT saved_project.id, pid FROM (SELECT DISTINCT unnest(p_predio_ids) AS pid) ids;
    END IF;
    RETURN jsonb_build_object('project',to_jsonb(saved_project));
  ELSIF p_kind = 'predio' THEN
    IF p_id IS NULL THEN
      INSERT INTO public.predio(nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson, tg_thread_id)
      VALUES (p_fields->>'nombre', (p_fields->>'superficie_legal_ha')::numeric,
        (p_fields->>'superficie_util_ha')::numeric, p_fields->>'regimen', p_fields->>'poligono_geojson', p_fields->>'tg_thread_id')
      RETURNING * INTO saved_predio;
    ELSE
      UPDATE public.predio SET nombre = p_fields->>'nombre',
        superficie_legal_ha = (p_fields->>'superficie_legal_ha')::numeric,
        superficie_util_ha = (p_fields->>'superficie_util_ha')::numeric,
        regimen = p_fields->>'regimen',
        tg_thread_id = CASE WHEN p_fields ? 'tg_thread_id' THEN p_fields->>'tg_thread_id' ELSE tg_thread_id END,
        poligono_geojson = CASE WHEN p_fields ? 'poligono_geojson' THEN p_fields->>'poligono_geojson' ELSE poligono_geojson END
      WHERE id = p_id RETURNING * INTO saved_predio;
      IF NOT FOUND THEN RAISE EXCEPTION 'Predio no encontrado'; END IF;
    END IF;
  ELSIF p_kind = 'obra' THEN
    PERFORM 1 FROM public.proyecto WHERE id = COALESCE((p_fields->>'proyecto_id')::bigint, (SELECT proyecto_id FROM public.obra WHERE id=p_id)) FOR UPDATE;
    IF p_id IS NULL THEN
      INSERT INTO public.obra(nombre, proyecto_id, fase_actual, estado, tg_thread_id)
      VALUES(p_fields->>'nombre', (p_fields->>'proyecto_id')::bigint,
        p_fields->>'fase_actual', p_fields->>'estado', p_fields->>'tg_thread_id')
      RETURNING * INTO saved_obra;
    ELSE
      -- Lock also serializes concurrent replacements of the plot links.
      PERFORM 1 FROM public.obra WHERE id = p_id FOR UPDATE;
      UPDATE public.obra SET
        nombre = CASE WHEN p_fields ? 'nombre' THEN p_fields->>'nombre' ELSE nombre END,
        proyecto_id = CASE WHEN p_fields ? 'proyecto_id' THEN (p_fields->>'proyecto_id')::bigint ELSE proyecto_id END,
        fase_actual = CASE WHEN p_fields ? 'fase_actual' THEN p_fields->>'fase_actual' ELSE fase_actual END,
        estado = CASE WHEN p_fields ? 'estado' THEN p_fields->>'estado' ELSE estado END,
        tg_thread_id = CASE WHEN p_fields ? 'tg_thread_id' THEN p_fields->>'tg_thread_id' ELSE tg_thread_id END
      WHERE id = p_id RETURNING * INTO saved_obra;
      IF NOT FOUND THEN RAISE EXCEPTION 'Frente no encontrado'; END IF;
    END IF;
    IF p_predio_ids IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM unnest(p_predio_ids) pid WHERE NOT EXISTS(SELECT 1 FROM public.proyecto_predio pp WHERE pp.proyecto_id=saved_obra.proyecto_id AND pp.predio_id=pid)) THEN RAISE EXCEPTION 'Predio no asignado al proyecto'; END IF;
      DELETE FROM public.obra_predio WHERE obra_id = saved_obra.id;
      INSERT INTO public.obra_predio(obra_id, predio_id)
        SELECT saved_obra.id, unnest_id FROM (SELECT DISTINCT unnest(p_predio_ids) AS unnest_id) ids;
    END IF;
    IF EXISTS(SELECT 1 FROM public.obra_predio op WHERE op.obra_id=saved_obra.id AND NOT EXISTS(SELECT 1 FROM public.proyecto_predio pp WHERE pp.proyecto_id=saved_obra.proyecto_id AND pp.predio_id=op.predio_id)) THEN RAISE EXCEPTION 'Predio no asignado al proyecto'; END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de catálogo inválido';
  END IF;
  RETURN jsonb_build_object('predio', CASE WHEN saved_predio.id IS NOT NULL THEN to_jsonb(saved_predio) ELSE NULL END,
    'obra', CASE WHEN saved_obra.id IS NOT NULL THEN to_jsonb(saved_obra) ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.save_catalog_entry(text,bigint,jsonb,bigint[],jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_catalog_entry(text,bigint,jsonb,bigint[],jsonb) TO service_role;

-- Older REST inserts supplied explicit ids. Advance identity sequences without
-- moving either sequence backwards, so new transactional inserts are safe.
LOCK TABLE public.predio, public.obra, public.proyecto IN SHARE ROW EXCLUSIVE MODE;
SELECT setval(pg_get_serial_sequence('public.predio','id'),
  GREATEST((SELECT COALESCE(MAX(id),0)+1 FROM public.predio), nextval(pg_get_serial_sequence('public.predio','id'))), false);
SELECT setval(pg_get_serial_sequence('public.obra','id'),
  GREATEST((SELECT COALESCE(MAX(id),0)+1 FROM public.obra), nextval(pg_get_serial_sequence('public.obra','id'))), false);
SELECT setval(pg_get_serial_sequence('public.proyecto','id'), GREATEST((SELECT COALESCE(MAX(id),0)+1 FROM public.proyecto), nextval(pg_get_serial_sequence('public.proyecto','id'))), false);
COMMIT;
NOTIFY pgrst, 'reload schema';
