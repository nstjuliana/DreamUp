'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Play, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { Game, GameManifest } from '@/lib/types'

export default function RunTestPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()

  const gameId = params.id as string

  const [game, setGame] = useState<Game | null>(null)
  const [manifests, setManifests] = useState<GameManifest[]>([])
  const [selectedManifest, setSelectedManifest] = useState<string>('none')
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null)
  const [testRunId, setTestRunId] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gameRes, manifestsRes] = await Promise.all([
          fetch(`/api/games/${gameId}`),
          fetch(`/api/games/${gameId}/manifests`),
        ])

        if (!gameRes.ok) throw new Error('Failed to fetch game')
        if (!manifestsRes.ok) throw new Error('Failed to fetch manifests')

        const gameData = await gameRes.json()
        const manifestsData = await manifestsRes.json()

        setGame(gameData)
        setManifests(manifestsData)

        // Set active manifest as default
        const activeManifest = manifestsData.find((m: GameManifest) => m.is_active)
        if (activeManifest) {
          setSelectedManifest(activeManifest.id)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load game data',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchData()
  }, [gameId, toast])

  useEffect(() => {
    // Cleanup polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const pollTestStatus = async (runId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/test-runs/${runId}/status`)
        if (!response.ok) return

        const data = await response.json()

        if (data.status !== 'in_progress') {
          // Test completed
          clearInterval(interval)
          setPollingInterval(null)

          toast({
            title: 'Test Complete',
            description: `Test finished with status: ${data.status}`,
          })

          router.push(`/games/${gameId}/test-runs/${runId}`)
        }
      } catch (error) {
        console.error('Error polling test status:', error)
      }
    }, 5000) // Poll every 5 seconds

    setPollingInterval(interval)
  }

  const handleStartTest = async () => {
    if (!game) return

    setIsRunning(true)
    setLiveViewUrl(null)
    setTestRunId(null)

    try {
      const response = await fetch(`/api/games/${gameId}/test-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestId: selectedManifest === 'none' ? null : selectedManifest,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start test')
      }

      const data = await response.json()

      setTestRunId(data.testRunId)
      setLiveViewUrl(data.liveViewUrl || null)

      toast({
        title: 'Test Started',
        description: 'Your test is now running. This may take several minutes.',
      })

      // Start polling for completion
      if (data.testRunId) {
        pollTestStatus(data.testRunId)
      }
    } catch (error) {
      console.error('Error starting test:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start test',
        variant: 'destructive',
      })
      setIsRunning(false)
    }
  }

  if (isLoadingData) {
    return <LoadingSpinner />
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Game not found</p>
        <Link href="/">
          <Button className="mt-4">Back to Games</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/games/${gameId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Run Test</h1>
          <p className="text-muted-foreground">{game.name}</p>
        </div>
      </div>

      {!isRunning ? (
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              Configure and start a new test run for this game
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="manifest">Manifest Version</Label>
              <Select value={selectedManifest} onValueChange={setSelectedManifest}>
                <SelectTrigger id="manifest">
                  <SelectValue placeholder="Select a manifest..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manifest (Default behavior)</SelectItem>
                  {manifests.map((manifest) => (
                    <SelectItem key={manifest.id} value={manifest.id}>
                      Version {manifest.version_name || 'N/A'}
                      {manifest.is_active && ' (Active)'}
                      {manifest.manifest_data.notes &&
                        ` - ${manifest.manifest_data.notes.substring(0, 50)}...`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a manifest to guide the AI agent, or choose no manifest for default
                behavior
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Game Information</h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">URL:</span>{' '}
                  <a
                    href={game.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {game.url}
                  </a>
                </p>
                <p>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="capitalize">{game.game_type || 'N/A'}</span>
                </p>
                {game.description && (
                  <p>
                    <span className="text-muted-foreground">Description:</span> {game.description}
                  </p>
                )}
              </div>
            </div>

            <Button onClick={handleStartTest} size="lg" className="w-full">
              <Play className="h-5 w-5 mr-2" />
              Start Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Test Running
              </CardTitle>
              <CardDescription>
                Your test is currently in progress. This typically takes 1-2 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {liveViewUrl && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <h4 className="font-semibold mb-2">Watch Live</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    View the test execution in real-time on BrowserBase
                  </p>
                  <Button asChild>
                    <a href={liveViewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Live View
                    </a>
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Test Progress</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Browser session initialized</p>
                  <p>⟳ Loading game page...</p>
                  <p>⟳ Analyzing game interface...</p>
                  <p>⟳ Playing game...</p>
                  <p>⋯ Evaluating results...</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (pollingInterval) {
                      clearInterval(pollingInterval)
                      setPollingInterval(null)
                    }
                    router.push(`/games/${gameId}`)
                  }}
                >
                  Return to Game
                </Button>
                {testRunId && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/games/${gameId}/test-runs/${testRunId}`)}
                  >
                    View Results (when complete)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

