import type { Request, Response } from 'express';
import { queryHasura, mutateHasura } from './_lib/hasura-client';
import { executeWorkflow } from './_lib/workflow-engine';

/**
 * Webhook Trigger endpoint.
 * External systems call this to start a workflow run.
 *
 * Validates webhook secret, checks org quota, creates run + step_runs,
 * and starts async execution.
 */
export default async (req: Request, res: Response) => {
  try {
    // Supports direct HTTP webhook call or Hasura Action call
    const body = req.body || {};
    const workflow_id = body.input?.workflow_id || body.workflow_id;
    const payload = body.input?.payload || body.payload || {};

    const webhookSecret = (req.headers?.['x-webhook-secret'] as string) || body.secret || body.input?.secret;

    if (!workflow_id) {
      return res.status(400).json({ message: 'Missing workflow_id' });
    }

    // Fetch workflow with triggers and quota
    const query = `
      query GetWorkflowForWebhook($workflowId: uuid!) {
        workflows_by_pk(id: $workflowId) {
          id
          org_id
          is_active
          workflow_triggers(where: {
            trigger_type: {_eq: "webhook"},
            is_active: {_eq: true}
          }) {
            id
            config
          }
          workflow_steps(order_by: {step_order: asc}) {
            id
            step_order
            step_type
            name
          }
          organization {
            id
            quota_used
            quota_limit
          }
        }
      }
    `;

    const data = await queryHasura(query, { workflowId: workflow_id });
    const workflow = data.workflows_by_pk;

    if (!workflow) {
      return res.status(400).json({ message: 'Workflow not found' });
    }

    if (!workflow.is_active) {
      return res.status(400).json({ message: 'Workflow is not active' });
    }

    // Verify webhook trigger exists
    if (workflow.workflow_triggers.length === 0) {
      return res
        .status(400)
        .json({ message: 'No active webhook trigger configured for this workflow' });
    }

    // Validate webhook secret against trigger config
    const trigger = workflow.workflow_triggers[0];
    const expectedSecret = trigger.config?.secret;
    if (!expectedSecret) {
      return res.status(400).json({ message: 'Webhook trigger has no configured secret' });
    }
    if (!webhookSecret) {
      return res.status(400).json({ message: 'Missing webhook secret header/payload' });
    }
    if (webhookSecret !== expectedSecret) {
      return res.status(400).json({ message: 'Invalid webhook secret' });
    }

    // Atomic quota reservation via Postgres function
    const quotaRes = await mutateHasura(
      `
      mutation ReserveWebhookQuota($orgId: uuid!) {
        check_and_increment_quota(args: {p_org_id: $orgId}) {
          id
        }
      }
    `,
      { orgId: workflow.org_id }
    );

    if (!quotaRes?.check_and_increment_quota?.length) {
      return res.status(400).json({
        message: `Organization quota exceeded (${workflow.organization.quota_used}/${workflow.organization.quota_limit})`,
      });
    }


    // Create workflow_run
    const createRunMutation = `
      mutation CreateWebhookRun($object: workflow_runs_insert_input!) {
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
        trigger_type: 'webhook',
        started_at: new Date().toISOString(),
      },
    });
    const workflowRunId = runResult.insert_workflow_runs_one.id;

    // Create step_runs
    if (workflow.workflow_steps.length > 0) {
      const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
        workflow_run_id: workflowRunId,
        workflow_step_id: step.id,
        status: 'pending',
      }));

      await mutateHasura(
        `
        mutation CreateWebhookStepRuns($objects: [step_runs_insert_input!]!) {
          insert_step_runs(objects: $objects) {
            affected_rows
          }
        }
      `,
        { objects: stepRunObjects }
      );
    }

    // Start async execution
    console.log(`[webhookTrigger] Started run ${workflowRunId} for workflow ${workflow_id} via webhook`);
    executeWorkflow(workflowRunId).catch((err) =>
      console.error(`[webhookTrigger] Async execution error for run ${workflowRunId}:`, err)
    );

    return res.status(200).json({
      workflow_run_id: workflowRunId,
      status: 'running',
      message: 'Workflow triggered via webhook',
    });
  } catch (error: any) {
    console.error('[webhookTrigger] Error:', error);
    return res.status(400).json({ message: error.message || 'Internal server error' });
  }
};
