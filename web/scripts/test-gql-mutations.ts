import { randomUUID } from 'crypto';

const HASURA_URL = process.env.NHOST_GRAPHQL_URL || 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

// Acme AI Labs owner
const USER_ID = '375d3e53-f368-4191-bffb-f30c6f7c9e62'; 

async function gql(query: string, variables: any = {}) {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      'x-hasura-role': 'user',
      'x-hasura-user-id': USER_ID
    },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

async function run() {
  console.log('--- Testing triggerWorkflowRun ---');
  // Need an existing workflow id from Acme AI Labs
  const wfs = await gql(`query { workflows(limit: 1) { id } }`);
  const wfId = wfs.data?.workflows[0]?.id;
  if (!wfId) {
    console.error('No workflow found to test.');
    return;
  }
  
  const triggerRes = await gql(`
    mutation TriggerWF($id: uuid!) {
      triggerWorkflowRun(workflow_id: $id) {
        workflow_run_id
        status
        message
      }
    }
  `, { id: wfId });
  console.log(JSON.stringify(triggerRes, null, 2));

  console.log('\n--- Testing webhookTrigger ---');
  const webhookRes = await gql(`
    mutation WebhookWF($id: uuid!, $payload: jsonb!) {
      webhookTrigger(workflow_id: $id, payload: $payload) {
        workflow_run_id
        status
        message
      }
    }
  `, { id: wfId, payload: { source: "github", commit: "1234abc" } });
  console.log(JSON.stringify(webhookRes, null, 2));
}

run().catch(console.error);
