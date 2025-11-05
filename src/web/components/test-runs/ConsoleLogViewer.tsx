'use client'

import { useState, useMemo } from 'react'
import { AlertCircle, Info, AlertTriangle, Terminal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ConsoleLogEntry {
  type: 'log' | 'warn' | 'error' | 'info'
  timestamp: string
  text: string
}

interface ConsoleLogViewerProps {
  logs: string | ConsoleLogEntry[]
  className?: string
}

export function ConsoleLogViewer({ logs, className }: ConsoleLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showLog, setShowLog] = useState(true)
  const [showWarn, setShowWarn] = useState(true)
  const [showError, setShowError] = useState(true)
  const [showInfo, setShowInfo] = useState(true)

  // Parse logs if they're a string
  const parsedLogs = useMemo(() => {
    if (typeof logs === 'string') {
      // Parse log string format: [TYPE] timestamp message
      return logs.split('\n').filter(Boolean).map((line) => {
        const match = line.match(/^\[(\w+)\]\s+(\S+)\s+(.*)$/)
        if (match) {
          return {
            type: match[1]!.toLowerCase() as ConsoleLogEntry['type'],
            timestamp: match[2]!,
            text: match[3]!,
          }
        }
        return {
          type: 'log' as const,
          timestamp: new Date().toISOString(),
          text: line,
        }
      })
    }
    return logs
  }, [logs])

  // Filter logs
  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((log) => {
      // Type filter
      const typeMatch =
        (log.type === 'log' && showLog) ||
        (log.type === 'warn' && showWarn) ||
        (log.type === 'error' && showError) ||
        (log.type === 'info' && showInfo)

      if (!typeMatch) return false

      // Search filter
      if (searchQuery) {
        return log.text.toLowerCase().includes(searchQuery.toLowerCase())
      }

      return true
    })
  }, [parsedLogs, searchQuery, showLog, showWarn, showError, showInfo])

  const getIcon = (type: ConsoleLogEntry['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Terminal className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getTypeColor = (type: ConsoleLogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'info':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-foreground'
    }
  }

  if (parsedLogs.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        No console logs available
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Label htmlFor="log-search">Search Logs</Label>
          <Input
            id="log-search"
            placeholder="Filter logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-log"
              checked={showLog}
              onCheckedChange={(checked) => setShowLog(checked as boolean)}
            />
            <label
              htmlFor="show-log"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Log
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-info"
              checked={showInfo}
              onCheckedChange={(checked) => setShowInfo(checked as boolean)}
            />
            <label
              htmlFor="show-info"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Info
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-warn"
              checked={showWarn}
              onCheckedChange={(checked) => setShowWarn(checked as boolean)}
            />
            <label
              htmlFor="show-warn"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Warn
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-error"
              checked={showError}
              onCheckedChange={(checked) => setShowError(checked as boolean)}
            />
            <label
              htmlFor="show-error"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Error
            </label>
          </div>
        </div>
      </div>

      {/* Log entries */}
      <Card className="p-0">
        <div className="max-h-[600px] overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No logs match your filters
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
              >
                {getIcon(log.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={cn('font-semibold uppercase text-xs', getTypeColor(log.type))}>
                      {log.type}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap break-words">{log.text}</pre>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        Showing {filteredLogs.length} of {parsedLogs.length} log entries
      </div>
    </div>
  )
}

