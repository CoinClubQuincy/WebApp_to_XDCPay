// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../../contracts/LoginToken.sol";

contract LoginTokenTest is Test {
    address owner = makeAddr("owner");
    address other = makeAddr("other");
    LoginTokenExample token;

    function setUp() public {
        vm.prank(owner);
        token = new LoginTokenExample();
    }

    function test_DeployerHoldsTheOnlyToken() public {
        assertEq(token.balanceOf(owner, token.LoginToken()), 1);
        assertEq(token.balanceOf(other, token.LoginToken()), 0);
    }

    function test_HolderCanLogIn() public {
        vm.prank(owner);
        assertTrue(token.checkLogin());
    }

    function test_OthersAreRefused() public {
        vm.prank(other);
        vm.expectRevert("require Login token to login");
        token.checkLogin();
    }

    function test_LoginMovesWithTheToken() public {
        vm.prank(owner);
        token.safeTransferFrom(owner, other, 0, 1, "");

        vm.prank(other);
        assertTrue(token.checkLogin());

        vm.prank(owner);
        vm.expectRevert("require Login token to login");
        token.checkLogin();
    }

    // src/wallet.ts sends this selector, so the web app breaks if it changes.
    function test_SelectorMatchesTheWebApp() public {
        assertEq(LoginTokenExample.checkLogin.selector, SELECTOR);
    }

    bytes4 constant SELECTOR = 0x3221ff8a;
}
