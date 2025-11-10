import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { StatusBadge } from '@/components/test-runs/StatusBadge'
import { PlayabilityScore } from '@/components/test-runs/PlayabilityScore'
import { ScreenshotGallery } from '@/components/test-runs/ScreenshotGallery'
import { ConsoleLogViewer } from '@/components/test-runs/ConsoleLogViewer'
import { TimelineViewer } from '@/components/timeline/TimelineViewer'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDuration } from '@/lib/utils'
import type { TestRun, Game, GameManifest, TimelineEvent } from '@/lib/types'

// Disable caching for this page in development
export const dynamic = 'force-dynamic'

async function getTestRun(testRunId: string): Promise<{
  testRun: TestRun
  game: Game
  manifest?: GameManifest
} | null> {
  const { data, error } = await supabase
    .from('test_runs')
    .select(`
      *,
      games(*),
      game_manifests(*)
    `)
    .eq('id', testRunId)
    .single()

  if (error || !data) return null

  return {
    testRun: data as any,
    game: (data as any).games,
    manifest: (data as any).game_manifests || undefined,
  }
}

export default async function TestResultsPage({
  params,
}: {
  params: { id: string; testRunId: string }
}) {
  const result = await getTestRun(params.testRunId)

  if (!result) {
    notFound()
  }

  const { testRun, game, manifest } = result
  const timeline = (testRun.metadata as any)?.timeline as TimelineEvent[] || []
  const browserbaseUrl = (testRun.metadata as any)?.browserbaseUrl as string | null
  const issues = (testRun.issues as any) || []

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Games', href: '/' },
          { label: game.name, href: `/games/${game.id}` },
          { label: 'Test Results' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Results</h1>
          <p className="text-muted-foreground mt-2">
            {formatDate(testRun.created_at)}
          </p>
        </div>

        <div className="flex gap-2">
          {browserbaseUrl && (
            <Button variant="outline" asChild>
              <a href={browserbaseUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View BrowserBase Session
              </a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/games/${game.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Game
            </Link>
          </Button>
        </div>
      </div>

      {/* Status and Metadata */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge status={testRun.status as any} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Playability Score</CardDescription>
          </CardHeader>
          <CardContent>
            <PlayabilityScore score={testRun.playability_score} size="lg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Duration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testRun.duration_ms ? formatDuration(testRun.duration_ms) : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Execution Method</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="uppercase">
              {testRun.execution_method || 'Unknown'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Game & Manifest Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Game</div>
              <div className="text-sm">{game.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Game URL</div>
              <a
                href={game.game_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {game.game_url}
              </a>
            </div>
            {manifest && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Manifest Version</div>
                <div className="text-sm">{manifest.version_name}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Issues Detected ({issues.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {issues.slice(0, 5).map((issue: string, index: number) => (
                <li key={index} className="text-sm">{issue}</li>
              ))}
              {issues.length > 5 && (
                <li className="text-sm font-medium">
                  ...and {issues.length - 5} more issues
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* BrowserBase Live View Notice */}
      {browserbaseUrl && (
        <Alert>
          <AlertTitle>Live Browser Session Available</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>View the browser session recording in BrowserBase</span>
            <Button size="sm" variant="outline" asChild>
              <a href={browserbaseUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3 w-3" />
                Open Session
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          <TabsTrigger value="console">Console Logs</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {timeline.length > 0 ? (
            <TimelineViewer
              events={timeline}
              screenshots={testRun.screenshots}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No timeline data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="screenshots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Captured Screenshots ({testRun.screenshots.length})</CardTitle>
              <CardDescription>
                Screenshots captured during test execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScreenshotGallery screenshots={testRun.screenshots} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="console" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Console Logs</CardTitle>
              <CardDescription>
                Browser console output during test execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testRun.console_logs ? (
                <ConsoleLogViewer logs={testRun.console_logs} />
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  No console logs available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Metadata</CardTitle>
              <CardDescription>
                Raw metadata and configuration from the test run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-4 font-mono text-xs overflow-auto max-h-[600px]">
                <pre>{JSON.stringify(testRun.metadata, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

