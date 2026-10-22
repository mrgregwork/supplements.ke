// Flat delivery fee (KES), added on top of the priced cart total for every
// web order -- this site has no pickup option, so delivery always applies.
// Owner-set flat rate, not currently admin-configurable like other site
// settings -- revisit as a real setting if the owner ever wants to vary it.
// Mirrors shopusa.co.ke's shared/deliveryFee.ts (same KES 500 rate).
export const DELIVERY_FEE_KES = 500;
