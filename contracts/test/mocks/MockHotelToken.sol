// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockHotelToken is ERC20 {
    constructor() ERC20("HOTEL", "HOTEL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
