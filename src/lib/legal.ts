const env = (key: string) => process.env[key]?.trim() ?? "";

const REQUIRED_PUBLISHER_FIELDS = [
  "LEGAL_PUBLISHER_NAME",
  "LEGAL_PUBLISHER_STATUS",
  "LEGAL_PUBLISHER_ADDRESS",
  "LEGAL_PUBLISHER_PHONE",
  "LEGAL_PUBLICATION_DIRECTOR",
  "LEGAL_PUBLISHER_CAPITAL",
  "LEGAL_PUBLISHER_SIREN",
  "LEGAL_PUBLISHER_VAT",
] as const;

const identityComplete = REQUIRED_PUBLISHER_FIELDS.every((key) => env(key).length > 0);
const draft = process.env.LEGAL_DRAFT !== "false" || !identityComplete;

if (process.env.LEGAL_DRAFT === "false" && !identityComplete) {
  console.warn(
    "[legal] LEGAL_DRAFT=false mais l'identité de l'éditeur est incomplète : les pages restent en brouillon.",
  );
}

export const LEGAL_INFO = {
  product: "FiveM DevManager",
  brand: "BL-Host",
  version: draft ? "0.9 — brouillon" : "1.0",
  updatedAt: env("LEGAL_UPDATED_AT") || "13 novembre 2026",
  contactEmail: "contact@bl-host.site",
  draft,
  publisher: {
    name: env("LEGAL_PUBLISHER_NAME") || "BL-Host",
    status:
      env("LEGAL_PUBLISHER_STATUS") ||
      "Nom commercial — aucune entité juridique constituée à ce jour",
    capital: env("LEGAL_PUBLISHER_CAPITAL") || "Sans objet",
    address: env("LEGAL_PUBLISHER_ADDRESS") || "Non communiquée à ce stade",
    siren: env("LEGAL_PUBLISHER_SIREN") || "Non applicable — aucune immatriculation",
    vat: env("LEGAL_PUBLISHER_VAT") || "Non applicable",
    director: env("LEGAL_PUBLICATION_DIRECTOR") || "Non désigné à ce stade",
    phone: env("LEGAL_PUBLISHER_PHONE") || "Non communiqué à ce stade",
  },
  host: {
    name: "LWS — SAS Ligne Web Services",
    address: "2 rue Jules Ferry, 88190 Golbey, France",
    phone: "+33 1 77 62 30 03",
    website: "https://www.lws.fr",
    capital: "500 000 €",
    rcs: "RCS Paris B 851 993 683",
  },
  cdn: {
    name: "Cloudflare, Inc.",
    address: "101 Townsend St, San Francisco, CA 94107, États-Unis",
    phone: "+1 (650) 319-8930",
    website: "https://www.cloudflare.com",
  },
};
