import { useEffect, useState, type InputHTMLAttributes } from "react";

// A field that keeps its text while typing and hands the value over on blur or Enter.
export function CommitInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => text !== value && onCommit(text);
  return <input {...rest} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />;
}

export const toNumber = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));
