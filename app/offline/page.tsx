"use client";

import React from "react";
import Link from "next/link";
import BrandLogo from "../components/BrandLogo";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center text-neutral-100">
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <div className="max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.829-5.464a5 5 0 010-7.072m0 0l2.829 2.829"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold tracking-tight text-white">
          You are currently offline
        </h1>
        <p className="mb-6 text-sm text-neutral-400">
          It looks like your internet connection is down. ReportAndFix will automatically reconnect when your device is back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
        >
          Check Connection & Retry
        </button>
      </div>
    </div>
  );
}
