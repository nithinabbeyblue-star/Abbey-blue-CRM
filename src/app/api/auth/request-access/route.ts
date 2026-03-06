import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";
import { triggerEvent, userChannel } from "@/lib/pusher";

const schema = z.object({
  email: z.string().email(),
});

// POST /api/auth/request-access — Unauthenticated. Sends access request to SA.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.status !== "PENDING") {
      // Don't reveal whether the user exists
      return NextResponse.json({ success: true });
    }

    // Rate limit: skip if ACCESS_REQUEST notification sent in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentNotif = await db.notification.findFirst({
      where: {
        type: "ACCESS_REQUEST",
        metadata: { contains: user.id },
        createdAt: { gt: fiveMinAgo },
      },
    });
    if (recentNotif) {
      return NextResponse.json({ success: true });
    }

    // Geo-IP lookup (non-critical)
    const headers = request.headers;
    const ip = extractIp(headers);
    const device = extractDevice(headers);
    let city = "Unknown";
    let country = "Unknown";

    try {
      if (ip && ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          city = geo.city || "Unknown";
          country = geo.country_name || "Unknown";
        }
      }
    } catch {
      // Geo lookup failure is non-critical
    }

    // Store geo data on user
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginIp: ip, lastLoginCity: city, lastLoginCountry: country },
    });

    // Create notification for all SUPER_ADMIN users
    const superAdmins = await db.user.findMany({
      where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      select: { id: true },
    });

    for (const sa of superAdmins) {
      await db.notification.create({
        data: {
          type: "ACCESS_REQUEST",
          title: "New Access Request",
          body: `${user.name} (${user.email}) is requesting access. Role: ${user.role}. Location: ${city}, ${country}.`,
          metadata: JSON.stringify({ userId: user.id, ip, device, city, country }),
          userId: sa.id,
        },
      });

      await triggerEvent(userChannel(sa.id), "notification", {
        title: "New Access Request",
        body: `${user.name} is requesting access from ${city}, ${country}.`,
      });
    }

    // Send real email to SA
    const saEmail = process.env.SUPER_ADMIN_EMAIL;
    if (saEmail) {
      await sendMail({
        to: saEmail,
        subject: `Access Request: ${user.name} (${user.role})`,
        html: `
          <h2>New Access Request</h2>
          <table style="border-collapse:collapse;">
            <tr><td style="padding:4px 12px;font-weight:bold;">Name</td><td>${user.name}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">Email</td><td>${user.email}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">Role</td><td>${user.role}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">IP Address</td><td>${ip}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">Device</td><td>${device}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">Location</td><td>${city}, ${country}</td></tr>
          </table>
          <p style="margin-top:16px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/super-admin/users">Manage Users</a>
          </p>
        `,
      });
    }

    // Console log mock email for the user
    console.log(`[Mock Email to ${user.email}] Subject: Access Request Received`);
    console.log(`Your access request has been sent to the administrator. Please wait for approval.`);

    // Audit log
    await createAuditLog({
      action: "ACCESS_REQUEST_SENT",
      userId: user.id,
      metadata: JSON.stringify({ ip, device, city, country }),
      ipAddress: ip,
      userAgent: device,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Request access error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
