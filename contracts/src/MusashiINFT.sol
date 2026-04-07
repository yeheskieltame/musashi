// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ConvictionLog.sol";

// Intelligent NFT for MUSASHI Agent (ERC-7857 inspired)
// Tokenizes agent identity + reputation on 0G Chain.
// Packed storage, O(1) auth lookups, O(1) owner list removal.
contract MusashiINFT is Ownable2Step, Pausable, ReentrancyGuard {

    error InvalidTokenId();
    error NotAgentOwner();
    error ZeroAddress();
    error EmptyName();
    error ZeroHash();
    error DurationOverflow();
    error SelfTransfer();

    uint256 private constant BPS_SCALE = 10_000;

    // 4 slots + dynamic string
    // slot 0: owner(20) + active(1) + winRate(2) + convergenceAvg(1)
    // slot 1: configHash(32)
    // slot 2: intelligenceHash(32)
    // slot 3: totalStrikes(8) + createdAt(6) + updatedAt(6)
    struct AgentToken {
        address owner;
        bool    active;
        uint16  winRate;
        uint8   convergenceAvg;
        bytes32 configHash;
        bytes32 intelligenceHash;
        uint64  totalStrikes;
        uint48  createdAt;
        uint48  updatedAt;
        string  name;
    }

    // 2 slots: executor(20)+expiresAt(6) | permissionsHash(32)
    struct UsageAuth {
        address executor;
        uint48  expiresAt;
        bytes32 permissionsHash;
    }

    AgentToken[] internal _agents;
    ConvictionLog public immutable convictionLog;

    mapping(uint256 => mapping(address => UsageAuth)) internal _auths;
    mapping(address => uint256[]) internal _ownerTokens;
    mapping(address => mapping(uint256 => uint256)) internal _ownerTokenIndex;

    event AgentMinted(uint256 indexed id, address indexed owner, bytes32 configHash);
    event AgentTransferred(uint256 indexed id, address indexed from, address indexed to);
    event IntelligenceUpdated(uint256 indexed id, bytes32 newHash, uint64 totalStrikes, uint16 winRate);
    event UsageAuthorized(uint256 indexed id, address indexed executor, uint48 expiresAt);
    event UsageRevoked(uint256 indexed id, address indexed executor);
    event AgentCloned(uint256 indexed originalId, uint256 indexed newId, address indexed newOwner);

    modifier validToken(uint256 tokenId) {
        _checkValidToken(tokenId);
        _;
    }

    modifier onlyAgentOwner(uint256 tokenId) {
        _checkAgentOwner(tokenId);
        _;
    }

    function _checkValidToken(uint256 tokenId) internal view {
        if (tokenId >= _agents.length) revert InvalidTokenId();
    }

    function _checkAgentOwner(uint256 tokenId) internal view {
        if (tokenId >= _agents.length) revert InvalidTokenId();
        if (_agents[tokenId].owner != msg.sender) revert NotAgentOwner();
    }

    constructor(address _convictionLog) Ownable(msg.sender) {
        if (_convictionLog == address(0)) revert ZeroAddress();
        convictionLog = ConvictionLog(_convictionLog);
    }

    function mint(
        string calldata _name,
        bytes32 _configHash,
        bytes32 _intelligenceHash
    ) external onlyOwner whenNotPaused returns (uint256 id) {
        if (bytes(_name).length == 0) revert EmptyName();
        if (_configHash == bytes32(0)) revert ZeroHash();
        if (_intelligenceHash == bytes32(0)) revert ZeroHash();

        id = _agents.length;
        _agents.push(AgentToken({
            owner:            msg.sender,
            active:           true,
            winRate:          0,
            convergenceAvg:   0,
            configHash:       _configHash,
            intelligenceHash: _intelligenceHash,
            totalStrikes:     0,
            createdAt:        uint48(block.timestamp),
            updatedAt:        uint48(block.timestamp),
            name:             _name
        }));

        _addToOwnerList(msg.sender, id);
        emit AgentMinted(id, msg.sender, _configHash);
    }

    function transfer(
        uint256 tokenId,
        address to
    ) external onlyAgentOwner(tokenId) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (to == msg.sender) revert SelfTransfer();

        address from = _agents[tokenId].owner;
        _agents[tokenId].owner = to;
        _agents[tokenId].updatedAt = uint48(block.timestamp);

        _removeFromOwnerList(from, tokenId);
        _addToOwnerList(to, tokenId);

        emit AgentTransferred(tokenId, from, to);
    }

    // sync intelligence + reputation from ConvictionLog (CEI + nonReentrant)
    function updateIntelligence(
        uint256 tokenId,
        bytes32 _intelligenceHash
    ) external onlyAgentOwner(tokenId) nonReentrant whenNotPaused {
        if (_intelligenceHash == bytes32(0)) revert ZeroHash();

        AgentToken storage agent = _agents[tokenId];

        agent.intelligenceHash = _intelligenceHash;
        agent.updatedAt = uint48(block.timestamp);

        (uint256 agentStrikes, uint256 filled, uint256 w, , ) = convictionLog.agentReputation(tokenId);
        uint16 rate = filled > 0 ? uint16((w * BPS_SCALE) / filled) : 0;

        agent.totalStrikes = uint64(agentStrikes);
        agent.winRate = rate;

        emit IntelligenceUpdated(tokenId, _intelligenceHash, uint64(agentStrikes), rate);
    }

    function authorizeUsage(
        uint256 tokenId,
        address executor,
        uint48  duration,
        bytes32 permissionsHash
    ) external onlyAgentOwner(tokenId) {
        if (executor == address(0)) revert ZeroAddress();

        uint48 expiresAt = uint48(block.timestamp) + duration;
        if (expiresAt < uint48(block.timestamp)) revert DurationOverflow();
        _auths[tokenId][executor] = UsageAuth(executor, expiresAt, permissionsHash);

        emit UsageAuthorized(tokenId, executor, expiresAt);
    }

    function revokeUsage(
        uint256 tokenId,
        address executor
    ) external onlyAgentOwner(tokenId) {
        delete _auths[tokenId][executor];
        emit UsageRevoked(tokenId, executor);
    }

    function clone(
        uint256 tokenId,
        address newOwner
    ) external onlyAgentOwner(tokenId) whenNotPaused returns (uint256 newId) {
        if (newOwner == address(0)) revert ZeroAddress();

        AgentToken storage original = _agents[tokenId];
        newId = _agents.length;

        _agents.push(AgentToken({
            owner:            newOwner,
            active:           true,
            winRate:          0,
            convergenceAvg:   0,
            configHash:       original.configHash,
            intelligenceHash: original.intelligenceHash,
            totalStrikes:     0,
            createdAt:        uint48(block.timestamp),
            updatedAt:        uint48(block.timestamp),
            name:             original.name
        }));

        _addToOwnerList(newOwner, newId);
        emit AgentCloned(tokenId, newId, newOwner);
    }

    function isAuthorized(uint256 tokenId, address executor) external view returns (bool) {
        return _auths[tokenId][executor].expiresAt > block.timestamp;
    }

    function getAuthorization(uint256 tokenId, address executor) external view returns (UsageAuth memory) {
        return _auths[tokenId][executor];
    }

    function getAgent(uint256 tokenId) external view validToken(tokenId) returns (AgentToken memory) {
        return _agents[tokenId];
    }

    /// @notice Returns the owner of an agent token (for ConvictionLog integration)
    function ownerOf(uint256 tokenId) external view validToken(tokenId) returns (address) {
        return _agents[tokenId].owner;
    }

    function agentCount() external view returns (uint256) {
        return _agents.length;
    }

    function getOwnerTokens(address _owner) external view returns (uint256[] memory) {
        return _ownerTokens[_owner];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _addToOwnerList(address _owner, uint256 tokenId) internal {
        _ownerTokenIndex[_owner][tokenId] = _ownerTokens[_owner].length;
        _ownerTokens[_owner].push(tokenId);
    }

    // O(1) swap-and-pop
    function _removeFromOwnerList(address _owner, uint256 tokenId) internal {
        uint256[] storage list = _ownerTokens[_owner];
        uint256 idx = _ownerTokenIndex[_owner][tokenId];
        uint256 lastIdx = list.length - 1;

        if (idx != lastIdx) {
            uint256 lastTokenId = list[lastIdx];
            list[idx] = lastTokenId;
            _ownerTokenIndex[_owner][lastTokenId] = idx;
        }

        list.pop();
        delete _ownerTokenIndex[_owner][tokenId];
    }
}
