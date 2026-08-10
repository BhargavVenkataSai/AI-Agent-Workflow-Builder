const GQL_URL = 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function testActionMutation() {
  const workflowId = '14258f57-7350-45be-86e6-988c26bd14c5'; // AI Content Analysis Pipeline
  const ownerAUserId = '375d3e53-f368-4191-bffb-f30c6f7c9e62';

  const mutation = `
    mutation TriggerRunAction($workflow_id: uuid!) {
      triggerWorkflowRun(workflow_id: $workflow_id) {
        workflow_run_id
        status
        message
      }
    }
  `;

  console.log('Sending Hasura Action GraphQL mutation triggerWorkflowRun...');
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      'x-hasura-role': 'user',
      'x-hasura-user-id': ownerAUserId
    },
    body: JSON.stringify({
      query: mutation,
      variables: { workflow_id: workflowId }
    })
  });

  const data = await res.json();
  console.log('GraphQL Mutation Response:');
  console.log(JSON.stringify(data, null, 2));
}

testActionMutation().catch(console.error);
