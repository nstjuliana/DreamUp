/**
 * File: src/agent/timeline.ts
 * 
 * Timeline tracking for test execution.
 * 
 * This module provides functionality to track timestamped events throughout
 * test execution, enabling detailed debugging and rich timeline visualization
 * in the Web UI. Events include browser initialization, page loads, screenshots,
 * interactions, and errors.
 * 
 * @module Timeline
 */

/**
 * Timeline event type.
 * 
 * Defines all possible event types that can be recorded during test execution.
 */
export type TimelineEventType =
  | 'test_start'
  | 'browser_init_start'
  | 'browser_init_complete'
  | 'stagehand_init_complete'
  | 'page_load_start'
  | 'page_load_complete'
  | 'screenshot_captured'
  | 'start_button_search_start'
  | 'start_button_found'
  | 'start_button_not_found'
  | 'start_button_clicked'
  | 'console_logs_collected'
  | 'gameplay_start'
  | 'gameplay_action'
  | 'gameplay_action_skipped'
  | 'gameplay_complete'
  | 'evaluation_start'
  | 'evaluation_complete'
  | 'error'
  | 'phase_change'
  | 'test_complete';

/**
 * Timeline event interface.
 * 
 * Represents a single timestamped event during test execution.
 */
export interface TimelineEvent {
  /** Event type identifier */
  type: TimelineEventType;
  
  /** ISO 8601 timestamp when event occurred */
  timestamp: string;
  
  /** Milliseconds since test start */
  elapsedMs: number;
  
  /** Human-readable event description */
  description: string;
  
  /** Optional additional event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Timeline interface.
 * 
 * Contains the full timeline of events for a test run.
 */
export interface Timeline {
  /** Test start timestamp (ISO 8601) */
  startTime: string;
  
  /** Array of timeline events in chronological order */
  events: TimelineEvent[];
}

/**
 * Create a new timeline.
 * 
 * Initializes an empty timeline with the current timestamp as start time.
 * Automatically adds a 'test_start' event.
 * 
 * @returns {Timeline} New timeline instance
 * 
 * @example
 * ```typescript
 * const timeline = createTimeline();
 * console.log(`Test started at: ${timeline.startTime}`);
 * ```
 */
export function createTimeline(): Timeline {
  const startTime = new Date().toISOString();
  
  return {
    startTime,
    events: [
      {
        type: 'test_start',
        timestamp: startTime,
        elapsedMs: 0,
        description: 'Test execution started',
      },
    ],
  };
}

/**
 * Add an event to the timeline.
 * 
 * Appends a new event to the timeline with automatic timestamp and elapsed time
 * calculation. Events are added in chronological order.
 * 
 * @param {Timeline} timeline - Timeline to add event to
 * @param {TimelineEventType} type - Event type
 * @param {string} description - Human-readable event description
 * @param {Record<string, unknown>} [metadata] - Optional additional event data
 * @returns {Timeline} Updated timeline
 * 
 * @example
 * ```typescript
 * timeline = addEvent(timeline, 'page_load_start', 'Navigating to game URL', {
 *   url: 'https://example.com/game'
 * });
 * ```
 */
export function addEvent(
  timeline: Timeline,
  type: TimelineEventType,
  description: string,
  metadata?: Record<string, unknown>
): Timeline {
  const timestamp = new Date().toISOString();
  const startTimeMs = new Date(timeline.startTime).getTime();
  const currentTimeMs = new Date(timestamp).getTime();
  const elapsedMs = currentTimeMs - startTimeMs;

  const event: TimelineEvent = {
    type,
    timestamp,
    elapsedMs,
    description,
    metadata,
  };

  return {
    ...timeline,
    events: [...timeline.events, event],
  };
}

/**
 * Get all events from timeline.
 * 
 * Returns the complete array of timeline events in chronological order.
 * 
 * @param {Timeline} timeline - Timeline to get events from
 * @returns {TimelineEvent[]} Array of timeline events
 * 
 * @example
 * ```typescript
 * const events = getEvents(timeline);
 * console.log(`Total events: ${events.length}`);
 * ```
 */
export function getEvents(timeline: Timeline): TimelineEvent[] {
  return timeline.events;
}

/**
 * Get timeline duration in milliseconds.
 * 
 * Calculates the total duration from timeline start to the last event,
 * or to current time if no events exist.
 * 
 * @param {Timeline} timeline - Timeline to calculate duration for
 * @returns {number} Duration in milliseconds
 * 
 * @example
 * ```typescript
 * const duration = getDuration(timeline);
 * console.log(`Test duration: ${duration}ms`);
 * ```
 */
export function getDuration(timeline: Timeline): number {
  if (timeline.events.length === 0) {
    return 0;
  }

  const lastEvent = timeline.events[timeline.events.length - 1];
  return lastEvent?.elapsedMs || 0;
}

/**
 * Format timeline as human-readable text.
 * 
 * Creates a formatted text representation of the timeline showing event
 * sequence with timestamps and durations between events. Useful for debugging
 * and console output.
 * 
 * @param {Timeline} timeline - Timeline to format
 * @returns {string} Formatted timeline text
 * 
 * @example
 * ```typescript
 * const formatted = formatTimeline(timeline);
 * console.log(formatted);
 * ```
 */
export function formatTimeline(timeline: Timeline): string {
  if (timeline.events.length === 0) {
    return 'Timeline: No events recorded';
  }

  const lines: string[] = [
    '=== Test Timeline ===',
    `Start Time: ${timeline.startTime}`,
    `Total Duration: ${getDuration(timeline)}ms`,
    '',
    'Events:',
  ];

  let previousElapsed = 0;

  for (const event of timeline.events) {
    const delta = event.elapsedMs - previousElapsed;
    const deltaStr = previousElapsed === 0 ? '' : ` (+${delta}ms)`;
    
    lines.push(
      `  [${event.elapsedMs}ms${deltaStr}] ${event.type}: ${event.description}`
    );

    if (event.metadata && Object.keys(event.metadata).length > 0) {
      const metadataStr = JSON.stringify(event.metadata, null, 2)
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n');
      lines.push(metadataStr);
    }

    previousElapsed = event.elapsedMs;
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get events of a specific type.
 * 
 * Filters timeline events by type, useful for finding specific categories
 * of events (e.g., all errors, all screenshots).
 * 
 * @param {Timeline} timeline - Timeline to filter
 * @param {TimelineEventType} type - Event type to filter by
 * @returns {TimelineEvent[]} Array of matching events
 * 
 * @example
 * ```typescript
 * const errors = getEventsByType(timeline, 'error');
 * console.log(`Errors encountered: ${errors.length}`);
 * ```
 */
export function getEventsByType(
  timeline: Timeline,
  type: TimelineEventType
): TimelineEvent[] {
  return timeline.events.filter(event => event.type === type);
}

/**
 * Get duration between two event types.
 * 
 * Calculates the time elapsed between the first occurrence of two event types.
 * Returns null if either event type is not found.
 * 
 * @param {Timeline} timeline - Timeline to analyze
 * @param {TimelineEventType} startType - Starting event type
 * @param {TimelineEventType} endType - Ending event type
 * @returns {number | null} Duration in milliseconds, or null if events not found
 * 
 * @example
 * ```typescript
 * const loadTime = getDurationBetween(timeline, 'page_load_start', 'page_load_complete');
 * if (loadTime !== null) {
 *   console.log(`Page load took ${loadTime}ms`);
 * }
 * ```
 */
export function getDurationBetween(
  timeline: Timeline,
  startType: TimelineEventType,
  endType: TimelineEventType
): number | null {
  const startEvent = timeline.events.find(e => e.type === startType);
  const endEvent = timeline.events.find(e => e.type === endType);

  if (!startEvent || !endEvent) {
    return null;
  }

  return endEvent.elapsedMs - startEvent.elapsedMs;
}

