const GQL_METADATA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function fetchActionsMetadata() {
  const res = await fetch(GQL_METADATA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({ type: 'export_metadata', args: {} })
  });
  const data = await res.json();
  console.log('Live Actions metadata:');
  console.log(JSON.stringify(data.actions, null, 2));
}

fetchActionsMetadata().catch(console.error);
