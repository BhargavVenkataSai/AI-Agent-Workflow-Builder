const GQL_URL = 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function seedBetaCorpData() {
  const betaOrgId = '7433852f-8f18-481e-8823-7d995ca1020a';
  const ownerBUserId = '341ffae6-cc31-4caa-a588-9d4179d19316';

  // 1. Create a workflow in Beta Corp
  const wfRes = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({
      query: `mutation CreateBetaWf($o: workflows_insert_input!) {
        insert_workflows_one(object: $o) { id name org_id }
      }`,
      variables: {
        o: {
          org_id: betaOrgId,
          name: 'Beta Corp Sales Processing',
          description: 'Automated Beta Corp workflow',
          created_by: ownerBUserId,
          is_active: true
        }
      }
    })
  });
  const wfData = await wfRes.json();
  const wfId = wfData.data?.insert_workflows_one?.id;
  console.log('Created Beta Corp workflow:', wfId);

  if (wfId) {
    // 2. Create a step in Beta Corp workflow
    const stepRes = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({
        query: `mutation CreateBetaStep($o: workflow_steps_insert_input!) {
          insert_workflow_steps_one(object: $o) { id }
        }`,
        variables: {
          o: {
            workflow_id: wfId,
            step_order: 1,
            step_type: 'notify',
            name: 'Beta Notification',
            config: { channel: 'email', message: 'Hello Beta' }
          }
        }
      })
    });
    const stepData = await stepRes.json();
    const stepId = stepData.data?.insert_workflow_steps_one?.id;

    // 3. Create a workflow_run in Beta Corp
    const runRes = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({
        query: `mutation CreateBetaRun($o: workflow_runs_insert_input!) {
          insert_workflow_runs_one(object: $o) { id status }
        }`,
        variables: {
          o: {
            org_id: betaOrgId,
            workflow_id: wfId,
            status: 'completed',
            trigger_type: 'manual',
            triggered_by: ownerBUserId,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          }
        }
      })
    });
    const runData = await runRes.json();
    const runId = runData.data?.insert_workflow_runs_one?.id;
    console.log('Created Beta Corp run:', runId);

    if (runId && stepId) {
      // 4. Create a step_run in Beta Corp
      await fetch(GQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
        body: JSON.stringify({
          query: `mutation CreateBetaStepRun($o: step_runs_insert_input!) {
            insert_step_runs_one(object: $o) { id status }
          }`,
          variables: {
            o: {
              workflow_run_id: runId,
              workflow_step_id: stepId,
              status: 'completed',
              output: { notification_sent: true }
            }
          }
        })
      });
      console.log('Created Beta Corp step_run');
    }
  }
}

seedBetaCorpData().catch(console.error);
