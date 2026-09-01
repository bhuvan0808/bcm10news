/**
 * BCM10 scheduler.
 *
 * Calls the public site's cron endpoints on a one-minute trigger.
 *
 * This exists because Vercel's Hobby plan caps cron at once per day, which
 * cannot drive scheduled publishing — a story queued for 09:00 has to go out at
 * 09:00. Cloudflare's free tier allows per-minute triggers, and the account is
 * already in use for DNS and R2, so this adds a file rather than a vendor.
 *
 * Both endpoints are idempotent. `publish_due_articles()` publishes in a single
 * UPDATE ... RETURNING, so overlapping invocations cannot publish a story twice,
 * and a missed minute is caught by the next one.
 */

interface Env {
  SITE_URL: string;
  CRON_SECRET: string;
}

interface Job {
  path: string;
  /** Run only when the current minute is divisible by this. 1 = every minute. */
  everyMinutes: number;
}

const JOBS: Job[] = [
  { path: '/api/cron/publish-scheduled', everyMinutes: 1 },
  // Trending is a materialised view refresh; every minute would be wasteful.
  { path: '/api/cron/refresh-trending', everyMinutes: 5 },
];

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDue(event.scheduledTime, env));
  },

  /**
   * Manual trigger, for checking the wiring without waiting for a tick.
   * Requires the same secret as the endpoints themselves, so it cannot be used
   * by anyone else to hammer the origin.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!env.CRON_SECRET || provided !== env.CRON_SECRET) {
      return new Response('Not authorised', { status: 401 });
    }

    const results = await runDue(Date.now(), env, true);
    return Response.json({ ok: true, results });
  },
};

async function runDue(scheduledTime: number, env: Env, force = false) {
  const minute = new Date(scheduledTime).getUTCMinutes();

  const due = JOBS.filter((job) => force || minute % job.everyMinutes === 0);

  return Promise.all(
    due.map(async (job) => {
      const url = `${env.SITE_URL.replace(/\/+$/, '')}${job.path}`;

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
          // Bounded: a hung origin must not hold the Worker open. Publishing
          // that misses one minute is picked up by the next tick.
          signal: AbortSignal.timeout(20_000),
        });

        const body = await response.text();

        if (!response.ok) {
          console.error(`${job.path} -> HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        return { path: job.path, status: response.status, body: body.slice(0, 200) };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'unknown error';
        console.error(`${job.path} -> ${message}`);
        return { path: job.path, status: 0, error: message };
      }
    })
  );
}
