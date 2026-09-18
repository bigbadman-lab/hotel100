// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPonsFeeEscrow} from "../../src/interfaces/IPonsFeeEscrow.sol";

/**
 * @dev Gate C test mock only. Not a production Pons V2 escrow.
 * Holds ETH and tracks per-account claimable balances.
 */
contract MockPonsFeeEscrow is IPonsFeeEscrow {
    mapping(address => uint256) private _balances;

    error EthTransferFailed();

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /// @dev Test helper: credit `account` with `msg.value` claimable balance.
    function credit(address account) external payable {
        _balances[account] += msg.value;
    }

    function claim() external returns (uint256 claimedAmount) {
        claimedAmount = _balances[msg.sender];
        if (claimedAmount == 0) {
            return 0;
        }
        _balances[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: claimedAmount}("");
        if (!ok) revert EthTransferFailed();
    }
}
