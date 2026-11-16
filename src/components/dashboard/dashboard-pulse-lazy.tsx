"use client";

import dynamic from "next/dynamic";
import type { PulsePoint } from "./dashboard-pulse";

const DashboardPulse = dynamic<{ data: PulsePoint[] }>(
  () =>
    import("./dashboard-pulse").then((module) => ({
      default: module.DashboardPulse,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="panel h-[366px] animate-pulse" aria-hidden="true" />
    ),
  },
);

export function DashboardPulseLazy(props: { data: PulsePoint[] }) {
  return <DashboardPulse {...props} />;
}
