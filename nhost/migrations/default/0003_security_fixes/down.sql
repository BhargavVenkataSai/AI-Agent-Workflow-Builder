-- Revert check_and_increment_quota function
DROP FUNCTION IF EXISTS public.check_and_increment_quota(UUID);

-- Revert FK on step_runs.approved_by
ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_approved_by_fkey;
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
