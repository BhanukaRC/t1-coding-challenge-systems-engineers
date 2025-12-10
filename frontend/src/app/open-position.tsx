"use client";

import { useStream } from "@/hooks/useStream";

const OpenPosition = () => {
  const position = useStream<string>("/open-position");

  return position ? <p>{position} MW</p> : <p className="text-2xl">Waiting for position data...</p>;
};

export default OpenPosition;
