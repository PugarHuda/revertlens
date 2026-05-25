import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RevertLens — Injective EVM revert debugger",
  description:
    "The only debugger that understands Injective EVM precompiles. Decodes the opaque reverts that generic EVM tools cannot see.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
