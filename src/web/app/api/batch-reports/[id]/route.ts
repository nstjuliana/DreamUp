import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/batch-reports/[id]
 * Get a specific batch report with all test run details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Fetch batch report
    const { data: batchReport, error: batchError } = await supabase
      .from('batch_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (batchError || !batchReport) {
      console.error('Error fetching batch report:', batchError)
      return NextResponse.json(
        { error: 'Batch report not found' },
        { status: 404 }
      )
    }

    // Fetch all test runs for this batch
    let testRuns: any[] = []
    if (batchReport.test_run_ids && batchReport.test_run_ids.length > 0) {
      const { data: runs, error: runsError } = await supabase
        .from('test_runs')
        .select(`
          *,
          games (
            id,
            name,
            game_url
          )
        `)
        .in('id', batchReport.test_run_ids)

      if (runsError) {
        console.error('Error fetching test runs:', runsError)
        // Continue without test runs rather than failing
      } else {
        testRuns = runs || []
      }
    }

    return NextResponse.json({
      ...batchReport,
      test_runs: testRuns,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/batch-reports/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

