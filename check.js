
(async () => {
  const HASURA_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
  const ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

  // Run as user
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      'x-hasura-role': 'user',
      'x-hasura-user-id': '676e9574-3840-4f9b-8d40-093e436042c2'
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
      variables: {
        userId: "676e9574-3840-4f9b-8d40-093e436042c2"
      }
    })
  });
  
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
})();
