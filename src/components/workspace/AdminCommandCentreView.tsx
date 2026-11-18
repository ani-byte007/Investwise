import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Play,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  adminReplySupportTicket,
  adminUpdateUserTierAndSub,
  fetchAllUsersForAdmin,
  logAuditEvent,
  savePlatformSettings,
  type AuditLogRecord,
  type SupportTicketRecord,
} from '../../services/firestoreService.ts';
import type {
  PlatformSettings,
  ProviderLicenseCompliance,
  UserAccountDoc,
} from '../../types/financial.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';

interface AdminCommandCentreViewProps {
  tickets: SupportTicketRecord[];
  auditLogs?: AuditLogRecord[];
  governanceOnly?: boolean;
}

interface VerificationRow {
  symbol: string;
  snapshotId: string;
  totalMetrics: number;
  validCount: number;
  handledEdgeCases: number;
  hasFullProvenance: boolean;
}

export function AdminCommandCentreView({
  tickets,
  auditLogs = [],
  governanceOnly = false,
}: AdminCommandCentreViewProps) {
  const { user, isAdmin, platformSettings } = useAuth();
  const [draftSettings, setDraftSettings] = useState<PlatformSettings>(platformSettings);
  const [providers, setProviders] = useState<ProviderLicenseCompliance[]>([]);
  const [users, setUsers] = useState<UserAccountDoc[]>([]);
  const [verification, setVerification] = useState<{
    verifiedAt: string;
    equitiesChecked: number;
    allProvenanceComplete: boolean;
    results: VerificationRow[];
  } | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraftSettings(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    fetch('/api/market/providers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.providers)) setProviders(d.providers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!governanceOnly && isAdmin) {
      fetchAllUsersForAdmin()
        .then(setUsers)
        .catch(() => {});
    }
  }, [governanceOnly, isAdmin]);

  async function handleRunVerification() {
    setBusy(true);
    try {
      const res = await fetch('/api/system/verify-calculations', { method: 'POST' });
      const data = await res.json();
      setVerification(data);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveQuotas(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !user) return;
    setBusy(true);
    setStatusNote(null);
    try {
      await savePlatformSettings(draftSettings);
      await logAuditEvent(
        user.uid,
        'admin_platform_settings_updated',
        'platformConfig/settings',
        `Updated Premium price ₹${draftSettings.premiumPriceInr} and tier quotas`
      );
      setStatusNote('Platform subscription quotas updated in Firestore /platformConfig/settings.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleUserTier(target: UserAccountDoc) {
    if (!isAdmin || !user) return;
    const nextTier = target.tier === 'premium' ? 'free' : 'premium';
    await adminUpdateUserTierAndSub({ targetUid: target.uid, tier: nextTier });
    await logAuditEvent(
      user.uid,
      'admin_user_tier_changed',
      `users/${target.uid}`,
      `Changed tier to ${nextTier}`
    );
    setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, tier: nextTier } : u)));
    setStatusNote(`Updated ${target.displayName} tier to ${nextTier}.`);
  }

  async function handleResolveTicket(ticketId: string) {
    if (!isAdmin || !user) return;
    const reply = replyDrafts[ticketId] || 'Reviewed and acknowledged by InvestWise AI team.';
    await adminReplySupportTicket(ticketId, 'resolved', reply);
    await logAuditEvent(user.uid, 'admin_ticket_resolved', `supportTickets/${ticketId}`);
    setStatusNote(`Ticket ${ticketId} marked resolved.`);
  }

  return (
    <div className="space-y-6">
      {statusNote && (
        <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
          {statusNote}
        </div>
      )}

      {/* Licensed Data Provider Compliance Registry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            Licensed Financial-Data Provider Registry &amp; Rights Audit
          </CardTitle>
          <CardDescription>
            Commercial feeds remain gated until licensing rights, redistribution terms, and AI
            processing permissions are explicitly approved
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Provider Adapter</th>
                  <th className="px-4 py-3 font-medium">Coverage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Rights Checklist</th>
                  <th className="px-4 py-3 font-medium">Redistribution &amp; Licensing Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {providers.map((p) => (
                  <tr key={p.providerId}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.providerName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{p.providerId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.coverage}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          p.status === 'active_reference'
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {p.status === 'active_reference'
                          ? 'Active (Reference Eval)'
                          : 'Pending Commercial License'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] space-y-0.5">
                      <div>Commercial: {p.rightsChecklist.commercialUsage ? 'Yes' : 'No'}</div>
                      <div>Historical: {p.rightsChecklist.historicalData ? 'Yes' : 'No'}</div>
                      <div>AI Proc: {p.rightsChecklist.aiProcessingPermitted ? 'Yes' : 'No'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-sm">
                      {p.rightsChecklist.redistributionNotes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Deterministic Calculation & Provenance Integrity Verification */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Data Accuracy, Calculation &amp; Provenance Self-Check
              </CardTitle>
              <CardDescription>
                Executes server-side deterministic audit across all NSE equities and checks
                provenance completeness
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleRunVerification} disabled={busy}>
              <Play className="h-3.5 w-3.5" />
              Run Verification Suite
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!verification ? (
            <p className="text-xs text-slate-500">
              Click &quot;Run Verification Suite&quot; to inspect deterministic calculation coverage
              and provenance tags across all reference companies.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Checked {verification.equitiesChecked} equities at {verification.verifiedAt} · All
                  provenance complete: {String(verification.allProvenanceComplete)}
                </span>
              </div>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Snapshot ID</th>
                      <th className="px-3 py-2 text-right">Valid Metrics</th>
                      <th className="px-3 py-2 text-right">Edge Cases Handled</th>
                      <th className="px-3 py-2 text-right">Provenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {verification.results.map((r) => (
                      <tr key={r.symbol}>
                        <td className="px-3 py-2 font-semibold">{r.symbol}</td>
                        <td className="px-3 py-2">{r.snapshotId}</td>
                        <td className="px-3 py-2 text-right">
                          {r.validCount}/{r.totalMetrics}
                        </td>
                        <td className="px-3 py-2 text-right">{r.handledEdgeCases}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">
                          {r.hasFullProvenance ? 'Complete' : 'Incomplete'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin-Only Command Centre Controls */}
      {!governanceOnly && isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Configurable Subscription Tier Quotas
              </CardTitle>
              <CardDescription>
                Changes persist to /platformConfig/settings and take effect immediately across all
                investor sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveQuotas} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(
                  [
                    ['Free AI Credits / Day', 'freeAiCreditsPerDay'],
                    ['Premium AI Credits / Day', 'premiumAiCreditsPerDay'],
                    ['Free Watchlist Limit', 'freeWatchlistLimit'],
                    ['Premium Watchlist Limit', 'premiumWatchlistLimit'],
                    ['Free Compare Limit', 'freeComparisonLimit'],
                    ['Premium Compare Limit', 'premiumComparisonLimit'],
                    ['Free Retention (Days)', 'freeHistoryRetentionDays'],
                    ['Premium Retention (Days)', 'premiumHistoryRetentionDays'],
                    ['Premium Price (INR)', 'premiumPriceInr'],
                    ['Billing Cycle (Days)', 'subscriptionDurationDays'],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {label}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={draftSettings[key]}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 lg:col-span-5 pt-2">
                  <Button type="submit" size="sm" disabled={busy}>
                    Save Configurable Limits
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  Registered Investor Accounts ({users.length})
                </CardTitle>
                <CardDescription>Audit tier assignments (RBAC protected)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {users.length === 0 ? (
                  <p className="text-xs text-slate-500">No investor records found yet.</p>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.uid}
                      className="flex items-center justify-between gap-3 rounded border border-slate-200 dark:border-slate-800 p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold">{u.displayName}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          UID {u.uid.slice(0, 12)}... · Role: {u.role} · Tier: {u.tier}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleUserTier(u)}
                      >
                        Set {u.tier === 'premium' ? 'Free' : 'Premium'}
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support Ticket Triage ({tickets.length})</CardTitle>
                <CardDescription>Respond to open investor requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tickets.length === 0 ? (
                  <p className="text-xs text-slate-500">No support tickets queued.</p>
                ) : (
                  tickets.map((t) => (
                    <div
                      key={t.id}
                      className="rounded border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{t.subject}</span>
                        <span className="font-mono text-slate-500">{t.status}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{t.message}</p>
                      {t.status !== 'resolved' && (
                        <div className="flex gap-2 pt-1">
                          <Input
                            value={replyDrafts[t.id] || ''}
                            onChange={(e) =>
                              setReplyDrafts({ ...replyDrafts, [t.id]: e.target.value })
                            }
                            placeholder="Write admin resolution note..."
                          />
                          <Button size="sm" onClick={() => handleResolveTicket(t.id)}>
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Platform Security &amp; Audit Log ({auditLogs.length})</CardTitle>
              <CardDescription>
                Immutable append-only /auditLogs collection visible to platform admins
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No audit events logged yet.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs font-mono tabular-nums">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Actor UID</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Target</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {auditLogs.slice(0, 25).map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-2 text-slate-500">{entry.userId.slice(0, 12)}...</td>
                          <td className="px-3 py-2 font-semibold">{entry.action}</td>
                          <td className="px-3 py-2">{entry.target}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {entry.details || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
