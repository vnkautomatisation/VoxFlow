export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Shell scrollable pour que les formulaires d'auth (login, register,
  // reset-password) puissent dépasser la hauteur du viewport sur petits
  // écrans sans être clippés par le `overflow: hidden` global sur body.
  return <div className="h-screen overflow-y-auto">{children}</div>
}
