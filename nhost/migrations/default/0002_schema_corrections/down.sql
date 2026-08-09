ALTER TABLE public.step_runs DROP COLUMN IF EXISTS duration_seconds;
ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_approved_by_fkey;
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_runs DROP COLUMN IF EXISTS org_id CASCADE;
