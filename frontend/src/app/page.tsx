"use client";

import OpenPosition from "./open-position";
import PnL from "./pnl";
import ServiceHealth from "./service-health";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          The <span className="text-[hsl(280,100%,70%)]">T1</span> Dashboard
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20">
            <h3 className="text-2xl font-bold">Open Position</h3>
            <div className="text-4xl">
              <OpenPosition />
            </div>
          </div>
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20">
            <h3 className="text-2xl font-bold">Status</h3>
            <ServiceHealth />
          </div>
          <div className="flex flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20">
            <h3 className="text-2xl font-bold">Profit and Loss</h3>
            <div className="text-sm">
              <PnL />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
