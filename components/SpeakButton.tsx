"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  text: string;
  lang?: string;
  className?: string;
};

export function SpeakButton({ text, lang = "es-ES", className }: Props) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
  }, []);

  function handleSpeak(event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("SpeakButton failed", err);
      setSpeaking(false);
    }
  }

  if (!supported) return null;

  const base =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-navy shadow-pop-sm transition-all duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-pop active:translate-x-px active:translate-y-px active:shadow-none";
  const state = speaking ? "bg-teal text-paper" : "bg-paper text-navy";

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={`"${text}" vorlesen`}
      className={className ?? `${base} ${state}`}
    >
      <Volume2 aria-hidden size={18} />
    </button>
  );
}
