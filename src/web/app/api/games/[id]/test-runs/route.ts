import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { QAAgent } from '@shared/agent/qa-agent'

// GET /api/games/[id]/test-runs - List test runs for a game
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const { data, error } = await supabase
      .from('test_runs')
      .select('*')
      .eq('game_id', params.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch test runs', details: error.message },
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

// POST /api/games/[id]/test-runs - Create and execute a new test run
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { manifestId } = body

    // Fetch game data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', params.id)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Fetch manifest data if provided
    let manifestData = null
    if (manifestId && manifestId !== 'none') {
      const { data: manifest, error: manifestError } = await supabase
        .from('game_manifests')
        .select('*')
        .eq('id', manifestId)
        .single()

      if (!manifestError && manifest) {
        manifestData = manifest.manifest_data
      }
    }

    // Create a test run record with 'in_progress' status
    const { data: testRun, error: testRunError } = await supabase
      .from('test_runs')
      .insert({
        game_id: params.id,
        manifest_id: manifestId && manifestId !== 'none' ? manifestId : null,
        status: 'in_progress',
        metadata: {
          startedAt: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (testRunError || !testRun) {
      console.error('Error creating test run:', testRunError)
      return NextResponse.json(
        { error: 'Failed to create test run' },
        { status: 500 }
      )
    }

    // Execute the QA agent asynchronously
    // We'll start it and return immediately with the test run ID and live view URL
    const agent = new QAAgent()
    
    // Execute in background (don't await)
    agent.executeTest({
      gameUrl: game.url,
      gameName: game.name,
      gameType: game.game_type || undefined,
      manifest: manifestData || undefined,
    }).then(async (result) => {
      // Update test run with results
      await supabase
        .from('test_runs')
        .update({
          status: result.status,
          playability_score: result.playabilityScore,
          issues: result.issues,
          screenshots: result.screenshots,
          console_logs: result.consoleLogs,
          metadata: {
            ...result.metadata,
            testId: result.testId,
            timeline: result.timeline,
          },
          execution_time_ms: result.executionTimeMs,
          completed_at: new Date().toISOString(),
        })
        .eq('id', testRun.id)
    }).catch(async (error) => {
      console.error('QA agent execution error:', error)
      // Update test run with error status
      await supabase
        .from('test_runs')
        .update({
          status: 'error',
          metadata: {
            error: error.message || 'Test execution failed',
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', testRun.id)
    })

    // Get the BrowserBase session URL
    // The agent will initialize the browser and we can extract the URL
    // For now, we'll return the test run ID and the client can poll for updates
    const liveViewUrl = null // Will be populated after browser init

    return NextResponse.json({
      testRunId: testRun.id,
      liveViewUrl,
      message: 'Test started successfully',
    })
  } catch (error) {
    console.error('Error starting test:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

