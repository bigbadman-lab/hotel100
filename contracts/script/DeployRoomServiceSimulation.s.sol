// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {RoomService} from "../src/RoomService.sol";
import {MockPonsFeeEscrow} from "../test/mocks/MockPonsFeeEscrow.sol";
import {MockHotelToken} from "../test/mocks/MockHotelToken.sol";

/**
 * @notice Local/no-broadcast deployment simulation for Check-In production gate.
 * @dev Uses ephemeral local addresses only. Does NOT read or invent production keys.
 *      Run: forge script script/DeployRoomServiceSimulation.s.sol --use ../.solc/solc-0.8.28
 *      Never pass --broadcast in this gate.
 */
contract DeployRoomServiceSimulation is Script {
    function run() external {
        // Deterministic local simulation keys — NOT production.
        uint256 ownerPk = 0xA01;
        uint256 entitlementPk = 0xA11CE;
        uint256 eligibilityPk = 0xC1A11;

        address owner = vm.addr(ownerPk);
        address entitlementSigner = vm.addr(entitlementPk);
        address eligibilitySigner = vm.addr(eligibilityPk);

        require(entitlementSigner != eligibilitySigner, "signers must differ");
        require(owner != entitlementSigner && owner != eligibilitySigner, "owner distinct");

        MockHotelToken hotel = new MockHotelToken();
        MockPonsFeeEscrow escrow = new MockPonsFeeEscrow();

        vm.startBroadcast(ownerPk);
        RoomService roomService = new RoomService(
            address(hotel),
            address(escrow),
            owner,
            entitlementSigner,
            eligibilitySigner
        );
        vm.stopBroadcast();

        console2.log("RoomService", address(roomService));
        console2.log("owner", roomService.owner());
        console2.log("entitlementSigner", roomService.entitlementSigner());
        console2.log("eligibilitySigner", roomService.eligibilitySigner());
        console2.log("CHECK_IN_DURATION", uint256(roomService.CHECK_IN_DURATION()));
        console2.log("checkInsPaused", roomService.checkInsPaused());
        require(roomService.CHECK_IN_DURATION() == 3600, "duration");
        require(roomService.owner() == owner, "owner");
        require(roomService.entitlementSigner() == entitlementSigner, "entitlement");
        require(roomService.eligibilitySigner() == eligibilitySigner, "eligibility");
        require(!roomService.checkInsPaused(), "check-ins should start unpaused");
    }
}
