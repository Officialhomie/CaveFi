// lib/xmtp.ts
import { Client, Identifier, Signer } from "@xmtp/browser-sdk";

export class XMTPManager {
  private client: Client | null = null;
  private signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }

  async initialize(): Promise<Client> {
    if (this.client) return this.client;

    this.client = await Client.create(this.signer, {
      env: "production",
      dbEncryptionKey: new Uint8Array(32), // Generate consistent key
      dbPath: "./xmtp_db",
    });

    return this.client;
  }

  async createGroup(memberAddresses: string[], groupName: string) {
    const client = await this.initialize();
    
    // Verify addresses can receive messages
    const canMessageResult = await Client.canMessage(memberAddresses);
    
    const validAddresses = memberAddresses.filter((_, i) => canMessageResult[i]);

    return await client.conversations.newGroup(validAddresses, {
      groupName,
      permissions: {
        addMemberPolicy: "admin_only",
        removeMemberPolicy: "admin_only",
        updateMetadataPolicy: "admin_only",
      }
    });
  }
}