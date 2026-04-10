// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ConvictionLog.sol";
import "../src/MusashiINFT.sol";

// NOTE: `forge script` does not support 0G Chain (chain ID 16661).
// Use `forge create` + `cast send` instead. See Makefile deploy targets.
// This script is kept as a reference for the deployment sequence.
contract DeployMusashi is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("OG_CHAIN_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        ConvictionLog convictionLog = new ConvictionLog();
        console.log("ConvictionLog:", address(convictionLog));

        MusashiINFT inft = new MusashiINFT(address(convictionLog));
        console.log("MusashiINFT:", address(inft));

        // Link ConvictionLog → MusashiINFT (one-time setter, resolves circular dependency)
        convictionLog.setINFT(address(inft));
        console.log("ConvictionLog.setINFT called with:", address(inft));

        vm.stopBroadcast();

        console.log("");
        console.log("=== SAVE THESE ===");
        console.log("CONVICTION_LOG_ADDRESS=%s", address(convictionLog));
        console.log("MUSASHI_INFT_ADDRESS=%s", address(inft));
        console.log("Explorer:");
        console.log("  https://chainscan.0g.ai/address/%s", address(convictionLog));
        console.log("  https://chainscan.0g.ai/address/%s", address(inft));
        console.log("");
        console.log("=== VERIFY COMMANDS ===");
        console.log("Run these after deployment:");
        console.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(convictionLog)),
                " ConvictionLog --verifier blockscout --verifier-url https://chainscan.0g.ai/open/api/"
            )
        );
        console.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(inft)),
                " MusashiINFT --verifier blockscout --verifier-url https://chainscan.0g.ai/open/api/ --constructor-args $(cast abi-encode \"constructor(address)\" ",
                vm.toString(address(convictionLog)),
                ")"
            )
        );
    }
}
