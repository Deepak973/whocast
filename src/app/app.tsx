"use client";

import dynamic from "next/dynamic";

// note: dynamic import is required for components that use the Frame SDK
const WhoCast = dynamic(() => import("~/components/WhoCast"), {
  ssr: false,
});

export default function App() {
  return <WhoCast />;
}
