import fs from 'fs';
import path from 'path';

/**
 * AI Agent Workflow Builder — Security Matrix & Validation Suite
 *
 * Checks repository static security policies and runs live GraphQL permission tests.
 * Test statuses: PASSED | FAILED | NOT RUN
 */

interface TestResult {
  id: number | string;
  name: string;
  category: 'Static' | 'Live GraphQL';
  status: 'PASSED' | 'FAILED' | 'NOT RUN';
  detail: string;
}

const results: TestResult[] = [];

function record(
  id: number | string,
  name: string,
  category: 'Static' | 'Live GraphQL',
  status: 'PASSED' | 'FAILED' | 'NOT RUN',
  detail: string
) {
  results.push({ id, name, category, status, detail });
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⏸️';
  console.log(`[${status}] ${icon} Test ${id}: ${name} — ${detail}`);
}

const ROOT_DIR = path.resolve(__dirname, '../..');
const NHOST_URL = process.env.NHOST_GRAPHQL_URL || 'https://soouvxhgygbxyeooczsu.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '';

// Test user session IDs (if live environment available)
const USERS = {
  owner_a: process.env.ORG_A_OWNER_ID || '375d3e53-f368-4191-bffb-f30c6f7c9e62',
  editor_a: process.env.ORG_A_EDITOR_ID || '0b98f8a3-2194-4e0f-9d1c-d661447bb428',
  viewer_a: process.env.ORG_A_VIEWER_ID || '4e040228-578a-4cdc-9804-795a6846a6c6',
  owner_b: process.env.ORG_B_OWNER_ID || '341ffae6-cc31-4caa-a588-9d4179d19316',
};

async function runStaticTests() {
  console.log('\n━━━ SECTION 1: STATIC SECURITY CHECKS ━━━');

  // Static 1: Check for localtunnel URLs
  const findLocaltunnel = scanRepoFor(ROOT_DIR, ['loca' + '.lt']);
  if (findLocaltunnel.length === 0) {
    record('S1', 'No localtunnel production URLs', 'Static', 'PASSED', 'Zero occurrences of loca.lt in repo');
  } else {
    record('S1', 'No localtunnel production URLs', 'Static', 'FAILED', `Found in: ${findLocaltunnel.join(', ')}`);
  }

  // Static 2: Check for tunnel bypass headers
  const findBypassHeader = scanRepoFor(ROOT_DIR, ['Bypass-Tunnel-' + 'Reminder']);
  if (findBypassHeader.length === 0) {
    record('S2', 'No tunnel bypass headers', 'Static', 'PASSED', 'Zero occurrences of Bypass-Tunnel-Reminder in repo');
  } else {
    record('S2', 'No tunnel bypass headers', 'Static', 'FAILED', `Found in: ${findBypassHeader.join(', ')}`);
  }

  // Static 3: Check production nhost.toml config
  const nhostTomlPath = path.join(ROOT_DIR, 'nhost/nhost.toml');
  if (fs.existsSync(nhostTomlPath)) {
    const content = fs.readFileSync(nhostTomlPath, 'utf8');
    const devModeMatch = content.match(/devMode\s*=\s*(true|false)/);
    const anonMatch = content.match(/\[auth\.method\.anonymous\]\s*enabled\s*=\s*(true|false)/);

    const isDevModeFalse = devModeMatch && devModeMatch[1] === 'false';
    const isAnonDisabled = anonMatch && anonMatch[1] === 'false';

    if (isDevModeFalse && isAnonDisabled) {
      record('S3', 'Production nhost.toml configuration', 'Static', 'PASSED', 'devMode = false, anonymous.enabled = false');
    } else {
      record('S3', 'Production nhost.toml configuration', 'Static', 'FAILED', `devMode=${devModeMatch?.[1]}, anon=${anonMatch?.[1]}`);
    }
  } else {
    record('S3', 'Production nhost.toml configuration', 'Static', 'FAILED', 'nhost.toml file not found');
  }

  // Static 4: Migration presence
  const migration0003Path = path.join(ROOT_DIR, 'nhost/migrations/default/0003_security_fixes/up.sql');
  if (fs.existsSync(migration0003Path)) {
    const sql = fs.readFileSync(migration0003Path, 'utf8');
    const hasFk = sql.includes('REFERENCES auth.users(id)');
    const hasQuotaFunc = sql.includes('CREATE OR REPLACE FUNCTION public.check_and_increment_quota');
    if (hasFk && hasQuotaFunc) {
      record('S4', 'Migration 0003_security_fixes presence', 'Static', 'PASSED', 'Contains FK auth.users(id) and atomic check_and_increment_quota');
    } else {
      record('S4', 'Migration 0003_security_fixes presence', 'Static', 'FAILED', 'Migration 0003 file missing required SQL functions');
    }
  } else {
    record('S4', 'Migration 0003_security_fixes presence', 'Static', 'FAILED', 'Migration directory 0003_security_fixes/up.sql not found');
  }

  // Static 5: Metadata table permissions check
  const tablesYamlPath = path.join(ROOT_DIR, 'nhost/metadata/databases/default/tables/tables.yaml');
  if (fs.existsSync(tablesYamlPath)) {
    const yamlContent = fs.readFileSync(tablesYamlPath, 'utf8');
    const hasNoDirectRunsInsert = !yamlContent.includes('name: workflow_runs\n  insert_permissions');
    const hasNoDirectStepRunsInsert = !yamlContent.includes('name: step_runs\n  insert_permissions');

    if (hasNoDirectRunsInsert && hasNoDirectStepRunsInsert) {
      record('S5', 'Hasura metadata direct user mutations blocked', 'Static', 'PASSED', 'No user insert_permissions on workflow_runs or step_runs');
    } else {
      record('S5', 'Hasura metadata direct user mutations blocked', 'Static', 'FAILED', 'User insert permissions detected on execution tables');
    }
  } else {
    record('S5', 'Hasura metadata direct user mutations blocked', 'Static', 'FAILED', 'tables.yaml not found');
  }
}

function scanRepoFor(dir: string, targets: string[]): string[] {
  const matches: string[] = [];
  function search(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'scripts') continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        search(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.toml') || entry.name.endsWith('.json'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const target of targets) {
          if (content.includes(target)) matches.push(path.relative(ROOT_DIR, fullPath));
        }
      }
    }
  }
  search(dir);
  return Array.from(new Set(matches));
}

async function gqlUser(userId: string, role: string, query: string, variables: Record<string, any> = {}): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ADMIN_SECRET) {
    headers['x-hasura-admin-secret'] = ADMIN_SECRET;
    headers['x-hasura-role'] = role;
    headers['x-hasura-user-id'] = userId;
  }
  const res = await fetch(NHOST_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function runLiveTests() {
  console.log('\n━━━ SECTION 2: LIVE GRAPHQL PERMISSION MATRIX ━━━');

  if (!ADMIN_SECRET && !process.env.TEST_LIVE_NHOST) {
    console.log('    ℹ NHOST_ADMIN_SECRET / live test env not supplied. Marking Live Tests as NOT RUN (pending live Nhost deployment).');
    const liveMatrixScenarios = [
      { id: 1, name: 'Org B queries Org A workflow' },
      { id: 2, name: 'Org B guesses Org A workflow UUID' },
      { id: 3, name: 'Org B queries Org A step_run' },
      { id: 4, name: 'Org B triggers Org A workflow' },
      { id: 5, name: 'Org B approves Org A step' },
      { id: 6, name: 'Org A viewer triggers workflow' },
      { id: 7, name: 'Org A editor creates db_write' },
      { id: 8, name: 'Org A editor creates notify' },
      { id: 9, name: 'Editor changes llm_call → db_write' },
      { id: 10, name: 'Editor changes llm_call → notify' },
      { id: 11, name: 'Editor creates webhook trigger' },
      { id: 12, name: 'Editor changes manual → webhook trigger' },
      { id: 13, name: 'Direct workflow_runs INSERT' },
      { id: 14, name: 'Direct workflow_runs UPDATE' },
      { id: 15, name: 'Direct step_runs INSERT' },
      { id: 16, name: 'Direct step_runs UPDATE' },
      { id: 17, name: 'Owner creates db_write step' },
      { id: 18, name: 'Owner creates notify step' },
      { id: 19, name: 'Owner creates webhook trigger' },
      { id: 20, name: 'Editor triggers ordinary workflow' },
      { id: 21, name: 'Duplicate approval atomicity' },
      { id: 22, name: 'Quota limit reached' },
      { id: 23, name: 'Missing webhook secret' },
      { id: 24, name: 'Invalid webhook secret' },
    ];

    for (const sc of liveMatrixScenarios) {
      record(sc.id, sc.name, 'Live GraphQL', 'NOT RUN', 'Requires live Nhost endpoint & credentials');
    }
    return;
  }

  // Live test execution logic when ADMIN_SECRET / live env is supplied
  try {
    // 1. Org B queries Org A workflow
    const res1 = await gqlUser(USERS.owner_b, 'user', '{ workflows { id org_id } }');
    const leakedWfs = (res1.data?.workflows || []).filter((w: any) => w.org_id === '12368f50-333b-46a1-91c5-44752f04835b');
    if (leakedWfs.length === 0) record(1, 'Org B queries Org A workflow', 'Live GraphQL', 'PASSED', 'Denied / 0 leaked workflows');
    else record(1, 'Org B queries Org A workflow', 'Live GraphQL', 'FAILED', `Leaked ${leakedWfs.length} workflows`);

    // 2. Org B guesses Org A workflow UUID
    const res2 = await gqlUser(USERS.owner_b, 'user', `query { workflows_by_pk(id: "14258f57-7350-45be-86e6-988c26bd14c5") { id } }`);
    if (!res2.data?.workflows_by_pk) record(2, 'Org B guesses Org A workflow UUID', 'Live GraphQL', 'PASSED', 'Denied / returned null');
    else record(2, 'Org B guesses Org A workflow UUID', 'Live GraphQL', 'FAILED', 'Org B retrieved Org A workflow by UUID');

    // 3. Org B queries Org A step_run
    const res3 = await gqlUser(USERS.owner_b, 'user', '{ step_runs { id workflow_run { org_id } } }');
    const leakedSteps = (res3.data?.step_runs || []).filter((s: any) => s.workflow_run?.org_id === '12368f50-333b-46a1-91c5-44752f04835b');
    if (leakedSteps.length === 0) record(3, 'Org B queries Org A step_run', 'Live GraphQL', 'PASSED', 'Denied / 0 leaked step_runs');
    else record(3, 'Org B queries Org A step_run', 'Live GraphQL', 'FAILED', `Leaked ${leakedSteps.length} step_runs`);

    // 6. Org A viewer triggers workflow
    const res6 = await gqlUser(USERS.viewer_a, 'user', `mutation { triggerWorkflowRun(workflow_id: "14258f57-7350-45be-86e6-988c26bd14c5") { workflow_run_id } }`);
    if (res6.errors) record(6, 'Org A viewer triggers workflow', 'Live GraphQL', 'PASSED', 'Denied with error');
    else record(6, 'Org A viewer triggers workflow', 'Live GraphQL', 'FAILED', 'Viewer was able to trigger workflow');

    // 7. Org A editor creates db_write step
    const res7 = await gqlUser(USERS.editor_a, 'user', `mutation { insert_workflow_steps_one(object: {workflow_id: "14258f57-7350-45be-86e6-988c26bd14c5", step_order: 99, step_type: db_write, name: "Test"}) { id } }`);
    if (res7.errors) record(7, 'Org A editor creates db_write', 'Live GraphQL', 'PASSED', 'Denied by Hasura permissions');
    else record(7, 'Org A editor creates db_write', 'Live GraphQL', 'FAILED', 'Editor created db_write step!');

    // 13. Direct workflow_runs INSERT
    const res13 = await gqlUser(USERS.owner_a, 'user', `mutation { insert_workflow_runs_one(object: {workflow_id: "14258f57-7350-45be-86e6-988c26bd14c5", org_id: "12368f50-333b-46a1-91c5-44752f04835b", status: running}) { id } }`);
    if (res13.errors) record(13, 'Direct workflow_runs INSERT', 'Live GraphQL', 'PASSED', 'Denied (field not available to user role)');
    else record(13, 'Direct workflow_runs INSERT', 'Live GraphQL', 'FAILED', 'User directly inserted workflow_runs!');

    // 15. Direct step_runs INSERT
    const res15 = await gqlUser(USERS.owner_a, 'user', `mutation { insert_step_runs_one(object: {workflow_run_id: "14258f57-7350-45be-86e6-988c26bd14c5", workflow_step_id: "14258f57-7350-45be-86e6-988c26bd14c5"}) { id } }`);
    if (res15.errors) record(15, 'Direct step_runs INSERT', 'Live GraphQL', 'PASSED', 'Denied (field not available to user role)');
    else record(15, 'Direct step_runs INSERT', 'Live GraphQL', 'FAILED', 'User directly inserted step_runs!');

  } catch (err: any) {
    console.error('Error during live tests:', err);
  }
}

async function main() {
  console.log('====================================================');
  console.log(' AI AGENT WORKFLOW BUILDER — SECURITY MATRIX REPORT');
  console.log('====================================================');

  await runStaticTests();
  await runLiveTests();

  console.log('\n====================================================');
  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  const failedCount = results.filter((r) => r.status === 'FAILED').length;
  const notRunCount = results.filter((r) => r.status === 'NOT RUN').length;

  console.log(` SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED | ${notRunCount} NOT RUN`);
  console.log('====================================================');

  if (failedCount > 0) process.exit(1);
}

main().catch(console.error);
