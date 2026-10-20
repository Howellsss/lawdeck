"use client";

import { useId } from "react";
import { greetingFor } from "@/lib/greeting";

// "Good morning / afternoon / evening" by the student's own clock.
// The inline script sets the right words before the first paint (no flash); the server renders a neutral default.
export function Greeting({ name }: { name?: string }) {
  const id = useId();
  const suffix = name ? `, ${name}` : "";
  const text = typeof window === "undefined" ? `Welcome${suffix}` : `${greetingFor(new Date().getHours())}${suffix}`;
  const script = `(function(){var n=document.getElementById(${JSON.stringify(id)});if(!n)return;var h=new Date().getHours();n.textContent=(h<12?"Good morning":h<17?"Good afternoon":"Good evening")+${JSON.stringify(suffix)}})()`;

  return (
    <>
      <span id={id} suppressHydrationWarning>
        {text}
      </span>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: script }}
      />
    </>
  );
}
