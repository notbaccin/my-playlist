import "./globals.css";

export const metadata = {
  title: "Minha Playlist",
  description: "Tocando agora, adições recentes e mais tocadas da minha playlist do Spotify."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
