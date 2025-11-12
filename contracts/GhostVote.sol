// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title GhostVote - DAO Privacy Voting System
/// @author ghost-vote
/// @notice A DAO voting system with fully encrypted votes using FHEVM
/// @dev Votes are encrypted (0 = against, 1 = for), anyone can decrypt final results
contract GhostVote is SepoliaConfig {
    address public admin;
    
    struct Proposal {
        string title;
        string description;
        uint256 deadline;
        bool active;
        euint8 totalVotesFor;
        euint8 totalVotesAgainst;
        uint256 totalVoters;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalCreated(uint256 indexed proposalId, string title, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    event ProposalClosed(uint256 indexed proposalId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Create a new proposal (anyone can create)
    /// @param _title The title of the proposal
    /// @param _description The description of the proposal
    /// @param _durationInSeconds The duration of the voting period in seconds
    /// @return The ID of the newly created proposal
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _durationInSeconds
    ) external returns (uint256) {
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.title = _title;
        proposal.description = _description;
        proposal.deadline = block.timestamp + _durationInSeconds;
        proposal.active = true;
        proposal.totalVoters = 0;

        emit ProposalCreated(proposalId, _title, proposal.deadline);
        return proposalId;
    }

    /// @notice Cast an encrypted vote on a proposal
    /// @param _proposalId The ID of the proposal
    /// @param inputEuint8 The encrypted vote (0 = against, 1 = for)
    /// @param inputProof The input proof for encryption
    function vote(
        uint256 _proposalId,
        externalEuint8 inputEuint8,
        bytes calldata inputProof
    ) external {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.active, "Proposal is not active");
        require(block.timestamp < proposal.deadline, "Voting period has ended");
        require(!proposal.hasVoted[msg.sender], "You have already voted");

        euint8 encryptedVote = FHE.fromExternal(inputEuint8, inputProof);
        
        // Add vote to the appropriate counter
        // vote = 1 means FOR, vote = 0 means AGAINST
        proposal.totalVotesFor = FHE.add(proposal.totalVotesFor, encryptedVote);
        
        // Calculate AGAINST votes: if vote = 0, then (1 - vote) = 1
        euint8 one = FHE.asEuint8(1);
        euint8 voteAgainst = FHE.sub(one, encryptedVote);
        proposal.totalVotesAgainst = FHE.add(proposal.totalVotesAgainst, voteAgainst);

        proposal.hasVoted[msg.sender] = true;
        proposal.totalVoters++;

        // Allow this contract and the voter to decrypt the totals
        FHE.allowThis(proposal.totalVotesFor);
        FHE.allow(proposal.totalVotesFor, msg.sender);
        FHE.allowThis(proposal.totalVotesAgainst);
        FHE.allow(proposal.totalVotesAgainst, msg.sender);

        emit VoteCast(_proposalId, msg.sender);
    }
    
    /// @notice Request decryption access for vote totals (anyone can call)
    /// @param _proposalId The ID of the proposal
    function requestDecryptionAccess(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(_proposalId < proposalCount, "Proposal does not exist");
        
        // Grant decryption access to the caller
        FHE.allow(proposal.totalVotesFor, msg.sender);
        FHE.allow(proposal.totalVotesAgainst, msg.sender);
    }

    /// @notice Close a proposal (only admin)
    /// @param _proposalId The ID of the proposal
    function closeProposal(uint256 _proposalId) external onlyAdmin {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.active, "Proposal is already closed");
        
        proposal.active = false;
        emit ProposalClosed(_proposalId);
    }

    /// @notice Get encrypted vote totals for a proposal
    /// @param _proposalId The ID of the proposal
    /// @return totalFor The encrypted total votes for
    /// @return totalAgainst The encrypted total votes against
    function getVoteTotals(uint256 _proposalId) 
        external 
        view 
        returns (euint8 totalFor, euint8 totalAgainst) 
    {
        Proposal storage proposal = proposals[_proposalId];
        return (proposal.totalVotesFor, proposal.totalVotesAgainst);
    }

    /// @notice Get proposal details
    /// @param _proposalId The ID of the proposal
    /// @return title The proposal title
    /// @return description The proposal description
    /// @return deadline The voting deadline
    /// @return active Whether the proposal is active
    /// @return totalVoters The total number of voters
    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            string memory title,
            string memory description,
            uint256 deadline,
            bool active,
            uint256 totalVoters
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.title,
            proposal.description,
            proposal.deadline,
            proposal.active,
            proposal.totalVoters
        );
    }

    /// @notice Check if an address has voted on a proposal
    /// @param _proposalId The ID of the proposal
    /// @param _voter The address to check
    /// @return Whether the address has voted
    function hasVoted(uint256 _proposalId, address _voter) external view returns (bool) {
        return proposals[_proposalId].hasVoted[_voter];
    }

    /// @notice Transfer admin rights
    /// @param _newAdmin The new admin address
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }
}

