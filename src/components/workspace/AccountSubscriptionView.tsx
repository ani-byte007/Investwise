import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, History, LifeBuoy, ShieldAlert, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  createSubscriptionIntent,
  createSupportTicket,
  logAuditEvent,
  updateUserConsentAndDisplay,
  type AuditLogRecord,
  type SubscriptionRecord,
  type SupportTicketRecord,
} from '../../services/firestoreService.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';

interface AccountSubscriptionViewProps {
  subscriptions: SubscriptionRecord[];
  tickets: SupportTicketRecord[];
  auditLogs?: AuditLogRecord[];
  onRequireAuth: () => void;
}

export function AccountSubscriptionView({
  subscriptions,
  tickets,
  auditLogs = [],
  onRequireAuth,
}: AccountSubscriptionViewProps) {
  const {
    user,
    account,
    privateProfile,
    platformSettings,
    isEmailVerified,
    resendVerificationEmail,
    refreshAuthUser,
  } = useAuth();

  const [displayName, setDisplayName] = useState(account?.displayName || '');
  const [timezone, setTimezone] = useState(privateProfile?.timezone || 'Asia/Kolkata');
  const [notifyCorporate, setNotifyCorporate] = useState(
    privateProfile?.notifyCorporateActions ?? true
  );
  const [notifyDigest, setNotifyDigest] = useState(
    privateProfile?.notifyResearchDigest ?? false
  );
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] =
    useState<SupportTicketRecord['category']>('data_accuracy');
  const [ticketMessage, setTicketMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account?.displayName) setDisplayName(account.displayName);
    if (privateProfile?.timezone) setTimezone(privateProfile.timezone);
    if (privateProfile?.notifyCorporateActions !== undefined) {
      setNotifyCorporate(privateProfile.notifyCorporateActions);
    }
    if (privateProfile?.notifyResearchDigest !== undefined) {
      setNotifyDigest(privateProfile.notifyResearchDigest);
    }
  }, [account, privateProfile]);

  if (!user) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <UserCheck className="h-8 w-8 mx-auto text-slate-400" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-semibold">Account, Subscription &amp; Support</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in or create an investor account to configure notification settings, review SEBI
              non-advisory terms, request a subscription, or contact support.
            </p>
          </div>
          <Button onClick={onRequireAuth}>Sign In / Register</Button>
        </CardContent>
      </Card>
    );
  }

  if (!isEmailVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Verification Required</CardTitle>
          <CardDescription>
            Signed in as {user.email}. Verify your email address to unlock private Firestore writes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={resendVerificationEmail} variant="outline">
            Resend Verification Email
          </Button>
          <Button onClick={refreshAuthUser}>I Have Verified — Refresh Session</Button>
        </CardContent>
      </Card>
    );
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setFeedback(null);
    try {
      await updateUserConsentAndDisplay(user.uid, {
        displayName: displayName || account?.displayName || 'Investor',
        notifyCorporateActions: notifyCorporate,
        notifyResearchDigest: notifyDigest,
        timezone,
      });
      await logAuditEvent(
        user.uid,
        'profile_preferences_updated',
        `users/${user.uid}/private/profile`,
        `Updated display preferences and timezone (${timezone})`
      );
      setFeedback('Account settings saved to Firestore.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptDisclosures() {
    if (!user) return;
    setBusy(true);
    setFeedback(null);
    try {
      await updateUserConsentAndDisplay(user.uid, { acceptTerms: true });
      await logAuditEvent(
        user.uid,
        'terms_disclosure_accepted',
        `users/${user.uid}`,
        'Investor accepted Terms of Service and SEBI non-advisory disclosure'
      );
      setFeedback('Recorded Terms & SEBI Non-Advisory Disclosure consent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestPremium() {
    if (!user) return;
    setBusy(true);
    setFeedback(null);
    try {
      const subId = await createSubscriptionIntent(user.uid, platformSettings.premiumPriceInr);
      await logAuditEvent(
        user.uid,
        'subscription_intent_created',
        `users/${user.uid}/subscriptions/${subId}`,
        `Created ₹${platformSettings.premiumPriceInr} Phase 1 checkout intent (pending_verification)`
      );
      setFeedback(
        'Created subscription checkout intent (status: pending_verification). Live gateway webhook verification is required before activating paid billing.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !ticketSubject.trim() || !ticketMessage.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const ticketId = await createSupportTicket(user.uid, {
        subject: ticketSubject,
        category: ticketCategory,
        message: ticketMessage,
      });
      await logAuditEvent(
        user.uid,
        'support_ticket_created',
        `supportTickets/${ticketId}`,
        `Category: ${ticketCategory}`
      );
      setTicketSubject('');
      setTicketMessage('');
      setFeedback('Support ticket submitted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account & Consent */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Investor Profile &amp; Preferences</CardTitle>
            <CardDescription>
              PII isolated in /users/{user.uid.slice(0, 8)}.../private/profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-200 shrink-0">
                <img
                  src="/src/assets/images/avatar_investor_profile_1795014031595.jpg"
                  alt="Investor profile portrait"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="text-sm font-semibold">{account?.displayName || user.displayName}</p>
                <p className="text-slate-500 dark:text-slate-400">{privateProfile?.email || user.email}</p>
                <p className="font-mono text-teal-800 dark:text-teal-400">
                  Tier: {account?.tier === 'premium' ? 'Premium Investor' : 'Free Investor'} · Role:{' '}
                  {account?.role || 'investor'} · Currency: {privateProfile?.preferredCurrency || 'INR'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Display Name</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={account?.displayName || 'Investor Name'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (ET)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyCorporate}
                    onChange={(e) => setNotifyCorporate(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Corporate action &amp; exchange filing alerts for watchlist equities</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyDigest}
                    onChange={(e) => setNotifyDigest(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Weekly deterministic fundamentals digest</span>
                </label>
              </div>

              <Button type="submit" size="sm" disabled={busy}>
                Save Preferences
              </Button>
            </form>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                <span>Customer Terms &amp; SEBI Non-Advisory Disclosure</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                I acknowledge that InvestWise AI is an analytical calculation and research tool, not
                a SEBI-registered Investment Adviser or Research Analyst, and that all market
                reference figures are for educational/analytical use only.
              </p>
              {privateProfile?.riskDisclosureAccepted ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Accepted on {account?.termsAcceptedAt || 'verified session'}
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={handleAcceptDisclosures} disabled={busy}>
                  Accept Terms &amp; Risk Disclosure
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription & Audit Trail */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              Subscription &amp; Payment Audit Trail
            </CardTitle>
            <CardDescription>
              Proposed Premium: ₹{platformSettings.premiumPriceInr} /{' '}
              {platformSettings.subscriptionDurationDays} days (webhook-verified billing)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    Current Plan:{' '}
                    {account?.tier === 'premium' ? 'Premium Investor' : 'Free Investor'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    AI Quota:{' '}
                    {account?.tier === 'premium'
                      ? platformSettings.premiumAiCreditsPerDay
                      : platformSettings.freeAiCreditsPerDay}
                    /day · Watchlists:{' '}
                    {account?.tier === 'premium'
                      ? platformSettings.premiumWatchlistLimit
                      : platformSettings.freeWatchlistLimit}
                  </p>
                </div>
                {account?.tier !== 'premium' && (
                  <Button size="sm" onClick={handleRequestPremium} disabled={busy}>
                    Request Premium (₹{platformSettings.premiumPriceInr})
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Security invariant: Frontends never mark payments successful. Subscriptions remain
                in <span className="font-mono">pending_verification</span> until verified by a
                server-side HMAC payment webhook or authorized admin audit.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Subscription History
              </h4>
              {subscriptions.length === 0 ? (
                <p className="text-xs text-slate-500">No subscription transactions recorded.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs font-mono tabular-nums">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Ref Code</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Webhook</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subscriptions.map((sub) => (
                        <tr key={sub.id}>
                          <td className="px-3 py-2">{sub.referenceCode}</td>
                          <td className="px-3 py-2">₹{sub.amountInr}</td>
                          <td className="px-3 py-2">{sub.status}</td>
                          <td className="px-3 py-2">
                            {sub.webhookVerified ? 'Verified' : 'Unverified'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            Investor Support &amp; Data Discrepancy Desk
          </CardTitle>
          <CardDescription>
            Submit financial statement verification queries, account requests, or compliance feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleSubmitTicket} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) =>
                    setTicketCategory(e.target.value as SupportTicketRecord['category'])
                  }
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="data_accuracy">Financial Data Accuracy</option>
                  <option value="billing">Subscription &amp; Billing</option>
                  <option value="compliance">SEBI &amp; Regulatory</option>
                  <option value="account">Account &amp; Verification</option>
                  <option value="feature">Feature Request</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Subject</label>
                <Input
                  required
                  minLength={3}
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Brief summary..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Details</label>
              <textarea
                required
                minLength={10}
                rows={3}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Include stock symbol, reporting period, or reference code..."
                className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              Submit Support Ticket
            </Button>
          </form>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Your Submitted Tickets ({tickets.length})
            </h4>
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-500">No support tickets submitted.</p>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-md border border-slate-200 dark:border-slate-800 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.subject}</span>
                    <span className="font-mono text-slate-500">{t.status}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{t.message}</p>
                  {t.adminReply && (
                    <p className="pt-1.5 text-teal-800 dark:text-teal-300 border-t border-slate-100 dark:border-slate-800">
                      <strong>Admin Response:</strong> {t.adminReply}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security & Immutable Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            Account Security &amp; Audit Activity ({auditLogs.length})
          </CardTitle>
          <CardDescription>
            Append-only audit trail recorded in /auditLogs for consent, preferences, subscription
            intents, and support actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500">No audit events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.slice(0, 15).map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 font-semibold">{entry.action}</td>
                      <td className="px-3 py-2 text-slate-500">{entry.target}</td>
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
    </div>
  );
}
