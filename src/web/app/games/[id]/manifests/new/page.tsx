'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ManifestBuilder } from '@/components/manifests/ManifestBuilder'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { ManifestData, GameManifest } from '@/lib/types'

function calculateNextVersion(existingManifests: GameManifest[]): string {
  if (existingManifests.length === 0) {
    return 'v1.0'
  }

  // Extract version numbers from existing manifests
  const versions = existingManifests
    .map((m) => {
      // Parse version_name like "v1.0", "v1.1", "v2.0", etc.
      const match = m.version_name.match(/^v?(\d+)\.(\d+)$/i)
      if (match) {
        return { major: parseInt(match[1]), minor: parseInt(match[2]) }
      }
      return null
    })
    .filter((v): v is { major: number; minor: number } => v !== null)

  if (versions.length === 0) {
    return 'v1.0'
  }

  // Find the highest version
  const highestVersion = versions.reduce((max, v) => {
    if (v.major > max.major) return v
    if (v.major === max.major && v.minor > max.minor) return v
    return max
  }, versions[0])

  // Increment minor version
  return `v${highestVersion.major}.${highestVersion.minor + 1}`
}

export default function NewManifestPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [setAsActive, setSetAsActive] = useState(true)
  const [versionName, setVersionName] = useState<string>('v1.0')
  const [existingManifests, setExistingManifests] = useState<GameManifest[]>([])

  const gameId = params.id as string

  useEffect(() => {
    const fetchManifests = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/manifests`)
        if (!response.ok) {
          throw new Error('Failed to fetch manifests')
        }
        const manifests = await response.json()
        setExistingManifests(manifests)
        setVersionName(calculateNextVersion(manifests))
      } catch (error) {
        console.error('Error fetching manifests:', error)
        toast({
          title: 'Warning',
          description: 'Could not fetch existing manifests. Using default version.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchManifests()
  }, [gameId, toast])

  const handleSave = async (manifestData: ManifestData) => {
    setIsSubmitting(true)
    try {
      // Extract version number from version_name (e.g., "v1.0" -> "1.0")
      const versionMatch = versionName.match(/^v?(\d+\.\d+)$/i)
      const versionNumber = versionMatch ? versionMatch[1] : '1.0'
      
      // Update manifest_data with the correct version number
      const updatedManifestData: ManifestData = {
        ...manifestData,
        version: versionNumber,
      }
      
      const response = await fetch(`/api/games/${gameId}/manifests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_name: versionName,
          manifest_data: updatedManifestData,
          is_active: setAsActive,
          notes: manifestData.notes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create manifest')
      }

      toast({
        title: 'Success',
        description: 'Manifest created successfully',
      })

      router.push(`/games/${gameId}`)
    } catch (error) {
      console.error('Error creating manifest:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create manifest',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/games/${gameId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create New Manifest</h1>
          <p className="text-muted-foreground">
            Define how the QA agent should interact with this game
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-muted/50 p-4 rounded-lg">
        <Checkbox
          id="set-active"
          checked={setAsActive}
          onCheckedChange={(checked) => setSetAsActive(checked as boolean)}
        />
        <Label htmlFor="set-active" className="cursor-pointer">
          Set this manifest as the active version after creation
        </Label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Version Information</CardTitle>
          <CardDescription>
            Version name for this manifest version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="version-name">Version Name</Label>
            <Input
              id="version-name"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g., v1.1, v2.0"
            />
            <p className="text-xs text-muted-foreground">
              Version name is automatically calculated based on existing manifests. You can edit it if needed.
            </p>
          </div>
        </CardContent>
      </Card>

      <ManifestBuilder onSave={handleSave} isSubmitting={isSubmitting} />
    </div>
  )
}

