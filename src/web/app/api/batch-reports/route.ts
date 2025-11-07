import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/batch-reports
 * List all batch reports with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data, error } = await supabase
      .from('batch_reports')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching batch reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch batch reports' },
        { status: 500 }
      )
    }

    // Get total count
    const { count } = await supabase
      .from('batch_reports')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/batch-reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/batch-reports
 * Create a new batch report (for future web-initiated batches)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('batch_reports')
      .insert({
        batch_name: body.batch_name || null,
        status: 'running',
        total_tests: body.total_tests || 0,
        passed_tests: 0,
        failed_tests: 0,
        error_tests: 0,
        test_run_ids: [],
        execution_method: 'web',
        metadata: body.metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating batch report:', error)
      return NextResponse.json(
        { error: 'Failed to create batch report' },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/batch-reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

