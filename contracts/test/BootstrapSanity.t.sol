// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BootstrapSanity} from "../src/BootstrapSanity.sol";

contract BootstrapSanityTest is Test {
    function test_frozenConstants() public {
        BootstrapSanity sanity = new BootstrapSanity();
        assertEq(sanity.HOTEL_ROOM_COUNT(), 100);
        assertEq(sanity.HOTEL_CHAIN_ID(), 4663);
    }
}
