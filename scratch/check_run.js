const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const HASURA_ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

async function checkStuckRunSteps() {
  const query = `
    query GetStuckRunSteps {
      workflow_runs_by_pk(id: "38eaac05-6c98-4b06-a5c2-543cc7d2cccd") {
        id
        status
        started_at
        completed_at
        created_at
        updated_at
        error
        workflow_id
        trigger_type
      }
      step_runs(where: {workflow_run_id: {_eq: "38eaac05-6c98-4b06-a5c2-543cc7d2cccd"}}) {
        id
        status
        started_at
        completed_at
        created_at
        attempt_count
        error
        workflow_step {
          name
          step_type
          step_order
        }
      }
    }
  `;

  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  console.log('Stuck Run Details:', JSON.stringify(data, null, 2));
}

checkStuckRunSteps().catch(console.error);
