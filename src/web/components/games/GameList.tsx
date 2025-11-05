'use client'

import { useState } from 'react'
import { GameCard } from './GameCard'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Gamepad2, Search } from 'lucide-react'
import { GAME_TYPES } from '@/lib/constants'
import type { Game, TestRun } from '@/lib/types'

interface GameWithLastTest extends Game {
  lastTestRun?: TestRun | null
}

interface GameListProps {
  games: GameWithLastTest[]
}

export function GameList({ games }: GameListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('updated')

  // Filter games
  const filteredGames = games.filter((game) => {
    const matchesSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.game_url.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType =
      gameTypeFilter === 'all' || game.game_type === gameTypeFilter

    return matchesSearch && matchesType
  })

  // Sort games
  const sortedGames = [...filteredGames].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'tested':
        if (!a.last_tested_at && !b.last_tested_at) return 0
        if (!a.last_tested_at) return 1
        if (!b.last_tested_at) return -1
        return new Date(b.last_tested_at).getTime() - new Date(a.last_tested_at).getTime()
      default:
        return 0
    }
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Label htmlFor="search">Search</Label>
          <div className="relative mt-1.5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="w-full md:w-48">
          <Label htmlFor="game-type">Game Type</Label>
          <Select value={gameTypeFilter} onValueChange={setGameTypeFilter}>
            <SelectTrigger id="game-type" className="mt-1.5">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {GAME_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-48">
          <Label htmlFor="sort-by">Sort By</Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger id="sort-by" className="mt-1.5">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last Updated</SelectItem>
              <SelectItem value="tested">Last Tested</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {sortedGames.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No games found"
          description={
            searchQuery || gameTypeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by creating your first game'
          }
        />
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {sortedGames.length} {sortedGames.length === 1 ? 'game' : 'games'}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedGames.map((game) => (
              <GameCard key={game.id} game={game} lastTestRun={game.lastTestRun} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

