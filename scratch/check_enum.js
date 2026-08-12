const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const HASURA_ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

async function testCancelStatus() {
  // Test updating status to failed vs cancelled vs canceled
  const testRunId = '7fc9ae3d-c620-4bfe-a92a-1d26022cf102';

  for (const statusVal of ['failed', 'cancelled', 'canceled']) {
    const query = `
      mutation TestStatus($id: uuid!, $status: run_status_enum!) {
        update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {status: $status}) {
          id
          status
        }
      }
    `;
    const res = await fetch(HASURA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET
      },
      body: JSON.stringify({ query, variables: { id: testRunId, status: statusVal } })
    });
    const data = await res.json();
    console.log(`Testing status '${statusVal}':`, JSON.stringify(data));
  }
}

testCancelStatus().catch(console.error);
