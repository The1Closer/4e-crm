import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
} from '@/lib/job-payments'
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

function normalizePaymentType(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  return PAYMENT_TYPE_OPTIONS.some((option) => option.value === trimmed)
    ? trimmed
    : null
}

function normalizePaymentMethod(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  return PAYMENT_METHOD_OPTIONS.some((option) => option.value === trimmed)
    ? trimmed
    : null
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
      contracts: paymentData.contracts,
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
    const jobContractId = normalizeText(formData.get('jobContractId'))
    const paymentType = normalizePaymentType(formData.get('paymentType'))
    const paymentTypeOtherDetail = normalizeText(formData.get('paymentTypeOtherDetail'))
    const paymentMethod = normalizePaymentMethod(formData.get('paymentMethod'))
    const paymentMethodOtherDetail = normalizeText(
      formData.get('paymentMethodOtherDetail')
    )
    const paymentDate = normalizeDate(formData.get('paymentDate'))
    const checkNumber = normalizeText(formData.get('checkNumber'))
    const note = normalizeText(formData.get('note'))
    const fileEntry = formData.get('file')

    if (!jobContractId) {
      return NextResponse.json(
        { error: 'Contract selection is required.' },
        { status: 400 }
      )
    }

    if (!paymentType) {
      return NextResponse.json({ error: 'Payment type is required.' }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required.' }, { status: 400 })
    }

    if (!paymentDate) {
      return NextResponse.json({ error: 'Payment date is required.' }, { status: 400 })
    }

    if (paymentType === 'other' && !paymentTypeOtherDetail) {
      return NextResponse.json(
        { error: 'Specify what the payment type is when selecting Other.' },
        { status: 400 }
      )
    }

    if (paymentMethod === 'other' && !paymentMethodOtherDetail) {
      return NextResponse.json(
        { error: 'Specify the payment method when selecting Other.' },
        { status: 400 }
      )
    }

    if (paymentMethod === 'check' && !checkNumber) {
      return NextResponse.json(
        { error: 'Check number is required for check payments.' },
        { status: 400 }
      )
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('job_contracts')
      .select('id')
      .eq('id', jobContractId)
      .eq('job_id', jobId)
      .maybeSingle()

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 400 })
    }

    if (!contract) {
      return NextResponse.json(
        { error: 'Selected contract was not found for this job.' },
        { status: 404 }
      )
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
        job_contract_id: jobContractId,
        amount,
        payment_type: paymentType,
        payment_type_other_detail: paymentType === 'other' ? paymentTypeOtherDetail : null,
        payment_method: paymentMethod,
        payment_method_other_detail:
          paymentMethod === 'other' ? paymentMethodOtherDetail : null,
        payment_date: paymentDate,
        check_number: paymentMethod === 'check' ? checkNumber : null,
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
