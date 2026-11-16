/**
 * Etat temps reel de la plateforme, partage entre le serveur et le client.
 *
 * Une seule source de verite : le panel Pterodactyl (API HTTP), le flux Wings
 * (WebSocket console) et SFTP. Tous les modules lisent ce meme objet afin de
 * ne jamais afficher des statuts contradictoires.
 */

export interface LiveStatusPanel {
  configured: boolean;
  reachable: boolean;
  state: string | null;
  error: string | null;
  serverName: string | null;
}

export interface LiveStatusWings {
  state: string;
  connected: boolean;
  subscribers: number;
  host: string | null;
  lastError: string | null;
}

export interface LiveStatus {
  at: string;
  panel: LiveStatusPanel;
  wings: LiveStatusWings;
  sftp: { configured: boolean };
}
