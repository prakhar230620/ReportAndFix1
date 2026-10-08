"use client";

import { useEffect, useState } from "react";

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  function isInstallDismissed(): boolean {
    try {
      if (localStorage.getItem("pwa_install_dismissed") === "true") return true;
    } catch {}
    try {
      if (sessionStorage.getItem("pwa_install_dismissed") === "true") return true;
    } catch {}
    if (typeof document !== "undefined" && document.cookie.includes("pwa_install_dismissed=true")) return true;
    return false;
  }

  function setInstallDismissed() {
    try {
      localStorage.setItem("pwa_install_dismissed", "true");
    } catch {}
    try {
      sessionStorage.setItem("pwa_install_dismissed", "true");
    } catch {}
    try {
      document.cookie = "pwa_install_dismissed=true; path=/; max-age=31536000; SameSite=Lax";
    } catch {}
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("PWA Service Worker registered with scope:", registration.scope);
          })
          .catch((error) => {
            console.warn("PWA Service Worker registration failed:", error);
          });
      });

      // Capture beforeinstallprompt event for custom install banner
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);

        // Do not show if user previously dismissed the install prompt
        if (isInstallDismissed()) return;

        // Only show prompt if not already in standalone mode
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
        if (!isStandalone) {
          setShowInstallBanner(true);
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallDismissed();
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setInstallDismissed();
    setShowInstallBanner(false);
  };

  if (!showInstallBanner) return null;

  return (
    <aside
      aria-label="Install ReportAndFix"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-neutral-900/95 p-3.5 shadow-2xl shadow-blue-500/10 backdrop-blur-md sm:bottom-6 sm:left-auto sm:right-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Install ReportAndFix</div>
          <div className="text-xs text-neutral-400">Install as an app for fast offline access</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 active:scale-95"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
