import type { Request, Response } from 'express';
import { queryHasura, mutateHasura } from './_lib/hasura-client';
import { executeWorkflow } from './_lib/workflow-engine';

/**
 * Hasura Action: approveStep(step_run_id)
 *
 * Layer 2 permission: Checks the approver's role in the workflow's org
 * before allowing them to approve an approval_gate step.
 *
 * 1. Looks up step_run → workflow_run → workflow → organization → org_members
 * 2. Verifies user is owner/editor
 * 3. Updates step_run status to 'approved'
 * 4. Resumes workflow execution from the next step
 */
export default async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const step_run_id = body.input?.step_run_id || body.step_run_id;
    const sessionVars = body.session_variables;
    const userId = sessionVars?.['x-hasura-user-id'];

    if (!userId) {
      return res.status(400).json({ message: 'Unauthorized: No user ID in session' });
    }

    // Fetch step_run with full chain to verify org membership
    const getStepRunQuery = `
      query GetStepRunForApproval($stepRunId: uuid!, $userId: uuid!) {
        step_runs_by_pk(id: $stepRunId) {
          id
          status
          workflow_run_id
          workflow_step {
            id
            step_order
            step_type
            name
          }
          workflow_run {
            id
            status
            workflow {
              id
              org_id
              organization {
                id
                name
                org_members(where: {user_id: {_eq: $userId}}) {
                  id
                  role
                }
              }
            }
          }
        }
      }
    `;

    const data = await queryHasura(getStepRunQuery, {
      stepRunId: step_run_id,
      userId,
    });
    const stepRun = data.step_runs_by_pk;

    if (!stepRun) {
      return res.status(400).json({ message: 'Step run not found' });
    }

    // Verify step is actually awaiting approval
    if (stepRun.status !== 'awaiting_approval') {
      return res.status(400).json({
        message: `Step is not awaiting approval (current status: ${stepRun.status})`,
      });
    }

    // Verify the step is an approval_gate type
    if (stepRun.workflow_step?.step_type !== 'approval_gate') {
      return res.status(400).json({
        message: 'This step is not an approval gate',
      });
    }

    // Verify workflow run is paused
    if (stepRun.workflow_run?.status !== 'paused') {
      return res.status(400).json({
        message: 'Workflow run is not in paused state',
      });
    }

    // LAYER 2 PERMISSION CHECK: Verify approver is owner/editor in the org
    const membership =
      stepRun.workflow_run?.workflow?.organization?.org_members?.[0];

    if (!membership) {
      return res.status(400).json({
        message: 'Forbidden: You are not a member of this organization',
      });
    }

    if (membership.role !== 'owner' && membership.role !== 'editor') {
      return res.status(400).json({
        message: 'Forbidden: Only owners and editors can approve steps',
      });
    }

    const workflowRunId = stepRun.workflow_run_id;
    const nextStepOrder = stepRun.workflow_step.step_order + 1;

    // Update step_run to approved
    const approveStepMutation = `
      mutation ApproveStepRun($id: uuid!, $approvedBy: uuid!, $approvedAt: timestamptz!) {
        update_step_runs_by_pk(
          pk_columns: {id: $id},
          _set: {
            status: approved,
            approved_by: $approvedBy,
            approved_at: $approvedAt,
            completed_at: $approvedAt
          }
        ) {
          id
          status
        }
      }
    `;
    await mutateHasura(approveStepMutation, {
      id: step_run_id,
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
    });

    // Update workflow_run status back to running
    await mutateHasura(
      `
      mutation ResumeWorkflowRun($id: uuid!) {
        update_workflow_runs_by_pk(
          pk_columns: {id: $id},
          _set: {status: running}
        ) {
          id
          status
        }
      }
    `,
      { id: workflowRunId }
    );

    // Resume execution from the next step (fire-and-forget)
    console.log(`[approveStep] Approved step ${step_run_id}, resuming workflow ${workflowRunId} from step order ${nextStepOrder}`);
    executeWorkflow(workflowRunId, nextStepOrder).catch((err) =>
      console.error(`[approveStep] Resume execution error:`, err)
    );

    return res.status(200).json({
      success: true,
      message: 'Step approved and workflow resumed',
      workflow_run_id: workflowRunId,
    });
  } catch (error: any) {
    console.error('[approveStep] Error:', error);
    return res.status(400).json({ message: error.message || 'Internal server error' });
  }
};
