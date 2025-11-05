'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Flag,
  Monitor,
  Loader,
  Camera,
  MousePointer,
  AlertCircle,
  Gamepad,
  Star,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn, formatDuration } from '@/lib/utils'
import type { TimelineEvent } from '@/lib/types'

interface TimelineViewerProps {
  events: TimelineEvent[]
  screenshots?: string[]
  className?: string
}

type EventFilter = 'all' | 'errors' | 'screenshots'

const EVENT_ICONS: Record<string, React.ReactNode> = {
  test_start: <Flag className="h-4 w-4 text-green-600" />,
  browser_init_start: <Monitor className="h-4 w-4 text-blue-600" />,
  browser_init_complete: <Monitor className="h-4 w-4 text-blue-600" />,
  page_load_start: <Loader className="h-4 w-4 text-purple-600" />,
  page_load_complete: <Loader className="h-4 w-4 text-purple-600" />,
  screenshot_captured: <Camera className="h-4 w-4 text-gray-600" />,
  start_button_search_start: <MousePointer className="h-4 w-4 text-orange-600" />,
  start_button_found: <MousePointer className="h-4 w-4 text-orange-600" />,
  start_button_clicked: <MousePointer className="h-4 w-4 text-orange-600" />,
  console_logs_collected: <Terminal className="h-4 w-4 text-gray-600" />,
  gameplay_start: <Gamepad className="h-4 w-4 text-indigo-600" />,
  gameplay_complete: <Gamepad className="h-4 w-4 text-indigo-600" />,
  evaluation_start: <Star className="h-4 w-4 text-yellow-600" />,
  evaluation_complete: <Star className="h-4 w-4 text-yellow-600" />,
  error: <AlertCircle className="h-4 w-4 text-red-600" />,
  phase_change: <CheckCircle className="h-4 w-4 text-green-600" />,
  test_complete: <CheckCircle className="h-4 w-4 text-green-600" />,
}

function Terminal(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  )
}

export function TimelineViewer({ events, screenshots = [], className }: TimelineViewerProps) {
  const [filter, setFilter] = useState<EventFilter>('all')
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)

  const filteredEvents = events.filter((event) => {
    if (filter === 'errors') return event.type === 'error'
    if (filter === 'screenshots') return event.type === 'screenshot_captured'
    return true
  })

  const getScreenshotForEvent = (event: TimelineEvent): string | null => {
    if (event.type === 'screenshot_captured' && event.metadata?.url) {
      return event.metadata.url as string
    }
    return null
  }

  const totalDuration = events.length > 0 
    ? events[events.length - 1]?.elapsedMs || 0
    : 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Test Execution Timeline</h3>
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length} events • {formatDuration(totalDuration)} total
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-all"
              checked={filter === 'all'}
              onCheckedChange={() => setFilter('all')}
            />
            <Label htmlFor="filter-all" className="text-sm">All Events</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-errors"
              checked={filter === 'errors'}
              onCheckedChange={() => setFilter('errors')}
            />
            <Label htmlFor="filter-errors" className="text-sm">Errors Only</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-screenshots"
              checked={filter === 'screenshots'}
              onCheckedChange={() => setFilter('screenshots')}
            />
            <Label htmlFor="filter-screenshots" className="text-sm">Screenshots</Label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* Events */}
                <div className="space-y-6">
                  {filteredEvents.map((event, index) => {
                    const screenshot = getScreenshotForEvent(event)
                    const isSelected = selectedEvent === event
                    const isError = event.type === 'error'

                    return (
                      <div
                        key={index}
                        className={cn(
                          'relative pl-12 cursor-pointer transition-colors',
                          isSelected && 'bg-accent/50 -mx-3 px-3 py-2 rounded-lg'
                        )}
                        onClick={() => setSelectedEvent(event)}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            'absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background',
                            isError && 'border-red-600',
                            !isError && 'border-border'
                          )}
                        >
                          {EVENT_ICONS[event.type] || <Clock className="h-4 w-4" />}
                        </div>

                        {/* Content */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatDuration(event.elapsedMs)}
                                </span>
                                <Badge variant={isError ? 'destructive' : 'secondary'} className="text-xs">
                                  {event.type.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium">{event.description}</p>
                            </div>
                          </div>

                          {/* Screenshot thumbnail */}
                          {screenshot && (
                            <div className="relative h-32 w-48 rounded overflow-hidden border">
                              <Image
                                src={screenshot}
                                alt={`Screenshot at ${event.elapsedMs}ms`}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}

                          {/* Metadata preview */}
                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {Object.keys(event.metadata).length} metadata items
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Details Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Event Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEvent ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Type</div>
                    <Badge variant="secondary">
                      {selectedEvent.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <Separator />

                  <div>
                    <div className="text-sm font-medium mb-1">Time</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(selectedEvent.elapsedMs)} elapsed
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(selectedEvent.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="text-sm font-medium mb-2">Description</div>
                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.description}
                    </p>
                  </div>

                  {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-sm font-medium mb-2">Metadata</div>
                        <div className="rounded-md bg-muted p-3 font-mono text-xs overflow-auto max-h-64">
                          <pre>{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Click on an event to see details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

