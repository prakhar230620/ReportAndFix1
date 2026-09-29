import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import DocumentationSection from "@/app/components/DocumentationSection";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <BrandLogo size="md" />
          <Link
            href="/"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main>
        <DocumentationSection />
      </main>
    </div>
  );
}
