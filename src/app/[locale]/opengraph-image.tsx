import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getContent } from "@/lib/data/get-content";
import { pickLocale } from "@/lib/i18n-text";

export const alt = "Le Tran Cat Lam — Software Engineer Portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Reuses the portfolio's own rendered koi; no remote image service or paid asset is required. */
export default async function OpenGraphImage() {
  const [backdrop, { profile, roles }] = await Promise.all([
    readFile(join(process.cwd(), "public/fallback/koi-night.jpg")),
    getContent(),
  ]);
  const title = pickLocale(
    roles.find((role) => role.key === "fullstack")?.title,
    "en",
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0a0a0b",
        color: "#f4f4f5",
        padding: 28,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          border: "2px solid #fb923c",
          borderRadius: 28,
          padding: "48px 52px",
          background: "linear-gradient(135deg, #101b26, #0a0a0b)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse embeds this local data URI into a PNG */}
        <img
          src={`data:image/jpeg;base64,${backdrop.toString("base64")}`}
          width={1000}
          height={563}
          alt=""
          style={{
            position: "absolute",
            right: -50,
            bottom: -15,
            opacity: 0.75,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(90deg, #0a0a0b 0%, rgba(10,10,11,.96) 35%, rgba(10,10,11,0) 72%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(0deg, #0a0a0b 0%, rgba(10,10,11,0) 40%)",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 25, fontWeight: 700, letterSpacing: 6 }}>
            LETCAL
          </span>
          <span style={{ fontSize: 20, color: "#fb923c", letterSpacing: 3 }}>
            PORTFOLIO
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            width: 720,
          }}
        >
          <span
            style={{
              fontSize: 78,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -3,
            }}
          >
            {profile.name}
          </span>
          <span style={{ fontSize: 31, color: "#cbd5e1" }}>{title}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#a1a1aa",
          }}
        >
          <span style={{ width: 42, height: 3, background: "#fb923c" }} />
          <span>letcal.is-a.dev</span>
          <span style={{ marginLeft: "auto", color: "#fb923c" }}>
            Code. Lead. Deliver.
          </span>
        </div>
      </div>
    </div>,
    size,
  );
}
