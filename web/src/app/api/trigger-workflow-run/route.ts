import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, gql, executeWorkflow } from '@/lib/workflowEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const workflow_id = body.input?.workflow_id || body.workflow_id;
    
    // SECURITY: Must derive authenticated user ONLY from Hasura session_variables or valid Bearer JWT.
    // DO NOT trust userId, org_id, or role passed in client request JSON.
    const userId = getAuthenticatedUserId(req, body);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: No valid session or authorization token' }, { status: 401 });
    }
    if (!workflow_id) {
      return NextResponse.json({ message: 'Missing workflow_id' }, { status: 400 });
    }

    // Fetch workflow with org membership and quota
    const workflowData = await gql(
      `query GetWF($wfId: uuid!, $uid: uuid!) {
        workflows_by_pk(id: $wfId) {
          id org_id is_active
          organization {
            id name quota_used quota_limit
            org_members(where: {user_id: {_eq: $uid}}) { id role }
          }
          workflow_steps(order_by: {step_order: asc}) { id step_order step_type name }
        }
      }`,
      { wfId: workflow_id, uid: userId }
    );
    const workflow = workflowData.workflows_by_pk;
    if (!workflow) return NextResponse.json({ message: 'Workflow not found' }, { status: 400 });
    if (!workflow.is_active)
      return NextResponse.json({ message: 'Workflow is not active' }, { status: 400 });

    const org = workflow.organization;
    const membership = org.org_members?.[0];
    if (!membership)
      return NextResponse.json(
        { message: 'Forbidden: You are not a member of this organization' },
        { status: 400 }
      );
    if (membership.role !== 'owner' && membership.role !== 'editor')
      return NextResponse.json(
        { message: 'Forbidden: Viewers cannot trigger workflow runs' },
        { status: 400 }
      );

    // Atomic quota reservation
    const quotaRes = await gql(
      `mutation ReserveTriggerQuota($orgId: uuid!) {
        check_and_increment_quota(args: {p_org_id: $orgId}) {
          id
        }
      }`,
      { orgId: workflow.org_id }
    );
    if (!quotaRes?.check_and_increment_quota?.length)
      return NextResponse.json(
        { message: `Organization quota exceeded (${org.quota_used}/${org.quota_limit})` },
        { status: 400 }
      );

    // Create workflow_run
    const runResult = await gql(
      `mutation CreateRun($o: workflow_runs_insert_input!) {
        insert_workflow_runs_one(object: $o) { id status }
      }`,
      {
        o: {
          org_id: workflow.org_id,
          workflow_id,
          status: 'running',
          trigger_type: 'manual',
          triggered_by: userId,
          started_at: new Date().toISOString(),
        },
      }
    );
    const workflowRunId = runResult.insert_workflow_runs_one.id;

    // Create step_runs
    if (workflow.workflow_steps.length > 0) {
      const objs = workflow.workflow_steps.map((s: any) => ({
        workflow_run_id: workflowRunId,
        workflow_step_id: s.id,
        status: 'pending',
      }));
      await gql(
        `mutation CreateSRs($objs: [step_runs_insert_input!]!) {
          insert_step_runs(objects: $objs) { affected_rows }
        }`,
        { objs }
      );
    }

    // Await execution so Vercel Serverless environment does not freeze mid-execution
    try {
      await executeWorkflow(workflowRunId);
    } catch (err) {
      console.error(`[triggerWorkflowRun] Async error for ${workflowRunId}:`, err);
    }

    console.log(
      `[triggerWorkflowRun] Started run ${workflowRunId} for workflow ${workflow_id} by user ${userId}`
    );

    return NextResponse.json({
      workflow_run_id: workflowRunId,
      status: 'running',
      message: 'Workflow started successfully',
    });
  } catch (error: any) {
    console.error('[triggerWorkflowRun] Error:', error);
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 400 });
  }
}
