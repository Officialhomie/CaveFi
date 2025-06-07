// lib/contentTypes.ts
import { ContentTypeId } from "@xmtp/content-type-primitives";
import type { ContentCodec, EncodedContent } from "@xmtp/content-type-primitives";

export const ContentTypeProposal = new ContentTypeId({
  authorityId: 'groupfi.app',
  typeId: 'proposal',
  versionMajor: 1,
  versionMinor: 0,
});

export interface Proposal {
  id: string;
  title: string;
  description: string;
  options: string[];
  deadline: Date;
  proposalType: 'investment' | 'governance' | 'treasury';
  metadata?: Record<string, any>;
}

export class  ProposalCodec implements ContentCodec<Proposal> { // Class 'ProposalCodec' incorrectly implements interface 'ContentCodec<Proposal>'. Property 'shouldPush' is missing in type 'ProposalCodec' but required in type 'ContentCodec<Proposal>'.ts(2420)
  get contentType(): ContentTypeId {
    return ContentTypeProposal;
  }

  encode(proposal: Proposal): EncodedContent {
    return {
      type: ContentTypeProposal,
      parameters: {},
      content: new TextEncoder().encode(JSON.stringify({
        ...proposal,
        deadline: proposal.deadline.toISOString(),
      })),
    };
  }

  decode(content: EncodedContent): Proposal {
    const data = JSON.parse(new TextDecoder().decode(content.content));
    return {
      ...data,
      deadline: new Date(data.deadline),
    };
  }

  fallback(content: Proposal): string {
    return `📋 Proposal: ${content.title}\n${content.description}\nOptions: ${content.options.join(' | ')}\nDeadline: ${content.deadline.toLocaleDateString()}`;
  }
}

// Vote Content Type
export const ContentTypeVote = new ContentTypeId({
  authorityId: 'groupfi.app',
  typeId: 'vote',
  versionMajor: 1,
  versionMinor: 0,
});

export interface Vote {
  proposalId: string;
  selectedOption: number;
  voterAddress: string;
  weight: number;
  timestamp: Date;
}

export class VoteCodec implements ContentCodec<Vote> { // Class 'VoteCodec' incorrectly implements interface 'ContentCodec<Vote>'. Property 'shouldPush' is missing in type 'VoteCodec' but required in type 'ContentCodec<Vote>'.ts(2420)
  get contentType(): ContentTypeId {
    return ContentTypeVote;
  }

  encode(vote: Vote): EncodedContent {
    return {
      type: ContentTypeVote,
      parameters: {},
      content: new TextEncoder().encode(JSON.stringify({
        ...vote,
        timestamp: vote.timestamp.toISOString(),
      })),
    };
  }

  decode(content: EncodedContent): Vote {
    const data = JSON.parse(new TextDecoder().decode(content.content));
    return {
      ...data,
      timestamp: new Date(data.timestamp),
    };
  }

  fallback(content: Vote): string {
    return `🗳️ Vote cast for proposal ${content.proposalId}`;
  }
}