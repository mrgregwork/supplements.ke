import { defineRailway, github, postgres, preserve, project, ref, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 50000 });
  const supplementsKe = service("supplements.ke", {
    source: github("mrgregwork/supplements.ke", { branch: "master", checkSuites: false, commitSha: "8d42a0634c9f3aa35aa8486673b06933bbefa04a", upstreamUrl: "https://github.com/mrgregwork/supplements.ke" }),
    replicas: { "us-west2": 1 },
    domains: [{ domain: "supplements.ke", port: 5000 }],
    networking: { privateNetworkEndpoint: "supplementske" },
    env: { DATABASE_URL: preserve(), EPAYMENTS_API_KEY: preserve(), EPAYMENTS_API_URL: preserve(), EPAYMENTS_WEBHOOK_SECRET: preserve(), RESEND_API_KEY: preserve(), SESSION_SECRET: preserve() },
  });

  // Reconciles stuck M-Pesa/Card checkouts -- E-Payments' webhook makes
  // exactly one delivery attempt, ever, so this is the backstop for a
  // dropped delivery or an abandoned tab. See docs/PAYMENT_INTEGRATION.md.
  // Same pattern as cosmetics.ke's own cosmetics-reconcile-epayments cron.
  const supplementsReconcileEpayments = service("supplements-reconcile-epayments", {
    source: github("mrgregwork/supplements.ke", { branch: "master", checkSuites: false }),
    replicas: { "us-west2": 1 },
    // Neither `npm run` nor `npx tsx` execute the node_modules/.bin/tsx
    // binary reliably in this container image (confirmed on cosmetics.ke's
    // identical cron) -- invoking `node` directly against tsx's JS entry
    // point sidesteps the executable-bit issue entirely.
    startCommand: "node node_modules/tsx/dist/cli.mjs scripts/reconcile-epayments.ts",
    build: "npm install --production=false",
    deploy: {
      cronSchedule: "*/5 * * * *",
      restartPolicyType: "NEVER",
    },
    env: {
      DATABASE_URL: ref(Postgres, "DATABASE_URL"),
      // These three are set directly on this service (copied from the web
      // service 03/10/2026), NOT as ref(supplementsKe, ...): a reference to
      // the service named "supplements.ke" resolves to an empty string,
      // apparently because of the dot in the name (confirmed: the same
      // pattern works on a service with no dot, and a ref() here read back
      // as length 0). preserve() stops `railway config apply` overwriting
      // them. If any of these change on the web service, update them here too.
      EPAYMENTS_API_URL: preserve(),
      EPAYMENTS_API_KEY: preserve(),
      // finalizePendingOrder() sends the order confirmation email after it
      // confirms a payment; when the cron is the one that resolves the order
      // it needs this too, or the customer silently gets no email.
      RESEND_API_KEY: preserve(),
    },
  });

  return project("supplements.ke", {
    resources: [Postgres, supplementsKe, supplementsReconcileEpayments, postgresVolume],
  });
});
