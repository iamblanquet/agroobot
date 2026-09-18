-- Aplicar antes de desplegar los endpoints de catálogos en Supabase.
-- Cada llamada RPC guarda el registro y sus relaciones en una transacción.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_catalog_entry(
  p_kind text, p_id bigint, p_fields jsonb,
  p_predio_ids bigint[] DEFAULT NULL, p_frente jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  saved_predio public.predio;
  saved_obra public.obra;
BEGIN
  IF p_kind = 'predio' THEN
    IF p_id IS NULL THEN
      INSERT INTO public.predio(nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
      VALUES (p_fields->>'nombre', (p_fields->>'superficie_legal_ha')::numeric,
        (p_fields->>'superficie_util_ha')::numeric, p_fields->>'regimen', p_fields->>'poligono_geojson')
      RETURNING * INTO saved_predio;
    ELSE
      UPDATE public.predio SET nombre = p_fields->>'nombre',
        superficie_legal_ha = (p_fields->>'superficie_legal_ha')::numeric,
        superficie_util_ha = (p_fields->>'superficie_util_ha')::numeric,
        regimen = p_fields->>'regimen',
        poligono_geojson = CASE WHEN p_fields ? 'poligono_geojson' THEN p_fields->>'poligono_geojson' ELSE poligono_geojson END
      WHERE id = p_id RETURNING * INTO saved_predio;
      IF NOT FOUND THEN RAISE EXCEPTION 'Predio no encontrado'; END IF;
    END IF;
    IF p_frente IS NOT NULL THEN
      INSERT INTO public.obra(nombre, proyecto_id, fase_actual, estado, tg_thread_id)
      VALUES(p_frente->>'nombre', (p_frente->>'proyecto_id')::bigint,
        p_frente->>'fase_actual', p_frente->>'estado', p_frente->>'tg_thread_id')
      RETURNING * INTO saved_obra;
      INSERT INTO public.obra_predio(obra_id, predio_id) VALUES(saved_obra.id, saved_predio.id);
    END IF;
  ELSIF p_kind = 'obra' THEN
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
      DELETE FROM public.obra_predio WHERE obra_id = saved_obra.id;
      INSERT INTO public.obra_predio(obra_id, predio_id)
        SELECT saved_obra.id, unnest_id FROM (SELECT DISTINCT unnest(p_predio_ids) AS unnest_id) ids;
    END IF;
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
LOCK TABLE public.predio, public.obra IN SHARE ROW EXCLUSIVE MODE;
SELECT setval(pg_get_serial_sequence('public.predio','id'),
  GREATEST((SELECT COALESCE(MAX(id),0)+1 FROM public.predio), nextval(pg_get_serial_sequence('public.predio','id'))), false);
SELECT setval(pg_get_serial_sequence('public.obra','id'),
  GREATEST((SELECT COALESCE(MAX(id),0)+1 FROM public.obra), nextval(pg_get_serial_sequence('public.obra','id'))), false);
COMMIT;
NOTIFY pgrst, 'reload schema';
