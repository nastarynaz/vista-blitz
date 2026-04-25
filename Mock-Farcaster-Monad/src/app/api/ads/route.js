export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userWallet = searchParams.get("userWallet");

  if (!userWallet) {
    return Response.json({ campaigns: [] });
  }

  const dashboardUrl =
    process.env.NEXT_PUBLIC_VISTA_DASHBOARD_URL ?? "http://localhost:3031";

  try {
    const res = await fetch(
      `${dashboardUrl}/api/campaigns/active?userWallet=${encodeURIComponent(userWallet)}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      return Response.json({ campaigns: [] });
    }

    const data = await res.json();
    return Response.json({ campaigns: data.campaigns ?? [] });
  } catch {
    return Response.json({ campaigns: [] });
  }
}
