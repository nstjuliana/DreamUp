import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const updateGameSchema = z.object({
  name: z.string().min(1).optional(),
  game_type: z.enum(['puzzle', 'platformer', 'idle', 'shooter', 'rpg', 'other']).nullable().optional(),
  description: z.string().nullable().optional(),
})

// GET /api/games/[id] - Get a single game
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Game not found' },
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

// PATCH /api/games/[id] - Update a game
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = updateGameSchema.parse(body)

    const { data, error } = await supabase
      .from('games')
      .update(validated)
      .eq('id', params.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to update game', details: error?.message },
        { status: 500 }
      )
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

// DELETE /api/games/[id] - Delete a game
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete game', details: error.message },
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

