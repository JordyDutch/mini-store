export const mobileAppAssociationHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

export const appleAppSiteAssociation = {
  applinks: {
    details: [
      {
        appIDs: [
          "GF84T788R2.io.universaleverything.universalprofiles",
          "GF84T788R2.io.universaleverything.universalprofiles.dev",
        ],
        components: [{ "/": "/*" }],
      },
    ],
  },
};

export const androidAssetLinks = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "io.universaleverything.universalprofiles.dev",
      sha256_cert_fingerprints: [
        "BD:F6:D2:4E:A5:0F:CC:55:38:73:51:C3:7E:10:82:F2:1B:08:8C:0B:7C:57:9A:6B:9F:41:30:9F:16:1A:96:E0",
      ],
    },
  },
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "io.universaleverything.universalprofiles",
      sha256_cert_fingerprints: [
        "57:2B:CB:73:44:C7:4F:32:6F:B4:B1:EE:CA:5F:1A:E0:E8:73:E6:17:8B:FF:0F:4B:C1:B3:5F:62:76:54:6B:1F",
      ],
    },
  },
];
