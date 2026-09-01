import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Custom Tiptap nodes.
 *
 * These exist so images and videos are stored as *data* — a media id, a
 * YouTube id, a caption — rather than as markup. The public site renders them
 * with its own components, which is what lets the same stored document produce
 * a lazy-loaded facade on the web, a static thumbnail in an email digest, and
 * plain text in the search vector.
 *
 * Storing an `<iframe>` in the body would make all three impossible and would
 * put attacker-influenced markup into the reader's page.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    newsroomImage: {
      insertNewsroomImage: (attributes: NewsroomImageAttributes) => ReturnType;
    };
    newsroomYouTube: {
      insertYouTube: (attributes: YouTubeAttributes) => ReturnType;
    };
  }
}

export interface NewsroomImageAttributes {
  mediaId: string;
  storageKey: string;
  src: string;
  alt?: string;
  caption?: string;
  credit?: string;
  width?: number;
  height?: number;
  blur?: string;
}

/**
 * An image in the body.
 *
 * `mediaId` and `storageKey` are the persisted truth; `src` is a convenience
 * for rendering inside the editor and is regenerated from the key on the
 * public site, so moving to a new media domain does not require rewriting
 * every stored document.
 */
export const NewsroomImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mediaId: { default: null },
      storageKey: { default: null },
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      credit: { default: '' },
      width: { default: null },
      height: { default: null },
      blur: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-media-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-media-id': HTMLAttributes['mediaId'],
        'data-storage-key': HTMLAttributes['storageKey'],
      }),
    ];
  },

  addCommands() {
    return {
      insertNewsroomImage:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },
});

export interface YouTubeAttributes {
  videoId: string;
  title?: string;
  caption?: string;
  isShort?: boolean;
  start?: number | null;
}

/**
 * A YouTube video.
 *
 * Rendered in the editor as a labelled placeholder rather than a live player:
 * a reporter writing a story does not need three autoplay-capable iframes
 * fighting for the page, and the placeholder makes the block's boundaries
 * obvious when they are moving things around.
 */
export const NewsroomYouTube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      videoId: { default: null },
      title: { default: '' },
      caption: { default: '' },
      isShort: { default: false },
      start: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-youtube-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const videoId = HTMLAttributes['videoId'] as string;

    return [
      'div',
      mergeAttributes(
        { 'data-youtube-id': videoId, class: 'newsroom-youtube-placeholder' },
        HTMLAttributes
      ),
      // Text content, so the block is visible and selectable in the editor.
      `▶ YouTube video: ${videoId}`,
    ];
  },

  addCommands() {
    return {
      insertYouTube:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },
});
