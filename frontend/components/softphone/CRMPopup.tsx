"use client"

interface Props {
  contact: {
    id:        string
    firstName: string
    lastName:  string
    company?:  string
    phone?:    string
  }
  onClose: () => void
}

export default function CRMPopup({ contact, onClose }: Props) {
  return (
    <div style={{
      width: "220px", background: "#111827",
      border: "1px solid #1e3a5f", borderRadius: "12px",
      padding: "14px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ color: "#60a5fa", fontSize: "11px", fontWeight: 500 }}>FICHE CLIENT</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "14px" }}>x</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{ width: "38px", height: "38px", background: "#1e3a5f", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>
          {contact.firstName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{ color: "#fff", fontWeight: 600, fontSize: "13px", margin: 0 }}>
            {contact.firstName} {contact.lastName}
          </p>
          {contact.company && <p style={{ color: "#9ca3af", fontSize: "11px", margin: "1px 0 0" }}>{contact.company}</p>}
        </div>
      </div>
      {contact.phone && (
        <div style={{ background: "#1f2937", borderRadius: "6px", padding: "6px 8px", marginBottom: "8px" }}>
          <p style={{ color: "#9ca3af", fontSize: "10px", margin: "0 0 1px" }}>Tel</p>
          <p style={{ color: "#e5e7eb", fontSize: "12px", fontFamily: "monospace", margin: 0 }}>{contact.phone}</p>
        </div>
      )}
      <a href={"/admin/crm"} target="_blank"
        style={{ display: "block", textAlign: "center", background: "#1e3a5f", color: "#60a5fa", padding: "6px", borderRadius: "6px", fontSize: "11px", textDecoration: "none" }}
      >
        Voir fiche complete
      </a>
    </div>
  )
}
