'use client';

import type { Editor } from '@tiptap/react';
import { useCallback } from 'react';
import { cn } from '@bcm10/ui';

/**
 * Editor toolbar.
 *
 * Sticky, so it stays reachable in a long story, and it wraps rather than
 * scrolls horizontally — a reporter on a phone should not have to swipe a
 * toolbar to find "bold".
 *
 * Every control is a real `<button type="button">` with an `aria-pressed`
 * state, so the active formatting is announced rather than only shown as a
 * darker background.
 */
export function EditorToolbar({
  editor,
  onInsertImage,
  onInsertVideo,
}: {
  editor: Editor;
  onInsertImage: () => void;
  onInsertVideo: () => void;
}) {
  const setLink = useCallback(() => {
    const existing = editor.getAttributes('link')['href'] as string | undefined;
    const url = window.prompt('Link URL', existing ?? 'https://');

    // Cancel leaves the link alone; an empty string removes it.
    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-rule bg-paper-raised/95 px-2 py-1.5 backdrop-blur-sm">
      <Group>
        <ToolButton
          label="Bold"
          shortcut="Ctrl+B"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolButton>

        <ToolButton
          label="Italic"
          shortcut="Ctrl+I"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="font-serif italic">I</span>
        </ToolButton>

        <ToolButton
          label="Underline"
          shortcut="Ctrl+U"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolButton>

        <ToolButton label="Link" active={editor.isActive('link')} onClick={setLink}>
          <IconLink />
        </ToolButton>
      </Group>

      <Divider />

      <Group>
        {([2, 3] as const).map((level) => (
          <ToolButton
            key={level}
            label={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <span className="text-xs font-bold">H{level}</span>
          </ToolButton>
        ))}

        <ToolButton
          label="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <IconQuote />
        </ToolButton>
      </Group>

      <Divider />

      <Group>
        <ToolButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <IconBullets />
        </ToolButton>

        <ToolButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <IconNumbers />
        </ToolButton>

        <ToolButton
          label="Divider"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <IconRule />
        </ToolButton>
      </Group>

      <Divider />

      <Group>
        <ToolButton label="Insert image" onClick={onInsertImage}>
          <IconImage />
        </ToolButton>

        <ToolButton label="Insert YouTube video" onClick={onInsertVideo}>
          <IconVideo />
        </ToolButton>
      </Group>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton
          label="Undo"
          shortcut="Ctrl+Z"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <IconUndo />
        </ToolButton>
        <ToolButton
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <IconRedo />
        </ToolButton>
      </div>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-rule" aria-hidden="true" />;
}

function ToolButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // aria-pressed rather than colour alone: the active state has to be
      // available to a screen reader too.
      aria-pressed={active}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'flex size-8 items-center justify-center rounded-sm text-sm transition-colors',
        active ? 'bg-brand-light text-brand' : 'text-ink-muted hover:bg-paper-sunk hover:text-ink',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
      )}
    >
      {children}
    </button>
  );
}

const icon = {
  className: 'size-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

function IconLink() {
  return (
    <svg {...icon}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}
function IconQuote() {
  return (
    <svg {...icon}>
      <path d="M7 7H4v6h5V9c0-1.1-.9-2-2-2ZM18 7h-3v6h5V9c0-1.1-.9-2-2-2Z" />
      <path d="M9 13c0 2.5-1.5 4-4 4M20 13c0 2.5-1.5 4-4 4" />
    </svg>
  );
}
function IconBullets() {
  return (
    <svg {...icon}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconNumbers() {
  return (
    <svg {...icon}>
      <path d="M10 6h10M10 12h10M10 18h10M4 5.5h1.5V9M3.5 15h2.5l-2.5 3h2.5" />
    </svg>
  );
}
function IconRule() {
  return (
    <svg {...icon}>
      <path d="M4 12h16" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg {...icon}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m21 16-5-5-4 4-2-2-7 7" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg {...icon}>
      <rect x="2.5" y="6" width="14" height="12" rx="2" />
      <path d="m17 11 4.5-2.5v11L17 17" />
    </svg>
  );
}
function IconUndo() {
  return (
    <svg {...icon}>
      <path d="M4 9h11a5 5 0 0 1 0 10h-5" />
      <path d="M8 5 4 9l4 4" />
    </svg>
  );
}
function IconRedo() {
  return (
    <svg {...icon}>
      <path d="M20 9H9a5 5 0 0 0 0 10h5" />
      <path d="m16 5 4 4-4 4" />
    </svg>
  );
}
