import { NextRequest, NextResponse } from 'next/server';

const HASURA_URL =
  process.env.NHOST_GRAPHQL_URL ||
  'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET =
  process.env.NHOST_ADMIN_SECRET ||
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
  '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// ─── Hasura admin client ───────────────────────────────────────────
async function gql(query: string, variables: Record<string, any> = {}) {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join(', '));
  return data.data;
}

// ─── Template helpers ──────────────────────────────────────────────
function applyTemplate(template: string, input: any): string {
  if (!template) return template;
  let result = template;
  result = result.replace(
    /\{\{previous_output\}\}/g,
    typeof input === 'string' ? input : JSON.stringify(input)
  );
  result = result.replace(/\{\{step_output\.([a-zA-Z0-9_]+)\}\}/g, (_m, f) =>
    input && input[f] !== undefined ? String(input[f]) : ''
  );
  return result;
}

// ─── Step executors (inline to avoid cross-package imports) ────────
async function executeLlmCall(
  config: any,
  input: any,
  retryCount = 1
): Promise<{ success: boolean; output?: any; error?: string }> {
  const provider =
    config.provider || (OPENROUTER_API_KEY && !GROQ_API_KEY ? 'openrouter' : 'groq');
  const apiKey = provider === 'openrouter' ? OPENROUTER_API_KEY : GROQ_API_KEY;
  const endpoint =
    provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';

  if (!apiKey)
    return {
      success: false,
      error: `API Key for ${provider} not set.`,
    };

  const prompt = applyTemplate(config.prompt || '', input);
  const model =
    config.model ||
    (provider === 'openrouter' ? 'google/gemini-pro' : 'llama-3.3-70b-versatile');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(provider === 'openrouter' && {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Agent Workflow Builder',
        }),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${provider} API Error: ${response.status} ${errText}`);
    }
    const data = await response.json();
    return { success: true, output: data.choices[0]?.message?.content };
  } catch (error: any) {
    if (retryCount > 0) return executeLlmCall(config, input, retryCount - 1);
    return { success: false, error: error.message };
  }
}

async function executeHttpRequest(
  config: any,
  input: any,
  retryCount = 1
): Promise<{ success: boolean; output?: any; error?: string }> {
  const url = applyTemplate(config.url || '', input);
  const method = config.method || 'GET';
  const body = config.body ? applyTemplate(config.body, input) : undefined;
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
      body: method !== 'GET' && method !== 'HEAD' && body ? body : undefined,
    });
    const text = await response.text();
    let resultData;
    try { resultData = JSON.parse(text); } catch { resultData = text; }
    if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${text}`);
    return { success: true, output: resultData };
  } catch (error: any) {
    if (retryCount > 0) return executeHttpRequest(config, input, retryCount - 1);
    return { success: false, error: error.message };
  }
}

async function executeDbWrite(
  config: any,
  input: any
): Promise<{ success: boolean; output?: any; error?: string }> {
  try {
    const table = config.table;
    let dataStr = JSON.stringify(config.data || {});
    dataStr = applyTemplate(dataStr, input);
    const data = JSON.parse(dataStr);
    const mutation = `
      mutation insert_${table}($objects: [${table}_insert_input!]!) {
        insert_${table}(objects: $objects) { returning { id } }
      }`;
    const result = await gql(mutation, { objects: [data] });
    return { success: true, output: result[`insert_${table}`].returning };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function executeConditionalBranch(
  config: any,
  input: any
): Promise<{ success: boolean; output?: any; error?: string }> {
  try {
    const conditionField = applyTemplate(config.condition || '', input);
    const value = applyTemplate(config.value || '', input);
    const operator = config.operator || 'equals';
    let isTrue = false;
    switch (operator) {
      case 'equals':       isTrue = conditionField === value; break;
      case 'contains':     isTrue = conditionField.includes(value); break;
      case 'not_contains': isTrue = !conditionField.includes(value); break;
      case 'greater_than': isTrue = Number(conditionField) > Number(value); break;
      case 'less_than':    isTrue = Number(conditionField) < Number(value); break;
    }
    return { success: true, output: { branch_taken: isTrue ? 'true' : 'false', should_skip_next: !isTrue } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Workflow engine (self-contained) ──────────────────────────────
async function updateStepRun(
  id: string,
  status: string,
  output?: any,
  error?: string,
  extra?: Record<string, any>
) {
  const setFields: any = { status };
  if (output !== undefined) setFields.output = output;
  if (error !== undefined) setFields.error = error;
  if (extra) Object.assign(setFields, extra);

  const mutation = `
    mutation UpdateStepRun($id: uuid!, $set: step_runs_set_input!
      ${status === 'running' ? ', $inc: step_runs_inc_input!' : ''}
    ) {
      update_step_runs_by_pk(pk_columns: {id: $id}, _set: $set
        ${status === 'running' ? ', _inc: $inc' : ''}
      ) { id status }
    }`;
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
  if (status === 'running') vars.inc = { attempt_count: 1 };
  await gql(mutation, vars);
}

async function updateRunStatus(id: string, status: string) {
  const isTerminal = status === 'completed' || status === 'failed';
  const mutation = `
    mutation UpRunStatus($id: uuid!, $status: run_status_enum!
      ${isTerminal ? ', $completedAt: timestamptz!' : ''}
    ) {
      update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {
        status: $status ${isTerminal ? ', completed_at: $completedAt' : ''}
      }) { id status }
    }`;
  const vars: any = { id, status };
  if (isTerminal) vars.completedAt = new Date().toISOString();
  await gql(mutation, vars);
}

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function executeWorkflow(workflowRunId: string, startFrom = 0, initialPayload: any = null) {
  try {
    const runData = await gql(
      `query GetRun($id: uuid!) {
        workflow_runs_by_pk(id: $id) { id status
          workflow { id org_id
            workflow_steps(order_by: {step_order: asc}) { id step_order step_type name config }
          }
        }
      }`,
      { id: workflowRunId }
    );
    const run = runData.workflow_runs_by_pk;
    if (!run) throw new Error(`Run ${workflowRunId} not found`);

    const allSteps = run.workflow.workflow_steps;
    const stepsToRun = allSteps.filter((s: any) => s.step_order >= startFrom);
    let previousOutput: any = initialPayload;
    let shouldSkipNext = false;

    if (startFrom > 0) {
      const prevStep = allSteps.find((s: any) => s.step_order === startFrom - 1);
      if (prevStep) {
        const pd = await gql(
          `query PrevSR($runId: uuid!, $stepId: uuid!) {
            step_runs(where: {workflow_run_id: {_eq: $runId}, workflow_step_id: {_eq: $stepId}}) { output }
          }`,
          { runId: workflowRunId, stepId: prevStep.id }
        );
        if (pd.step_runs.length > 0) previousOutput = pd.step_runs[0].output;
      }
    }

    for (const step of stepsToRun) {
      const srData = await gql(
        `query FindSR($runId: uuid!, $stepId: uuid!) {
          step_runs(where: {workflow_run_id: {_eq: $runId}, workflow_step_id: {_eq: $stepId}}) { id status }
        }`,
        { runId: workflowRunId, stepId: step.id }
      );
      let stepRunId: string;
      if (srData.step_runs.length > 0) {
        stepRunId = srData.step_runs[0].id;
      } else {
        const newSr = await gql(
          `mutation CreateSR($o: step_runs_insert_input!) { insert_step_runs_one(object: $o) { id } }`,
          { o: { workflow_run_id: workflowRunId, workflow_step_id: step.id, status: 'pending' } }
        );
        stepRunId = newSr.insert_step_runs_one.id;
      }

      if (shouldSkipNext) {
        await updateStepRun(stepRunId, 'skipped');
        shouldSkipNext = false;
        continue;
      }

      await updateStepRun(stepRunId, 'running', undefined, undefined, { started_at: new Date().toISOString() });
      await sleep(800);

      const config = step.config || {};
      const stepInput = { previous_output: previousOutput };
      let result: { success: boolean; output?: any; error?: string } = { success: false, error: 'Unknown step type' };

      switch (step.step_type) {
        case 'llm_call':           result = await executeLlmCall(config, stepInput); break;
        case 'http_request':       result = await executeHttpRequest(config, stepInput); break;
        case 'db_write':           result = await executeDbWrite(config, stepInput); break;
        case 'conditional_branch':
          result = await executeConditionalBranch(config, stepInput);
          if (result.success && result.output?.should_skip_next) shouldSkipNext = true;
          break;
        case 'approval_gate':
          console.log(`[Workflow ${workflowRunId}] Pausing at approval gate "${step.name}"`);
          await updateStepRun(stepRunId, 'awaiting_approval');
          await updateRunStatus(workflowRunId, 'paused');
          return; // STOP — resumed by approveStep
        case 'notify':
          await updateStepRun(stepRunId, 'completed', {
            message: `Notification sent: ${config.message || 'Workflow notification'}`,
            channel: config.channel || 'console',
          });
          previousOutput = { notification_sent: true, message: config.message };
          continue;
        default:
          result = { success: false, error: `Unknown step type: ${step.step_type}` };
      }

      if (result.success) {
        await updateStepRun(stepRunId, 'completed', result.output, undefined, { completed_at: new Date().toISOString() });
        previousOutput = result.output;
      } else {
        await updateStepRun(stepRunId, 'failed', undefined, result.error, { completed_at: new Date().toISOString() });
        await updateRunStatus(workflowRunId, 'failed');
        console.error(`[Workflow ${workflowRunId}] Step "${step.name}" failed: ${result.error}`);
        return;
      }
    }

    await updateRunStatus(workflowRunId, 'completed');
    console.log(`[Workflow ${workflowRunId}] Completed.`);
  } catch (error: any) {
    console.error(`[Workflow ${workflowRunId}] Execution error:`, error);
    try { await updateRunStatus(workflowRunId, 'failed'); } catch {}
  }
}

// ─── Route handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support both direct API call and Hasura Action forwarded call
    const workflow_id = body.input?.workflow_id || body.workflow_id;
    const payload = body.input?.payload || body.payload || {};
    const sessionVars = body.session_variables;
    // From Hasura Action forward OR from direct frontend call
    const userId = sessionVars?.['x-hasura-user-id'] || body.userId;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: No user ID' }, { status: 400 });
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
          trigger_type: 'webhook',
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

    // Fire-and-forget async execution
    executeWorkflow(workflowRunId, 0, payload).catch((err) =>
      console.error(`[webhookTrigger] Async error for ${workflowRunId}:`, err)
    );

    console.log(
      `[webhookTrigger] Started run ${workflowRunId} for workflow ${workflow_id} by user ${userId} with payload`, payload
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
