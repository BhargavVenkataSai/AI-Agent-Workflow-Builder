import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, gql, executeWorkflow } from '@/lib/workflowEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const step_run_id = body.input?.step_run_id || body.stepRunId;
    
    // SECURITY: Strictly derive user ID from session context or Bearer token
    const userId = getAuthenticatedUserId(req, body);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: No valid session or authorization token' }, { status: 401 });
    }
    if (!step_run_id) {
      return NextResponse.json({ message: 'Missing step_run_id' }, { status: 400 });
    }

    // Fetch step_run with full chain to verify org membership
    const data = await gql(
      `query GetSRApproval($srId: uuid!, $uid: uuid!) {
        step_runs_by_pk(id: $srId) {
          id status workflow_run_id
          workflow_step { id step_order step_type name }
          workflow_run { id status
            workflow { id org_id
              organization { id name
                org_members(where: {user_id: {_eq: $uid}}) { id role }
              }
            }
          }
        }
      }`,
      { srId: step_run_id, uid: userId }
    );
    const stepRun = data.step_runs_by_pk;

    if (!stepRun) return NextResponse.json({ message: 'Step run not found' }, { status: 400 });
    if (stepRun.status !== 'awaiting_approval')
      return NextResponse.json({ message: `Step not awaiting approval (status: ${stepRun.status})` }, { status: 400 });
    if (stepRun.workflow_step?.step_type !== 'approval_gate')
      return NextResponse.json({ message: 'Not an approval gate step' }, { status: 400 });
    if (stepRun.workflow_run?.status !== 'paused')
      return NextResponse.json({ message: 'Workflow run is not paused' }, { status: 400 });

    // Layer 2 permission check
    const membership = stepRun.workflow_run?.workflow?.organization?.org_members?.[0];
    if (!membership)
      return NextResponse.json({ message: 'Forbidden: Not a member of this organization' }, { status: 400 });
    if (membership.role !== 'owner' && membership.role !== 'editor')
      return NextResponse.json({ message: 'Forbidden: Only owners and editors can approve steps' }, { status: 400 });

    const workflowRunId = stepRun.workflow_run_id;
    const nextStepOrder = stepRun.workflow_step.step_order + 1;

    // Update step_run to approved
    await gql(
      `mutation ApproveSR($id: uuid!, $by: uuid!, $at: timestamptz!) {
        update_step_runs_by_pk(pk_columns: {id: $id}, _set: {
          status: approved, approved_by: $by, approved_at: $at, completed_at: $at
        }) { id status }
      }`,
      { id: step_run_id, by: userId, at: new Date().toISOString() }
    );

    // Resume workflow run
    await gql(
      `mutation ResumeRun($id: uuid!) {
        update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {status: running}) { id }
      }`,
      { id: workflowRunId }
    );

    // On Vercel Serverless, we cannot fire-and-forget because the lambda freezes.
    // We must await the execution so it processes the workflow steps.
    try {
      await executeWorkflow(workflowRunId, nextStepOrder);
    } catch (err) {
      console.error(`[approveStep] Resume error:`, err);
    }

    return NextResponse.json({
      success: true,
      message: 'Step approved and workflow resumed',
      workflow_run_id: workflowRunId,
    });
  } catch (error: any) {
    console.error('[approveStep] Error:', error);
    return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 400 });
  }
}
