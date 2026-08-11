import type { Request, Response } from 'express';
import { queryHasura, mutateHasura } from './_lib/hasura-client';
import { executeWorkflow } from './_lib/workflow-engine';

/**
 * Scheduled/Cron Trigger handler.
 * Called by Hasura cron trigger on a schedule.
 * Finds all workflows with active 'scheduled' triggers and starts runs.
 */
export default async (req: Request, res: Response) => {
  try {
    console.log(`[scheduledTrigger] Cron fired at ${new Date().toISOString()}`);

    // Find all workflows with active scheduled triggers
    const query = `
      query GetScheduledWorkflows {
        workflows(where: {
          is_active: {_eq: true},
          workflow_triggers: {
            trigger_type: {_eq: "scheduled"},
            is_active: {_eq: true}
          }
        }) {
          id
          name
          org_id
          organization {
            quota_used
            quota_limit
          }
          workflow_steps(order_by: {step_order: asc}) {
            id
            step_order
          }
          workflow_triggers(where: {
            trigger_type: {_eq: "scheduled"},
            is_active: {_eq: true}
          }) {
            config
          }
        }
      }
    `;

    const data = await queryHasura(query);
    const workflows = data.workflows || [];

    if (workflows.length === 0) {
      console.log('[scheduledTrigger] No workflows with scheduled triggers found');
      return res.status(200).json({ message: 'No scheduled workflows', triggered: 0 });
    }

    const triggeredRuns: string[] = [];

    for (const workflow of workflows) {
      // Atomic quota reservation via Postgres function
      const quotaRes = await mutateHasura(
        `
        mutation ReserveScheduledQuota($orgId: uuid!) {
          check_and_increment_quota(args: {p_org_id: $orgId}) {
            id
          }
        }
      `,
        { orgId: workflow.org_id }
      );

      if (!quotaRes?.check_and_increment_quota?.length) {
        console.log(`[scheduledTrigger] Quota exceeded for workflow ${workflow.id}, skipping`);
        continue;
      }

      // Create run
      const runResult = await mutateHasura(
        `
        mutation CreateScheduledRun($object: workflow_runs_insert_input!) {
          insert_workflow_runs_one(object: $object) { id }
        }
      `,
        {
          object: {
            org_id: workflow.org_id,
            workflow_id: workflow.id,
            status: 'running',
            trigger_type: 'scheduled',
            started_at: new Date().toISOString(),
          },
        }
      );
      const runId = runResult.insert_workflow_runs_one.id;

      // Create step_runs
      if (workflow.workflow_steps.length > 0) {
        const stepRunObjects = workflow.workflow_steps.map((step: any) => ({
          workflow_run_id: runId,
          workflow_step_id: step.id,
          status: 'pending',
        }));

        await mutateHasura(
          `
          mutation CreateScheduledStepRuns($objects: [step_runs_insert_input!]!) {
            insert_step_runs(objects: $objects) { affected_rows }
          }
        `,
          { objects: stepRunObjects }
        );
      }

      // Start execution
      executeWorkflow(runId).catch((err) =>
        console.error(`[scheduledTrigger] Execution error for run ${runId}:`, err)
      );

      triggeredRuns.push(runId);
      console.log(`[scheduledTrigger] Triggered workflow "${workflow.name}" (run: ${runId})`);
    }

    return res.status(200).json({
      message: `Triggered ${triggeredRuns.length} scheduled workflow(s)`,
      triggered: triggeredRuns.length,
      run_ids: triggeredRuns,
    });
  } catch (error: any) {
    console.error('[scheduledTrigger] Error:', error);
    return res.status(500).json({ message: error.message });
  }
};
