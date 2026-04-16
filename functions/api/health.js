export async function onRequestGet(context) {
  return Response.json({
    ok: true,
    status: "healthy",
    runtime: "cloudflare-pages-functions",
    site: context.env.SITE_NAME || "site"
  });
}
