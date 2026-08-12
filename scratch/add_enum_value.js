const HASURA_SQL_URL = 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v2/query';
const HASURA_ADMIN_SECRET = 'Tav*yoX!12-EnPkI;-1sEY(l7WqlKZXd';

async function addEnumValue() {
  const body = {
    type: 'run_sql',
    args: {
      sql: `ALTER TYPE run_status_enum ADD VALUE IF NOT EXISTS 'cancelled';`
    }
  };

  const res = await fetch(HASURA_SQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log('SQL Execution Result:', JSON.stringify(data, null, 2));
}

addEnumValue().catch(console.error);
