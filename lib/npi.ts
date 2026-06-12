// CMS NPPES NPI Registry lookup + validation.
// Server-side only (avoids browser CORS). NPI = 10-digit national provider id.

export interface NpiProfile {
  npi: string;
  name: string;
  credential: string;
  specialty: string;
  city: string;
  state: string;
  organization: string;
}

// Validate a 10-digit NPI using the ISO 7812 Luhn check with the
// 80840 health-application prefix, per the CMS NPI check-digit spec.
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ("80840" + npi.slice(0, 9)).split("").map(Number);
  let sum = 0;
  for (let i = digits.length - 1, dbl = true; i >= 0; i--, dbl = !dbl) {
    let d = digits[i];
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (sum + Number(npi[9])) % 10 === 0;
}

export async function lookupNpi(npiRaw: string): Promise<NpiProfile | null> {
  const npi = (npiRaw || "").replace(/\D/g, "");
  if (!isValidNpi(npi)) return null;

  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return null;

  const data: any = await res.json();
  const rec = data?.results?.[0];
  if (!rec) return null;

  const b = rec.basic || {};
  const tax = (rec.taxonomies || []).find((t: any) => t.primary) || (rec.taxonomies || [])[0] || {};
  const addr =
    (rec.addresses || []).find((a: any) => a.address_purpose === "LOCATION") ||
    (rec.addresses || [])[0] ||
    {};

  const indivName = `${b.first_name || ""} ${b.last_name || ""}`.trim();

  return {
    npi: rec.number?.toString() || npi,
    name: indivName || b.organization_name || "",
    credential: b.credential || "",
    specialty: tax.desc || "",
    city: addr.city || "",
    state: addr.state || "",
    organization: b.organization_name || "",
  };
}
