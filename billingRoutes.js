// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Stripe Billing Routes (Sprint 5.6)
//
// Subscription management for Free/Pro plans.
//
// Plans:
//   Free  — Local-only, all features, no cloud sync
//   Pro   — $14/mo: Cloud sync, broker auto-import, priority support
//
// Endpoints:
//   POST /api/billing/checkout    — Create Stripe Checkout session
//   POST /api/billing/portal      — Open Stripe Customer Portal
//   POST /api/billing/webhook     — Stripe webhook handler
//   GET  /api/billing/status      — Current subscription status
//
// Setup:
//   STRIPE_SECRET_KEY=sk_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
//   STRIPE_PRO_PRICE_ID=price_...
//
// Usage:
//   import { registerBillingRoutes } from './billingRoutes.js';
//   registerBillingRoutes(app);
// ═══════════════════════════════════════════════════════════════════

// ─── In-Memory Subscription Store ───────────────────────────────
// Production: store in database, sync with Supabase user metadata

const _subscriptions = new Map(); // userId → { plan, stripeCustomerId, stripeSubId, status, currentPeriodEnd }

function getSubscription(userId) {
  return _subscriptions.get(userId) || {
    plan: 'free',
    status: 'active',
    stripeCustomerId: null,
    stripeSubId: null,
    currentPeriodEnd: null,
  };
}

function setSubscription(userId, data) {
  _subscriptions.set(userId, { ...getSubscription(userId), ...data });
}

// ─── Feature Gates ──────────────────────────────────────────────

const PLAN_FEATURES = {
  free: {
    cloudSync: false,
    brokerAutoImport: false,
    maxTrades: 500,
    maxCharts: 4,
    exportFormats: ['csv'],
    priority: false,
  },
  pro: {
    cloudSync: true,
    brokerAutoImport: true,
    maxTrades: Infinity,
    maxCharts: 16,
    exportFormats: ['csv', 'html', 'json', 'pdf'],
    priority: true,
  },
};

export function getFeatures(userId) {
  const sub = getSubscription(userId);
  const plan = sub.status === 'active' || sub.status === 'trialing' ? sub.plan : 'free';
  return { plan, features: PLAN_FEATURES[plan] || PLAN_FEATURES.free };
}

// ─── Route Registration ─────────────────────────────────────────

export function registerBillingRoutes(app) {
  let stripe = null;

  // Lazy-init Stripe (only if configured)
  function getStripe() {
    if (stripe) return stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    try {
      // Dynamic import for Stripe SDK
      const Stripe = require('stripe');
      stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
      return stripe;
    } catch {
      console.warn('[Billing] Stripe SDK not installed. Run: npm install stripe');
      return null;
    }
  }

  // Auth middleware
  function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = auth.slice(7);
    if (!token || token === 'local-token') return res.status(401).json({ error: 'Invalid token' });
    req.userId = 'user_' + simpleHash(token);
    next();
  }

  // ─── GET /api/billing/status ────────────────────────────────
  app.get('/api/billing/status', requireAuth, (req, res) => {
    const sub = getSubscription(req.userId);
    const { features } = getFeatures(req.userId);

    res.json({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      features,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    });
  });

  // ─── POST /api/billing/checkout ─────────────────────────────
  // Create a Stripe Checkout session for Pro upgrade
  app.post('/api/billing/checkout', requireAuth, async (req, res) => {
    const s = getStripe();
    if (!s) return res.status(400).json({ error: 'Stripe not configured' });

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) return res.status(400).json({ error: 'STRIPE_PRO_PRICE_ID not set' });

    try {
      const sub = getSubscription(req.userId);
      let customerId = sub.stripeCustomerId;

      // Create customer if doesn't exist
      if (!customerId) {
        const customer = await s.customers.create({
          metadata: { userId: req.userId },
        });
        customerId = customer.id;
        setSubscription(req.userId, { stripeCustomerId: customerId });
      }

      const session = await s.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${req.protocol}://${req.get('host')}/?billing=success`,
        cancel_url: `${req.protocol}://${req.get('host')}/?billing=cancel`,
        metadata: { userId: req.userId },
      });

      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/billing/portal ───────────────────────────────
  // Open Stripe Customer Portal for subscription management
  app.post('/api/billing/portal', requireAuth, async (req, res) => {
    const s = getStripe();
    if (!s) return res.status(400).json({ error: 'Stripe not configured' });

    const sub = getSubscription(req.userId);
    if (!sub.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    try {
      const portal = await s.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/`,
      });

      res.json({ portalUrl: portal.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/billing/webhook ──────────────────────────────
  // Stripe webhook handler — must use raw body
  app.post('/api/billing/webhook',
    // Raw body parser for Stripe signature verification
    (req, res, next) => {
      if (req.headers['content-type'] === 'application/json') {
        // Already parsed — skip for dev testing
        next();
      } else {
        let rawBody = '';
        req.on('data', chunk => { rawBody += chunk; });
        req.on('end', () => { req.rawBody = rawBody; next(); });
      }
    },
    async (req, res) => {
      const s = getStripe();
      if (!s) return res.status(400).send('Stripe not configured');

      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;

      try {
        if (webhookSecret && sig) {
          event = s.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, webhookSecret);
        } else {
          // Dev mode — accept without verification
          event = req.body;
        }
      } catch (err) {
        return res.status(400).send(`Webhook signature failed: ${err.message}`);
      }

      // Handle events
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.userId;
          if (userId) {
            setSubscription(userId, {
              plan: 'pro',
              status: 'active',
              stripeCustomerId: session.customer,
              stripeSubId: session.subscription,
            });
            console.log(`[Billing] User ${userId} upgraded to Pro`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const userId = findUserByCustomerId(sub.customer);
          if (userId) {
            setSubscription(userId, {
              status: sub.status,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const userId = findUserByCustomerId(sub.customer);
          if (userId) {
            setSubscription(userId, { plan: 'free', status: 'canceled', stripeSubId: null });
            console.log(`[Billing] User ${userId} downgraded to Free`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const userId = findUserByCustomerId(invoice.customer);
          if (userId) {
            setSubscription(userId, { status: 'past_due' });
          }
          break;
        }
      }

      res.json({ received: true });
    }
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function findUserByCustomerId(customerId) {
  for (const [userId, sub] of _subscriptions) {
    if (sub.stripeCustomerId === customerId) return userId;
  }
  return null;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export { PLAN_FEATURES, getSubscription, setSubscription };
export default registerBillingRoutes;
