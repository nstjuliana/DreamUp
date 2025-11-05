'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Copy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ManifestBuilder } from '@/components/manifests/ManifestBuilder'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { ManifestData, GameManifest } from '@/lib/types'

export default function EditManifestPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [setAsActive, setSetAsActive] = useState(false)
  const [manifest, setManifest] = useState<GameManifest | null>(null)

  const gameId = params.id as string
  const manifestId = params.manifestId as string

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/manifests/${manifestId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch manifest')
        }
        const data = await response.json()
        setManifest(data)
        setSetAsActive(data.is_active)
      } catch (error) {
        console.error('Error fetching manifest:', error)
        toast({
          title: 'Error',
          description: 'Failed to load manifest',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchManifest()
  }, [gameId, manifestId, toast])

  const handleSave = async (manifestData: ManifestData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/games/${gameId}/manifests/${manifestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest_data: manifestData,
          is_active: setAsActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update manifest')
      }

      toast({
        title: 'Success',
        description: 'Manifest updated successfully',
      })

      router.push(`/games/${gameId}`)
    } catch (error) {
      console.error('Error updating manifest:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update manifest',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDuplicate = async () => {
    if (!manifest) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/games/${gameId}/manifests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest_data: {
            ...manifest.manifest_data,
            notes: `Duplicated from version ${manifest.version_number || 'N/A'}. ${manifest.manifest_data.notes || ''}`,
          },
          is_active: false,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to duplicate manifest')
      }

      const newManifest = await response.json()

      toast({
        title: 'Success',
        description: 'Manifest duplicated successfully',
      })

      router.push(`/games/${gameId}/manifests/${newManifest.id}/edit`)
    } catch (error) {
      console.error('Error duplicating manifest:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate manifest',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!manifest) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Manifest not found</p>
        <Link href={`/games/${gameId}`}>
          <Button className="mt-4">Back to Game</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/games/${gameId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Manifest</h1>
            <p className="text-muted-foreground">
              Version {manifest.version_number || 'N/A'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleDuplicate}
          disabled={isSubmitting}
        >
          <Copy className="h-4 w-4 mr-2" />
          Duplicate as New Version
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-muted/50 p-4 rounded-lg">
        <Checkbox
          id="set-active"
          checked={setAsActive}
          onCheckedChange={(checked) => setSetAsActive(checked as boolean)}
        />
        <Label htmlFor="set-active" className="cursor-pointer">
          Set this manifest as the active version
        </Label>
      </div>

      <ManifestBuilder
        initialData={manifest.manifest_data}
        onSave={handleSave}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

