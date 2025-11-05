import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { StatusBadge } from '@/components/test-runs/StatusBadge'
import { PlayabilityScore } from '@/components/test-runs/PlayabilityScore'
import { EmptyState } from '@/components/ui/empty-state'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDuration } from '@/lib/utils'
import { GAME_TYPES } from '@/lib/constants'
import type { Game, GameManifest, TestRun } from '@/lib/types'

async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

async function getManifests(gameId: string): Promise<GameManifest[]> {
  const { data, error } = await supabase
    .from('game_manifests')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

async function getTestRuns(gameId: string): Promise<TestRun[]> {
  const { data, error } = await supabase
    .from('test_runs')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return []
  return data || []
}

export default async function GameDetailPage({ params }: { params: { id: string } }) {
  const game = await getGame(params.id)
  
  if (!game) {
    notFound()
  }

  const [manifests, testRuns] = await Promise.all([
    getManifests(params.id),
    getTestRuns(params.id),
  ])

  const gameType = GAME_TYPES.find((t) => t.value === game.game_type)
  const activeManifest = manifests.find((m) => m.is_active)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Games', href: '/' },
          { label: game.name },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
            {gameType && (
              <Badge variant="secondary">{gameType.label}</Badge>
            )}
          </div>
          <a
            href={game.game_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            {game.game_url}
          </a>
          {game.description && (
            <p className="mt-4 text-muted-foreground">{game.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/games/${game.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/games/${game.id}/run`}>
              <Play className="mr-2 h-4 w-4" />
              Run Test
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Manifest</CardDescription>
          </CardHeader>
          <CardContent>
            {activeManifest ? (
              <div className="text-2xl font-bold">{activeManifest.version_name}</div>
            ) : (
              <div className="text-muted-foreground">None</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Tests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testRuns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last Tested</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {game.last_tested_at ? formatDate(game.last_tested_at) : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="test-history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="test-history">Test History</TabsTrigger>
          <TabsTrigger value="manifests">Manifests</TabsTrigger>
        </TabsList>

        <TabsContent value="test-history" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Test Runs</h2>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/games/${game.id}/run`}>
                <Play className="mr-2 h-3 w-3" />
                Run New Test
              </Link>
            </Button>
          </div>

          {testRuns.length === 0 ? (
            <EmptyState
              title="No test runs yet"
              description="Run your first test to see results here"
            />
          ) : (
            <div className="space-y-3">
              {testRuns.map((testRun) => (
                <Link
                  key={testRun.id}
                  href={`/games/${game.id}/test-runs/${testRun.id}`}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <StatusBadge status={testRun.status as any} />
                          <div>
                            <div className="font-medium">
                              {formatDate(testRun.created_at)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Duration: {testRun.duration_ms ? formatDuration(testRun.duration_ms) : 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {testRun.playability_score !== null && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">
                                Playability
                              </div>
                              <PlayabilityScore score={testRun.playability_score} />
                            </div>
                          )}
                          {(testRun.issues as any)?.length > 0 && (
                            <Badge variant="outline">
                              {(testRun.issues as any).length} issues
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manifests" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Game Manifests</h2>
            <Button size="sm" asChild>
              <Link href={`/games/${game.id}/manifests/new`}>
                <Plus className="mr-2 h-3 w-3" />
                Create Manifest
              </Link>
            </Button>
          </div>

          {manifests.length === 0 ? (
            <EmptyState
              title="No manifests yet"
              description="Create a manifest to improve test accuracy with game-specific configuration"
            />
          ) : (
            <div className="space-y-3">
              {manifests.map((manifest) => (
                <Link
                  key={manifest.id}
                  href={`/games/${game.id}/manifests/${manifest.id}/edit`}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {manifest.version_name}
                          </CardTitle>
                          {manifest.is_active && (
                            <Badge>Active</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(manifest.created_at)}
                        </div>
                      </div>
                      {manifest.notes && (
                        <CardDescription className="line-clamp-2">
                          {manifest.notes}
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Link>
        </Button>
      </div>
    </div>
  )
}

