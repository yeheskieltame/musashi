// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConvictionLog.sol";
import "../src/MusashiINFT.sol";

contract MusashiINFTTest is Test {
    ConvictionLog public clog;
    MusashiINFT public inft;

    address public user1 = address(0xBEEF);
    address public user2 = address(0xCAFE);

    uint256 internal oraclePk = 0xA11CE;
    address internal oracleAddr;

    bytes32 constant ROOT_V1 = keccak256("0g-storage-root-v1");
    bytes32 constant ROOT_V2 = keccak256("0g-storage-root-v2");
    bytes32 constant ROOT_V3 = keccak256("0g-storage-root-v3");
    bytes32 constant META = keccak256("public-descriptor");
    bytes constant SEAL_V1 = hex"00112233445566778899aabbccddeeff";
    bytes constant SEAL_V2 = hex"ffeeddccbbaa99887766554433221100";
    bytes constant SEAL_V3 = hex"deadbeefcafef00dbadc0ffee0ddf00d";

    function setUp() public {
        clog = new ConvictionLog();
        inft = new MusashiINFT(address(clog));
        clog.setINFT(address(inft));
        oracleAddr = vm.addr(oraclePk);
        inft.setOracle(oracleAddr);
    }

    // ─────────────────────────── helpers

    function _sign(uint256 tokenId, uint16 version, bytes32 oldRoot, bytes32 newRoot, address to)
        internal
        view
        returns (bytes memory)
    {
        bytes32 inner = inft.transferDigest(tokenId, version, oldRoot, newRoot, to);
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, prefixed);
        return abi.encodePacked(r, s, v);
    }

    // ─────────────────────────── mint

    function testMintAgent() public {
        uint256 id = inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        assertEq(id, 0);
        assertEq(inft.agentCount(), 1);

        MusashiINFT.AgentToken memory agent = inft.getAgent(0);
        assertEq(agent.owner, address(this));
        assertEq(agent.storageRoot, ROOT_V1);
        assertEq(agent.metadataHash, META);
        assertEq(agent.version, 1);
        assertTrue(agent.active);
        assertEq(inft.getSealedKey(0), SEAL_V1);
    }

    function testMintRejectsEmptyName() public {
        vm.expectRevert(MusashiINFT.EmptyName.selector);
        inft.mint("", ROOT_V1, META, SEAL_V1);
    }

    function testMintRejectsZeroRoot() public {
        vm.expectRevert(MusashiINFT.ZeroRoot.selector);
        inft.mint("MUSASHI", bytes32(0), META, SEAL_V1);
    }

    function testMintRejectsEmptySealedKey() public {
        vm.expectRevert(MusashiINFT.EmptySealedKey.selector);
        inft.mint("MUSASHI", ROOT_V1, META, "");
    }

    // ─────────────────────────── oracle admin

    function testSetOracle() public {
        address newOracle = address(0x5A17);
        inft.setOracle(newOracle);
        assertEq(inft.oracle(), newOracle);
    }

    function testSetOracleRejectsZero() public {
        vm.expectRevert(MusashiINFT.ZeroAddress.selector);
        inft.setOracle(address(0));
    }

    // ─────────────────────────── transfer (ERC-7857 sealed)

    function testTransferWithOracleProof() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        bytes memory proof = _sign(0, 1, ROOT_V1, ROOT_V2, user1);

        inft.transfer(0, user1, ROOT_V2, SEAL_V2, proof);

        MusashiINFT.AgentToken memory agent = inft.getAgent(0);
        assertEq(agent.owner, user1);
        assertEq(agent.storageRoot, ROOT_V2);
        assertEq(agent.version, 2);
        assertEq(inft.getSealedKey(0), SEAL_V2);
    }

    function testTransferRejectsBadSignature() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        uint256 badPk = 0xB0B;
        bytes32 inner = inft.transferDigest(0, 1, ROOT_V1, ROOT_V2, user1);
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, prefixed);
        bytes memory badProof = abi.encodePacked(r, s, v);

        vm.expectRevert(MusashiINFT.BadOracleSignature.selector);
        inft.transfer(0, user1, ROOT_V2, SEAL_V2, badProof);
    }

    function testTransferRejectsStaleRoot() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        bytes memory proof = _sign(0, 1, ROOT_V1, ROOT_V1, user1);
        vm.expectRevert(MusashiINFT.StaleRoot.selector);
        inft.transfer(0, user1, ROOT_V1, SEAL_V2, proof);
    }

    function testTransferRejectsReplayAfterVersionBump() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        bytes memory proof1 = _sign(0, 1, ROOT_V1, ROOT_V2, user1);
        inft.transfer(0, user1, ROOT_V2, SEAL_V2, proof1);

        // user1 now owns the token at version 2 with storageRoot=ROOT_V2.
        // A proof forged against (tokenId=0, version=1, oldRoot=ROOT_V1, newRoot=ROOT_V3, to=user2)
        // would *not* match the current state (version=2, oldRoot=ROOT_V2), so the
        // signature check must fail. This isolates the version-based replay protection.
        bytes memory staleProof = _sign(0, 1, ROOT_V1, ROOT_V3, user2);
        vm.prank(user1);
        vm.expectRevert(MusashiINFT.BadOracleSignature.selector);
        inft.transfer(0, user2, ROOT_V3, SEAL_V3, staleProof);
    }

    function testTransferRejectsOracleNotSet() public {
        ConvictionLog clog2 = new ConvictionLog();
        MusashiINFT inft2 = new MusashiINFT(address(clog2));
        clog2.setINFT(address(inft2));
        inft2.mint("MUSASHI", ROOT_V1, META, SEAL_V1);

        vm.expectRevert(MusashiINFT.OracleNotSet.selector);
        inft2.transfer(0, user1, ROOT_V2, SEAL_V2, hex"00");
    }

    function testNonOwnerCannotTransfer() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        bytes memory proof = _sign(0, 1, ROOT_V1, ROOT_V2, user1);
        vm.prank(user1);
        vm.expectRevert(MusashiINFT.NotAgentOwner.selector);
        inft.transfer(0, user1, ROOT_V2, SEAL_V2, proof);
    }

    // ─────────────────────────── updateIntelligence

    function testUpdateIntelligenceSyncsReputation() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);

        clog.logStrike(0, address(0x1234), 1, 4, keccak256("ev1"));
        clog.recordOutcome(0, 2000);

        inft.updateIntelligence(0, ROOT_V2, SEAL_V2);

        MusashiINFT.AgentToken memory agent = inft.getAgent(0);
        assertEq(agent.storageRoot, ROOT_V2);
        assertEq(agent.version, 2);
        assertEq(agent.totalStrikes, 1);
        assertEq(agent.winRate, 10000);
        assertEq(inft.getSealedKey(0), SEAL_V2);
    }

    function testUpdateIntelligenceRejectsZeroRoot() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        vm.expectRevert(MusashiINFT.ZeroRoot.selector);
        inft.updateIntelligence(0, bytes32(0), SEAL_V2);
    }

    // ─────────────────────────── clone

    function testCloneWithOracleProof() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        bytes memory proof = _sign(0, 1, ROOT_V1, ROOT_V3, user1);

        uint256 newId = inft.clone(0, user1, ROOT_V3, SEAL_V3, proof);
        assertEq(newId, 1);

        MusashiINFT.AgentToken memory cloned = inft.getAgent(1);
        assertEq(cloned.owner, user1);
        assertEq(cloned.storageRoot, ROOT_V3);
        assertEq(cloned.version, 1);
        assertEq(inft.getSealedKey(1), SEAL_V3);

        // Original is untouched
        MusashiINFT.AgentToken memory orig = inft.getAgent(0);
        assertEq(orig.storageRoot, ROOT_V1);
        assertEq(orig.owner, address(this));
    }

    function testCloneRejectsBadProof() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        uint256 badPk = 0xB0B;
        bytes32 inner = inft.transferDigest(0, 1, ROOT_V1, ROOT_V3, user1);
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, prefixed);
        bytes memory badProof = abi.encodePacked(r, s, v);

        vm.expectRevert(MusashiINFT.BadOracleSignature.selector);
        inft.clone(0, user1, ROOT_V3, SEAL_V3, badProof);
    }

    // ─────────────────────────── usage auth

    function testAuthorizeAndRevoke() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        inft.authorizeUsage(0, user1, 3600, keccak256("perms"));
        assertTrue(inft.isAuthorized(0, user1));
        assertFalse(inft.isAuthorized(0, user2));

        inft.revokeUsage(0, user1);
        assertFalse(inft.isAuthorized(0, user1));
    }

    function testAuthorizationExpires() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        inft.authorizeUsage(0, user1, 3600, keccak256("perms"));

        vm.warp(block.timestamp + 3599);
        assertTrue(inft.isAuthorized(0, user1));
        vm.warp(block.timestamp + 2);
        assertFalse(inft.isAuthorized(0, user1));
    }

    // ─────────────────────────── views / pause

    function testOwnerOfTracksTransfers() public {
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
        assertEq(inft.ownerOf(0), address(this));

        bytes memory proof = _sign(0, 1, ROOT_V1, ROOT_V2, user1);
        inft.transfer(0, user1, ROOT_V2, SEAL_V2, proof);
        assertEq(inft.ownerOf(0), user1);
    }

    function testOwnerOfRejectsInvalid() public {
        vm.expectRevert(MusashiINFT.InvalidTokenId.selector);
        inft.ownerOf(0);
    }

    function testPauseBlocksMint() public {
        inft.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        inft.mint("MUSASHI", ROOT_V1, META, SEAL_V1);
    }

    function testConstructorRejectsZeroConvictionLog() public {
        vm.expectRevert(MusashiINFT.ZeroAddress.selector);
        new MusashiINFT(address(0));
    }

    function testOwnerTrackingAfterTransfer() public {
        inft.mint("A1", ROOT_V1, META, SEAL_V1);
        inft.mint("A2", ROOT_V1, META, SEAL_V1);
        inft.mint("A3", ROOT_V1, META, SEAL_V1);

        bytes memory proof = _sign(1, 1, ROOT_V1, ROOT_V2, user1);
        inft.transfer(1, user1, ROOT_V2, SEAL_V2, proof);

        uint256[] memory myTokens = inft.getOwnerTokens(address(this));
        assertEq(myTokens.length, 2);
        assertEq(myTokens[0], 0);
        assertEq(myTokens[1], 2);

        uint256[] memory u1Tokens = inft.getOwnerTokens(user1);
        assertEq(u1Tokens.length, 1);
        assertEq(u1Tokens[0], 1);
    }
}
