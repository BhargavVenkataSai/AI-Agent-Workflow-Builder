-- ============================================================
-- Seed Data for AI Agent Workflow Builder Demo
-- Run AFTER migrations and user registration
-- ============================================================
-- NOTES:
-- 1. First register users through the nhost Auth UI or API:
--    - owner_a@test.com (password: Test@1234#)
--    - editor_a@test.com (password: Test@1234#)
--    - viewer_a@test.com (password: Test@1234#)
--    - owner_b@test.com (password: Test@1234#)
-- 2. Then run this seed SQL to create orgs and assign users.
-- 3. Replace the UUIDs below with actual user IDs from auth.users.

-- This seed uses a DO block to look up real user IDs dynamically.

DO $$
DECLARE
  v_owner_a_id UUID;
  v_editor_a_id UUID;
  v_viewer_a_id UUID;
  v_owner_b_id UUID;
  v_org_a_id UUID := gen_random_uuid();
  v_org_b_id UUID := gen_random_uuid();
  v_workflow_id UUID := gen_random_uuid();
  v_step1_id UUID := gen_random_uuid();
  v_step2_id UUID := gen_random_uuid();
  v_step3_id UUID := gen_random_uuid();
  v_step4_id UUID := gen_random_uuid();
  v_step5_id UUID := gen_random_uuid();
BEGIN
  -- Look up user IDs (these must exist from registration)
  SELECT id INTO v_owner_a_id FROM auth.users WHERE email = 'owner_a@test.com' LIMIT 1;
  SELECT id INTO v_editor_a_id FROM auth.users WHERE email = 'editor_a@test.com' LIMIT 1;
  SELECT id INTO v_viewer_a_id FROM auth.users WHERE email = 'viewer_a@test.com' LIMIT 1;
  SELECT id INTO v_owner_b_id FROM auth.users WHERE email = 'owner_b@test.com' LIMIT 1;

  -- Skip if users don't exist yet
  IF v_owner_a_id IS NULL THEN
    RAISE NOTICE 'Users not found. Register users first, then re-run this seed.';
    RETURN;
  END IF;

  -- ============================================================
  -- ORGANIZATIONS
  -- ============================================================
  INSERT INTO public.organizations (id, name, slug, quota_limit, quota_used)
  VALUES
    (v_org_a_id, 'Acme AI Labs', 'acme-ai-labs', 100, 0),
    (v_org_b_id, 'Beta Corp', 'beta-corp', 50, 0)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- ORG MEMBERS
  -- ============================================================
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES
    (v_org_a_id, v_owner_a_id, 'owner'),
    (v_org_a_id, v_editor_a_id, 'editor'),
    (v_org_a_id, v_viewer_a_id, 'viewer'),
    (v_org_b_id, v_owner_b_id, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  -- ============================================================
  -- DEMO WORKFLOW (Org A)
  -- AI Content Analysis Pipeline
  -- ============================================================
  INSERT INTO public.workflows (id, org_id, name, description, is_active, created_by)
  VALUES (
    v_workflow_id,
    v_org_a_id,
    'AI Content Analysis Pipeline',
    'Analyzes content with an LLM, branches based on sentiment, makes an API call, and requires approval before completing.',
    true,
    v_owner_a_id
  )
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- WORKFLOW STEPS
  -- ============================================================

  -- Step 1: LLM Call — Analyze content
  INSERT INTO public.workflow_steps (id, workflow_id, step_order, step_type, name, config)
  VALUES (
    v_step1_id, v_workflow_id, 1, 'llm_call', 'Analyze Content Sentiment',
    '{
      "prompt": "Analyze the following text and determine its sentiment. Respond with exactly one word: positive, negative, or neutral.\n\nText: The new product launch exceeded all expectations with record-breaking sales and overwhelmingly positive customer reviews.",
      "model": "llama-3.3-70b-versatile",
      "temperature": 0.3
    }'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- Step 2: Conditional Branch — Check if positive
  INSERT INTO public.workflow_steps (id, workflow_id, step_order, step_type, name, config)
  VALUES (
    v_step2_id, v_workflow_id, 2, 'conditional_branch', 'Check Sentiment',
    '{
      "condition": "{{previous_output}}",
      "operator": "contains",
      "value": "positive"
    }'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- Step 3: HTTP Request — Call an API
  INSERT INTO public.workflow_steps (id, workflow_id, step_order, step_type, name, config)
  VALUES (
    v_step3_id, v_workflow_id, 3, 'http_request', 'Fetch Related Data',
    '{
      "url": "https://httpbin.org/post",
      "method": "POST",
      "headers": {"X-Custom-Header": "workflow-builder"},
      "body": "{\"sentiment\": \"{{previous_output}}\", \"action\": \"fetch_related\"}"
    }'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- Step 4: Approval Gate — Human review
  INSERT INTO public.workflow_steps (id, workflow_id, step_order, step_type, name, config)
  VALUES (
    v_step4_id, v_workflow_id, 4, 'approval_gate', 'Manager Approval',
    '{
      "message": "Please review the analysis results and approve to proceed with notification."
    }'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- Step 5: Notify — Send notification
  INSERT INTO public.workflow_steps (id, workflow_id, step_order, step_type, name, config)
  VALUES (
    v_step5_id, v_workflow_id, 5, 'notify', 'Send Completion Alert',
    '{
      "channel": "console",
      "message": "Content analysis pipeline completed successfully. Sentiment analysis and data fetch approved."
    }'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- ============================================================
  -- WORKFLOW TRIGGERS
  -- ============================================================

  -- Manual trigger (always present)
  INSERT INTO public.workflow_triggers (workflow_id, trigger_type, config, is_active)
  VALUES (v_workflow_id, 'manual', '{}'::jsonb, true)
  ON CONFLICT DO NOTHING;

  -- Webhook trigger
  INSERT INTO public.workflow_triggers (workflow_id, trigger_type, config, is_active)
  VALUES (v_workflow_id, 'webhook', '{"secret": "demo-webhook-secret-123"}'::jsonb, true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE 'Org A ID: %', v_org_a_id;
  RAISE NOTICE 'Org B ID: %', v_org_b_id;
  RAISE NOTICE 'Demo Workflow ID: %', v_workflow_id;
END $$;
