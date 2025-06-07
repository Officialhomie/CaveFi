export interface Group {
    id: string
    name: string
    description: string
    xmtpGroupId: string
    memberCount: number
    treasuryBalance: string
    createdAt: Date
  }
  
  export interface Proposal {
    id: string
    groupId: string
    title: string
    description: string
    proposer: string
    status: 'active' | 'passed' | 'rejected' | 'executed'
    votesFor: number
    votesAgainst: number
    quorum: number
    deadline: Date
    createdAt: Date
  }
  
  export interface Vote {
    id: string
    proposalId: string
    voter: string
    choice: boolean
    votingPower: number
    createdAt: Date
  }
  
  export interface XMTPMessage {
    id: string
    content: string
    sender: string
    timestamp: Date
    contentType: string
  }