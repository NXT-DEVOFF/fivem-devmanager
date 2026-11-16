import type { Metadata } from "next";
import { LegalField, LegalLink, LegalSection, LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_INFO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Informations légales du site FiveM DevManager, édité sous le nom commercial BL-Host.",
  robots: LEGAL_INFO.draft ? { index: false, follow: false } : { index: true, follow: true },
};

export default function LegalNoticesPage() {
  return (
    <LegalShell
      title="Mentions légales"
      subtitle="Informations relatives à l’éditeur du site, à son hébergement et aux droits applicables."
      current="mentions"
    >
      <LegalSection title="Éditeur du site">
        <p>
          Le site <strong className="text-fg">FiveM DevManager</strong> est édité sous le nom commercial{" "}
          <strong className="text-fg">BL-Host</strong>. BL-Host est un nom commercial ; aucune entité
          juridique n’est constituée à ce jour.
        </p>
        <dl className="mt-2">
          <LegalField label="Nom / dénomination">{LEGAL_INFO.publisher.name}</LegalField>
          <LegalField label="Nom commercial">{LEGAL_INFO.brand}</LegalField>
          <LegalField label="Statut">{LEGAL_INFO.publisher.status}</LegalField>
          <LegalField label="Capital social">{LEGAL_INFO.publisher.capital}</LegalField>
          <LegalField label="Siège / adresse de publication">
            {LEGAL_INFO.publisher.address}
          </LegalField>
          <LegalField label="SIREN / RCS">{LEGAL_INFO.publisher.siren}</LegalField>
          <LegalField label="TVA intracommunautaire">{LEGAL_INFO.publisher.vat}</LegalField>
          <LegalField label="Directeur de la publication">
            {LEGAL_INFO.publisher.director}
          </LegalField>
          <LegalField label="Téléphone">{LEGAL_INFO.publisher.phone}</LegalField>
          <LegalField label="Contact">
            <a
              href={`mailto:${LEGAL_INFO.contactEmail}`}
              className="font-medium text-primary-300 underline-offset-4 transition hover:text-primary-200 hover:underline"
            >
              {LEGAL_INFO.contactEmail}
            </a>
          </LegalField>
        </dl>
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3 text-xs leading-6 text-amber-100/80">
          L’identité de la personne physique ou de la société qui exploite le nom commercial BL-Host, son
          adresse de publication et son téléphone doivent être renseignés avant la publication. Sans ces
          informations, ces mentions ne sont pas complètes au regard de la LCEN. La configuration se fait
          dans les variables <code className="rounded bg-black/25 px-1 py-0.5 text-[11px] text-fg/80">LEGAL_PUBLISHER_*</code>{" "}
          et <code className="rounded bg-black/25 px-1 py-0.5 text-[11px] text-fg/80">LEGAL_PUBLICATION_DIRECTOR</code>,
          avec <code className="rounded bg-black/25 px-1 py-0.5 text-[11px] text-fg/80">LEGAL_DRAFT=false</code> au
          build une fois les champs complets.
        </p>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <p>Le site et la messagerie sont hébergés chez LWS.</p>
        <dl className="mt-2">
          <LegalField label="Hébergeur">{LEGAL_INFO.host.name}</LegalField>
          <LegalField label="Adresse">{LEGAL_INFO.host.address}</LegalField>
          <LegalField label="Téléphone">{LEGAL_INFO.host.phone}</LegalField>
          <LegalField label="Site">
            <LegalLink href={LEGAL_INFO.host.website}>{LEGAL_INFO.host.website}</LegalLink>
          </LegalField>
          <LegalField label="Capital / RCS">
            {LEGAL_INFO.host.capital} · {LEGAL_INFO.host.rcs}
          </LegalField>
        </dl>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le code de la Community Edition est distribué sous <strong className="text-fg">AGPL-3.0-only</strong>.
          Les marques, logos, bannières, textes commerciaux et éléments graphiques de BL-Host ne sont pas
          concédés par l’AGPL. Toute reproduction ou usage de marque sans autorisation est interdit, sous
          réserve des usages nominatifs autorisés par la loi.
        </p>
        <p>
          Les composants tiers restent soumis à leurs licences respectives, listées dans le fichier{" "}
          <code className="rounded bg-black/25 px-1.5 py-0.5 text-[11px] text-fg/80">NOTICES.md</code> du
          projet.
        </p>
      </LegalSection>

      <LegalSection title="Liens et responsabilité">
        <p>
          Le site peut contenir des liens vers des services tiers. BL-Host ne contrôle pas ces services et
          décline toute responsabilité quant à leur contenu, leur disponibilité ou leurs pratiques.
        </p>
        <p>
          Les informations techniques et commerciales sont fournies de bonne foi. Elles peuvent évoluer ;
          seul le contrat signé avec un client fait foi pour les prestations payantes.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles et cookies">
        <p>
          Les traitements de données personnelles et l’usage des cookies sont décrits dans la{" "}
          <a
            href="/confidentialite"
            className="font-medium text-primary-300 underline-offset-4 transition hover:text-primary-200 hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Le site est régi par le droit français. Les litiges relèvent des juridictions compétentes, sous
          réserve des règles impératives applicables. Les offres commerciales sont destinées à des
          professionnels ; la médiation de la consommation n’est pas applicable par défaut.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
