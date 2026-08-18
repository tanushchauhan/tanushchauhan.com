/**
 * The résumé, fetched from where it is actually maintained.
 *
 * It used to be a file committed into public/files, which meant every edit was
 * a commit, a build, and a deploy to change a PDF that had nothing to do with
 * the site. resume.tanushchauhan.com already serves the current one, so this
 * proxies it and the copy in the repo becomes a fallback rather than the
 * source.
 *
 * It has to be proxied rather than linked. That host sends no CORS headers, so
 * pdf.js cannot fetch it cross origin, and putting another host in the path of
 * a page load is worth avoiding anyway. Same origin also means the download
 * link and the viewer keep the one URL they already use.
 */
const SOURCE = Bun.env.RESUME_URL ?? "https://resume.tanushchauhan.com/";
/* The built copy first, then the one in the tree, so a server started against
   a checkout without a build still has something to hand over. */
const FALLBACKS = ["./dist/files/resume.pdf", "./public/files/resume.pdf"];

/** Long enough that a page load is rarely a round trip, short enough that an
    edit shows up the same morning without anybody restarting anything. */
const TTL_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 6 * 1000;

const PDF_MAGIC = "%PDF";

type Cached = { body: Uint8Array; etag: string | null; at: number };

let cached: Cached | null = null;
let inFlight: Promise<Cached | null> | null = null;

const looksLikePdf = (body: Uint8Array) =>
  body.length > 1024 && new TextDecoder().decode(body.subarray(0, 4)) === PDF_MAGIC;

const fetchUpstream = async (): Promise<Cached | null> => {
  try {
    const res = await fetch(SOURCE, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // a conditional request when we already hold a copy: an unchanged résumé
      // costs 304 and no body, which is the common case by a wide margin
      headers: cached?.etag ? { "if-none-match": cached.etag } : {},
    });

    if (res.status === 304 && cached) return { ...cached, at: Date.now() };
    if (!res.ok) return null;

    const body = new Uint8Array(await res.arrayBuffer());
    // a login page or an error page served with a 200 is not a résumé, and
    // handing one to the viewer fails in a way nobody would think to check
    if (!looksLikePdf(body)) return null;

    return { body, etag: res.headers.get("etag"), at: Date.now() };
  } catch {
    return null; // unreachable, slow, or refusing: the fallback covers it
  }
};

/**
 * The current résumé, or the committed copy when the source cannot be had.
 *
 * A stale cached copy beats the fallback: it is still the real résumé, only a
 * few minutes behind, whereas the file on disk is however old the last deploy
 * was.
 */
export const resumePdf = async (): Promise<{ body: Uint8Array; source: string } | null> => {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return { body: cached.body, source: "cache" };
  }

  // one refresh at a time: a cold start under a crawler should not become a
  // dozen simultaneous fetches of the same file
  inFlight ??= fetchUpstream().finally(() => {
    inFlight = null;
  });
  const fresh = await inFlight;

  if (fresh) {
    cached = fresh;
    return { body: fresh.body, source: "upstream" };
  }
  if (cached) return { body: cached.body, source: "stale" };

  for (const path of FALLBACKS) {
    const file = Bun.file(path);
    if (await file.exists()) {
      return { body: new Uint8Array(await file.arrayBuffer()), source: "fallback" };
    }
  }
  return null;
};
