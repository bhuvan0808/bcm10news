'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@bcm10/database/admin';
import { createClient } from '@bcm10/database/server';
import { createMediaService } from '@bcm10/storage';
import { mediaUpdateInput, uploadConfirmInput, uploadRequestInput } from '@bcm10/validation';
import { requireNewsroomUser } from '@/lib/auth';
import type { ActionResult } from './articles';

/**
 * Media upload.
 *
 * The flow, and why each step exists:
 *
 *   1. The browser asks for a ticket. The server validates MIME type and size
 *      *before* signing anything, so an oversized or wrong-typed file is
 *      rejected without a byte being transferred.
 *   2. The server signs a PUT bound to that exact content type and length, and
 *      records an `upload_tickets` row.
 *   3. The browser PUTs straight to R2. The bytes never touch this server —
 *      routing a 10 MB camera JPEG through a serverless function wastes its
 *      memory and duration budget, and on a district connection makes the
 *      reporter upload it twice over.
 *   4. The browser confirms. The server checks the object really landed before
 *      writing the `media` row, so the library can never show a broken image.
 *
 * The ticket is what makes step 4 trustworthy: the storage key comes from the
 * server's own record, not from the client, so a client cannot claim a media
 * row for an object it did not upload.
 */

export interface SignedUploadResponse {
  ticketId: string;
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
}

export async function requestUpload(input: unknown): Promise<ActionResult<SignedUploadResponse>> {
  const session = await requireNewsroomUser();

  const parsed = uploadRequestInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? 'That file cannot be uploaded.' };
  }

  const { kind, mimeType, sizeBytes } = parsed.data;

  // Photographers upload; so does anyone in the newsroom. Readers never reach
  // this action at all, but the role check keeps the intent explicit.
  if (!session.profile.is_active) {
    return { ok: false, message: 'This account cannot upload media.' };
  }

  try {
    // The service-role client is used only to sign and to write the ticket:
    // there is no user session on the storage side, and `upload_tickets` is
    // owner-scoped by RLS which the ticket row must be inserted under.
    const admin = createAdminClient();
    const media = createMediaService({ supabaseClient: admin });

    const signed = await media.createSignedUpload({ kind, mimeType, sizeBytes });

    const { data: ticket, error } = await admin
      .from('upload_tickets')
      .insert({
        requested_by: session.profile.id,
        bucket: signed.bucket,
        storage_key: signed.storageKey,
        mime_type: mimeType,
        max_size_bytes: sizeBytes,
        kind,
        expires_at: signed.expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Could not record upload ticket', error.message);
      return { ok: false, message: 'Could not start the upload. Please try again.' };
    }

    return {
      ok: true,
      data: {
        ticketId: ticket.id,
        uploadUrl: signed.uploadUrl,
        storageKey: signed.storageKey,
        headers: signed.headers,
      },
    };
  } catch (cause) {
    console.error('Upload signing failed', cause);
    return { ok: false, message: 'Media storage is not configured. Ask an administrator.' };
  }
}

export async function confirmUpload(input: unknown): Promise<ActionResult<{ mediaId: string }>> {
  const session = await requireNewsroomUser();

  const parsed = uploadConfirmInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Could not confirm the upload.' };

  const admin = createAdminClient();

  const { data: ticket } = await admin
    .from('upload_tickets')
    .select('*')
    .eq('id', parsed.data.ticketId)
    .maybeSingle();

  if (!ticket) return { ok: false, message: 'That upload has expired. Please try again.' };

  // The ticket belongs to whoever requested it. Without this check, one
  // reporter could confirm another's upload and take ownership of the asset.
  if (ticket.requested_by !== session.profile.id) {
    return { ok: false, message: 'That upload does not belong to you.' };
  }

  if (ticket.consumed_at) {
    return { ok: false, message: 'That upload was already registered.' };
  }

  const media = createMediaService({ supabaseClient: admin });

  // Confirm the object exists before claiming it does. A failed PUT that still
  // reported success would otherwise leave a media row pointing at nothing.
  const exists = await media.objectExists(ticket.storage_key);
  if (!exists) {
    return { ok: false, message: 'The file did not finish uploading. Please try again.' };
  }

  const { data: row, error } = await admin
    .from('media')
    .insert({
      kind: ticket.kind,
      bucket: ticket.bucket,
      storage_key: ticket.storage_key,
      driver: media.driver,
      mime_type: ticket.mime_type,
      size_bytes: ticket.max_size_bytes,
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
      blur_data_url: parsed.data.blurDataUrl ?? null,
      dominant_color: parsed.data.dominantColor ?? null,
      alt_text: parsed.data.altText ?? null,
      caption: parsed.data.caption ?? null,
      credit: parsed.data.credit ?? null,
      uploaded_by: session.profile.id,
      photographer_id: session.profile.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Could not register media', error.message);
    return { ok: false, message: 'Could not save the image details.' };
  }

  await admin
    .from('upload_tickets')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', ticket.id);

  revalidatePath('/media');
  return { ok: true, data: { mediaId: row.id } };
}

/**
 * Edits image metadata.
 *
 * Uses the *session* client, not the admin one: RLS decides whether this
 * person may edit this asset (uploader, or editorial), and that is exactly the
 * rule we want enforced.
 */
export async function updateMedia(input: unknown): Promise<ActionResult> {
  await requireNewsroomUser();

  const parsed = mediaUpdateInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.' };

  const supabase = await createClient();
  const { id, ...fields } = parsed.data;

  const { error } = await supabase
    .from('media')
    .update({
      title: fields.title ?? null,
      alt_text: fields.altText ?? null,
      alt_text_te: fields.altTextTe ?? null,
      caption: fields.caption ?? null,
      caption_te: fields.captionTe ?? null,
      credit: fields.credit ?? null,
      copyright: fields.copyright ?? null,
      source: fields.source ?? null,
      photographer_id: fields.photographerId ?? null,
      captured_at: fields.capturedAt ? new Date(fields.capturedAt).toISOString() : null,
    })
    .eq('id', id);

  if (error) {
    return { ok: false, message: 'You do not have permission to edit this image.' };
  }

  revalidatePath('/media');
  return { ok: true, message: 'Image details saved.' };
}
