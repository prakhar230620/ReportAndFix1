"use client";

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Analytics = {
  total: number;
  completed: number;
  avg_resolution_seconds: number | null;
  by_category: { name: string; count: number }[];
  by_location: { name: string; count: number }[];
  by_worker: { display_name: string; count: number; avg_resolution_seconds: number | null }[];
  trend: { day: string; count: number }[];
};

function formatHours(seconds: number | null) {
  if (!seconds) return "—";
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function AnalyticsCharts({ data }: { data: Analytics }) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="text-2xl font-semibold">{data.total}</div>
          <div className="text-neutral-500">Total complaints</div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="text-2xl font-semibold">{data.completed}</div>
          <div className="text-neutral-500">Completed</div>
        </div>
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="text-2xl font-semibold">{formatHours(data.avg_resolution_seconds)}</div>
          <div className="text-neutral-500">Avg resolution</div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Trend (last 30 days)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#171717" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">By category</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.by_category}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#171717" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">By location</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.by_location}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#525252" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">By worker</h2>
        <div className="flex flex-col gap-1 text-sm">
          {data.by_worker.map((w, i) => (
            <div key={i} className="flex justify-between rounded-md border border-neutral-200 px-3 py-2">
              <span>{w.display_name}</span>
              <span className="text-neutral-500">
                {w.count} tasks · {formatHours(w.avg_resolution_seconds)} avg
              </span>
            </div>
          ))}
          {data.by_worker.length === 0 && (
            <p className="text-neutral-500">No assignments yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
