// hooks/useMessageStream.ts
'use client'

import { useEffect, useState, useCallback } from 'react';
import { useXMTP } from './useXMTP';
import { Proposal, Vote, ProposalCodec, VoteCodec } from '@/lib/contentTypes';

interface Message {
  id: string;
  senderAddress: string;
  content: any;
  contentType: string;
  timestamp: Date;
  conversationId: string;
}

export const useMessageStream = (groupId?: string) => {
  const { xmtpManager, isReady } = useXMTP();
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const processMessage = useCallback((message: any) => {
    const messageData: Message = {
      id: message.id,
      senderAddress: message.senderAddress,
      content: message.content,
      contentType: message.contentType?.typeId || 'text',
      timestamp: message.sent,
      conversationId: message.conversationId,
    };

    setMessages(prev => [...prev, messageData]);

    // Handle special content types
    if (message.contentType?.typeId === 'proposal') {
      const proposal = new ProposalCodec().decode(message);
      setProposals(prev => [...prev, proposal]);
    } else if (message.contentType?.typeId === 'vote') {
      const vote = new VoteCodec().decode(message);
      setVotes(prev => [...prev, vote]);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !xmtpManager) return;

    const startStreaming = async () => {
      setIsStreaming(true);
      
      try {
        const client = await xmtpManager.initialize();
        const stream = groupId 
          ? await client.conversations.getConversationById(groupId).then(c => c.streamMessages())
          : await client.conversations.streamAllMessages();

        for await (const message of stream) {
          if (message.senderAddress !== client.address) {
            processMessage(message);
          }
        }
      } catch (error) {
        console.error('Message streaming error:', error);
        setIsStreaming(false);
      }
    };

    startStreaming();

    return () => {
      setIsStreaming(false);
    };
  }, [isReady, xmtpManager, groupId, processMessage]);

  return {
    messages,
    proposals,
    votes,
    isStreaming,
  };
};