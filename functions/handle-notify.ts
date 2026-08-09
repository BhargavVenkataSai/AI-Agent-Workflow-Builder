import type { Request, Response } from 'express';
import { queryHasura, mutateHasura } from './_lib/hasura-client';

/**
 * Event Trigger handler for notify steps.
 * Called when step_runs are updated — checks if it's a notify step
 * that needs to send a notification.
 *
 * In production this would send Slack/email; for demo it logs to console
 * and updates the step_run output.
 */
export default async (req: Request, res: Response) => {
  try {
    const event = req.body?.event;
    if (!event || !event.data || !event.data.new) {
      return res.status(400).json({ message: 'No event data' });
    }

    const newData = event.data.new;
    const stepRunId = newData.id;

    // Only process step_runs that are in 'running' status
    if (newData.status !== 'running') {
      return res.status(200).json({ message: 'Skipped: not a running step' });
    }

    // Fetch the step details to check if it's a notify step
    const query = `
      query GetStepRunForNotify($id: uuid!) {
        step_runs_by_pk(id: $id) {
          id
          workflow_step {
            step_type
            name
            config
          }
          workflow_run {
            id
            workflow {
              name
              organization {
                name
              }
            }
          }
        }
      }
    `;

    const data = await queryHasura(query, { id: stepRunId });
    const stepRun = data.step_runs_by_pk;

    if (!stepRun || stepRun.workflow_step?.step_type !== 'notify') {
      return res.status(200).json({ message: 'Skipped: not a notify step' });
    }

    const config = stepRun.workflow_step.config || {};
    const workflowName = stepRun.workflow_run?.workflow?.name || 'Unknown';
    const orgName = stepRun.workflow_run?.workflow?.organization?.name || 'Unknown';
    const channel = config.channel || 'console';
    const message = config.message || `Notification from workflow: ${workflowName}`;

    // "Send" notification (console log for demo)
    console.log(`\n========== NOTIFICATION ==========`);
    console.log(`Organization: ${orgName}`);
    console.log(`Workflow: ${workflowName}`);
    console.log(`Channel: ${channel}`);
    console.log(`Message: ${message}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`==================================\n`);

    // Update step_run as completed with notification details
    await mutateHasura(
      `
      mutation CompleteNotifyStep($id: uuid!, $output: jsonb!) {
        update_step_runs_by_pk(
          pk_columns: {id: $id},
          _set: {
            status: completed,
            output: $output,
            completed_at: "now()"
          }
        ) {
          id
        }
      }
    `,
      {
        id: stepRunId,
        output: {
          notification_sent: true,
          channel,
          message,
          sent_at: new Date().toISOString(),
        },
      }
    );

    return res.status(200).json({
      message: 'Notification processed',
      channel,
    });
  } catch (error: any) {
    console.error('[handleNotify] Error:', error);
    return res.status(500).json({ message: error.message });
  }
};
