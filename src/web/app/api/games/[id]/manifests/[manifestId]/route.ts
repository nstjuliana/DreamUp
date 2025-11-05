import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const updateManifestSchema = z.object({
  version_name: z.string().min(1).optional(),
  manifest_data: z.object({}).passthrough().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

// GET /api/games/[id]/manifests/[manifestId] - Get a manifest
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; manifestId: string } }
) {
  try {
    const { data, error } = await supabase
      .from('game_manifests')
      .select('*')
      .eq('id', params.manifestId)
      .eq('game_id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Manifest not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/games/[id]/manifests/[manifestId] - Update a manifest
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; manifestId: string } }
) {
  try {
    const body = await request.json()
    const validated = updateManifestSchema.parse(body)

    // If setting as active, deactivate others first
    if (validated.is_active === true) {
      await supabase
        .from('game_manifests')
        .update({ is_active: false })
        .eq('game_id', params.id)
        .neq('id', params.manifestId)
    }

    const { data, error } = await supabase
      .from('game_manifests')
      .update(validated)
      .eq('id', params.manifestId)
      .eq('game_id', params.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to update manifest', details: error?.message },
        { status: 500 }
      )
    }

    // Update game's active_manifest_id if this is now active
    if (validated.is_active === true) {
      await supabase
        .from('games')
        .update({ active_manifest_id: params.manifestId })
        .eq('id', params.id)
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/games/[id]/manifests/[manifestId] - Delete a manifest
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; manifestId: string } }
) {
  try {
    const { error } = await supabase
      .from('game_manifests')
      .delete()
      .eq('id', params.manifestId)
      .eq('game_id', params.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete manifest', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

