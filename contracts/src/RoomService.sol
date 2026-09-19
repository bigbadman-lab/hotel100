// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPonsFeeEscrow} from "./interfaces/IPonsFeeEscrow.sol";

/**
 * @title RoomService
 * @notice Non-upgradeable HOTEL V1 Room Service claim + Pons fee collection + HOTEL check-in escrow.
 * @dev No ETH withdrawal, arbitrary execute, delegatecall, or proxy/upgrade path.
 *      Surplus HOTEL recovery cannot reduce backing below total guest escrow liability.
 *      Checkout cannot be paused. Duration and 1.5x multiplier are fixed off-chain product rules;
 *      duration is enforced onchain; multiplier is applied by the reward worker.
 */
contract RoomService is Ownable2Step, EIP712, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ROOM_SERVICE_CLAIM_TYPEHASH = keccak256(
        "RoomServiceClaim(address guest,uint256 cumulativeEntitlement,uint256 deadline,uint256 signerEpoch)"
    );

    bytes32 public constant CHECK_IN_AUTHORIZATION_TYPEHASH = keccak256(
        "CheckInAuthorization(address guest,uint256 minAmount,uint256 maxAmount,uint256 deadline,uint256 nonce,uint256 signerEpoch)"
    );

    /// @notice Fixed one-hour lock. No owner setter.
    uint64 public constant CHECK_IN_DURATION = 3600;

    address public immutable hotelToken;
    address public immutable ponsFeeEscrow;

    address public entitlementSigner;
    uint256 public signerEpoch;

    address public eligibilitySigner;
    uint256 public eligibilitySignerEpoch;

    mapping(address => uint256) public roomServiceClaimed;
    uint256 public totalRoomServiceClaimed;

    struct Stay {
        uint256 amount;
        uint64 checkInTimestamp;
        uint64 unlockTimestamp;
    }

    mapping(address => Stay) private _stays;
    mapping(uint256 => bool) public usedCheckInNonces;
    uint256 public totalGuestEscrowLiability;
    bool public checkInsPaused;

    event EntitlementSignerRotated(
        address indexed previousSigner,
        address indexed newSigner,
        uint256 indexed newEpoch
    );

    event EligibilitySignerRotated(
        address indexed previousSigner,
        address indexed newSigner,
        uint256 indexed newEpoch
    );

    event RoomServiceClaimed(
        address indexed guest,
        uint256 payoutWei,
        uint256 cumulativeEntitlement,
        uint256 totalRoomServiceClaimed
    );

    event RoomServiceCollected(uint256 pendingWei, uint256 claimedWei, address indexed caller);

    event CheckedIn(
        address indexed guest,
        uint256 amount,
        uint64 checkInTimestamp,
        uint64 unlockTimestamp,
        uint256 nonce,
        uint256 eligibilitySignerEpoch
    );

    event CheckedOut(address indexed guest, uint256 amount, uint64 checkOutTimestamp);

    event CheckInsPaused(address indexed account);
    event CheckInsUnpaused(address indexed account);

    event SurplusHotelRecovered(address indexed to, uint256 amount, uint256 remainingBalance);

    error ZeroAddress();
    error OwnershipRenunciationDisabled();
    error ExpiredSignature();
    error InvalidSignerEpoch();
    error InvalidSigner();
    error NothingClaimable();
    error InsufficientContractBalance();
    error EthTransferFailed();
    error CheckInsArePaused();
    error StayAlreadyActive();
    error NoActiveStay();
    error StayStillLocked();
    error AmountOutOfBounds();
    error ZeroAmount();
    error NonceAlreadyUsed();
    error InsufficientSurplus();

    constructor(
        address hotelToken_,
        address ponsFeeEscrow_,
        address initialOwner_,
        address initialEntitlementSigner_,
        address initialEligibilitySigner_
    ) Ownable(initialOwner_) EIP712("RoomService", "1") {
        if (
            hotelToken_ == address(0) || ponsFeeEscrow_ == address(0)
                || initialOwner_ == address(0) || initialEntitlementSigner_ == address(0)
                || initialEligibilitySigner_ == address(0)
        ) {
            revert ZeroAddress();
        }

        hotelToken = hotelToken_;
        ponsFeeEscrow = ponsFeeEscrow_;
        entitlementSigner = initialEntitlementSigner_;
        signerEpoch = 1;
        eligibilitySigner = initialEligibilitySigner_;
        eligibilitySignerEpoch = 1;
    }

    /// @dev Accept ETH from Pons Fee Escrow claims and test funding only.
    receive() external payable {}

    /**
     * @notice Cumulative self-claim. ETH is sent only to msg.sender.
     * @dev No delegated recipient, no relayer, no partial payout, no minimum.
     */
    function claimRoomService(
        uint256 cumulativeEntitlement,
        uint256 deadline,
        uint256 epoch,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert ExpiredSignature();
        if (epoch != signerEpoch) revert InvalidSignerEpoch();

        address guest = msg.sender;
        bytes32 structHash = keccak256(
            abi.encode(
                ROOM_SERVICE_CLAIM_TYPEHASH, guest, cumulativeEntitlement, deadline, epoch
            )
        );
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recovered != entitlementSigner) revert InvalidSigner();

        uint256 alreadyClaimed = roomServiceClaimed[guest];
        if (cumulativeEntitlement <= alreadyClaimed) revert NothingClaimable();

        uint256 payout = cumulativeEntitlement - alreadyClaimed;
        if (address(this).balance < payout) revert InsufficientContractBalance();

        roomServiceClaimed[guest] = cumulativeEntitlement;
        totalRoomServiceClaimed += payout;

        (bool ok,) = guest.call{value: payout}("");
        if (!ok) revert EthTransferFailed();

        emit RoomServiceClaimed(guest, payout, cumulativeEntitlement, totalRoomServiceClaimed);
    }

    /**
     * @notice Permissionless collection of Pons creator fees owed to this contract.
     * @dev Zero escrow balance ⇒ no-op. Positive ⇒ claim all; ETH lands in RoomService.
     */
    function collectRoomService() external nonReentrant {
        uint256 pending = IPonsFeeEscrow(ponsFeeEscrow).balanceOf(address(this));
        if (pending == 0) {
            emit RoomServiceCollected(0, 0, msg.sender);
            return;
        }

        uint256 claimed = IPonsFeeEscrow(ponsFeeEscrow).claim();
        emit RoomServiceCollected(pending, claimed, msg.sender);
    }

    /**
     * @notice Escrow HOTEL for a one-hour stay. Requires a short-lived eligibility authorization.
     * @dev Approval alone does not start a stay. Nonce is consumed only on success.
     */
    function checkIn(
        uint256 amount,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 deadline,
        uint256 nonce,
        uint256 epoch,
        bytes calldata signature
    ) external nonReentrant {
        if (checkInsPaused) revert CheckInsArePaused();
        if (amount == 0) revert ZeroAmount();
        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();

        address guest = msg.sender;
        if (_stays[guest].amount != 0) revert StayAlreadyActive();
        _assertAndConsumeCheckInAuth(guest, minAmount, maxAmount, deadline, nonce, epoch, signature);

        uint64 checkInTimestamp = uint64(block.timestamp);
        uint64 unlockTimestamp = checkInTimestamp + CHECK_IN_DURATION;

        _stays[guest] =
            Stay({amount: amount, checkInTimestamp: checkInTimestamp, unlockTimestamp: unlockTimestamp});
        totalGuestEscrowLiability += amount;

        IERC20(hotelToken).safeTransferFrom(guest, address(this), amount);

        emit CheckedIn(guest, amount, checkInTimestamp, unlockTimestamp, nonce, epoch);
    }

    function _assertAndConsumeCheckInAuth(
        address guest,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 deadline,
        uint256 nonce,
        uint256 epoch,
        bytes calldata signature
    ) private {
        if (block.timestamp > deadline) revert ExpiredSignature();
        if (epoch != eligibilitySignerEpoch) revert InvalidSignerEpoch();
        if (usedCheckInNonces[nonce]) revert NonceAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(
                CHECK_IN_AUTHORIZATION_TYPEHASH,
                guest,
                minAmount,
                maxAmount,
                deadline,
                nonce,
                epoch
            )
        );
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recovered != eligibilitySigner) revert InvalidSigner();

        usedCheckInNonces[nonce] = true;
    }

    /**
     * @notice Withdraw full escrow after unlock. Available even when new check-ins are paused.
     */
    function checkOut() external nonReentrant {
        address guest = msg.sender;
        Stay memory stay = _stays[guest];
        if (stay.amount == 0) revert NoActiveStay();
        if (block.timestamp < stay.unlockTimestamp) revert StayStillLocked();

        uint256 amount = stay.amount;
        delete _stays[guest];
        totalGuestEscrowLiability -= amount;

        IERC20(hotelToken).safeTransfer(guest, amount);

        emit CheckedOut(guest, amount, uint64(block.timestamp));
    }

    function getStay(address guest)
        external
        view
        returns (uint256 amount, uint64 checkInTimestamp, uint64 unlockTimestamp)
    {
        Stay memory stay = _stays[guest];
        return (stay.amount, stay.checkInTimestamp, stay.unlockTimestamp);
    }

    function hasUnwithdrawnStay(address guest) external view returns (bool) {
        return _stays[guest].amount != 0;
    }

    function pauseClaims() external onlyOwner {
        _pause();
    }

    function unpauseClaims() external onlyOwner {
        _unpause();
    }

    function pauseCheckIns() external onlyOwner {
        checkInsPaused = true;
        emit CheckInsPaused(msg.sender);
    }

    function unpauseCheckIns() external onlyOwner {
        checkInsPaused = false;
        emit CheckInsUnpaused(msg.sender);
    }

    function rotateEntitlementSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address previous = entitlementSigner;
        entitlementSigner = newSigner;
        unchecked {
            ++signerEpoch;
        }
        emit EntitlementSignerRotated(previous, newSigner, signerEpoch);
    }

    function rotateEligibilitySigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address previous = eligibilitySigner;
        eligibilitySigner = newSigner;
        unchecked {
            ++eligibilitySignerEpoch;
        }
        emit EligibilitySignerRotated(previous, newSigner, eligibilitySignerEpoch);
    }

    /**
     * @notice Recover HOTEL above total guest escrow liability only.
     * @dev Direct transfers to this contract do not create stays; they become surplus.
     */
    function recoverSurplusHotel(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = IERC20(hotelToken).balanceOf(address(this));
        if (balance < totalGuestEscrowLiability) revert InsufficientContractBalance();
        uint256 surplus = balance - totalGuestEscrowLiability;
        if (amount > surplus) revert InsufficientSurplus();

        IERC20(hotelToken).safeTransfer(to, amount);
        emit SurplusHotelRecovered(to, amount, balance - amount);
    }

    /// @inheritdoc Ownable
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
