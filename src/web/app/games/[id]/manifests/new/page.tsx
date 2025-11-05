'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ManifestBuilder } from '@/components/manifests/ManifestBuilder'
import { useToast } from '@/hooks/use-toast'
import type { ManifestData } from '@/lib/types'

export default function NewManifestPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [setAsActive, setSetAsActive] = useState(true)

  const gameId = params.id as string

  const handleSave = async (manifestData: ManifestData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/games/${gameId}/manifests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest_data: manifestData,
          is_active: setAsActive,
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

      <ManifestBuilder onSave={handleSave} isSubmitting={isSubmitting} />
    </div>
  )
}

