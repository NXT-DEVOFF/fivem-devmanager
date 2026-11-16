"use client";

import dynamic from "next/dynamic";
import type { AnalyticsChartsProps } from "./analytics-charts";

const AnalyticsCharts = dynamic<AnalyticsChartsProps>(
  () =>
    import("./analytics-charts").then((module) => ({
      default: module.AnalyticsCharts,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4" aria-hidden="true">
        <div className="panel h-[340px] animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel h-[310px] animate-pulse" />
          <div className="panel h-[310px] animate-pulse" />
        </div>
      </div>
    ),
  },
);

export function AnalyticsChartsLazy(props: AnalyticsChartsProps) {
  return <AnalyticsCharts {...props} />;
}
