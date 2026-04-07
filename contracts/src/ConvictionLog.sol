// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IAgentRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function agentCount() external view returns (uint256);
}

/// @title ConvictionLog — Multi-agent reputation protocol on 0G Chain
/// @notice Any INFT holder can log strikes. Per-agent + global reputation tracked on-chain.
contract ConvictionLog is Ownable2Step, Pausable {

    error InvalidConvergence();
    error InvalidStrikeId();
    error OutcomeAlreadyFilled();
    error OutcomeOutOfRange();
    error ZeroAddress();
    error ZeroHash();
    error NotAgentOwner();
    error INFTNotSet();
    error INFTAlreadySet();
    error InvalidAgentId();

    // 4 storage slots per strike
    // slot 0: token(20) + convergence(1) + outcomeFilled(1)
    // slot 1: evidenceHash(32)
    // slot 2: chainId(8) + timestamp(6) + outcomeBps(16)
    // slot 3: agentId(32)
    struct Strike {
        address token;
        uint8   convergence;
        bool    outcomeFilled;
        bytes32 evidenceHash;
        uint64  chainId;
        uint48  timestamp;
        int128  outcomeBps;
        uint256 agentId;
    }

    // Per-agent reputation (2 slots)
    // slot 0: strikeCount(8) + totalFilled(8) + wins(8) + losses(8)
    // slot 1: totalReturnBps(16)
    struct AgentReputation {
        uint64 strikeCount;
        uint64 totalFilled;
        uint64 wins;
        uint64 losses;
        int128 totalReturnBps;
    }

    Strike[] internal _strikes;

    // Global reputation cache
    uint64  public totalStrikes;
    uint64  public totalFilled;
    uint64  public wins;
    uint64  public losses;
    int128  public totalReturnBps;

    // Per-agent reputation
    mapping(uint256 => AgentReputation) internal _agentRep;

    // Agent registry (MusashiINFT) — set once after both deployed
    IAgentRegistry public inft;
    bool private _inftSet;

    event StrikeLogged(uint256 indexed id, uint256 indexed agentId, address indexed token, uint64 chainId, uint8 convergence, bytes32 evidenceHash);
    event OutcomeRecorded(uint256 indexed id, uint256 indexed agentId, int128 returnBps);
    event INFTSet(address indexed inftAddress);

    constructor() Ownable(msg.sender) {}

    /// @notice Set the INFT contract address (one-time, after both contracts deployed)
    function setINFT(address _inft) external onlyOwner {
        if (_inft == address(0)) revert ZeroAddress();
        if (_inftSet) revert INFTAlreadySet();
        inft = IAgentRegistry(_inft);
        _inftSet = true;
        emit INFTSet(_inft);
    }

    /// @notice Log a conviction STRIKE. Caller must own the specified agent INFT.
    function logStrike(
        uint256 _agentId,
        address _token,
        uint64  _chainId,
        uint8   _convergence,
        bytes32 _evidenceHash
    ) external whenNotPaused returns (uint256 id) {
        if (!_inftSet) revert INFTNotSet();
        if (_token == address(0)) revert ZeroAddress();
        if (_evidenceHash == bytes32(0)) revert ZeroHash();
        if (_convergence < 3 || _convergence > 4) revert InvalidConvergence();
        if (_agentId >= inft.agentCount()) revert InvalidAgentId();
        if (inft.ownerOf(_agentId) != msg.sender) revert NotAgentOwner();

        id = _strikes.length;
        _strikes.push(Strike({
            token:         _token,
            convergence:   _convergence,
            outcomeFilled: false,
            evidenceHash:  _evidenceHash,
            chainId:       _chainId,
            timestamp:     uint48(block.timestamp),
            outcomeBps:    0,
            agentId:       _agentId
        }));

        // Update global + per-agent strike count
        unchecked { ++totalStrikes; }
        _agentRep[_agentId].strikeCount++;

        emit StrikeLogged(id, _agentId, _token, _chainId, _convergence, _evidenceHash);
    }

    /// @notice Record outcome for a STRIKE. Only contract owner (outcomes are objective facts).
    function recordOutcome(uint256 _id, int128 _returnBps) external onlyOwner whenNotPaused {
        if (_id >= _strikes.length) revert InvalidStrikeId();
        if (_returnBps < -10_000 || _returnBps > 1_000_000) revert OutcomeOutOfRange();

        Strike storage s = _strikes[_id];
        if (s.outcomeFilled) revert OutcomeAlreadyFilled();

        s.outcomeBps = _returnBps;
        s.outcomeFilled = true;

        uint256 agentId = s.agentId;

        // Global reputation
        unchecked {
            ++totalFilled;
            if (_returnBps > 0) ++wins;
            else if (_returnBps < 0) ++losses;
        }
        totalReturnBps += _returnBps;

        // Per-agent reputation
        AgentReputation storage rep = _agentRep[agentId];
        unchecked {
            ++rep.totalFilled;
            if (_returnBps > 0) ++rep.wins;
            else if (_returnBps < 0) ++rep.losses;
        }
        rep.totalReturnBps += _returnBps;

        emit OutcomeRecorded(_id, agentId, _returnBps);
    }

    function getStrike(uint256 _id) external view returns (Strike memory) {
        if (_id >= _strikes.length) revert InvalidStrikeId();
        return _strikes[_id];
    }

    function strikeCount() external view returns (uint256) {
        return _strikes.length;
    }

    /// @notice Global reputation across all agents
    function reputation() external view returns (
        uint256 total, uint256 w, uint256 l, int256 totalReturn
    ) {
        return (totalFilled, wins, losses, totalReturnBps);
    }

    /// @notice Per-agent reputation
    function agentReputation(uint256 _agentId) external view returns (
        uint256 strikes, uint256 filled, uint256 w, uint256 l, int256 totalReturn
    ) {
        AgentReputation storage rep = _agentRep[_agentId];
        return (rep.strikeCount, rep.totalFilled, rep.wins, rep.losses, rep.totalReturnBps);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
