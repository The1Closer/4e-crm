'use client'

type ExportRow = {
    homeownerName: string
    address: string
    stageName: string
    insuranceCarrier: string
    claimNumber: string
    installDate: string | null
    contractAmount: number | null
    depositCollected: number | null
    remainingBalance: number | null
    repNames: string[]
}

export default function JobsExportTools({
    rows,
}: {
    rows: ExportRow[]
}) {
    function exportCsv() {
        const csvRows = [
            [
                'Homeowner',
                'Address',
                'Stage',
                'Insurance Carrier',
                'Claim Number',
                'Install Date',
                'Contract Amount',
                'Deposit Collected',
                'Remaining Balance',
                'Assigned Team',
            ],
            ...rows.map((row) => [
                row.homeownerName,
                row.address,
                row.stageName,
                row.insuranceCarrier,
                row.claimNumber,
                row.installDate ?? '',
                row.contractAmount ?? '',
                row.depositCollected ?? '',
                row.remainingBalance ?? '',
                row.repNames.join(', '),
            ]),
        ]

        const csv = csvRows
            .map((row) =>
                row
                    .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
                    .join(',')
            )
            .join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'jobs-export.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-wrap gap-3">
            <button
                type="button"
                onClick={exportCsv}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
            >
                Export CSV
            </button>

            <button
                type="button"
                onClick={() => window.print()}
                className="rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#e2bf85]"
            >
                Export PDF
            </button>
        </div>
    )
}
