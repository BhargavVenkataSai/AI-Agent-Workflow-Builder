-- 1. Add org_id to workflow_runs (and backfill)
ALTER TABLE public.workflow_runs ADD COLUMN org_id UUID;
UPDATE public.workflow_runs wr SET org_id = w.org_id FROM public.workflows w WHERE wr.workflow_id = w.id;
ALTER TABLE public.workflow_runs ALTER COLUMN org_id SET NOT NULL;

-- 2. Add foreign keys (drop first to ensure clean state if they exist)
ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_workflow_id_fkey;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_org_id_fkey;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_workflow_run_id_fkey;
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_workflow_run_id_fkey FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE CASCADE;

ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_workflow_step_id_fkey;
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.workflow_steps(id) ON DELETE CASCADE;

ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_approved_by_fkey;
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.org_members(id) ON DELETE SET NULL;

-- 3. Ensure attempt_count, input, output, error exist
ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS input JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS output JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS error TEXT;

-- 4. Add GENERATED ALWAYS AS STORED duration_seconds column to step_runs
ALTER TABLE public.step_runs DROP COLUMN IF EXISTS duration_seconds;
ALTER TABLE public.step_runs ADD COLUMN duration_seconds NUMERIC GENERATED ALWAYS AS (
  CASE 
    WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (completed_at - started_at))
    ELSE NULL
  END
) STORED;
