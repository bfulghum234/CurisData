const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendViaResend(env, payload) {
  const from = env.CONTACT_FROM || "CurisData <noreply@curiscorp.com>";
  const to = env.CONTACT_EMAIL || "bfulghum@curisdata.com";

  const html = `
    <h2>New CurisData Inquiry</h2>
    <p><strong>Inquiry Type:</strong> ${escapeHtml(payload.inquiryType)}</p>
    <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Company:</strong> ${escapeHtml(payload.company || "-")}</p>
    <p><strong>Markets:</strong> ${escapeHtml(payload.markets || "-")}</p>
    <p><strong>Timeline:</strong> ${escapeHtml(payload.timeline || "-")}</p>
    <p><strong>Volume:</strong> ${escapeHtml(payload.volume || "-")}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(payload.message).replaceAll("\n", "<br>")}</p>
  `;

  const text = [
    "New CurisData Inquiry",
    `Inquiry Type: ${payload.inquiryType}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company || "-"}`,
    `Markets: ${payload.markets || "-"}`,
    `Timeline: ${payload.timeline || "-"}`,
    `Volume: ${payload.volume || "-"}`,
    "",
    "Message:",
    payload.message
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: payload.email,
      subject: `CurisData Inquiry: ${payload.inquiryType}`,
      html,
      text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error: ${response.status} ${errorText}`);
  }
}

async function sendViaMailchannels(env, payload) {
  const fromEmail = env.CONTACT_FROM_EMAIL || "noreply@curiscorp.com";
  const fromName = env.CONTACT_FROM_NAME || "CurisData Website";
  const toEmail = env.CONTACT_EMAIL || "bfulghum@curisdata.com";

  const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: toEmail, name: "CurisData" }],
          reply_to: { email: payload.email, name: payload.name }
        }
      ],
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `CurisData Inquiry: ${payload.inquiryType}`,
      content: [
        {
          type: "text/plain",
          value: [
            "New CurisData Inquiry",
            `Inquiry Type: ${payload.inquiryType}`,
            `Name: ${payload.name}`,
            `Email: ${payload.email}`,
            `Company: ${payload.company || "-"}`,
            `Markets: ${payload.markets || "-"}`,
            `Timeline: ${payload.timeline || "-"}`,
            `Volume: ${payload.volume || "-"}`,
            "",
            "Message:",
            payload.message
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MailChannels error: ${response.status} ${errorText}`);
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json();

    if (payload.website) {
      return json({ success: true });
    }

    const required = ["inquiryType", "name", "email", "message"];
    for (const field of required) {
      if (!payload[field] || !String(payload[field]).trim()) {
        return json({ success: false, error: `Missing required field: ${field}` }, 400);
      }
    }

    if (env.RESEND_API_KEY) {
      await sendViaResend(env, payload);
    } else {
      await sendViaMailchannels(env, payload);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return json({ success: false, error: "Unable to send inquiry." }, 500);
  }
}
