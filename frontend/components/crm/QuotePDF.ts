/**
 * Generateur PDF pour les devis VoxFlow
 * Utilise jspdf + jspdf-autotable
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface QuoteItem {
  description: string
  qty: number
  unit_price: number
  total: number
}

interface Quote {
  number: string
  created_at: string
  valid_until?: string
  status: string
  items: QuoteItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes?: string
}

export function generateQuotePDF(quote: Quote, orgName: string = 'VoxFlow'): void {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(22)
  doc.setTextColor(123, 97, 255)
  doc.text('VoxFlow', 20, 25)
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  doc.text('Plateforme Call Center Pro', 20, 32)
  doc.text(`Par VNK Automatisation Inc.`, 20, 37)

  // Devis info
  doc.setFontSize(16)
  doc.setTextColor(40, 40, 40)
  doc.text(`Devis ${quote.number}`, 130, 25)
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Date : ${new Date(quote.created_at).toLocaleDateString('fr-CA')}`, 130, 33)
  if (quote.valid_until) {
    doc.text(`Valide jusqu'au : ${quote.valid_until}`, 130, 39)
  }
  doc.text(`Statut : ${quote.status}`, 130, 45)

  // Ligne separatrice
  doc.setDrawColor(123, 97, 255)
  doc.setLineWidth(0.5)
  doc.line(20, 52, 190, 52)

  // Organisation
  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(orgName, 20, 62)

  // Table des items
  autoTable(doc, {
    startY: 70,
    head: [['Description', 'Qte', 'Prix unit.', 'Total']],
    body: quote.items.map(item => [
      item.description,
      String(item.qty),
      `${item.unit_price.toFixed(2)} $`,
      `${item.total.toFixed(2)} $`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [123, 97, 255], fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
  })

  // Totaux
  const finalY = (doc as any).lastAutoTable?.finalY || 120
  const totX = 140

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('Sous-total :', totX, finalY + 10)
  doc.text(`${quote.subtotal.toFixed(2)} $`, 180, finalY + 10, { align: 'right' })

  doc.text(`TPS/TVQ (${quote.tax_rate}%) :`, totX, finalY + 17)
  doc.text(`${quote.tax_amount.toFixed(2)} $`, 180, finalY + 17, { align: 'right' })

  doc.setFontSize(12)
  doc.setTextColor(40, 40, 40)
  doc.text('TOTAL :', totX, finalY + 26)
  doc.setTextColor(123, 97, 255)
  doc.text(`${quote.total.toFixed(2)} CAD`, 180, finalY + 26, { align: 'right' })

  // Notes
  if (quote.notes) {
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text('Notes : ' + quote.notes, 20, finalY + 40, { maxWidth: 170 })
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(180, 180, 180)
  doc.text('VoxFlow par VNK Automatisation Inc. · voxflow.io · facturation@voxflow.io', 105, 285, { align: 'center' })

  // Telecharger
  doc.save(`${quote.number}.pdf`)
}
