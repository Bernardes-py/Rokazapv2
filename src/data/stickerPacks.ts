export interface Sticker {
  url: string;
  thumbnail: string;
}

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: Sticker[];
}

// Twemoji CDN - high-quality emoji images as PNG (publicly hosted, open source)
// Format: https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/{codepoint}.png
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

function emojiToCodepoint(emoji: string): string {
  const codepoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp && cp !== 0xfe0f) { // skip variation selector
      codepoints.push(cp.toString(16));
    }
  }
  return codepoints.join('-');
}

function twemojiUrl(emoji: string): string {
  return `${TWEMOJI_BASE}/${emojiToCodepoint(emoji)}.png`;
}

function makeSticker(emoji: string): Sticker {
  const url = twemojiUrl(emoji);
  return { url, thumbnail: url };
}

export const stickerPacks: StickerPack[] = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: twemojiUrl('😀'),
    stickers: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '😐', '😑', '😶', '😏', '😒', '🙄',
      '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷',
      '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵',
      '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😱',
      '😨', '😰', '😥', '😢', '😭', '😤', '😡', '🤬',
    ].map(makeSticker),
  },
  {
    id: 'gestures',
    name: 'Gestos',
    icon: twemojiUrl('👋'),
    stickers: [
      '👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏',
      '✌', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
      '🖕', '👇', '👍', '👎', '✊', '👊', '🤛',
      '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪',
    ].map(makeSticker),
  },
  {
    id: 'animals',
    name: 'Animais',
    icon: twemojiUrl('🐱'),
    stickers: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
      '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆',
      '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝',
      '🐛', '🦋', '🐌', '🐞', '🐜',
      '🐢', '🐍', '🦎', '🦂', '🐙', '🦑', '🦐', '🦞',
    ].map(makeSticker),
  },
  {
    id: 'hearts',
    name: 'Corações',
    icon: twemojiUrl('❤'),
    stickers: [
      '❤', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '💌',
      '💐', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻',
    ].map(makeSticker),
  },
  {
    id: 'food',
    name: 'Comida',
    icon: twemojiUrl('🍕'),
    stickers: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚',
      '🍳', '🧇', '🥞', '🍞', '🥐', '🧀',
      '🥗', '🥙', '🥪', '🌮', '🌯', '🥘', '🍝',
      '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤',
      '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬',
      '🍭', '🍮', '🍯', '🍼', '☕', '🍵', '🧃', '🥤',
    ].map(makeSticker),
  },
];
