import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GameList } from '@/components/games/GameList'
import { EmptyState } from '@/components/ui/empty-state'
import { supabase } from '@/lib/supabase'
import type { GameWithManifest } from '@/lib/types'

// Disable caching for this page in development
export const dynamic = 'force-dynamic'

async function getGames() {
  try {
    // Fetch games with their last test run
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        *,
        test_runs(
          id,
          status,
          playability_score,
          created_at
        )
      `)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching games:', error)
      return []
    }

    // Transform data to include last test run
    const gamesWithLastTest = games?.map((game: any) => ({
      ...game,
      lastTestRun: game.test_runs && game.test_runs.length > 0 
        ? game.test_runs.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        : null,
    })) || []

    return gamesWithLastTest
  } catch (error) {
    console.error('Error in getGames:', error)
    return []
  }
}

async function getStats(games: any[]) {
  const totalGames = games.length
  const testedGames = games.filter((g) => g.lastTestRun).length
  const avgScore =
    games
      .filter((g) => g.lastTestRun?.playability_score !== null)
      .reduce((sum, g) => sum + (g.lastTestRun?.playability_score || 0), 0) /
      (games.filter((g) => g.lastTestRun?.playability_score !== null).length || 1) || 0

  return {
    totalGames,
    testedGames,
    avgScore: Math.round(avgScore),
  }
}

export default async function HomePage() {
  const games = await getGames()
  const stats = await getStats(games)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Games Library</h1>
          <p className="text-muted-foreground mt-2">
            Manage and test your browser games
          </p>
        </div>
        <Button asChild>
          <Link href="/games/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Game
          </Link>
        </Button>
      </div>

      {/* Stats */}
      {games.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <div className="text-2xl font-bold">{stats.totalGames}</div>
            <p className="text-xs text-muted-foreground">Total Games</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-2xl font-bold">{stats.testedGames}</div>
            <p className="text-xs text-muted-foreground">Tested Games</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-2xl font-bold">{stats.avgScore}/100</div>
            <p className="text-xs text-muted-foreground">Avg. Playability Score</p>
          </div>
        </div>
      )}

      {/* Games List */}
      {games.length === 0 ? (
        <EmptyState
          title="No games yet"
          description="Get started by adding your first game to begin testing"
        />
      ) : (
        <GameList games={games} />
      )}
    </div>
  )
}

