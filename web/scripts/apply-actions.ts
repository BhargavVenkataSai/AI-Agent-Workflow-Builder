import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const GQL_METADATA_URL = 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function applyActions() {
  const actionsYamlPath = path.join(__dirname, '../../nhost/metadata/actions.yaml');
  const actionsYaml = fs.readFileSync(actionsYamlPath, 'utf8');
  const actionsMetadata: any = yaml.load(actionsYaml);

  const args = [];
  
  // Set custom types first
  args.push({
    type: 'set_custom_types',
    args: actionsMetadata.custom_types
  });

  // Recreate actions
  const actionsToCreate = [
    {
      name: 'triggerWorkflowRun',
      definition: {
        kind: 'synchronous',
        handler: '{{NHOST_FUNCTIONS_URL}}/v1/trigger-workflow-run',
        forward_client_headers: true,
        arguments: [{ name: 'workflow_id', type: 'uuid!' }],
        output_type: 'TriggerWorkflowRunOutput!'
      },
      permissions: [{ role: 'user' }]
    },
    {
      name: 'approveStep',
      definition: {
        kind: 'synchronous',
        handler: '{{NHOST_FUNCTIONS_URL}}/v1/approve-step',
        forward_client_headers: true,
        arguments: [{ name: 'step_run_id', type: 'uuid!' }],
        output_type: 'ApproveStepOutput!'
      },
      permissions: [{ role: 'user' }]
    },
    {
      name: 'webhookTrigger',
      definition: {
        kind: 'synchronous',
        handler: '{{NHOST_FUNCTIONS_URL}}/v1/webhook-trigger',
        forward_client_headers: true,
        arguments: [
          { name: 'workflow_id', type: 'uuid!' },
          { name: 'payload', type: 'jsonb' }
        ],
        output_type: 'TriggerWorkflowRunOutput!'
      },
      permissions: [{ role: 'user' }]
    }

  ];

  for (const action of actionsToCreate) {
    args.push({
      type: 'drop_action',
      args: { name: action.name, clear_data: false }
    });
    args.push({
      type: 'create_action',
      args: {
        name: action.name,
        definition: action.definition
      }
    });
    for (const p of action.permissions) {
      args.push({
        type: 'create_action_permission',
        args: {
          action: action.name,
          role: p.role
        }
      });
    }
  }

  const payload = {
    type: 'bulk',
    args
  };

  const response = await fetch(GQL_METADATA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET
    },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();
  console.log('Applied Actions Metadata Response:', JSON.stringify(resData, null, 2));
}

applyActions().catch(console.error);
