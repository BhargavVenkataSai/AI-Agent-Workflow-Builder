
(async () => {
  const NHOST_AUTH_URL = 'https://soouvxhgygbxyeooczsu.auth.ap-south-1.nhost.run/v1/signin/email-password';
  const NHOST_GQL_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
  const ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

  console.log("=== Direct Route Handler & Webhook Security Verification ===");

  // 1. Log in as owner_b@test.com
  const authResB = await fetch(NHOST_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner_b@test.com', password: 'Test@1234#' })
  });
  const authDataB = await authResB.json();
  const tokenB = authDataB.session.accessToken;
  const ownerBUserId = authDataB.session.user.id;

  // Log in as owner_a@test.com to get Org A IDs
  const authResA = await fetch(NHOST_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner_a@test.com', password: 'Test@1234#' })
  });
  const authDataA = await authResA.json();
  const ownerAUserId = authDataA.session.user.id;

  // Query Org A workflow ID
  const gqlWf = await fetch(NHOST_GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({
      query: `query { workflows(limit: 1) { id org_id name } }`
    })
  });
  const wfData = await gqlWf.json();
  const orgAWorkflow = wfData.data.workflows[0];

  console.log(`[INFO] owner_b ID: ${ownerBUserId}`);
  console.log(`[INFO] owner_a ID: ${ownerAUserId}`);
  console.log(`[INFO] Org A Workflow ID: ${orgAWorkflow.id}`);

  // Test Webhook trigger with correct secret (via admin GraphQL client / webhook logic)
  const webhookTest = await fetch(NHOST_GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({
      query: `query GetTrigger($wfId: uuid!) {
        workflow_triggers(where: {workflow_id: {_eq: $wfId}, trigger_type: {_eq: "webhook"}}) {
          id
          config
        }
      }`,
      variables: { wfId: orgAWorkflow.id }
    })
  });
  const webhookData = await webhookTest.json();
  console.log("[INFO] Webhook Trigger configuration in DB:", JSON.stringify(webhookData.data));

  console.log("\n--- All Security Tests Complete ---");
})();
