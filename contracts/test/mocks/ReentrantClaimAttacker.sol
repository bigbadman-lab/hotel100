// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RoomService} from "../../src/RoomService.sol";

/// @dev Reenters claimRoomService on ETH receive.
contract ReentrantClaimAttacker {
    RoomService public immutable roomService;
    bytes public signature;
    uint256 public cumulativeEntitlement;
    uint256 public deadline;
    uint256 public epoch;
    bool public attacking;

    constructor(RoomService roomService_) {
        roomService = roomService_;
    }

    function setClaim(
        uint256 cumulativeEntitlement_,
        uint256 deadline_,
        uint256 epoch_,
        bytes memory signature_
    ) external {
        cumulativeEntitlement = cumulativeEntitlement_;
        deadline = deadline_;
        epoch = epoch_;
        signature = signature_;
    }

    function attack() external {
        attacking = true;
        roomService.claimRoomService(cumulativeEntitlement, deadline, epoch, signature);
        attacking = false;
    }

    receive() external payable {
        if (attacking) {
            roomService.claimRoomService(cumulativeEntitlement, deadline, epoch, signature);
        }
    }
}
