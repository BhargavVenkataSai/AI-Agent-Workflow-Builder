import { NextRequest, NextResponse } from 'next/server';

const HASURA_URL =
  process.env.NHOST_GRAPHQL_URL ||
  'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/graphql';
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

// ─── Step executors (same logic as trigger-workflow-run) ───────────
async function executeLlmCall(config: any, input: any, retryCount = 1): Promise<{ success: boolean; output?: any; error?: string }> {
  const provider = config.provider || (OPENROUTER_API_KEY && !GROQ_API_KEY ? 'openrouter' : 'groq');
  const apiKey = provider === 'openrouter' ? OPENROUTER_API_KEY : GROQ_API_KEY;
  const endpoint = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';
  if (!apiKey) return { success: false, error: `API Key for ${provider} not set.` };
  const prompt = applyTemplate(config.prompt || '', input);
  const model = config.model || (provider === 'openrouter' ? 'google/gemini-pro' : 'llama-3.3-70b-versatile');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(provider === 'openrouter' && { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Agent Workflow Builder' }),
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: config.temperature ?? 0.7 }),
    });
    if (!response.ok) { const t = await response.text(); throw new Error(`${provider} API Error: ${response.status} ${t}`); }
    const data = await response.json();
    return { success: true, output: data.choices[0]?.message?.content };
  } catch (error: any) {
    if (retryCount > 0) return executeLlmCall(config, input, retryCount - 1);
    return { success: false, error: error.message };
  }
}

async function executeHttpRequest(config: any, input: any, retryCount = 1): Promise<{ success: boolean; output?: any; error?: string }> {
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
    let resultData; try { resultData = JSON.parse(text); } catch { resultData = text; }
    if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${text}`);
    return { success: true, output: resultData };
  } catch (error: any) {
    if (retryCount > 0) return executeHttpRequest(config, input, retryCount - 1);
    return { success: false, error: error.message };
  }
}

async function executeConditionalBranch(config: any, input: any): Promise<{ success: boolean; output?: any; error?: string }> {
  try {
    const cf = applyTemplate(config.condition || '', input);
    const val = applyTemplate(config.value || '', input);
    const op = config.operator || 'equals';
    let isTrue = false;
    switch (op) {
      case 'equals': isTrue = cf === val; break;
      case 'contains': isTrue = cf.includes(val); break;
      case 'not_contains': isTrue = !cf.includes(val); break;
      case 'greater_than': isTrue = Number(cf) > Number(val); break;
      case 'less_than': isTrue = Number(cf) < Number(val); break;
    }
    return { success: true, output: { branch_taken: isTrue ? 'true' : 'false', should_skip_next: !isTrue } };
  } catch (error: any) { return { success: false, error: error.message }; }
}

// ─── Step run / run status helpers ─────────────────────────────────
async function updateStepRun(id: string, status: string, output?: any, error?: string, extra?: Record<string, any>) {
  const setFields: any = { status };
  if (output !== undefined) setFields.output = output;
  if (error !== undefined) setFields.error = error;
  if (extra) Object.assign(setFields, extra);
  const mutation = `mutation UpSR($id: uuid!, $set: step_runs_set_input! ${status === 'running' ? ', $inc: step_runs_inc_input!' : ''}) {
    update_step_runs_by_pk(pk_columns: {id: $id}, _set: $set ${status === 'running' ? ', _inc: $inc' : ''}) { id status }
  }`;
  const vars: any = {
    id,
    set: {
      status,
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
  const mutation = `mutation UpRS($id: uuid!, $status: run_status_enum! ${isTerminal ? ', $ca: timestamptz!' : ''}) {
    update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: { status: $status ${isTerminal ? ', completed_at: $ca' : ''} }) { id status }
  }`;
  const vars: any = { id, status };
  if (isTerminal) vars.ca = new Date().toISOString();
  await gql(mutation, vars);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function executeWorkflow(workflowRunId: string, startFrom = 0) {
  try {
    const runData = await gql(
      `query GetRun($id: uuid!) { workflow_runs_by_pk(id: $id) { id status
        workflow { id org_id workflow_steps(order_by: {step_order: asc}) { id step_order step_type name config } }
      } }`, { id: workflowRunId }
    );
    const run = runData.workflow_runs_by_pk;
    if (!run) throw new Error(`Run ${workflowRunId} not found`);
    const allSteps = run.workflow.workflow_steps;
    const stepsToRun = allSteps.filter((s: any) => s.step_order >= startFrom);
    let previousOutput: any = null;
    let shouldSkipNext = false;

    if (startFrom > 0) {
      const prevStep = allSteps.find((s: any) => s.step_order === startFrom - 1);
      if (prevStep) {
        const pd = await gql(
          `query PrevSR($rid: uuid!, $sid: uuid!) { step_runs(where: {workflow_run_id: {_eq: $rid}, workflow_step_id: {_eq: $sid}}) { output } }`,
          { rid: workflowRunId, sid: prevStep.id }
        );
        if (pd.step_runs.length > 0) previousOutput = pd.step_runs[0].output;
      }
    }

    for (const step of stepsToRun) {
      const srData = await gql(
        `query FindSR($rid: uuid!, $sid: uuid!) { step_runs(where: {workflow_run_id: {_eq: $rid}, workflow_step_id: {_eq: $sid}}) { id status } }`,
        { rid: workflowRunId, sid: step.id }
      );
      let stepRunId: string;
      if (srData.step_runs.length > 0) { stepRunId = srData.step_runs[0].id; }
      else {
        const n = await gql(`mutation CSR($o: step_runs_insert_input!) { insert_step_runs_one(object: $o) { id } }`,
          { o: { workflow_run_id: workflowRunId, workflow_step_id: step.id, status: 'pending' } });
        stepRunId = n.insert_step_runs_one.id;
      }

      if (shouldSkipNext) { await updateStepRun(stepRunId, 'skipped'); shouldSkipNext = false; continue; }
      await updateStepRun(stepRunId, 'running', undefined, undefined, { started_at: new Date().toISOString() });
      await sleep(800);

      const config = step.config || {};
      const stepInput = { previous_output: previousOutput };
      let result: { success: boolean; output?: any; error?: string } = { success: false, error: 'Unknown step type' };

      switch (step.step_type) {
        case 'llm_call': result = await executeLlmCall(config, stepInput); break;
        case 'http_request': result = await executeHttpRequest(config, stepInput); break;
        case 'conditional_branch':
          result = await executeConditionalBranch(config, stepInput);
          if (result.success && result.output?.should_skip_next) shouldSkipNext = true;
          break;
        case 'approval_gate':
          await updateStepRun(stepRunId, 'awaiting_approval');
          await updateRunStatus(workflowRunId, 'paused');
          return;
        case 'notify':
          await updateStepRun(stepRunId, 'completed', { message: `Notification: ${config.message || 'Workflow notification'}`, channel: config.channel || 'console' });
          previousOutput = { notification_sent: true, message: config.message };
          continue;
        default: result = { success: false, error: `Unknown step type: ${step.step_type}` };
      }

      if (result.success) {
        await updateStepRun(stepRunId, 'completed', result.output, undefined, { completed_at: new Date().toISOString() });
        previousOutput = result.output;
      } else {
        await updateStepRun(stepRunId, 'failed', undefined, result.error, { completed_at: new Date().toISOString() });
        await updateRunStatus(workflowRunId, 'failed');
        return;
      }
    }

    await updateRunStatus(workflowRunId, 'completed');
    await gql(`mutation IncQ($oid: uuid!) { update_organizations_by_pk(pk_columns: {id: $oid}, _inc: {quota_used: 1}) { id } }`, { oid: run.workflow.org_id });
  } catch (error: any) {
    console.error(`[Workflow ${workflowRunId}] Error:`, error);
    try { await updateRunStatus(workflowRunId, 'failed'); } catch {}
  }
}

// ─── Route handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support both direct API call and Hasura Action forwarded call
    const step_run_id = body.input?.step_run_id || body.stepRunId;
    const sessionVars = body.session_variables;
    const userId = sessionVars?.['x-hasura-user-id'] || body.userId;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: No user ID' }, { status: 400 });
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

    // Fire-and-forget: resume from next step
    executeWorkflow(workflowRunId, nextStepOrder).catch((err) =>
      console.error(`[approveStep] Resume error:`, err)
    );

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
