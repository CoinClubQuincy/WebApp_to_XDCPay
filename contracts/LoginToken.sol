// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract LoginTokenExample is ERC1155 {
    uint256 public constant LoginToken = 0;

    constructor() ERC1155("Login Token Example") {
        _mint(msg.sender, LoginToken, 1, "");
    }

    modifier OnlyLogin() {
        require(balanceOf(msg.sender, LoginToken) >= 1, "require Login token to login");
        _;
    }

    function checkLogin() public view OnlyLogin returns (bool) {
        return true;
    }
}
