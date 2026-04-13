'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { PromptModal, ConfirmModal } from '@/components/shared/VFModal'
import dynamic from 'next/dynamic'
const CRMCalendar = dynamic(() => import('@/components/crm/Calendar'), { ssr: false })
import { generateQuotePDF } from '@/components/crm/QuotePDF'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(API() + path, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...(opts.headers || {}) }, body: opts.body,
    }); return r.json()
}

const fmtD = (dt: string) => {
    if (!dt) return '—'
    const d = new Date(dt), df = (Date.now() - d.getTime()) / 1000
    if (df < 60) return "A l'instant"
    if (df < 3600) return `${Math.floor(df / 60)}min`
    if (df < 86400) return `${Math.floor(df / 3600)}h`
    if (df < 86400 * 30) return `${Math.floor(df / 86400)}j`
    return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' })
}
const contactName = (c: { first_name: string; last_name: string; phone?: string }) => {
    const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
    return n || fmtPh(c.phone || '') || '—'
}
const contactIni = (c: { first_name: string; last_name: string; phone?: string }) => {
    if (c.first_name) return ini(`${c.first_name} ${c.last_name}`)
    return (c.last_name?.[0] || c.phone?.[0] || '?').toUpperCase()
}
const fmtPh = (p: string) => p?.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') || p || '—'
const ini = (n: string) => (n || '?').split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase()
const ACP = ['#2d1a80', '#1a356b', '#1a4d3a', '#4d1a5a', '#4d2a1a', '#1a4d4d', '#4d1a1a']

interface Contact {
    id: string; first_name: string; last_name: string; email?: string; phone?: string
    company?: string; position?: string; status?: string; tags?: Tag[]; notes?: string
    address?: string; city?: string; province?: string; postal_code?: string; country?: string
    created_at: string; last_called_at?: string; call_count?: number
}
interface Tag { id: string; name: string; color: string }


// ── Données géographiques complètes ─────────────────────────
const COUNTRIES = [
    { code: "CA", name: "Canada" },
    { code: "US", name: "États-Unis" },
    { code: "MX", name: "Mexique" },
    { code: "FR", name: "France" },
    { code: "BE", name: "Belgique" },
    { code: "CH", name: "Suisse" },
    { code: "LU", name: "Luxembourg" },
    { code: "DE", name: "Allemagne" },
    { code: "GB", name: "Royaume-Uni" },
    { code: "ES", name: "Espagne" },
    { code: "IT", name: "Italie" },
    { code: "PT", name: "Portugal" },
    { code: "NL", name: "Pays-Bas" },
    { code: "AT", name: "Autriche" },
    { code: "IE", name: "Irlande" },
    { code: "PL", name: "Pologne" },
    { code: "SE", name: "Suède" },
    { code: "NO", name: "Norvège" },
    { code: "DK", name: "Danemark" },
    { code: "FI", name: "Finlande" },
    { code: "RO", name: "Roumanie" },
    { code: "HU", name: "Hongrie" },
    { code: "CZ", name: "Tchéquie" },
    { code: "SK", name: "Slovaquie" },
    { code: "HR", name: "Croatie" },
    { code: "GR", name: "Grèce" },
    { code: "MA", name: "Maroc" },
    { code: "DZ", name: "Algérie" },
    { code: "TN", name: "Tunisie" },
    { code: "SN", name: "Sénégal" },
    { code: "CI", name: "Côte d'Ivoire" },
    { code: "OTHER", name: "Autre" },
]

const PROVINCES: Record<string, { code: string; name: string }[]> = {
    CA: [
        { code: "AB", name: "Alberta" },
        { code: "BC", name: "Colombie-Britannique" },
        { code: "MB", name: "Manitoba" },
        { code: "NB", name: "Nouveau-Brunswick" },
        { code: "NL", name: "Terre-Neuve" },
        { code: "NS", name: "Nouvelle-Écosse" },
        { code: "NT", name: "Territoires du Nord-Ouest" },
        { code: "NU", name: "Nunavut" },
        { code: "ON", name: "Ontario" },
        { code: "PE", name: "Île-du-Prince-Édouard" },
        { code: "QC", name: "Québec" },
        { code: "SK", name: "Saskatchewan" },
        { code: "YT", name: "Yukon" },
    ],
    US: [
        { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
        { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
        { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
        { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
        { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
        { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
        { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
        { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
        { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
        { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
        { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
        { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
        { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
        { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
        { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
        { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
        { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "Washington DC" },
    ],
    MX: [
        { code: "AGU", name: "Aguascalientes" }, { code: "BCN", name: "Baja California" },
        { code: "BCS", name: "Baja California Sur" }, { code: "CAM", name: "Campeche" },
        { code: "CHP", name: "Chiapas" }, { code: "CHH", name: "Chihuahua" },
        { code: "COA", name: "Coahuila" }, { code: "COL", name: "Colima" },
        { code: "DUR", name: "Durango" }, { code: "GUA", name: "Guanajuato" },
        { code: "GRO", name: "Guerrero" }, { code: "HID", name: "Hidalgo" },
        { code: "JAL", name: "Jalisco" }, { code: "MEX", name: "México" },
        { code: "MIC", name: "Michoacán" }, { code: "MOR", name: "Morelos" },
        { code: "NAY", name: "Nayarit" }, { code: "NLE", name: "Nuevo León" },
        { code: "OAX", name: "Oaxaca" }, { code: "PUE", name: "Puebla" },
        { code: "QUE", name: "Querétaro" }, { code: "ROO", name: "Quintana Roo" },
        { code: "SLP", name: "San Luis Potosí" }, { code: "SIN", name: "Sinaloa" },
        { code: "SON", name: "Sonora" }, { code: "TAB", name: "Tabasco" },
        { code: "TAM", name: "Tamaulipas" }, { code: "TLA", name: "Tlaxcala" },
        { code: "VER", name: "Veracruz" }, { code: "YUC", name: "Yucatán" },
        { code: "ZAC", name: "Zacatecas" }, { code: "CMX", name: "Ciudad de México" },
    ],
    FR: [
        { code: "ARA", name: "Auvergne-Rhône-Alpes" }, { code: "BFC", name: "Bourgogne-Franche-Comté" },
        { code: "BRE", name: "Bretagne" }, { code: "CVL", name: "Centre-Val de Loire" },
        { code: "COR", name: "Corse" }, { code: "GES", name: "Grand Est" },
        { code: "HDF", name: "Hauts-de-France" }, { code: "IDF", name: "Île-de-France" },
        { code: "NOR", name: "Normandie" }, { code: "NAQ", name: "Nouvelle-Aquitaine" },
        { code: "OCC", name: "Occitanie" }, { code: "PDL", name: "Pays de la Loire" },
        { code: "PAC", name: "Provence-Alpes-Côte d'Azur" },
    ],
    BE: [
        { code: "BRU", name: "Bruxelles" }, { code: "VLG", name: "Flandre" },
        { code: "WAL", name: "Wallonie" },
    ],
    CH: [
        { code: "ZH", name: "Zurich" }, { code: "BE", name: "Berne" }, { code: "VD", name: "Vaud" },
        { code: "GE", name: "Genève" }, { code: "BS", name: "Bâle-Ville" }, { code: "AG", name: "Argovie" },
        { code: "TI", name: "Tessin" }, { code: "VS", name: "Valais" },
    ],
    GB: [
        { code: "ENG", name: "Angleterre" }, { code: "SCT", name: "Écosse" },
        { code: "WLS", name: "Pays de Galles" }, { code: "NIR", name: "Irlande du Nord" },
    ],
    DE: [
        { code: "BB", name: "Brandebourg" }, { code: "BE", name: "Berlin" }, { code: "BW", name: "Bade-Wurtemberg" },
        { code: "BY", name: "Bavière" }, { code: "HB", name: "Brême" }, { code: "HE", name: "Hesse" },
        { code: "HH", name: "Hambourg" }, { code: "MV", name: "Mecklembourg" }, { code: "NI", name: "Basse-Saxe" },
        { code: "NW", name: "Rhénanie-du-Nord" }, { code: "RP", name: "Rhénanie-Palatinat" },
        { code: "SH", name: "Schleswig-Holstein" }, { code: "SL", name: "Sarre" },
        { code: "SN", name: "Saxe" }, { code: "ST", name: "Saxe-Anhalt" }, { code: "TH", name: "Thuringe" },
    ],
}

// ── Détection par indicatif pays + région ──────────────────
const COUNTRY_CODES: Record<string, { country: string; countryCode: string }> = {
    "1": { country: "Canada/États-Unis", countryCode: "CA" },
    "33": { country: "France", countryCode: "FR" },
    "44": { country: "Royaume-Uni", countryCode: "GB" },
    "32": { country: "Belgique", countryCode: "BE" },
    "41": { country: "Suisse", countryCode: "CH" },
    "352": { country: "Luxembourg", countryCode: "LU" },
    "49": { country: "Allemagne", countryCode: "DE" },
    "34": { country: "Espagne", countryCode: "ES" },
    "39": { country: "Italie", countryCode: "IT" },
    "351": { country: "Portugal", countryCode: "PT" },
    "31": { country: "Pays-Bas", countryCode: "NL" },
    "43": { country: "Autriche", countryCode: "AT" },
    "353": { country: "Irlande", countryCode: "IE" },
    "48": { country: "Pologne", countryCode: "PL" },
    "46": { country: "Suède", countryCode: "SE" },
    "47": { country: "Norvège", countryCode: "NO" },
    "45": { country: "Danemark", countryCode: "DK" },
    "358": { country: "Finlande", countryCode: "FI" },
    "40": { country: "Roumanie", countryCode: "RO" },
    "36": { country: "Hongrie", countryCode: "HU" },
    "420": { country: "Tchéquie", countryCode: "CZ" },
    "421": { country: "Slovaquie", countryCode: "SK" },
    "385": { country: "Croatie", countryCode: "HR" },
    "30": { country: "Grèce", countryCode: "GR" },
    "52": { country: "Mexique", countryCode: "MX" },
    "212": { country: "Maroc", countryCode: "MA" },
    "213": { country: "Algérie", countryCode: "DZ" },
    "216": { country: "Tunisie", countryCode: "TN" },
    "221": { country: "Sénégal", countryCode: "SN" },
    "225": { country: "Côte d'Ivoire", countryCode: "CI" },
    "237": { country: "Cameroun", countryCode: "CM" },
    "243": { country: "RD Congo", countryCode: "CD" },
    "234": { country: "Nigeria", countryCode: "NG" },
    "254": { country: "Kenya", countryCode: "KE" },
    "27": { country: "Afrique du Sud", countryCode: "ZA" },
    "55": { country: "Brésil", countryCode: "BR" },
    "54": { country: "Argentine", countryCode: "AR" },
    "56": { country: "Chili", countryCode: "CL" },
    "57": { country: "Colombie", countryCode: "CO" },
    "51": { country: "Pérou", countryCode: "PE" },
    "58": { country: "Venezuela", countryCode: "VE" },
    "81": { country: "Japon", countryCode: "JP" },
    "82": { country: "Corée du Sud", countryCode: "KR" },
    "86": { country: "Chine", countryCode: "CN" },
    "91": { country: "Inde", countryCode: "IN" },
    "61": { country: "Australie", countryCode: "AU" },
    "64": { country: "Nouvelle-Zélande", countryCode: "NZ" },
    "7": { country: "Russie", countryCode: "RU" },
    "380": { country: "Ukraine", countryCode: "UA" },
    "971": { country: "Émirats arabes", countryCode: "AE" },
    "966": { country: "Arabie Saoudite", countryCode: "SA" },
    "972": { country: "Israël", countryCode: "IL" },
    "90": { country: "Turquie", countryCode: "TR" },
}

// Indicatifs régionaux Amérique du Nord (après le +1)
const NA_REGIONS: Record<string, { city: string; province: string; countryCode: string }> = {
    // Québec
    "514": { city: "Montréal", province: "QC", countryCode: "CA" },
    "438": { city: "Montréal", province: "QC", countryCode: "CA" },
    "450": { city: "Rive-Sud MTL", province: "QC", countryCode: "CA" },
    "579": { city: "Rive-Sud MTL", province: "QC", countryCode: "CA" },
    "418": { city: "Québec", province: "QC", countryCode: "CA" },
    "581": { city: "Québec", province: "QC", countryCode: "CA" },
    "819": { city: "Outaouais", province: "QC", countryCode: "CA" },
    "873": { city: "Outaouais", province: "QC", countryCode: "CA" },
    "367": { city: "Québec", province: "QC", countryCode: "CA" },
    // Ontario
    "416": { city: "Toronto", province: "ON", countryCode: "CA" },
    "647": { city: "Toronto", province: "ON", countryCode: "CA" },
    "437": { city: "Toronto", province: "ON", countryCode: "CA" },
    "905": { city: "Grand Toronto", province: "ON", countryCode: "CA" },
    "289": { city: "Grand Toronto", province: "ON", countryCode: "CA" },
    "365": { city: "Grand Toronto", province: "ON", countryCode: "CA" },
    "613": { city: "Ottawa", province: "ON", countryCode: "CA" },
    "343": { city: "Ottawa", province: "ON", countryCode: "CA" },
    "519": { city: "Windsor", province: "ON", countryCode: "CA" },
    "226": { city: "London", province: "ON", countryCode: "CA" },
    "548": { city: "Kitchener", province: "ON", countryCode: "CA" },
    "705": { city: "Sudbury", province: "ON", countryCode: "CA" },
    "249": { city: "Sudbury", province: "ON", countryCode: "CA" },
    "807": { city: "Thunder Bay", province: "ON", countryCode: "CA" },
    // BC
    "604": { city: "Vancouver", province: "BC", countryCode: "CA" },
    "778": { city: "Vancouver", province: "BC", countryCode: "CA" },
    "236": { city: "Vancouver", province: "BC", countryCode: "CA" },
    "250": { city: "C.-Brit.", province: "BC", countryCode: "CA" },
    "672": { city: "C.-Brit.", province: "BC", countryCode: "CA" },
    // Alberta
    "403": { city: "Calgary", province: "AB", countryCode: "CA" },
    "587": { city: "Alberta", province: "AB", countryCode: "CA" },
    "780": { city: "Edmonton", province: "AB", countryCode: "CA" },
    "825": { city: "Alberta", province: "AB", countryCode: "CA" },
    // Autres Canada
    "902": { city: "Maritimes", province: "NS", countryCode: "CA" },
    "782": { city: "Maritimes", province: "NS", countryCode: "CA" },
    "506": { city: "N.-Brunswick", province: "NB", countryCode: "CA" },
    "204": { city: "Winnipeg", province: "MB", countryCode: "CA" },
    "431": { city: "Manitoba", province: "MB", countryCode: "CA" },
    "306": { city: "Saskatchewan", province: "SK", countryCode: "CA" },
    "639": { city: "Saskatchewan", province: "SK", countryCode: "CA" },
    "709": { city: "Terre-Neuve", province: "NL", countryCode: "CA" },
    "867": { city: "Territoires", province: "YT", countryCode: "CA" },
    // New York
    "212": { city: "New York", province: "NY", countryCode: "US" },
    "917": { city: "New York", province: "NY", countryCode: "US" },
    "646": { city: "New York", province: "NY", countryCode: "US" },
    "332": { city: "New York", province: "NY", countryCode: "US" },
    "718": { city: "Brooklyn", province: "NY", countryCode: "US" },
    "347": { city: "New York", province: "NY", countryCode: "US" },
    // California
    "213": { city: "Los Angeles", province: "CA", countryCode: "US" },
    "323": { city: "Los Angeles", province: "CA", countryCode: "US" },
    "818": { city: "Los Angeles", province: "CA", countryCode: "US" },
    "310": { city: "Santa Monica", province: "CA", countryCode: "US" },
    "415": { city: "San Francisco", province: "CA", countryCode: "US" },
    "628": { city: "San Francisco", province: "CA", countryCode: "US" },
    "408": { city: "San Jose", province: "CA", countryCode: "US" },
    "669": { city: "San Jose", province: "CA", countryCode: "US" },
    "619": { city: "San Diego", province: "CA", countryCode: "US" },
    "858": { city: "San Diego", province: "CA", countryCode: "US" },
    "916": { city: "Sacramento", province: "CA", countryCode: "US" },
    // Illinois
    "312": { city: "Chicago", province: "IL", countryCode: "US" },
    "773": { city: "Chicago", province: "IL", countryCode: "US" },
    "872": { city: "Chicago", province: "IL", countryCode: "US" },
    // Massachusetts
    "617": { city: "Boston", province: "MA", countryCode: "US" },
    "857": { city: "Boston", province: "MA", countryCode: "US" },
    // Florida
    "305": { city: "Miami", province: "FL", countryCode: "US" },
    "786": { city: "Miami", province: "FL", countryCode: "US" },
    "954": { city: "Fort Lauderdale", province: "FL", countryCode: "US" },
    "407": { city: "Orlando", province: "FL", countryCode: "US" },
    "813": { city: "Tampa", province: "FL", countryCode: "US" },
    "904": { city: "Jacksonville", province: "FL", countryCode: "US" },
    // Washington State
    "206": { city: "Seattle", province: "WA", countryCode: "US" },
    "425": { city: "Seattle", province: "WA", countryCode: "US" },
    "253": { city: "Tacoma", province: "WA", countryCode: "US" },
    // Texas
    "713": { city: "Houston", province: "TX", countryCode: "US" },
    "832": { city: "Houston", province: "TX", countryCode: "US" },
    "281": { city: "Houston", province: "TX", countryCode: "US" },
    "214": { city: "Dallas", province: "TX", countryCode: "US" },
    "469": { city: "Dallas", province: "TX", countryCode: "US" },
    "972": { city: "Dallas", province: "TX", countryCode: "US" },
    "512": { city: "Austin", province: "TX", countryCode: "US" },
    "737": { city: "Austin", province: "TX", countryCode: "US" },
    "210": { city: "San Antonio", province: "TX", countryCode: "US" },
    // Georgia
    "404": { city: "Atlanta", province: "GA", countryCode: "US" },
    "678": { city: "Atlanta", province: "GA", countryCode: "US" },
    "770": { city: "Atlanta", province: "GA", countryCode: "US" },
    // DC/MD/VA
    "202": { city: "Washington DC", province: "DC", countryCode: "US" },
    "301": { city: "Maryland", province: "MD", countryCode: "US" },
    "703": { city: "Virginia", province: "VA", countryCode: "US" },
    "571": { city: "Virginia", province: "VA", countryCode: "US" },
    // Nevada
    "702": { city: "Las Vegas", province: "NV", countryCode: "US" },
    "725": { city: "Las Vegas", province: "NV", countryCode: "US" },
    // Arizona
    "602": { city: "Phoenix", province: "AZ", countryCode: "US" },
    "480": { city: "Scottsdale", province: "AZ", countryCode: "US" },
    "623": { city: "Glendale", province: "AZ", countryCode: "US" },
    // Colorado
    "303": { city: "Denver", province: "CO", countryCode: "US" },
    "720": { city: "Denver", province: "CO", countryCode: "US" },
    // Pennsylvania
    "215": { city: "Philadelphia", province: "PA", countryCode: "US" },
    "267": { city: "Philadelphia", province: "PA", countryCode: "US" },
    "412": { city: "Pittsburgh", province: "PA", countryCode: "US" },
    // Ohio
    "216": { city: "Cleveland", province: "OH", countryCode: "US" },
    "614": { city: "Columbus", province: "OH", countryCode: "US" },
    "513": { city: "Cincinnati", province: "OH", countryCode: "US" },
    // Michigan
    "313": { city: "Detroit", province: "MI", countryCode: "US" },
    "248": { city: "Detroit", province: "MI", countryCode: "US" },
    // Minnesota
    "612": { city: "Minneapolis", province: "MN", countryCode: "US" },
    "651": { city: "Saint Paul", province: "MN", countryCode: "US" },
    // Oregon
    "503": { city: "Portland", province: "OR", countryCode: "US" },
    "971": { city: "Portland", province: "OR", countryCode: "US" },
    // Autres US
    "401": { city: "Providence", province: "RI", countryCode: "US" },
    "860": { city: "Hartford", province: "CT", countryCode: "US" },
    "704": { city: "Charlotte", province: "NC", countryCode: "US" },
    "919": { city: "Raleigh", province: "NC", countryCode: "US" },
    "615": { city: "Nashville", province: "TN", countryCode: "US" },
    "901": { city: "Memphis", province: "TN", countryCode: "US" },
    "502": { city: "Louisville", province: "KY", countryCode: "US" },
    "317": { city: "Indianapolis", province: "IN", countryCode: "US" },
    "414": { city: "Milwaukee", province: "WI", countryCode: "US" },
    "608": { city: "Madison", province: "WI", countryCode: "US" },
    "816": { city: "Kansas City", province: "MO", countryCode: "US" },
    "314": { city: "St. Louis", province: "MO", countryCode: "US" },
    "504": { city: "La Nouvelle-Orléans", province: "LA", countryCode: "US" },
    "205": { city: "Birmingham", province: "AL", countryCode: "US" },
    "801": { city: "Salt Lake City", province: "UT", countryCode: "US" },
    "808": { city: "Honolulu", province: "HI", countryCode: "US" },
    "907": { city: "Anchorage", province: "AK", countryCode: "US" },
    "843": { city: "Charleston", province: "SC", countryCode: "US" },
}

// Villes principales par pays européen (indicatif après le pays)
const EU_CITIES: Record<string, Record<string, { city: string; province: string }>> = {
    "33": { // France
        "1": { city: "Paris", province: "IDF" },
        "2": { city: "Nord-Ouest", province: "NOR" },
        "3": { city: "Nord-Est", province: "GES" },
        "4": { city: "Sud-Est", province: "PAC" },
        "5": { city: "Sud-Ouest", province: "NAQ" },
        "6": { city: "Mobile", province: "IDF" },
        "7": { city: "Mobile", province: "IDF" },
        "8": { city: "Numéro spécial", province: "IDF" },
        "9": { city: "Fixe IP", province: "IDF" },
    },
    "44": { // UK
        "20": { city: "Londres", province: "ENG" },
        "121": { city: "Birmingham", province: "ENG" },
        "131": { city: "Édimbourg", province: "SCT" },
        "141": { city: "Glasgow", province: "SCT" },
        "161": { city: "Manchester", province: "ENG" },
        "113": { city: "Leeds", province: "ENG" },
        "117": { city: "Bristol", province: "ENG" },
        "29": { city: "Cardiff", province: "WLS" },
        "28": { city: "Belfast", province: "NIR" },
    },
    "49": { // Allemagne
        "30": { city: "Berlin", province: "BE" },
        "89": { city: "Munich", province: "BY" },
        "40": { city: "Hambourg", province: "HH" },
        "221": { city: "Cologne", province: "NW" },
        "69": { city: "Francfort", province: "HE" },
        "711": { city: "Stuttgart", province: "BW" },
        "211": { city: "Düsseldorf", province: "NW" },
    },
    "41": { // Suisse
        "22": { city: "Genève", province: "GE" },
        "21": { city: "Lausanne", province: "VD" },
        "44": { city: "Zurich", province: "ZH" },
        "31": { city: "Berne", province: "BE" },
        "61": { city: "Bâle", province: "BS" },
        "91": { city: "Lugano", province: "TI" },
        "27": { city: "Valais", province: "VS" },
    },
    "32": { // Belgique
        "2": { city: "Bruxelles", province: "BRU" },
        "4": { city: "Liège", province: "WAL" },
        "3": { city: "Anvers", province: "VLG" },
        "9": { city: "Gand", province: "VLG" },
    },
    "34": { // Espagne
        "91": { city: "Madrid", province: "MAD" },
        "93": { city: "Barcelone", province: "CAT" },
        "95": { city: "Séville", province: "AND" },
        "96": { city: "Valence", province: "VAL" },
    },
    "39": { // Italie
        "06": { city: "Rome", province: "LAZ" },
        "02": { city: "Milan", province: "LOM" },
        "011": { city: "Turin", province: "PIE" },
        "081": { city: "Naples", province: "CAM" },
        "055": { city: "Florence", province: "TOS" },
    },
    "52": { // Mexique
        "55": { city: "Mexico", province: "CMX" },
        "33": { city: "Guadalajara", province: "JAL" },
        "81": { city: "Monterrey", province: "NLE" },
        "222": { city: "Puebla", province: "PUE" },
        "998": { city: "Cancún", province: "ROO" },
    },
}

function getPhoneRegion(phone: string): { city?: string; province?: string; country?: string; countryCode?: string } | null {
    if (!phone) return null
    const d = phone.replace(/\D/g, "")
    if (d.length < 7) return null

    // ── Amérique du Nord (+1) ──────────────────────────────────
    // Format: +1AAANXXXXXXX ou 1AAANXXXXXXX ou AAANXXXXXXX
    let naDigits = ""
    if (d.startsWith("1") && d.length >= 11) naDigits = d.substring(1)
    else if (d.length === 10) naDigits = d

    if (naDigits.length >= 10) {
        const area = naDigits.substring(0, 3)
        const reg = NA_REGIONS[area]
        if (reg) {
            const countryName = reg.countryCode === "CA" ? "Canada" : "États-Unis"
            return { city: reg.city, province: reg.province, country: countryName, countryCode: reg.countryCode }
        }
        // Indicatif +1 non reconnu = Canada par défaut
        return { country: "Canada", countryCode: "CA" }
    }

    // ── International ─────────────────────────────────────────
    // Essayer indicatifs pays de 3, 2, 1 chiffres
    for (const [cc, info] of Object.entries(COUNTRY_CODES).sort((a, b) => b[0].length - a[0].length)) {
        if (d.startsWith(cc)) {
            const afterCC = d.substring(cc.length)
            // Chercher ville dans EU_CITIES si dispo
            const cityMap = EU_CITIES[cc]
            if (cityMap) {
                for (const [prefix, cityInfo] of Object.entries(cityMap).sort((a, b) => b[0].length - a[0].length)) {
                    if (afterCC.startsWith(prefix)) {
                        return { city: cityInfo.city, province: cityInfo.province, country: info.country, countryCode: info.countryCode }
                    }
                }
            }
            return { country: info.country, countryCode: info.countryCode }
        }
    }

    return null
}

const PIPELINE_COLS = [
    { id: 'lead', label: 'Lead', color: '#55557a', bg: '#1f1f2a' },
    { id: 'contacted', label: 'Contacté', color: '#38b6ff', bg: '#0d2233' },
    { id: 'qualified', label: 'Qualifié', color: '#7b61ff', bg: '#1a1433' },
    { id: 'proposal', label: 'Proposition', color: '#ffb547', bg: '#2a1f0a' },
    { id: 'won', label: 'Gagné', color: '#00d4aa', bg: '#0a2420' },
    { id: 'lost', label: 'Perdu', color: '#ff4d6d', bg: '#2a0d12' },
]

const EMPTY_CONTACT = { first_name: '', last_name: '', email: '', phone: '', company: '', position: '', address: '', city: '', province: '', postal_code: '', country: 'Canada', notes: '', custom_fields: {} as Record<string, string> }

export default function CRMPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [tags, setTags] = useState<Tag[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'list' | 'pipeline' | 'calendar' | 'quotes' | 'templates'>('list')
    const [appointments, setAppointments] = useState<any[]>([])
    const [quotes, setQuotes] = useState<any[]>([])
    const [templates, setTemplates] = useState<any[]>([])
    const [loadingCal, setLoadingCal] = useState(false)
    const [search, setSearch] = useState('')
    const [tagFilter, setTagFilter] = useState('')
    const [selContact, setSelContact] = useState<Contact | null>(null)
    const [modal, setModal] = useState<'add' | 'edit' | null>(null)
    const [form, setForm] = useState<typeof EMPTY_CONTACT>(EMPTY_CONTACT)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [history, setHistory] = useState<any[]>([])
    const [importing, setImporting] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

    const load = useCallback(async () => {
        try {
            const [cr, tr] = await Promise.all([
                apiFetch('/api/v1/crm/contacts?limit=200'),
                apiFetch('/api/v1/crm/tags'),
            ])
            if (cr.success) setContacts(Array.isArray(cr.data) ? cr.data : [])
            if (tr.success) setTags(Array.isArray(tr.data) ? tr.data : [])
        } catch { }
        setLoading(false)
    }, [])

    const callBack = async (phone: string) => {
        if (!phone) return
        // 1. Envoyer au dialer Electron via port 9876
        try {
            const r = await fetch('http://127.0.0.1:9876/dial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            })
            if (r.ok) return
        } catch { }
        // 2. Fallback protocole voxflow://
        try {
            window.location.href = `voxflow://dial/${encodeURIComponent(phone)}`
        } catch { }
    }

    const loadHistory = async (contactId: string) => {
        try {
            const r = await apiFetch(`/api/v1/crm/contacts/${contactId}/calls`)
            if (r.success) setHistory(Array.isArray(r.data) ? r.data : [])
        } catch { setHistory([]) }
    }

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const openDetail = (c: Contact) => { setSelContact(c); loadHistory(c.id) }

    // ── Loaders calendrier / devis / templates ──────────────
    const loadCalendar = async () => {
        setLoadingCal(true)
        try {
            const r = await apiFetch('/api/v1/crm/appointments')
            if (r.success) setAppointments(r.data || [])
        } catch {} finally { setLoadingCal(false) }
    }
    const loadQuotes = async () => {
        try {
            const r = await apiFetch('/api/v1/crm/quotes')
            if (r.success) setQuotes(r.data || [])
        } catch {}
    }
    const loadTemplates = async () => {
        try {
            const r = await apiFetch('/api/v1/crm/email-templates')
            if (r.success) setTemplates(r.data || [])
        } catch {}
    }
    const createAppointment = async (apt: any) => {
        const r = await apiFetch('/api/v1/crm/appointments', { method: 'POST', body: JSON.stringify(apt) })
        if (r.success) loadCalendar()
        return r
    }
    const createQuote = async (q: any) => {
        const r = await apiFetch('/api/v1/crm/quotes', { method: 'POST', body: JSON.stringify(q) })
        if (r.success) loadQuotes()
        return r
    }

    const saveContact = async () => {
        setSaving(true)
        try {
            const r = modal === 'add'
                ? await apiFetch('/api/v1/crm/contacts', { method: 'POST', body: JSON.stringify(form) })
                : await apiFetch(`/api/v1/crm/contacts/${selContact?.id}`, { method: 'PATCH', body: JSON.stringify(form) })
            if (r.success) { showToast(modal === 'add' ? 'Contact ajouté' : 'Contact mis à jour'); load(); setModal(null) }
            else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [showNewAppt, setShowNewAppt] = useState(false)
    const [showNewTpl, setShowNewTpl] = useState(false)
    const [showNewField, setShowNewField] = useState(false)
    const [showQuoteModal, setShowQuoteModal] = useState(false)
    const [showQuotePreview, setShowQuotePreview] = useState<any>(null)
    const [showTplEditor, setShowTplEditor] = useState<any>(null)
    const [quoteItems, setQuoteItems] = useState<{ description: string; qty: number; unit_price: number }[]>([{ description: '', qty: 1, unit_price: 0 }])
    const [quoteContact, setQuoteContact] = useState('')
    const [quoteNotes, setQuoteNotes] = useState('')
    const [apptContact, setApptContact] = useState('')
    const [apptData, setApptData] = useState<any>(null)
    const [agents, setAgents] = useState<any[]>([])

    // Charger agents pour select
    useEffect(() => {
        if (!isAuth) return
        apiFetch('/api/v1/admin/agents').then(r => {
            if (r.success || r.data) setAgents(Array.isArray(r.data) ? r.data : [])
        }).catch(() => {})
    }, [isAuth])

    const deleteContact = async (id: string) => {
        try {
            const r = await apiFetch(`/api/v1/crm/contacts/${id}`, { method: 'DELETE' })
            if (r.success) { showToast('Contact supprimé'); setSelContact(null); load() }
            else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        setImporting(true)
        const text = await file.text()
        const lines = text.split('\n').filter(Boolean)
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
        let imported = 0
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
            const obj: any = {}
            headers.forEach((h, j) => { obj[h] = vals[j] || '' })
            try {
                const r = await apiFetch('/api/v1/crm/contacts', {
                    method: 'POST', body: JSON.stringify({
                        first_name: obj.first_name || obj.prenom || obj.firstname || '',
                        last_name: obj.last_name || obj.nom || obj.lastname || '',
                        email: obj.email || '',
                        phone: obj.phone || obj.telephone || obj.tel || '',
                        company: obj.company || obj.entreprise || '',
                    })
                })
                if (r.success) imported++
            } catch { }
        }
        setImporting(false)
        showToast(`${imported} contacts importés`)
        load()
        if (fileRef.current) fileRef.current.value = ''
    }

    // Filtres
    const filtered = contacts.filter(c => {
        const name = `${c.first_name} ${c.last_name} ${c.company || ''} ${c.phone || ''} ${c.email || ''}`.toLowerCase()
        const matchSearch = !search || name.includes(search.toLowerCase())
        const matchTag = !tagFilter || c.tags?.some(t => t.id === tagFilter)
        return matchSearch && matchTag
    })

    // Pipeline : grouper par status
    const byStatus = (status: string) => filtered.filter(c => (c.status || 'lead') === status)

    const stats = {
        total: contacts.length,
        withPhone: contacts.filter(c => c.phone).length,
        withEmail: contacts.filter(c => c.email).length,
        called: contacts.filter(c => c.call_count && c.call_count > 0).length,
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement CRM...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-full mx-auto">
            <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={importCSV} />

            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-sm font-bold shadow-xl ${toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">CRM</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{stats.total} contact{stats.total > 1 ? 's' : ''}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Vue toggle */}
                    <div className="flex bg-[#18181f] border border-[#2e2e44] rounded-lg p-1">
                        <button onClick={() => setView('list')}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                            Liste
                        </button>
                        <button onClick={() => setView('pipeline')}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${view === 'pipeline' ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="5" height="8" rx="1" /></svg>
                            Pipeline
                        </button>
                        <button onClick={() => { setView('calendar'); if (!appointments.length) loadCalendar() }}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${view === 'calendar' ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            Calendrier
                        </button>
                        <button onClick={() => { setView('quotes'); if (!quotes.length) loadQuotes() }}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${view === 'quotes' ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            Devis
                        </button>
                        <button onClick={() => { setView('templates'); if (!templates.length) loadTemplates() }}
                            className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${view === 'templates' ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22 6 12 13 2 6" /></svg>
                            Templates
                        </button>
                    </div>
                    {/* Campagne Robot Dialer */}
                    <button onClick={async () => {
                        const selected = filtered.filter(c => c.phone)
                        if (!selected.length) { showToast('Aucun contact avec telephone', 'err'); return }
                        try {
                            const r = await apiFetch('/api/v1/ai2/campaigns', {
                                method: 'POST',
                                body: JSON.stringify({
                                    name: `Campagne CRM — ${new Date().toLocaleDateString('fr-CA')}`,
                                    leads: selected.map(c => ({ phone: c.phone, first_name: c.first_name, last_name: c.last_name, contact_id: c.id })),
                                })
                            })
                            if (r.success) showToast(`Campagne creee avec ${selected.length} contacts`)
                            else showToast(r.error || 'Erreur', 'err')
                        } catch { showToast('Erreur reseau', 'err') }
                    }}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-3 py-2 rounded-lg hover:bg-amber-400/20 transition-colors">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        Robot Dialer ({filtered.filter(c => c.phone).length})
                    </button>
                    {/* Import CSV */}
                    <button onClick={() => fileRef.current?.click()} disabled={importing}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#18181f] px-3 py-2 rounded-lg hover:text-[#eeeef8] transition-colors disabled:opacity-50">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        {importing ? 'Import...' : 'Import CSV'}
                    </button>
                    {/* Nouveau contact */}
                    <button onClick={() => { setForm(EMPTY_CONTACT); setModal('add') }}
                        className="flex items-center gap-1.5 text-[10px] font-bold bg-[#7b61ff] text-white px-3 py-2 rounded-lg hover:bg-[#6145ff] transition-colors">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nouveau contact
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total', val: stats.total, color: 'text-[#eeeef8]' },
                    { label: 'Avec telephone', val: stats.withPhone, color: 'text-emerald-400' },
                    { label: 'Avec email', val: stats.withEmail, color: 'text-sky-400' },
                    { label: 'Deja contactes', val: stats.called, color: 'text-violet-400' },
                ].map((k, i) => (
                    <div key={i} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4 text-center">
                        <div className={`text-2xl font-bold font-mono ${k.color}`}>{k.val}</div>
                        <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider mt-1">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Barre filtres */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                <div className="relative w-full sm:flex-1 sm:max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contact..."
                        className="w-full bg-[#18181f] border border-[#2e2e44] rounded-lg pl-9 pr-4 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                </div>
                <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                    className="bg-[#18181f] border border-[#2e2e44] rounded-lg px-3 py-2 text-xs text-[#eeeef8] outline-none focus:border-[#7b61ff] w-full sm:w-auto">
                    <option value="">Tous les tags</option>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="text-xs text-[#55557a] whitespace-nowrap">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>
            </div>

            {/* ── VUE LISTE ──────────────────────────────────────── */}
            {view === 'list' && (
                <div className="flex flex-col lg:flex-row gap-5">
                    {/* Table */}
                    <div className={`flex-1 min-w-0 bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden ${selContact ? 'lg:max-w-[60%]' : ''}`}>
                        {filtered.length === 0 ? (
                            <div className="p-12 text-center">
                                <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                                <p className="text-sm font-medium text-[#55557a]">Aucun contact</p>
                                <button onClick={() => { setForm(EMPTY_CONTACT); setModal('add') }}
                                    className="text-xs text-[#7b61ff] hover:underline mt-2">Ajouter le premier contact</button>
                            </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px]">
                                <thead>
                                    <tr className="bg-[#1f1f2a] border-b border-[#2e2e44]">
                                        {['Contact', 'Telephone', 'Entreprise', 'Tags', 'Dernier appel', ''].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#55557a] whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c, i) => (
                                        <tr key={c.id}
                                            onClick={() => openDetail(c)}
                                            className={`border-b border-[#1f1f2a] last:border-0 cursor-pointer transition-colors
                                                ${selContact?.id === c.id ? 'bg-[#7b61ff]/8 border-[#7b61ff]/20' : 'hover:bg-[#1f1f2a]/60'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                                        style={{ background: `linear-gradient(135deg,${ACP[i % ACP.length]},${ACP[i % ACP.length]}cc)` }}>
                                                        {contactIni(c)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-[#eeeef8]">{contactName(c)}</div>
                                                        {c.email && <div className="text-[10px] text-[#55557a] truncate max-w-[140px]">{c.email}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-[#9898b8]">{fmtPh(c.phone || '')}</td>
                                            <td className="px-4 py-3 text-xs text-[#55557a]">{c.company || '—'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1 flex-wrap">
                                                    {c.tags?.map(t => (
                                                        <span key={t.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: t.color + '22', color: t.color, border: `1px solid ${t.color}44` }}>
                                                            {t.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] text-[#55557a]">
                                                {c.last_called_at ? fmtD(c.last_called_at) : '—'}
                                                {c.call_count && c.call_count > 0 ? <span className="ml-1 text-[#3a3a55]">({c.call_count}x)</span> : null}
                                            </td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => callBack(c.phone || '')}
                                                    className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 rounded-lg hover:bg-emerald-400/20 transition-colors">
                                                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                                    Appeler
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>
                        )}
                    </div>

                    {/* Panneau détail */}
                    {selContact && (
                        <div className="w-full lg:w-80 flex-shrink-0 bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden flex flex-col">
                            {/* Header panneau */}
                            <div className="px-5 py-4 border-b border-[#2e2e44] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                        style={{ background: `linear-gradient(135deg,#2d1a80,#4d1a5a)` }}>
                                        {contactIni(selContact)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-[#eeeef8]">{contactName(selContact)}</div>
                                        {selContact.position && <div className="text-[10px] text-[#55557a]">{selContact.position}</div>}
                                    </div>
                                </div>
                                <button onClick={() => setSelContact(null)} className="text-[#55557a] hover:text-[#9898b8]">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {/* Infos */}
                                <div className="space-y-2">
                                    {[
                                        { icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>, val: fmtPh(selContact.phone || ''), label: 'Téléphone' },
                                        { icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>, val: selContact.email || '—', label: 'Email' },
                                        { icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>, val: selContact.company || '—', label: 'Entreprise' },
                                        { icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>, val: [selContact.address, selContact.city, selContact.province, selContact.postal_code, selContact.country].filter(Boolean).join(', ') || '—', label: 'Adresse' },
                                    ].map((row, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="text-[#55557a] flex-shrink-0">{row.icon}</div>
                                            <div className="text-xs text-[#9898b8] truncate">{row.val}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tags */}
                                {selContact.tags && selContact.tags.length > 0 && (
                                    <div>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#55557a] mb-1.5">Tags</div>
                                        <div className="flex flex-wrap gap-1">
                                            {selContact.tags.map(t => (
                                                <span key={t.id} className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.color + '22', color: t.color, border: `1px solid ${t.color}44` }}>
                                                    {t.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {selContact.notes && (
                                    <div>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#55557a] mb-1.5">Notes</div>
                                        <div className="text-xs text-[#9898b8] leading-relaxed bg-[#1f1f2a] rounded-lg p-3 border-l-2 border-[#7b61ff]/40">
                                            {selContact.notes}
                                        </div>
                                    </div>
                                )}

                                {/* Historique appels */}
                                <div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#55557a] mb-2">
                                        Historique appels {history.length > 0 ? `(${history.length})` : ''}
                                    </div>
                                    {history.length === 0 ? (
                                        <div className="text-[10px] text-[#3a3a55]">Aucun appel</div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {history.slice(0, 5).map((h: any) => (
                                                <div key={h.id} className="flex items-center justify-between bg-[#1f1f2a] rounded-lg px-3 py-2">
                                                    <div>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mr-2 ${h.direction === 'INBOUND' ? 'bg-sky-400/15 text-sky-400' : 'bg-violet-400/15 text-violet-400'}`}>
                                                            {h.direction === 'INBOUND' ? 'Entrant' : 'Sortant'}
                                                        </span>
                                                        <span className={`text-[9px] ${h.status === 'COMPLETED' ? 'text-emerald-400' : h.status === 'NO_ANSWER' ? 'text-amber-400' : 'text-rose-400'}`}>{h.status}</span>
                                                    </div>
                                                    <div className="text-[9px] text-[#55557a]">{fmtD(h.started_at)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-5 py-4 border-t border-[#2e2e44] flex gap-2">
                                <button onClick={() => callBack(selContact?.phone || '')}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 py-2 rounded-lg hover:bg-emerald-400/20 transition-colors">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                    Appeler
                                </button>
                                <button onClick={() => { setForm({ first_name: selContact.first_name, last_name: selContact.last_name, email: selContact.email || '', phone: selContact.phone || '', company: selContact.company || '', position: selContact.position || '', address: selContact.address || '', city: selContact.city || '', province: selContact.province || '', postal_code: selContact.postal_code || '', country: selContact.country || 'Canada', notes: selContact.notes || '', custom_fields: (selContact as any).custom_fields || {} }); setModal('edit') }}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-[#9898b8] border border-[#2e2e44] bg-[#1f1f2a] py-2 rounded-lg hover:text-[#eeeef8] transition-colors">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    Modifier
                                </button>
                                <button onClick={() => setDeleteId(selContact.id)}
                                    className="flex items-center justify-center text-[#55557a] border border-[#2e2e44] bg-[#1f1f2a] px-3 py-2 rounded-lg hover:text-rose-400 hover:border-rose-400/30 transition-colors">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                                </button>
                            </div>
                            {/* Actions CRM avancees */}
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => { setShowNewAppt(true) }}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#00d4aa] border border-[#00d4aa]/20 bg-[#00d4aa]/8 py-1.5 rounded-lg hover:bg-[#00d4aa]/15 transition-colors">
                                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg>
                                    Planifier RDV
                                </button>
                                <button onClick={() => { setQuoteItems([{ description: '', qty: 1, unit_price: 0 }]); setQuoteContact(selContact.id); setQuoteNotes(''); setShowQuoteModal(true) }}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#ffb547] border border-[#ffb547]/20 bg-[#ffb547]/8 py-1.5 rounded-lg hover:bg-[#ffb547]/15 transition-colors">
                                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                    Creer devis
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── VUE PIPELINE ───────────────────────────────────── */}
            {view === 'pipeline' && (
                <div className="flex gap-3 overflow-x-auto pb-4">
                    {PIPELINE_COLS.map(col => {
                        const colContacts = byStatus(col.id)
                        return (
                            <div key={col.id} className="flex-shrink-0 w-56">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                                        <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
                                    </div>
                                    <span className="text-[10px] text-[#55557a] font-bold">{colContacts.length}</span>
                                </div>
                                <div className="space-y-2 min-h-[100px]">
                                    {colContacts.map((c, i) => (
                                        <div key={c.id} onClick={() => { setView('list'); openDetail(c) }}
                                            className="bg-[#18181f] border border-[#2e2e44] rounded-lg p-3 cursor-pointer hover:border-[#3a3a55] transition-colors">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                                    style={{ background: ACP[i % ACP.length] }}>
                                                    {contactIni(c)}
                                                </div>
                                                <div className="text-xs font-semibold text-[#eeeef8] truncate">{contactName(c)}</div>
                                            </div>
                                            {c.company && <div className="text-[10px] text-[#55557a] truncate">{c.company}</div>}
                                            {c.phone && <div className="text-[9px] font-mono text-[#3a3a55] mt-1">{fmtPh(c.phone)}</div>}
                                            {c.tags && c.tags.length > 0 && (
                                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                                    {c.tags.slice(0, 2).map(t => (
                                                        <span key={t.id} className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: t.color + '22', color: t.color }}>
                                                            {t.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {colContacts.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-[#2e2e44] p-4 text-center">
                                            <div className="text-[10px] text-[#3a3a55]">Aucun contact</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── MODALS (remplacent prompt/confirm natifs) ── */}
            {deleteId && (
                <ConfirmModal title="Supprimer ce contact ?" message="Cette action est irreversible." confirmLabel="Supprimer" danger
                    onConfirm={() => { deleteContact(deleteId); setDeleteId(null) }} onCancel={() => setDeleteId(null)} />
            )}
            {showNewAppt && (
                <PromptModal title="Nouveau rendez-vous" submitLabel="Planifier" wide
                    fields={[
                        { key: 'title', label: 'Titre', placeholder: 'Appel de suivi, reunion decouverte...', required: true, colSpan: 2 },
                        { key: 'contact_id', label: 'Contact', type: 'select' as const, required: true, colSpan: 1,
                          options: contacts.map(c => ({ value: c.id, label: contactName(c) + (c.company ? ` (${c.company})` : '') })),
                          defaultValue: selContact?.id || '',
                          placeholder: '-- Choisir un contact --' },
                        { key: 'agent_id', label: 'Agent assigne', type: 'select' as const, colSpan: 1,
                          options: agents.map((a: any) => ({ value: a.id, label: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() })),
                          placeholder: '-- Choisir un agent --' },
                        { key: 'type', label: 'Type', type: 'select' as const, required: true, colSpan: 1,
                          options: [
                            { value: 'CALL', label: 'Appel telephonique' },
                            { value: 'VIDEO', label: 'Visioconference' },
                            { value: 'MEETING', label: 'Reunion en personne' },
                            { value: 'VISIT', label: 'Visite client' },
                          ], defaultValue: 'CALL' },
                        { key: 'duration', label: 'Duree', type: 'select' as const, required: true, colSpan: 1,
                          options: [
                            { value: '15', label: '15 minutes' },
                            { value: '30', label: '30 minutes' },
                            { value: '45', label: '45 minutes' },
                            { value: '60', label: '1 heure' },
                            { value: '90', label: '1h30' },
                            { value: '120', label: '2 heures' },
                          ], defaultValue: '30' },
                        { key: 'starts_at', label: 'Date et heure', type: 'datetime-local' as const, required: true, colSpan: 1 },
                        { key: 'location', label: 'Lieu', placeholder: 'Bureau, Teams, Zoom, Telephone...', colSpan: 1 },
                        { key: 'notes', label: 'Notes', type: 'textarea' as const, placeholder: 'Details du rendez-vous...', rows: 2, colSpan: 2 },
                    ]}
                    onSubmit={vals => {
                        const durationMs = parseInt(vals.duration || '30') * 60000
                        createAppointment({
                            title: vals.title,
                            contact_id: vals.contact_id,
                            agent_id: vals.agent_id || undefined,
                            type: vals.type,
                            starts_at: new Date(vals.starts_at).toISOString(),
                            ends_at: new Date(new Date(vals.starts_at).getTime() + durationMs).toISOString(),
                            location: vals.location || undefined,
                            notes: vals.notes || undefined,
                        })
                        showToast('Rendez-vous planifie')
                        setShowNewAppt(false)
                    }}
                    onCancel={() => setShowNewAppt(false)} />
            )}
            {showNewTpl && (
                <PromptModal title="Nouveau template email" submitLabel="Creer" wide
                    fields={[
                        { key: 'name', label: 'Nom du template', placeholder: 'Bienvenue, Suivi, Relance...', required: true, colSpan: 1 },
                        { key: 'category', label: 'Categorie', type: 'select' as const, colSpan: 1,
                          options: [
                            { value: 'welcome', label: 'Bienvenue' },
                            { value: 'followup', label: 'Suivi' },
                            { value: 'reminder', label: 'Relance' },
                            { value: 'quote', label: 'Devis' },
                            { value: 'invoice', label: 'Facturation' },
                            { value: 'other', label: 'Autre' },
                          ] },
                        { key: 'subject', label: 'Sujet', placeholder: 'Objet du mail — variables : {{prenom}}, {{entreprise}}, {{agent}}', required: true, colSpan: 2 },
                        { key: 'body_html', label: 'Corps du message (HTML)', type: 'textarea' as const, rows: 8, colSpan: 2,
                          placeholder: '<p>Bonjour {{prenom}},</p>\n<p>Merci pour votre interet...</p>\n<p>Cordialement,<br/>{{agent}}</p>',
                          hint: 'Variables disponibles : {{prenom}}, {{nom}}, {{entreprise}}, {{email}}, {{telephone}}, {{agent}}, {{date}}',
                          required: true },
                    ]}
                    onSubmit={async vals => {
                        await apiFetch('/api/v1/crm/email-templates', {
                            method: 'POST',
                            body: JSON.stringify({ name: vals.name, subject: vals.subject, body_html: vals.body_html, category: vals.category || 'other' })
                        })
                        showToast('Template cree')
                        loadTemplates()
                        setShowNewTpl(false)
                    }}
                    onCancel={() => setShowNewTpl(false)} />
            )}
            {showNewField && (
                <PromptModal title="Nouveau champ personnalise" submitLabel="Ajouter"
                    fields={[{ key: 'fieldName', label: 'Nom du champ', placeholder: 'Langue, Secteur, ID client...', required: true }]}
                    onSubmit={vals => { setForm(p => ({ ...p, custom_fields: { ...p.custom_fields, [vals.fieldName]: '' } })); setShowNewField(false) }}
                    onCancel={() => setShowNewField(false)} />
            )}

            {/* ── VUE CALENDRIER (react-big-calendar) ── */}
            {view === 'calendar' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-bold text-[#eeeef8]">Rendez-vous</div>
                        <button onClick={() => setShowNewAppt(true)} className="text-xs bg-[#00d4aa] text-white px-3 py-1.5 rounded-lg font-bold">+ Rendez-vous</button>
                    </div>
                    {loadingCal ? (
                        <div className="text-xs text-[#55557a] text-center py-8">Chargement...</div>
                    ) : (
                        <CRMCalendar
                            appointments={appointments}
                            contacts={contacts}
                            onCreate={(start, end) => {
                                setShowNewAppt(true)
                            }}
                            onSelect={(apt) => {
                                setShowNewAppt(true)
                            }}
                        />
                    )}
                </div>
            )}

            {/* ── VUE DEVIS ── */}
            {view === 'quotes' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-bold text-[#eeeef8]">Devis / Propositions</div>
                        <button onClick={() => { setQuoteItems([{ description: '', qty: 1, unit_price: 0 }]); setQuoteContact(''); setQuoteNotes(''); setShowQuoteModal(true) }}
                            className="text-xs bg-[#ffb547] text-[#111118] px-3 py-1.5 rounded-lg font-bold">+ Nouveau devis</button>
                    </div>
                    {quotes.length === 0 && <div className="text-xs text-[#35355a] text-center py-8 border border-dashed border-[#2e2e44] rounded-xl">Aucun devis — cliquez + Nouveau devis</div>}
                    <div className="space-y-2">
                        {quotes.map((q: any) => {
                            const ct = contacts.find(c => c.id === q.contact_id)
                            return (
                                <div key={q.id} onClick={() => setShowQuotePreview(q)}
                                    className="bg-[#18181f] border border-[#2e2e44] rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-[#7b61ff]/40 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#ffb547]/10 flex items-center justify-center">
                                            <svg width="18" height="18" fill="none" stroke="#ffb547" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-[#eeeef8]">{q.number}</div>
                                            <div className="text-[10px] text-[#55557a]">
                                                {ct ? contactName(ct) : 'Sans contact'} — {new Date(q.created_at).toLocaleDateString('fr-CA')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-sm font-bold font-mono text-[#eeeef8]">{q.total?.toFixed?.(2) || '0.00'} $</div>
                                            <div className="text-[9px] text-[#55557a]">{q.items?.length || 0} item{(q.items?.length || 0) > 1 ? 's' : ''}</div>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${q.status==='DRAFT'?'bg-[#55557a]/15 text-[#55557a]':q.status==='SENT'?'bg-[#38b6ff]/15 text-[#38b6ff]':q.status==='ACCEPTED'?'bg-[#00d4aa]/15 text-[#00d4aa]':'bg-[#ff4d6d]/15 text-[#ff4d6d]'}`}>
                                            {q.status === 'DRAFT' ? 'Brouillon' : q.status === 'SENT' ? 'Envoye' : q.status === 'ACCEPTED' ? 'Accepte' : 'Refuse'}
                                        </span>
                                        <svg width="14" height="14" fill="none" stroke="#55557a" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── MODAL CREATION DEVIS ── */}
            {showQuoteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowQuoteModal(false)}>
                    <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="px-6 pt-6 pb-3 border-b border-[#2e2e44] flex-shrink-0">
                            <div className="font-bold text-[#eeeef8] text-lg">Nouveau devis</div>
                        </div>
                        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
                            {/* Contact */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Client *</label>
                                <select value={quoteContact} onChange={e => setQuoteContact(e.target.value)}
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">-- Choisir un contact --</option>
                                    {contacts.map(c => <option key={c.id} value={c.id}>{contactName(c)}{c.company ? ` (${c.company})` : ''}</option>)}
                                </select>
                            </div>
                            {/* Items dynamiques */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#55557a]">Lignes du devis</label>
                                    <button type="button" onClick={() => setQuoteItems(p => [...p, { description: '', qty: 1, unit_price: 0 }])}
                                        className="text-[10px] text-[#7b61ff] font-bold hover:text-[#a695ff]">+ Ajouter une ligne</button>
                                </div>
                                <div className="space-y-2">
                                    {quoteItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input value={item.description} onChange={e => { const n = [...quoteItems]; n[idx].description = e.target.value; setQuoteItems(n) }}
                                                placeholder="Description du service/produit"
                                                className="flex-1 bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                                            <input type="number" value={item.qty} onChange={e => { const n = [...quoteItems]; n[idx].qty = parseInt(e.target.value) || 1; setQuoteItems(n) }}
                                                min={1} className="w-16 bg-[#111118] border border-[#2e2e44] rounded-lg px-2 py-2 text-sm text-[#eeeef8] text-center outline-none focus:border-[#7b61ff]" />
                                            <div className="relative">
                                                <input type="number" value={item.unit_price} onChange={e => { const n = [...quoteItems]; n[idx].unit_price = parseFloat(e.target.value) || 0; setQuoteItems(n) }}
                                                    step="0.01" className="w-24 bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] pr-6" />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#55557a]">$</span>
                                            </div>
                                            <div className="w-20 text-right text-sm font-mono text-[#9898b8]">{(item.qty * item.unit_price).toFixed(2)} $</div>
                                            {quoteItems.length > 1 && (
                                                <button type="button" onClick={() => setQuoteItems(p => p.filter((_, i) => i !== idx))}
                                                    className="text-[#ff4d6d55] hover:text-[#ff4d6d] text-sm px-1">x</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {/* Totaux */}
                                <div className="mt-3 pt-3 border-t border-[#2e2e44] flex justify-end">
                                    <div className="text-right space-y-1">
                                        <div className="text-xs text-[#55557a]">Sous-total : <span className="text-[#9898b8] font-mono">{quoteItems.reduce((s, i) => s + i.qty * i.unit_price, 0).toFixed(2)} $</span></div>
                                        <div className="text-xs text-[#55557a]">TPS (5%) : <span className="text-[#9898b8] font-mono">{(quoteItems.reduce((s, i) => s + i.qty * i.unit_price, 0) * 0.05).toFixed(2)} $</span></div>
                                        <div className="text-xs text-[#55557a]">TVQ (9.975%) : <span className="text-[#9898b8] font-mono">{(quoteItems.reduce((s, i) => s + i.qty * i.unit_price, 0) * 0.09975).toFixed(2)} $</span></div>
                                        <div className="text-sm font-bold text-[#eeeef8]">Total : <span className="text-[#ffb547] font-mono">{(quoteItems.reduce((s, i) => s + i.qty * i.unit_price, 0) * 1.14975).toFixed(2)} CAD</span></div>
                                    </div>
                                </div>
                            </div>
                            {/* Notes */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Notes</label>
                                <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} rows={2}
                                    placeholder="Conditions, delais, remarques..."
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] resize-none" />
                            </div>
                        </div>
                        <div className="px-6 py-4 flex gap-3 flex-shrink-0 border-t border-[#2e2e44]">
                            <button onClick={() => setShowQuoteModal(false)}
                                className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] py-2.5 rounded-xl text-sm font-bold hover:text-[#eeeef8] transition-colors">Annuler</button>
                            <button onClick={() => {
                                if (!quoteContact) { showToast('Choisissez un contact', 'err'); return }
                                if (!quoteItems.some(i => i.description.trim())) { showToast('Ajoutez au moins un item', 'err'); return }
                                const subtotal = quoteItems.reduce((s, i) => s + i.qty * i.unit_price, 0)
                                createQuote({
                                    contact_id: quoteContact,
                                    items: quoteItems.filter(i => i.description.trim()).map(i => ({ ...i, total: i.qty * i.unit_price })),
                                    subtotal,
                                    tax_rate: 14.975,
                                    tax_amount: subtotal * 0.14975,
                                    total: subtotal * 1.14975,
                                    notes: quoteNotes,
                                })
                                showToast('Devis cree')
                                setShowQuoteModal(false)
                            }}
                                className="flex-1 bg-[#ffb547] text-[#111118] py-2.5 rounded-xl text-sm font-bold hover:bg-[#ffc564] transition-colors">Creer le devis</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL PREVIEW DEVIS ── */}
            {showQuotePreview && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowQuotePreview(null)}>
                    <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="px-6 pt-5 pb-3 border-b border-[#2e2e44] flex items-center justify-between flex-shrink-0">
                            <div>
                                <div className="font-bold text-[#eeeef8]">Devis {showQuotePreview.number}</div>
                                <div className="text-[10px] text-[#55557a]">{new Date(showQuotePreview.created_at).toLocaleDateString('fr-CA')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${showQuotePreview.status==='DRAFT'?'bg-[#55557a]/15 text-[#55557a]':showQuotePreview.status==='SENT'?'bg-[#38b6ff]/15 text-[#38b6ff]':showQuotePreview.status==='ACCEPTED'?'bg-[#00d4aa]/15 text-[#00d4aa]':'bg-[#ff4d6d]/15 text-[#ff4d6d]'}`}>
                                    {showQuotePreview.status === 'DRAFT' ? 'Brouillon' : showQuotePreview.status === 'SENT' ? 'Envoye' : showQuotePreview.status === 'ACCEPTED' ? 'Accepte' : 'Refuse'}
                                </span>
                                <button onClick={() => setShowQuotePreview(null)} className="text-[#55557a] hover:text-[#9898b8]">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
                            {/* Client */}
                            {(() => {
                                const ct = contacts.find(c => c.id === showQuotePreview.contact_id)
                                return ct ? (
                                    <div className="flex items-center gap-3 bg-[#1f1f2a] rounded-lg p-3">
                                        <div className="w-8 h-8 rounded-full bg-[#7b61ff]/20 flex items-center justify-center text-[10px] font-bold text-[#7b61ff]">{contactIni(ct)}</div>
                                        <div>
                                            <div className="text-sm font-semibold text-[#eeeef8]">{contactName(ct)}</div>
                                            <div className="text-[10px] text-[#55557a]">{ct.email || ct.phone || ''}</div>
                                        </div>
                                    </div>
                                ) : null
                            })()}
                            {/* Items */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Lignes</div>
                                <div className="border border-[#2e2e44] rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-[#1f1f2a]">
                                                <th className="text-left px-3 py-2 text-[9px] font-bold uppercase text-[#55557a]">Description</th>
                                                <th className="text-center px-3 py-2 text-[9px] font-bold uppercase text-[#55557a] w-16">Qte</th>
                                                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase text-[#55557a] w-24">Prix unit.</th>
                                                <th className="text-right px-3 py-2 text-[9px] font-bold uppercase text-[#55557a] w-24">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(showQuotePreview.items || []).map((item: any, i: number) => (
                                                <tr key={i} className="border-t border-[#2e2e44]">
                                                    <td className="px-3 py-2 text-sm text-[#eeeef8]">{item.description}</td>
                                                    <td className="px-3 py-2 text-sm text-[#9898b8] text-center">{item.qty}</td>
                                                    <td className="px-3 py-2 text-sm font-mono text-[#9898b8] text-right">{(item.unit_price || 0).toFixed(2)} $</td>
                                                    <td className="px-3 py-2 text-sm font-mono text-[#eeeef8] text-right">{((item.qty || 1) * (item.unit_price || 0)).toFixed(2)} $</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-3 text-right space-y-0.5">
                                    <div className="text-xs text-[#55557a]">Sous-total : <span className="font-mono text-[#9898b8]">{(showQuotePreview.subtotal || 0).toFixed(2)} $</span></div>
                                    <div className="text-xs text-[#55557a]">Taxes ({showQuotePreview.tax_rate || 0}%) : <span className="font-mono text-[#9898b8]">{(showQuotePreview.tax_amount || 0).toFixed(2)} $</span></div>
                                    <div className="text-base font-bold text-[#ffb547]">{(showQuotePreview.total || 0).toFixed(2)} CAD</div>
                                </div>
                            </div>
                            {showQuotePreview.notes && (
                                <div className="bg-[#1f1f2a] rounded-lg p-3 border-l-2 border-[#ffb547]/40">
                                    <div className="text-[9px] font-bold uppercase text-[#55557a] mb-1">Notes</div>
                                    <div className="text-xs text-[#9898b8]">{showQuotePreview.notes}</div>
                                </div>
                            )}
                        </div>
                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-2 flex-shrink-0">
                            {/* PDF seulement si envoye ou accepte */}
                            {(showQuotePreview.status === 'SENT' || showQuotePreview.status === 'ACCEPTED') && (
                                <button onClick={() => generateQuotePDF(showQuotePreview)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-[#7b61ff] border border-[#7b61ff]/30 bg-[#7b61ff]/10 px-4 py-2 rounded-lg hover:bg-[#7b61ff]/20 transition-colors">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    Telecharger PDF
                                </button>
                            )}
                            {/* Envoyer seulement si brouillon */}
                            {showQuotePreview.status === 'DRAFT' && (
                                <button onClick={async () => {
                                    await apiFetch(`/api/v1/crm/quotes/${showQuotePreview.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'SENT' }) })
                                    showToast('Devis marque comme envoye')
                                    loadQuotes()
                                    setShowQuotePreview((p: any) => p ? { ...p, status: 'SENT' } : null)
                                }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-[#38b6ff] border border-[#38b6ff]/30 bg-[#38b6ff]/10 px-4 py-2 rounded-lg hover:bg-[#38b6ff]/20 transition-colors">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>
                                    Marquer envoye
                                </button>
                            )}
                            {/* Accepter/Refuser si brouillon ou envoye */}
                            {(showQuotePreview.status === 'SENT' || showQuotePreview.status === 'DRAFT') && (
                                <>
                                    <button onClick={async () => {
                                        await apiFetch(`/api/v1/crm/quotes/${showQuotePreview.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ACCEPTED' }) })
                                        showToast('Devis accepte')
                                        loadQuotes()
                                        setShowQuotePreview((p: any) => p ? { ...p, status: 'ACCEPTED' } : null)
                                    }}
                                        className="flex items-center gap-1.5 text-xs font-bold text-[#00d4aa] border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-2 rounded-lg hover:bg-[#00d4aa]/20 transition-colors">
                                        Accepter
                                    </button>
                                    <button onClick={async () => {
                                        await apiFetch(`/api/v1/crm/quotes/${showQuotePreview.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'REJECTED' }) })
                                        showToast('Devis refuse')
                                        loadQuotes()
                                        setShowQuotePreview((p: any) => p ? { ...p, status: 'REJECTED' } : null)
                                    }}
                                        className="flex items-center gap-1.5 text-xs font-bold text-[#ff4d6d] border border-[#ff4d6d]/30 bg-[#ff4d6d]/10 px-4 py-2 rounded-lg hover:bg-[#ff4d6d]/20 transition-colors">
                                        Refuser
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── VUE TEMPLATES EMAIL ── */}
            {view === 'templates' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-sm font-bold text-[#eeeef8]">Templates email</div>
                            <div className="text-[10px] text-[#55557a] mt-0.5">Variables : {'{{prenom}}'}, {'{{nom}}'}, {'{{entreprise}}'}, {'{{email}}'}, {'{{telephone}}'}, {'{{agent}}'}, {'{{date}}'}</div>
                        </div>
                        <button onClick={() => setShowNewTpl(true)} className="text-xs bg-[#38b6ff] text-white px-3 py-1.5 rounded-lg font-bold">+ Template</button>
                    </div>
                    {templates.length === 0 && <div className="text-xs text-[#35355a] text-center py-8 border border-dashed border-[#2e2e44] rounded-xl">Aucun template — cliquez + Template pour en creer</div>}
                    <div className="space-y-2">
                        {templates.map((t: any) => (
                            <div key={t.id} onClick={() => setShowTplEditor(t)}
                                className="bg-[#18181f] border border-[#2e2e44] rounded-lg p-4 cursor-pointer hover:border-[#38b6ff]/40 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-[#38b6ff]/10 flex items-center justify-center">
                                            <svg width="16" height="16" fill="none" stroke="#38b6ff" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22 6 12 13 2 6" /></svg>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-[#eeeef8]">{t.name}</div>
                                            <div className="text-[10px] text-[#55557a]">Sujet : {t.subject}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {t.category && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#38b6ff]/10 text-[#38b6ff]">{t.category}</span>}
                                        <svg width="14" height="14" fill="none" stroke="#55557a" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                                    </div>
                                </div>
                                {t.body_html && (
                                    <div className="text-[10px] text-[#55557a] truncate mt-1 bg-[#1f1f2a] rounded px-2 py-1 max-w-full">
                                        {t.body_html.replace(/<[^>]*>/g, '').substring(0, 100)}{t.body_html.length > 100 ? '...' : ''}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── MODAL EDITEUR TEMPLATE ── */}
            {showTplEditor && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowTplEditor(null)}>
                    <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="px-6 pt-5 pb-3 border-b border-[#2e2e44] flex items-center justify-between flex-shrink-0">
                            <div className="font-bold text-[#eeeef8]">{showTplEditor.name}</div>
                            <button onClick={() => setShowTplEditor(null)} className="text-[#55557a] hover:text-[#9898b8]">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-0 h-full min-h-[400px]">
                                {/* Editeur */}
                                <div className="border-r border-[#2e2e44] p-4 flex flex-col">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Editeur HTML</div>
                                    <div className="mb-3">
                                        <label className="block text-[10px] text-[#55557a] mb-1">Sujet</label>
                                        <input value={showTplEditor.subject} onChange={e => setShowTplEditor((p: any) => ({ ...p, subject: e.target.value }))}
                                            className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <textarea value={showTplEditor.body_html || ''} onChange={e => setShowTplEditor((p: any) => ({ ...p, body_html: e.target.value }))}
                                        className="flex-1 w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] font-mono outline-none focus:border-[#7b61ff] resize-none min-h-[250px]"
                                        placeholder="<p>Bonjour {{prenom}},</p>" />
                                    <div className="mt-2 text-[9px] text-[#55557a]">Variables : {'{{prenom}} {{nom}} {{entreprise}} {{email}} {{telephone}} {{agent}} {{date}}'}</div>
                                </div>
                                {/* Preview */}
                                <div className="p-4 flex flex-col">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Apercu</div>
                                    <div className="flex-1 bg-white rounded-lg p-4 overflow-auto">
                                        <div className="text-xs text-gray-500 mb-2 pb-2 border-b border-gray-200">
                                            <strong>De :</strong> agent@voxflow.io<br />
                                            <strong>A :</strong> client@exemple.com<br />
                                            <strong>Sujet :</strong> {(showTplEditor.subject || '').replace(/\{\{prenom\}\}/g, 'Jean').replace(/\{\{nom\}\}/g, 'Tremblay').replace(/\{\{entreprise\}\}/g, 'Acme Inc.').replace(/\{\{agent\}\}/g, 'Marie').replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-CA'))}
                                        </div>
                                        <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{
                                            __html: (showTplEditor.body_html || '<p><em>Aucun contenu</em></p>')
                                                .replace(/\{\{prenom\}\}/g, 'Jean')
                                                .replace(/\{\{nom\}\}/g, 'Tremblay')
                                                .replace(/\{\{entreprise\}\}/g, 'Acme Inc.')
                                                .replace(/\{\{email\}\}/g, 'jean@acme.com')
                                                .replace(/\{\{telephone\}\}/g, '+1 (514) 555-0000')
                                                .replace(/\{\{agent\}\}/g, 'Marie')
                                                .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-CA'))
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-2 flex-shrink-0">
                            <button onClick={async () => {
                                await apiFetch(`/api/v1/crm/email-templates/${showTplEditor.id}`, { method: 'DELETE' })
                                showToast('Template supprime')
                                loadTemplates()
                                setShowTplEditor(null)
                            }}
                                className="text-xs font-bold text-[#ff4d6d] border border-[#ff4d6d]/30 bg-[#ff4d6d]/10 px-4 py-2 rounded-lg hover:bg-[#ff4d6d]/20 transition-colors">Supprimer</button>
                            <div className="flex-1" />
                            <button onClick={() => setShowTplEditor(null)}
                                className="text-xs font-bold text-[#9898b8] border border-[#2e2e44] bg-[#1f1f2a] px-4 py-2 rounded-lg hover:text-[#eeeef8] transition-colors">Annuler</button>
                            <button onClick={async () => {
                                await apiFetch(`/api/v1/crm/email-templates/${showTplEditor.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ subject: showTplEditor.subject, body_html: showTplEditor.body_html })
                                })
                                showToast('Template sauvegarde')
                                loadTemplates()
                                setShowTplEditor(null)
                            }}
                                className="text-xs font-bold text-white bg-[#38b6ff] px-4 py-2 rounded-lg hover:bg-[#2da3e8] transition-colors">Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL CONTACT ──────────────────────────────────── */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44]">
                            <div className="font-bold text-[#eeeef8]">{modal === 'add' ? 'Nouveau contact' : 'Modifier le contact'}</div>
                            <button onClick={() => setModal(null)} className="text-[#55557a] hover:text-[#9898b8]">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'first_name', label: 'Prénom', ph: 'Jean' },
                                    { key: 'last_name', label: 'Nom', ph: 'Tremblay' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
                                        <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                            placeholder={f.ph}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                ))}
                            </div>
                            {[
                                { key: 'phone', label: 'Téléphone', ph: '+1 (514) 555-0000' },
                                { key: 'email', label: 'Email', ph: 'jean@entreprise.com' },
                                { key: 'company', label: 'Entreprise', ph: 'Acme Inc.' },
                                { key: 'position', label: 'Poste', ph: 'Directeur commercial' },
                                { key: 'address', label: 'Adresse', ph: '123 rue Principale' },
                                { key: 'city', label: 'Ville', ph: 'Montréal' },
                                { key: 'postal_code', label: 'Code postal', ph: 'H1A 1A1' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
                                    <input value={(form as any)[f.key]} onChange={e => {
                                        const upd: any = { ...form, [f.key]: e.target.value }
                                        // Auto-enrichir région si phone saisi
                                        if (f.key === 'phone') {
                                            const region = getPhoneRegion(e.target.value)
                                            if (region) {
                                                if (!upd.city) upd.city = region.city
                                                if (!upd.province) upd.province = region.province
                                                if (!upd.country) upd.country = region.country
                                            }
                                        }
                                        setForm(upd)
                                    }}
                                        placeholder={f.ph}
                                        className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                                </div>
                            ))}
                            {/* Pays */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Pays</label>
                                <select value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value, province: '' }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">— Choisir un pays —</option>
                                    {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            {/* Province/État — dynamique selon pays */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">
                                    {form.country === 'États-Unis' ? 'État' : form.country === 'Mexique' ? 'État' : 'Province / Région'}
                                </label>
                                {(() => {
                                    const countryCode = COUNTRIES.find(c => c.name === form.country)?.code || ''
                                    const provList = PROVINCES[countryCode]
                                    return provList ? (
                                        <select value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                            <option value="">— Choisir —</option>
                                            {provList.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                                        </select>
                                    ) : (
                                        <input value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}
                                            placeholder="Province ou région"
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                                    )
                                })()}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Notes</label>
                                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Notes sur ce contact..."
                                    rows={3}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] resize-none" />
                            </div>

                            {/* ── Champs personnalisés (custom_fields JSONB) ── */}
                            <div className="border-t border-[#2e2e44] pt-4 mt-2">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#55557a]">Champs personnalises</label>
                                    <button type="button" onClick={() => setShowNewField(true)}
                                        className="text-[10px] text-[#7b61ff] hover:text-[#a695ff] font-bold cursor-pointer bg-transparent border-none">
                                        + Ajouter un champ
                                    </button>
                                </div>
                                {Object.entries(form.custom_fields || {}).length === 0 && (
                                    <div className="text-[11px] text-[#35355a] italic py-2">Aucun champ personnalise. Cliquez "+ Ajouter un champ" pour en creer.</div>
                                )}
                                {Object.entries(form.custom_fields || {}).map(([key, val]) => (
                                    <div key={key} className="flex items-center gap-2 mb-2">
                                        <span className="text-[11px] text-[#9898b8] font-semibold min-w-[90px] truncate" title={key}>{key}</span>
                                        <input value={val} onChange={e => setForm(p => ({
                                            ...p,
                                            custom_fields: { ...p.custom_fields, [key]: e.target.value }
                                        }))}
                                            placeholder="Valeur..."
                                            className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-1.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                                        <button type="button" onClick={() => setForm(p => {
                                            const cf = { ...p.custom_fields }
                                            delete cf[key]
                                            return { ...p, custom_fields: cf }
                                        })}
                                            className="text-[#ff4d6d55] hover:text-[#ff4d6d] text-sm cursor-pointer bg-transparent border-none px-1">
                                            x
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button onClick={() => setModal(null)}
                                className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] py-2.5 rounded-xl text-sm font-bold hover:text-[#eeeef8] transition-colors">
                                Annuler
                            </button>
                            <button onClick={saveContact} disabled={saving || !form.first_name}
                                className="flex-1 bg-[#7b61ff] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Enregistrement...' : modal === 'add' ? 'Ajouter' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}