import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const createManifestSchema = z.object({
  version_name: z.string().min(1, 'Version name is required'),
  manifest_data: z.object({}).passthrough(), // Accept any valid JSON object
  is_active: z.boolean().default(false),
  notes: z.string().nullable().optional(),
})

// GET /api/games/[id]/manifests - List all manifests for a game
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('game_manifests')
      .select('*')
      .eq('game_id', params.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch manifests', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/games/[id]/manifests - Create a new manifest
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = createManifestSchema.parse(body)

    // If this manifest should be active, deactivate others first
    if (validated.is_active) {
      await supabase
        .from('game_manifests')
        .update({ is_active: false })
        .eq('game_id', params.id)
    }

    // Create manifest
    const { data, error } = await supabase
      .from('game_manifests')
      .insert({
        ...validated,
        game_id: params.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create manifest', details: error.message },
        { status: 500 }
      )
    }

    // Update game's active_manifest_id if this is active
    if (validated.is_active) {
      await supabase
        .from('games')
        .update({ active_manifest_id: data.id })
        .eq('id', params.id)
    }

    return NextResponse.json(data, { status: 201 })
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

