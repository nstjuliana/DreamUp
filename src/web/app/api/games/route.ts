import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const createGameSchema = z.object({
  game_url: z.string().url('Invalid URL'),
  name: z.string().min(1, 'Name is required'),
  game_type: z.enum(['puzzle', 'platformer', 'idle', 'shooter', 'rpg', 'other']).nullable(),
  description: z.string().nullable().optional(),
})

// GET /api/games - List all games
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gameType = searchParams.get('type')
    const search = searchParams.get('search')

    let query = supabase
      .from('games')
      .select('*')
      .order('updated_at', { ascending: false })

    if (gameType && gameType !== 'all') {
      query = query.eq('game_type', gameType)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,game_url.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch games', details: error.message },
        { status: 500 }
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

// POST /api/games - Create a new game
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validated = createGameSchema.parse(body)

    // Check if game URL already exists
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('game_url', validated.game_url)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A game with this URL already exists' },
        { status: 409 }
      )
    }

    // Create game
    const { data, error } = await supabase
      .from('games')
      .insert(validated)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create game', details: error.message },
        { status: 500 }
      )
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

