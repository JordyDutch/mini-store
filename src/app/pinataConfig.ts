"server only"

import { PinataSDK } from "pinata-web3"

export const pinata = new PinataSDK({
  // Use ?? / || so an UNSET env var never becomes the literal string "undefined".
  pinataJwt: process.env.PINATA_JWT ?? "",
  pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL || undefined,
})