const GQL_METADATA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function fetchLiveMetadata() {
  const res = await fetch(GQL_METADATA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({ type: 'export_metadata', args: {} })
  });
  const data = await res.json();
  
  console.log('Top level keys:', Object.keys(data));
  console.log('Databases:', data.resource_version, data.metadata?.databases?.map((d: any) => d.name));
  const tables = data.sources?.[0]?.tables || [];
  console.log('Table names:', tables.map((t: any) => t.table?.name || t.table));
  const wfRunTable = tables.find((t: any) => (t.table?.name || t.table) === 'workflow_runs');
  console.log('Live metadata for workflow_runs table:', JSON.stringify(wfRunTable, null, 2));

  const stepRunTable = tables.find((t: any) => t.table.name === 'step_runs');
  console.log('\nLive metadata for step_runs table:');
  console.log(JSON.stringify(stepRunTable, null, 2));
}

fetchLiveMetadata().catch(console.error);
