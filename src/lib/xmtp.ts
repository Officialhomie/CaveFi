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
    const canMessageResult = await Client.canMessage(memberAddresses); // Argument of type 'string[]' is not assignable to parameter of type 'Identifier[]'. Type 'string' is not assignable to type 'Identifier'.ts(2345)
    
    const validAddresses = memberAddresses.filter((_, i) => canMessageResult[i]); // Element implicitly has an 'any' type because expression of type 'number' can't be used to index type 'Map<string, boolean>'. No index signature with a parameter of type 'number' was found on type 'Map<string, boolean>'.ts(18046)

    return await client.conversations.newGroup(validAddresses, {
      groupName,
      permissions: { // Type '{ addMemberPolicy: string; removeMemberPolicy: string; updateMetadataPolicy: string; }' is not assignable to type 'GroupPermissionsOptions | undefined'.ts(2322)
        addMemberPolicy: "admin_only",
        removeMemberPolicy: "admin_only",
        updateMetadataPolicy: "admin_only",
      }
    });
  }
}