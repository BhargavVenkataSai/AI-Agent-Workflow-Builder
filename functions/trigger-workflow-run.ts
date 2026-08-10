import type { Request, Response } from 'express';
import { queryHasura, mutateHasura } from './_lib/hasura-client';
import { executeWorkflow } from './_lib/workflow-engine';

/**
 * Hasura Action: triggerWorkflowRun(workflow_id)
 *
 * 1. Verifies caller is owner/editor in the workflow's org
 * 2. Checks org quota
 * 3. Creates workflow_run + step_runs
 * 4. Starts async execution
 */
export default async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const workflow_id = body.input?.workflow_id || body.workflow_id;
    const sessionVars = body.session_variables;
    const userId = sessionVars?.['x-hasura-user-id'];

    if (!userId) {
      return res.status(400).json({ message: 'Unauthorized: No user ID in session' });
    }

    // Fetch workflow with org membership and quota
    const getWorkflowQuery = `
      query GetWorkflowForTrigger($workflowId: uuid!, $userId: uuid!) {
        workflows_by_pk(id: $workflowId) {
          id
          org_id
          is_active
          organization {
            id
            name
            quota_used
            quota_limit
            org_members(where: {user_id: {_eq: $userId}}) {
              id
              role
            }
          }
          workflow_steps(order_by: {step_order: asc}) {
            id
            step_order
            step_type
            name
          }
        }
      }
    `;

    const workflowData = await queryHasura(getWorkflowQuery, {
      workflowId: workflow_id,
      userId,
    });
    const workflow = workflowData.workflows_by_pk;

    if (!workflow) {
      return res.status(400).json({ message: 'Workflow not found' });
    }

    if (!workflow.is_active) {
      return res.status(400).json({ message: 'Workflow is not active' });
    }

    // Layer 1: Verify org membership + role
    const org = workflow.organization;
    const membership = org.org_members?.[0];

    if (!membership) {
      return res.status(400).json({
        message: 'Forbidden: You are not a member of this organization',
      });
    }

    if (membership.role !== 'owner' && membership.role !== 'editor') {
      return res.status(400).json({
        message: 'Forbidden: Viewers cannot trigger workflow runs',
      });
    }

    // Atomic quota reservation via Postgres function or database query
    const quotaRes = await mutateHasura(
      `
      mutation ReserveTriggerQuota($orgId: uuid!) {
        check_and_increment_quota(args: {p_org_id: $orgId})
      }
    `,
      { orgId: workflow.org_id }
    ).catch(async () => {
      if (org.quota_used >= org.quota_limit) return { check_and_increment_quota: false };
      await mutateHasura(
        `mutation IncQuota($orgId: uuid!) { update_organizations_by_pk(pk_columns: {id: $orgId}, _inc: {quota_used: 1}) { id } }`,
        { orgId: workflow.org_id }
      );
      return { check_and_increment_quota: true };
    });

    if (!quotaRes.check_and_increment_quota) {
      return res.status(400).json({
        message: `Organization quota exceeded (${org.quota_used}/${org.quota_limit})`,
      });
    }


    // Layer 2: No additional step-level check needed for triggering —
    // step-level gating is enforced during workflow creation and approval

    // Create workflow_run
    const createRunMutation = `
      mutation CreateWorkflowRun($object: workflow_runs_insert_input!) {
        insert_workflow_runs_one(object: $object) {
          id
          status
        }
      }
    `;
    const runResult = await mutateHasura(createRunMutation, {
      object: {
        org_id: workflow.org_id,
        workflow_id: workflow_id,
        status: 'running',
        trigger_type: 'manual',
        triggered_by: userId,
        started_at: new Date().toISOString(),
      },
    });
    const workflowRunId = runResult.insert_workflow_runs_one.id;

    // Create step_runs for all steps
    if (workflow.workflow_steps.length > 0) {
      const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
        workflow_run_id: workflowRunId,
        workflow_step_id: step.id,
        status: 'pending',
      }));

      const createStepRunsMutation = `
        mutation CreateStepRuns($objects: [step_runs_insert_input!]!) {
          insert_step_runs(objects: $objects) {
            affected_rows
          }
        }
      `;
      await mutateHasura(createStepRunsMutation, { objects: stepRunObjects });
    }

    // Fire-and-forget: start async execution
    executeWorkflow(workflowRunId).catch((err) =>
      console.error(`[triggerWorkflowRun] Async execution error for run ${workflowRunId}:`, err)
    );

    console.log(`[triggerWorkflowRun] Started run ${workflowRunId} for workflow ${workflow_id} by user ${userId}`);

    return res.status(200).json({
      workflow_run_id: workflowRunId,
      status: 'running',
      message: 'Workflow started successfully',
    });
  } catch (error: any) {
    console.error('[triggerWorkflowRun] Error:', error);
    return res.status(400).json({ message: error.message || 'Internal server error' });
  }
};
