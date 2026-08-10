const GQL_METADATA_URL = 'https://diurddjlflgkyeeyylcp.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function applyPermissions() {
  const payload = {
    type: 'bulk',
    args: [
      {
        type: 'pg_drop_insert_permission',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'workflow_runs' },
          role: 'user'
        }
      },
      {
        type: 'pg_create_insert_permission',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'workflow_runs' },
          role: 'user',
          permission: {
            columns: [
              'org_id',
              'workflow_id',
              'status',
              'triggered_by',
              'trigger_type',
              'started_at',
              'completed_at',
              'error'
            ],
            check: {
              organization: {
                org_members: {
                  user_id: { _eq: 'X-Hasura-User-Id' },
                  role: { _in: ['owner', 'editor'] }
                }
              }
            }
          }
        }
      }
    ]
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
  console.log('Metadata API Response:', JSON.stringify(resData, null, 2));
}

applyPermissions().catch(console.error);
