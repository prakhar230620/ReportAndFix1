import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import BackButton from "@/app/components/BackButton";
import { Shield, FileText, CheckCircle2, Clock, Trash2, KeyRound } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <BrandLogo size="md" />
          <Link
            href="/"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
            <FileText className="h-3.5 w-3.5" />
            Legal & Platform Governance
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
            Terms of Service & Platform Policies
          </h1>
          <p className="mt-2 text-xs text-neutral-500">
            Version 2.4 · Effective Date: January 1, 2026 · ReportAndFix Operations Platform
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-neutral-200 bg-white p-8 sm:p-10 shadow-sm leading-relaxed text-sm text-neutral-700">
          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              1. Platform Agreement & Scope
            </h2>
            <p>
              By accessing, creating an organisation account, or utilizing ReportAndFix (including mobile QR check-ins,
              worker assignments, and administrative dashboards), you agree to be bound by these Terms of Service.
              ReportAndFix provides facility maintenance coordination software connecting citizens, field workers, and
              administrative bodies across registered colleges, universities, and commercial campuses.
            </p>
          </section>

          <section className="border-t border-neutral-100 pt-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              2. Organisation Join Codes & Membership Security
            </h2>
            <p>
              Organisations govern user enrollment via unique 6-character alphanumeric Join Codes.
              Organisation administrators have the sole authority to regenerate Join Codes.
              Rotating a Join Code immediately prevents unauthorized new registrations while preserving all active authenticated sessions.
              Admins are responsible for safeguarding their organisation credentials and role approvals.
            </p>
          </section>

          <section className="border-t border-neutral-100 pt-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              3. Subscription Cycles, Billing, & Plan Expiration Freeze
            </h2>
            <p>
              Organisations subscribe under chosen billing tiers (Starter, Standard, Professional, Enterprise) on monthly or yearly cycles.
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-xs text-neutral-600">
              <li>
                <strong>Advance Warnings:</strong> Automated alerts are dispatched at 15 days, 7 days, 3 days, and 24 hours prior to subscription expiration.
              </li>
              <li>
                <strong>Freeze State:</strong> Upon billing period expiration without verified renewal, the organisation enters a frozen state. All write operations (creating complaints, assigning technicians, verifying work) are immediately paused.
              </li>
              <li>
                <strong>Role Differentiation:</strong> Administrators see an immediate renewal checkout modal. Citizens and technicians see an informative temporary service notice directing them to contact administration.
              </li>
              <li>
                <strong>30-Day Soft Deletion:</strong> If a frozen organisation remains unpaid for 30 consecutive calendar days, complaint records are transitioned to soft-deleted state.
              </li>
            </ul>
          </section>

          <section id="data-deletion" className="border-t border-neutral-100 pt-6 scroll-mt-20">
            <h2 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              4. Data Deletion, Mandatory Backup, & Retention
            </h2>
            <p>
              Organisation administrators may initiate permanent data deletion subject to the following strict safety protocols:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-xs text-neutral-600">
              <li>
                <strong>Eligible Data:</strong> Only fully resolved ("completed") complaints are eligible for deletion. Open or investigating tickets cannot be purged.
              </li>
              <li>
                <strong>Multi-Admin Consensus:</strong> In organisations with multiple appointed administrators, 100% consensus is cryptographically required before data purge initiates.
              </li>
              <li>
                <strong>Mandatory Download:</strong> A complete data archive (JSON database export, multi-column PDF manifest of complaint IDs, and original Backblaze B2 photos) must be downloaded prior to permanent deletion.
              </li>
              <li>
                <strong>Irreversible Purge:</strong> Once confirmed, attached media files are permanently purged from Backblaze B2 object storage and Redis CDN caches. This operation cannot be undone.
              </li>
            </ul>
          </section>

          <section className="border-t border-neutral-100 pt-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              5. Staff In-App Messaging & 24h Pruning
            </h2>
            <p>
              In-app messaging is available exclusively on qualified tiers for authenticated Organisation Admins,
              Department Admins, and Field Workers. To protect institutional privacy and optimize storage infrastructure,
              all staff messages automatically expire and are purged after 24 to 72 hours per platform cron schedules.
            </p>
          </section>

          <section className="border-t border-neutral-100 pt-6 text-xs text-neutral-500">
            <p>
              For inquiries regarding custom Enterprise service level agreements, data sovereignty, or payment invoices,
              please reach out through our <Link href="/#contact" className="text-blue-600 hover:underline">Contact Form</Link> or email super admin support.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
