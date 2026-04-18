/**
 * Jupiter Prediction API applies geo restrictions to the caller IP (not the end user).
 * US and South Korea egress IPs are blocked per https://dev.jup.ag/docs/prediction
 *
 * On Vercel, default Node regions are often US-based; prefer EU so server-side fetch
 * to api.jup.ag is evaluated against a non-restricted IP.
 */
export const preferredRegion = ["fra1", "cdg1", "arn1"];
