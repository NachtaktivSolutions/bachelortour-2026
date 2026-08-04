"use client";

const EMOJIS = ["😂","🔥","🍺","🍻","🥳","🤘","😎","🚍","📍","❤️","👍","🙈","🤡","💪","🎉","🚨","🤢","🍕","🍔","🥃"];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return <div className="emoji-picker">{EMOJIS.map(e => <button type="button" key={e} onClick={() => onPick(e)}>{e}</button>)}</div>;
}
