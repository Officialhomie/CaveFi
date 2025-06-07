// components/ProposalCard.tsx
'use client'

import { useState } from 'react';
import { castVote } from '@/app/actions/proposals';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';

interface ProposalCardProps {
  proposal: {
    id: string;
    title: string;
    description?: string;
    options: string[];
    voting_deadline: string;
    status: string;
  };
  userVote?: {
    option_index: number;
  };
}

export function ProposalCard({ proposal, userVote }: ProposalCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(
    userVote?.option_index ?? null
  );
  const [isVoting, setIsVoting] = useState(false);
  
  // Real-time vote updates
  const { data: votes } = useSupabaseRealtime({
    table: 'votes',
    filter: `proposal_id.eq.${proposal.id}`,
  });

  const handleVote = async (optionIndex: number) => {
    if (isVoting || selectedOption !== null) return;

    setIsVoting(true);
    try {
      const result = await castVote(proposal.id, optionIndex);
      if (result.success) {
        setSelectedOption(optionIndex);
      }
    } finally {
      setIsVoting(false);
    }
  };

  const voteCounts = votes?.reduce((acc: Record<number, number>, vote: any) => {
    acc[vote.option_index] = (acc[vote.option_index] || 0) + 1;
    return acc;
  }, {}) || {};

  const totalVotes = Object.values(voteCounts).reduce((sum: number, count: number) => sum + count, 0);
  const isExpired = new Date(proposal.voting_deadline) < new Date();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {proposal.title}
        </h3>
        {proposal.description && (
          <p className="text-gray-600 text-sm">{proposal.description}</p>
        )}
      </div>

      <div className="space-y-3">
        {proposal.options.map((option, index) => {
          const voteCount = voteCounts[index] || 0;
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
          const isSelected = selectedOption === index;

          return (
            <div key={index} className="relative">
              <button
                onClick={() => handleVote(index)}
                disabled={isVoting || selectedOption !== null || isExpired}
                className={`w-full text-left p-3 rounded-md border-2 transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{option}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {voteCount} votes ({percentage.toFixed(1)}%)
                    </span>
                    {isSelected && (
                      <span className="text-blue-600 text-sm font-medium">✓ Voted</span>
                    )}
                  </div>
                </div>
                
                {/* Vote progress bar */}
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
        <span>Total votes: {totalVotes}</span>
        <span>
          Deadline: {new Date(proposal.voting_deadline).toLocaleDateString()}
          {isExpired && <span className="text-red-500 ml-2">(Expired)</span>}
        </span>
      </div>
    </div>
  );
}