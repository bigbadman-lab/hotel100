// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IPonsFeeEscrow} from "./interfaces/IPonsFeeEscrow.sol";

/**
 * @title RoomService
 * @notice Non-upgradeable HOTEL V1 Room Service claim + Pons fee collection contract.
 * @dev No ETH withdrawal, token rescue, arbitrary execute, delegatecall, or proxy/upgrade path.
 */
contract RoomService is Ownable2Step, EIP712, ReentrancyGuard, Pausable {
    bytes32 public constant ROOM_SERVICE_CLAIM_TYPEHASH = keccak256(
        "RoomServiceClaim(address guest,uint256 cumulativeEntitlement,uint256 deadline,uint256 signerEpoch)"
    );

    address public immutable hotelToken;
    address public immutable ponsFeeEscrow;

    address public entitlementSigner;
    uint256 public signerEpoch;

    mapping(address => uint256) public roomServiceClaimed;
    uint256 public totalRoomServiceClaimed;

    event EntitlementSignerRotated(
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

    error ZeroAddress();
    error OwnershipRenunciationDisabled();
    error ExpiredSignature();
    error InvalidSignerEpoch();
    error InvalidSigner();
    error NothingClaimable();
    error InsufficientContractBalance();
    error EthTransferFailed();

    constructor(
        address hotelToken_,
        address ponsFeeEscrow_,
        address initialOwner_,
        address initialEntitlementSigner_
    ) Ownable(initialOwner_) EIP712("RoomService", "1") {
        if (
            hotelToken_ == address(0) || ponsFeeEscrow_ == address(0)
                || initialOwner_ == address(0) || initialEntitlementSigner_ == address(0)
        ) {
            revert ZeroAddress();
        }

        hotelToken = hotelToken_;
        ponsFeeEscrow = ponsFeeEscrow_;
        entitlementSigner = initialEntitlementSigner_;
        signerEpoch = 1;
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

    function pauseClaims() external onlyOwner {
        _pause();
    }

    function unpauseClaims() external onlyOwner {
        _unpause();
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

    /// @inheritdoc Ownable
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
