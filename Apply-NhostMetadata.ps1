[CmdletBinding()]
param (
    [string]$Subdomain = "soouvxhgygbxyeooczsu",
    [string]$Region = "ap-south-1",
    [switch]$DryRun
)

$hasuraMetadataUrl = "https://${Subdomain}.hasura.${Region}.nhost.run/v1/metadata"
$functionsUrl = "https://${Subdomain}.functions.${Region}.nhost.run"

$nodeScript = @"
const fs = require('fs');
const path = require('path');
const yaml = require(path.join(process.cwd(), 'web/node_modules/js-yaml'));

const functionsUrl = '$functionsUrl';

function readAndInterpolateYaml(filePath) {
    if (!fs.existsSync(filePath)) return null;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\{\{NHOST_FUNCTIONS_URL\}\}/g, functionsUrl);
    return yaml.load(content);
}

const tables = readAndInterpolateYaml(path.join(process.cwd(), 'nhost/metadata/databases/default/tables/tables.yaml')) || [];
const eventTriggers = readAndInterpolateYaml(path.join(process.cwd(), 'nhost/metadata/databases/default/event_triggers.yaml')) || [];
const actionsMeta = readAndInterpolateYaml(path.join(process.cwd(), 'nhost/metadata/actions.yaml')) || {};
const cronTriggers = readAndInterpolateYaml(path.join(process.cwd(), 'nhost/metadata/cron_triggers.yaml')) || [];

const bulkArgs = [];

// Phase 1: Track ALL tables first
for (const entry of tables) {
    bulkArgs.push({
        type: 'pg_track_table',
        args: { source: 'default', table: entry.table }
    });
}

// Phase 2: Create Relationships
for (const entry of tables) {
    if (entry.object_relationships) {
        for (const rel of entry.object_relationships) {
            bulkArgs.push({
                type: 'pg_create_object_relationship',
                args: { source: 'default', table: entry.table, name: rel.name, using: rel.using, comment: rel.comment }
            });
        }
    }
    if (entry.array_relationships) {
        for (const rel of entry.array_relationships) {
            bulkArgs.push({
                type: 'pg_create_array_relationship',
                args: { source: 'default', table: entry.table, name: rel.name, using: rel.using, comment: rel.comment }
            });
        }
    }
}

// Phase 3: Create Permissions
for (const entry of tables) {
    const permMap = [
        { key: 'select_permissions', type: 'pg_create_select_permission' },
        { key: 'insert_permissions', type: 'pg_create_insert_permission' },
        { key: 'update_permissions', type: 'pg_create_update_permission' },
        { key: 'delete_permissions', type: 'pg_create_delete_permission' }
    ];

    for (const p of permMap) {
        if (entry[p.key]) {
            for (const perm of entry[p.key]) {
                bulkArgs.push({
                    type: p.type,
                    args: { source: 'default', table: entry.table, role: perm.role, permission: perm.permission, comment: perm.comment }
                });
            }
        }
    }
}

// Phase 4: Event Triggers (Drop then Create for Idempotency)
for (const et of eventTriggers) {
    const args = et.definition && et.definition.args;
    if (args) {
        bulkArgs.push({
            type: 'pg_drop_event_trigger',
            args: { name: et.name, source: args.source || 'default' }
        });
        bulkArgs.push({
            type: 'pg_create_event_trigger',
            args: {
                name: et.name,
                source: args.source || 'default',
                table: args.table,
                webhook: args.webhook,
                insert: args.insert,
                update: args.update,
                delete: args.delete,
                headers: args.headers,
                retry_conf: args.retry_conf,
                comment: et.comment
            }
        });
    }
}

// Phase 5: Custom Types
if (actionsMeta.custom_types) {
    bulkArgs.push({
        type: 'set_custom_types',
        args: actionsMeta.custom_types
    });
}

// Phase 6: Actions with Complete Definitions & Idempotency Drop
const actionSignatures = {
    triggerWorkflowRun: {
        output_type: 'TriggerWorkflowRunOutput!',
        arguments: [{ name: 'workflow_id', type: 'uuid!' }]
    },
    approveStep: {
        output_type: 'ApproveStepOutput!',
        arguments: [{ name: 'step_run_id', type: 'uuid!' }]
    },
    webhookTrigger: {
        output_type: 'TriggerWorkflowRunOutput!',
        arguments: [{ name: 'workflow_id', type: 'uuid!' }, { name: 'payload', type: 'jsonb' }]
    }
};

if (actionsMeta.actions) {
    for (const act of actionsMeta.actions) {
        bulkArgs.push({
            type: 'drop_action',
            args: { name: act.name, clear_data: false }
        });

        const sig = actionSignatures[act.name] || {};
        const fullDefinition = Object.assign({}, act.definition, sig);

        bulkArgs.push({
            type: 'create_action',
            args: {
                name: act.name,
                definition: fullDefinition,
                comment: act.comment
            }
        });

        if (act.permissions) {
            for (const perm of act.permissions) {
                bulkArgs.push({
                    type: 'create_action_permission',
                    args: { action: act.name, role: perm.role, comment: perm.comment }
                });
            }
        }
    }
}

// Phase 7: Cron Triggers (Delete then Create for Idempotency)
for (const ct of cronTriggers) {
    const def = ct.definition || {};
    bulkArgs.push({
        type: 'delete_cron_trigger',
        args: { name: ct.name }
    });
    bulkArgs.push({
        type: 'create_cron_trigger',
        args: {
            name: ct.name,
            schedule: def.schedule,
            webhook: def.webhook,
            payload: def.payload,
            headers: def.headers,
            retry_conf: def.retry_conf,
            include_in_metadata: def.include_in_metadata,
            comment: ct.comment
        }
    });
}

console.log(JSON.stringify({ type: 'bulk', args: bulkArgs }, null, 2));
"@

$payloadJson = node -e "$nodeScript"

if ([string]::IsNullOrWhiteSpace($payloadJson)) {
    Write-Error "Failed to generate Hasura metadata JSON payload."
    exit 1
}

if ($DryRun) {
    $outputPath = "Apply-NhostMetadata.payload.json"
    Set-Content -Path $outputPath -Value $payloadJson -Encoding UTF8

    $payloadObj = $payloadJson | ConvertFrom-Json
    $totalOps = $payloadObj.args.Count

    Write-Host "[DRY RUN MODE]" -ForegroundColor Cyan
    Write-Host "Target Project Subdomain: $Subdomain" -ForegroundColor Gray
    Write-Host "Payload written to: $outputPath" -ForegroundColor Green
    Write-Host "Total Hasura Metadata Operations: $totalOps`n" -ForegroundColor Yellow

    Write-Host "Breakdown of Operations by Type:" -ForegroundColor White
    $opsGrouped = $payloadObj.args | Group-Object -Property type
    foreach ($group in $opsGrouped) {
        Write-Host ("  - {0,-35} : {1}" -f $group.Name, $group.Count) -ForegroundColor Cyan
    }

    Write-Host "`nNo HTTP request was executed." -ForegroundColor Green
    return
}

if ([string]::IsNullOrWhiteSpace($env:NHOST_ADMIN_SECRET)) {
    Write-Error "NHOST_ADMIN_SECRET environment variable is missing or empty. Set \$env:NHOST_ADMIN_SECRET to run."
    exit 1
}

$headers = @{
    "Content-Type"          = "application/json"
    "x-hasura-admin-secret" = $env:NHOST_ADMIN_SECRET
}

Write-Host "Sending bulk metadata request to Hasura API at $hasuraMetadataUrl..." -ForegroundColor Yellow

$response = Invoke-RestMethod -Uri $hasuraMetadataUrl -Method Post -Headers $headers -Body $payloadJson

Write-Host "Metadata successfully applied to project $Subdomain!" -ForegroundColor Green
$response | ConvertTo-Json -Depth 5
