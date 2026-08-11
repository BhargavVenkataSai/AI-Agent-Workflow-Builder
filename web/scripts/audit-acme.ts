const GQL_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const AUTH_URL = 'https://soouvxhgygbxyeooczsu.auth.ap-south-1.nhost.run/v1';

async function runAcmeAudit() {
  console.log('=== AUDIT ACME USER: Bidirectional Isolation Verification ===\n');

  // 1. Authenticate owner_a@test.com via Nhost Auth API to get real JWT
  const authRes = await fetch(`${AUTH_URL}/signin/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner_a@test.com', password: 'Test1234!' })
  });
  const authData = await authRes.json();
  const token = authData.session?.accessToken;
  console.log('Nhost Auth JWT login status for owner_a@test.com:', authRes.status);
  console.log('User ID:', authData.session?.user?.id);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Query workflow_runs as owner_a
  const wfQuery = `{
    workflow_runs {
      id
      status
      org_id
      organization {
        name
      }
    }
  }`;
  const wfRes = await fetch(GQL_URL, { method: 'POST', headers, body: JSON.stringify({ query: wfQuery }) });
  const wfData = await wfRes.json();
  const wfRuns = wfData.data?.workflow_runs || [];

  const wfGrouped: Record<string, number> = {};
  wfRuns.forEach((r: any) => {
    const key = `${r.org_id} (${r.organization?.name || 'Unknown'})`;
    wfGrouped[key] = (wfGrouped[key] || 0) + 1;
  });

  console.log('\n--- workflow_runs returned for owner_a (Acme AI Labs) ---');
  console.log(`Total rows returned: ${wfRuns.length}`);
  console.log('GROUP BY org_id:');
  console.log(JSON.stringify(wfGrouped, null, 2));

  // 3. Query step_runs as owner_a
  const stepQuery = `{
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
  const stepRes = await fetch(GQL_URL, { method: 'POST', headers, body: JSON.stringify({ query: stepQuery }) });
  const stepData = await stepRes.json();
  const stepRuns = stepData.data?.step_runs || [];

  const stepGrouped: Record<string, number> = {};
  stepRuns.forEach((sr: any) => {
    const key = `${sr.workflow_run?.org_id} (${sr.workflow_run?.organization?.name || 'Unknown'})`;
    stepGrouped[key] = (stepGrouped[key] || 0) + 1;
  });

  console.log('\n--- step_runs returned for owner_a (Acme AI Labs) ---');
  console.log(`Total rows returned: ${stepRuns.length}`);
  console.log('GROUP BY org_id:');
  console.log(JSON.stringify(stepGrouped, null, 2));

  const betaOrgId = '7433852f-8f18-481e-8823-7d995ca1020a';
  const leakedBetaWfRuns = wfRuns.filter((r: any) => r.org_id === betaOrgId);
  const leakedBetaStepRuns = stepRuns.filter((sr: any) => sr.workflow_run?.org_id === betaOrgId);

  console.log(`\nBidirectional Check Result: Beta Corp runs visible to Acme owner = ${leakedBetaWfRuns.length}, Beta Corp step_runs visible to Acme owner = ${leakedBetaStepRuns.length}`);
}

runAcmeAudit().catch(console.error);
