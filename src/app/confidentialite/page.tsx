import type { Metadata } from "next";
import { LegalField, LegalLink, LegalSection, LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_INFO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et de cookies du site FiveM DevManager.",
  robots: LEGAL_INFO.draft ? { index: false, follow: false } : { index: true, follow: true },
};

const RIGHTS = [
  "accéder à vos données et en obtenir une copie ;",
  "faire rectifier les données inexactes ou incomplètes ;",
  "demander l’effacement, dans les limites prévues par la loi ;",
  "demander la limitation du traitement ;",
  "vous opposer à un traitement fondé sur l’intérêt légitime ;",
  "retirer votre consentement lorsque le traitement repose sur celui-ci ;",
  "demander la portabilité des données que vous avez fournies.",
];

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Politique de confidentialité"
      subtitle="Comment FiveM DevManager traite les données personnelles, pourquoi, pendant combien de temps et comment exercer vos droits."
      current="confidentialite"
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement est <strong className="text-fg">BL-Host</strong>, nom commercial
          exploité par l’éditeur du site. Contact :{" "}
          <a
            href={`mailto:${LEGAL_INFO.contactEmail}`}
            className="font-medium text-primary-300 underline-offset-4 transition hover:text-primary-200 hover:underline"
          >
            {LEGAL_INFO.contactEmail}
          </a>
          .
        </p>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3 text-xs leading-6 text-amber-100/80">
          L’identité légale et l’adresse postale du responsable de traitement restent à compléter. Elles
          seront ajoutées avant la publication de cette politique. Les variables de build
          `LEGAL_PUBLISHER_*` permettent de les renseigner sans modifier le code.
        </div>
        <p>
          Pour les clients de l’offre <strong className="text-fg">Managed</strong>, le client est
          responsable des données qu’il importe dans le panel et BL-Host agit comme sous-traitant dans les
          conditions du DPA.
        </p>
      </LegalSection>

      <LegalSection title="Données traitées">
        <p>Le site public ne comporte pas de formulaire de contact. Les données suivantes peuvent être traitées :</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>identité et coordonnées professionnelles transmises par e-mail ;</li>
          <li>adresse e-mail, nom d’utilisateur, rôle et préférences du compte ;</li>
          <li>journaux de connexion, adresse IP, user-agent et identifiants de requête ;</li>
          <li>données, fichiers et configurations importés dans le panel ;</li>
          <li>données de facturation et de paiement le cas échéant.</li>
        </ul>
        <p>
          Aucune donnée sensible n’est requise par le service. Le site public n’utilise ni analytics, ni
          cookie publicitaire, ni profilage.
        </p>
      </LegalSection>

      <LegalSection title="Finalités et bases légales">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 text-fg/80">
                <th className="py-2 pr-4 font-medium">Finalité</th>
                <th className="py-2 font-medium">Base légale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr>
                <td className="py-3 pr-4">Répondre aux demandes commerciales</td>
                <td className="py-3">Mesures précontractuelles / intérêt légitime</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Fournir le service et gérer les comptes</td>
                <td className="py-3">Exécution du contrat</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Sécurité, audit et prévention des abus</td>
                <td className="py-3">Intérêt légitime</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Facturation et obligations comptables</td>
                <td className="py-3">Obligation légale</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Communications commerciales</td>
                <td className="py-3">Consentement ou intérêt légitime selon le cas</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <ul className="list-disc space-y-2 pl-5">
          <li>demandes commerciales : 3 ans après le dernier contact ;</li>
          <li>comptes et données de production : pendant la durée du contrat, puis suppression selon le DPA et les obligations légales ;</li>
          <li>journaux de sécurité : 12 mois maximum, sauf incident ;</li>
          <li>factures : 10 ans conformément aux obligations comptables.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Destinataires et sous-traitants">
        <p>
          Les données sont accessibles aux personnes habilitées de BL-Host et aux sous-traitants nécessaires
          à l’hébergement, à la sauvegarde, à la messagerie, au paiement et au support.
        </p>
        <dl className="mt-2">
          <LegalField label="Hébergement et messagerie">
            {LEGAL_INFO.host.name}, {LEGAL_INFO.host.address}
          </LegalField>
          <LegalField label="CDN du panel">
            {LEGAL_INFO.cdn.name}, {LEGAL_INFO.cdn.address}
          </LegalField>
        </dl>
        <p>
          Le panel <code className="rounded bg-black/25 px-1.5 py-0.5 text-[11px] text-fg/80">chicago.bl-host.site</code>{" "}
          peut être diffusé via Cloudflare. Cloudflare, Inc. est basée aux États-Unis et adhère au Data
          Privacy Framework (UE–États-Unis). Les autres prestataires sont situés dans l’Union européenne.
        </p>
      </LegalSection>

      <LegalSection title="Transferts hors Union européenne">
        <p>
          L’hébergement principal est situé en France. Lorsque le panel utilise Cloudflare, les requêtes
          peuvent transiter par son réseau international. Ce transfert est encadré par le Data Privacy
          Framework et, le cas échéant, par les clauses contractuelles types de la Commission européenne.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander à exercer les droits suivants en écrivant à{" "}
          <a
            href={`mailto:${LEGAL_INFO.contactEmail}`}
            className="font-medium text-primary-300 underline-offset-4 transition hover:text-primary-200 hover:underline"
          >
            {LEGAL_INFO.contactEmail}
          </a>{" "}
          :
        </p>
        <ul className="list-disc space-y-2 pl-5">
          {RIGHTS.map((right) => (
            <li key={right}>{right}</li>
          ))}
        </ul>
        <p>
          Une réponse est apportée dans un délai d’un mois, prolongeable de deux mois pour les demandes
          complexes. Une preuve d’identité peut être demandée en cas de doute raisonnable.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL :{" "}
          <LegalLink href="https://www.cnil.fr">www.cnil.fr</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Le site public n’utilise pas de cookies publicitaires ni d’analytics. Le panel utilise un cookie
          de session strictement nécessaire à l’authentification,{" "}
          <code className="rounded bg-black/25 px-1.5 py-0.5 text-[11px] text-fg/80">fdm_session</code>,
          HttpOnly et SameSite=Lax. Il est supprimé à la déconnexion ou à l’expiration de la session.
        </p>
        <p>
          Aucun consentement n’est requis pour ce cookie essentiel. Aucun autre cookie n’est déposé par le
          site public.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          BL-Host met en œuvre des mesures techniques et organisationnelles adaptées : contrôle d’accès,
          2FA pour les administrateurs, chiffrement des secrets d’intégration, journalisation, sauvegardes,
          mises à jour de sécurité et procédure de notification des violations.
        </p>
      </LegalSection>

      <LegalSection title="Modifications">
        <p>
          Cette politique peut être mise à jour pour refléter une évolution du service ou de la
          réglementation. La date de dernière mise à jour figure en haut de page. Les modifications
          substantielles seront signalées aux utilisateurs concernés lorsque la loi l’exige.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question relative à cette politique ou pour exercer vos droits :{" "}
          <a
            href={`mailto:${LEGAL_INFO.contactEmail}`}
            className="font-medium text-primary-300 underline-offset-4 transition hover:text-primary-200 hover:underline"
          >
            {LEGAL_INFO.contactEmail}
          </a>
          .
        </p>
        <p className="text-xs text-muted">
          Aucun délégué à la protection des données (DPO) n’est désigné à ce stade. Si un DPO est nommé,
          ses coordonnées seront ajoutées ici.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
