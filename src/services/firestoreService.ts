import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors.ts';
import { todayIsoDate } from '../lib/utils.ts';
import type {
  GroundedAiResearchAnalysis,
  PlatformSettings,
  PortfolioTransactionInput,
  UserAccountDoc,
  UserPrivateProfileDoc,
} from '../types/financial.ts';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  freeAiCreditsPerDay: 3,
  premiumAiCreditsPerDay: 50,
  freeWatchlistLimit: 2,
  premiumWatchlistLimit: 20,
  freeComparisonLimit: 2,
  premiumComparisonLimit: 4,
  freeHistoryRetentionDays: 30,
  premiumHistoryRetentionDays: 365,
  premiumPriceInr: 299,
  subscriptionDurationDays: 30,
};

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export async function ensureUserDocuments(params: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  emailVerified: boolean;
}): Promise<void> {
  if (!params.emailVerified) return;
  const userPath = `users/${params.uid}`;
  const privatePath = `users/${params.uid}/private/profile`;

  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: params.uid,
        displayName: (params.displayName || 'Investor').slice(0, 120),
        ...(params.photoURL ? { photoURL: params.photoURL.slice(0, 512) } : {}),
        tier: 'free',
        role: 'investor',
        aiCreditsUsedToday: 0,
        aiCreditsDate: todayIsoDate(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const privateRef = doc(db, 'users', params.uid, 'private', 'profile');
    const privateSnap = await getDoc(privateRef);
    if (!privateSnap.exists()) {
      await setDoc(privateRef, {
        uid: params.uid,
        email: (params.email || 'unknown@investor.local').slice(0, 200),
        preferredCurrency: 'INR',
        timezone: 'Asia/Kolkata',
        riskDisclosureAccepted: false,
        notifyCorporateActions: true,
        notifyResearchDigest: false,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} | ${privatePath}`);
  }
}

export function subscribePlatformSettings(
  onUpdate: (settings: PlatformSettings) => void
): Unsubscribe {
  const path = 'platformConfig/settings';
  return onSnapshot(
    doc(db, 'platformConfig', 'settings'),
    (snap) => {
      if (snap.exists()) {
        onUpdate({ ...DEFAULT_PLATFORM_SETTINGS, ...(snap.data() as Partial<PlatformSettings>) });
      } else {
        onUpdate(DEFAULT_PLATFORM_SETTINGS);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function savePlatformSettings(settings: PlatformSettings): Promise<void> {
  const path = 'platformConfig/settings';
  try {
    await setDoc(doc(db, 'platformConfig', 'settings'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserAccount(
  uid: string,
  onUpdate: (account: UserAccountDoc | null) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as UserAccountDoc) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribePrivateProfile(
  uid: string,
  onUpdate: (profile: UserPrivateProfileDoc | null) => void
): Unsubscribe {
  const path = `users/${uid}/private/profile`;
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'profile'),
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as UserPrivateProfileDoc) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updateUserConsentAndDisplay(
  uid: string,
  updates: {
    displayName?: string;
    acceptTerms?: boolean;
    notifyCorporateActions?: boolean;
    notifyResearchDigest?: boolean;
    timezone?: string;
  }
): Promise<void> {
  try {
    const nowIso = new Date().toISOString().slice(0, 64);
    if (updates.displayName !== undefined || updates.acceptTerms) {
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.displayName !== undefined) {
        payload.displayName = updates.displayName.trim().slice(0, 120) || 'Investor';
      }
      if (updates.acceptTerms) {
        payload.termsAcceptedAt = nowIso;
      }
      await updateDoc(doc(db, 'users', uid), payload);
    }

    if (
      updates.acceptTerms ||
      updates.notifyCorporateActions !== undefined ||
      updates.notifyResearchDigest !== undefined ||
      updates.timezone !== undefined
    ) {
      const privPayload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.acceptTerms) privPayload.riskDisclosureAccepted = true;
      if (updates.notifyCorporateActions !== undefined) {
        privPayload.notifyCorporateActions = updates.notifyCorporateActions;
      }
      if (updates.notifyResearchDigest !== undefined) {
        privPayload.notifyResearchDigest = updates.notifyResearchDigest;
      }
      if (updates.timezone !== undefined) {
        privPayload.timezone = updates.timezone.trim().slice(0, 64) || 'Asia/Kolkata';
      }
      await updateDoc(doc(db, 'users', uid, 'private', 'profile'), privPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function incrementDailyAiUsage(
  uid: string,
  currentUsed: number,
  currentDate: string | undefined
): Promise<void> {
  const today = todayIsoDate();
  const nextCount = currentDate === today ? currentUsed + 1 : 1;
  try {
    await updateDoc(doc(db, 'users', uid), {
      aiCreditsUsedToday: nextCount,
      aiCreditsDate: today,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// --- Portfolios & Transactions ---
export interface PortfolioRecord {
  id: string;
  userId: string;
  name: string;
  currency: 'INR';
  notes?: string;
}

export function subscribePortfolios(
  uid: string,
  onUpdate: (items: PortfolioRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/portfolios`;
  const q = query(collection(db, 'users', uid, 'portfolios'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PortfolioRecord, 'id'>),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createPortfolio(uid: string, name: string, notes?: string): Promise<string> {
  const id = makeDocId('pf');
  const path = `users/${uid}/portfolios/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'portfolios', id), {
      userId: uid,
      name: name.trim().slice(0, 80) || 'Core India Equity',
      currency: 'INR',
      ...(notes?.trim() ? { notes: notes.trim().slice(0, 500) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeTransactions(
  uid: string,
  onUpdate: (items: PortfolioTransactionInput[]) => void
): Unsubscribe {
  const path = `users/${uid}/transactions`;
  const q = query(collection(db, 'users', uid, 'transactions'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            portfolioId: String(data.portfolioId),
            symbol: String(data.symbol),
            exchange: data.exchange === 'BSE' ? 'BSE' : 'NSE',
            type: data.type === 'SELL' ? 'SELL' : 'BUY',
            quantity: Number(data.quantity),
            priceInr: Number(data.priceInr),
            feesInr: Number(data.feesInr || 0),
            tradeDate: String(data.tradeDate),
            notes: data.notes ? String(data.notes) : undefined,
          };
        })
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function addPortfolioTransaction(
  uid: string,
  tx: Omit<PortfolioTransactionInput, 'id'>
): Promise<string> {
  const id = makeDocId('tx');
  const path = `users/${uid}/transactions/${id}`;
  const cleanSymbol = tx.symbol.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  try {
    await setDoc(doc(db, 'users', uid, 'transactions', id), {
      userId: uid,
      portfolioId: sanitizeId(tx.portfolioId),
      symbol: cleanSymbol,
      exchange: tx.exchange === 'BSE' ? 'BSE' : 'NSE',
      type: tx.type === 'SELL' ? 'SELL' : 'BUY',
      quantity: Math.max(0.0001, Number(tx.quantity)),
      priceInr: Math.max(0.01, Number(tx.priceInr)),
      feesInr: Math.max(0, Number(tx.feesInr || 0)),
      tradeDate: tx.tradeDate.slice(0, 10),
      ...(tx.notes?.trim() ? { notes: tx.notes.trim().slice(0, 240) } : {}),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removePortfolioTransaction(uid: string, txId: string): Promise<void> {
  const path = `users/${uid}/transactions/${txId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'transactions', txId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Watchlists ---
export interface WatchlistRecord {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
}

export function subscribeWatchlists(
  uid: string,
  onUpdate: (items: WatchlistRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/watchlists`;
  const q = query(collection(db, 'users', uid, 'watchlists'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WatchlistRecord, 'id'>),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveWatchlist(
  uid: string,
  name: string,
  symbols: string[],
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId) : makeDocId('wl');
  const path = `users/${uid}/watchlists/${id}`;
  const cleanSymbols = Array.from(
    new Set(symbols.map((s) => s.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24)).filter(Boolean))
  ).slice(0, 50);

  try {
    if (existingId) {
      await updateDoc(doc(db, 'users', uid, 'watchlists', id), {
        name: name.trim().slice(0, 64) || 'Watchlist',
        symbols: cleanSymbols,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', uid, 'watchlists', id), {
        userId: uid,
        name: name.trim().slice(0, 64) || 'Core Watchlist',
        symbols: cleanSymbols,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteWatchlist(uid: string, watchlistId: string): Promise<void> {
  const path = `users/${uid}/watchlists/${watchlistId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'watchlists', watchlistId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Saved AI Research Reports ---
export interface SavedResearchReportRecord {
  id: string;
  userId: string;
  symbol: string;
  companyName: string;
  snapshotId: string;
  aiProvider: string;
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  executiveThesis: string;
  valuationAssessment: string;
  profitabilitySummary: string;
  balanceSheetSummary: string;
  limitations: string;
}

export function subscribeResearchReports(
  uid: string,
  onUpdate: (items: SavedResearchReportRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/researchReports`;
  const q = query(
    collection(db, 'users', uid, 'researchReports'),
    where('userId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => {
          const data = d.data() as Omit<SavedResearchReportRecord, 'id'> & {
            createdAt?: { toMillis?: () => number };
          };
          const sortMs =
            data.createdAt?.toMillis?.() ??
            (data.generatedAt ? Date.parse(data.generatedAt) : 0);
          return {
            row: {
              id: d.id,
              userId: data.userId,
              symbol: data.symbol,
              companyName: data.companyName,
              snapshotId: data.snapshotId,
              aiProvider: data.aiProvider,
              modelId: data.modelId,
              promptVersion: data.promptVersion,
              generatedAt: data.generatedAt,
              executiveThesis: data.executiveThesis,
              valuationAssessment: data.valuationAssessment,
              profitabilitySummary: data.profitabilitySummary,
              balanceSheetSummary: data.balanceSheetSummary,
              limitations: data.limitations,
            } satisfies SavedResearchReportRecord,
            sortMs,
          };
        })
        .sort((a, b) => b.sortMs - a.sortMs)
        .map((entry) => entry.row);
      onUpdate(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveResearchReport(
  uid: string,
  analysis: GroundedAiResearchAnalysis
): Promise<string> {
  const id = makeDocId('rep');
  const path = `users/${uid}/researchReports/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'researchReports', id), {
      userId: uid,
      symbol: analysis.symbol.slice(0, 24),
      companyName: analysis.companyName.slice(0, 160),
      snapshotId: analysis.snapshotId.slice(0, 128),
      aiProvider: analysis.aiProvider.slice(0, 64),
      modelId: analysis.modelId.slice(0, 64),
      promptVersion: analysis.promptVersion.slice(0, 32),
      generatedAt: analysis.generatedAt.slice(0, 64),
      executiveThesis: analysis.executiveThesis.slice(0, 3000),
      valuationAssessment: analysis.valuationAssessment.slice(0, 3000),
      profitabilitySummary: analysis.profitabilityAndCapitalEfficiency.slice(0, 3000),
      balanceSheetSummary: analysis.balanceSheetAndLiquidity.slice(0, 3000),
      limitations: analysis.dataGapsAndLimitations.slice(0, 2000),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteResearchReport(uid: string, reportId: string): Promise<void> {
  const path = `users/${uid}/researchReports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'researchReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Subscriptions & Payment Audit Trail ---
export interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: 'free' | 'premium_monthly';
  status: 'pending_verification' | 'active' | 'cancelled' | 'refunded';
  amountInr: number;
  currency: 'INR';
  paymentProvider: string;
  webhookVerified: boolean;
  referenceCode: string;
}

export function subscribeUserSubscriptions(
  uid: string,
  onUpdate: (items: SubscriptionRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/subscriptions`;
  const q = query(collection(db, 'users', uid, 'subscriptions'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SubscriptionRecord, 'id'>),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createSubscriptionIntent(
  uid: string,
  amountInr: number
): Promise<string> {
  const id = makeDocId('sub');
  const path = `users/${uid}/subscriptions/${id}`;
  const referenceCode = `IW-INTENT-${Date.now().toString(36).toUpperCase()}`;
  try {
    await setDoc(doc(db, 'users', uid, 'subscriptions', id), {
      userId: uid,
      planId: 'premium_monthly',
      status: 'pending_verification',
      amountInr,
      currency: 'INR',
      paymentProvider: 'Gateway Pending Configuration',
      webhookVerified: false,
      referenceCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateUserTierAndSub(params: {
  targetUid: string;
  subId?: string;
  tier: 'free' | 'premium';
  subStatus?: 'active' | 'cancelled' | 'refunded';
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', params.targetUid), {
      tier: params.tier,
      updatedAt: serverTimestamp(),
    });
    if (params.subId && params.subStatus) {
      await updateDoc(doc(db, 'users', params.targetUid, 'subscriptions', params.subId), {
        status: params.subStatus,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${params.targetUid}`);
  }
}

// --- Support Tickets ---
export interface SupportTicketRecord {
  id: string;
  userId: string;
  subject: string;
  category: 'data_accuracy' | 'billing' | 'account' | 'compliance' | 'feature';
  message: string;
  status: 'open' | 'in_review' | 'resolved';
  adminReply?: string;
}

export function subscribeSupportTickets(
  uid: string,
  isAdmin: boolean,
  onUpdate: (items: SupportTicketRecord[]) => void
): Unsubscribe {
  const path = 'supportTickets';
  const q = isAdmin
    ? query(collection(db, 'supportTickets'))
    : query(collection(db, 'supportTickets'), where('userId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportTicketRecord, 'id'>),
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createSupportTicket(
  uid: string,
  ticket: {
    subject: string;
    category: SupportTicketRecord['category'];
    message: string;
  }
): Promise<string> {
  const id = makeDocId('tkt');
  const path = `supportTickets/${id}`;
  try {
    await setDoc(doc(db, 'supportTickets', id), {
      userId: uid,
      subject: ticket.subject.trim().slice(0, 160),
      category: ticket.category,
      message: ticket.message.trim().slice(0, 2000),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminReplySupportTicket(
  ticketId: string,
  status: SupportTicketRecord['status'],
  adminReply: string
): Promise<void> {
  const path = `supportTickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      status,
      adminReply: adminReply.trim().slice(0, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Admin Queries & Immutable Audit Logs ---
export async function fetchAllUsersForAdmin(): Promise<UserAccountDoc[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserAccountDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  action: string;
  target: string;
  details?: string;
}

export async function logAuditEvent(
  uid: string,
  action: string,
  target: string,
  details?: string
): Promise<void> {
  const id = makeDocId('log');
  const path = `auditLogs/${id}`;
  try {
    await setDoc(doc(db, 'auditLogs', id), {
      userId: uid,
      action: action.trim().slice(0, 80) || 'event',
      target: target.trim().slice(0, 120) || 'system',
      ...(details?.trim() ? { details: details.trim().slice(0, 500) } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeAuditLogs(
  uid: string,
  isAdmin: boolean,
  onUpdate: (items: AuditLogRecord[]) => void
): Unsubscribe {
  const path = 'auditLogs';
  const q = isAdmin
    ? query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'))
    : query(collection(db, 'auditLogs'), where('userId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => {
          const data = d.data() as Omit<AuditLogRecord, 'id'> & {
            createdAt?: { toMillis?: () => number };
          };
          return {
            row: {
              id: d.id,
              userId: data.userId,
              action: data.action,
              target: data.target,
              details: data.details,
            } satisfies AuditLogRecord,
            sortMs: data.createdAt?.toMillis?.() ?? 0,
          };
        })
        .sort((a, b) => b.sortMs - a.sortMs)
        .slice(0, 50)
        .map((entry) => entry.row);
      onUpdate(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
