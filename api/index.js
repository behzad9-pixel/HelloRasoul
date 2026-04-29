// Export configuration object for the runtime environment
// Here, "edge" means this function will run on an Edge Runtime (e.g., Vercel Edge Functions)
export const cfg = { runtime: "edge" };

// Define the base target URL from environment variable TARGET_DOMAIN
// If not set, fallback to an empty string
// .replace(/\/$/, "") removes a trailing slash if present
const BASE_URL = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// Define a set of headers that should NOT be forwarded to the target server
// These are typically hop-by-hop headers or proxy-related headers
const SKIP_HEADERS = new Set([
  "host",                 // Host header is managed automatically
  "connection",           // Controls connection-specific options
  "keep-alive",           // Persistent connection control
  "proxy-authenticate",   // Proxy authentication header
  "proxy-authorization",  // Proxy authorization header
  "te",                   // Transfer encoding header
  "trailer",              // Trailer header
  "transfer-encoding",    // Chunked encoding info
  "upgrade",              // Protocol upgrade (e.g., WebSocket)
  "forwarded",            // Forwarding information
  "x-forwarded-host",     // Forwarded host header
  "x-forwarded-proto",    // Forwarded protocol (http/https)
  "x-forwarded-port",     // Forwarded port number
]);

// Default exported async handler function for incoming requests
export default async function handler(req) {

  // If BASE_URL is not defined, return an error response
  if (!BASE_URL) {
    return new Response("Target Domain ro set nakardi javan", { status: 500 });
  }

  try {
    // Find the first "/" after "https://"
    // index 8 assumes protocol like "https://"
    const idx = req.url.indexOf("/", 8);

    // Construct target URL:
    // If no path exists → just BASE_URL + "/"
    // Otherwise → append request path to BASE_URL
    const target =
      idx === -1 ? BASE_URL + "/" : BASE_URL + req.url.slice(idx);

    // Create a new Headers object for the outgoing request
    const hdrs = new Headers();

    // Variable to store client IP if found
    let clientIp = null;

    // Iterate through all incoming request headers
    for (const [k, v] of req.headers) {

      // Skip headers listed in SKIP_HEADERS
      if (SKIP_HEADERS.has(k)) continue;

      // Skip Vercel-specific internal headers
      if (k.startsWith("x-vercel-")) continue;

      // Capture real client IP if available
      if (k === "x-real-ip") {
        clientIp = v;
        continue;
      }

      // Capture forwarded IP if x-real-ip not already set
      if (k === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }

      // Copy remaining headers to the new Headers object
      hdrs.set(k, v);
    }

    // If client IP was detected, explicitly set it in outgoing headers
    if (clientIp) {
      hdrs.set("x-forwarded-for", clientIp);
    }

    // Extract HTTP method (GET, POST, etc.)
    const m = req.method;

    // Determine if request should include a body
    // GET and HEAD should not have a body
    const hasBody = m !== "GET" && m !== "HEAD";

    // Forward the request to the target server using fetch()
    return await fetch(target, {
      method: m,                       // Use same HTTP method
      headers: hdrs,                   // Forward filtered headers
      body: hasBody ? req.body : undefined, // Include body if applicable
      duplex: "half",                  // Required for streaming requests in Edge runtime
      redirect: "manual",              // Do not auto-follow redirects
    });

  } catch (err) {
    // Log error for debugging
    console.error("Ye moshkeli pish omade javan:", err);

    // Return a 502 Bad Gateway response on failure
    return new Response("Motaesefane natonestim rela va getvay ro rah bendazim javun....", { status: 502 });
  }
}