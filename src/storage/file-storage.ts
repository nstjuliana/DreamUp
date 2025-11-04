/**
 * File: src/storage/file-storage.ts
 * 
 * Supabase Storage client for file operations.
 * 
 * This module handles uploading screenshots and console logs to Supabase Storage.
 * It provides functions for creating storage buckets and uploading files with proper
 * error handling and path organization.
 * 
 * @module FileStorage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../utils/config.js';
import { StorageError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Storage bucket name for test artifacts.
 */
const ARTIFACTS_BUCKET = 'artifacts';

/**
 * Supabase client instance for storage operations.
 */
let storageClient: SupabaseClient | null = null;

/**
 * Cache for bucket existence check to avoid repeated checks.
 */
let bucketExistsChecked = false;

/**
 * Initialize storage client.
 * 
 * Creates a Supabase client configured for storage operations.
 * Uses service role key for admin access to storage buckets.
 * 
 * @returns {SupabaseClient} Configured Supabase client
 */
function getStorageClient(): SupabaseClient {
  if (!storageClient) {
    const config = getConfig();
    storageClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );
  }
  return storageClient;
}

/**
 * Ensure artifacts bucket exists.
 * 
 * Checks if the artifacts bucket exists and creates it if needed.
 * Bucket is configured for public access to allow direct URL access.
 * Uses caching to avoid repeated checks - only checks once per process.
 * 
 * @returns {Promise<void>}
 * @throws {StorageError} If bucket creation fails
 */
export async function ensureBucketExists(): Promise<void> {
  // Cache check to avoid repeated API calls
  if (bucketExistsChecked) {
    return;
  }
  
  const client = getStorageClient();
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    
    if (listError) {
      throw new StorageError('Failed to list storage buckets', { error: listError });
    }
    
    const bucketExists = buckets?.some(b => b.name === ARTIFACTS_BUCKET);
    
    if (!bucketExists) {
      // Create bucket with public access
      const { error: createError } = await client.storage.createBucket(ARTIFACTS_BUCKET, {
        public: true,
        fileSizeLimit: 52428800, // 50 MB
      });
      
      if (createError) {
        throw new StorageError('Failed to create artifacts bucket', { error: createError });
      }
      
      logger.info('Artifacts bucket created', { bucket: ARTIFACTS_BUCKET });
    }
    
    // Mark as checked after successful check or creation
    bucketExistsChecked = true;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Failed to ensure bucket exists', { error });
  }
}

/**
 * Upload screenshot to Supabase Storage.
 * 
 * Uploads a screenshot buffer to Supabase Storage and returns the public URL.
 * Files are organized by test ID: artifacts/{testId}/screenshots/{index}.png
 * 
 * @param {Buffer} buffer - Screenshot image buffer
 * @param {string} testId - Unique test run identifier
 * @param {number} index - Screenshot index (for ordering multiple screenshots)
 * @returns {Promise<string>} Public URL of uploaded screenshot
 * @throws {StorageError} If upload fails
 * 
 * @example
 * ```typescript
 * const url = await uploadScreenshot(imageBuffer, 'test-123', 0);
 * console.log(`Screenshot uploaded: ${url}`);
 * ```
 */
export async function uploadScreenshot(
  buffer: Buffer,
  testId: string,
  index: number
): Promise<string> {
  const client = getStorageClient();
  
  // Ensure bucket exists before uploading
  await ensureBucketExists();
  
  // Construct file path: artifacts/{testId}/screenshots/{index}.png
  const timestamp = Date.now();
  const fileName = `${String(index).padStart(3, '0')}-${timestamp}.png`;
  const filePath = `${testId}/screenshots/${fileName}`;
  
  try {
    // Upload file to storage
    const { error: uploadError } = await client.storage
      .from(ARTIFACTS_BUCKET)
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: false,
      });
    
    if (uploadError) {
      throw new StorageError('Failed to upload screenshot', {
        testId,
        index,
        path: filePath,
        error: uploadError,
      });
    }
    
    // Get public URL
    const { data: urlData } = client.storage
      .from(ARTIFACTS_BUCKET)
      .getPublicUrl(filePath);
    
    logger.info('Screenshot uploaded', { testId, index, url: urlData.publicUrl });
    return urlData.publicUrl;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Failed to upload screenshot', {
      testId,
      index,
      error,
    });
  }
}

/**
 * Upload console logs to Supabase Storage.
 * 
 * Uploads console logs as a text file to Supabase Storage and returns the public URL.
 * Files are organized by test ID: artifacts/{testId}/logs/console.log
 * 
 * @param {string} logs - Console logs content (plain text)
 * @param {string} testId - Unique test run identifier
 * @returns {Promise<string>} Public URL of uploaded log file
 * @throws {StorageError} If upload fails
 * 
 * @example
 * ```typescript
 * const url = await uploadConsoleLogs(logsText, 'test-123');
 * console.log(`Logs uploaded: ${url}`);
 * ```
 */
export async function uploadConsoleLogs(
  logs: string,
  testId: string
): Promise<string> {
  const client = getStorageClient();
  
  // Ensure bucket exists before uploading
  await ensureBucketExists();
  
  // Construct file path: artifacts/{testId}/logs/console.log
  const timestamp = Date.now();
  const fileName = `console-${timestamp}.log`;
  const filePath = `${testId}/logs/${fileName}`;
  
  try {
    // Convert logs string to buffer
    const buffer = Buffer.from(logs, 'utf-8');
    
    // Upload file to storage
    const { error: uploadError } = await client.storage
      .from(ARTIFACTS_BUCKET)
      .upload(filePath, buffer, {
        contentType: 'text/plain',
        upsert: false,
      });
    
    if (uploadError) {
      throw new StorageError('Failed to upload console logs', {
        testId,
        path: filePath,
        error: uploadError,
      });
    }
    
    // Get public URL
    const { data: urlData } = client.storage
      .from(ARTIFACTS_BUCKET)
      .getPublicUrl(filePath);
    
    logger.info('Console logs uploaded', { testId, url: urlData.publicUrl });
    return urlData.publicUrl;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Failed to upload console logs', {
      testId,
      error,
    });
  }
}
