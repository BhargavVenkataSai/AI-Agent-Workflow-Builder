const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function testUsers() {
  const users = [
    'owner_a@test.com',
    'editor_a@test.com',
    'viewer_a@test.com',
    'owner_b@test.com'
  ];

  for (const email of users) {
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('https://soouvxhgygbxyeooczsu.auth.ap-south-1.nhost.run/v1/signin/email-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close'
          },
          body: JSON.stringify({ email, password: 'Test1234!' })
        });
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch {}
        console.log(`${email}: status=${res.status}, userId=${data.session?.user?.id || 'NONE'}`);
        if (res.status === 200) { success = true; break; }
        if (res.status === 429) {
          console.log(`  Rate limited (429), waiting 3s...`);
          await sleep(3000);
        }
      } catch (e: any) {
        console.log(`  Attempt ${attempt + 1} failed: ${e.message}`);
        await sleep(1000);
      }
    }
    await sleep(2500);
  }
}

testUsers();
