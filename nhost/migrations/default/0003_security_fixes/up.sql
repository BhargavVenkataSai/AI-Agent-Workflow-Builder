-- 1. Fix step_runs.approved_by FK to reference auth.users(id)
ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_approved_by_fkey;
ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Quota enforcement function (atomic database reservation with reset support)
DROP FUNCTION IF EXISTS public.check_and_increment_quota(UUID);

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(p_org_id UUID)
RETURNS SETOF public.organizations AS $$
DECLARE
  v_updated INT;
BEGIN
  -- Auto-reset quota if quota_period_start is in a previous month
  UPDATE public.organizations
  SET quota_used = 0,
      quota_period_start = date_trunc('month', NOW())
  WHERE id = p_org_id AND quota_period_start < date_trunc('month', NOW());

  -- Atomically increment quota_used if quota_used < quota_limit
  UPDATE public.organizations
  SET quota_used = quota_used + 1,
      updated_at = NOW()
  WHERE id = p_org_id AND quota_used < quota_limit;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    RETURN QUERY SELECT * FROM public.organizations WHERE id = p_org_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
