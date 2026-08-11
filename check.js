(async () => {
  const NHOST_URL = 'https://soouvxhgygbxyeooczsu.auth.ap-south-1.nhost.run/v1/signin/email-password';
  const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';

  // 1. Sign in to get JWT
  const authRes = await fetch(NHOST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner_a@test.com', password: 'Test@1234#' })
  });
  
  const authData = await authRes.json();
  if (authData.error) {
    console.log("Auth Error:", authData.error);
    return;
  }
  
  const accessToken = authData.session.accessToken;
  const userId = authData.session.user.id;
  console.log("Logged in! User ID:", userId);

  // 2. Query Hasura with the JWT (exactly as frontend does)
  const gqlRes = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ 
      query: `
        query GetUserOrgs($userId: uuid!) {
          org_members(where: {user_id: {_eq: $userId}}) {
            id
            role
            organization {
              id
              name
            }
          }
        }
      `,
      variables: { userId: userId }
    })
  });
  
  const gqlData = await gqlRes.json();
  console.log("GraphQL Response:", JSON.stringify(gqlData, null, 2));
})();
