import { gql } from '@apollo/client';

export const GET_USER_ORGS = gql`
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

export const GET_ORG_WORKFLOWS = gql`
query GetOrgWorkflows($orgId: uuid!) {
  workflows(where: {org_id: {_eq: $orgId}}, order_by: {created_at: desc}) {
    id
    name
    description
    is_active
    created_at
    workflow_steps(order_by: {step_order: asc}) {
      id
      step_order
      step_type
      name
      config
    }
    workflow_triggers {
      id
      trigger_type
      config
      is_active
    }
    workflow_runs(limit: 1, order_by: {started_at: desc}) {
      id
      status
      started_at
      completed_at
    }
  }
}
`;

export const GET_WORKFLOW_DETAIL = gql`
query GetWorkflowDetail($id: uuid!) {
  workflows_by_pk(id: $id) {
    id
    name
    description
    is_active
    org_id
    workflow_steps(order_by: {step_order: asc}) {
      id
      step_order
      step_type
      name
      config
    }
    workflow_triggers {
      id
      trigger_type
      config
      is_active
    }
    workflow_runs(order_by: {started_at: desc}, limit: 10) {
      id
      status
      trigger_type
      started_at
      completed_at
    }
  }
}
`;

export const WATCH_STEP_RUNS = gql`
subscription WatchStepRuns($workflowRunId: uuid!) {
  step_runs(
    where: {workflow_run_id: {_eq: $workflowRunId}}
    order_by: {workflow_step: {step_order: asc}}
  ) {
    id
    status
    input
    output
    error
    attempt_count
    approved_by
    approved_at
    started_at
    completed_at
    workflow_step {
      id
      step_order
      step_type
      name
      config
    }
  }
}
`;

export const WATCH_WORKFLOW_RUN = gql`
subscription WatchWorkflowRun($runId: uuid!) {
  workflow_runs_by_pk(id: $runId) {
    id
    status
    started_at
    completed_at
    error
  }
}
`;

export const CREATE_WORKFLOW = gql`
mutation CreateWorkflow($object: workflows_insert_input!) {
  insert_workflows_one(object: $object) {
    id
    name
  }
}
`;

export const UPDATE_WORKFLOW = gql`
mutation UpdateWorkflow($id: uuid!, $set: workflows_set_input!, $steps: [workflow_steps_insert_input!]!, $triggers: [workflow_triggers_insert_input!]!) {
  update_workflows_by_pk(pk_columns: {id: $id}, _set: $set) {
    id
    name
  }
  delete_workflow_steps(where: {workflow_id: {_eq: $id}}) {
    affected_rows
  }
  insert_workflow_steps(objects: $steps) {
    affected_rows
  }
  delete_workflow_triggers(where: {workflow_id: {_eq: $id}}) {
    affected_rows
  }
  insert_workflow_triggers(objects: $triggers) {
    affected_rows
  }
}
`;

export const TRIGGER_WORKFLOW_RUN = gql`
mutation TriggerWorkflowRun($workflowId: uuid!) {
  triggerWorkflowRun(workflow_id: $workflowId) {
    workflow_run_id
    status
    message
  }
}
`;

export const APPROVE_STEP = gql`
mutation ApproveStep($stepRunId: uuid!) {
  approveStep(step_run_id: $stepRunId) {
    success
    message
    workflow_run_id
  }
}
`;

export const GET_ORG_USAGE = gql`
query GetOrgUsage($orgId: uuid!) {
  organizations_by_pk(id: $orgId) {
    id
    name
    quota_limit
    quota_used
    quota_period_start
  }
}
`;
