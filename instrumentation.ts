// Runs once when the Node.js server starts. Re-arms the retry timers of emails and Lead Manager forwards that were still waiting when
// the server last stopped (timers live in memory; the log tables remember what is pending). Deferred so it never delays start-up.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const t = setTimeout(async () => {
    try {
      const [{ resumeRetries }, { resumeForwardRetries }] = await Promise.all([import('./lib/mailer'), import('./lib/leadmanager')]);
      resumeRetries();
      resumeForwardRetries();
    } catch (err) {
      console.error('[boot] could not resume pending retries:', err instanceof Error ? err.message : err);
    }
  }, 5000);
  (t as unknown as { unref?: () => void }).unref?.();
}
