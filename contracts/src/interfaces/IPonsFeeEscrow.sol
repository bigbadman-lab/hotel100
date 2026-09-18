// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPonsFeeEscrow
 * @notice Minimal Gate C interface assumption for Pons V2 Fee Escrow.
 * @dev Production Pons V2 binding is deferred (Gate I). Do not invent production addresses.
 *      If the real escrow API differs (method names / claim semantics), adapt the adapter only;
 *      RoomService must remain the direct creator-fee recipient.
 *
 * Assumed behavior used by RoomService.collectRoomService():
 * 1. `balanceOf(account)` returns claimable fee balance for `account` (wei).
 * 2. `claim()` claims all of `msg.sender`'s balance and sends ETH to `msg.sender`.
 */
interface IPonsFeeEscrow {
    function balanceOf(address account) external view returns (uint256);

    function claim() external returns (uint256 claimedAmount);
}
