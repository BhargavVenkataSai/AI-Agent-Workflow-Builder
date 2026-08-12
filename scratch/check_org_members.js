const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const HASURA_ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

async function testOrgMembersQuery() {
  const query = `
    query TestOrgMembers {
      organizations(limit: 1) {
        id
        name
        quota_limit
        quota_used
        org_members {
          id
          role
          user_id
          user {
            id
            email
            displayName
          }
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
  console.log('Org Members Query Result:', JSON.stringify(data, null, 2));
}

testOrgMembersQuery().catch(console.error);
