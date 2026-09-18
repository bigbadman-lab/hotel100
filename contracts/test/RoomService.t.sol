// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {RoomService} from "../src/RoomService.sol";
import {MockPonsFeeEscrow} from "./mocks/MockPonsFeeEscrow.sol";
import {ReentrantClaimAttacker} from "./mocks/ReentrantClaimAttacker.sol";

contract RoomServiceTest is Test {
    uint256 internal constant SIGNER_PK = 0xA11CE;
    uint256 internal constant WRONG_SIGNER_PK = 0xB0B;
    uint256 internal constant OWNER_PK = 0xA01;

    address internal hotelToken;
    address internal owner;
    address internal entitlementSigner;
    address internal guest;
    address internal stranger;

    MockPonsFeeEscrow internal escrow;
    RoomService internal roomService;

    function setUp() public {
        hotelToken = makeAddr("hotelToken");
        owner = vm.addr(OWNER_PK);
        entitlementSigner = vm.addr(SIGNER_PK);
        guest = makeAddr("guest");
        stranger = makeAddr("stranger");

        escrow = new MockPonsFeeEscrow();

        vm.prank(owner);
        roomService = new RoomService(hotelToken, address(escrow), owner, entitlementSigner);
    }

    /* ----------------------------- constructor / immutables ----------------------------- */

    function test_constructor_setsImmutablesAndEpoch() public view {
        assertEq(roomService.hotelToken(), hotelToken);
        assertEq(roomService.ponsFeeEscrow(), address(escrow));
        assertEq(roomService.owner(), owner);
        assertEq(roomService.entitlementSigner(), entitlementSigner);
        assertEq(roomService.signerEpoch(), 1);
        assertEq(roomService.totalRoomServiceClaimed(), 0);
    }

    function test_constructor_revertsOnZeroHotelToken() public {
        vm.expectRevert(RoomService.ZeroAddress.selector);
        new RoomService(address(0), address(escrow), owner, entitlementSigner);
    }

    function test_constructor_revertsOnZeroEscrow() public {
        vm.expectRevert(RoomService.ZeroAddress.selector);
        new RoomService(hotelToken, address(0), owner, entitlementSigner);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new RoomService(hotelToken, address(escrow), address(0), entitlementSigner);
    }

    function test_constructor_revertsOnZeroSigner() public {
        vm.expectRevert(RoomService.ZeroAddress.selector);
        new RoomService(hotelToken, address(escrow), owner, address(0));
    }

    /* ----------------------------------- claims ----------------------------------- */

    function test_claim_validCumulativeSelfClaim() public {
        uint256 cumulative = 1 ether;
        _fundRoomService(cumulative);

        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signClaim(SIGNER_PK, guest, cumulative, deadline, 1);

        uint256 beforeBal = guest.balance;
        vm.prank(guest);
        roomService.claimRoomService(cumulative, deadline, 1, sig);

        assertEq(guest.balance - beforeBal, cumulative);
        assertEq(roomService.roomServiceClaimed(guest), cumulative);
        assertEq(roomService.totalRoomServiceClaimed(), cumulative);
    }

    function test_claim_exactClaimedDeltaAndTotal() public {
        _fundRoomService(5 ether);

        uint256 d1 = block.timestamp + 1 days;
        bytes memory sig1 = _signClaim(SIGNER_PK, guest, 2 ether, d1, 1);
        vm.prank(guest);
        roomService.claimRoomService(2 ether, d1, 1, sig1);
        assertEq(roomService.totalRoomServiceClaimed(), 2 ether);

        uint256 d2 = block.timestamp + 1 days;
        bytes memory sig2 = _signClaim(SIGNER_PK, guest, 5 ether, d2, 1);
        uint256 before = guest.balance;
        vm.prank(guest);
        roomService.claimRoomService(5 ether, d2, 1, sig2);

        assertEq(guest.balance - before, 3 ether);
        assertEq(roomService.roomServiceClaimed(guest), 5 ether);
        assertEq(roomService.totalRoomServiceClaimed(), 5 ether);
    }

    function test_claim_replaySameCumulativeReverts() public {
        _fundRoomService(1 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 1);

        vm.prank(guest);
        roomService.claimRoomService(1 ether, deadline, 1, sig);

        vm.prank(guest);
        vm.expectRevert(RoomService.NothingClaimable.selector);
        roomService.claimRoomService(1 ether, deadline, 1, sig);
    }

    function test_claim_lowerCumulativeReverts() public {
        _fundRoomService(2 ether);
        uint256 d1 = block.timestamp + 1 days;
        bytes memory sigHigh = _signClaim(SIGNER_PK, guest, 2 ether, d1, 1);
        vm.prank(guest);
        roomService.claimRoomService(2 ether, d1, 1, sigHigh);

        uint256 d2 = block.timestamp + 1 days;
        bytes memory sigLow = _signClaim(SIGNER_PK, guest, 1 ether, d2, 1);
        vm.prank(guest);
        vm.expectRevert(RoomService.NothingClaimable.selector);
        roomService.claimRoomService(1 ether, d2, 1, sigLow);
    }

    function test_claim_wrongGuestReverts() public {
        _fundRoomService(1 ether);
        uint256 deadline = block.timestamp + 1 days;
        // Signature bound to `guest`; stranger calls ⇒ digest mismatch / invalid signer.
        bytes memory sig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 1);

        vm.prank(stranger);
        vm.expectRevert(RoomService.InvalidSigner.selector);
        roomService.claimRoomService(1 ether, deadline, 1, sig);
    }

    function test_claim_wrongSignerReverts() public {
        _fundRoomService(1 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signClaim(WRONG_SIGNER_PK, guest, 1 ether, deadline, 1);

        vm.prank(guest);
        vm.expectRevert(RoomService.InvalidSigner.selector);
        roomService.claimRoomService(1 ether, deadline, 1, sig);
    }

    function test_claim_expiredSignatureReverts() public {
        _fundRoomService(1 ether);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 1);

        vm.warp(deadline + 1);
        vm.prank(guest);
        vm.expectRevert(RoomService.ExpiredSignature.selector);
        roomService.claimRoomService(1 ether, deadline, 1, sig);
    }

    function test_claim_wrongEpochReverts() public {
        _fundRoomService(1 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 2);

        vm.prank(guest);
        vm.expectRevert(RoomService.InvalidSignerEpoch.selector);
        roomService.claimRoomService(1 ether, deadline, 2, sig);
    }

    function test_claim_signerRotationIncrementsEpochAndInvalidatesOld() public {
        _fundRoomService(2 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory oldSig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 1);

        address newSigner = vm.addr(WRONG_SIGNER_PK);
        vm.prank(owner);
        roomService.rotateEntitlementSigner(newSigner);
        assertEq(roomService.signerEpoch(), 2);
        assertEq(roomService.entitlementSigner(), newSigner);

        vm.prank(guest);
        vm.expectRevert(RoomService.InvalidSignerEpoch.selector);
        roomService.claimRoomService(1 ether, deadline, 1, oldSig);

        bytes memory newSig = _signClaim(WRONG_SIGNER_PK, guest, 1 ether, deadline, 2);
        vm.prank(guest);
        roomService.claimRoomService(1 ether, deadline, 2, newSig);
        assertEq(roomService.roomServiceClaimed(guest), 1 ether);
    }

    function test_claim_pauseAndUnpause() public {
        _fundRoomService(1 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 1);

        vm.prank(owner);
        roomService.pauseClaims();

        vm.prank(guest);
        vm.expectRevert();
        roomService.claimRoomService(1 ether, deadline, 1, sig);

        vm.prank(owner);
        roomService.unpauseClaims();

        vm.prank(guest);
        roomService.claimRoomService(1 ether, deadline, 1, sig);
        assertEq(roomService.roomServiceClaimed(guest), 1 ether);
    }

    function test_claim_insufficientEthReverts() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signClaim(SIGNER_PK, guest, 1 ether, deadline, 1);

        vm.prank(guest);
        vm.expectRevert(RoomService.InsufficientContractBalance.selector);
        roomService.claimRoomService(1 ether, deadline, 1, sig);
    }

    function test_claim_reentrancyProtected() public {
        ReentrantClaimAttacker attacker = new ReentrantClaimAttacker(roomService);
        _fundRoomService(2 ether);

        uint256 deadline = block.timestamp + 1 days;
        // Sign for attacker address as guest (self-claim only).
        bytes memory sig = _signClaim(SIGNER_PK, address(attacker), 1 ether, deadline, 1);
        attacker.setClaim(1 ether, deadline, 1, sig);

        vm.expectRevert();
        attacker.attack();
    }

    /* ----------------------------------- collection ----------------------------------- */

    function test_collect_permissionlessPositiveClaimsAll() public {
        escrow.credit{value: 3 ether}(address(roomService));
        assertEq(escrow.balanceOf(address(roomService)), 3 ether);

        uint256 before = address(roomService).balance;
        vm.prank(stranger);
        roomService.collectRoomService();

        assertEq(address(roomService).balance - before, 3 ether);
        assertEq(escrow.balanceOf(address(roomService)), 0);
    }

    function test_collect_zeroBalanceNoOp() public {
        uint256 before = address(roomService).balance;
        vm.prank(stranger);
        roomService.collectRoomService();
        assertEq(address(roomService).balance, before);
    }

    /* ----------------------------------- ownership ----------------------------------- */

    function test_renounceOwnership_disabled() public {
        vm.prank(owner);
        vm.expectRevert(RoomService.OwnershipRenunciationDisabled.selector);
        roomService.renounceOwnership();
        assertEq(roomService.owner(), owner);
    }

    function test_twoStepOwnershipTransfer() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        roomService.transferOwnership(newOwner);
        assertEq(roomService.owner(), owner);
        assertEq(roomService.pendingOwner(), newOwner);

        vm.prank(newOwner);
        roomService.acceptOwnership();
        assertEq(roomService.owner(), newOwner);
        assertEq(roomService.pendingOwner(), address(0));
    }

    function test_rotateSigner_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        roomService.rotateEntitlementSigner(stranger);
    }

    function test_rotateSigner_zeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(RoomService.ZeroAddress.selector);
        roomService.rotateEntitlementSigner(address(0));
    }

    /* --------------------- absence of forbidden admin powers --------------------- */

    function test_noEthWithdrawalPath() public {
        _fundRoomService(1 ether);
        (bool ok,) =
            address(roomService).call(abi.encodeWithSignature("withdraw(address,uint256)", owner, 1 ether));
        assertFalse(ok);

        (bool ok2,) = address(roomService).call(abi.encodeWithSignature("withdrawETH(uint256)", 1 ether));
        assertFalse(ok2);

        (bool ok3,) =
            address(roomService).call(abi.encodeWithSignature("sweep(address)", owner));
        assertFalse(ok3);
    }

    function test_noTokenRescuePath() public {
        (bool ok,) = address(roomService).call(
            abi.encodeWithSignature("rescueTokens(address,address,uint256)", hotelToken, owner, 1)
        );
        assertFalse(ok);

        (bool ok2,) = address(roomService).call(
            abi.encodeWithSignature("recoverERC20(address,uint256)", hotelToken, 1)
        );
        assertFalse(ok2);
    }

    function test_noArbitraryExecuteOrDelegatecallPath() public {
        (bool ok,) = address(roomService).call(
            abi.encodeWithSignature("execute(address,uint256,bytes)", owner, 0, "")
        );
        assertFalse(ok);

        (bool ok2,) = address(roomService).call(
            abi.encodeWithSignature("functionCall(address,bytes)", owner, "")
        );
        assertFalse(ok2);

        (bool ok3,) = address(roomService).call(
            abi.encodeWithSignature("delegatecall(address,bytes)", owner, "")
        );
        assertFalse(ok3);
    }

    function test_noUpgradePath() public {
        (bool ok,) = address(roomService).call(
            abi.encodeWithSignature("upgradeTo(address)", address(0xBEEF))
        );
        assertFalse(ok);

        (bool ok2,) = address(roomService).call(
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(0xBEEF), "")
        );
        assertFalse(ok2);

        (bool ok3,) = address(roomService).call(abi.encodeWithSignature("proxiableUUID()"));
        assertFalse(ok3);
    }

    /* ----------------------------------- helpers ----------------------------------- */

    function _fundRoomService(uint256 amount) internal {
        vm.deal(address(this), amount);
        (bool ok,) = address(roomService).call{value: amount}("");
        require(ok, "fund failed");
    }

    function _signClaim(
        uint256 pk,
        address claimGuest,
        uint256 cumulativeEntitlement,
        uint256 deadline,
        uint256 epoch
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                roomService.ROOM_SERVICE_CLAIM_TYPEHASH(),
                claimGuest,
                cumulativeEntitlement,
                deadline,
                epoch
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", roomService.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    receive() external payable {}
}
