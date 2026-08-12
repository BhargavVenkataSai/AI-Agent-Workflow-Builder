import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, cancelWorkflowRun } from '@/lib/workflowEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workflowRunId = body.input?.workflowRunId || body.workflowRunId || body.workflow_run_id;
    
    // SECURITY: Strictly derive user ID from session context or Bearer token
    const userId = getAuthenticatedUserId(req, body);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: No valid session or authorization token' }, { status: 401 });
    }
    if (!workflowRunId) {
      return NextResponse.json({ message: 'Missing workflowRunId' }, { status: 400 });
    }

    const result = await cancelWorkflowRun(workflowRunId, userId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[cancelRun] Error:', error);
    return NextResponse.json({ message: error.message || 'Failed to cancel workflow run' }, { status: 400 });
  }
}
