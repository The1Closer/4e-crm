import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import {
  isMissingJobPaymentsTableError,
  JOB_PAYMENT_SELECT_FIELDS,
  loadJobPaymentsData,
  syncJobFinancialTotals,
} from '@/lib/job-payments-server'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
}

function normalizeText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeAmount(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    throw new Error('Payment amount is required.')
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error('Payment amount is required.')
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Payment amount must be greater than zero.')
  }

  return parsed
}

async function removeProofFile(filePath: string | null) {
  if (!filePath) return
  await supabaseAdmin.storage.from('job-files').remove([filePath])
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  try {
    const paymentData = await loadJobPaymentsData(jobId)

    return NextResponse.json({
      payments: paymentData.payments,
      summary: paymentData.summary,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not load payments.',
      },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  let proofFilePath: string | null = null

  try {
    const formData = await req.formData()
    const amount = normalizeAmount(formData.get('amount'))
    const paymentType = normalizeText(formData.get('paymentType'))
    const paymentDate = normalizeDate(formData.get('paymentDate'))
    const checkNumber = normalizeText(formData.get('checkNumber'))
    const note = normalizeText(formData.get('note'))
    const fileEntry = formData.get('file')

    if (!paymentType) {
      return NextResponse.json({ error: 'Payment type is required.' }, { status: 400 })
    }

    if (!paymentDate) {
      return NextResponse.json({ error: 'Payment date is required.' }, { status: 400 })
    }

    let proofFileName: string | null = null

    if (fileEntry instanceof File && fileEntry.size > 0) {
      proofFileName = fileEntry.name || 'payment-proof'
      proofFilePath = `payments/${jobId}/${Date.now()}-${slugifyFileName(proofFileName)}`

      const uploadRes = await supabaseAdmin.storage
        .from('job-files')
        .upload(proofFilePath, await fileEntry.arrayBuffer(), {
          contentType: fileEntry.type || undefined,
          upsert: false,
        })

      if (uploadRes.error) {
        return NextResponse.json({ error: uploadRes.error.message }, { status: 400 })
      }
    } else if (fileEntry !== null && fileEntry !== undefined && !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'Uploaded proof must be a file.' },
        { status: 400 }
      )
    }

    const { data: insertedPayment, error: insertError } = await supabaseAdmin
      .from('job_payments')
      .insert({
        job_id: jobId,
        amount,
        payment_type: paymentType,
        payment_date: paymentDate,
        check_number: checkNumber,
        note,
        proof_file_name: proofFileName,
        proof_file_path: proofFilePath,
        created_by: authResult.requester.profile.id,
      })
      .select(JOB_PAYMENT_SELECT_FIELDS)
      .single()

    if (insertError || !insertedPayment) {
      await removeProofFile(proofFilePath)

      return NextResponse.json(
        {
          error: isMissingJobPaymentsTableError(insertError)
            ? 'Run the latest Supabase migration before using job payments.'
            : insertError?.message || 'Could not save the payment.',
        },
        { status: 400 }
      )
    }

    try {
      const summary = await syncJobFinancialTotals(jobId)

      return NextResponse.json({
        payment: insertedPayment,
        summary,
      })
    } catch (syncError) {
      await supabaseAdmin.from('job_payments').delete().eq('id', insertedPayment.id)
      await removeProofFile(proofFilePath)
      throw syncError
    }
  } catch (error) {
    await removeProofFile(proofFilePath)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not save the payment.',
      },
      { status: 400 }
    )
  }
}
