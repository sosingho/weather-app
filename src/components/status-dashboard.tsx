"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  RefreshCw,
  Send,
  ShieldCheck,
  Siren,
  XCircle,
} from "lucide-react";
import type { WeatherStatusResponse } from "@/lib/status";

type StatusDashboardProps = {
  initialStatus: WeatherStatusResponse;
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

export function StatusDashboard({ initialStatus }: StatusDashboardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [adminToken, setAdminToken] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const activeWarnings = status.current?.warnings ?? [];
  const missingConfig = useMemo(
    () => status.config.items.filter((item) => item.required && !item.configured),
    [status.config.items],
  );

  async function refreshStatus() {
    setIsRefreshing(true);
    setNotice(null);

    try {
      const response = await fetch("/api/weather/status", { cache: "no-store" });
      const nextStatus = (await response.json()) as WeatherStatusResponse;

      if (!response.ok) {
        throw new Error("Status refresh failed.");
      }

      setStatus(nextStatus);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Status refresh failed.",
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function sendTestMessage() {
    setIsTesting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/test-whatsapp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const body = (await response.json()) as { ok: boolean; error?: string; result?: { dryRun?: boolean } };

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Test send failed.");
      }

      setNotice({
        tone: "success",
        text: body.result?.dryRun ? "Dry-run test message passed." : "Test WhatsApp message sent.",
      });
      await refreshStatus();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Test send failed.",
      });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-stone-950">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-700">
              <Siren className="h-4 w-4" aria-hidden="true" />
              HKO Warning Monitor
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-stone-950 md:text-4xl">
              WhatsApp Weather Signal Notifier
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={refreshStatus}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-5 py-5 md:grid-cols-4 md:px-8">
        <MetricCard
          label="Active warnings"
          value={String(activeWarnings.length)}
          detail={activeWarnings.length ? "Signals currently in force" : "No signals in force"}
          tone={activeWarnings.length ? "warning" : "good"}
        />
        <MetricCard
          label="Last check"
          value={formatDate(status.stored?.lastCheck?.checkedAt)}
          detail={status.stored?.lastCheck?.ok === false ? "Check failed" : "Latest cron state"}
          tone={status.stored?.lastCheck?.ok === false ? "bad" : "neutral"}
        />
        <MetricCard
          label="Events sent"
          value={String(status.stored?.lastCheck?.eventsSent ?? 0)}
          detail={`${status.stored?.lastCheck?.eventsFound ?? 0} change events found`}
          tone="neutral"
        />
        <MetricCard
          label="Config"
          value={status.config.ok ? "Ready" : `${missingConfig.length} missing`}
          detail={status.redisConfigured ? "Redis connected" : "Redis not configured"}
          tone={status.config.ok ? "good" : "bad"}
        />
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 pb-10 md:px-8 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-5">
          <Panel title="Current HKO Warnings" icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}>
            {status.currentError ? (
              <ErrorBlock message={status.currentError} />
            ) : activeWarnings.length ? (
              <div className="divide-y divide-stone-200">
                {activeWarnings.map((warning) => (
                  <article key={warning.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-stone-950">{warning.name}</h3>
                        <p className="mt-1 text-sm text-stone-600">{warning.detail}</p>
                      </div>
                      <span className="inline-flex w-fit rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                        {warning.code}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs text-stone-500 md:grid-cols-3">
                      <div>
                        <dt className="font-medium text-stone-700">Issued</dt>
                        <dd>{formatDate(warning.issueTime)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-stone-700">Updated</dt>
                        <dd>{formatDate(warning.updateTime)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-stone-700">Action</dt>
                        <dd>{warning.actionCode ?? "Active"}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No active warnings" detail="HKO is not reporting active warning signals right now." />
            )}
          </Panel>

          <Panel title="Notification State" icon={<BellRing className="h-5 w-5" aria-hidden="true" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <StateRow
                label="Last notification"
                value={status.stored?.lastSend ? status.stored.lastSend.warningName : "None recorded"}
                detail={status.stored?.lastSend ? formatDate(status.stored.lastSend.sentAt) : "No WhatsApp event has been sent."}
              />
              <StateRow
                label="Recipient"
                value={status.stored?.lastSend?.recipient ?? "Waiting for first send"}
                detail={status.stored?.lastSend?.dryRun ? "Dry-run mode" : "Meta Cloud API"}
              />
              <StateRow
                label="Last stored state"
                value={`${status.stored?.lastState?.warnings.length ?? 0} warnings`}
                detail={formatDate(status.stored?.lastState?.fetchedAt)}
              />
              <StateRow
                label="Last check result"
                value={status.stored?.lastCheck?.ok === false ? "Failed" : "Healthy"}
                detail={status.stored?.lastCheck?.error ?? status.stored?.lastCheck?.skippedReason ?? "No error recorded"}
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Manual Test" icon={<Send className="h-5 w-5" aria-hidden="true" />}>
            <label className="block text-sm font-medium text-stone-700" htmlFor="admin-token">
              Admin token
            </label>
            <input
              id="admin-token"
              className="mt-2 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              autoComplete="off"
            />
            <button
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={sendTestMessage}
              disabled={isTesting || !adminToken}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isTesting ? "Sending" : "Send test"}
            </button>

            {notice ? (
              <div
                className={`mt-3 rounded-md border px-3 py-2 text-sm ${
                  notice.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                {notice.text}
              </div>
            ) : null}
          </Panel>

          <Panel title="Configuration Health" icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}>
            <div className="space-y-2">
              {status.config.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">{item.key}</p>
                    <p className="text-xs text-stone-500">{item.maskedValue ?? item.group}</p>
                  </div>
                  {item.configured ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Configured" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-label="Missing" />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warning" | "bad" | "neutral";
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    bad: "border-rose-200 bg-rose-50 text-rose-900",
    neutral: "border-stone-200 bg-white text-stone-900",
  }[tone];

  return (
    <article className={`rounded-md border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-normal opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm opacity-75">{detail}</p>
    </article>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/60">
      <div className="mb-4 flex items-center gap-2 text-stone-800">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StateRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-stone-950">{value}</p>
      <p className="mt-1 text-xs text-stone-600">{detail}</p>
    </div>
  );
}

function EmptyBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        <h3 className="font-semibold">HKO request failed</h3>
      </div>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
