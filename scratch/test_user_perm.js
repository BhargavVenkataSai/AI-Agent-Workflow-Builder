const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const HASURA_ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

async function testCleanUserOrgsQuery() {
  const queryClean = `
    query GetUserOrgs($userId: uuid!) {
      org_members(where: {user_id: {_eq: $userId}}) {
        id
        role
        organization {
          id
          name
          slug
          quota_limit
          quota_used
        }
      }
    }
  `;

  const ownerAId = '676e9574-3840-4f9b-8d40-093e436042c2';

  const resUserRole = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      'x-hasura-role': 'user',
      'x-hasura-user-id': ownerAId
    },
    body: JSON.stringify({ query: queryClean, variables: { userId: ownerAId } })
  });

  const dataUserRole = await resUserRole.json();
  console.log('Query Result with clean GET_USER_ORGS:', JSON.stringify(dataUserRole, null, 2));
}

testCleanUserOrgsQuery().catch(console.error);
