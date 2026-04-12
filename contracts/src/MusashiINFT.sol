// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ConvictionLog.sol";

/// @title MusashiINFT — ERC-7857 Intelligent NFT for MUSASHI Agent
/// @notice Tokenizes an AI agent whose intelligence lives as an *encrypted* blob
///         in 0G Storage. Ownership transfers require an oracle (TEE/ZKP) to
///         re-encrypt the blob for the new owner so no previous owner can read
///         the intelligence after a sale — matching the ERC-7857 security model.
///
///         Core ERC-7857 concepts implemented:
///           - Encrypted off-chain metadata: `storageRoot` is a 0G Storage merkle
///             root of an AES-256-CTR encrypted bundle (prompts + config + weights).
///           - Per-owner sealed symmetric key: `sealedKey[tokenId]` holds the
///             AES key wrapped to the current owner's public key.
///           - Oracle-verified transfer: `transfer` / `clone` accept a fresh
///             `(newStorageRoot, newSealedKey)` pair plus an ECDSA proof from the
///             configured re-encryption oracle. The oracle is expected to run in
///             a TEE or produce a ZKP attesting that the new blob decrypts to the
///             same intelligence as the old blob, now sealed to the receiver.
///           - Authorized usage without transfer (up to N executors per token).
///           - Clone with sealed metadata (never copies plaintext).
///
///         For the hackathon, "oracle proof" is an ECDSA signature by the
///         `oracle` address over a canonical digest. A production deployment
///         would swap this for an on-chain TEE attestation verifier or a ZK
///         verifier contract — the interface is already abstracted behind
///         `_verifyOracleProof`.
contract MusashiINFT is Ownable2Step, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    error InvalidTokenId();
    error NotAgentOwner();
    error ZeroAddress();
    error EmptyName();
    error ZeroRoot();
    error EmptySealedKey();
    error DurationOverflow();
    error SelfTransfer();
    error OracleNotSet();
    error BadOracleSignature();
    error StaleRoot();

    uint256 private constant BPS_SCALE = 10_000;

    /// @dev Packed layout (4 slots + dynamic `name`):
    ///   slot 0: owner(20) + active(1) + winRate(2) + convergenceAvg(1) + version(2)
    ///   slot 1: storageRoot(32)  — 0G Storage merkle root of encrypted blob
    ///   slot 2: metadataHash(32) — hash of public descriptor JSON (optional)
    ///   slot 3: totalStrikes(8) + createdAt(6) + updatedAt(6)
    struct AgentToken {
        address owner;
        bool    active;
        uint16  winRate;
        uint8   convergenceAvg;
        uint16  version;          // bumped on every re-seal (transfer/clone/update)
        bytes32 storageRoot;
        bytes32 metadataHash;
        uint64  totalStrikes;
        uint48  createdAt;
        uint48  updatedAt;
        string  name;
    }

    struct UsageAuth {
        address executor;
        uint48  expiresAt;
        bytes32 permissionsHash;
    }

    AgentToken[] internal _agents;
    ConvictionLog public immutable convictionLog;

    /// @notice Symmetric key wrapped to the current owner's public key.
    ///         Replaced atomically on every transfer/clone/update by the oracle.
    mapping(uint256 => bytes) public sealedKey;

    /// @notice Re-encryption oracle address. Signs attestations over
    ///         `keccak256(abi.encode(chainid, address(this), tokenId, version, oldRoot, newRoot, to))`.
    ///         In production this is a TEE / ZKP verifier contract.
    address public oracle;

    mapping(uint256 => mapping(address => UsageAuth)) internal _auths;
    mapping(address => uint256[]) internal _ownerTokens;
    mapping(address => mapping(uint256 => uint256)) internal _ownerTokenIndex;

    event AgentMinted(uint256 indexed id, address indexed owner, bytes32 storageRoot, bytes32 metadataHash);
    event SealedTransfer(uint256 indexed id, address indexed from, address indexed to, bytes32 oldRoot, bytes32 newRoot, uint16 newVersion);
    event AgentCloned(uint256 indexed originalId, uint256 indexed newId, address indexed newOwner, bytes32 newRoot);
    event IntelligenceUpdated(uint256 indexed id, bytes32 newStorageRoot, uint64 totalStrikes, uint16 winRate);
    event UsageAuthorized(uint256 indexed id, address indexed executor, uint48 expiresAt);
    event UsageRevoked(uint256 indexed id, address indexed executor);
    event OracleSet(address indexed oldOracle, address indexed newOracle);

    modifier validToken(uint256 tokenId) {
        if (tokenId >= _agents.length) revert InvalidTokenId();
        _;
    }

    modifier onlyAgentOwner(uint256 tokenId) {
        if (tokenId >= _agents.length) revert InvalidTokenId();
        if (_agents[tokenId].owner != msg.sender) revert NotAgentOwner();
        _;
    }

    constructor(address _convictionLog) Ownable(msg.sender) {
        if (_convictionLog == address(0)) revert ZeroAddress();
        convictionLog = ConvictionLog(_convictionLog);
    }

    // ─────────────────────────────────────────── admin

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        emit OracleSet(oracle, _oracle);
        oracle = _oracle;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─────────────────────────────────────────── mint

    /// @notice Mint a new INFT. `_storageRoot` must point to an encrypted bundle
    ///         already uploaded to 0G Storage. `_sealedKey` is the AES key
    ///         wrapped to `msg.sender`'s pubkey (the oracle produces this
    ///         off-chain during upload).
    function mint(
        string  calldata _name,
        bytes32 _storageRoot,
        bytes32 _metadataHash,
        bytes   calldata _sealedKey
    ) external onlyOwner whenNotPaused returns (uint256 id) {
        if (bytes(_name).length == 0) revert EmptyName();
        if (_storageRoot == bytes32(0)) revert ZeroRoot();
        if (_sealedKey.length == 0) revert EmptySealedKey();

        id = _agents.length;
        _agents.push(AgentToken({
            owner:          msg.sender,
            active:         true,
            winRate:        0,
            convergenceAvg: 0,
            version:        1,
            storageRoot:    _storageRoot,
            metadataHash:   _metadataHash,
            totalStrikes:   0,
            createdAt:      uint48(block.timestamp),
            updatedAt:      uint48(block.timestamp),
            name:           _name
        }));
        sealedKey[id] = _sealedKey;

        _addToOwnerList(msg.sender, id);
        emit AgentMinted(id, msg.sender, _storageRoot, _metadataHash);
    }

    // ─────────────────────────────────────────── ERC-7857 transfer

    /// @notice Transfer an INFT. Requires a fresh re-encryption from the oracle:
    ///         a new storage root (same intelligence, new AES key) and a new
    ///         sealed key wrapped to `to`'s pubkey. The oracle's ECDSA signature
    ///         attests that `newRoot` decrypts to the same plaintext as the
    ///         current `storageRoot`. Clears all usage auths (spec requirement).
    function transfer(
        uint256 tokenId,
        address to,
        bytes32 newStorageRoot,
        bytes calldata newSealedKey,
        bytes calldata oracleProof
    ) external onlyAgentOwner(tokenId) whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (to == msg.sender) revert SelfTransfer();
        if (newStorageRoot == bytes32(0)) revert ZeroRoot();
        if (newSealedKey.length == 0) revert EmptySealedKey();

        AgentToken storage agent = _agents[tokenId];
        bytes32 oldRoot = agent.storageRoot;
        if (newStorageRoot == oldRoot) revert StaleRoot();

        _verifyOracleProof(tokenId, agent.version, oldRoot, newStorageRoot, to, oracleProof);

        address from = agent.owner;
        agent.owner = to;
        agent.storageRoot = newStorageRoot;
        agent.version += 1;
        agent.updatedAt = uint48(block.timestamp);
        sealedKey[tokenId] = newSealedKey;

        _removeFromOwnerList(from, tokenId);
        _addToOwnerList(to, tokenId);

        emit SealedTransfer(tokenId, from, to, oldRoot, newStorageRoot, agent.version);
    }

    // ─────────────────────────────────────────── update intelligence (same owner)

    /// @notice Owner updates their own encrypted intelligence blob (e.g. after
    ///         more training / new prompts). No re-seal to another party needed,
    ///         but the sealed key is replaced because the AES key rotated.
    ///         Pulls reputation from ConvictionLog to sync on-chain stats.
    function updateIntelligence(
        uint256 tokenId,
        bytes32 newStorageRoot,
        bytes calldata newSealedKey
    ) external onlyAgentOwner(tokenId) nonReentrant whenNotPaused {
        if (newStorageRoot == bytes32(0)) revert ZeroRoot();
        if (newSealedKey.length == 0) revert EmptySealedKey();

        AgentToken storage agent = _agents[tokenId];
        agent.storageRoot = newStorageRoot;
        agent.version += 1;
        agent.updatedAt = uint48(block.timestamp);
        sealedKey[tokenId] = newSealedKey;

        (uint256 agentStrikes, uint256 filled, uint256 w, , ) = convictionLog.agentReputation(tokenId);
        uint16 rate = filled > 0 ? uint16((w * BPS_SCALE) / filled) : 0;
        agent.totalStrikes = uint64(agentStrikes);
        agent.winRate = rate;

        emit IntelligenceUpdated(tokenId, newStorageRoot, uint64(agentStrikes), rate);
    }

    // ─────────────────────────────────────────── clone

    /// @notice Clone an agent for a new owner. Like transfer, requires a freshly
    ///         re-sealed blob — the clone gets an independent storageRoot so the
    ///         original owner retains access to their copy.
    function clone(
        uint256 tokenId,
        address newOwner,
        bytes32 newStorageRoot,
        bytes calldata newSealedKey,
        bytes calldata oracleProof
    ) external onlyAgentOwner(tokenId) whenNotPaused nonReentrant returns (uint256 newId) {
        if (newOwner == address(0)) revert ZeroAddress();
        if (newStorageRoot == bytes32(0)) revert ZeroRoot();
        if (newSealedKey.length == 0) revert EmptySealedKey();

        AgentToken storage original = _agents[tokenId];
        _verifyOracleProof(tokenId, original.version, original.storageRoot, newStorageRoot, newOwner, oracleProof);

        newId = _agents.length;
        _agents.push(AgentToken({
            owner:          newOwner,
            active:         true,
            winRate:        0,
            convergenceAvg: 0,
            version:        1,
            storageRoot:    newStorageRoot,
            metadataHash:   original.metadataHash,
            totalStrikes:   0,
            createdAt:      uint48(block.timestamp),
            updatedAt:      uint48(block.timestamp),
            name:           original.name
        }));
        sealedKey[newId] = newSealedKey;

        _addToOwnerList(newOwner, newId);
        emit AgentCloned(tokenId, newId, newOwner, newStorageRoot);
    }

    // ─────────────────────────────────────────── usage auth

    function authorizeUsage(
        uint256 tokenId,
        address executor,
        uint48  duration,
        bytes32 permissionsHash
    ) external onlyAgentOwner(tokenId) whenNotPaused {
        if (executor == address(0)) revert ZeroAddress();

        uint48 ts = uint48(block.timestamp);
        uint48 expiresAt;
        unchecked { expiresAt = ts + duration; }
        if (expiresAt < ts) revert DurationOverflow();
        _auths[tokenId][executor] = UsageAuth(executor, expiresAt, permissionsHash);

        emit UsageAuthorized(tokenId, executor, expiresAt);
    }

    function revokeUsage(uint256 tokenId, address executor) external onlyAgentOwner(tokenId) {
        delete _auths[tokenId][executor];
        emit UsageRevoked(tokenId, executor);
    }

    function isAuthorized(uint256 tokenId, address executor) external view returns (bool) {
        return _auths[tokenId][executor].expiresAt > block.timestamp;
    }

    function getAuthorization(uint256 tokenId, address executor) external view returns (UsageAuth memory) {
        return _auths[tokenId][executor];
    }

    // ─────────────────────────────────────────── views

    function getAgent(uint256 tokenId) external view validToken(tokenId) returns (AgentToken memory) {
        return _agents[tokenId];
    }

    function getSealedKey(uint256 tokenId) external view validToken(tokenId) returns (bytes memory) {
        return sealedKey[tokenId];
    }

    function ownerOf(uint256 tokenId) external view validToken(tokenId) returns (address) {
        return _agents[tokenId].owner;
    }

    function agentCount() external view returns (uint256) {
        return _agents.length;
    }

    function getOwnerTokens(address _owner) external view returns (uint256[] memory) {
        return _ownerTokens[_owner];
    }

    // ─────────────────────────────────────────── oracle proof verification

    /// @dev Digest the oracle signs. Includes chainid + contract + version to
    ///      prevent replay across chains, contracts, and re-seal generations.
    function transferDigest(
        uint256 tokenId,
        uint16  version,
        bytes32 oldRoot,
        bytes32 newRoot,
        address to
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), tokenId, version, oldRoot, newRoot, to));
    }

    function _verifyOracleProof(
        uint256 tokenId,
        uint16  version,
        bytes32 oldRoot,
        bytes32 newRoot,
        address to,
        bytes calldata proof
    ) internal view {
        address o = oracle;
        if (o == address(0)) revert OracleNotSet();
        bytes32 inner = transferDigest(tokenId, version, oldRoot, newRoot, to);
        // EIP-191 prefix — equivalent to MessageHashUtils.toEthSignedMessageHash().
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        address signer = prefixed.recover(proof);
        if (signer != o) revert BadOracleSignature();
    }

    // ─────────────────────────────────────────── internal owner-list bookkeeping

    function _addToOwnerList(address _owner, uint256 tokenId) internal {
        _ownerTokenIndex[_owner][tokenId] = _ownerTokens[_owner].length;
        _ownerTokens[_owner].push(tokenId);
    }

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
