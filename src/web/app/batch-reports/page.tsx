import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/test-runs/StatusBadge'
import { EmptyState } from '@/components/ui/empty-state'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

// Disable caching for this page
export const dynamic = 'force-dynamic'

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
}

async function getBatchReports() {
  try {
    const { data, error } = await supabase
      .from('batch_reports')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching batch reports:', error)
      return []
    }

    return (data || []) as BatchReport[]
  } catch (error) {
    console.error('Error in getBatchReports:', error)
    return []
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

export default async function BatchReportsPage() {
  const batchReports = await getBatchReports()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Reports</h1>
        <p className="text-muted-foreground mt-2">
          View results from parallel batch test executions
        </p>
      </div>

      {/* Batch Reports List */}
      {batchReports.length === 0 ? (
        <EmptyState
          title="No batch reports yet"
          description="Run batch tests using the CLI with the -l flag to see results here"
        />
      ) : (
        <div className="space-y-4">
          {batchReports.map((report) => (
            <Link key={report.id} href={`/batch-reports/${report.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {report.batch_name || `Batch ${report.id.slice(0, 8)}`}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Started {formatDistanceToNow(new Date(report.started_at), { addSuffix: true })}
                        {report.completed_at && (
                          <> • Completed {formatDistanceToNow(new Date(report.completed_at), { addSuffix: true })}</>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(report.status)}>
                      {report.status === 'partial_failure' ? 'Partial Failure' : report.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{report.total_tests}</div>
                      <p className="text-xs text-muted-foreground">Total Tests</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{report.passed_tests}</div>
                      <p className="text-xs text-muted-foreground">Passed</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{report.failed_tests}</div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{report.error_tests}</div>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </div>
                  </div>
                  {report.execution_method && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Executed via {report.execution_method.toUpperCase()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

