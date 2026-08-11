const GQL_METADATA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function fixRowLevelPermissions() {
  const payload = {
    type: 'bulk',
    args: [
      // 1. Fix workflow_runs select_permission
      {
        type: 'pg_drop_select_permission',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'workflow_runs' },
          role: 'user'
        }
      },
      {
        type: 'pg_create_select_permission',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'workflow_runs' },
          role: 'user',
          permission: {
            columns: '*',
            filter: {
              organization: {
                org_members: {
                  user_id: { _eq: 'X-Hasura-User-Id' }
                }
              }
            }
          }
        }
      },

      // 2. Fix step_runs select_permission
      {
        type: 'pg_drop_select_permission',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'step_runs' },
          role: 'user'
        }
      },
      {
        type: 'pg_create_select_permission',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'step_runs' },
          role: 'user',
          permission: {
            columns: '*',
            filter: {
              workflow_run: {
                organization: {
                  org_members: {
                    user_id: { _eq: 'X-Hasura-User-Id' }
                  }
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
  console.log('Fixed RLP Permissions Response:', JSON.stringify(resData, null, 2));
}

fixRowLevelPermissions().catch(console.error);
