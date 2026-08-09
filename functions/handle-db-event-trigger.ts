import type { Request, Response } from 'express';
import { queryHasura, mutateHasura } from './_lib/hasura-client';
import { executeWorkflow } from './_lib/workflow-engine';

/**
 * Database Event Trigger handler.
 * Triggered when a row is inserted into `watched_records`.
 * Finds workflows in the same org that have a 'database_event' trigger
 * and starts a run for each.
 */
export default async (req: Request, res: Response) => {
  try {
    const event = req.body.event;
    if (!event) {
      return res.status(400).json({ message: 'No event data' });
    }

    const newRecord = event.data.new;
    const orgId = newRecord.org_id;

    if (!orgId) {
      return res.status(400).json({ message: 'No org_id in watched record' });
    }

    console.log(`[dbEventTrigger] New watched record in org ${orgId}:`, newRecord);

    // Find workflows in this org with active database_event triggers
    const query = `
      query GetDbEventWorkflows($orgId: uuid!) {
        workflows(where: {
          org_id: {_eq: $orgId},
          is_active: {_eq: true},
          workflow_triggers: {
            trigger_type: {_eq: "database_event"},
            is_active: {_eq: true}
          }
        }) {
          id
          name
          organization {
            quota_used
            quota_limit
          }
          workflow_steps(order_by: {step_order: asc}) {
            id
            step_order
          }
        }
      }
    `;

    const data = await queryHasura(query, { orgId });
    const workflows = data.workflows || [];

    if (workflows.length === 0) {
      console.log(`[dbEventTrigger] No workflows with database_event trigger found in org ${orgId}`);
      return res.status(200).json({ message: 'No matching workflows', triggered: 0 });
    }

    const triggeredRuns: string[] = [];

    for (const workflow of workflows) {
      // Check quota
      const org = workflow.organization;
      if (org.quota_used >= org.quota_limit) {
        console.log(`[dbEventTrigger] Quota exceeded for org, skipping workflow ${workflow.id}`);
        continue;
      }

      // Create workflow_run
      const runResult = await mutateHasura(
        `
        mutation CreateDbEventRun($object: workflow_runs_insert_input!) {
          insert_workflow_runs_one(object: $object) { id }
        }
      `,
        {
          object: {
            workflow_id: workflow.id,
            status: 'running',
            trigger_type: 'database_event',
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
          input: { event_data: newRecord },
        }));

        await mutateHasura(
          `
          mutation CreateDbEventStepRuns($objects: [step_runs_insert_input!]!) {
            insert_step_runs(objects: $objects) { affected_rows }
          }
        `,
          { objects: stepRunObjects }
        );
      }

      // Start execution
      executeWorkflow(runId).catch((err) =>
        console.error(`[dbEventTrigger] Execution error for run ${runId}:`, err)
      );

      triggeredRuns.push(runId);
      console.log(`[dbEventTrigger] Triggered workflow "${workflow.name}" (run: ${runId})`);
    }

    // Mark the watched record as processed
    await mutateHasura(
      `
      mutation MarkProcessed($id: uuid!) {
        update_watched_records_by_pk(pk_columns: {id: $id}, _set: {processed: true}) { id }
      }
    `,
      { id: newRecord.id }
    );

    return res.status(200).json({
      message: `Triggered ${triggeredRuns.length} workflow(s)`,
      triggered: triggeredRuns.length,
      run_ids: triggeredRuns,
    });
  } catch (error: any) {
    console.error('[dbEventTrigger] Error:', error);
    return res.status(500).json({ message: error.message });
  }
};
