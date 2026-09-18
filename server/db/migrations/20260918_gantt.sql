-- Aplicar antes de desplegar el Gantt editable en Supabase.
BEGIN;
ALTER TABLE public.tarea ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE public.tarea ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE public.tarea ADD COLUMN IF NOT EXISTS dependencias JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
NOTIFY pgrst, 'reload schema';
