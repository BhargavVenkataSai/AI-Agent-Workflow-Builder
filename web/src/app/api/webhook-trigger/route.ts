import { NextRequest, NextResponse } from 'next/server';
import { gql, executeWorkflow } from '@/lib/workflowEngine';

// ─── Route handler for Webhook Hasura Action & external callers ────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Resolve workflow_id and payload
    const workflow_id = body.input?.workflow_id || body.workflow_id;
    const payload = body.input?.payload || body.payload || {};

    // 2. Extract webhook secret from Hasura input, body, query param, or headers
    const authHeader = req.headers.get('authorization');
    const secret =
      body.input?.secret ||
      body.secret ||
      body.input?.payload?.secret ||
      body.payload?.secret ||
      req.nextUrl?.searchParams?.get('secret') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-secret') ||
      (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!workflow_id) {
      return NextResponse.json({ message: 'Missing workflow_id' }, { status: 400 });
    }
    if (!secret) {
      return NextResponse.json({ message: 'Unauthorized: Missing webhook secret' }, { status: 401 });
    }

    // 3. Resolve workflow, active triggers, and organization directly from DB
    const workflowData = await gql(
      `query GetWFForWebhook($wfId: uuid!) {
        workflows_by_pk(id: $wfId) {
          id org_id is_active
          organization {
            id name quota_used quota_limit
          }
          workflow_triggers(where: {trigger_type: {_eq: "webhook"}, is_active: {_eq: true}}) {
            id trigger_type config is_active
          }
          workflow_steps(order_by: {step_order: asc}) { id step_order step_type name }
        }
      }`,
      { wfId: workflow_id }
    );
    const workflow = workflowData.workflows_by_pk;
    if (!workflow) {
      return NextResponse.json({ message: 'Workflow not found' }, { status: 400 });
    }
    if (!workflow.is_active) {
      return NextResponse.json({ message: 'Workflow is not active' }, { status: 400 });
    }

    // 4. Validate webhook trigger configuration & secret
    const webhookTrigger = workflow.workflow_triggers?.[0];
    if (!webhookTrigger) {
      return NextResponse.json({ message: 'Workflow is not configured for webhook triggers' }, { status: 400 });
    }

    const expectedSecret = webhookTrigger.config?.secret || webhookTrigger.config?.webhook_secret;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ message: 'Unauthorized: Invalid webhook secret' }, { status: 401 });
    }

    // 5. Resolve organization & perform atomic quota reservation
    const org = workflow.organization;
    const quotaRes = await gql(
      `mutation ReserveWebhookQuota($orgId: uuid!) {
        check_and_increment_quota(args: {p_org_id: $orgId}) {
          id
        }
      }`,
      { orgId: workflow.org_id }
    );
    if (!quotaRes?.check_and_increment_quota?.length) {
      return NextResponse.json(
        { message: `Organization quota exceeded (${org.quota_used}/${org.quota_limit})` },
        { status: 400 }
      );
    }

    // 6. Create workflow_run (triggered_by is NULL because it's an external secret authentication)
    const runResult = await gql(
      `mutation CreateWebhookRun($o: workflow_runs_insert_input!) {
        insert_workflow_runs_one(object: $o) { id status }
      }`,
      {
        o: {
          org_id: workflow.org_id,
          workflow_id,
          status: 'running',
          trigger_type: 'webhook',
          triggered_by: null,
          started_at: new Date().toISOString(),
        },
      }
    );
    const workflowRunId = runResult.insert_workflow_runs_one.id;

    // 7. Create step_runs
    if (workflow.workflow_steps.length > 0) {
      const objs = workflow.workflow_steps.map((s: any) => ({
        workflow_run_id: workflowRunId,
        workflow_step_id: s.id,
        status: 'pending',
      }));
      await gql(
        `mutation CreateWebhookSRs($objs: [step_runs_insert_input!]!) {
          insert_step_runs(objects: $objs) { affected_rows }
        }`,
        { objs }
      );
    }

    // 8. Invoke the SAME executeWorkflow engine
    try {
      await executeWorkflow(workflowRunId, 0);
    } catch (err) {
      console.error(`[webhookTrigger] Async error for ${workflowRunId}:`, err);
    }

    console.log(
      `[webhookTrigger] Webhook triggered run ${workflowRunId} for workflow ${workflow_id} in org ${org.name}`
    );

    return NextResponse.json({
      workflow_run_id: workflowRunId,
      status: 'running',
      message: 'Workflow started successfully via webhook',
    });
  } catch (error: any) {
    console.error('[webhookTrigger] Error:', error);
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 400 });
  }
}
