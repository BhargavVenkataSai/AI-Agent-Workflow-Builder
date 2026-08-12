const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const HASURA_ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

async function fixStuckRun() {
  const targetId = '38eaac05-6c98-4b06-a5c2-543cc7d2cccd';
  const nowIso = new Date().toISOString();

  // 1. Mark run as failed
  const mutationRun = `
    mutation FailStuckRun($id: uuid!, $now: timestamptz!) {
      update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {
        status: failed,
        completed_at: $now,
        updated_at: $now,
        error: "Workflow execution timed out (stale run cleanup)"
      }) {
        id
        status
        started_at
        completed_at
      }
    }
  `;

  const resRun = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET
    },
    body: JSON.stringify({ query: mutationRun, variables: { id: targetId, now: nowIso } })
  });
  const dataRun = await resRun.json();
  console.log('Run Cleanup Result:', JSON.stringify(dataRun, null, 2));

  // 2. Mark any pending/running steps as failed
  const mutationSteps = `
    mutation FailStuckSteps($runId: uuid!, $now: timestamptz!) {
      update_step_runs(
        where: {workflow_run_id: {_eq: $runId}, status: {_in: ["pending", "running"]}},
        _set: {status: failed, error: "Step timed out due to stale workflow execution", completed_at: $now}
      ) {
        affected_rows
      }
    }
  `;

  const resSteps = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET
    },
    body: JSON.stringify({ query: mutationSteps, variables: { runId: targetId, now: nowIso } })
  });
  const dataSteps = await resSteps.json();
  console.log('Steps Cleanup Result:', JSON.stringify(dataSteps, null, 2));
}

fixStuckRun().catch(console.error);
