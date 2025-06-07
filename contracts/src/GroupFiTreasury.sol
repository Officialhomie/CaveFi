// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"; // Added for safe token transfers
import "@openzeppelin/contracts/utils/Pausable.sol"; // Added for emergency controls


contract GroupFiTreasury is AccessControlEnumerable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    enum ProposalState { Active, Succeeded, Defeated, Executed, Cancelled }
    enum VoteType { Against, For, Abstain }
    
    struct Proposal {
        uint256 id;
        string title;
        string description;
        address target;
        uint256 value;
        bytes data;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startTime;
        uint256 deadline;
        bool executed;
        bool cancelled;
        address proposer;
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) votes;
    }
    
    struct ProposalView {
        uint256 id;
        string title;
        string description;
        address target;
        uint256 value;
        bytes data;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startTime;
        uint256 deadline;
        bool executed;
        bool cancelled;
        address proposer;
        ProposalState state;
    }
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    uint256 public quorumPercentage = 51; // 51% quorum
    uint256 public constant MIN_PROPOSAL_DURATION = 1 days;
    uint256 public constant MAX_PROPOSAL_DURATION = 30 days;
    uint256 public minimumProposalValue = 0.01 ether;
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId, 
        address indexed proposer,
        string title,
        uint256 deadline
    );
    event VoteCast(
        uint256 indexed proposalId, 
        address indexed voter, 
        VoteType voteType,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event MinimumProposalValueUpdated(uint256 oldValue, uint256 newValue);
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EtherWithdrawn(address indexed to, uint256 amount);
    
    modifier proposalExists(uint256 proposalId) {
        require(proposalId < proposalCount, "Proposal does not exist");
        _;
    }
    
    modifier validProposalState(uint256 proposalId, ProposalState requiredState) {
        require(getProposalState(proposalId) == requiredState, "Invalid proposal state");
        _;
    }

    constructor(address[] memory initialMembers) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(MEMBER_ROLE, msg.sender);
        
        for (uint256 i = 0; i < initialMembers.length; i++) {
            _grantRole(MEMBER_ROLE, initialMembers[i]);
            emit MemberAdded(initialMembers[i]);
        }
    }
    
    // Proposal Management Functions
    function createProposal(
        string memory title,
        string memory description,
        address target,
        uint256 value,
        bytes memory data,
        uint256 duration
    ) external onlyRole(MEMBER_ROLE) whenNotPaused returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(duration >= MIN_PROPOSAL_DURATION, "Duration too short");
        require(duration <= MAX_PROPOSAL_DURATION, "Duration too long");
        require(value >= minimumProposalValue || value == 0, "Value below minimum");
        
        if (value > 0) {
            require(address(this).balance >= value, "Insufficient treasury balance");
        }
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.title = title;
        proposal.description = description;
        proposal.target = target;
        proposal.value = value;
        proposal.data = data;
        proposal.startTime = block.timestamp;
        proposal.deadline = block.timestamp + duration;
        proposal.proposer = msg.sender;
        
        emit ProposalCreated(proposalId, msg.sender, title, proposal.deadline);
        return proposalId;
    }
    
    function vote(uint256 proposalId, VoteType voteType) 
        external 
        onlyRole(MEMBER_ROLE) 
        whenNotPaused 
        proposalExists(proposalId)
        validProposalState(proposalId, ProposalState.Active)
    {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp < proposal.deadline, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = voteType;
        
        if (voteType == VoteType.For) {
            proposal.forVotes++;
        } else if (voteType == VoteType.Against) {
            proposal.againstVotes++;
        } else {
            proposal.abstainVotes++;
        }
        
        emit VoteCast(proposalId, msg.sender, voteType, 1);
    }
    
    function executeProposal(uint256 proposalId) 
        external 
        onlyRole(EXECUTOR_ROLE) 
        nonReentrant 
        whenNotPaused
        proposalExists(proposalId)
        validProposalState(proposalId, ProposalState.Succeeded)
    {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.deadline, "Voting still active");
        require(!proposal.executed, "Already executed");
        
        proposal.executed = true;
        
        if (proposal.value > 0 || proposal.data.length > 0) {
            (bool success, bytes memory returnData) = proposal.target.call{value: proposal.value}(proposal.data);
            require(success, string(abi.encodePacked("Execution failed: ", returnData)));
        }
        
        emit ProposalExecuted(proposalId);
    }
    
    function cancelProposal(uint256 proposalId) 
        external 
        proposalExists(proposalId)
    {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || hasRole(ADMIN_ROLE, msg.sender),
            "Only proposer or admin can cancel"
        );
        require(!proposal.executed, "Cannot cancel executed proposal");
        require(!proposal.cancelled, "Already cancelled");
        
        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }
    
    // View Functions
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (ProposalView memory) 
    {
        Proposal storage proposal = proposals[proposalId];
        return ProposalView({
            id: proposal.id,
            title: proposal.title,
            description: proposal.description,
            target: proposal.target,
            value: proposal.value,
            data: proposal.data,
            forVotes: proposal.forVotes,
            againstVotes: proposal.againstVotes,
            abstainVotes: proposal.abstainVotes,
            startTime: proposal.startTime,
            deadline: proposal.deadline,
            executed: proposal.executed,
            cancelled: proposal.cancelled,
            proposer: proposal.proposer,
            state: getProposalState(proposalId)
        });
    }
    
    function getProposalState(uint256 proposalId) 
        public 
        view 
        proposalExists(proposalId) 
        returns (ProposalState) 
    {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.cancelled) {
            return ProposalState.Cancelled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (block.timestamp < proposal.deadline) {
            return ProposalState.Active;
        }
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 memberCount = getRoleMemberCount(MEMBER_ROLE);
        uint256 quorum = (memberCount * quorumPercentage) / 100;
        
        if (totalVotes < quorum) {
            return ProposalState.Defeated;
        }
        
        if (proposal.forVotes > proposal.againstVotes) {
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }
    
    function hasVoted(uint256 proposalId, address voter) 
        external 
        view 
        proposalExists(proposalId) 
        returns (bool) 
    {
        return proposals[proposalId].hasVoted[voter];
    }
    
    function getVote(uint256 proposalId, address voter) 
        external 
        view 
        proposalExists(proposalId) 
        returns (VoteType) 
    {
        require(proposals[proposalId].hasVoted[voter], "Voter has not voted");
        return proposals[proposalId].votes[voter];
    }
    
    // Treasury Management Functions
    function withdrawEther(address payable to, uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        
        to.transfer(amount);
        emit EtherWithdrawn(to, amount);
    }
    
    function withdrawTokens(address token, address to, uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
        emit TokensWithdrawn(token, to, amount);
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    // Member Management Functions
    function addMember(address member) external onlyRole(ADMIN_ROLE) {
        require(member != address(0), "Invalid member address");
        _grantRole(MEMBER_ROLE, member);
        emit MemberAdded(member);
    }
    
    function removeMember(address member) external onlyRole(ADMIN_ROLE) {
        _revokeRole(MEMBER_ROLE, member);
        emit MemberRemoved(member);
    }
    
    function getMemberCount() external view returns (uint256) {
        return getRoleMemberCount(MEMBER_ROLE);
    }
    
    function isMember(address account) external view returns (bool) {
        return hasRole(MEMBER_ROLE, account);
    }
    
    // Governance Functions
    function updateQuorum(uint256 newQuorumPercentage) external onlyRole(ADMIN_ROLE) {
        require(newQuorumPercentage > 0 && newQuorumPercentage <= 100, "Invalid quorum percentage");
        uint256 oldQuorum = quorumPercentage;
        quorumPercentage = newQuorumPercentage;
        emit QuorumUpdated(oldQuorum, newQuorumPercentage);
    }
    
    function updateMinimumProposalValue(uint256 newMinimumValue) external onlyRole(ADMIN_ROLE) {
        uint256 oldValue = minimumProposalValue;
        minimumProposalValue = newMinimumValue;
        emit MinimumProposalValueUpdated(oldValue, newMinimumValue);
    }
    
    // Emergency Functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyWithdraw(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused(), "Contract must be paused");
        to.transfer(address(this).balance);
    }
    
    // Batch Operations
    function batchVote(uint256[] calldata proposalIds, VoteType[] calldata voteTypes) 
        external 
        onlyRole(MEMBER_ROLE) 
        whenNotPaused 
    {
        require(proposalIds.length == voteTypes.length, "Array length mismatch");
        
        for (uint256 i = 0; i < proposalIds.length; i++) {
            uint256 proposalId = proposalIds[i];
            VoteType voteType = voteTypes[i];
            
            // Check if proposal exists and is in valid state
            if (proposalId >= proposalCount) continue;
            if (getProposalState(proposalId) != ProposalState.Active) continue;
            
            Proposal storage proposal = proposals[proposalId];
            if (block.timestamp >= proposal.deadline) continue;
            if (proposal.hasVoted[msg.sender]) continue;
            
            // Cast the vote
            proposal.hasVoted[msg.sender] = true;
            proposal.votes[msg.sender] = voteType;
            
            if (voteType == VoteType.For) {
                proposal.forVotes++;
            } else if (voteType == VoteType.Against) {
                proposal.againstVotes++;
            } else {
                proposal.abstainVotes++;
            }
            
            emit VoteCast(proposalId, msg.sender, voteType, 1);
        }
    }
    
    // Receive and Fallback
    receive() external payable {
        // Allow contract to receive ETH
    }
    
    fallback() external payable {
        revert("Function not found");
    }
}