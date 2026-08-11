const GQL_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '4kenw@3EsAvX&&!6QRL:nuYO5r%Z)5fV';

async function checkOrgBRuns() {
  const ownerBUserId = '341ffae6-cc31-4caa-a588-9d4179d19316';
  const acmeOrgId = '12368f50-333b-46a1-91c5-44752f04835b';
  const betaOrgId = '7433852f-8f18-481e-8823-7d995ca1020a';

  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      'x-hasura-role': 'user',
      'x-hasura-user-id': ownerBUserId
    },
    body: JSON.stringify({
      query: '{ workflow_runs { id status org_id } }'
    })
  });

  const data = await res.json();
  console.log('Org B user workflow_runs query result:');
  console.log(JSON.stringify(data, null, 2));

  const runs = data.data?.workflow_runs || [];
  const acmeRuns = runs.filter((r: any) => r.org_id === acmeOrgId);
  const betaRuns = runs.filter((r: any) => r.org_id === betaOrgId);
  const otherRuns = runs.filter((r: any) => r.org_id !== acmeOrgId && r.org_id !== betaOrgId);

  console.log(`Summary: total=${runs.length}, Beta Corp=${betaRuns.length}, Acme=${acmeRuns.length}, Other=${otherRuns.length}`);
}

checkOrgBRuns().catch(console.error);
