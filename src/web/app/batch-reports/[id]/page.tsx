import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/test-runs/StatusBadge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

// Disable caching for this page
export const dynamic = 'force-dynamic'

interface TestRun {
  id: string
  game_id: string
  status: 'pass' | 'fail' | 'error' | 'timeout'
  playability_score: number | null
  created_at: string
  games: {
    id: string
    name: string
    game_url: string
  } | null
}

interface BatchReport {
  id: string
  batch_name: string | null
  status: 'running' | 'completed' | 'partial_failure'
  total_tests: number
  passed_tests: number
  failed_tests: number
  error_tests: number
  started_at: string
  completed_at: string | null
  execution_method: 'cli' | 'web' | null
  metadata: Record<string, any>
  test_runs: TestRun[]
}

async function getBatchReport(id: string): Promise<BatchReport | null> {
  try {
    // Fetch batch report
    const { data: batchReport, error: batchError } = await supabase
      .from('batch_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (batchError || !batchReport) {
      console.error('Error fetching batch report:', batchError)
      return null
    }

    // Fetch all test runs for this batch
    let testRuns: TestRun[] = []
    if (batchReport.test_run_ids && batchReport.test_run_ids.length > 0) {
      const { data: runs, error: runsError } = await supabase
        .from('test_runs')
        .select(`
          *,
          games (
            id,
            name,
            game_url
          )
        `)
        .in('id', batchReport.test_run_ids)

      if (runsError) {
        console.error('Error fetching test runs:', runsError)
      } else {
        testRuns = (runs || []) as TestRun[]
      }
    }

    return {
      ...batchReport,
      test_runs: testRuns,
    } as BatchReport
  } catch (error) {
    console.error('Error in getBatchReport:', error)
    return null
  }
}

function getStatusBadgeVariant(status: BatchReport['status']) {
  switch (status) {
    case 'completed':
      return 'default'
    case 'partial_failure':
      return 'destructive'
    case 'running':
      return 'secondary'
    default:
      return 'secondary'
  }
}

export default async function BatchReportDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const batchReport = await getBatchReport(params.id)

  if (!batchReport) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Report Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The batch report you're looking for doesn't exist.
          </p>
        </div>
        <Button asChild>
          <Link href="/batch-reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Batch Reports
          </Link>
        </Button>
      </div>
    )
  }

  const duration = batchReport.completed_at
    ? Math.round(
        (new Date(batchReport.completed_at).getTime() -
          new Date(batchReport.started_at).getTime()) /
          1000
      )
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href="/batch-reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Batch Reports
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {batchReport.batch_name || `Batch ${batchReport.id.slice(0, 8)}`}
          </h1>
          <p className="text-muted-foreground mt-2">
            Started {formatDistanceToNow(new Date(batchReport.started_at), { addSuffix: true })}
            {batchReport.completed_at && (
              <> • Completed {formatDistanceToNow(new Date(batchReport.completed_at), { addSuffix: true })}</>
            )}
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(batchReport.status)}>
          {batchReport.status === 'partial_failure' ? 'Partial Failure' : batchReport.status}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batchReport.total_tests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{batchReport.passed_tests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{batchReport.failed_tests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{batchReport.error_tests}</div>
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      {batchReport.metadata && Object.keys(batchReport.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Additional information about this batch</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {batchReport.metadata.concurrency && (
                <>
                  <dt className="font-medium">Concurrency</dt>
                  <dd>{batchReport.metadata.concurrency} processes</dd>
                </>
              )}
              {duration !== null && (
                <>
                  <dt className="font-medium">Duration</dt>
                  <dd>{duration} seconds</dd>
                </>
              )}
              {batchReport.execution_method && (
                <>
                  <dt className="font-medium">Execution Method</dt>
                  <dd>{batchReport.execution_method.toUpperCase()}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Test Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Test Runs</CardTitle>
          <CardDescription>
            {batchReport.test_runs.length} test run{batchReport.test_runs.length !== 1 ? 's' : ''} in this batch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batchReport.test_runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No test runs found for this batch.</p>
          ) : (
            <div className="space-y-4">
              {batchReport.test_runs.map((testRun) => (
                <Link
                  key={testRun.id}
                  href={`/games/${testRun.game_id}/test-runs/${testRun.id}`}
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">
                              {testRun.games?.name || 'Unknown Game'}
                            </h3>
                            <StatusBadge status={testRun.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {testRun.games?.game_url}
                          </p>
                          {testRun.playability_score !== null && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Playability Score: {testRun.playability_score}/100
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(testRun.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

