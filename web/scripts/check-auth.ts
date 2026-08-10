async function checkAuth() {
  const url1 = 'https://diurddjlflgkyeeyylcp.auth.ap-south-1.nhost.run/v1/signin/email-password';
  const url2 = 'https://diurddjlflgkyeeyylcp.nhost.run/v1/auth/signin/email-password';
  
  const body = JSON.stringify({ email: 'owner_a@test.com', password: 'Test1234!' });

  console.log('Testing URL 1:', url1);
  try {
    const res1 = await fetch(url1, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    console.log('URL 1 status:', res1.status, await res1.text());
  } catch (e: any) {
    console.error('URL 1 error:', e.message);
  }

  console.log('Testing URL 2:', url2);
  try {
    const res2 = await fetch(url2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    console.log('URL 2 status:', res2.status, await res2.text());
  } catch (e: any) {
    console.error('URL 2 error:', e.message);
  }
}

checkAuth();
