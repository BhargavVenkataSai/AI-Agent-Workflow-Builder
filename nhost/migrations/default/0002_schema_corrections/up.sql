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
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Quota enforcement function (atomic database reservation)
CREATE OR REPLACE FUNCTION public.check_and_increment_quota(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.organizations
  SET quota_used = quota_used + 1,
      updated_at = NOW()
  WHERE id = p_org_id AND quota_used < quota_limit;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
