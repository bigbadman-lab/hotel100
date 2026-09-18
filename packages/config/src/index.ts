export {
  type ConfigValidationIssue,
  type ConfigValidationResult,
  emptyHotelConfig,
  frozenConfigDefaults,
  HOTEL_LIVE_DEFAULT,
  type HotelConfig,
  type HotelUnresolvedConfigKeys,
  type ProductionWalletRoles,
  parseAddressList,
  parseOptionalAddress,
} from "./schema.js";

export {
  hotelConfigFromEnv,
  validateProductionConfig,
  validateProductionWallets,
} from "./validate.js";
