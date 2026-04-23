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
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("SpeakButton failed", err);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={`"${text}" vorlesen`}
      className={
        className ??
        "flex h-11 w-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }
    >
      <Volume2 aria-hidden size={20} />
    </button>
  );
}
