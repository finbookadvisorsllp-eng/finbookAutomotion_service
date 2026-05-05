const columnGroups = [
  { title: 'Sale', key: 'sale' },
  { title: 'Purchase/Expense', key: 'purchase' },
  { title: 'Bank', key: 'bank' },
]

const groupedColumns = ['Inbox', 'Review', 'Archive', 'Delete', 'Total']

const rows = [
  {
    srNo: 1,
    organization: 'Finolax Advisors',
    companies: 'GRAALIS',
    createdAt: '2024-04-04',
    totalTransactions: 472,
    sale: { inbox: 0, review: 0, archive: 0, delete: 0, total: 471 },
    purchase: { inbox: 0, review: 0, archive: 0, delete: 0, total: 471 },
    bank: { inbox: 0, review: 0, archive: 0, delete: 0, total: 471 },
  },
]

function Cell({ value }) {
  return (
    <td
      className="border-b px-2.5 py-1.5 text-[11px]"
      style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}
    >
      {value}
    </td>
  )
}

function GroupCells({ values }) {
  return groupedColumns.map((label) => (
    <Cell key={label} value={values[label.toLowerCase()]} />
  ))
}

function DashboardTable({ isDark }) {
  return (
    <section
      className="rounded-lg border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
    >
      <div className="themed-scrollbar overflow-x-auto">
        <table className="min-w-[1220px] w-full border-collapse">
          <thead>
            <tr className="text-[#3b475f]" style={{ color: 'var(--app-heading)', backgroundColor: 'var(--app-table-head-bg)' }}>
              <th rowSpan={2} className="border-b border-r px-2.5 py-1.5 text-left text-[10px] font-semibold" style={{ borderColor: 'var(--app-row-border)' }}>
                Sr No.
              </th>
              <th rowSpan={2} className="border-b border-r px-2.5 py-1.5 text-left text-[10px] font-semibold" style={{ borderColor: 'var(--app-row-border)' }}>
                Organization
              </th>
              <th rowSpan={2} className="border-b border-r px-2.5 py-1.5 text-left text-[10px] font-semibold" style={{ borderColor: 'var(--app-row-border)' }}>
                Companies
              </th>
              <th rowSpan={2} className="border-b border-r px-2.5 py-1.5 text-left text-[10px] font-semibold" style={{ borderColor: 'var(--app-row-border)' }}>
                Created At
              </th>
              <th rowSpan={2} className="border-b border-r px-2.5 py-1.5 text-left text-[10px] font-semibold" style={{ borderColor: 'var(--app-row-border)' }}>
                Total Transactions
              </th>
              {columnGroups.map((group) => (
                <th
                  key={group.key}
                  colSpan={5}
                  className="border-b border-r px-2.5 py-1.5 text-center text-[10px] font-semibold"
                  style={{ borderColor: 'var(--app-row-border)' }}
                >
                  {group.title}
                </th>
              ))}
            </tr>

            <tr className="text-[#69748a]" style={{ color: 'var(--app-text)', backgroundColor: 'var(--app-table-head-bg)' }}>
              {columnGroups.map((group) =>
                groupedColumns.map((item, idx) => (
                  <th
                    key={`${group.key}-${item}`}
                    className={`border-b px-2 py-1 text-center text-[9px] font-medium uppercase tracking-wide ${
                      idx === 4 ? 'border-r' : ''
                    }`}
                    style={{ borderColor: 'var(--app-row-border)' }}
                  >
                    {item}
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.srNo}
                className="transition"
                style={{ backgroundColor: isDark ? 'transparent' : 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--app-row-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Cell value={row.srNo} />
                <Cell value={row.organization} />
                <Cell value={row.companies} />
                <Cell value={row.createdAt} />
                <Cell value={row.totalTransactions} />
                <GroupCells values={row.sale} />
                <GroupCells values={row.purchase} />
                <GroupCells values={row.bank} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end border-t px-4 py-1.5" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2 text-[11px] text-[#5c667d]">
          <span style={{ color: 'var(--app-text)' }}>1-10 of 1</span>
          <select
            className="rounded-md border px-2 py-1 text-xs outline-none"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-heading)',
              backgroundColor: 'var(--app-control-bg)',
            }}
            defaultValue="10"
            aria-label="Rows per page"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>
    </section>
  )
}

export default DashboardTable
