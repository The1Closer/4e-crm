import 'server-only'

type GraphAuthConfig = {
  tenantId: string
  clientId: string
  clientSecret: string
}

type SendAttachmentInput = {
  name: string
  contentBytesBase64: string
  contentType: string
}

type SendMailInput = {
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string
  attachments?: SendAttachmentInput[]
}

function getGraphAuthConfig(): GraphAuthConfig {
  const tenantId = process.env.MS365_TENANT_ID?.trim() ?? ''
  const clientId = process.env.MS365_CLIENT_ID?.trim() ?? ''
  const clientSecret = process.env.MS365_CLIENT_SECRET?.trim() ?? ''

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Microsoft 365 Graph configuration. Set MS365_TENANT_ID, MS365_CLIENT_ID, and MS365_CLIENT_SECRET.'
    )
  }

  return { tenantId, clientId, clientSecret }
}

async function fetchGraphAccessToken() {
  const config = getGraphAuthConfig()
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`

  const formData = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
    cache: 'no-store',
  })

  const result = (await response.json().catch(() => null)) as
    | {
        access_token?: string
        error?: string
        error_description?: string
      }
    | null

  if (!response.ok || !result?.access_token) {
    const detail =
      result?.error_description || result?.error || 'Could not authenticate with Microsoft Graph.'
    throw new Error(`Microsoft Graph auth failed: ${detail}`)
  }

  return result.access_token
}

export async function sendMailViaMicrosoftGraph(input: SendMailInput) {
  const token = await fetchGraphAccessToken()
  const fromEmail = input.fromEmail.trim()

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: {
            contentType: 'Text',
            content: input.bodyText,
          },
          toRecipients: [
            {
              emailAddress: {
                address: input.toEmail.trim(),
              },
            },
          ],
          attachments: (input.attachments ?? []).map((attachment) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.name,
            contentType: attachment.contentType,
            contentBytes: attachment.contentBytesBase64,
          })),
        },
        saveToSentItems: true,
      }),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Microsoft Graph send failed (${response.status}). ${errorText || 'No response body.'}`
    )
  }
}

