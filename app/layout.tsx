import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Predictor",
  description: "Predict the F1 top-10 and track your season scores.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}