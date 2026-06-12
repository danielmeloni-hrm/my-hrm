import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";

const msal = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
});

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Authorization code mancante" },
      { status: 400 }
    );
  }

  const result = await msal.acquireTokenByCode({
    code,
    scopes: ["Mail.Read", "offline_access", "User.Read"],
    redirectUri: "http://localhost:3000/api/outlook/callback",
  });

  return NextResponse.json({
    success: true,
    refreshToken: result?.account?.homeAccountId,
    accessToken: result?.accessToken,
    account: result?.account,
  });
}