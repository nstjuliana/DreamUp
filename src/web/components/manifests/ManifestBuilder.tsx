'use client'

import { useState } from 'react'
import { Plus, Trash2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { GAME_TYPES, KEYBOARD_KEYS, MOUSE_ACTIONS } from '@/lib/constants'
import type { ManifestData } from '@/lib/types'

interface ManifestBuilderProps {
  initialData?: ManifestData | null
  onSave: (data: ManifestData) => void
  isSubmitting?: boolean
}

export function ManifestBuilder({ initialData, onSave, isSubmitting }: ManifestBuilderProps) {
  const [gameType, setGameType] = useState<string>(initialData?.gameType || 'other')
  const [primaryKeys, setPrimaryKeys] = useState<string[]>(initialData?.controls.primary || [])
  const [secondaryKeys, setSecondaryKeys] = useState<string[]>(initialData?.controls.secondary || [])
  const [useMouse, setUseMouse] = useState<boolean>(initialData?.controls.mouse || false)
  const [mouseActions, setMouseActions] = useState<string[]>(
    initialData?.controls.mouseActions || []
  )

  // Gameplay config
  const [loadingDuration, setLoadingDuration] = useState<number>(
    initialData?.loadingDuration !== undefined ? initialData.loadingDuration : 3000
  )
  const [gameplayDuration, setGameplayDuration] = useState<number>(
    initialData?.gameplayDuration !== undefined ? initialData.gameplayDuration : 45000
  )
  const [gameplayGoal, setGameplayGoal] = useState<string>(
    initialData?.gameplayGoal || 'Play the game as effectively as possible'
  )
  const [aiDecisionInterval, setAiDecisionInterval] = useState<number>(
    initialData?.aiDecisionInterval !== undefined ? initialData.aiDecisionInterval : 2000
  )

  const [notes, setNotes] = useState<string>(initialData?.notes || '')

  const handleAddKey = (key: string, type: 'primary' | 'secondary') => {
    if (type === 'primary' && !primaryKeys.includes(key)) {
      setPrimaryKeys([...primaryKeys, key])
    } else if (type === 'secondary' && !secondaryKeys.includes(key)) {
      setSecondaryKeys([...secondaryKeys, key])
    }
  }

  const handleRemoveKey = (key: string, type: 'primary' | 'secondary') => {
    if (type === 'primary') {
      setPrimaryKeys(primaryKeys.filter((k) => k !== key))
    } else {
      setSecondaryKeys(secondaryKeys.filter((k) => k !== key))
    }
  }

  const handleMouseActionToggle = (action: string) => {
    if (mouseActions.includes(action)) {
      setMouseActions(mouseActions.filter((a) => a !== action))
    } else {
      setMouseActions([...mouseActions, action])
    }
  }

  const handleSubmit = () => {
    // Determine version number - if editing, keep existing version, otherwise use 1.0
    const versionNumber = initialData?.version || '1.0'
    
    const manifestData: ManifestData = {
      version: versionNumber,
      gameType: gameType as any,
      controls: {
        primary: primaryKeys,
        secondary: secondaryKeys.length > 0 ? secondaryKeys : undefined,
        mouse: useMouse,
        mouseActions: mouseActions.length > 0 ? (mouseActions as any) : undefined,
      },
      loadingDuration,
      gameplayDuration,
      gameplayGoal,
      // Explicitly include aiDecisionInterval even if 0 (0 is a valid value to disable delays)
      aiDecisionInterval: aiDecisionInterval,
      notes: notes || undefined,
    }

    // Debug: log the value being sent
    console.log('Submitting manifest with aiDecisionInterval:', manifestData.aiDecisionInterval)

    onSave(manifestData)
  }

  const generatedJSON = JSON.stringify(
    {
      version: '1.0',
      gameType,
      controls: {
        primary: primaryKeys,
        secondary: secondaryKeys.length > 0 ? secondaryKeys : undefined,
        mouse: useMouse,
        mouseActions: mouseActions.length > 0 ? mouseActions : undefined,
      },
      loadingDuration,
      gameplayDuration,
      gameplayGoal,
      // Explicitly include aiDecisionInterval even if 0 (0 is a valid value)
      aiDecisionInterval: typeof aiDecisionInterval === 'number' ? aiDecisionInterval : undefined,
      notes: notes || undefined,
    },
    null,
    2
  )

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Game Type */}
        <Card>
          <CardHeader>
            <CardTitle>Game Type</CardTitle>
            <CardDescription>
              Select the type of game to help the QA agent use appropriate testing strategies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={gameType} onValueChange={setGameType}>
              <SelectTrigger>
                <SelectValue placeholder="Select game type" />
              </SelectTrigger>
              <SelectContent>
                {GAME_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>
              Define the keyboard and mouse controls used in the game
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary Keys */}
            <div className="space-y-3">
              <Label>Primary Keys</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {primaryKeys.map((key) => (
                  <Badge key={key} variant="secondary" className="gap-2">
                    {key}
                    <button
                      onClick={() => handleRemoveKey(key, 'primary')}
                      className="hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => handleAddKey(value, 'primary')}>
                <SelectTrigger>
                  <SelectValue placeholder="Add primary key..." />
                </SelectTrigger>
                <SelectContent>
                  {KEYBOARD_KEYS.filter((k) => !primaryKeys.includes(k)).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secondary Keys */}
            <div className="space-y-3">
              <Label>Secondary Keys (Optional)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {secondaryKeys.map((key) => (
                  <Badge key={key} variant="outline" className="gap-2">
                    {key}
                    <button
                      onClick={() => handleRemoveKey(key, 'secondary')}
                      className="hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(value) => handleAddKey(value, 'secondary')}>
                <SelectTrigger>
                  <SelectValue placeholder="Add secondary key..." />
                </SelectTrigger>
                <SelectContent>
                  {KEYBOARD_KEYS.filter((k) => !secondaryKeys.includes(k)).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Mouse Controls */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-mouse"
                  checked={useMouse}
                  onCheckedChange={(checked) => setUseMouse(checked as boolean)}
                />
                <Label htmlFor="use-mouse">Game uses mouse input</Label>
              </div>

              {useMouse && (
                <div className="ml-6 space-y-2">
                  <Label>Mouse Actions</Label>
                  {MOUSE_ACTIONS.map((action) => (
                    <div key={action} className="flex items-center space-x-2">
                      <Checkbox
                        id={`mouse-${action}`}
                        checked={mouseActions.includes(action)}
                        onCheckedChange={() => handleMouseActionToggle(action)}
                      />
                      <Label htmlFor={`mouse-${action}`} className="capitalize">
                        {action}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gameplay Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Gameplay Configuration</CardTitle>
            <CardDescription>
              Configure how the AI agent will play and test the game
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loading-duration">Loading Duration (ms)</Label>
              <Input
                id="loading-duration"
                type="number"
                value={loadingDuration}
                onChange={(e) => setLoadingDuration(parseInt(e.target.value) || 0)}
                step={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gameplay-duration">Gameplay Duration (ms)</Label>
              <Input
                id="gameplay-duration"
                type="number"
                value={gameplayDuration}
                onChange={(e) => setGameplayDuration(parseInt(e.target.value) || 0)}
                step={5000}
              />
              <p className="text-xs text-muted-foreground">
                How long the AI should play the game (default: 45000ms)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gameplay-goal">Gameplay Goal</Label>
              <Textarea
                id="gameplay-goal"
                value={gameplayGoal}
                onChange={(e) => setGameplayGoal(e.target.value)}
                rows={3}
                placeholder="e.g., Collect as many coins as possible while avoiding enemies"
              />
              <p className="text-xs text-muted-foreground">
                Describe what the AI should try to achieve while playing
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-interval">AI Decision Interval (ms)</Label>
              <Input
                id="ai-interval"
                type="number"
                value={aiDecisionInterval}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                  setAiDecisionInterval(isNaN(value) ? 0 : value)
                }}
                min={0}
                step={500}
              />
              <p className="text-xs text-muted-foreground">
                Time between AI decisions during gameplay (default: 2000ms). Set to 0 to disable delays.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Version Notes</CardTitle>
            <CardDescription>
              Add notes about this manifest version for future reference
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="e.g., Updated controls after game patch 2.0..."
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Manifest'}
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-base">JSON Preview</CardTitle>
            <CardDescription>Generated manifest configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4 font-mono text-xs overflow-auto max-h-[600px]">
              <pre>{generatedJSON}</pre>
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                This manifest will be stored as version-controlled configuration for this game
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

