import Link from 'next/link'
import { Clock, FileText, Play } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/test-runs/StatusBadge'
import { PlayabilityScore } from '@/components/test-runs/PlayabilityScore'
import { formatRelativeTime } from '@/lib/utils'
import { GAME_TYPES } from '@/lib/constants'
import type { Game, TestRun } from '@/lib/types'

interface GameCardProps {
  game: Game
  lastTestRun?: TestRun | null
}

export function GameCard({ game, lastTestRun }: GameCardProps) {
  const gameType = GAME_TYPES.find((t) => t.value === game.game_type)

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="line-clamp-1">{game.name}</CardTitle>
            <CardDescription className="line-clamp-1 mt-1">
              {game.game_url}
            </CardDescription>
          </div>
          {gameType && (
            <Badge variant="secondary" className="ml-2">
              {gameType.label}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {game.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {game.description}
          </p>
        )}

        <div className="space-y-2">
          {lastTestRun && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Test:</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={lastTestRun.status as any} />
                <PlayabilityScore score={lastTestRun.playability_score} size="sm" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {game.last_tested_at ? formatRelativeTime(game.last_tested_at) : 'Never tested'}
            </span>
            {game.active_manifest_id && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-3 w-3" />
                Has manifest
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link href={`/games/${game.id}`}>
            View Details
          </Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <Link href={`/games/${game.id}/run`}>
            <Play className="h-4 w-4 mr-1" />
            Run Test
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

