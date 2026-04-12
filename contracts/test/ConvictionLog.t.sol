// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConvictionLog.sol";
import "../src/MusashiINFT.sol";

contract ConvictionLogTest is Test {
    ConvictionLog public clog;
    MusashiINFT public inft;
    address public attacker = address(0xdead);

    bytes32 constant ROOT = keccak256("0g-storage-root-v1");
    bytes32 constant META = keccak256("descriptor");
    bytes constant SEAL = hex"00112233445566778899aabbccddeeff";

    uint256 internal oraclePk = 0xA11CE;

    function setUp() public {
        clog = new ConvictionLog();
        inft = new MusashiINFT(address(clog));
        clog.setINFT(address(inft));
        inft.setOracle(vm.addr(oraclePk));
        inft.mint("MUSASHI", ROOT, META, SEAL); // agent #0
    }

    // Helper: produce an oracle-signed transfer proof for the new INFT API.
    function _sealProof(uint256 tokenId, uint16 version, bytes32 oldRoot, bytes32 newRoot, address to)
        internal
        view
        returns (bytes memory)
    {
        bytes32 inner = inft.transferDigest(tokenId, version, oldRoot, newRoot, to);
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, prefixed);
        return abi.encodePacked(r, s, v);
    }

    // ─── Basic Strike Logging ───

    // forge test --match-test testLogStrike -vvv
    function testLogStrike() public {
        console.log(">> logStrike: basic strike logging (multi-agent)");

        address token = address(0x1234);
        bytes32 evidence = keccak256("test evidence");

        uint256 id = clog.logStrike(0, token, 1, 4, evidence);
        assertEq(id, 0);
        assertEq(clog.strikeCount(), 1);

        ConvictionLog.Strike memory s = clog.getStrike(0);
        assertEq(s.token, token);
        assertEq(s.chainId, 1);
        assertEq(s.convergence, 4);
        assertEq(s.evidenceHash, evidence);
        assertEq(s.agentId, 0);
        assertFalse(s.outcomeFilled);
        assertEq(s.timestamp, uint48(block.timestamp));

        console.log("[PASS] strike #%d logged for agent #0, token=%s, convergence=%d", id, s.token, s.convergence);
    }

    // forge test --match-test testLogMultipleStrikes -vvv
    function testLogMultipleStrikes() public {
        console.log(">> logStrike: multiple strikes across chains");

        clog.logStrike(0, address(0x1), 1, 3, keccak256("a"));
        clog.logStrike(0, address(0x2), 56, 4, keccak256("b"));
        clog.logStrike(0, address(0x3), 8453, 3, keccak256("c"));
        assertEq(clog.strikeCount(), 3);

        console.log("[PASS] 3 strikes logged across ETH/BSC/Base for agent #0");
    }

    // ─── Convergence Validation ───

    // forge test --match-test testConvergenceRejectsBelow3 -vvv
    function testConvergenceRejectsBelow3() public {
        console.log(">> logStrike: rejects convergence < 3");

        vm.expectRevert(ConvictionLog.InvalidConvergence.selector);
        clog.logStrike(0, address(0x1), 1, 2, keccak256("x"));

        console.log("[PASS] convergence=2 correctly rejected");
    }

    // forge test --match-test testConvergenceRejectsAbove4 -vvv
    function testConvergenceRejectsAbove4() public {
        console.log(">> logStrike: rejects convergence > 4");

        vm.expectRevert(ConvictionLog.InvalidConvergence.selector);
        clog.logStrike(0, address(0x1), 1, 5, keccak256("x"));

        console.log("[PASS] convergence=5 correctly rejected");
    }

    // forge test --match-test testConvergenceAccepts3And4 -vvv
    function testConvergenceAccepts3And4() public {
        console.log(">> logStrike: accepts convergence 3 and 4");

        clog.logStrike(0, address(0x1), 1, 3, keccak256("a"));
        clog.logStrike(0, address(0x1), 1, 4, keccak256("b"));
        assertEq(clog.strikeCount(), 2);

        console.log("[PASS] convergence 3 and 4 both accepted");
    }

    // ─── Outcome Recording ───

    // forge test --match-test testRecordOutcome -vvv
    function testRecordOutcome() public {
        console.log(">> recordOutcome: basic outcome recording");

        clog.logStrike(0, address(0x1), 1, 4, keccak256("e"));
        clog.recordOutcome(0, 1500);

        ConvictionLog.Strike memory s = clog.getStrike(0);
        assertTrue(s.outcomeFilled);
        assertEq(s.outcomeBps, 1500);

        console.log("[PASS] outcome +15%% recorded for strike #0");
    }

    // forge test --match-test testCannotDoubleRecordOutcome -vvv
    function testCannotDoubleRecordOutcome() public {
        console.log(">> recordOutcome: rejects double recording");

        clog.logStrike(0, address(0x1), 1, 4, keccak256("e"));
        clog.recordOutcome(0, 1500);

        vm.expectRevert(ConvictionLog.OutcomeAlreadyFilled.selector);
        clog.recordOutcome(0, -500);

        console.log("[PASS] double record correctly rejected");
    }

    // forge test --match-test testRecordOutcomeInvalidId -vvv
    function testRecordOutcomeInvalidId() public {
        console.log(">> recordOutcome: rejects invalid strike ID");

        vm.expectRevert(ConvictionLog.InvalidStrikeId.selector);
        clog.recordOutcome(0, 100);

        console.log("[PASS] invalid ID correctly rejected");
    }

    // forge test --match-test testNegativeOutcome -vvv
    function testNegativeOutcome() public {
        console.log(">> recordOutcome: handles negative bps");

        clog.logStrike(0, address(0x1), 1, 4, keccak256("e"));
        clog.recordOutcome(0, -10000);

        ConvictionLog.Strike memory s = clog.getStrike(0);
        assertEq(s.outcomeBps, -10000);

        console.log("[PASS] -100%% outcome stored correctly");
    }

    // ─── Global Reputation ───

    // forge test --match-test testReputationCachedIncrementally -vvv
    function testReputationCachedIncrementally() public {
        console.log(">> reputation: incremental global cache updates");

        clog.logStrike(0, address(0x1), 1, 4, keccak256("a"));
        clog.logStrike(0, address(0x2), 56, 3, keccak256("b"));
        clog.logStrike(0, address(0x3), 8453, 4, keccak256("c"));

        (uint256 total, uint256 w, uint256 l, int256 ret) = clog.reputation();
        assertEq(total, 0);
        console.log("  before outcomes: total=%d wins=%d losses=%d", total, w, l);

        clog.recordOutcome(0, 2000);
        (total, w, l, ret) = clog.reputation();
        assertEq(total, 1);
        assertEq(w, 1);
        console.log("  after win: total=%d wins=%d ret=%d bps", total, w, uint256(ret));

        clog.recordOutcome(1, -500);
        (total, w, l, ret) = clog.reputation();
        assertEq(total, 2);
        assertEq(w, 1);
        assertEq(l, 1);
        assertEq(ret, 1500);
        console.log("  after loss: total=%d wins=%d losses=%d", total, w, l);

        console.log("[PASS] global reputation cached correctly after each outcome");
    }

    // ─── Per-Agent Reputation ───

    // forge test --match-test testAgentReputation -vvv
    function testAgentReputation() public {
        console.log(">> agentReputation: per-agent reputation tracking");

        clog.logStrike(0, address(0x1), 1, 4, keccak256("a"));
        clog.logStrike(0, address(0x2), 56, 3, keccak256("b"));

        (uint256 strikes, uint256 filled, uint256 w, uint256 l, int256 ret) = clog.agentReputation(0);
        assertEq(strikes, 2);
        assertEq(filled, 0);
        console.log("  agent #0 before outcomes: strikes=%d filled=%d", strikes, filled);

        clog.recordOutcome(0, 2000);
        (strikes, filled, w, l, ret) = clog.agentReputation(0);
        assertEq(strikes, 2);
        assertEq(filled, 1);
        assertEq(w, 1);
        assertEq(ret, 2000);
        console.log("  agent #0 after win: filled=%d wins=%d ret=%d bps", filled, w, uint256(ret));

        clog.recordOutcome(1, -300);
        (strikes, filled, w, l, ret) = clog.agentReputation(0);
        assertEq(strikes, 2);
        assertEq(filled, 2);
        assertEq(w, 1);
        assertEq(l, 1);
        assertEq(ret, 1700);
        console.log("  agent #0 after loss: filled=%d wins=%d losses=%d", filled, w, l);

        console.log("[PASS] per-agent reputation tracked correctly");
    }

    // ─── Multi-Agent: Second Agent, Different Owner ───

    // forge test --match-test testSecondAgentDifferentOwner -vvv
    function testSecondAgentDifferentOwner() public {
        console.log(">> multi-agent: second agent with different owner can log strikes");

        address agent1Owner = address(0xBEEF);

        // Transfer agent #0 to keep it, mint agent #1 and transfer to agent1Owner
        bytes32 newRoot = keccak256("0g-storage-root-v2");
        bytes memory newSeal = hex"ffeeddccbbaa99887766554433221100";
        inft.mint("AGENT_TWO", ROOT, META, SEAL); // agent #1
        bytes memory proof = _sealProof(1, 1, ROOT, newRoot, agent1Owner);
        inft.transfer(1, agent1Owner, newRoot, newSeal, proof);

        // agent1Owner logs a strike for agent #1
        vm.prank(agent1Owner);
        uint256 id = clog.logStrike(1, address(0xAAAA), 8453, 4, keccak256("agent1-ev"));
        assertEq(id, 0);

        ConvictionLog.Strike memory s = clog.getStrike(0);
        assertEq(s.agentId, 1);
        assertEq(s.token, address(0xAAAA));
        console.log("  agent1Owner logged strike #%d for agent #1", id);

        // This contract (owner of agent #0) also logs
        uint256 id2 = clog.logStrike(0, address(0xBBBB), 1, 3, keccak256("agent0-ev"));
        assertEq(id2, 1);

        ConvictionLog.Strike memory s2 = clog.getStrike(1);
        assertEq(s2.agentId, 0);
        console.log("  test contract logged strike #%d for agent #0", id2);

        // Check per-agent reputation is separate
        (uint256 strikes0,,,,) = clog.agentReputation(0);
        (uint256 strikes1,,,,) = clog.agentReputation(1);
        assertEq(strikes0, 1);
        assertEq(strikes1, 1);

        // Global strike count = 2
        assertEq(clog.strikeCount(), 2);

        console.log("[PASS] two agents, different owners, independent reputation");
    }

    // ─── Access Control: INFT Ownership ───

    // forge test --match-test testNonINFTOwnerCannotLogStrike -vvv
    function testNonINFTOwnerCannotLogStrike() public {
        console.log(">> access: non-INFT-owner cannot logStrike");

        vm.prank(attacker);
        vm.expectRevert(ConvictionLog.NotAgentOwner.selector);
        clog.logStrike(0, address(0x1), 1, 4, keccak256("x"));

        console.log("[PASS] attacker %s blocked from logging (NotAgentOwner)", attacker);
    }

    // forge test --match-test testInvalidAgentIdReverts -vvv
    function testInvalidAgentIdReverts() public {
        console.log(">> access: invalid agent ID reverts");

        vm.expectRevert(ConvictionLog.InvalidAgentId.selector);
        clog.logStrike(999, address(0x1), 1, 4, keccak256("x"));

        console.log("[PASS] invalid agentId=999 correctly rejected");
    }

    // forge test --match-test testOnlyOwnerCanRecordOutcome -vvv
    function testOnlyOwnerCanRecordOutcome() public {
        console.log(">> access: non-owner cannot recordOutcome");

        clog.logStrike(0, address(0x1), 1, 4, keccak256("x"));

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        clog.recordOutcome(0, 100);

        console.log("[PASS] attacker blocked from recording outcome");
    }

    // ─── setINFT: One-Time Setter ───

    // forge test --match-test testSetINFTCannotBeCalledTwice -vvv
    function testSetINFTCannotBeCalledTwice() public {
        console.log(">> setINFT: cannot be called twice");

        // setUp already called setINFT once
        vm.expectRevert(ConvictionLog.INFTAlreadySet.selector);
        clog.setINFT(address(0x9999));

        console.log("[PASS] second setINFT correctly rejected (INFTAlreadySet)");
    }

    // forge test --match-test testLogStrikeFailsWithoutINFT -vvv
    function testLogStrikeFailsWithoutINFT() public {
        console.log(">> setINFT: logStrike fails if INFT not set");

        // Deploy a fresh ConvictionLog without calling setINFT
        ConvictionLog freshClog = new ConvictionLog();

        vm.expectRevert(ConvictionLog.INFTNotSet.selector);
        freshClog.logStrike(0, address(0x1), 1, 4, keccak256("x"));

        console.log("[PASS] logStrike reverts with INFTNotSet on fresh contract");
    }

    // ─── Pausable ───

    // forge test --match-test testPauseBlocksLogStrike -vvv
    function testPauseBlocksLogStrike() public {
        console.log(">> pausable: logStrike blocked when paused");

        clog.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        clog.logStrike(0, address(0x1), 1, 4, keccak256("x"));

        console.log("[PASS] logStrike blocked during pause");
    }

    // forge test --match-test testUnpauseResumes -vvv
    function testUnpauseResumes() public {
        console.log(">> pausable: unpause resumes operations");

        clog.pause();
        clog.unpause();
        clog.logStrike(0, address(0x1), 1, 4, keccak256("x"));
        assertEq(clog.strikeCount(), 1);

        console.log("[PASS] operations resumed after unpause");
    }

    // ─── View Functions ───

    // forge test --match-test testGetStrikeInvalidId -vvv
    function testGetStrikeInvalidId() public {
        console.log(">> getStrike: rejects invalid ID");

        vm.expectRevert(ConvictionLog.InvalidStrikeId.selector);
        clog.getStrike(0);

        console.log("[PASS] getStrike(0) on empty array rejected");
    }
}
