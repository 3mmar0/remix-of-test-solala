export const meta = (title: string, description: string, pathname = "/") => ({
  meta: [
    { title: `${title} | Solala سلالة` },
    { name: "description", content: description },
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
    { property: "og:title", content: `${title} | Solala سلالة` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Solala سلالة" },
    { property: "og:locale", content: "ar_EG" },
    { property: "og:url", content: `https://solalaa.com${pathname}` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: `${title} | Solala سلالة` },
    { name: "twitter:description", content: description },
  ],
  links: [{ rel: "canonical", href: `https://solalaa.com${pathname}` }],
});

export const adminMeta = (title: string, description: string, pathname: string) => {
  const metadata = meta(title, description, pathname);
  return { ...metadata, meta: metadata.meta.map((item) => item.name === "robots" ? { name: "robots", content: "noindex, nofollow" } : item) };
};
