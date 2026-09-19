// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {RoomService} from "../src/RoomService.sol";
import {MockPonsFeeEscrow} from "./mocks/MockPonsFeeEscrow.sol";
import {MockHotelToken} from "./mocks/MockHotelToken.sol";

contract RoomServiceCheckInTest is Test {
    uint256 internal constant ENTITLEMENT_SIGNER_PK = 0xA11CE;
    uint256 internal constant ELIGIBILITY_SIGNER_PK = 0xC1A11;
    uint256 internal constant WRONG_SIGNER_PK = 0xB0B;
    uint256 internal constant OWNER_PK = 0xA01;

    MockHotelToken internal hotel;
    MockPonsFeeEscrow internal escrow;
    RoomService internal roomService;

    address internal owner;
    address internal entitlementSigner;
    address internal eligibilitySigner;
    address internal guest;
    address internal stranger;

    function setUp() public {
        owner = vm.addr(OWNER_PK);
        entitlementSigner = vm.addr(ENTITLEMENT_SIGNER_PK);
        eligibilitySigner = vm.addr(ELIGIBILITY_SIGNER_PK);
        guest = makeAddr("guest");
        stranger = makeAddr("stranger");

        hotel = new MockHotelToken();
        escrow = new MockPonsFeeEscrow();

        vm.prank(owner);
        roomService = new RoomService(
            address(hotel), address(escrow), owner, entitlementSigner, eligibilitySigner
        );

        hotel.mint(guest, 1_000 ether);
    }

    function test_checkIn_validPartialEscrow() public {
        uint256 amount = 100 ether;
        uint256 minAmount = 10 ether;
        uint256 maxAmount = 500 ether;
        uint256 deadline = block.timestamp + 2 minutes;
        uint256 nonce = 1;

        _approve(guest, amount);
        bytes memory sig =
            _signAuth(ELIGIBILITY_SIGNER_PK, guest, minAmount, maxAmount, deadline, nonce, 1);

        vm.prank(guest);
        roomService.checkIn(amount, minAmount, maxAmount, deadline, nonce, 1, sig);

        (uint256 stayAmount, uint64 checkInTs, uint64 unlockTs) = roomService.getStay(guest);
        assertEq(stayAmount, amount);
        assertEq(checkInTs, uint64(block.timestamp));
        assertEq(unlockTs, uint64(block.timestamp + 3600));
        assertEq(roomService.totalGuestEscrowLiability(), amount);
        assertEq(hotel.balanceOf(address(roomService)), amount);
        assertEq(hotel.balanceOf(guest), 900 ether);
        assertTrue(roomService.hasUnwithdrawnStay(guest));
        assertTrue(roomService.usedCheckInNonces(nonce));
    }

    function test_checkIn_belowMinReverts() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 100 ether, 500 ether, deadline, 1, 1);
        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.AmountOutOfBounds.selector);
        roomService.checkIn(50 ether, 100 ether, 500 ether, deadline, 1, 1, sig);
    }

    function test_checkIn_aboveMaxReverts() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 2, 1);
        _approve(guest, 200 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.AmountOutOfBounds.selector);
        roomService.checkIn(200 ether, 10 ether, 100 ether, deadline, 2, 1, sig);
    }

    function test_checkIn_expiredAuthReverts() public {
        uint256 deadline = block.timestamp + 10;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 3, 1);
        _approve(guest, 50 ether);
        vm.warp(deadline + 1);
        vm.prank(guest);
        vm.expectRevert(RoomService.ExpiredSignature.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 3, 1, sig);
    }

    function test_checkIn_wrongSignerReverts() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(WRONG_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 4, 1);
        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.InvalidSigner.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 4, 1, sig);
    }

    function test_checkIn_wrongEpochReverts() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 5, 2);
        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.InvalidSignerEpoch.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 5, 2, sig);
    }

    function test_checkIn_reusedNonceReverts() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 6, 1);
        _approve(guest, 100 ether);
        vm.prank(guest);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 6, 1, sig);

        // Checkout so second check-in is not blocked by StayAlreadyActive
        vm.warp(block.timestamp + 3600);
        vm.prank(guest);
        roomService.checkOut();

        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.NonceAlreadyUsed.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline + 3600, 6, 1, sig);
    }

    function test_checkIn_secondActivePositionReverts() public {
        _checkIn(guest, 50 ether, 7);
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 8, 1);
        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.StayAlreadyActive.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 8, 1, sig);
    }

    function test_checkIn_insufficientApprovalReverts() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 9, 1);
        vm.prank(guest);
        hotel.approve(address(roomService), 10 ether);
        vm.prank(guest);
        vm.expectRevert();
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 9, 1, sig);
        assertFalse(roomService.hasUnwithdrawnStay(guest));
        assertFalse(roomService.usedCheckInNonces(9));
    }

    function test_checkOut_exactOneHourLockAndEarlyRevert() public {
        _checkIn(guest, 50 ether, 10);
        vm.prank(guest);
        vm.expectRevert(RoomService.StayStillLocked.selector);
        roomService.checkOut();

        vm.warp(block.timestamp + 3599);
        vm.prank(guest);
        vm.expectRevert(RoomService.StayStillLocked.selector);
        roomService.checkOut();

        vm.warp(block.timestamp + 1);
        uint256 before = hotel.balanceOf(guest);
        vm.prank(guest);
        roomService.checkOut();
        assertEq(hotel.balanceOf(guest) - before, 50 ether);
        assertEq(roomService.totalGuestEscrowLiability(), 0);
        assertFalse(roomService.hasUnwithdrawnStay(guest));
    }

    function test_checkOut_whileCheckInsPaused() public {
        _checkIn(guest, 40 ether, 11);
        vm.prank(owner);
        roomService.pauseCheckIns();

        vm.warp(block.timestamp + 3600);
        vm.prank(guest);
        roomService.checkOut();
        assertEq(hotel.balanceOf(guest), 1_000 ether);
    }

    function test_pauseCheckIns_blocksNewCheckIn() public {
        vm.prank(owner);
        roomService.pauseCheckIns();
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig = _signAuth(ELIGIBILITY_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 12, 1);
        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.CheckInsArePaused.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 12, 1, sig);

        vm.prank(owner);
        roomService.unpauseCheckIns();
        vm.prank(guest);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 12, 1, sig);
        assertTrue(roomService.hasUnwithdrawnStay(guest));
    }

    function test_rotateEligibilitySigner() public {
        address newSigner = vm.addr(0xD00D);
        vm.prank(owner);
        roomService.rotateEligibilitySigner(newSigner);
        assertEq(roomService.eligibilitySigner(), newSigner);
        assertEq(roomService.eligibilitySignerEpoch(), 2);
    }

    function test_directTransferDoesNotCreateStay() public {
        vm.prank(guest);
        hotel.transfer(address(roomService), 25 ether);
        assertFalse(roomService.hasUnwithdrawnStay(guest));
        assertEq(roomService.totalGuestEscrowLiability(), 0);
        assertEq(hotel.balanceOf(address(roomService)), 25 ether);
    }

    function test_recoverSurplusOnly_cannotTouchLiability() public {
        _checkIn(guest, 100 ether, 13);
        vm.prank(guest);
        hotel.transfer(address(roomService), 20 ether);

        vm.prank(owner);
        vm.expectRevert(RoomService.InsufficientSurplus.selector);
        roomService.recoverSurplusHotel(owner, 21 ether);

        vm.prank(owner);
        roomService.recoverSurplusHotel(owner, 20 ether);
        assertEq(hotel.balanceOf(owner), 20 ether);
        assertEq(hotel.balanceOf(address(roomService)), 100 ether);
        assertEq(roomService.totalGuestEscrowLiability(), 100 ether);
    }

    function test_noAdminGuestWithdrawalPath() public {
        _checkIn(guest, 50 ether, 14);
        (bool ok,) = address(roomService).call(
            abi.encodeWithSignature("adminWithdrawGuest(address,address,uint256)", guest, owner, 1)
        );
        assertFalse(ok);
        (bool ok2,) = address(roomService).call(
            abi.encodeWithSignature("forceCheckOut(address)", guest)
        );
        assertFalse(ok2);
        assertTrue(roomService.hasUnwithdrawnStay(guest));
    }

    function test_entitlementSignerCannotAuthorizeCheckIn() public {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig =
            _signAuth(ENTITLEMENT_SIGNER_PK, guest, 10 ether, 100 ether, deadline, 15, 1);
        _approve(guest, 50 ether);
        vm.prank(guest);
        vm.expectRevert(RoomService.InvalidSigner.selector);
        roomService.checkIn(50 ether, 10 ether, 100 ether, deadline, 15, 1, sig);
    }

    function _checkIn(address who, uint256 amount, uint256 nonce) internal {
        uint256 deadline = block.timestamp + 2 minutes;
        bytes memory sig =
            _signAuth(ELIGIBILITY_SIGNER_PK, who, 10 ether, 500 ether, deadline, nonce, 1);
        vm.prank(who);
        hotel.approve(address(roomService), amount);
        vm.prank(who);
        roomService.checkIn(amount, 10 ether, 500 ether, deadline, nonce, 1, sig);
    }

    function _approve(address who, uint256 amount) internal {
        vm.prank(who);
        hotel.approve(address(roomService), amount);
    }

    function _signAuth(
        uint256 pk,
        address authGuest,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 deadline,
        uint256 nonce,
        uint256 epoch
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                roomService.CHECK_IN_AUTHORIZATION_TYPEHASH(),
                authGuest,
                minAmount,
                maxAmount,
                deadline,
                nonce,
                epoch
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", roomService.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
