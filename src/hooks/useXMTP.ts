// hooks/useXMTP.ts
'use client'

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { XMTPManager } from '@/lib/xmtp';

export const useXMTP = () => {
  const { address, isConnected } = useAccount();
  const [xmtpManager, setXMTPManager] = useState<XMTPManager | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    if (!isConnected || !address) return;

    const initXMTP = async () => {
      try {
        const signer = {
          getAddress: () => address,
          signMessage: async (message: string) => {
            // Implement wallet signing
            return await window.ethereum.request({ // Property 'ethereum' does not exist on type 'Window & typeof globalThis'.ts(2339)

              method: 'personal_sign',
              params: [message, address],
            });
          },
        };

        const manager = new XMTPManager(signer); // Argument of type '{ getAddress: () => `0x${string}`; signMessage: (message: string) => Promise<any>; }' is not assignable to parameter of type 'Signer'.
        await manager.initialize();
        setXMTPManager(manager);
        setIsReady(true);
      } catch (error) {
        console.error('XMTP initialization failed:', error);
      }
    };

    initXMTP();
  }, [address, isConnected]);

  const createGroup = useCallback(async (members: string[], name: string) => {
    if (!xmtpManager) return null;
    
    try {
      const group = await xmtpManager.createGroup(members, name);
      setGroups(prev => [...prev, group]);
      return group;
    } catch (error) {
      console.error('Group creation failed:', error);
      throw error;
    }
  }, [xmtpManager]);

  return {
    xmtpManager,
    isReady,
    groups,
    createGroup,
  };
};