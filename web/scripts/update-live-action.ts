const GQL_METADATA_URL = 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function updateLiveActions() {
  const payload = {
    type: 'bulk',
    args: [
      {
        type: 'update_action',
        args: {
          name: 'triggerWorkflowRun',
          definition: {
            kind: 'synchronous',
            handler: '{{NHOST_FUNCTIONS_URL}}/v1/trigger-workflow-run',
            forward_client_headers: true,
            output_type: 'TriggerWorkflowRunOutput',
            arguments: [
              {
                name: 'workflow_id',
                type: 'uuid!'
              }
            ]
          }
        }
      },
      {
        type: 'update_action',
        args: {
          name: 'approveStep',
          definition: {
            kind: 'synchronous',
            handler: '{{NHOST_FUNCTIONS_URL}}/v1/approve-step',
            forward_client_headers: true,
            output_type: 'ApproveStepOutput',
            arguments: [
              {
                name: 'step_run_id',
                type: 'uuid!'
              }
            ]
          }
        }
      }

    ]
  };

  const res = await fetch(GQL_METADATA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('Update Hasura Action Handlers Response:');
  console.log(JSON.stringify(data, null, 2));
}

updateLiveActions().catch(console.error);
