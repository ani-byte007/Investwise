import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { marketDataAdapter } from '../services/dataAdapters.ts';
import { computeAllEquityMetrics } from '../engine/financialCalculations.ts';
import type { GroundedAiResearchAnalysis } from '../types/financial.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFirebaseProjectId(): string {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProjectId) return envProjectId;

  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '../../firebase-applet-config.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const rawCfg = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { projectId?: string };
        if (rawCfg.projectId && rawCfg.projectId !== 'remixed-project-id') {
          return rawCfg.projectId;
        }
      } catch (err) {
        console.warn('Could not parse firebase-applet-config.json:', err);
      }
    }
  }
  return '';
}

function getFirebaseAdminApp() {
  const projectId = resolveFirebaseProjectId();
  if (!projectId) return null;
  return getApps().length ? getApp() : initializeApp({ projectId });
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email?: string;
    emailVerified: boolean;
  };
}

export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const adminApp = getFirebaseAdminApp();
  const rateLimitStore = new Map<string, number[]>();

  function createRateLimiter(maxRequests: number, windowMs: number, bucketPrefix: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const identity = req.authUser?.uid || req.ip || 'anonymous';
      const key = `${bucketPrefix}:${identity}`;
      const now = Date.now();
      const history = (rateLimitStore.get(key) ?? []).filter((ts) => now - ts < windowMs);
      if (history.length >= maxRequests) {
        res.status(429).json({
          error: 'Rate limit exceeded. Please wait before submitting additional requests.',
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        });
        return;
      }
      history.push(now);
      rateLimitStore.set(key, history);
      next();
    };
  }

  async function requireFirebaseAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    if (!adminApp) {
      res.status(503).json({
        error: 'Firebase authentication is not configured for token verification.',
      });
      return;
    }
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer authentication token.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Empty authentication token.' });
      return;
    }
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(token);
      req.authUser = {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: Boolean(decoded.email_verified),
      };
      if (!req.authUser.emailVerified) {
        res.status(403).json({
          error: 'Verified email address required before running protected requests.',
        });
        return;
      }
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid authentication token.';
      res.status(401).json({ error: `Authentication verification failed: ${message}` });
    }
  }

  function getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  const generalApiLimiter = createRateLimiter(90, 60_000, 'api');
  const aiResearchLimiter = createRateLimiter(15, 60 * 60_000, 'ai_research');

  app.use('/api', generalApiLimiter);

  // Health & runtime config status (exposes zero secrets)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'InvestWise AI API',
      dataProvider: marketDataAdapter.adapterId,
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      paymentWebhookConfigured: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      firebaseProjectConfigured: Boolean(resolveFirebaseProjectId()),
      timestamp: new Date().toISOString(),
    });
  });

  // Backend Firebase ID Token & Server-Controlled Role Verification
  app.get('/api/auth/verify', requireFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
    const email = req.authUser?.email || '';
    const serverRole =
      req.authUser?.emailVerified && email === 'anikesh.0251mba193@dgu.ac.in'
        ? 'admin'
        : 'investor';
    res.json({
      authenticated: true,
      uid: req.authUser?.uid,
      email,
      emailVerified: req.authUser?.emailVerified,
      role: serverRole,
      verifiedAt: new Date().toISOString(),
    });
  });

  // Public Market & Reference Data Endpoints
  app.get('/api/market/providers', (_req, res) => {
    res.json({
      activeAdapter: marketDataAdapter.adapterId,
      providers: marketDataAdapter.getProviderRegistry(),
    });
  });

  app.get('/api/market/equities', (_req, res) => {
    const equities = marketDataAdapter.listEquities().map((eq) => ({
      ...eq,
      metricsBundle: computeAllEquityMetrics(eq),
    }));
    res.json({
      count: equities.length,
      dataProvider: marketDataAdapter.adapterId,
      equities,
    });
  });

  app.get('/api/market/equities/:symbol', (req, res) => {
    const symbol = String(req.params.symbol || '').toUpperCase().trim();
    const equity = marketDataAdapter.getEquityBySymbol(symbol);
    if (!equity) {
      res.status(404).json({ error: `Symbol '${symbol}' not found in authorized dataset.` });
      return;
    }
    res.json({
      equity,
      metricsBundle: computeAllEquityMetrics(equity),
    });
  });

  // Deterministic Calculation & Provenance Verification Endpoint
  app.post('/api/system/verify-calculations', (_req, res) => {
    const equities = marketDataAdapter.listEquities();
    const results = equities.map((eq) => {
      const bundle = computeAllEquityMetrics(eq);
      const metricList = Object.values(bundle.metrics);
      const validCount = metricList.filter((m) => m.status === 'valid').length;
      const expectedHandledNulls = metricList.filter(
        (m) => m.status === 'insufficient_data' || m.status === 'not_applicable_negative_earnings'
      ).length;
      return {
        symbol: eq.symbol,
        snapshotId: bundle.snapshotId,
        totalMetrics: metricList.length,
        validCount,
        handledEdgeCases: expectedHandledNulls,
        hasFullProvenance: metricList.every(
          (m) => Boolean(m.dataProvider && m.reportingDate && m.formula && m.calculationTimestamp)
        ),
      };
    });
    res.json({
      verifiedAt: new Date().toISOString(),
      equitiesChecked: results.length,
      allProvenanceComplete: results.every((r) => r.hasFullProvenance),
      results,
    });
  });

  // Grounded AI Research Engine (Server-side Gemini + Verified Calculations)
  app.post(
    '/api/research/analyze',
    requireFirebaseAuth,
    aiResearchLimiter,
    async (req: AuthenticatedRequest, res: Response) => {
      const symbol = String(req.body?.symbol || '').toUpperCase().trim();
      const focusQuestion =
        typeof req.body?.focusQuestion === 'string'
          ? req.body.focusQuestion.slice(0, 400).trim()
          : '';

      if (!symbol || !/^[A-Z0-9_-]{1,24}$/.test(symbol)) {
        res.status(400).json({ error: 'Valid NSE equity symbol is required.' });
        return;
      }

      const equity = marketDataAdapter.getEquityBySymbol(symbol);
      if (!equity) {
        res.status(404).json({
          error: `Equity '${symbol}' is unavailable in the authorized financial dataset. Fabricated data is prohibited.`,
        });
        return;
      }

      const metricsBundle = computeAllEquityMetrics(equity);
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured in server secrets. Configure GEMINI_API_KEY in Settings > Secrets to run AI research.',
        });
        return;
      }

      const promptVersion = 'iw-research-v2.1';
      const modelId = 'gemini-4-hydrogen';

      const groundedContext = {
        company: {
          companyId: equity.companyId,
          symbol: equity.symbol,
          exchange: equity.exchange,
          isin: equity.isin,
          companyName: equity.companyName,
          sector: equity.sector,
          industry: equity.industry,
          latestPriceInr: equity.latestPriceInr,
          fiftyTwoWeekHighInr: equity.fiftyTwoWeekHighInr,
          fiftyTwoWeekLowInr: equity.fiftyTwoWeekLowInr,
          marketCapCr: equity.marketCapCr,
        },
        provenance: equity.provenance,
        statements: equity.statements,
        calculatedMetrics: Object.values(metricsBundle.metrics).map((m) => ({
          metricName: m.metricName,
          formattedValue: m.formattedValue,
          status: m.status,
          financialPeriod: m.financialPeriod,
          formula: m.formula,
          methodology: m.methodology,
        })),
        corporateActions: equity.corporateActions,
        announcements: equity.announcements,
        news: equity.news,
        investorFocusQuestion:
          focusQuestion || 'Provide a balanced fundamental research breakdown.',
      };

      const systemInstruction = [
        'You are the InvestWise AI Grounded Equity Research Engine for Indian retail investors.',
        'STRICT GROUNDING RULES:',
        '1. Use ONLY numbers, ratios, dates, and filings provided in the JSON context. Never invent stock prices, financial figures, or news.',
        '2. Do NOT independently recalculate ratios; cite the exact calculatedMetrics provided.',
        '3. If a metric status is insufficient_data or not_applicable_negative_earnings (such as banking Current/Quick Ratio), explain why it is omitted.',
        '4. Maintain strict SEBI-compliant non-advisory neutrality: NEVER issue Buy/Sell/Hold recommendations, price targets, or guaranteed return claims.',
        '5. Clearly separate factual metrics from analytical interpretation and explicitly list data freshness/licensing limitations.',
      ].join('\n');

      try {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: `Analyze the following verified NSE equity snapshot and answer the investor focus question using strictly grounded facts:\n\n${JSON.stringify(groundedContext, null, 2)}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                executiveThesis: {
                  type: Type.STRING,
                  description:
                    'Concise factual overview of business and financial profile (2-4 sentences, non-advisory).',
                },
                valuationAssessment: {
                  type: Type.STRING,
                  description:
                    'Interpretation of P/E, P/B, and market valuation strictly citing provided ratios.',
                },
                profitabilityAndCapitalEfficiency: {
                  type: Type.STRING,
                  description:
                    'Interpretation of ROE, ROCE, Operating/EBITDA/Net margins and growth.',
                },
                balanceSheetAndLiquidity: {
                  type: Type.STRING,
                  description:
                    'Interpretation of Debt-to-Equity, Current Ratio, Quick Ratio, or banking schedule note.',
                },
                keyRisksAndCatalysts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, description: "Either 'risk' or 'catalyst'" },
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                      groundingRef: {
                        type: Type.STRING,
                        description: 'Filing, statement period, or metric cited.',
                      },
                    },
                    required: ['type', 'title', 'detail', 'groundingRef'],
                  },
                },
                dataGapsAndLimitations: {
                  type: Type.STRING,
                  description:
                    'Explicit limitations: dataset freshness, banking metric exclusions, and non-advisory scope.',
                },
                citedMetrics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      metricName: { type: Type.STRING },
                      value: { type: Type.STRING },
                      period: { type: Type.STRING },
                    },
                    required: ['metricName', 'value', 'period'],
                  },
                },
              },
              required: [
                'executiveThesis',
                'valuationAssessment',
                'profitabilityAndCapitalEfficiency',
                'balanceSheetAndLiquidity',
                'keyRisksAndCatalysts',
                'dataGapsAndLimitations',
                'citedMetrics',
              ],
            },
          },
        });

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          res.status(502).json({ error: 'AI service returned an empty response.' });
          return;
        }

        const parsed = JSON.parse(rawText) as Omit<
          GroundedAiResearchAnalysis,
          | 'snapshotId'
          | 'symbol'
          | 'companyName'
          | 'aiProvider'
          | 'modelId'
          | 'promptVersion'
          | 'generatedAt'
          | 'sourceReferences'
          | 'nonAdvisoryDisclaimer'
        >;

        const analysisPacket: GroundedAiResearchAnalysis = {
          snapshotId: metricsBundle.snapshotId,
          symbol: equity.symbol,
          companyName: equity.companyName,
          aiProvider: 'Google Gemini',
          modelId,
          promptVersion,
          generatedAt: new Date().toISOString(),
          executiveThesis: parsed.executiveThesis,
          valuationAssessment: parsed.valuationAssessment,
          profitabilityAndCapitalEfficiency: parsed.profitabilityAndCapitalEfficiency,
          balanceSheetAndLiquidity: parsed.balanceSheetAndLiquidity,
          keyRisksAndCatalysts: Array.isArray(parsed.keyRisksAndCatalysts)
            ? parsed.keyRisksAndCatalysts.slice(0, 6)
            : [],
          dataGapsAndLimitations: parsed.dataGapsAndLimitations,
          citedMetrics: Array.isArray(parsed.citedMetrics) ? parsed.citedMetrics : [],
          sourceReferences: [
            {
              provider: equity.provenance.dataProvider,
              period: equity.provenance.financialPeriod,
              reportingDate: equity.provenance.reportingDate,
              freshnessStatus: equity.provenance.freshnessStatus,
            },
          ],
          nonAdvisoryDisclaimer:
            'AI-generated interpretation of verified historical/reference financial metrics. InvestWise AI is not a SEBI-registered Investment Adviser or Research Analyst. Nothing herein constitutes investment advice or a solicitation to buy or sell securities.',
        };

        res.json({
          analysis: analysisPacket,
          metricsBundle,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI research generation failed.';
        res.status(502).json({
          error: `Grounded AI research request failed: ${message}`,
        });
      }
    }
  );

  // Secure Payment Webhook Verification Endpoint (Never trusts client responses)
  app.post('/api/payments/webhook', (req, res) => {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.status(503).json({
        verified: false,
        error:
          'Live payment gateway webhook secret is not configured. Payments remain in pending_verification until approved gateway credentials are provisioned.',
      });
      return;
    }
    const signature = String(
      req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'] || ''
    );
    if (!signature) {
      res.status(400).json({ verified: false, error: 'Missing webhook signature header.' });
      return;
    }
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ verified: false, error: 'Invalid webhook HMAC signature.' });
      return;
    }

    res.json({
      verified: true,
      receivedAt: new Date().toISOString(),
      event: req.body?.event || 'payment.verified',
    });
  });

  return app;
}
