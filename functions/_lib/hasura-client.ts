export async function queryHasura(query: string, variables: Record<string, any> = {}) {
  const hasuraUrl =
    process.env.NHOST_GRAPHQL_URL ||
    process.env.NHOST_HASURA_URL ||
    process.env.HASURA_GRAPHQL_URL ||
    'http://localhost:1337/v1/graphql';
  
  const adminSecret =
    process.env.NHOST_ADMIN_SECRET ||
    process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
    '';

  const response = await fetch(hasuraUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const data = await response.json();
  if (data.errors) {
    console.error('Hasura GraphQL Errors:', data.errors);
    throw new Error(data.errors.map((e: any) => e.message).join(', '));
  }

  return data.data;
}

export async function mutateHasura(mutation: string, variables: Record<string, any> = {}) {
  return queryHasura(mutation, variables);
}
