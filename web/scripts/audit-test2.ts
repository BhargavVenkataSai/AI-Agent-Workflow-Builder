const GQL_URL = 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/graphql';
const AUTH_URL = 'https://diurddjlflgkyeeyylcp.auth.ap-south-1.nhost.run/v1';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function runAudit() {
  console.log('=== AUDIT TEST 2: Cross-Org Data Isolation Verification ===\n');

  // 1. Authenticate owner_b@test.com via Nhost Auth API to get real JWT
  let token = '';
  try {
    const authRes = await fetch(`${AUTH_URL}/signin/email-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner_b@test.com', password: 'Test1234!' })
    });
    const authData = await authRes.json();
    token = authData.session?.accessToken || '';
    console.log('Nhost Auth JWT login status:', authRes.status);
    if (token) console.log('Obtained real JWT for owner_b@test.com (starts with:', token.substring(0, 30) + '...)');
  } catch (e: any) {
    console.log('Auth login failed:', e.message);
  }

  // 2. Prepare headers for Hasura session query
  const ownerBUserId = '341ffae6-cc31-4caa-a588-9d4179d19316';
  const headersWithJwt: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  const headersWithSessionVars: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': ADMIN_SECRET,
    'x-hasura-role': 'user',
    'x-hasura-user-id': ownerBUserId
  };

  const activeHeaders = token ? headersWithJwt : headersWithSessionVars;
  console.log('GraphQL Client Headers used for TEST 2 query:');
  console.log(JSON.stringify(activeHeaders, null, 2));

  // -------------------------------------------------------------------
  // QUESTION 1 & 2: workflow_runs query
  // -------------------------------------------------------------------
  const workflowRunsQueryText = `{
    workflow_runs {
      id
      status
      org_id
      organization {
        name
      }
    }
  }`;
  console.log('\n--- Q1: Literal GraphQL Query for workflow_runs ---');
  console.log(workflowRunsQueryText);

  const wfRunsRes = await fetch(GQL_URL, {
    method: 'POST',
    headers: activeHeaders,
    body: JSON.stringify({ query: workflowRunsQueryText })
  });
  const wfRunsData = await wfRunsRes.json();

  console.log('\n--- Q2: Literal Output of returned workflow_runs rows for owner_b ---');
  console.log(JSON.stringify(wfRunsData, null, 2));

  const wfRuns = wfRunsData.data?.workflow_runs || [];
  const wfGrouped: Record<string, number> = {};
  wfRuns.forEach((r: any) => {
    const key = `${r.org_id} (${r.organization?.name || 'Unknown'})`;
    wfGrouped[key] = (wfGrouped[key] || 0) + 1;
  });
  console.log('\n--- Q2 Summary: GROUP BY org_id for workflow_runs ---');
  console.log(JSON.stringify(wfGrouped, null, 2));

  // -------------------------------------------------------------------
  // QUESTION 6: step_runs query
  // -------------------------------------------------------------------
  const stepRunsQueryText = `{
    step_runs {
      id
      status
      workflow_run {
        id
        org_id
        organization {
          name
        }
      }
    }
  }`;
  console.log('\n--- Q6: Literal GraphQL Query for step_runs ---');
  console.log(stepRunsQueryText);

  const stepRunsRes = await fetch(GQL_URL, {
    method: 'POST',
    headers: activeHeaders,
    body: JSON.stringify({ query: stepRunsQueryText })
  });
  const stepRunsData = await stepRunsRes.json();

  console.log('\n--- Q6: Literal Output of returned step_runs rows for owner_b ---');
  console.log(JSON.stringify(stepRunsData, null, 2));

  const stepRuns = stepRunsData.data?.step_runs || [];
  const stepGrouped: Record<string, number> = {};
  stepRuns.forEach((sr: any) => {
    const key = `${sr.workflow_run?.org_id} (${sr.workflow_run?.organization?.name || 'Unknown'})`;
    stepGrouped[key] = (stepGrouped[key] || 0) + 1;
  });
  console.log('\n--- Q6 Summary: GROUP BY org_id for step_runs ---');
  console.log(JSON.stringify(stepGrouped, null, 2));
}

runAudit().catch(console.error);
