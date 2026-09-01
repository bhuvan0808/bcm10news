'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useRef } from 'react';
import type { ContentDoc } from '@bcm10/validation';
import { parseYouTubeUrl } from '@bcm10/validation';
import { cn } from '@bcm10/ui';
import { NewsroomImage, NewsroomYouTube } from './extensions';
import { EditorToolbar } from './toolbar';

/**
 * The story editor.
 *
 * Design decisions that matter to a working reporter:
 *
 *  • The document is ProseMirror JSON throughout. It is never serialised to
 *    HTML, so nothing can be stored that the renderer would then have to trust.
 *  • `onUpdate` is debounced before it reaches the parent. Tiptap fires on
 *    every keystroke; propagating that would re-render the whole form and make
 *    typing feel heavy on a mid-range phone.
 *  • Pasted YouTube links become video blocks automatically. Reporters paste
 *    links constantly and should never have to find a toolbar button for it.
 *  • `immediatelyRender: false` — Tiptap must not render during SSR, or the
 *    server and client produce different trees and hydration fails.
 */
export function RichTextEditor({
  initialContent,
  onChange,
  onRequestImage,
  placeholder = 'Write the story…',
  editable = true,
  language = 'te',
  className,
}: {
  initialContent: ContentDoc;
  onChange: (doc: ContentDoc) => void;
  onRequestImage?: (
    insert: (attributes: Parameters<Editor['commands']['insertNewsroomImage']>[0]) => void
  ) => void;
  placeholder?: string;
  editable?: boolean;
  language?: 'te' | 'en';
  className?: string;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // Our own image node replaces the StarterKit one, which stores a bare
        // src and loses the media id.
        codeBlock: { HTMLAttributes: { class: 'font-mono text-sm' } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        // Only these schemes become links; a pasted javascript: URL stays text.
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
      }),
      Placeholder.configure({ placeholder }),
      NewsroomImage,
      NewsroomYouTube,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'editor-surface',
        lang: language,
        spellcheck: 'true',
      },
      /*
       * Paste handling: a YouTube link pasted on its own line becomes a video
       * block. Anything else falls through to Tiptap's normal handling.
       */
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain')?.trim();
        if (!text) return false;

        const video = parseYouTubeUrl(text);
        if (!video) return false;

        event.preventDefault();
        const { state, dispatch } = view;
        const node = state.schema.nodes['youtube'];
        if (!node) return false;

        dispatch(
          state.tr.replaceSelectionWith(
            node.create({
              videoId: video.videoId,
              isShort: video.isShort,
              start: video.startSeconds,
            })
          )
        );
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      // Debounced: the parent form re-renders on change, and doing that per
      // keystroke makes typing visibly laggy on a mid-range Android device.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(instance.getJSON() as ContentDoc);
      }, 400);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const insertImage = useCallback(
    (attributes: Parameters<Editor['commands']['insertNewsroomImage']>[0]) => {
      editor?.chain().focus().insertNewsroomImage(attributes).run();
    },
    [editor]
  );

  const requestImage = useCallback(() => {
    onRequestImage?.(insertImage);
  }, [onRequestImage, insertImage]);

  const insertVideo = useCallback(() => {
    const raw = window.prompt('Paste the YouTube link');
    if (!raw) return;

    const video = parseYouTubeUrl(raw);
    if (!video) {
      window.alert('That does not look like a YouTube link.');
      return;
    }

    editor
      ?.chain()
      .focus()
      .insertYouTube({
        videoId: video.videoId,
        isShort: video.isShort,
        start: video.startSeconds,
      })
      .run();
  }, [editor]);

  if (!editor) {
    // Matches the mounted editor's height so the form does not jump.
    return (
      <div className={cn('min-h-96 rounded-sm border border-rule bg-paper-raised', className)} />
    );
  }

  const words = countWords(editor);

  return (
    <div className={cn('rounded-sm border border-rule bg-paper-raised', className)}>
      {editable ? (
        <EditorToolbar editor={editor} onInsertImage={requestImage} onInsertVideo={insertVideo} />
      ) : null}

      <EditorContent editor={editor} className="px-4 py-4" />

      <div className="flex items-center justify-end border-t border-rule px-4 py-2 text-xs text-ink-faint">
        <span>
          {words} words · about {Math.max(1, Math.ceil(words / 200))} min read
        </span>
      </div>
    </div>
  );
}

function countWords(editor: Editor): number {
  const text = editor.getText().trim();
  return text ? text.split(/\s+/).length : 0;
}
