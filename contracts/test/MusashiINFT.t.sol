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

    bytes32 constant CONFIG = keccak256("musashi-config-v1");
    bytes32 constant INTEL = keccak256("prompts-v1");

    function setUp() public {
        clog = new ConvictionLog();
        inft = new MusashiINFT(address(clog));
        clog.setINFT(address(inft));
    }

    // forge test --match-test testMintAgent -vvv
    function testMintAgent() public {
        console.log(">> mint: basic agent minting");

        uint256 id = inft.mint("MUSASHI", CONFIG, INTEL);
        assertEq(id, 0);
        assertEq(inft.agentCount(), 1);

        MusashiINFT.AgentToken memory agent = inft.getAgent(0);
        assertEq(agent.owner, address(this));
        assertEq(agent.configHash, CONFIG);
        assertEq(agent.intelligenceHash, INTEL);
        assertTrue(agent.active);
        assertEq(agent.winRate, 0);
        assertEq(agent.totalStrikes, 0);

        console.log("[PASS] agent #%d minted, owner=%s", id, agent.owner);
    }

    // forge test --match-test testMintRejectsEmptyName -vvv
    function testMintRejectsEmptyName() public {
        console.log(">> mint: rejects empty name");

        vm.expectRevert(MusashiINFT.EmptyName.selector);
        inft.mint("", CONFIG, INTEL);

        console.log("[PASS] empty name correctly rejected");
    }

    // forge test --match-test testMintRejectsZeroHash -vvv
    function testMintRejectsZeroHash() public {
        console.log(">> mint: rejects zero hashes");

        vm.expectRevert(MusashiINFT.ZeroHash.selector);
        inft.mint("MUSASHI", bytes32(0), INTEL);

        vm.expectRevert(MusashiINFT.ZeroHash.selector);
        inft.mint("MUSASHI", CONFIG, bytes32(0));

        console.log("[PASS] zero configHash and zero intelligenceHash both rejected");
    }

    // forge test --match-test testOwnerOf -vvv
    function testOwnerOf() public {
        console.log(">> ownerOf: returns correct agent owner");

        inft.mint("MUSASHI", CONFIG, INTEL);
        assertEq(inft.ownerOf(0), address(this));

        inft.transfer(0, user1);
        assertEq(inft.ownerOf(0), user1);

        console.log("[PASS] ownerOf returns correct owner before and after transfer");
    }

    // forge test --match-test testOwnerOfInvalidToken -vvv
    function testOwnerOfInvalidToken() public {
        console.log(">> ownerOf: rejects invalid token ID");

        vm.expectRevert(MusashiINFT.InvalidTokenId.selector);
        inft.ownerOf(0);

        console.log("[PASS] ownerOf(0) on empty array rejected");
    }

    // forge test --match-test testTransferAgent -vvv
    function testTransferAgent() public {
        console.log(">> transfer: ownership transfer");

        inft.mint("MUSASHI", CONFIG, INTEL);
        inft.transfer(0, user1);

        MusashiINFT.AgentToken memory agent = inft.getAgent(0);
        assertEq(agent.owner, user1);

        uint256[] memory tokens = inft.getOwnerTokens(user1);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], 0);

        uint256[] memory oldTokens = inft.getOwnerTokens(address(this));
        assertEq(oldTokens.length, 0);

        console.log("[PASS] agent transferred to %s, old owner list empty", user1);
    }

    // forge test --match-test testTransferRejectsZeroAddress -vvv
    function testTransferRejectsZeroAddress() public {
        console.log(">> transfer: rejects address(0)");

        inft.mint("MUSASHI", CONFIG, INTEL);
        vm.expectRevert(MusashiINFT.ZeroAddress.selector);
        inft.transfer(0, address(0));

        console.log("[PASS] transfer to zero address rejected");
    }

    // forge test --match-test testOnlyAgentOwnerCanTransfer -vvv
    function testOnlyAgentOwnerCanTransfer() public {
        console.log(">> transfer: non-owner blocked");

        inft.mint("MUSASHI", CONFIG, INTEL);
        vm.prank(user1);
        vm.expectRevert(MusashiINFT.NotAgentOwner.selector);
        inft.transfer(0, user1);

        console.log("[PASS] non-owner %s blocked from transferring", user1);
    }

    // forge test --match-test testUpdateIntelligence -vvv
    function testUpdateIntelligence() public {
        console.log(">> updateIntelligence: sync reputation from ConvictionLog");

        inft.mint("MUSASHI", CONFIG, INTEL);

        // Log strikes as agent #0 owner (this contract owns agent #0)
        clog.logStrike(0, address(0x1234), 1, 4, keccak256("ev1"));
        clog.logStrike(0, address(0x5678), 56, 3, keccak256("ev2"));
        clog.recordOutcome(0, 2000);
        console.log("  logged 2 strikes for agent #0, 1 win (+20%%)");

        bytes32 newHash = keccak256("v2-improved");
        inft.updateIntelligence(0, newHash);

        MusashiINFT.AgentToken memory agent = inft.getAgent(0);
        assertEq(agent.intelligenceHash, newHash);
        assertEq(agent.totalStrikes, 2);  // per-agent strike count
        assertEq(agent.winRate, 10000);   // 1 win / 1 filled = 100%

        console.log("[PASS] intelligence updated, strikes=%d winRate=%d bps", agent.totalStrikes, agent.winRate);
    }

    // forge test --match-test testUpdateIntelligencePerAgentNotGlobal -vvv
    function testUpdateIntelligencePerAgentNotGlobal() public {
        console.log(">> updateIntelligence: uses per-agent reputation, not global");

        inft.mint("AGENT_A", CONFIG, INTEL); // agent #0
        inft.mint("AGENT_B", CONFIG, INTEL); // agent #1
        inft.transfer(1, user1);

        // Agent #0 logs 1 strike, gets a win
        clog.logStrike(0, address(0x1111), 1, 4, keccak256("a-ev1"));
        clog.recordOutcome(0, 3000);

        // Agent #1 logs 1 strike, gets a loss
        vm.prank(user1);
        clog.logStrike(1, address(0x2222), 56, 3, keccak256("b-ev1"));
        clog.recordOutcome(1, -500);

        // Update agent #1 intelligence — should reflect agent #1 rep only
        vm.prank(user1);
        inft.updateIntelligence(1, keccak256("b-v2"));

        MusashiINFT.AgentToken memory agentB = inft.getAgent(1);
        assertEq(agentB.totalStrikes, 1);
        assertEq(agentB.winRate, 0); // 0 wins / 1 filled = 0%

        // Update agent #0 intelligence — should reflect agent #0 rep only
        inft.updateIntelligence(0, keccak256("a-v2"));
        MusashiINFT.AgentToken memory agentA = inft.getAgent(0);
        assertEq(agentA.totalStrikes, 1);
        assertEq(agentA.winRate, 10000); // 1 win / 1 filled = 100%

        console.log("[PASS] per-agent reputation is independent: A=100%% win, B=0%% win");
    }

    // forge test --match-test testUpdateIntelligenceRejectsZeroHash -vvv
    function testUpdateIntelligenceRejectsZeroHash() public {
        console.log(">> updateIntelligence: rejects zero hash");

        inft.mint("MUSASHI", CONFIG, INTEL);
        vm.expectRevert(MusashiINFT.ZeroHash.selector);
        inft.updateIntelligence(0, bytes32(0));

        console.log("[PASS] zero intelligence hash rejected");
    }

    // forge test --match-test testAuthorizeUsage -vvv
    function testAuthorizeUsage() public {
        console.log(">> authorizeUsage: O(1) mapping-based auth");

        inft.mint("MUSASHI", CONFIG, INTEL);
        inft.authorizeUsage(0, user1, 3600, keccak256("read-only"));

        assertTrue(inft.isAuthorized(0, user1));
        assertFalse(inft.isAuthorized(0, user2));

        console.log("[PASS] user1 authorized, user2 not authorized");
    }

    // forge test --match-test testAuthorizationExpires -vvv
    function testAuthorizationExpires() public {
        console.log(">> authorizeUsage: expiration check");

        inft.mint("MUSASHI", CONFIG, INTEL);
        inft.authorizeUsage(0, user1, 3600, keccak256("perms"));

        vm.warp(block.timestamp + 3599);
        assertTrue(inft.isAuthorized(0, user1));
        console.log("  t+3599s: still authorized");

        vm.warp(block.timestamp + 2);
        assertFalse(inft.isAuthorized(0, user1));
        console.log("  t+3601s: expired");

        console.log("[PASS] authorization expires correctly after duration");
    }

    // forge test --match-test testRevokeUsage -vvv
    function testRevokeUsage() public {
        console.log(">> revokeUsage: immediate revocation");

        inft.mint("MUSASHI", CONFIG, INTEL);
        inft.authorizeUsage(0, user1, 3600, keccak256("perms"));
        assertTrue(inft.isAuthorized(0, user1));

        inft.revokeUsage(0, user1);
        assertFalse(inft.isAuthorized(0, user1));

        console.log("[PASS] authorization revoked immediately");
    }

    // forge test --match-test testGetAuthorization -vvv
    function testGetAuthorization() public {
        console.log(">> getAuthorization: returns full auth details");

        inft.mint("MUSASHI", CONFIG, INTEL);
        bytes32 permsHash = keccak256("read-only");
        inft.authorizeUsage(0, user1, 3600, permsHash);

        MusashiINFT.UsageAuth memory auth = inft.getAuthorization(0, user1);
        assertEq(auth.executor, user1);
        assertEq(auth.permissionsHash, permsHash);

        console.log("[PASS] auth details match: executor=%s", auth.executor);
    }

    // forge test --match-test testCloneAgent -vvv
    function testCloneAgent() public {
        console.log(">> clone: creates copy with same intelligence");

        inft.mint("MUSASHI", CONFIG, INTEL);

        uint256 cloneId = inft.clone(0, user1);
        assertEq(cloneId, 1);
        assertEq(inft.agentCount(), 2);

        MusashiINFT.AgentToken memory cloned = inft.getAgent(1);
        assertEq(cloned.owner, user1);
        assertEq(cloned.configHash, CONFIG);
        assertEq(cloned.intelligenceHash, INTEL);
        assertEq(cloned.totalStrikes, 0);
        assertEq(cloned.winRate, 0);

        console.log("[PASS] clone #%d created for %s, fresh reputation", cloneId, user1);
    }

    // forge test --match-test testCloneRejectsZeroAddress -vvv
    function testCloneRejectsZeroAddress() public {
        console.log(">> clone: rejects address(0)");

        inft.mint("MUSASHI", CONFIG, INTEL);
        vm.expectRevert(MusashiINFT.ZeroAddress.selector);
        inft.clone(0, address(0));

        console.log("[PASS] clone to zero address rejected");
    }

    // forge test --match-test testPauseBlocksMint -vvv
    function testPauseBlocksMint() public {
        console.log(">> pause: blocks mint");

        inft.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        inft.mint("MUSASHI", CONFIG, INTEL);

        console.log("[PASS] mint blocked during pause");
    }

    // forge test --match-test testPauseBlocksTransfer -vvv
    function testPauseBlocksTransfer() public {
        console.log(">> pause: blocks transfer");

        inft.mint("MUSASHI", CONFIG, INTEL);
        inft.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        inft.transfer(0, user1);

        console.log("[PASS] transfer blocked during pause");
    }

    // forge test --match-test testGetAgentInvalidId -vvv
    function testGetAgentInvalidId() public {
        console.log(">> getAgent: rejects invalid token ID");

        vm.expectRevert(MusashiINFT.InvalidTokenId.selector);
        inft.getAgent(0);

        console.log("[PASS] getAgent(0) on empty array rejected");
    }

    // forge test --match-test testConstructorRejectsZeroConvictionLog -vvv
    function testConstructorRejectsZeroConvictionLog() public {
        console.log(">> constructor: rejects zero ConvictionLog address");

        vm.expectRevert(MusashiINFT.ZeroAddress.selector);
        new MusashiINFT(address(0));

        console.log("[PASS] zero address ConvictionLog rejected");
    }

    // forge test --match-test testOwnerTrackingAfterMultipleTransfers -vvv
    function testOwnerTrackingAfterMultipleTransfers() public {
        console.log(">> ownerTracking: O(1) swap-and-pop removal");

        inft.mint("A1", CONFIG, INTEL);
        inft.mint("A2", CONFIG, INTEL);
        inft.mint("A3", CONFIG, INTEL);
        console.log("  minted 3 agents: [0, 1, 2]");

        inft.transfer(1, user1);
        console.log("  transferred #1 to user1");

        uint256[] memory myTokens = inft.getOwnerTokens(address(this));
        assertEq(myTokens.length, 2);
        assertEq(myTokens[0], 0);
        assertEq(myTokens[1], 2);
        console.log("  owner tokens after transfer: [%d, %d]", myTokens[0], myTokens[1]);

        uint256[] memory u1Tokens = inft.getOwnerTokens(user1);
        assertEq(u1Tokens.length, 1);
        assertEq(u1Tokens[0], 1);
        console.log("  user1 tokens: [%d]", u1Tokens[0]);

        console.log("[PASS] O(1) swap-and-pop owner tracking works correctly");
    }
}
