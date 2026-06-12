import { NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";

const msal = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
});

export async function GET() {
  const url = await msal.getAuthCodeUrl({
    scopes: ["Mail.Read", "offline_access", "User.Read"],
    redirectUri: "http://localhost:3000/api/outlook/callback",
  });

  return NextResponse.redirect(url);
}