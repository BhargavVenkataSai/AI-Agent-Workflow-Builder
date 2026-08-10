import { queryHasura, mutateHasura } from './hasura-client';
import {
  executeLlmCall,
  executeHttpRequest,
  executeDbWrite,
  executeConditionalBranch,
} from './step-executors';

interface StepRunResult {
  success: boolean;
  output?: any;
  error?: string;
}

/**
 * Main workflow execution engine.
 * Executes steps sequentially, handles approval gates (pause),
 * conditional branches (skip), retries, and quota tracking.
 */
export async function executeWorkflow(
  workflowRunId: string,
  startFromStepOrder: number = 0
) {
  try {
    // Fetch workflow run with steps and existing step_runs
    const getRunQuery = `
      query GetRunForExecution($id: uuid!) {
        workflow_runs_by_pk(id: $id) {
          id
          status
          workflow {
            id
            org_id
            workflow_steps(order_by: {step_order: asc}) {
              id
              step_order
              step_type
              name
              config
            }
          }
        }
      }
    `;

    const runData = await queryHasura(getRunQuery, { id: workflowRunId });
    const run = runData.workflow_runs_by_pk;

    if (!run) {
      throw new Error(`Workflow run ${workflowRunId} not found`);
    }

    const workflow = run.workflow;
    const allSteps = workflow.workflow_steps;

    // Filter to steps we need to execute
    const stepsToRun = allSteps.filter(
      (s: any) => s.step_order >= startFromStepOrder
    );

    let previousOutput: any = null;
    let shouldSkipNext = false;

    // If resuming, get output from the step right before startFromStepOrder
    if (startFromStepOrder > 0) {
      const prevStep = allSteps.find(
        (s: any) => s.step_order === startFromStepOrder - 1
      );
      if (prevStep) {
        const prevStepRunQuery = `
          query GetPreviousStepRun($runId: uuid!, $stepId: uuid!) {
            step_runs(where: {
              workflow_run_id: {_eq: $runId},
              workflow_step_id: {_eq: $stepId}
            }) {
              output
            }
          }
        `;
        const prevData = await queryHasura(prevStepRunQuery, {
          runId: workflowRunId,
          stepId: prevStep.id,
        });
        if (prevData.step_runs.length > 0) {
          previousOutput = prevData.step_runs[0].output;
        }
      }
    }

    for (const step of stepsToRun) {
      // Find existing step_run for this step
      const findStepRunQuery = `
        query FindStepRun($runId: uuid!, $stepId: uuid!) {
          step_runs(where: {
            workflow_run_id: {_eq: $runId},
            workflow_step_id: {_eq: $stepId}
          }) {
            id
            status
          }
        }
      `;
      const srData = await queryHasura(findStepRunQuery, {
        runId: workflowRunId,
        stepId: step.id,
      });

      let stepRunId: string;
      if (srData.step_runs.length > 0) {
        stepRunId = srData.step_runs[0].id;
      } else {
        // Create step_run if it doesn't exist
        const createSrMutation = `
          mutation CreateStepRun($object: step_runs_insert_input!) {
            insert_step_runs_one(object: $object) {
              id
            }
          }
        `;
        const newSr = await mutateHasura(createSrMutation, {
          object: {
            workflow_run_id: workflowRunId,
            workflow_step_id: step.id,
            status: 'pending',
          },
        });
        stepRunId = newSr.insert_step_runs_one.id;
      }

      // Handle skip from conditional branch
      if (shouldSkipNext) {
        await updateStepRun(stepRunId, 'skipped');
        shouldSkipNext = false;
        continue;
      }

      // Mark step as running
      await updateStepRun(stepRunId, 'running', undefined, undefined, {
        started_at: new Date().toISOString(),
      });

      // Add artificial delay for UI visibility
      await sleep(800);

      const config = step.config || {};
      const stepInput = { previous_output: previousOutput };
      let result: StepRunResult = { success: false, error: 'Unknown step type' };

      // Execute based on step type
      switch (step.step_type) {
        case 'llm_call':
          result = await executeLlmCall(config, stepInput);
          break;

        case 'http_request':
          result = await executeHttpRequest(config, stepInput);
          break;

        case 'db_write':
          result = await executeDbWrite(config, stepInput);
          break;

        case 'conditional_branch':
          result = await executeConditionalBranch(config, stepInput);
          if (result.success && result.output?.should_skip_next) {
            shouldSkipNext = true;
          }
          break;

        case 'approval_gate':
          // Pause the workflow
          console.log(`[Workflow ${workflowRunId}] Pausing at approval gate step ${step.name}`);
          await updateStepRun(stepRunId, 'awaiting_approval');
          await updateWorkflowRunStatus(workflowRunId, 'paused');
          return; // STOP execution — will be resumed by approveStep action

        case 'notify':
          // Mark as completed — event trigger handles actual notification
          await updateStepRun(stepRunId, 'completed', {
            message: `Notification sent: ${config.message || 'Workflow notification'}`,
            channel: config.channel || 'console',
          });
          previousOutput = { notification_sent: true, message: config.message };
          continue;

        default:
          result = { success: false, error: `Unknown step type: ${step.step_type}` };
      }

      // Process result
      if (result.success) {
        await updateStepRun(stepRunId, 'completed', result.output, undefined, {
          completed_at: new Date().toISOString(),
        });
        previousOutput = result.output;
      } else {
        await updateStepRun(stepRunId, 'failed', undefined, result.error, {
          completed_at: new Date().toISOString(),
        });
        await updateWorkflowRunStatus(workflowRunId, 'failed');
        console.error(`[Workflow ${workflowRunId}] Step "${step.name}" failed: ${result.error}`);
        return;
      }
    }

    // All steps completed successfully
    await updateWorkflowRunStatus(workflowRunId, 'completed');
    console.log(`[Workflow ${workflowRunId}] Completed successfully for org ${workflow.org_id}.`);


  } catch (error: any) {
    console.error(`[Workflow ${workflowRunId}] Execution error:`, error);
    try {
      await updateWorkflowRunStatus(workflowRunId, 'failed');
    } catch (updateErr) {
      console.error('Failed to update workflow run status to failed:', updateErr);
    }
  }
}

/**
 * Update a step_run's status, output, error, and additional fields.
 */
async function updateStepRun(
  id: string,
  status: string,
  output?: any,
  error?: string,
  extraFields?: Record<string, any>
) {
  const setFields: any = { status };
  if (output !== undefined) setFields.output = output;
  if (error !== undefined) setFields.error = error;
  if (status === 'running') setFields.attempt_count_inc = true;
  if (extraFields) Object.assign(setFields, extraFields);

  // Build the mutation dynamically to handle attempt_count increment
  const mutation = `
    mutation UpdateStepRun(
      $id: uuid!,
      $set: step_runs_set_input!
      ${status === 'running' ? ', $inc: step_runs_inc_input!' : ''}
    ) {
      update_step_runs_by_pk(
        pk_columns: {id: $id},
        _set: $set
        ${status === 'running' ? ', _inc: $inc' : ''}
      ) {
        id
        status
      }
    }
  `;

  const vars: any = {
    id,
    set: {
      status: setFields.status,
      ...(setFields.output !== undefined && { output: setFields.output }),
      ...(setFields.error !== undefined && { error: setFields.error }),
      ...(setFields.started_at && { started_at: setFields.started_at }),
      ...(setFields.completed_at && { completed_at: setFields.completed_at }),
    },
  };
  if (status === 'running') {
    vars.inc = { attempt_count: 1 };
  }

  await mutateHasura(mutation, vars);
}

async function updateWorkflowRunStatus(id: string, status: string) {
  const isTerminal = status === 'completed' || status === 'failed';
  
  const mutation = `
    mutation UpdateWorkflowRunStatus(
      $id: uuid!, 
      $status: run_status_enum!
      ${isTerminal ? ', $completedAt: timestamptz!' : ''}
    ) {
      update_workflow_runs_by_pk(
        pk_columns: {id: $id},
        _set: {
          status: $status
          ${isTerminal ? ', completed_at: $completedAt' : ''}
        }
      ) {
        id
        status
      }
    }
  `;
  
  const vars: any = { id, status };
  if (isTerminal) {
    vars.completedAt = new Date().toISOString();
  }
  
  await mutateHasura(mutation, vars);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
