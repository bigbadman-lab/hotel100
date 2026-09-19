export {
  type ConfigValidationIssue,
  type ConfigValidationResult,
  emptyHotelConfig,
  frozenConfigDefaults,
  HOTEL_CHECKIN_ENABLED_DEFAULT,
  HOTEL_LIVE_DEFAULT,
  type HotelConfig,
  type HotelUnresolvedConfigKeys,
  type ProductionWalletRoles,
  parseAddressList,
  parseOptionalAddress,
} from "./schema.js";

export {
  hotelConfigFromEnv,
  validateEligibilitySigner,
  validateProductionConfig,
  validateProductionWallets,
} from "./validate.js";
